import { body, validationResult } from "express-validator";
import logger from "../config/logger.config.js";
import { errorResponse } from "../utils/response.util.js";

export const validateSignUp = [
  body("name")
    .trim()
    .isLength({ min: 2, max: 30 })
    .withMessage("Name must be between 2-30 characters"),
  body("email")
    .isEmail()
    .normalizeEmail()
    .withMessage("Please provide a valid email"),
  body("password")
    .isLength({ min: 8, max: 128 })
    .withMessage("Password must be between 8-128 characters"),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return errorResponse(res, "Validation failed", 400);

    next();
  },
];

export const validateSignIn = [
  body("email")
    .isEmail()
    .normalizeEmail()
    .withMessage("Please provide a valid email"),
  body("password")
    .isLength({ min: 8, max: 128 })
    .withMessage("Password must be between 8-128 characters"),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return errorResponse(res, "Validation failed", 400);

    next();
  },
];

export const errorMiddleware = async (err, req, res, next) => {
  try {
    let error = { ...err };

    error.message = err.message;

    logger.error(err);
    // Mongoose bad objectId
    if (err.name === "CastError") {
      const message = "Resource not found";
      error = new Error(message);
      error.statusCode = 404;
    }

    // Mongoose duplicate key
    if (err.code === 11000) {
      const message = "Duplicate field value entered";
      error = new Error(message);
      err.statusCode = 400;
    }

    // Mongoose Validation Error
    if (err.name === "ValidationError") {
      const message = Object.values(err.errors).map((val) => val.message);
      error = new Error(message.join(", "));
      error.statusCode = 400;
    }
    return errorResponse(
      res,
      error.message || "Internal server error.",
      error.statusCode || 500
    );
  } catch (error) {
    errorResponse(res, error, 404);
  }
};
