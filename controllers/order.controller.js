// ==================== ENHANCED ORDER CONTROLLER ====================
// controllers/order.controller.js

import { Order } from "../models/order.model.js";
import { User } from "../models/user.model.js";
import { errorResponse, successResponse } from "../utils/response.util.js";
import { processPayment, verifyPayment } from "../services/payment.service.js";
import mongoose from "mongoose";
import {
  sendDeliveryConfirmation,
  sendDeliveryUpdate,
  sendOrderCancelled,
  sendOrderConfirmation,
  sendPaymentConfirmation,
  sendOrderStatusUpdate,
} from "../services/email.service.js";
import logger from "../config/logger.config.js";

export const calculateOrderTotal = (items) => {
  return items.reduce((acc, item) => acc + item.price * item.quantity, 0);
};

// ================== SOCKET UTILITY FUNCTIONS ==================

const emitToOrderRoom = (io, orderId, event, data) => {
  io.to(`order_${orderId}`).emit(event, data);
  logger.info(`Emitted ${event} to order room: ${orderId}`);
};

const emitToUser = (io, userId, event, data) => {
  io.to(`user_${userId}`).emit(event, data);
  logger.info(`Emitted ${event} to user: ${userId}`);
};

const emitToDriver = (io, driverId, event, data) => {
  io.to(`driver_${driverId}`).emit(event, data);
  logger.info(`Emitted ${event} to driver: ${driverId}`);
};

const emitToAdmins = (io, event, data) => {
  io.to("admin_room").emit(event, data);
  logger.info(`Emitted ${event} to admin room`);
};

// ================== EXISTING CONTROLLERS (ENHANCED) ==================

export const getOrders = async (req, res, next) => {
  try {
    const orders = await Order.find({})
      .populate("user", "name email")
      .populate("driver", "name email phone")
      .sort({ createdAt: -1 });

    if (!orders || !orders.length)
      return errorResponse(res, "No order placed yet", 404);

    successResponse(res, { orders });
  } catch (error) {
    next(error);
  }
};

export const getOrderById = async (req, res, next) => {
  try {
    const id = req.params.id;
    if (!id) return errorResponse(res, "OrderId is required", 400);

    const user = req.user;
    const order = await Order.findById(id)
      .populate("user", "name email phone")
      .populate("driver", "name email phone");

    if (!order) return errorResponse(res, "Order not found", 404);

    // Authorization check
    const isOwner = String(user._id) === String(order.user._id);
    const isAssignedDriver =
      order.driver && String(user._id) === String(order.driver._id);
    const isAdmin = user.role === "admin";

    if (!isOwner && !isAssignedDriver && !isAdmin) {
      return errorResponse(res, "Access denied", 403);
    }

    successResponse(res, { order });
  } catch (error) {
    next(error);
  }
};

export const createOrder = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { items = [], address, phone } = req.body;

    // Validate
    if (
      !items ||
      !items.length ||
      !address.street ||
      !address.city ||
      !address.state ||
      !phone
    ) {
      return errorResponse(res, "All fields are required!", 400);
    }

    const user = await User.findById(req.user._id);
    if (!user) return errorResponse(res, "User not found", 401);

    const totalPrice = calculateOrderTotal(items);

    // Create order
    const order = await Order.create(
      [
        {
          items,
          address,
          totalPrice,
          phone,
          user: user._id,
          status: "pending",
        },
      ],
      { session }
    );

    // Initialize Paystack payment
    const paymentInit = await processPayment(user.email, totalPrice);

    // Get Socket.IO instance
    const dominoIo = req.app.get("dominoIo");

    // Real-time notifications
    if (dominoIo) {
      // Notify admins about new order
      emitToAdmins(dominoIo, "new_order_created", {
        orderId: order[0]._id,
        orderCode: order[0].orderCode,
        customer: {
          id: user._id,
          name: user.name,
          email: user.email,
        },
        totalPrice,
        status: "pending",
        timestamp: new Date(),
      });

      // Join customer to order room automatically
      emitToUser(dominoIo, user._id, "order_created", {
        orderId: order[0]._id,
        orderCode: order[0].orderCode,
        status: "pending",
        paymentUrl: paymentInit.authorization_url,
        message: "Order created successfully. Please complete payment.",
      });
    }

    await sendOrderConfirmation(user, order[0]);
    await session.commitTransaction();

    return successResponse(
      res,
      {
        order: order[0],
        payment: paymentInit,
        message: "Order created successfully. Proceed to payment.",
      },
      201
    );
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
};

