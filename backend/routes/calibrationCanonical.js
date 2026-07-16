const express = require("express");
const auth = require("../middleware/auth");
const checkPermission = require("../middleware/checkPermission");
const {
  getNotificationSnapshot,
  getCanonicalDiagnostics,
} = require("../services/calibrationCanonicalService");
const {
  sendWeeklyNotificationDigest,
  sendTestNotificationDigest,
} = require("../services/notificationDigestService");

const router = express.Router();

const requireAdminRole = (req, res, next) => {
  const role = req.user?.role;
  if (role !== "admin" && role !== "super_admin") {
    return res.status(403).json({ message: "Admin access required" });
  }
  return next();
};

const requireSuperAdminRole = (req, res, next) => {
  if (req.user?.role !== "super_admin") {
    return res.status(403).json({ message: "Super admin access required" });
  }
  return next();
};

router.get(
  "/notifications",
  auth,
  checkPermission(["calibrations.view"]),
  async (req, res) => {
    try {
      const data = await getNotificationSnapshot({
        forceRefresh: req.query.refresh === "true",
      });
      res.json(data);
    } catch (error) {
      console.error("Error building canonical notification snapshot:", error);
      res.status(500).json({ message: "Failed to build notification snapshot" });
    }
  },
);

router.post(
  "/notifications/digest/send",
  auth,
  requireAdminRole,
  async (req, res) => {
    try {
      const result = await sendWeeklyNotificationDigest({ forceRefresh: true });
      res.json({
        message: "Notification Centre digest send completed",
        ...result,
      });
    } catch (error) {
      console.error("Error sending notification digest:", error);
      res.status(500).json({ message: "Failed to send notification digest" });
    }
  },
);

router.post(
  "/notifications/digest/send-test",
  auth,
  requireSuperAdminRole,
  async (req, res) => {
    try {
      const result = await sendTestNotificationDigest({ forceRefresh: true });
      res.json({
        message: "Test Notification Centre digest sent",
        ...result,
      });
    } catch (error) {
      console.error("Error sending test notification digest:", error);
      res
        .status(500)
        .json({ message: "Failed to send test notification digest" });
    }
  },
);

router.get(
  "/diagnostics",
  auth,
  checkPermission(["calibrations.view"]),
  async (req, res) => {
    try {
      const diagnostics = await getCanonicalDiagnostics({
        forceRefresh: req.query.refresh === "true",
      });
      res.json(diagnostics);
    } catch (error) {
      console.error("Error building canonical diagnostics:", error);
      res.status(500).json({ message: "Failed to build diagnostics" });
    }
  },
);

module.exports = router;
