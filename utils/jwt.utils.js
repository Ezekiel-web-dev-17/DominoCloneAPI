import jwt from "jsonwebtoken";

export const generateToken = (userData, secret, expires) => {
  return jwt.sign({ ...userData }, secret, {
    expiresIn: expires,
  });
};

export const verifyToken = (token, secret) => {
  return jwt.verify(token, secret);
};

export const decodeToken = (token, secret) => {
  return jwt.decode(token, secret);
};
