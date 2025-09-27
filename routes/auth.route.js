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
import rateLimit from "express-rate-limit";

const authRoute = Router();

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: "Too many authentication attempts",
});

authRoute.post("/sign-up", validateSignUp, signUp);
authRoute.post("/sign-in", authLimiter, validateSignIn, signIn);
authRoute.get("/verify-email", verifyUser);
authRoute.get("/refresh-token", refreshToken);
authRoute.post("/forgot-password", forgotPassword);
authRoute.post("/reset-password", resetPassword);
authRoute.get("/logout", authMiddleware, logout);

export default authRoute;
