import { LIVE_URL } from "../config/env.config.js";
import {
  accountVerificationTemplate,
  deliveryUpdateTemplate,
  orderCancelledTemplate,
  orderConfirmationTemplate,
  orderDeliveredTemplate,
  orderStatusUpdateTemplate,
  passwordResetTemplate,
  welcomeTemplate,
} from "../templates/email.templates.js";
import { sendEmail } from "../utils/email.util.js";

//USER AUTH RELATED EMAILS
export const sendAccountVerification = async (user, token, time = "15min") => {
  const verifyUrl = `${LIVE_URL}auth/verify-email?token=${encodeURIComponent(
    token
  )}&userId=${user._id}`;
  const { subject, text, html } = accountVerificationTemplate(
    user,
    verifyUrl,
    time
  );

  return sendEmail({ to: user.email, subject, text, html });
};

export const sendPasswordReset = async (user, token) => {
  const resetUrl = `${LIVE_URL}reset-password?token=${encodeURIComponent(
    token
  )}&userId=${user._id}`;
  const { subject, text, html } = passwordResetTemplate(user, resetUrl);

  return sendEmail({ to: user.email, subject, text, html });
};

export const sendWelcomeEmail = async (user) => {
  const { subject, text, html } = welcomeTemplate(user);

  return sendEmail({ to: user.email, subject, text, html });
};

// ORDER RELATED EMAILS
export const sendOrderConfirmation = async (user, order) => {
  const { subject, text, html } = orderConfirmationTemplate(user, order);
  return sendEmail({ to: user.email, subject, text, html });
};

export const sendPaymentConfirmation = async (user, order) => {
  const { subject, text, html } = orderConfirmationTemplate(user, order);

  return sendEmail({ to: user.email, subject, text, html });
};

export const sendOrderStatusUpdate = async (user, order, prevStat, message) => {
  const trackUrl = `${LIVE_URL}/orders/${order._id}/track`;
  const { subject, text, html } = orderStatusUpdateTemplate(
    user,
    order,
    trackUrl,
    (prevStat = null),
    (message = null)
  );

  return sendEmail({ to: user.email, subject, text, html });
};

export const sendDeliveryConfirmation = async (user, order) => {
  const { subject, text, html } = orderDeliveredTemplate(user, order);

  return sendEmail({ to: user.email, subject, text, html });
};

export const sendOrderCancelled = async (user, order) => {
  const { subject, text, html } = orderCancelledTemplate(user, order);

  return sendEmail({ to: user.email, subject, text, html });
};

export const sendDeliveryUpdate = async (user, order, timeRemaining) => {
  const { subject, text, html } = deliveryUpdateTemplate(
    user,
    order,
    timeRemaining
  );

  return sendEmail({ to: user.email, subject, text, html });
};
