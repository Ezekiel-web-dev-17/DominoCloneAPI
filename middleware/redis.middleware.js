import logger from "../config/logger.config.js";
import redis from "../utils/redis.util.js";
import { successResponse } from "../utils/response.util.js";

export const cache = (keyPrefix, ttl = 3600) => {
  return async (req, res, next) => {
    // Add user role to cache key for personalized responses
    const userRole = req.user?.role || "guest";
    const key = `${keyPrefix}:${userRole}:${JSON.stringify(req.query)}`;

    try {
      const cacheData = await redis.get(key);
      if (cacheData) {
        return successResponse(res, JSON.parse(cacheData));
      }

      const originalJson = res.json.bind(res);
      res.json = (data) => {
        redis.setex(key, ttl, JSON.stringify(data));
        return originalJson(data);
      };

      next();
    } catch (err) {
      logger.error("Cache middleware error:", err);
      next();
    }
  };
};
