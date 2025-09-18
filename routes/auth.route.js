import { Router } from "express";
import { signIn, signUp } from "../controllers/auth.controller.js";
import {
  validateSignIn,
  validateSignUp,
} from "../middleware/error.middleware.js";

const authRoute = Router();

authRoute.post("/sign-up", validateSignUp, signUp);
authRoute.post("/sign-in", validateSignIn, signIn);

export default authRoute;
