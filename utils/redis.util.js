import Redis from "ioredis";
import logger from "../config/logger.config.js";
import {
  REDIS_HOST,
  REDIS_PASSWORD,
  REDIS_PORT,
  REDIS_USERNAME,
} from "../config/env.config.js";

const redis = new Redis({
  username: REDIS_USERNAME,
  host: REDIS_HOST,
  port: Number(REDIS_PORT),
  password: REDIS_PASSWORD,
});

redis.on("connect", () => {
  logger.info("Redis connected");
});

redis.on("ready", () => console.log("Redis ready"));
redis.on("close", () => console.log("Redis closed"));

redis.on("error", (err) => {
  logger.error("Redis error:", err);
});

export default redis;
