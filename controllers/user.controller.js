import { User } from "../models/user.model.js";
import { hashPassword } from "../utils/helpers.util.js";
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

export const updateUser = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    if (!name && !email && !password)
      return errorResponse(
        res,
        "At least one of the fields must be provided.",
        400
      );

    if (req.params.id !== req.user._id.toString())
      return errorResponse(res, "You can only update your own profile.", 403);

    if (password.length < 8)
      return errorResponse(res, "Password must be at least 8 characters.", 401);

    const updateData = {
      ...(name && { name }),
      ...(email && { email }),
    };

    if (password) {
      updateData[password] = hashPassword(password);
    }

    const editedUser = await User.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true,
    }).select("-password");

    if (!editedUser) return errorResponse(res, "User not found!", 404);

    successResponse(res, { user: editedUser });
  } catch (error) {
    next(error);
  }
};

export const deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id);

    if (!user) return errorResponse(res, "User not found!", 404);

    await User.findByIdAndDelete(id);

    successResponse(res, { message: "User deleted successfully." });
  } catch (error) {
    next(error);
  }
};
