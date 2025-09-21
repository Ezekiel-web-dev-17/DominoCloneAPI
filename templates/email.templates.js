import { FRONTEND_URL } from "../config/env.config.js";

export const orderConfirmationTemplate = (user, order) => ({
  subject: "🍕 Hot off the oven – Your Domino’s order is confirmed!",
  text: `Hi ${user.name},

Thanks for choosing Domino’s! Your order #${order.orderCode} is in the oven and will be ready soon. 

Order Total: $${order.total}

Sit back, relax, and get ready for some cheesy goodness. We’ll let you know when your pizza is on the move!

– Your Domino’s Team 🍕`,

  html: `
  <h2>Hi ${user.name},</h2>
  <p>Thanks for choosing <b>Domino’s</b>! 🎉</p>
  <p>Your order <b>#${order.orderCode}</b> is in the oven and will be ready soon.</p>
  <p><b>Order Total:</b> $${order.totalPrice}</p>
  <p><b>Estimated Delivery time:</b> $${order.prepTime}</p>
  <p>Sit back, relax, and get ready for some cheesy goodness. We’ll let you know when your pizza is on the move!</p>
  <br/>
  <p>– Your Domino’s Team 🍕</p>
  `,
});

export const orderStatusUpdateTemplate = (
  user,
  order,
  { previousStatus = null, message = null } = {}
) => {
  // message: optional custom message to include (e.g., "Driver is 5 minutes away")
  const statusLabel = order.status || "updated";

  return {
    subject: `📦 Order Update — #${order.orderCode} is ${statusLabel}`,
    text: `Hi ${user.name},

Your order #${order.orderCode} status changed to: ${statusLabel}.
${message ? `Note: ${message}` : ""}

You can track your order here: ${trackUrl}

Thanks for choosing Domino’s!`,
    html: `
      <div style="font-family: Arial, sans-serif; color:#111;">
        <h2>Order Update</h2>
        <p>Your order <strong>#${
          order.orderCode
        }</strong> status is now <strong>${statusLabel}</strong>.</p>
        ${
          previousStatus
            ? `<p><strong>Previous status:</strong> ${previousStatus}</p>`
            : ""
        }
        ${message ? `<p><em>${message}</em></p>` : ""}
        <p><a href="${trackUrl}" target="_blank" style="color:#d9534f;">Track your order</a></p>
        <br/>
        <p>– <strong>Domino’s</strong> 🚗🍕</p>
      </div>
    `,
  };
};

export const deliveryUpdateTemplate = (user, order, timeRemaining = 1) => ({
  subject: "🚗 Your Domino’s order is on the way!",
  text: `Hi ${user.name},

Great news – your order #${order.orderCode} is out for delivery! 
Our driver is racing against the clock to bring hot, fresh pizza to your door. 

Estimated Time Remaining: ${timeRemaining} minute(s)

Track your delivery in real-time in your account.

– Your Domino’s Team 🚗🍕`,

  html: `
  <h2>Hi ${user.name},</h2>
  <p>Great news – your order <b>#${order.orderCode}</b> is <b>on the way</b>! 🚗💨</p>
  <p>Our driver is racing against the clock to bring hot, fresh pizza to your door.</p>
  <p><b>Estimated Time Remaining:</b> ${timeRemaining} minutes</p>
  <p>Track your delivery in real-time in your account dashboard.</p>
  <br/>
  <p>– Your Domino’s Team 🚗🍕</p>
  `,
});

export const orderDeliveredTemplate = (user, order) => ({
  subject: "Your Domino’s order has arrived!",
  text: `Hi ${user.name},

Your order #${order.orderCode} has just been delivered. 
We hope it’s piping hot and delicious! 🍴

Love your meal? Tell us about it – your feedback helps us get even better.

Enjoy your Domino’s!`,

  html: `
  <h2>Hi ${user.name},</h2>
  <p>Your order <b>#${order.orderCode}</b> has just been <b>delivered</b>. 🎉</p>
  <p>We hope it’s piping hot and delicious! 🍴</p>
  <p>Love your meal? <a href="${FRONTEND_URL}#feedback">Leave us feedback</a> – your thoughts help us get even better.</p>
  <br/>
  <p>Enjoy your Domino’s! 🍕</p>
  `,
});

export const orderCancelledTemplate = (user, order) => ({
  subject: "⚠️ Your Domino’s order was cancelled",
  text: `Hi ${user.name},

We’re sorry – your order #${order.orderCode} has been cancelled.  

If payment was processed, a refund is already on its way to you.

We hope to serve you again soon with a better experience.

– Your Domino’s Team`,

  html: `
  <h2>Hi ${user.name},</h2>
  <p>We’re sorry – your order <b>#${order.orderCode}</b> has been <b>cancelled</b>. 😔</p>
  <p>If payment was processed, a refund is already on its way to you.</p>
  <p>We hope to serve you again soon with a better experience.</p>
  <br/>
  <p>– Your Domino’s Team 🍕</p>
  `,
});

export const passwordResetTemplate = (user, resetLink) => ({
  subject: "🔑 Reset Your Domino’s Account Password",
  text: `Hi ${user.name},

We got a request to reset your Domino’s account password.  
You can reset it by clicking the link below:

${resetLink}

If you didn’t request this, just ignore this email – your password is safe.

– Your Domino’s Team`,

  html: `
  <h2>Hi ${user.name},</h2>
  <p>We got a request to reset your <b>Domino’s account password</b>. 🔑</p>
  <p>You can reset it by clicking the link below:</p>
  <p><a href="${resetLink}">${resetLink}</a></p>
  <p>If you didn’t request this, just ignore this email – your password is safe.</p>
  <br/>
  <p>– Your Domino’s Team 🍕</p>
  `,
});

export const accountVerificationTemplate = (
  user,
  verifyUrl,
  { expiresIn = "15 min" } = {}
) => {
  return {
    subject: "🔑 Verify your Domino’s account",
    text: `Hi ${user.name},

Welcome to Domino’s! Please verify your email address by visiting the link below:

${verifyUrl}

This verification link expires in ${expiresIn}. If you did not create an account, please ignore this message.`,
    html: `
      <div style="font-family: Arial, sans-serif; color:#111;">
        <h2>Welcome to Domino’s!</h2>
        <p>Hi ${user.name},</p>
        <p>Thanks for signing up. Please verify your email to activate your account:</p>
        <p><a href="${verifyUrl}" style="display:inline-block;padding:10px 18px;background:#d9534f;color:#fff;text-decoration:none;border-radius:4px;">Verify Email</a></p>
        <p style="font-size:12px;color:#666;">This link expires in ${expiresIn}.</p>
        <br/>
        <p>– <strong>Domino’s</strong> 🍕</p>
      </div>
    `,
  };
};

export const welcomeTemplate = (user) => ({
  subject: "🎉 Welcome to Domino’s – Let’s get cooking!",
  text: `Hi ${user.name},

Welcome to Domino’s! Your account is all set up, and pizza is just a few clicks away. 🍕

Start exploring our menu, save your favorites, and enjoy hot, fresh pizza delivered straight to you.

We can’t wait to serve you!`,

  html: `
  <h2>Hi ${user.name},</h2>
  <p>Welcome to <b>Domino’s</b>! 🎉</p>
  <p>Your account is all set up, and pizza is just a few clicks away. 🍕</p>
  <p>Start exploring our menu, save your favorites, and enjoy hot, fresh pizza delivered straight to your door.</p>
  <br/>
  <p>We can’t wait to serve you!</p>
  <p>– Your Domino’s Team 🍕</p>
  `,
});
