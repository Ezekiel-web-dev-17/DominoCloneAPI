// ==================== ENHANCED SERVER.JS ====================
import app from "./app.js";
import http from "http";
import { LIVE_URL, NODE_ENV } from "./config/env.config.js";
import logger from "./config/logger.config.js";
import { connectDB } from "./database/connectToDB.js";
import { Server } from "socket.io";
import { User } from "./models/user.model.js";
import { SocketConnectionManager } from "./utils/socketConnectionManager.js";
import { socketAuthMiddleware } from "./middleware/socketAuth.middleware.js";
import {
  handleDriverEvents,
  handleCustomerEvents,
  handleAdminEvents,
} from "./utils/socketHandlers.js";

// Create HTTP server
const server = http.createServer(app);

// Attach Socket.IO with enhanced configuration
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
    credentials: true,
  },
  transports: ["websocket", "polling"],
});

// Create connection manager instance
const connectionManager = new SocketConnectionManager();

// Socket.IO with authentication middleware
dominoIo.use(socketAuthMiddleware);

dominoIo.on("connection", (socket) => {
  const user = socket.user;

  // Add connection to manager
  connectionManager.addConnection(socket);

  // Join role-based rooms
  socket.join(`${user.role}s_room`); // customers_room, drivers_room, admins_room
  socket.join(`user_${user._id}`); // Personal room

  // Role-specific event handlers
  switch (user.role) {
    case "driver":
      handleDriverEvents(socket, dominoIo);
      socket.join("drivers_room");
      break;
    case "customer":
      handleCustomerEvents(socket, dominoIo);
      break;
    case "admin":
      handleAdminEvents(socket, dominoIo);
      socket.join("admin_room");
      break;
  }

  // Common events for all users
  socket.on("get_connection_stats", () => {
    if (user.role === "admin") {
      socket.emit("connection_stats", connectionManager.getConnectionStats());
    }
  });

  socket.on("ping", () => {
    socket.emit("pong", { timestamp: new Date() });
  });

  // Handle disconnection
  socket.on("disconnect", (reason) => {
    connectionManager.removeConnection(socket.id);

    // Role-specific disconnect handling
    if (user.role === "driver") {
      // Mark driver as offline
      User.findByIdAndUpdate(user._id, {
        isOnline: false,
        lastActiveAt: new Date(),
      }).exec();

      // Notify admins
      socket.broadcast.to("admin_room").emit("driver_disconnected", {
        driverId: user._id,
        driverName: user.name,
        reason,
        timestamp: new Date(),
      });
    }

    logger.info(`${user.role} disconnected: ${user.name} (reason: ${reason})`);
  });
});

// Make connection manager available to routes
app.set("connectionManager", connectionManager);

// Start server
server.listen(4000, async () => {
  logger.info("Connecting Server to MongoDB...");
  await connectDB();
  logger.info(`Server running on ${LIVE_URL}`);
  logger.info("Socket.IO server ready for real-time communication");
});
