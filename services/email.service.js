import { sendEmail } from "../utils/email.util.js";

export const sendOrderConfirmation = async (user, order) => {
  const subject = "Order Confirmation - Domino Clone Lite 🍕";
  const text = `Hi ${user.name}, your order #${order._id} has been received. Total: $${order.totalPrice}.`;
  const html = `<h2>Hi ${user.name},</h2>
                <p>Your order <b>#${order._id}</b> has been received.</p>
                <p>Total: <b>$${order.totalPrice}</b></p>
                <p>Thank you for choosing us! 🍕</p>`;

  return sendEmail({ to: user.email, subject, text, html });
};

export const sendDeliveryUpdate = async (user, order) => {
  const subject = "Delivery Update 🚚";
  const text = `Your order #${order._id} is now ${order.status}.`;
  const html = `<p>Your order <b>#${order._id}</b> is now <b>${order.status}</b>.</p>`;

  return sendEmail({ to: user.email, subject, text, html });
};
