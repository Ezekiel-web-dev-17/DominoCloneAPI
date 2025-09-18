import logger from "../config/logger.config.js";
import { User } from "../models/user.model.js";
import { errorResponse, successResponse } from "../utils/response.util.js";

export const getUsers = async (req, res, next) => {
  try {
    const users = await User.find({});
    if (!users) return errorResponse(res, "No User Found Yet", 404);
    successResponse(res, { users });
  } catch (error) {
    next(error);
  }
};

export const getUser = async (req, res, next) => {
  try {
    const authViewers = req.user;
    if (!authViewers) return errorResponse(res, "Unauthorized", 401);
    const user = await User.findById(req.params.id).select("-password");
    if (!user) return errorResponse(res, "User not found", 404);

    if (
      !user._id.equals(authViewers._id) &&
      (authViewers.role !== "admin" || authViewers.role !== "driver")
    )
      return errorResponse(
        res,
        "Unauthorized. This resource is only accessible to the User, the driver and the admins.",
        401
      );
    successResponse(res, { user });
  } catch (error) {
    next(error);
  }
};
