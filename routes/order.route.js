import { Router } from "express";
import {
  orderPayment,
  createOrder,
  getOrders,
  getOrderById,
  trackOrder,
  updateOrder,
  cancelOrder,
} from "../controllers/order.controller.js";
import { isAdmin, isDriverOrAdmin } from "../middleware/auth.middleware.js";

const orderRoute = Router();

orderRoute.get("/", isAdmin, getOrders);
orderRoute.get("/:id", getOrderById);
orderRoute.post("/", createOrder);
orderRoute.post("/pay/:id", orderPayment);
orderRoute.get("/track/:id", trackOrder);
orderRoute.post("/update/:id", isDriverOrAdmin, updateOrder);
orderRoute.delete("/:id", isAdmin, cancelOrder);

export default orderRoute;
