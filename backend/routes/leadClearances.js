const express = require("express");
const router = express.Router();
const LeadClearance = require("../models/clearanceTemplates/lead/LeadClearance");
const auth = require("../middleware/auth");
const checkPermission = require("../middleware/checkPermission");

// Use same permission names as asbestos for role consistency
const permView = "asbestos.view";
const permCreate = "asbestos.create";
const permEdit = "asbestos.edit";
const permDelete = "asbestos.delete";

// Get all lead clearances with filtering
router.get("/", auth, checkPermission(permView), async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      projectId,
      leadRemovalJobId,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    const filter = {};
    if (status) {
      filter.status = status.includes(",") ? { $in: status.split(",") } : status;
    }
    if (projectId) filter.projectId = projectId;
    if (leadRemovalJobId) filter.leadRemovalJobId = leadRemovalJobId;

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === "desc" ? -1 : 1;

    const clearances = await LeadClearance.find(filter)
      .populate({
        path: "projectId",
        select: "projectID name client",
        populate: { path: "client", select: "name" },
      })
      .populate("createdBy", "firstName lastName")
      .populate("updatedBy", "firstName lastName")
      .sort(sortOptions)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    const count = await LeadClearance.countDocuments(filter);
    res.json({
      clearances,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      totalCount: count,
    });
  } catch (error) {
    console.error("Error fetching lead clearances:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Get lead clearance by ID
router.get("/:id", auth, checkPermission(permView), async (req, res) => {
  try {
    const clearance = await LeadClearance.findById(req.params.id)
      .populate({
        path: "projectId",
        select: "projectID name client",
        populate: { path: "client", select: "name" },
      })
      .populate("createdBy", "firstName lastName")
      .populate("updatedBy", "firstName lastName")
      .populate("revisionReasons.revisedBy", "firstName lastName");

    if (!clearance) {
      return res.status(404).json({ message: "Lead clearance not found" });
    }
    res.json(clearance);
  } catch (error) {
    console.error("Error fetching lead clearance:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Create new lead clearance
router.post("/", auth, checkPermission(permCreate), async (req, res) => {
  try {
    const {
      projectId,
      leadRemovalJobId,
      clearanceDate,
      inspectionTime,
      status,
      clearanceType,
      jurisdiction,
      secondaryHeader,
      LAA,
      leadAbatementContractor,
      leadMonitoring,
      jobSpecificExclusions,
      notes,
      vehicleEquipmentDescription,
    } = req.body;

    let sequenceNumber = 1;
    if (clearanceDate && projectId && clearanceType) {
      try {
        const d = new Date(clearanceDate);
        const startOfDay = new Date(d);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(d);
        endOfDay.setHours(23, 59, 59, 999);
        const existing = await LeadClearance.find({
          projectId,
          clearanceType,
          clearanceDate: { $gte: startOfDay, $lte: endOfDay },
        })
          .select("sequenceNumber")
          .lean();
        if (existing.length > 0) {
          const max = existing.reduce(
            (m, c) => Math.max(m, c.sequenceNumber || 1),
            0
          );
          sequenceNumber = max + 1;
        }
      } catch (e) {
        console.error("Error calculating sequence number:", e);
      }
    }

    const clearance = new LeadClearance({
      projectId,
      ...(leadRemovalJobId && { leadRemovalJobId }),
      clearanceDate,
      inspectionTime,
      status: status || "in progress",
      clearanceType: clearanceType || "Lead Clearance",
      jurisdiction: jurisdiction || "ACT",
      secondaryHeader: secondaryHeader || "",
      LAA: LAA || "",
      leadAbatementContractor: leadAbatementContractor || "",
      leadMonitoring: leadMonitoring || false,
      jobSpecificExclusions: jobSpecificExclusions || null,
      notes: notes || null,
      vehicleEquipmentDescription: vehicleEquipmentDescription || null,
      sequenceNumber,
      createdBy: req.user.id,
    });

    const saved = await clearance.save();
    const populated = await LeadClearance.findById(saved._id)
      .populate({
        path: "projectId",
        select: "projectID name client",
        populate: { path: "client", select: "name" },
      })
      .populate("createdBy", "firstName lastName");

    res.status(201).json(populated);
  } catch (error) {
    console.error("Error creating lead clearance:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Update lead clearance
router.put("/:id", auth, checkPermission(permEdit), async (req, res) => {
  try {
    const {
      projectId,
      leadRemovalJobId,
      clearanceDate,
      inspectionTime,
      status,
      clearanceType,
      jurisdiction,
      secondaryHeader,
      LAA,
      leadAbatementContractor,
      leadMonitoring,
      leadMonitoringReports,
      jobSpecificExclusions,
      notes,
      revision,
      revisionReasons,
      vehicleEquipmentDescription,
    } = req.body;

    const clearance = await LeadClearance.findById(req.params.id);
    if (!clearance) {
      return res.status(404).json({ message: "Lead clearance not found" });
    }

    if (projectId !== undefined) clearance.projectId = projectId;
    if (leadRemovalJobId !== undefined)
      clearance.leadRemovalJobId = leadRemovalJobId || null;
    if (clearanceDate !== undefined) clearance.clearanceDate = clearanceDate;
    if (inspectionTime !== undefined)
      clearance.inspectionTime = inspectionTime;
    if (status !== undefined) clearance.status = status;
    if (clearanceType !== undefined) clearance.clearanceType = clearanceType;
    if (jurisdiction !== undefined) clearance.jurisdiction = jurisdiction;
    if (secondaryHeader !== undefined)
      clearance.secondaryHeader = secondaryHeader;
    if (LAA !== undefined) clearance.LAA = LAA;
    if (leadAbatementContractor !== undefined)
      clearance.leadAbatementContractor = leadAbatementContractor;
    if (leadMonitoring !== undefined) clearance.leadMonitoring = leadMonitoring;
    if (leadMonitoringReports !== undefined)
      clearance.leadMonitoringReports = leadMonitoringReports;
    if (jobSpecificExclusions !== undefined)
      clearance.jobSpecificExclusions = jobSpecificExclusions;
    if (notes !== undefined) clearance.notes = notes;
    if (revision !== undefined) clearance.revision = revision;
    if (revisionReasons !== undefined)
      clearance.revisionReasons = revisionReasons;
    if (vehicleEquipmentDescription !== undefined)
      clearance.vehicleEquipmentDescription = vehicleEquipmentDescription;
    clearance.updatedBy = req.user.id;

    const updated = await clearance.save();
    const populated = await LeadClearance.findById(updated._id)
      .populate({
        path: "projectId",
        select: "projectID name client",
        populate: { path: "client", select: "name" },
      })
      .populate("createdBy", "firstName lastName")
      .populate("updatedBy", "firstName lastName");

    res.json(populated);
  } catch (error) {
    console.error("Error updating lead clearance:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// PATCH - report viewed
router.patch("/:id", auth, checkPermission(permEdit), async (req, res) => {
  try {
    const { reportViewedAt } = req.body;
    if (reportViewedAt === undefined) {
      return res.status(400).json({ message: "reportViewedAt is required" });
    }
    const clearance = await LeadClearance.findByIdAndUpdate(
      req.params.id,
      { reportViewedAt: reportViewedAt ? new Date(reportViewedAt) : null },
      { new: true }
    );
    if (!clearance) {
      return res.status(404).json({ message: "Lead clearance not found" });
    }
    res.json(clearance);
  } catch (error) {
    console.error("Error updating lead clearance reportViewedAt:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// PATCH status
router.patch("/:id/status", auth, checkPermission(permEdit), async (req, res) => {
  try {
    const { status } = req.body;
    const clearance = await LeadClearance.findById(req.params.id);
    if (!clearance) {
      return res.status(404).json({ message: "Lead clearance not found" });
    }
    clearance.status = status;
    clearance.updatedBy = req.user.id;
    const updated = await clearance.save();
    const populated = await LeadClearance.findById(updated._id)
      .populate({
        path: "projectId",
        select: "projectID name client",
        populate: { path: "client", select: "name" },
      })
      .populate("createdBy", "firstName lastName")
      .populate("updatedBy", "firstName lastName");
    res.json(populated);
  } catch (error) {
    console.error("Error updating lead clearance status:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Delete lead clearance
router.delete("/:id", auth, checkPermission(permDelete), async (req, res) => {
  try {
    const clearance = await LeadClearance.findByIdAndDelete(req.params.id);
    if (!clearance) {
      return res.status(404).json({ message: "Lead clearance not found" });
    }
    res.json({ message: "Lead clearance deleted successfully" });
  } catch (error) {
    console.error("Error deleting lead clearance:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Authorise report (parity with asbestos)
router.post("/:id/authorise", auth, checkPermission(permEdit), async (req, res) => {
  try {
    const clearance = await LeadClearance.findById(req.params.id)
      .populate({
        path: "projectId",
        select: "projectID name client",
        populate: { path: "client", select: "name" },
      });
    if (!clearance) {
      return res.status(404).json({ message: "Lead clearance not found" });
    }
    if (clearance.status !== "complete") {
      return res.status(400).json({
        message: "Clearance must be complete before authorising the report",
      });
    }
    if (clearance.reportApprovedBy) {
      return res.status(400).json({
        message: "Report has already been authorised",
      });
    }
    const approver =
      req.user?.firstName && req.user?.lastName
        ? `${req.user.firstName} ${req.user.lastName}`
        : req.user?.email || "Unknown";
    clearance.reportApprovedBy = approver;
    clearance.reportIssueDate = new Date();
    clearance.updatedBy = req.user.id;
    const updated = await clearance.save();
    const populated = await LeadClearance.findById(updated._id)
      .populate({
        path: "projectId",
        select: "projectID name client",
        populate: { path: "client", select: "name" },
      })
      .populate("createdBy", "firstName lastName")
      .populate("updatedBy", "firstName lastName");
    res.json(populated);
  } catch (error) {
    console.error("Error authorising lead clearance:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Send for authorisation (parity with asbestos)
router.post("/:id/send-for-authorisation", auth, checkPermission(permEdit), async (req, res) => {
  try {
    const clearance = await LeadClearance.findById(req.params.id);
    if (!clearance) {
      return res.status(404).json({ message: "Lead clearance not found" });
    }
    if (clearance.status !== "complete") {
      return res.status(400).json({
        message: "Clearance must be complete before sending for authorisation",
      });
    }
    clearance.authorisationRequestedBy = req.user.id;
    clearance.authorisationRequestedByEmail = req.user?.email || null;
    clearance.updatedBy = req.user.id;
    const updated = await clearance.save();
    const populated = await LeadClearance.findById(updated._id)
      .populate({
        path: "projectId",
        select: "projectID name client",
        populate: { path: "client", select: "name" },
      })
      .populate("createdBy", "firstName lastName")
      .populate("updatedBy", "firstName lastName");
    res.json(populated);
  } catch (error) {
    console.error("Error sending lead clearance for authorisation:", error);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
