import User from "../models/user.model.js";
import { errorResponse } from "../utils/response.util.js";

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return errorResponse(res, "No token provided", 401);
    }

    const token = authHeader.split(" ")[1];
    const decoded = verifyToken(token);

    const user = await User.findById(decoded.id).select("-password");
    if (!user) {
      return errorResponse(res, "User not found", 401);
    }

    req.user = user; // attach user to request
    next();
  } catch (error) {
    errorResponse(res, "Invalid or expired token", 401);
  }
};

export default authMiddleware;
