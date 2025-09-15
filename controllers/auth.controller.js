import { startSession } from "mongoose";
import { errorResponse, successResponse } from "../utils/response.util.js";
import { comparePassword, hashPassword } from "../utils/helpers.util.js";
import { generateToken } from "../utils/jwt.utils.js";
import { User } from "../models/user.model.js";
import { JWT_EXPIRES_IN, JWT_SECRET } from "../config/env.config.js";

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
    if (existingUser) {
      const error = new Error("User already exists");
      error.statusCode = 409;
      throw error;
    }

    const hashedPass = await hashPassword(password);

    const user = new User({ name, email, password: hashedPass, role });
    await user.save({ session });

    // Saves new user data by putting into Jwt using the user's Id.
    const token = generateToken(
      { userId: user._id },
      JWT_SECRET,
      JWT_EXPIRES_IN
    );

    session.commitTransaction(); // sends data to database
    // response after transactions end.
    successResponse(
      res,
      {
        success: true,
        message: "User created successfully.",
        data: {
          token,
          user: newUsers,
        },
      },
      201
    );
  } catch (err) {
    await session.abortTransaction();
    next(err);
  } finally {
    session.endSession();
  }
};

export const signIn = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });

    if (!user) return errorResponse(res, "User not found", 404);

    const isValidPassword = await comparePassword(password, user.password);

    if (!isValidPassword) return errorResponse(res, "Invalid password", 401);

    const token = generateToken(
      { userId: user._id },
      JWT_SECRET,
      JWT_EXPIRES_IN
    );

    successResponse(
      res,
      {
        success: true,
        message: "User signed in successfully",
        data: {
          token,
          user,
        },
      },
      200
    );
  } catch (error) {
    next(error);
  }
};
