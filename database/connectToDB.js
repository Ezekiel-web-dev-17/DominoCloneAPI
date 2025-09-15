import { connect } from "mongoose";
import { MONGODB_URI, NODE_ENV } from "../config/env.config.js";
import logger from "../config/logger.config.js";

export const connectDB = async () => {
  try {
    if (!MONGODB_URI) {
      throw new Error(
        `MONGODB_URI variable is not found in .env.${NODE_ENV}.local`
      );
    }

    await connect(MONGODB_URI);
  } catch (error) {
    logger.error("Error connecting to mongoDB: ", error);
    process.exit(1); // stop the server if DB fails
  }
};
