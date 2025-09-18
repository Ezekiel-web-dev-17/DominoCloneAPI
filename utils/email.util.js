import {
  EMAIL_HOST,
  EMAIL_PASS,
  EMAIL_PORT,
  EMAIL_USER,
} from "../config/env.config.js";
import logger from "../config/logger.config.js";
import nodemailer from "nodemailer";

/**
 * Configure Nodemailer transporter
 * - You can switch between Gmail, Mailtrap, or SendGrid SMTP
 */
const transporter = nodemailer.createTransport({
  host: EMAIL_HOST,
  port: EMAIL_PORT,
  secure: "true",
  auth: {
    user: EMAIL_USER,
    pass: EMAIL_PASS,
  },
});

/**
 * Reusable function to send emails
 * @param {Object} options
 * @param {string} options.to - Recipient email
 * @param {string} options.subject - Email subject
 * @param {string} options.text - Plain text version
 * @param {string} options.html - HTML version
 */
export const sendEmail = async ({ to, subject, text, html }) => {
  try {
    const mailOptions = {
      from: `"Domino's Pizza 🍕" <${EMAIL_USER}>`, // Sender info
      to,
      subject,
      text,
      html,
    };

    const info = await transporter.sendMail(mailOptions);

    logger.info(`✅ Email sent to ${to}: ${info.messageId}`);
    return info;
  } catch (error) {
    logger.error("❌ Email sending failed: ", error);
    throw new Error("Email could not be sent");
  }
};
