// user.service.js

import { User } from "../models/user.model.js";
import { generateRefreshTokens } from "../utils/jwt.utils.js";
import redis from "../utils/redis.util.js";
import { sendTokenResponse } from "../utils/response.util.js";

/** Find user by username */
export async function getUserByUsername(username) {
  return await User.findOne({ username }).exec();
}

/** Find user by ID */
export async function getUserById(id) {
  return await User.findById(id).exec();
}

/** Create new user */
export async function createUser({ username, displayName }) {
  const user = new User({
    username,
    displayName,
    isVerified: false,
    webauthnCredentials: [],
  });
  return await user.save();
}

/** Save new WebAuthn credential for user */
export async function saveCredentialForUser(userId, credential) {
  return await User.findByIdAndUpdate(
    userId,
    {
      $push: { webauthnCredentials: credential },
      $set: { isVerified: true },
    },
    { new: true }
  ).exec();
}

/** Update counter for a user’s credential */
export async function updateUserCredentialCounter(
  userId,
  credentialID,
  counter
) {
  const user = await User.updateOne(
    { _id: userId, "webauthnCredentials.credentialID": credentialID },
    { $set: { "webauthnCredentials.$.counter": counter } }
  ).exec();
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

  await redis.del(userId);
  await user.save();
  sendTokenResponse(res, accessToken, refreshToken);
}
