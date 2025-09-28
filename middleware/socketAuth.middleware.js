import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../config/env.config.js";
import { User } from "../models/user.model.js";
import logger from "../config/logger.config.js";

export const socketAuthMiddleware = async (socket, next) => {
  try {
    // Get token from handshake auth or query
    const token = socket.handshake.auth.token || socket.handshake.query.token;

    if (!token) {
      logger.warn("Socket connection attempted without token");
      return next(new Error("Authentication token required"));
    }

    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET);

    // Get user details
    const user = await User.findById(decoded.userId).select("-password");

    if (!user) {
      logger.warn(
        `Socket connection attempted with invalid user ID: ${decoded.userId}`
      );
      return next(new Error("User not found"));
    }

    if (!user.isVerified) {
      logger.warn(`Unverified user attempted socket connection: ${user.email}`);
      return next(new Error("User account not verified"));
    }

    // Attach user to socket
    socket.user = user;
    socket.userId = user._id.toString();
    socket.userRole = user.role;

    logger.info(`Socket authenticated for user: ${user.name} (${user.role})`);
    next();
  } catch (error) {
    logger.error("Socket authentication error:", error);

    if (error.name === "TokenExpiredError") {
      return next(new Error("Token expired"));
    } else if (error.name === "JsonWebTokenError") {
      return next(new Error("Invalid token"));
    }

    return next(new Error("Authentication failed"));
  }
};
