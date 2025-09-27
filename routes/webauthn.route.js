import { Router } from "express";
import {
  authOpts,
  authVerify,
  regOpts,
  regVerify,
} from "../controllers/webauthn.controller.js";

const webAuthnRoute = Router();

webAuthnRoute.post("/registration/options", regOpts);
webAuthnRoute.post("/registration/verify", regVerify);
webAuthnRoute.post("/authentication/options", authOpts);
webAuthnRoute.post("/authentication/verify", authVerify);

export default webAuthnRoute;
