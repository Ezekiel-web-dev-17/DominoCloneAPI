import { JWT_REFRESH_EXPIRES_IN } from "../config/env.config.js";

export const successResponse = (res, payload = {}, status = 200) => {
  return res.status(status).json({
    success: true,
    ...payload,
  });
};

export const sendTokenResponse = (res, accessToken, refreshToken) => {
  res.cookie("refreshToken", refreshToken, {
    httpOnly: true, // JS can't touch it
    secure: process.env.NODE_ENV === "production", // HTTPS only in prod
    sameSite: "strict", // CSRF protection
    maxAge: JWT_REFRESH_EXPIRES_IN,
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
