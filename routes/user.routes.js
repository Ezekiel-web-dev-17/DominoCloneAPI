import { Router } from "express";
import { isAdmin } from "../middleware/auth.middleware.js";
import { getUser, getUsers } from "../controllers/user.controller.js";

const usersRoute = Router();

usersRoute.get("/", isAdmin, getUsers);
usersRoute.get("/:id", getUser);

export default usersRoute;
