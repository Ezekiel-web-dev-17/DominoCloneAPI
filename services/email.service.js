import { FRONTEND_DEV_URL, FRONTEND_URL } from "../config/env.config.js";
import {
  accountVerificationTemplate,
  deliveryUpdateTemplate,
  orderCancelledTemplate,
  orderConfirmationTemplate,
  orderDeliveredTemplate,
  orderStatusUpdateTemplate,
  passwordResetTemplate,
} from "../templates/email.templates.js";
import { sendEmail } from "../utils/email.util.js";

export const sendOrderConfirmation = async (user, order) => {
  const { subject, text, html } = orderConfirmationTemplate(user, order);
  return sendEmail({ to: user.email, subject, text, html });
};

export const sendPaymentConfirmation = async (user, order) => {
  const { subject, text, html } = orderConfirmationTemplate(user, order);

  return sendEmail({ to: user.email, subject, text, html });
};

export const sendOrderStatusUpdate = async (user, order, prevStat, message) => {
  const trackUrl = `${FRONTEND_URL ? FRONTEND_URL : FRONTEND_DEV_URL}/orders/${
    order._id
  }/track`;
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

export const sendAccountVerification = async (user, token, time = "15min") => {
  const verifyUrl = `${
    FRONTEND_URL ? FRONTEND_URL : FRONTEND_DEV_URL
  }/verify-email?token=${token}`;
  const { subject, text, html } = accountVerificationTemplate(
    user,
    verifyUrl,
    time
  );

  return sendEmail({ to: user.email, subject, text, html });
};

export const sendPasswordReset = async (user, token) => {
  const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
  const { subject, text, html } = passwordResetTemplate(user, resetUrl);

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