export const orderPayment = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { reference } = req.body;

    if (!reference)
      return errorResponse(res, "Payment reference is required!", 400);

    const order = await Order.findById(req.params.id)
      .populate("user", "name email")
      .populate("driver", "name email phone");

    if (!order) return errorResponse(res, "Order not found", 404);

    // Ensure the order belongs to the current user
    if (!order.user._id.equals(req.user._id)) {
      return errorResponse(res, "Unauthorized", 403);
    }

    if (order.status !== "pending") {
      return errorResponse(
        res,
        `Order cannot be paid because it is currently ${order.status}.`
      );
    }

    // Verify transaction with Paystack
    const paymentData = await verifyPayment(reference);

    if (paymentData.status !== "success") {
      logger.error(`Payment failed: ${paymentData.gateway_response}`);
      return errorResponse(res, "Payment verification failed!", 400);
    }

    logger.info(`Payment verified for order ${order.orderCode}`);

    // Update order status
    order.status = "placed";
    order.paymentReference = reference;
    order.paidAt = new Date();
    await order.save({ session });

    // Get Socket.IO instance
    const dominoIo = req.app.get("dominoIo");

    if (dominoIo) {
      // Notify customer about successful payment
      emitToUser(dominoIo, order.user._id, "payment_confirmed", {
        orderId: order._id,
        orderCode: order.orderCode,
        status: "placed",
        message: "Payment successful! Your order is now placed.",
        timestamp: new Date(),
      });

      // Notify order room
      emitToOrderRoom(dominoIo, order._id, "order_status", {
        orderId: order._id,
        status: "placed",
        message: "Payment confirmed - order placed successfully",
      });

      // Notify admins about paid order
      emitToAdmins(dominoIo, "order_paid", {
        orderId: order._id,
        orderCode: order.orderCode,
        customer: order.user.name,
        totalPrice: order.totalPrice,
        status: "placed",
        timestamp: new Date(),
      });

      // Find available drivers and notify them about new order
      const availableDrivers = await User.find({
        role: "driver",
        isOnline: true, // You'd need to add this field to track online status
      });

      availableDrivers.forEach((driver) => {
        emitToDriver(dominoIo, driver._id, "new_order_available", {
          orderId: order._id,
          orderCode: order.orderCode,
          customer: {
            name: order.user.name,
            address: order.address,
            phone: order.phone,
          },
          items: order.items,
          total: order.totalPrice,
          distance: "2.5 km", // Calculate actual distance
          estimatedTime: "15 min", // Calculate actual time
        });
      });
    }

    await sendPaymentConfirmation(order.user, order);
    await session.commitTransaction();

    return successResponse(res, {
      message: "Order payment verified successfully.",
      order,
      paymentData,
    });
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
};

export const trackOrder = async (req, res, next) => {
  try {
    const id = req.params.id;
    const user = req.user;

    if (!id) return errorResponse(res, "OrderId is required!", 400);

    const order = await Order.findById(id)
      .populate("user", "name email")
      .populate("driver", "name email phone");

    if (!order) return errorResponse(res, "Order not found", 404);

    // Authorization check
    const isOwner = order.user._id.equals(user._id);
    const isAssignedDriver = order.driver && order.driver._id.equals(user._id);
    const isAuthorized = isOwner || isAssignedDriver || user.role === "admin";

    if (!isAuthorized) return errorResponse(res, "Unauthorized", 403);

    const orderStat = {
      id: order._id,
      orderCode: order.orderCode,
      customer: {
        id: order.user._id,
        name: order.user.name,
        email: order.user.email,
        phone: order.phone,
        address: order.address,
      },
      driver: order.driver
        ? {
            id: order.driver._id,
            name: order.driver.name,
            phone: order.driver.phone,
          }
        : null,
      items: order.items,
      total: order.totalPrice,
      status: order.status,
      createdAt: order.createdAt,
      estimatedDelivery: calculateEstimatedDelivery(order),
    };

    successResponse(res, { orderStat }, 200);
  } catch (error) {
    next(error);
  }
};

// ================== NEW SOCKET-ENHANCED CONTROLLERS ==================

