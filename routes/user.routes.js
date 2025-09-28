// ==================== ENHANCED USER ROUTES ====================
// routes/user.routes.js

import { Router } from "express";
import { isAdmin } from "../middleware/auth.middleware.js";
import {
  deleteUser,
  getUser,
  getUsers,
  updateUser,
  updateDriverStatus,
  getDriverProfile,
  updateDriverProfile,
} from "../controllers/user.controller.js";
import { cache } from "../middleware/redis.middleware.js";

const usersRoute = Router();

// ================== ADMIN ROUTES ==================
usersRoute.get("/", isAdmin, cache("get users: "), getUsers);
usersRoute.delete("/:id", isAdmin, deleteUser);

// ================== USER ROUTES ==================
usersRoute.get("/:id", getUser);
usersRoute.patch("/:id", updateUser);

// ================== DRIVER SPECIFIC ROUTES ==================
usersRoute.get("/driver/profile", getDriverProfile);
usersRoute.patch("/driver/profile", updateDriverProfile);
usersRoute.patch("/driver/status", updateDriverStatus); // Online/Offline status

export default usersRoute;
