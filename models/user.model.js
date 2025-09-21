import mongoose from "mongoose";
import { JWT_EXPIRES_IN } from "../config/env.config.js";

const verifyEmailSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      unique: true,
    },

    expiresAt: {
      type: Number,
      required: true,
      unique: true,
    },

    hashedToken: {
      type: String,
      required: true,
      unique: true,
    },
  },
  { timestamps: true }
);

const refreshTokenSchema = new mongoose.Schema(
  {
    tokenHash: { type: String, required: true },
    createdAt: { type: Date, default: Date.now, expires: JWT_EXPIRES_IN },
  },
  {
    timestamps: true,
    toJSON: {
      transform: function (doc, ret) {
        delete ret.tokenHash;
      },
    },
  }
);

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      match: [/\S+@\S+\.\S+/, "Please provide a valid email address"],
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: 6,
    },
    role: {
      type: String,
      enum: ["customer", "driver", "admin"],
      default: "customer",
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    tokenVersion: { type: Number, default: 0 },
    refreshTokens: [refreshTokenSchema],
  },
  {
    timestamps: true,
    toJSON: {
      transform: function (doc, ret) {
        ret.id = ret._id;
        delete ret.__v;
        delete ret._id;
        delete ret.password;
        delete ret.refreshTokens;
      },
    },
  }
);

export const verifyEmail = mongoose.model("emailVerify", verifyEmailSchema);
export const User = mongoose.model("User", userSchema);
