import { Router } from "express";
import {
  authOpts,
  authVerify,
  regOpts,
  regVerify,
} from "../controllers/webauthn.controller.js";
import { authLimiter } from "./auth.route.js";

const webAuthnRoute = Router();

webAuthnRoute.post("/registration/options", regOpts);
webAuthnRoute.post("/registration/verify", regVerify);
webAuthnRoute.post("/authentication/options", authLimiter, authOpts);
webAuthnRoute.post("/authentication/verify", authLimiter, authVerify);

export default webAuthnRoute;
