import logger from "../config/logger.config.js";
import { errorResponse } from "../utils/response.util.js";

export const errorMiddleware = async (req, res) => {
  try {
    logger.log("This is the Error middleware.");
  } catch (error) {
    errorResponse(res, error, 404);
  }
};
