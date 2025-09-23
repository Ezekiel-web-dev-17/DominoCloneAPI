import logger from "../config/logger.config.js";
import redis from "../utils/redis.util.js";
import { successResponse } from "../utils/response.util.js";

export const cache = (keyPrefix) => {
  return async (req, res, next) => {
    const key = keyPrefix + JSON.stringify(req.query || req.params);

    try {
      const cacheData = await redis.get(key);

      if (cacheData) {
        logger.info("⚡ Cache hit:", key);
        return successResponse(res, JSON.parse(cacheData));
      }

      // Overwrite res.json to store in cache
      const originalJson = res.json.bind(res);
      res.json = (data) => {
        redis.setex(key, 60 * 60, JSON.stringify(data)); // cache 5 mins
        return originalJson(data);
      };

      next();
    } catch (err) {
      logger.error("Cache middleware error:", err);
      next();
    }
  };
};
