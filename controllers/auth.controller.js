import jwt from "jsonwebtoken";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { startSession } from "mongoose";
import { comparePassword, hashPassword } from "../utils/helpers.util.js";
import { generateRefreshTokens, generateToken } from "../utils/jwt.utils.js";
import { User, verifyEmail } from "../models/user.model.js";
import {
  errorResponse,
  sendTokenResponse,
  successResponse,
} from "../utils/response.util.js";

import {
  sendAccountVerification,
  sendPasswordReset,
  sendWelcomeEmail,
} from "../services/email.service.js";

import {
  JWT_EXPIRES_IN,
  JWT_REFRESH_SECRET,
  JWT_SECRET,
  NODE_ENV,
} from "../config/env.config.js";

export const signUp = async (req, res, next) => {
  const session = await startSession();
  session.startTransaction();
  try {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password)
      return errorResponse(
        res,
        "Name, email, and password fields are required!",
        400
      );

    const existingUser = await User.findOne({ email });

    // if it finds a user with the inputed email returns an error "User already exists".
    if (existingUser && existingUser.isVerified)
      return errorResponse(res, "User already exists", 409);

    const hashedPass = await hashPassword(password);

    const user = new User({
      name,
      email,
      password: hashedPass,
      role,
      refreshTokens: [],
    });

    await user.save({ session });

    // Saves new user data by putting into Jwt using the user's Id.
    const token = generateToken(
      { userId: user._id },
      JWT_SECRET,
      JWT_EXPIRES_IN
    );

    const hashed = crypto.createHash("sha256").update(token).digest("hex");
    const now = new Date();
    const expAt = new Date(now.getTime() + 15 * 60 * 1000);

    await verifyEmail.create({
      userId: user._id,
      hashedToken: hashed,
      expiresAt: expAt,
    });

    await sendAccountVerification(user, token, JWT_EXPIRES_IN);

    await session.commitTransaction(); // sends data to database
    session.endSession();
    // response after transactions end.

    const data = { user };

    if (NODE_ENV !== "production") {
      data.token = token;
    }

    successResponse(
      res,
      {
        message: "User created successfully.",
        data,
      },
      201
    );
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    next(err);
  }
};

export const signIn = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password)
      return errorResponse(
        res,
        "User email and password must be provided!",
        400
      );

    const user = await User.findOne({ email });

    if (!user) return errorResponse(res, "User not found", 404);
    if (!user.isVerified)
      return errorResponse(res, "User is not verified.", 403);

    const isValidPassword = await comparePassword(password, user.password);

    if (!isValidPassword) return errorResponse(res, "Invalid password", 401);

    const { accessToken, refreshToken, refreshTokenHash } =
      await generateRefreshTokens(user);

    // Store hashed refresh token (with createdAt for good measure)
    user.refreshTokens.push({
      tokenHash: refreshTokenHash,
      createdAt: new Date(),
    });

    if (user.refreshTokens.length > 5) {
      user.refreshTokens.slice(-5);
    }

    await user.save();

    sendTokenResponse(res, accessToken, refreshToken);
  } catch (error) {
    next(error);
  }
};

export const verifyUser = async (req, res, next) => {
  try {
    const { token, userId } = req.query;

    if (!token || !userId)
      return errorResponse(res, "Token and userId are required.", 400);

    // 1) hash the token from the request
    const hashed = crypto.createHash("sha256").update(token).digest("hex");

    // 2) find a matching record in the DB
    const record = await verifyEmail.findOne({
      userId,
      hashedToken: hashed,
      expiresAt: { $gt: new Date() }, // check if not expired
    });

    if (!record) return errorResponse(res, "Invalid or expired token.", 400);

    // 3) mark user's email as verified
    const user = await User.findByIdAndUpdate(userId, {
      isVerified: true,
    });

    // 4) delete the verification record
    await verifyEmail.findByIdAndDelete(record._id);

    await sendWelcomeEmail(user);

    successResponse(res, {
      message: "Email verified successfully.",
    });
  } catch (error) {
    next(error);
  }
};

export const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) return errorResponse(res, "User Email is required!", 400);

    const user = await User.findOne({ email });

    if (!user) return errorResponse(res, "User not found!", 404);

    const token = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
    await verifyEmail.deleteMany({ userId: user._id });
    await verifyEmail.create({
      userId: user._id,
      hashedToken,
      expiresAt,
    });

    await sendPasswordReset(user, token);
    successResponse(res, {
      message: "Password reset email sent.",
    });
  } catch (error) {
    next(error);
  }
};

export const resetPassword = async (req, res, next) => {
  try {
    const { newPassword } = req.body;
    const { token, userId } = req.query;

    if (!newPassword)
      return errorResponse(res, "New password is required!", 400);

    if (!token || !userId)
      return errorResponse(res, "Invalid email verification URL", 400);

    const user = await User.findById(userId);

    if (!user) return errorResponse(res, "User not found!", 404);

    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    const verifyToken = await verifyEmail.findOne({ hashedToken });

    if (!verifyToken || verifyToken.expiresAt < new Date())
      return errorResponse(res, "This token is expired or invalid.", 400);

    await verifyEmail.deleteMany({ userId });

    const pass = await hashPassword(newPassword);

    await User.findByIdAndUpdate(userId, {
      password: pass,
    });

    successResponse(res, {
      message:
        "Password reset successful. You can now log in with your new password.",
    });
  } catch (error) {
    next(error);
  }
};

export const refreshToken = async (req, res, next) => {
  try {
    const token = req.cookies.refreshToken; // 👈 from cookie
    if (!token) return errorResponse(res, "No refresh token provided.", 400);

    const decoded = jwt.verify(token, JWT_REFRESH_SECRET);
    const { userId, type, exp } = decoded;

    if (type !== "refresh" || !userId || exp < Math.floor(Date.now() / 1000)) {
      return errorResponse(res, "Invalid or expired refresh token.", 401);
    }

    const user = await User.findById(userId);
    if (!user) return errorResponse(res, "User not found!", 404);

    // Compare against stored hashes
    let matchIndex = -1;
    for (let i = 0; i < user.refreshTokens.length; i++) {
      if (await bcrypt.compare(token, user.refreshTokens[i].tokenHash)) {
        matchIndex = i;
        break;
      }
    }
    if (matchIndex === -1) {
      return errorResponse(res, "Refresh token not recognized", 401);
    }

    // Rotate token
    user.refreshTokens.splice(matchIndex, 1);
    const {
      accessToken,
      refreshToken: newRefreshToken,
      refreshTokenHash,
    } = await generateRefreshTokens(user);

    user.refreshTokens.push({
      tokenHash: refreshTokenHash,
      createdAt: new Date(),
    });
    if (user.refreshTokens.length > 5) {
      user.refreshTokens = user.refreshTokens.slice(-5);
    }
    await user.save();

    sendTokenResponse(res, accessToken, newRefreshToken);
  } catch (error) {
    next(error);
  }
};

export const logout = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return errorResponse(res, "User not found", 404);

    if (!user.isVerified)
      return errorResponse(res, "User is not verified.", 400);

    if (!user.refreshTokens.length)
      return errorResponse(
        res,
        "You are currently logged out from all your devices.",
        400
      );

    user.refreshTokens = [];

    // Increment tokenVersion to invalidate all old access tokens
    user.tokenVersion += 1;
    await user.save();

    res.clearCookie("session", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    });

    res.clearCookie("rememberMe", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    });

    successResponse(res, {
      message: "Logged out successfully. Access revoked.",
    });
  } catch (error) {
    next(error);
  }
};
