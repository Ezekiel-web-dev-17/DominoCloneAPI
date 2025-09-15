import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import helmet from "helmet";

import authRoute from "./routes/auth.route.js";
import { errorMiddleware } from "./middleware/error.middleware.js";
import { FRONTEND_DEV_URL, FRONTEND_URL } from "./config/env.config.js";
import productRoute from "./routes/product.route.js";

const app = express();

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(morgan("dev"));

// Allow only your frontend origins
const allowedOrigins = [FRONTEND_URL, FRONTEND_DEV_URL];

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
        scriptSrc: ["'self'", "https://trustedscripts.example.com"],
        objectSrc: ["'none'"], // no Flash, Silverlight
        upgradeInsecureRequests: [], // forces HTTPS
      },
    },
    referrerPolicy: { policy: "no-referrer" },
    crossOriginEmbedderPolicy: false, // disable if you use certain CDNs
  })
);

// Routes
app.use("/api/v1/auth", authRoute);
app.use("/api/v1/product", productRoute);

// Error handler
app.use(errorMiddleware);

export default app;
