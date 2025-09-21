import { Router } from "express";
import { isAdmin } from "../middleware/auth.middleware.js";
import {
  deleteUser,
  getUser,
  getUsers,
  updateUser,
} from "../controllers/user.controller.js";

const usersRoute = Router();

usersRoute.get("/", isAdmin, getUsers);
usersRoute.get("/:id", getUser);
usersRoute.patch("/:id", updateUser);
usersRoute.delete("/:id", deleteUser);

export default usersRoute;
