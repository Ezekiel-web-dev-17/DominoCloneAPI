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

// ================== NEW DRIVER-SPECIFIC METHODS ==================

export const updateDriverStatus = async (req, res, next) => {
  try {
    if (req.user.role !== "driver") {
      return errorResponse(res, "Only drivers can update their status", 403);
    }

    const { isOnline, location } = req.body;

    const driver = await User.findByIdAndUpdate(
      req.user._id,
      {
        isOnline: isOnline !== undefined ? isOnline : req.user.isOnline,
        location: location || req.user.location,
        lastActiveAt: new Date(),
      },
      { new: true }
    ).select("-password");

    if (!driver) return errorResponse(res, "Driver not found", 404);

    // Get Socket.IO instance
    const dominoIo = req.app?.get("dominoIo");

    if (dominoIo) {
      // Notify admins about driver status change
      dominoIo.to("admin_room").emit("driver_status_changed", {
        driverId: driver._id,
        driverName: driver.name,
        isOnline: driver.isOnline,
        location: driver.location,
        timestamp: new Date(),
      });

      // If going offline, notify customers with active orders
      if (!driver.isOnline) {
        const activeOrders = await Order.find({
          driver: driver._id,
          status: { $in: ["preparing", "out-for-delivery"] },
        }).populate("user", "_id");

        activeOrders.forEach((order) => {
          dominoIo.to(`user_${order.user._id}`).emit("driver_went_offline", {
            orderId: order._id,
            message:
              "Your driver has gone offline. Our support team has been notified.",
            timestamp: new Date(),
          });
        });
      }
    }

    successResponse(res, {
      message: `Driver status updated to ${
        driver.isOnline ? "online" : "offline"
      }`,
      driver: {
        id: driver._id,
        name: driver.name,
        isOnline: driver.isOnline,
        location: driver.location,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getDriverProfile = async (req, res, next) => {
  try {
    if (req.user.role !== "driver") {
      return errorResponse(res, "Only drivers can access driver profile", 403);
    }

    const driver = await User.findById(req.user._id).select("-password").lean();

    // Get driver statistics
    const [totalDeliveries, todayDeliveries, avgRating] = await Promise.all([
      Order.countDocuments({ driver: req.user._id, status: "delivered" }),
      Order.countDocuments({
        driver: req.user._id,
        status: "delivered",
        deliveredAt: {
          $gte: new Date(new Date().setHours(0, 0, 0, 0)),
        },
      }),
      Order.aggregate([
        {
          $match: {
            driver: req.user._id,
            status: "delivered",
            rating: { $exists: true },
          },
        },
        { $group: { _id: null, avgRating: { $avg: "$rating" } } },
      ]),
    ]);

    const driverProfile = {
      ...driver,
      stats: {
        totalDeliveries,
        todayDeliveries,
        avgRating: avgRating[0]?.avgRating || 0,
      },
    };

    successResponse(res, { driver: driverProfile });
  } catch (error) {
    next(error);
  }
};

export const updateDriverProfile = async (req, res, next) => {
  try {
    if (req.user.role !== "driver") {
      return errorResponse(res, "Only drivers can update driver profile", 403);
    }

    const { phone, vehicleType, vehicleNumber, preferredAreas } = req.body;

    const updateData = {};
    if (phone) updateData.phone = phone;
    if (vehicleType) updateData.vehicleType = vehicleType;
    if (vehicleNumber) updateData.vehicleNumber = vehicleNumber;
    if (preferredAreas) updateData.preferredAreas = preferredAreas;

    const driver = await User.findByIdAndUpdate(req.user._id, updateData, {
      new: true,
      runValidators: true,
    }).select("-password");

    if (!driver) return errorResponse(res, "Driver not found", 404);

    successResponse(res, {
      message: "Driver profile updated successfully",
      driver,
    });
  } catch (error) {
    next(error);
  }
};
