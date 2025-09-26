import { EMAIL_USER, SENDGRID_API } from "../config/env.config.js";
import logger from "../config/logger.config.js";
import sgMail from "@sendgrid/mail";

/**
 * Reusable function to send emails
 * @param {Object} options
 * @param {string} options.to - Recipient email
 * @param {string} options.subject - Email subject
 * @param {string} options.text - Plain text version
 * @param {string} options.html - HTML version
 */

export const sendEmail = async ({ to, subject, text, html }) => {
  sgMail.setApiKey(SENDGRID_API);

  try {
    const mailOptions = {
      from: `"Domino's Pizza 🍕" <${EMAIL_USER}>`, // must be a verified sender in SendGrid
      to,
      subject,
      text,
      html,
    };

    logger.info("Sending mail...");
    const [response] = await sgMail.send(mailOptions);

    logger.info(`Email sent to ${to}: status ${response.statusCode}`);
    return response;
  } catch (error) {
    logger.error("Email sending failed: ", error);
    throw new Error("Email could not be sent");
  }
};
