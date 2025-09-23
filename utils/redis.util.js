import Redis from "ioredis";
import logger from "../config/logger.config.js";

const redis = new Redis({
  username: "default",
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT,
  password: process.env.REDIS_PASSWORD,
  tls: process.env.NODE_ENV === "production" ? {} : undefined,
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
