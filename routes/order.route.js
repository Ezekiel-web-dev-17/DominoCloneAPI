// ==================== ENHANCED ORDER ROUTES ====================
// routes/order.route.js

import { Router } from "express";
import {
  orderPayment,
  createOrder,
  getOrders,
  getOrderById,
  trackOrder,
  updateOrder,
  cancelOrder,
  assignDriver,
  getDriverOrders,
  acceptOrder,
  updateDriverLocation,
  getDashboardData,
  getOrderAnalytics,
} from "../controllers/order.controller.js";
import {
  isAdmin,
  isDriverOrAdmin,
  authMiddleware,
} from "../middleware/auth.middleware.js";

const orderRoute = Router();

// ================== ADMIN ROUTES ==================
orderRoute.get("/", isAdmin, getOrders);
orderRoute.get("/dashboard", isAdmin, getDashboardData);
orderRoute.post("/:orderId/assign-driver", isAdmin, assignDriver);

// ================== CUSTOMER ROUTES ==================
orderRoute.post("/", createOrder); // Create order
orderRoute.post("/pay/:id", orderPayment); // Complete payment
orderRoute.get("/:id", getOrderById); // Get specific order
orderRoute.get("/track/:id", trackOrder); // Track order

// ================== DRIVER ROUTES ==================
orderRoute.get("/driver/my-orders", getDriverOrders); // Get driver's orders
orderRoute.post("/:orderId/accept", acceptOrder); // Accept order assignment
orderRoute.patch("/:orderId/location", updateDriverLocation); // Update driver location

// ================== SHARED ROUTES (DRIVER/ADMIN) ==================
orderRoute.patch("/update/:id", isDriverOrAdmin, updateOrder); // Update order status
orderRoute.delete("/:id", isAdmin, cancelOrder); // Cancel order
orderRoute.delete("/analytics", isAdmin, getOrderAnalytics); // Order analytics

export default orderRoute;
