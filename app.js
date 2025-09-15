import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import helmet from "helmet";

import authRoute from "./routes/auth.route.js";
import { errorMiddleware } from "./middleware/error.middleware.js";
import { FRONTEND_DEV_URL, FRONTEND_URL } from "./config/env.config.js";

const app = express();

// Middlewares
app.use(express.json());
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
    methods: ["GET", "POST", "PUT", "DELETE"], // Only allow what’s needed
    allowedHeaders: ["Content-Type", "Authorization"], // Restrict headers
    credentials: true, // Only if you use cookies/sessions
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

// Error handler
app.use(errorMiddleware);

export default app;
