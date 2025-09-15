import { config } from "dotenv";

config({ path: `.env.${process.env.NODE_ENV || "development"}.local` });

export const {
  PORT,
  MONGODB_URI,
  NODE_ENV,
  FRONTEND_URL,
  FRONTEND_DEV_URL,
  JWT_SECRET,
  JWT_EXPIRES_IN,
  PAYMENT_KEY,
  EMAIL_USER,
  EMAIL_PASS,
} = process.env;
