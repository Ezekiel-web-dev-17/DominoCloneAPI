import { Router } from "express";

const authRoute = Router();

authRoute.get("/", (req, res) => res.send("You are in the auth page!"));

export default authRoute;
