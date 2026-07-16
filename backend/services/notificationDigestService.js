const User = require("../models/User");
const { sendMail } = require("./mailer");
const { getNotificationSnapshot } = require("./calibrationCanonicalService");
const { formatDateSydney, nowSydneyDateTime, SYDNEY_TZ } = require("../utils/dateUtils");

const BRAND_GREEN = "rgb(25, 138, 44)";
const SECTION_ORDER = ["Calibration", "IAQ", "Audit"];
const SECTION_TITLES = {
  Calibration: "Calibrations",
  IAQ: "IAQ",
  Audit: "Audits",
};

const BUCKET_COLORS = {
  overdue: "#c62828",
  dueSoon: "#f9a825",
  dueThisMonth: "#2e7d32",
};

function getFrontendUrl() {
  return process.env.FRONTEND_URL || "http://localhost:3000";
}

function escapeHtml(value) {
  if (value == null) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDueText(daysUntilDue) {
  if (typeof daysUntilDue !== "number" || Number.isNaN(daysUntilDue)) {
    return "—";
  }
  if (daysUntilDue < 0) {
    const days = Math.abs(daysUntilDue);
    return `${days} day${days === 1 ? "" : "s"} overdue`;
  }
  if (daysUntilDue === 0) {
    return "Due today";
  }
  return `Due in ${daysUntilDue} day${daysUntilDue === 1 ? "" : "s"}`;
}

function getDueColor(daysUntilDue, bucket) {
  if (typeof daysUntilDue === "number") {
    if (daysUntilDue < 0) return BUCKET_COLORS.overdue;
    if (daysUntilDue < 7) return BUCKET_COLORS.dueSoon;
    return BUCKET_COLORS.dueThisMonth;
  }
  return BUCKET_COLORS[bucket] || BUCKET_COLORS.dueThisMonth;
}

function groupRowsByRecordType(rows = []) {
  const groups = {
    Calibration: [],
    IAQ: [],
    Audit: [],
  };

  rows.forEach((row) => {
    const key = SECTION_ORDER.includes(row.recordType)
      ? row.recordType
      : null;
    if (key) {
      groups[key].push(row);
    }
  });

  return groups;
}

function buildSectionTableHtml(rows) {
  if (!rows.length) {
    return `<p style="color: #666; margin: 8px 0 0;">No items in this category.</p>`;
  }

  const bodyRows = rows
    .map((row) => {
      const color = getDueColor(row.daysUntilDue, row.bucket);
      return `
        <tr>
          <td style="padding: 8px 10px; border-bottom: 1px solid #eee; color: ${color};">${escapeHtml(row.recordDescription || "—")}</td>
          <td style="padding: 8px 10px; border-bottom: 1px solid #eee; color: ${color};">${escapeHtml(row.equipmentReference || "—")}</td>
          <td style="padding: 8px 10px; border-bottom: 1px solid #eee; color: ${color};">${escapeHtml(formatDateSydney(row.dueDate) || "—")}</td>
          <td style="padding: 8px 10px; border-bottom: 1px solid #eee; color: ${color}; font-weight: 600;">${escapeHtml(formatDueText(row.daysUntilDue))}</td>
        </tr>`;
    })
    .join("");

  return `
    <table style="width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 14px;">
      <thead>
        <tr style="background-color: #f5f5f5; text-align: left;">
          <th style="padding: 8px 10px; border-bottom: 1px solid #ddd;">Description</th>
          <th style="padding: 8px 10px; border-bottom: 1px solid #ddd;">Equipment</th>
          <th style="padding: 8px 10px; border-bottom: 1px solid #ddd;">Due date</th>
          <th style="padding: 8px 10px; border-bottom: 1px solid #ddd;">Status</th>
        </tr>
      </thead>
      <tbody>
        ${bodyRows}
      </tbody>
    </table>`;
}

function buildSectionText(title, rows) {
  if (!rows.length) {
    return `${title}\n  No items in this category.\n`;
  }

  const lines = rows.map((row) => {
    const description = row.recordDescription || "—";
    const equipment = row.equipmentReference
      ? ` (${row.equipmentReference})`
      : "";
    const dueDate = formatDateSydney(row.dueDate) || "—";
    return `  - ${description}${equipment} — ${dueDate} — ${formatDueText(row.daysUntilDue)}`;
  });

  return `${title} (${rows.length})\n${lines.join("\n")}\n`;
}

function buildDigestEmailContent({ rows, recipientFirstName }) {
  const groups = groupRowsByRecordType(rows);
  const viewUrl = `${getFrontendUrl()}/notifications`;
  const generatedLabel = nowSydneyDateTime();
  const overdueCount = rows.filter((row) => row.bucket === "overdue").length;
  const dueSoonCount = rows.filter((row) => row.bucket === "dueSoon").length;
  const dueThisMonthCount = rows.filter(
    (row) => row.bucket === "dueThisMonth",
  ).length;
  const totalCount = rows.length;

  const subject = `Weekly Notification Centre Digest — ${totalCount} item${totalCount === 1 ? "" : "s"}`;

  const greetingName = recipientFirstName
    ? escapeHtml(recipientFirstName)
    : "there";

  const sectionsHtml = SECTION_ORDER.map((key) => {
    const title = SECTION_TITLES[key];
    const sectionRows = groups[key];
    return `
      <div style="margin: 28px 0 0;">
        <h3 style="color: ${BRAND_GREEN}; margin: 0 0 4px; font-size: 18px;">
          ${escapeHtml(title)} (${sectionRows.length})
        </h3>
        ${buildSectionTableHtml(sectionRows)}
      </div>`;
  }).join("");

  const sectionsText = SECTION_ORDER.map((key) =>
    buildSectionText(SECTION_TITLES[key], groups[key]),
  ).join("\n");

  const text = `Weekly Notification Centre Digest

Generated: ${generatedLabel} (${SYDNEY_TZ})
Total items: ${totalCount}
Overdue: ${overdueCount}
Due in <7 days: ${dueSoonCount}
Due in 7-30 days: ${dueThisMonthCount}

${sectionsText}
View the Notification Centre: ${viewUrl}`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 720px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
      <div style="margin-bottom: 24px;">
        <h1 style="color: ${BRAND_GREEN}; font-size: 24px; margin: 0; padding: 0;">L&D Consulting App</h1>
      </div>
      <div style="color: #333; line-height: 1.6;">
        <h2 style="color: ${BRAND_GREEN}; margin-bottom: 12px;">Weekly Notification Centre Digest</h2>
        <p>Hello ${greetingName},</p>
        <p>Here is your weekly summary of items currently in the Notification Centre.</p>
        <div style="background-color: #f5f5f5; padding: 15px; border-radius: 4px; margin: 20px 0;">
          <p style="margin: 5px 0;"><strong>Generated:</strong> ${escapeHtml(generatedLabel)} (${escapeHtml(SYDNEY_TZ)})</p>
          <p style="margin: 5px 0;"><strong>Total items:</strong> ${totalCount}</p>
          <p style="margin: 5px 0; color: ${BUCKET_COLORS.overdue};"><strong>Overdue:</strong> ${overdueCount}</p>
          <p style="margin: 5px 0; color: ${BUCKET_COLORS.dueSoon};"><strong>Due in &lt;7 days:</strong> ${dueSoonCount}</p>
          <p style="margin: 5px 0; color: ${BUCKET_COLORS.dueThisMonth};"><strong>Due in 7-30 days:</strong> ${dueThisMonthCount}</p>
        </div>
        ${sectionsHtml}
        <div style="text-align: center; margin: 30px 0;">
          <a href="${escapeHtml(viewUrl)}" style="background-color: ${BRAND_GREEN}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">Open Notification Centre</a>
        </div>
        <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">
        <p style="color: #666; font-size: 12px;">This is an automated weekly message for admin staff. Please do not reply to this email.</p>
      </div>
    </div>
  `;

  return { subject, text, html, groups, counts: { totalCount, overdueCount, dueSoonCount, dueThisMonthCount } };
}

async function getAdminDigestRecipients() {
  return User.find({
    role: { $in: ["admin", "super_admin"] },
    isActive: true,
    email: { $exists: true, $ne: "" },
  })
    .select("firstName lastName email role")
    .lean();
}

const TEST_DIGEST_EMAIL =
  process.env.NOTIFICATION_DIGEST_TEST_EMAIL || "kylelanc86@gmail.com";

async function sendDigestToRecipients(recipients, rows) {
  const results = [];
  let sent = 0;
  let failed = 0;

  for (const recipient of recipients) {
    try {
      const { subject, text, html } = buildDigestEmailContent({
        rows,
        recipientFirstName: recipient.firstName,
      });
      await sendMail({ to: recipient.email, subject, text, html });
      sent += 1;
      results.push({ email: recipient.email, ok: true });
    } catch (error) {
      failed += 1;
      console.error(
        `Notification digest: failed to send to ${recipient.email}:`,
        error.message || error,
      );
      results.push({
        email: recipient.email,
        ok: false,
        error: error.message || String(error),
      });
    }
  }

  return { sent, failed, results };
}

/**
 * Build Notification Centre snapshot and email the weekly digest to all
 * active admin / super_admin users.
 */
async function sendWeeklyNotificationDigest({ forceRefresh = true } = {}) {
  const snapshot = await getNotificationSnapshot({ forceRefresh });
  const rows = snapshot.rows || [];
  const recipients = await getAdminDigestRecipients();

  if (recipients.length === 0) {
    console.warn("Notification digest: no active admin/super_admin recipients found");
    return {
      sent: 0,
      failed: 0,
      recipientCount: 0,
      itemCount: rows.length,
      results: [],
    };
  }

  const { sent, failed, results } = await sendDigestToRecipients(
    recipients,
    rows,
  );

  console.log(
    `Notification digest complete: ${sent} sent, ${failed} failed, ${rows.length} items, ${recipients.length} recipients`,
  );

  return {
    sent,
    failed,
    recipientCount: recipients.length,
    itemCount: rows.length,
    results,
  };
}

/**
 * Send a one-off test digest to the configured test inbox (default kylelanc86@gmail.com).
 */
async function sendTestNotificationDigest({
  forceRefresh = true,
  to = TEST_DIGEST_EMAIL,
} = {}) {
  const snapshot = await getNotificationSnapshot({ forceRefresh });
  const rows = snapshot.rows || [];
  const recipients = [{ email: to, firstName: "Kyle" }];

  const { sent, failed, results } = await sendDigestToRecipients(
    recipients,
    rows,
  );

  console.log(
    `Notification digest test complete: ${sent} sent, ${failed} failed, ${rows.length} items → ${to}`,
  );

  return {
    sent,
    failed,
    recipientCount: recipients.length,
    itemCount: rows.length,
    testEmail: to,
    results,
  };
}

module.exports = {
  sendWeeklyNotificationDigest,
  sendTestNotificationDigest,
  buildDigestEmailContent,
  getAdminDigestRecipients,
  groupRowsByRecordType,
  SECTION_ORDER,
  SECTION_TITLES,
  TEST_DIGEST_EMAIL,
};
