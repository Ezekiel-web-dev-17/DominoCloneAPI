import { JWT_REFRESH_EXPIRES_IN, NODE_ENV } from "../config/env.config.js";

export const successResponse = (res, payload = {}, status = 200) => {
  return res.status(status).json({
    success: true,
    ...payload,
  });
};

export const sendTokenResponse = (res, accessToken, refreshToken) => {
  // Short session cookie
  res.cookie("session", accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production", // HTTPS only in prod
    sameSite: "strict", // CSRF protection
    maxAge: NODE_ENV === "production" ? 60 * 60 * 1000 : 5 * 1000, // 1 hour
  });

  // Long "remember me" cookie
  res.cookie("rememberMe", refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production", // HTTPS only in prod
    sameSite: "strict", // CSRF protection
    maxAge: NODE_ENV === "production" ? 30 * 24 * 60 * 60 * 1000 : 15 * 1000, // 30 hour
  });

  return res.json({
    success: true,
    accessToken, // still send accessToken in body
  });
};

export const errorResponse = (res, error, status = 500) => {
  if (typeof error === "string") {
    return res.status(status).json({
      success: false,
      message: error || "Server Error",
    });
  }

  return res.status(status).json({
    success: false,
    message: error.message || "Server Error",
  });
};
