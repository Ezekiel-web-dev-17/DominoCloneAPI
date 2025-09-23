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
} from "../services/email.service.js";
import logger from "../config/logger.config.js";

export const calculateOrderTotal = (items) => {
  return items.reduce((acc, item) => acc + item.price * item.quantity, 0);
};

export const getOrders = async (req, res, next) => {
  try {
    const orders = await Order.find({});

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

    const order = await Order.findById(req.params.id);

    if (String(user._id) !== String(order.user))
      return errorResponse(
        res,
        "Only the user, an admin and drivers is granted the access to this resource.",
        403
      );

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
    if (!user)
      return errorResponse(
        res,
        "User you have to sign up to access this resource.",
        401
      );

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

    const order = await Order.findById(req.params.id).populate("user");
    if (!order) return errorResponse(res, "Order not found", 404);

    // Ensure the order belongs to the current user
    if (!order.user._id.equals(req.user._id)) {
      return errorResponse(res, "Unauthorized", 403);
    }

    if (order.status !== "pending") {
      return errorResponse(
        res,
        `Order cannot be placed because this order is currently ${order.status}.`
      );
    }

    // Verify transaction with Paystack
    const paymentData = await verifyPayment(reference);

    if (paymentData.status !== "success") {
      logger.error(`Payment failed/abandoned: ${paymentData.gateway_response}`);
      return errorResponse(res, "Payment verification failed!", 400);
    }
    logger.info(`Payment status: ${paymentData.status}`);

    // Update order
    order.status = "placed";
    await order.save({ session });

    await sendPaymentConfirmation(order.user, order);

    await session.commitTransaction();
    session.endSession();

    return successResponse(res, {
      message: "Order payment verified successfully.",
      order,
      paymentData,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    next(error);
  }
};

export const trackOrder = async (req, res, next) => {
  try {
    const id = req.params.id;
    const user = req.user;

    if (!id) return errorResponse(res, "OrderId is required!", 400);

    if (!user)
      return errorResponse(res, "Only Users have access to this resource", 403);

    const order = await Order.findById(id).populate("user");

    if (
      !order.user._id.equals(user._id) &&
      (user.role !== "admin" || user.role !== "driver")
    )
      return errorResponse(res, "Unauthorized", 403);

    const orderStat = {
      id: order._id,
      customer: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: order.phone,
        address: order.address,
      },
      items: order.items,
      total: order.totalPrice,
      status: order.status,
    };

    successResponse(res, { orderStat }, 200);
  } catch (error) {
    next(error);
  }
};

export const updateOrder = async (req, res, next) => {
  try {
    const id = req.params.id;
    const { status } = req.query;
    const { message, timeRemaining } = req.body;

    if (!id) return errorResponse(res, "OrderId is required!", 400);
    if (!status) return errorResponse(res, "Status field is required", 400);

    // normalize status
    const newStatus = status.toLowerCase();

    // enum validation BEFORE update
    const allowedStatuses = Order.schema.path("status").enumValues;
    if (!allowedStatuses.includes(newStatus)) {
      return errorResponse(res, "Invalid status value", 400);
    }

    const previousOrder = await Order.findById(id);
    if (!previousOrder) return errorResponse(res, "Order not found", 404);

    const order = await Order.findByIdAndUpdate(
      id,
      { $set: { status: newStatus } },
      { new: true } // return updated doc
    ).populate("user");

    if (order.status === "out-for-delivery") {
      await sendDeliveryUpdate(order.user, order, timeRemaining);
    } else if (order.status === "delivered") {
      await sendDeliveryConfirmation(order.user, order);
    } else {
      await sendOrderStatusUpdate(
        order.user,
        order,
        previousOrder.status,
        message
      );
    }

    return successResponse(
      res,
      { message: "Order updated successfully!" },
      200
    );
  } catch (error) {
    next(error);
  }
};

export const cancelOrder = async (req, res, next) => {
  try {
    const id = req.params.id;

    if (!id) return errorResponse(res, "OrderId is required!", 400);

    const orderToBeCancelled = await Order.findById(id).populate("user");

    if (!orderToBeCancelled) return errorResponse(res, "Order not found", 404);

    if (
      orderToBeCancelled.status !== "pending" ||
      orderToBeCancelled.status !== "placed"
    )
      return errorResponse(
        res,
        `Order cannot be cancelled because it is already ${orderToBeCancelled.status}`,
        409
      );

    await sendOrderCancelled(orderToBeCancelled.user, orderToBeCancelled);

    successResponse(res, { message: "Order cancelled successfully" }, 200);
  } catch (error) {
    next(error);
  }
};
