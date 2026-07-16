const dotenv = require("dotenv");
const connectDB = require("../config/db");
const {
  sendWeeklyNotificationDigest,
} = require("../services/notificationDigestService");

dotenv.config();

const run = async () => {
  try {
    await connectDB();
    console.log("Sending weekly Notification Centre digest...");
    const result = await sendWeeklyNotificationDigest({ forceRefresh: true });
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.failed > 0 ? 1 : 0);
  } catch (error) {
    console.error("Failed to send notification digest:", error);
    process.exit(1);
  }
};

run();
