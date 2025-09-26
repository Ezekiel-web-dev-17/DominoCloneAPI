import app from "./app.js";
import http from "http";
import { LIVE_URL, NODE_ENV } from "./config/env.config.js";
import logger from "./config/logger.config.js";
import { connectDB } from "./database/connectToDB.js";
import { Server } from "socket.io";

// Create HTTP server
const server = http.createServer(app);

// Attach Socket.IO
const dominoIo = new Server(server, {
  cors: {
    origin:
      NODE_ENV === "production"
        ? [
            "http://localhost:5173",
            "http://localhost:5174",
            "https://domino-clone.vercel.app",
          ]
        : "*",
    methods: ["GET", "POST", "PATCH", "DELETE"],
  },
});

// Attach dominoIo to app for controllers to use
app.set("dominoIo", dominoIo);

// Socket.IO connection
dominoIo.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  socket.on("join_order", (orderId) => {
    socket.join(orderId);
    console.log(`Client ${socket.id} joined room ${orderId}`);
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
  });
});

// Start server
server.listen(4000, async () => {
  // Connect to database
  logger.info("Connecting Server to MongoDB...");
  await connectDB();
  logger.info(`Server running on ${LIVE_URL}`);
});