export const assignDriver = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const { driverId } = req.body;

    if (req.user.role !== "admin") {
      return errorResponse(res, "Only admins can assign drivers", 403);
    }

    const order = await Order.findById(orderId)
      .populate("user", "name email")
      .populate("driver", "name email phone");
    const driver = await User.findById(driverId);

    if (!order) return errorResponse(res, "Order not found", 404);
    if (!driver || driver.role !== "driver") {
      return errorResponse(res, "Invalid driver", 400);
    }

    if (order.status !== "placed") {
      return errorResponse(
        res,
        "Order must be in 'placed' status to assign driver",
        400
      );
    }

    // Update order with driver
    order.driver = driverId;
    order.status = "assigned";
    await order.save();

    // Get Socket.IO instance
    const dominoIo = req.app.get("dominoIo");

    if (dominoIo) {
      // Notify customer about driver assignment
      emitToUser(dominoIo, order.user._id, "driver_assigned", {
        orderId: order._id,
        orderCode: order.orderCode,
        driver: {
          id: driver._id,
          name: driver.name,
          phone: driver.phone,
        },
        status: "assigned",
        message: `${driver.name} has been assigned to deliver your order`,
      });

      // Notify order room
      emitToOrderRoom(dominoIo, order._id, "driver_assigned", {
        orderId: order._id,
        driver: {
          id: driver._id,
          name: driver.name,
          phone: driver.phone,
        },
        status: "assigned",
      });

      // Notify assigned driver
      emitToDriver(dominoIo, driverId, "order_assigned_to_you", {
        orderId: order._id,
        orderCode: order.orderCode,
        customer: {
          name: order.user.name,
          phone: order.phone,
          address: order.address,
        },
        items: order.items,
        total: order.totalPrice,
        message: "New order assigned to you!",
      });
    }

    successResponse(res, {
      message: "Driver assigned successfully",
      order: {
        ...order.toObject(),
        driver: driver,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const updateOrder = async (req, res, next) => {
  try {
    const id = req.params.id;
    const { status } = req.query;
    const { message, timeRemaining, location } = req.body;

    if (!id) return errorResponse(res, "OrderId is required!", 400);
    if (!status) return errorResponse(res, "Status field is required", 400);

    // Normalize status
    const newStatus = status.toLowerCase();

    // Enum validation
    const allowedStatuses = Order.schema.path("status").enumValues;
    if (!allowedStatuses.includes(newStatus)) {
      return errorResponse(res, "Invalid status value", 400);
    }

    const previousOrder = await Order.findById(id)
      .populate("user", "name email")
      .populate("driver", "name email phone");

    if (!previousOrder) return errorResponse(res, "Order not found", 404);

    // Authorization check
    const user = req.user;
    const canUpdate =
      user.role === "admin" ||
      (user.role === "driver" &&
        previousOrder.driver &&
        previousOrder.driver._id.equals(user._id));

    if (!canUpdate) {
      return errorResponse(res, "Unauthorized to update this order", 403);
    }

    const previousStatus = previousOrder.status;
    previousOrder.status = newStatus;

    // Add location update if driver is updating
    if (location && user.role === "driver") {
      previousOrder.driverLocation = {
        ...location,
        timestamp: new Date(),
      };
    }

    await previousOrder.save();

    // Get Socket.IO instance
    const dominoIo = req.app.get("dominoIo");

    const updateData = {
      orderId: previousOrder._id,
      orderCode: previousOrder.orderCode,
      previousStatus,
      newStatus,
      message: message || getStatusMessage(newStatus),
      timeRemaining,
      location: previousOrder.driverLocation,
      updatedBy: {
        id: user._id,
        name: user.name,
        role: user.role,
      },
      timestamp: new Date(),
    };

    if (dominoIo) {
      // Notify customer
      emitToUser(
        dominoIo,
        previousOrder.user._id,
        "order_status_updated",
        updateData
      );

      // Notify order room
      emitToOrderRoom(
        dominoIo,
        previousOrder._id,
        "order_status_updated",
        updateData
      );

      // Notify admins
      emitToAdmins(dominoIo, "order_status_updated", updateData);

      // Special handling for specific statuses
      switch (newStatus) {
        case "out-for-delivery":
          // Start real-time location tracking
          emitToUser(dominoIo, previousOrder.user._id, "delivery_started", {
            orderId: previousOrder._id,
            driver: {
              id: previousOrder.driver._id,
              name: previousOrder.driver.name,
              phone: previousOrder.driver.phone,
            },
            estimatedTime: timeRemaining || 20,
            message: "Your order is on the way!",
          });
          break;

        case "delivered":
          // Stop location tracking and notify completion
          emitToUser(dominoIo, previousOrder.user._id, "order_delivered", {
            orderId: previousOrder._id,
            message: "Your order has been delivered! Enjoy your meal! 🍕",
            timestamp: new Date(),
          });
          break;
      }
    }

    // Send email notifications
    try {
      if (newStatus === "out-for-delivery") {
        await sendDeliveryUpdate(
          previousOrder.user,
          previousOrder,
          timeRemaining
        );
      } else if (newStatus === "delivered") {
        await sendDeliveryConfirmation(previousOrder.user, previousOrder);
      } else {
        await sendOrderStatusUpdate(
          previousOrder.user,
          previousOrder,
          previousStatus,
          message
        );
      }
    } catch (emailError) {
      logger.error("Email notification failed:", emailError);
      // Don't fail the request if email fails
    }

    return successResponse(
      res,
      {
        message: "Order updated successfully!",
        order: previousOrder,
        statusUpdate: updateData,
      },
      200
    );
  } catch (error) {
    next(error);
  }
};

export const cancelOrder = async (req, res, next) => {
  try {
    const id = req.params.id;
    const { reason } = req.body;

    if (!id) return errorResponse(res, "OrderId is required!", 400);

    const orderToBeCancelled = await Order.findById(id)
      .populate("user", "name email")
      .populate("driver", "name email phone");

    if (!orderToBeCancelled) return errorResponse(res, "Order not found", 404);

    // Check if order can be cancelled
    if (
      orderToBeCancelled.status !== "pending" &&
      orderToBeCancelled.status !== "placed"
    ) {
      return errorResponse(
        res,
        `Order cannot be cancelled because it is already ${orderToBeCancelled.status}`,
        409
      );
    }

    const previousStatus = orderToBeCancelled.status;
    orderToBeCancelled.status = "cancelled";
    orderToBeCancelled.cancellationReason = reason;
    orderToBeCancelled.cancelledAt = new Date();
    await orderToBeCancelled.save();

    // Get Socket.IO instance
    const dominoIo = req.app.get("dominoIo");

    const cancellationData = {
      orderId: orderToBeCancelled._id,
      orderCode: orderToBeCancelled.orderCode,
      previousStatus,
      reason: reason || "Order cancelled",
      cancelledBy: {
        id: req.user._id,
        name: req.user.name,
        role: req.user.role,
      },
      timestamp: new Date(),
    };

    if (dominoIo) {
      // Notify customer
      emitToUser(
        dominoIo,
        orderToBeCancelled.user._id,
        "order_cancelled",
        cancellationData
      );

      // Notify order room
      emitToOrderRoom(
        dominoIo,
        orderToBeCancelled._id,
        "order_cancelled",
        cancellationData
      );

      // Notify assigned driver if any
      if (orderToBeCancelled.driver) {
        emitToDriver(
          dominoIo,
          orderToBeCancelled.driver._id,
          "assigned_order_cancelled",
          {
            ...cancellationData,
            message: `Order ${orderToBeCancelled.orderCode} has been cancelled`,
          }
        );
      }

      // Notify admins
      emitToAdmins(dominoIo, "order_cancelled", cancellationData);
    }

    await sendOrderCancelled(orderToBeCancelled.user, orderToBeCancelled);

    successResponse(
      res,
      {
        message: "Order cancelled successfully",
        cancellationData,
      },
      200
    );
  } catch (error) {
    next(error);
  }
};

// ================== NEW DRIVER-SPECIFIC CONTROLLERS ==================

export const getDriverOrders = async (req, res, next) => {
  try {
    if (req.user.role !== "driver") {
      return errorResponse(res, "Only drivers can access this endpoint", 403);
    }

    const { status } = req.query;
    const filter = { driver: req.user._id };

    if (status) {
      filter.status = status;
    }

    const orders = await Order.find(filter)
      .populate("user", "name email phone")
      .sort({ createdAt: -1 });

    const ordersWithDistance = orders.map((order) => ({
      ...order.toObject(),
      estimatedDistance: calculateDistance(req.user.location, order.address),
      estimatedTime: calculateEstimatedTime(req.user.location, order.address),
    }));

    successResponse(res, {
      orders: ordersWithDistance,
      totalOrders: orders.length,
    });
  } catch (error) {
    next(error);
  }
};

export const acceptOrder = async (req, res, next) => {
  try {
    if (req.user.role !== "driver") {
      return errorResponse(res, "Only drivers can accept orders", 403);
    }

    const { orderId } = req.params;
    const order = await Order.findById(orderId).populate(
      "user",
      "name email phone"
    );

    if (!order) return errorResponse(res, "Order not found", 404);

    if (order.driver) {
      return errorResponse(
        res,
        "Order already assigned to another driver",
        409
      );
    }

    if (order.status !== "placed") {
      return errorResponse(res, "Order not available for assignment", 400);
    }

    // Assign driver and update status
    order.driver = req.user._id;
    order.status = "preparing";
    order.assignedAt = new Date();
    await order.save();

    // Get Socket.IO instance
    const dominoIo = req.app.get("dominoIo");

    if (dominoIo) {
      // Notify customer
      emitToUser(dominoIo, order.user._id, "driver_assigned", {
        orderId: order._id,
        orderCode: order.orderCode,
        driver: {
          id: req.user._id,
          name: req.user.name,
          phone: req.user.phone,
        },
        status: "preparing",
        message: `${req.user.name} has accepted your order and is preparing it`,
      });

      // Notify order room
      emitToOrderRoom(dominoIo, order._id, "driver_assigned", {
        orderId: order._id,
        driver: {
          id: req.user._id,
          name: req.user.name,
          phone: req.user.phone,
        },
        status: "preparing",
      });

      // Notify admins
      emitToAdmins(dominoIo, "order_accepted_by_driver", {
        orderId: order._id,
        orderCode: order.orderCode,
        driverId: req.user._id,
        driverName: req.user.name,
        customerName: order.user.name,
        timestamp: new Date(),
      });

      // Notify other drivers that order is no longer available
      const otherDrivers = await User.find({
        role: "driver",
        _id: { $ne: req.user._id },
      });

      otherDrivers.forEach((driver) => {
        emitToDriver(dominoIo, driver._id, "order_no_longer_available", {
          orderId: order._id,
          orderCode: order.orderCode,
          message: "Order has been accepted by another driver",
        });
      });
    }

    successResponse(res, {
      message: "Order accepted successfully",
      order: {
        ...order.toObject(),
        driver: req.user,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const updateDriverLocation = async (req, res, next) => {
  try {
    if (req.user.role !== "driver") {
      return errorResponse(res, "Only drivers can update location", 403);
    }

    const { orderId } = req.params;
    const { latitude, longitude, heading, speed } = req.body;

    if (!latitude || !longitude) {
      return errorResponse(res, "Latitude and longitude are required", 400);
    }

    const order = await Order.findById(orderId).populate("user", "name email");

    if (!order) return errorResponse(res, "Order not found", 404);

    if (!order.driver || !order.driver.equals(req.user._id)) {
      return errorResponse(res, "You are not assigned to this order", 403);
    }

    // Update driver location in order
    order.driverLocation = {
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      heading: heading ? parseFloat(heading) : 0,
      speed: speed ? parseFloat(speed) : 0,
      timestamp: new Date(),
    };

    await order.save();

    // Calculate ETA
    const estimatedArrival = calculateETA(
      { lat: latitude, lng: longitude },
      order.address
    );

    // Get Socket.IO instance
    const dominoIo = req.app.get("dominoIo");

    const locationData = {
      orderId: order._id,
      driver: {
        id: req.user._id,
        name: req.user.name,
      },
      location: {
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        heading: heading ? parseFloat(heading) : 0,
        speed: speed ? parseFloat(speed) : 0,
        timestamp: new Date(),
      },
      estimatedArrival,
    };

    if (dominoIo) {
      // Send to customer tracking this order
      emitToUser(
        dominoIo,
        order.user._id,
        "driver_location_updated",
        locationData
      );

      // Send to order room
      emitToOrderRoom(
        dominoIo,
        order._id,
        "driver_location_updated",
        locationData
      );

      // Send to admin for monitoring
      emitToAdmins(dominoIo, "driver_location_updated", {
        ...locationData,
        customerName: order.user.name,
        orderCode: order.orderCode,
      });
    }

    successResponse(res, {
      message: "Location updated successfully",
      location: locationData.location,
      estimatedArrival,
    });
  } catch (error) {
    next(error);
  }
};

// ================== HELPER FUNCTIONS ==================

const getStatusMessage = (status) => {
  const messages = {
    pending: "Order is pending payment",
    placed: "Order has been placed successfully",
    preparing: "Your order is being prepared",
    ready: "Your order is ready for pickup/delivery",
    "out-for-delivery": "Your order is on the way",
    delivered: "Your order has been delivered",
    cancelled: "Order has been cancelled",
  };
  return messages[status] || `Order status updated to ${status}`;
};

const calculateEstimatedDelivery = (order) => {
  const statusTimes = {
    pending: 0,
    placed: 5,
    preparing: 15,
    ready: 20,
    "out-for-delivery": 30,
    delivered: 0,
  };

  const baseTime = statusTimes[order.status] || 0;
  return new Date(Date.now() + baseTime * 60 * 1000);
};

const calculateDistance = (driverLocation, orderAddress) => {
  // Simplified distance calculation
  // In production, use Google Maps Distance Matrix API
  return Math.random() * 10 + 1; // 1-10 km
};

const calculateEstimatedTime = (driverLocation, orderAddress) => {
  // Simplified time calculation
  // In production, use Google Maps Duration API
  const distance = calculateDistance(driverLocation, orderAddress);
  return Math.round(distance * 3); // ~3 minutes per km
};

const calculateETA = (driverLocation, customerAddress) => {
  // Simplified ETA calculation
  const estimatedMinutes = calculateEstimatedTime(
    driverLocation,
    customerAddress
  );
  const etaTime = new Date(Date.now() + estimatedMinutes * 60 * 1000);

  return {
    estimatedMinutes,
    estimatedArrival: etaTime,
    lastUpdated: new Date(),
  };
};

// ================== REAL-TIME DASHBOARD CONTROLLER ==================

const getDashboardData = async (req, res, next) => {
  try {
    if (req.user.role !== "admin") {
      return errorResponse(res, "Admin access required", 403);
    }

    // Get real-time statistics
    const [
      totalOrders,
      activeOrders,
      onlineDrivers,
      todaysRevenue,
      pendingOrders,
      completedToday,
    ] = await Promise.all([
      Order.countDocuments(),
      Order.countDocuments({
        status: { $in: ["placed", "preparing", "out-for-delivery"] },
      }),
      User.countDocuments({ role: "driver", isOnline: true }),
      Order.aggregate([
        {
          $match: {
            status: "delivered",
            createdAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) },
          },
        },
        { $group: { _id: null, total: { $sum: "$totalPrice" } } },
      ]),
      Order.countDocuments({ status: "pending" }),
      Order.countDocuments({
        status: "delivered",
        createdAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) },
      }),
    ]);

    const dashboardData = {
      totalOrders,
      activeOrders,
      onlineDrivers,
      todaysRevenue: todaysRevenue[0]?.total || 0,
      pendingOrders,
      completedToday,
      lastUpdated: new Date(),
    };

    // Get Socket.IO instance and emit to admin room
    const dominoIo = req.app.get("dominoIo");
    if (dominoIo) {
      emitToAdmins(dominoIo, "dashboard_data_updated", dashboardData);
    }

    successResponse(res, { dashboard: dashboardData });
  } catch (error) {
    next(error);
  }
};

// Add to order.controller.js
const getOrderAnalytics = async (req, res, next) => {
  try {
    const analytics = await Order.aggregate([
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          totalOrders: { $sum: 1 },
          totalRevenue: { $sum: "$totalPrice" },
          avgOrderValue: { $avg: "$totalPrice" },
        },
      },
      { $sort: { _id: -1 } },
      { $limit: 30 },
    ]);

    successResponse(res, { analytics });
  } catch (error) {
    next(error);
  }
};

export {
  // Export the socket utility functions for use in other modules
  emitToOrderRoom,
  emitToUser,
  emitToDriver,
  emitToAdmins,
  getDashboardData,
  getOrderAnalytics,
};
