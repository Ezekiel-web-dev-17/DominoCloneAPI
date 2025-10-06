import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import base64url from "base64url";
import { DOMAIN, FRONTEND_URL, NODE_ENV } from "../config/env.config.js";
import {
  errorResponse,
  sendTokenResponse,
  successResponse,
} from "../utils/response.util.js";
import redis from "../utils/redis.util.js";
import {
  createUser,
  getUserById,
  getUserByUsername,
  saveCredentialForUser,
  updateUserCredentialCounter,
} from "../services/user.service.js";
import { generateRefreshTokens } from "../utils/jwt.utils.js";
import logger from "../config/logger.config.js";
import { isoBase64URL, isoUint8Array } from "@simplewebauthn/server/helpers";

// Config
const rpName = "Domino Pizza Clone";
const rpID = DOMAIN || "localhost";
const origin =
  NODE_ENV === "production" ? FRONTEND_URL : `http://localhost:5173`;

function toBase64Url(buffer) {
  return base64url(buffer);
}

function fromBase64Url(b64) {
  return base64url.toBuffer(b64);
}

/* 1) Registration Options */
export const regOpts = async (req, res, next) => {
  try {
    const { username, displayName } = req.body;
    // find or create user
    let user = await getUserByUsername(username);
    if (!user) {
      user = await createUser({ username, displayName });
    }

    const userIdUint8 = isoUint8Array.fromUTF8String(String(user._id));
    const opts = await generateRegistrationOptions({
      rpName,
      rpID,
      userID: userIdUint8,
      userName: username,
      userDisplayName: displayName,
      attestationType: "none",
      authenticatorSelection: {
        userVerification: "required",
      },
      // exclude existing credentials (so user can't register the same key twice)
      excludeCredentials: (user.webauthnCredentials || []).map((c) => ({
        id: fromBase64Url(c.credentialID),
        type: "public-key",
        transports: c.transports || undefined,
      })),
    });

    opts.user.id = isoBase64URL.fromBuffer(opts.user.id);

    opts.excludeCredentials = (opts.excludeCredentials || []).map((c) => ({
      ...c,
      id: isoBase64URL.fromBuffer(c.id),
    }));

    logger.info("Registration options generated.");
    // Save challenge server-side for verification; tie to the user
    await redis.set(`${user.id}-challenge`, opts.challenge);

    successResponse(res, { opts }, 200);
    return;
  } catch (error) {
    next(error);
  }
};

/* 2) Registration Verify */
export const regVerify = async (req, res, next) => {
  try {
    logger.info("Verifying registration...");
    const { userId } = req.body;

    let user = await getUserByUsername(userId);
    const expectedChallenge = await redis.get(user._id + "-challenge");

    if (!expectedChallenge) {
      return errorResponse(res, "No challenge found for user", 400);
    }

    const credential = await JSON.parse(req.body.cred);

    const verification = await verifyRegistrationResponse({
      response: credential,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
    });

    // Verification successful, add this new credential to user's account
    const { verified, registrationInfo } = verification;
    if (!verified || !registrationInfo)
      return errorResponse(res, "Verification failed!", 400);

    const { publicKey, id, counter } = registrationInfo.credential;

    await saveCredentialForUser(user._id, {
      credentialID: toBase64Url(id),
      publicKey: toBase64Url(publicKey),
      counter,
      addedAt: new Date(),
    });

    await redis.del(`${userId}-challenge`);
    return successResponse(res, {
      message: "User verified and registered successfully.",
    });
  } catch (err) {
    console.error(err);
    next(err);
  }
};

/* 3) Authentication Options */
export const authOpts = async (req, res, next) => {
  try {
    const { username } = req.body;
    const user = await getUserByUsername(username);

    if (
      !user ||
      !user.webauthnCredentials ||
      user.webauthnCredentials.length === 0
    ) {
      return errorResponse(res, "No credentials", 400);
    }

    console.log("Generating authentication options...");

    const opts = await generateAuthenticationOptions({
      rpID,
      userVerification: "required",
      allowCredentials: user.webauthnCredentials.map((c) => ({
        id: c.credentialID, // ✅ keep as base64url string
        type: "public-key",
        transports: c.transports || undefined,
      })),
    });

    await redis.set(`${user._id}-challenge`, opts.challenge, "EX", 60 * 5);

    successResponse(res, { opts }, 200);
  } catch (error) {
    next(error);
  }
};

/* 4) Authentication Verify */
export const authVerify = async (req, res, next) => {
  try {
    const { credential, username } = req.body;
    const user = await getUserByUsername(username);

    if (!user.isVerified)
      return errorResponse(res, "User is not verified", 400);

    const expectedChallenge = await redis.get(userId);
    const credID = base64url(credential.rawId);

    const savedCred = user.webauthnCredentials.find(
      (c) => c.credentialID === credID
    );
    if (!savedCred) return errorResponse(res, "Unknown credential", 400);

    const verification = await verifyAuthenticationResponse({
      credential,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      authenticator: {
        credentialPublicKey: fromBase64Url(savedCred.publicKey),
        credentialID: fromBase64Url(savedCred.credentialID),
        counter: savedCred.counter || 0,
      },
    });

    if (!verification.verified)
      return errorResponse(res, "Authentication failed", 400);

    // Update counter
    savedCred.counter = verification.authenticationInfo.newCounter;
    await updateUserCredentialCounter(
      userId,
      savedCred.credentialID,
      savedCred.counter
    );

    // 🚀 FIXED: Generate and send tokens
    const { accessToken, refreshToken, refreshTokenHash } =
      await generateRefreshTokens(user);

    user.refreshTokens.push({
      tokenHash: refreshTokenHash,
      createdAt: new Date(),
    });
    if (user.refreshTokens.length > 5) {
      user.refreshTokens = user.refreshTokens.slice(-5);
    }
    await user.save();

    await redis.del(userId);
    sendTokenResponse(res, accessToken, refreshToken);
  } catch (err) {
    console.error(err);
    next(err);
  }
};
