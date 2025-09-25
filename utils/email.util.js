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
  // host: EMAIL_HOST,
  // port: Number(EMAIL_PORT),
  // secure: Number(EMAIL_PORT) === 465, // true for 465, false for others
  // auth: {
  //   user: EMAIL_USER,
  //   pass: EMAIL_PASS,
  // },
  // tls: {
  //   rejectUnauthorized: false, // sometimes needed on Render
  // },
  service: "gmail",
  auth: {
    user: process.env.EMAIL,
    pass: process.env.PASSWORD,
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

    logger.info("Connecting to SMTP...");
    transporter.verify((err, success) => {
      if (err) {
        logger.error("SMTP connection failed:", err);
      } else {
        logger.info("SMTP server is ready to send:", success);
      }
    });

    const info = await transporter.sendMail(mailOptions);

    logger.info(`Email sent to ${to}: ${info.messageId}`);
    return info;
  } catch (error) {
    logger.error("Email sending failed: ", error);
    throw new Error("Email could not be sent");
  }
};
