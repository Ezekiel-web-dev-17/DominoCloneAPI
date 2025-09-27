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

export const validateOrder = [
  body("items").isArray().withMessage("Items must be an array"),
  body("items.*.product").isMongoId().withMessage("Invalid product ID"),
  body("items.*.quantity")
    .isInt({ min: 1 })
    .withMessage("Quantity must be positive"),
  body("address.street").notEmpty().withMessage("Street address required"),
  body("phone").isMobilePhone().withMessage("Valid phone number required"),
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

    if (error.name === "TokenExpiredError") {
      error = new Error("Token has expired. Please login again.");
      err.statusCode = 401;
    }

    if (error.name === "JsonWebTokenError") {
      error = new Error("Invalid token format or signature.");
      error.statusCode = 401;
    }

    if (error.name === "NotBeforeError") {
      error = new Error("Token not active yet.");
      error.statusCode = 401;
    }

    return errorResponse(
      res,
      error.message || "Internal server error.",
      error.statusCode || 500
    );
  } catch (error) {
    return errorResponse(res, error, 404);
  }
};
