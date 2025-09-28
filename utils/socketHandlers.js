import { Order } from "../models/order.model.js";
import { User } from "../models/user.model.js";
import logger from "../config/logger.config.js";

export const handleDriverEvents = (socket, dominoIo) => {
  // Driver accepts order
  socket.on("driver_accept_order", async (data) => {
    try {
      const { orderId } = data;
      const driverId = socket.user._id;

      const order = await Order.findById(orderId).populate("user");
      if (!order || order.driver) {
        socket.emit("error", { message: "Order not available" });
        return;
      }

      order.driver = driverId;
      order.status = "preparing";
      await order.save();

      // Notify customer
      dominoIo.to(`user_${order.user._id}`).emit("driver_assigned", {
        orderId,
        driver: {
          id: socket.user._id,
          name: socket.user.name,
          phone: socket.user.phone,
        },
      });

      // Notify other drivers
      socket.broadcast.to("drivers_room").emit("order_taken", { orderId });

      socket.emit("order_accepted", { orderId, orderCode: order.orderCode });
    } catch (error) {
      logger.error("Driver accept order error:", error);
      socket.emit("error", { message: "Failed to accept order" });
    }
  });

  // Driver updates status
  socket.on("driver_update_status", async (data) => {
    try {
      const { isOnline, location } = data;

      await User.findByIdAndUpdate(socket.user._id, {
        isOnline,
        location,
        lastActiveAt: new Date(),
      });

      // Notify admins
      dominoIo.to("admin_room").emit("driver_status_update", {
        driverId: socket.user._id,
        driverName: socket.user.name,
        isOnline,
        location,
      });

      socket.emit("status_updated", { isOnline });
    } catch (error) {
      logger.error("Driver status update error:", error);
      socket.emit("error", { message: "Failed to update status" });
    }
  });

  // Driver shares live location
  socket.on("driver_share_location", async (data) => {
    try {
      const { orderId, latitude, longitude, speed, heading } = data;

      const order = await Order.findById(orderId);
      if (!order || !order.driver.equals(socket.user._id)) {
        socket.emit("error", { message: "Unauthorized" });
        return;
      }

      const locationData = {
        orderId,
        driverId: socket.user._id,
        driverName: socket.user.name,
        location: { latitude, longitude, speed, heading },
        timestamp: new Date(),
      };

      // Send to customer
      dominoIo
        .to(`user_${order.user}`)
        .emit("driver_location_update", locationData);

      // Send to admins
      dominoIo.to("admin_room").emit("driver_location_update", locationData);
    } catch (error) {
      logger.error("Driver location share error:", error);
      socket.emit("error", { message: "Failed to share location" });
    }
  });

  // Driver reports issue
  socket.on("driver_report_issue", async (data) => {
    try {
      const { orderId, issue, severity = "medium" } = data;

      const issueReport = {
        driverId: socket.user._id,
        driverName: socket.user.name,
        orderId,
        issue,
        severity,
        location: data.location,
        timestamp: new Date(),
      };

      // Notify admins immediately
      dominoIo.to("admin_room").emit("driver_issue_reported", issueReport);

      // If it's a high severity issue, also notify the customer
      if (severity === "high" && orderId) {
        const order = await Order.findById(orderId);
        if (order) {
          dominoIo.to(`user_${order.user}`).emit("delivery_issue", {
            orderId,
            message:
              "There's an issue with your delivery. Our support team has been notified.",
            timestamp: new Date(),
          });
        }
      }

      socket.emit("issue_reported", { success: true });
      logger.warn(`Driver issue reported: ${issue}`, issueReport);
    } catch (error) {
      logger.error("Driver report issue error:", error);
      socket.emit("error", { message: "Failed to report issue" });
    }
  });
};

export const handleCustomerEvents = (socket, dominoIo) => {
  // Customer joins order tracking
  socket.on("track_order", async (data) => {
    try {
      const { orderId } = data;

      const order = await Order.findById(orderId).populate(
        "driver",
        "name phone"
      );
      if (!order || !order.user.equals(socket.user._id)) {
        socket.emit("error", { message: "Order not found or unauthorized" });
        return;
      }

      socket.join(`order_${orderId}`);

      socket.emit("order_tracking_joined", {
        orderId,
        currentStatus: order.status,
        driver: order.driver
          ? {
              name: order.driver.name,
              phone: order.driver.phone,
            }
          : null,
        lastUpdate: order.updatedAt,
      });
    } catch (error) {
      logger.error("Track order error:", error);
      socket.emit("error", { message: "Failed to join order tracking" });
    }
  });

  // Customer sends message to driver
  socket.on("message_to_driver", async (data) => {
    try {
      const { orderId, message } = data;

      const order = await Order.findById(orderId);
      if (!order || !order.user.equals(socket.user._id)) {
        socket.emit("error", { message: "Unauthorized" });
        return;
      }

      if (!order.driver) {
        socket.emit("error", { message: "No driver assigned yet" });
        return;
      }

      const messageData = {
        from: {
          id: socket.user._id,
          name: socket.user.name,
          role: "customer",
        },
        orderId,
        message,
        timestamp: new Date(),
      };

      // Send to driver
      dominoIo
        .to(`driver_${order.driver}`)
        .emit("customer_message", messageData);

      // Confirm to customer
      socket.emit("message_sent", {
        success: true,
        timestamp: messageData.timestamp,
      });
    } catch (error) {
      logger.error("Customer message error:", error);
      socket.emit("error", { message: "Failed to send message" });
    }
  });

  // Customer rates order
  socket.on("rate_order", async (data) => {
    try {
      const { orderId, rating, review } = data;

      const order = await Order.findById(orderId).populate("driver");
      if (!order || !order.user.equals(socket.user._id)) {
        socket.emit("error", { message: "Unauthorized" });
        return;
      }

      if (order.status !== "delivered") {
        socket.emit("error", { message: "Can only rate completed orders" });
        return;
      }

      order.rating = rating;
      order.review = review;
      await order.save();

      // Notify driver about rating
      if (order.driver) {
        dominoIo.to(`driver_${order.driver._id}`).emit("order_rated", {
          orderId,
          rating,
          review,
          customerName: socket.user.name,
        });
      }

      // Notify admins
      dominoIo.to("admin_room").emit("order_rated", {
        orderId,
        rating,
        review,
        customerName: socket.user.name,
        driverName: order.driver?.name,
      });

      socket.emit("rating_submitted", { success: true });
    } catch (error) {
      logger.error("Rate order error:", error);
      socket.emit("error", { message: "Failed to submit rating" });
    }
  });
};

