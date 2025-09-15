import app from "./app.js";
import logger from "./config/logger.config.js";
import { connectDB } from "./database/connectToDB.js";
import { PORT } from "./config/env.config.js";

// Start server
app.listen(PORT, () => {
  // Connect to database
  logger.info("Connecting Server to MongoDB...");
  connectDB();
  logger.info(`🚀 Server running on http://localhost:${PORT}`);
});
