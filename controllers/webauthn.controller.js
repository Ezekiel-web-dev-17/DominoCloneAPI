import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import base64url from "base64url";
import { DOMAIN, FRONTEND_URL } from "../config/env.config.js";
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

// Config
const rpName = "Domino Pizza Clone";
const rpID = DOMAIN || "localhost";
const origin = FRONTEND_URL;

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

    const userId = String(user.id);

    const opts = generateRegistrationOptions({
      rpName,
      rpID,
      userID: userId,
      userName: username,
      attestationType: "none",
      authenticatorSelection: {
        userVerification: "preferred", // or "required"
      },
      // exclude existing credentials (so user can't register the same key twice)
      excludeCredentials: (user.webauthnCredentials || []).map((c) => ({
        id: fromBase64Url(c.credentialID),
        type: "public-key",
        transports: c.transports || undefined,
      })),
    });

    // Save challenge server-side for verification; tie to the user
    await redis.set(userId, opts.challenge);
    res.json(opts);
  } catch (error) {
    next(error);
  }
};

/* 2) Registration Verify */
export const regVerify = async (req, res, next) => {
  const { id, rawId, response, type } = req.body; // the full credential from browser
  const { userId } = req.body; // ensure frontend sends userId or username
  const expectedChallenge = await redis.get(userId);

  try {
    const verification = await verifyRegistrationResponse({
      credential: req.body,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
    });

    const { verified, registrationInfo } = verification;
    if (!verified || !registrationInfo)
      return errorResponse(res, "Verification failed!", 400);

    const { credentialPublicKey, credentialID, counter } = registrationInfo;
    await saveCredentialForUser(userId, {
      credentialID: toBase64Url(credentialID),
      publicKey: toBase64Url(credentialPublicKey),
      counter,
      addedAt: new Date(),
    });

    await redis.del(userId);
    successResponse(res, {
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
      return res.status(400).json({ error: "No credentials" });
    }

    const opts = generateAuthenticationOptions({
      rpID,
      userVerification: "preferred",
      allowCredentials: user.webauthnCredentials.map((c) => ({
        id: fromBase64Url(c.credentialID),
        type: "public-key",
        transports: c.transports || undefined,
      })),
    });

    await redis.set(String(user.id), opts.challenge);
    successResponse(res, { opts }, 200);
  } catch (error) {
    next(error);
  }
};

/* 4) Authentication Verify */
export const authVerify = async (req, res, next) => {
  try {
    const { credential, userId } = req.body;
    const user = await getUserById(userId);

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
