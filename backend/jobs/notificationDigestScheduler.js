const cron = require("node-cron");
const { SYDNEY_TZ } = require("../utils/dateUtils");
const { sendWeeklyNotificationDigest } = require("../services/notificationDigestService");

const CRON_EXPRESSION = "0 9 * * 1"; // Every Monday at 09:00
let scheduledTask = null;

function isDigestCronEnabled() {
  const flag = process.env.NOTIFICATION_DIGEST_CRON;
  if (flag === "false" || flag === "0") {
    return false;
  }
  if (flag === "true" || flag === "1") {
    return true;
  }
  // Default: enabled in production only (avoid accidental local Monday sends)
  return process.env.NODE_ENV === "production";
}

/**
 * Schedule the weekly Notification Centre digest email.
 * Runs Mondays at 9:00am Australia/Sydney.
 * Enabled by default in production. Override with NOTIFICATION_DIGEST_CRON=true|false.
 */
function startNotificationDigestScheduler() {
  if (!isDigestCronEnabled()) {
    console.log(
      "Notification digest cron disabled (set NOTIFICATION_DIGEST_CRON=true to enable outside production)",
    );
    return null;
  }

  if (scheduledTask) {
    return scheduledTask;
  }

  if (!cron.validate(CRON_EXPRESSION)) {
    console.error(
      `Invalid notification digest cron expression: ${CRON_EXPRESSION}`,
    );
    return null;
  }

  scheduledTask = cron.schedule(
    CRON_EXPRESSION,
    async () => {
      console.log(
        `Notification digest cron starting (${CRON_EXPRESSION}, ${SYDNEY_TZ})`,
      );
      try {
        await sendWeeklyNotificationDigest({ forceRefresh: true });
      } catch (error) {
        console.error("Notification digest cron failed:", error);
      }
    },
    {
      timezone: SYDNEY_TZ,
    },
  );

  console.log(
    `Notification digest cron scheduled: "${CRON_EXPRESSION}" (${SYDNEY_TZ})`,
  );
  return scheduledTask;
}

module.exports = {
  startNotificationDigestScheduler,
  CRON_EXPRESSION,
};
