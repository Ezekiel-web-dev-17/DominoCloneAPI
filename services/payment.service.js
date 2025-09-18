import axios from "axios";
import { PAYMENT_SECRET_KEY } from "../config/env.config.js";

export const processPayment = async (email, amount) => {
  try {
    // Paystack requires amount in Kobo (NGN * 100)
    const response = await axios.post(
      "https://api.paystack.co/transaction/initialize",
      { email, amount: `${amount * 100}` },
      {
        headers: {
          Authorization: `Bearer ${PAYMENT_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    // return important Paystack details
    return response.data.data; // contains authorization_url, access_code, reference
  } catch (err) {
    throw new Error(err.response?.data?.message || err.message);
  }
};

export const verifyPayment = async (reference) => {
  try {
    // Verify transaction with Paystack
    const verifyRes = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: { Authorization: `Bearer ${PAYMENT_SECRET_KEY}` },
      }
    );

    // Return the transaction details
    return verifyRes.data.data;
  } catch (err) {
    throw new Error(err.response?.data?.message || err.message);
  }
};
