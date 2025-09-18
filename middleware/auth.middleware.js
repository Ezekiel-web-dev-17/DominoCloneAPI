import jwt from "jsonwebtoken";
import { User } from "../models/user.model.js";
import { errorResponse } from "../utils/response.util.js";
import { JWT_SECRET } from "../config/env.config.js";

export const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return errorResponse(res, "No token provided", 401);
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    const user = await User.findById(decoded.userId).select("-password");
    if (!user) {
      return errorResponse(res, "User not found", 401);
    }

    req.user = user; // attach user to request
    next();
  } catch (error) {
    errorResponse(res, "Invalid or expired token", 401);
  }
};

export const isAdmin = async (req, res, next) => {
  try {
    const user = req.user;

    // 4️⃣ Check if user is admin
    if (user.role !== "admin") {
      return res
        .status(403)
        .json({ success: false, message: "Forbidden: Admins only" });
    }

    next();
  } catch (error) {
    next(error);
  }
};

export const isDriverOrAdmin = async (req, res, next) => {
  try {
    const user = req.user;

    // 4️⃣ Check if user is admin
    if (user.role !== "driver" && user.role !== "admin") {
      return errorResponse(res, "Forbidden: Admins and Drivers only", 403);
    }

    next();
  } catch (error) {
    next(error);
  }
};
