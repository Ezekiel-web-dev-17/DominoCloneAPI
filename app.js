import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import helmet from "helmet";
import { v2 as cloudinary } from "cloudinary";

import authRoute from "./routes/auth.route.js";
import { errorMiddleware } from "./middleware/error.middleware.js";
import {
  CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET,
  CLOUDINARY_CLOUD_NAME,
  FRONTEND_URL,
} from "./config/env.config.js";
import productRoute from "./routes/product.route.js";
import arcjetMiddleware from "./middleware/arcjet.middleware.js";
import { authMiddleware } from "./middleware/auth.middleware.js";
import orderRoute from "./routes/order.route.js";
import usersRoute from "./routes/user.routes.js";
import webAuthnRoute from "./routes/webauthn.route.js";

const app = express();

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(morgan("dev"));

// Allow only your frontend origins
const allowedOrigins = [
  FRONTEND_URL,
  "http://localhost:5173",
  "http://localhost:5174",
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"], // Restrict headers
  })
);

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", ...allowedOrigins],
        objectSrc: ["'none'"], // no Flash, Silverlight
        upgradeInsecureRequests: [], // forces HTTPS
      },
    },
    referrerPolicy: { policy: "no-referrer" },
    crossOriginEmbedderPolicy: false, // disable if you use certain CDNs
  })
);

// Configuration
cloudinary.config({
  cloud_name: CLOUDINARY_CLOUD_NAME,
  api_key: CLOUDINARY_API_KEY,
  api_secret: CLOUDINARY_API_SECRET, // Click 'View API Keys' above to copy your API secret
});

// Example REST endpoint to simulate order updates
app.post("/order/update", (req, res) => {
  const { orderId, status } = req.body;

  // Broadcast update to order room
  io.to(orderId).emit("order_status", { orderId, status });

  res.json({ success: true, message: `Order ${orderId} updated to ${status}` });
});

// Arcjet
app.use(arcjetMiddleware);

// Routes
app.use("/api/v1/auth", authRoute);
app.use("/api/v1/webauthn", webAuthnRoute);
app.use("/api/v1/products", productRoute);
app.use(authMiddleware);
app.use("/api/v1/users", usersRoute);
app.use("/api/v1/orders", orderRoute);

// Error handler
app.use(errorMiddleware);
app.use("/api/v1/health", (req, res) => res.send({ health: true }));
app.use("/", (req, res) => res.send({ message: "This is an Error Route." }));
app.use("/", (req, res) => res.send("Hello and welcome to the Dominos API."));

export default app;
