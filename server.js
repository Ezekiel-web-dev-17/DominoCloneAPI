import app from "./app.js";
import { LIVE_URL } from "./config/env.config.js";
import logger from "./config/logger.config.js";
import { connectDB } from "./database/connectToDB.js";

// Start server
app.listen(4000, async () => {
  // Connect to database
  logger.info("Connecting Server to MongoDB...");
  await connectDB();
  logger.info(`🚀 Server running on ${LIVE_URL}`);
});
