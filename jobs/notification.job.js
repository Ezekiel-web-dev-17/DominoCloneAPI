import cron from "node-cron";
import logger from "../config/logger.config.js";
import { sendEmail } from "../utils/email.util.js";

// Example: runs every minute
cron.schedule("* * * * *", async () => {
  try {
    logger.info("Running notification job...");

    // Example: send reminder email (in reality, fetch pending notifications from DB)
    await sendEmail({
      to: "customer@example.com",
      subject: "Your pizza order is on the way!",
      text: "Hello! Your pizza is being prepared and will be delivered soon 🍕",
    });

    logger.info("Notification sent successfully.");
  } catch (error) {
    logger.error(`Notification job failed: ${error.message}`);
  }
});
