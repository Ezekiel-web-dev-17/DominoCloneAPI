import jwt from "jsonwebtoken";
import { JWT_REFRESH_EXPIRES_IN } from "../config/env.config.js";

export const generateToken = (userData, secret, expires) => {
  return jwt.sign({ ...userData }, secret, {
    expiresIn: expires,
  });
};

export const verifyToken = (token, secret) => {
  return jwt.verify(token, secret);
};

export const decodeToken = (token, secret) => {
  return jwt.decode(token, secret);
};

// Generate tokens
export const generateRefreshTokens = async (user) => {
  const payload = { userId: user._id, tokenVersion: user.tokenVersion };
  const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: "30m" });
  const refreshToken = jwt.sign(
    { ...payload, type: "refresh" },
    JWT_REFRESH_SECRET,
    { expiresIn: JWT_REFRESH_EXPIRES_IN }
  );
  const refreshTokenHash = await hashPassword(refreshToken);

  return { accessToken, refreshToken, refreshTokenHash };
};
