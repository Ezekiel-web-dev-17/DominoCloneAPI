import app from "./app.js";
import http from "http";
import { LIVE_URL } from "./config/env.config.js";
import logger from "./config/logger.config.js";
import { connectDB } from "./database/connectToDB.js";
import { Server } from "socket.io";

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*", // change to your frontend URL in production
    methods: ["GET", "POST"],
  },
});

io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);

  // Example: join a room for tracking an order
  socket.on("join_order", (orderId) => {
    socket.join(orderId);
    console.log(`User ${socket.id} joined order room ${orderId}`);
  });

  // Example: handle disconnection
  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

// Start server
app.listen(4000, async () => {
  // Connect to database
  logger.info("Connecting Server to MongoDB...");
  await connectDB();
  logger.info(`Server running on ${LIVE_URL}`);
});
