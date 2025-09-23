import { Router } from "express";
import {
  forgotPassword,
  logout,
  refreshToken,
  resetPassword,
  signIn,
  signUp,
  verifyUser,
} from "../controllers/auth.controller.js";
import {
  validateSignIn,
  validateSignUp,
} from "../middleware/error.middleware.js";
import { authMiddleware } from "../middleware/auth.middleware.js";

const authRoute = Router();

authRoute.post("/sign-up", validateSignUp, signUp);
authRoute.post("/sign-in", validateSignIn, signIn);
authRoute.get("/verify-email", verifyUser);
authRoute.get("/refresh-token", refreshToken);
authRoute.post("/forgot-password", forgotPassword);
authRoute.post("/reset-password", resetPassword);
authRoute.get("/logout", authMiddleware, logout);

export default authRoute;
