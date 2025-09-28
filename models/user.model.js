import mongoose from "mongoose";
import { JWT_EXPIRES_IN } from "../config/env.config.js";

/* ====== Email Verification ====== */
const verifyEmailSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    expiresAt: {
      type: Number,
      required: true,
    },
    hashedToken: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

/* ====== Refresh Tokens ====== */
const refreshTokenSchema = new mongoose.Schema(
  {
    tokenHash: { type: String, required: true },
    createdAt: {
      type: Date,
      default: Date.now,
      expires: JWT_EXPIRES_IN, // auto-clean expired tokens
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: function (doc, ret) {
        delete ret.tokenHash; // don’t leak hash
      },
    },
  }
);

/* ====== WebAuthn Credentials ====== */
const webauthnCredentialSchema = new mongoose.Schema({
  credentialID: { type: String, required: true }, // base64url
  publicKey: { type: String, required: true }, // base64url
  counter: { type: Number, default: 0 },
  transports: [String], // ["usb", "ble", "nfc", "internal"]
  addedAt: { type: Date, default: Date.now },
});

/* ====== User ====== */
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
      index: true,
    },
    // Add these fields for WebAuthn
    username: {
      type: String,
      unique: true,
      sparse: true, // Allow null/undefined for regular users
      index: true,
    },
    displayName: {
      type: String,
    },
    password: {
      type: String,
      required: function () {
        // Password not required if using WebAuthn only
        return (
          !this.webauthnCredentials || this.webauthnCredentials.length === 0
        );
      },
      minlength: 6,
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
    webauthnCredentials: [webauthnCredentialSchema],
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

export const verifyEmail = mongoose.model("VerifyEmail", verifyEmailSchema);
export const User = mongoose.model("User", userSchema);
