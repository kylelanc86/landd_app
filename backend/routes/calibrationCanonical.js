const express = require("express");
const auth = require("../middleware/auth");
const checkPermission = require("../middleware/checkPermission");
const {
  getNotificationSnapshot,
  getCanonicalDiagnostics,
} = require("../services/calibrationCanonicalService");

const router = express.Router();

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