export const handleAdminEvents = (socket, dominoIo) => {
  // Admin assigns driver to order
  socket.on("admin_assign_driver", async (data) => {
    try {
      const { orderId, driverId } = data;

      const [order, driver] = await Promise.all([
        Order.findById(orderId).populate("user"),
        User.findById(driverId),
      ]);

      if (!order || !driver || driver.role !== "driver") {
        socket.emit("error", { message: "Invalid order or driver" });
        return;
      }

      if (order.driver) {
        socket.emit("error", {
          message: "Order already has a driver assigned",
        });
        return;
      }

      order.driver = driverId;
      order.status = "assigned";
      await order.save();

      // Notify customer
      dominoIo.to(`user_${order.user._id}`).emit("driver_assigned", {
        orderId,
        driver: {
          id: driver._id,
          name: driver.name,
          phone: driver.phone,
        },
      });

      // Notify driver
      dominoIo.to(`driver_${driverId}`).emit("order_assigned", {
        orderId,
        orderCode: order.orderCode,
        customer: {
          name: order.user.name,
          address: order.address,
          phone: order.phone,
        },
        items: order.items,
        total: order.totalPrice,
      });

      socket.emit("assignment_successful", { orderId, driverId });
    } catch (error) {
      logger.error("Admin assign driver error:", error);
      socket.emit("error", { message: "Failed to assign driver" });
    }
  });

  // Admin broadcasts message to all drivers
  socket.on("admin_broadcast_to_drivers", async (data) => {
    try {
      const { message, priority = "normal" } = data;

      const broadcastData = {
        from: {
          id: socket.user._id,
          name: socket.user.name,
          role: "admin",
        },
        message,
        priority,
        timestamp: new Date(),
      };

      dominoIo.to("drivers_room").emit("admin_broadcast", broadcastData);

      socket.emit("broadcast_sent", { success: true });
      logger.info(`Admin broadcast sent: ${message}`);
    } catch (error) {
      logger.error("Admin broadcast error:", error);
      socket.emit("error", { message: "Failed to send broadcast" });
    }
  });

  // Admin gets real-time statistics
  socket.on("admin_get_stats", async (data) => {
    try {
      const stats = await getDashboardStats();
      socket.emit("dashboard_stats", stats);
    } catch (error) {
      logger.error("Admin get stats error:", error);
      socket.emit("error", { message: "Failed to get statistics" });
    }
  });

  // Admin resolves driver emergency
  socket.on("admin_resolve_emergency", async (data) => {
    try {
      const { emergencyId, resolution, notifyDriver = true } = data;

      // In a real app, you'd store emergencies in database
      // For now, just notify the driver that help is on the way

      if (notifyDriver && data.driverId) {
        dominoIo.to(`driver_${data.driverId}`).emit("emergency_response", {
          resolution,
          respondedBy: socket.user.name,
          timestamp: new Date(),
        });
      }

      // Notify other admins
      socket.broadcast.to("admin_room").emit("emergency_resolved", {
        emergencyId,
        resolution,
        resolvedBy: socket.user.name,
        timestamp: new Date(),
      });

      socket.emit("emergency_resolved", { success: true });
    } catch (error) {
      logger.error("Admin resolve emergency error:", error);
      socket.emit("error", { message: "Failed to resolve emergency" });
    }
  });
};

// Helper function for dashboard statistics
const getDashboardStats = async () => {
  const now = new Date();
  const startOfDay = new Date(now.setHours(0, 0, 0, 0));

  const [
    totalOrders,
    activeOrders,
    completedToday,
    pendingOrders,
    onlineDrivers,
    totalRevenue,
    todaysRevenue,
  ] = await Promise.all([
    Order.countDocuments(),
    Order.countDocuments({
      status: { $in: ["placed", "preparing", "out-for-delivery"] },
    }),
    Order.countDocuments({
      status: "delivered",
      deliveredAt: { $gte: startOfDay },
    }),
    Order.countDocuments({ status: "pending" }),
    User.countDocuments({ role: "driver", isOnline: true }),
    Order.aggregate([
      { $match: { status: "delivered" } },
      { $group: { _id: null, total: { $sum: "$totalPrice" } } },
    ]),
    Order.aggregate([
      {
        $match: {
          status: "delivered",
          deliveredAt: { $gte: startOfDay },
        },
      },
      { $group: { _id: null, total: { $sum: "$totalPrice" } } },
    ]),
  ]);

  return {
    totalOrders,
    activeOrders,
    completedToday,
    pendingOrders,
    onlineDrivers,
    totalRevenue: totalRevenue[0]?.total || 0,
    todaysRevenue: todaysRevenue[0]?.total || 0,
    lastUpdated: new Date(),
  };
};
