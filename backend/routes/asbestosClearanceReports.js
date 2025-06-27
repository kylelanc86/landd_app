const express = require("express");
const router = express.Router();
const AsbestosClearanceReport = require("../models/AsbestosClearanceReport");
const auth = require("../middleware/auth");
const checkPermission = require("../middleware/checkPermission");

// Get all clearance reports with filtering and pagination
router.get("/", auth, checkPermission("asbestos.view"), async (req, res) => {
  try {
    const { page = 1, limit = 10, clearanceId, sortBy = "createdAt", sortOrder = "desc" } = req.query;

    const filter = {};
    
    if (clearanceId) {
      filter.clearanceId = clearanceId;
    }

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === "desc" ? -1 : 1;

    const reports = await AsbestosClearanceReport.find(filter)
      .populate("clearanceId", "projectId clearanceDate status")
      .populate("createdBy", "firstName lastName")
      .populate("updatedBy", "firstName lastName")
      .sort(sortOptions)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    const count = await AsbestosClearanceReport.countDocuments(filter);

    res.json({
      reports,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      totalCount: count,
    });
  } catch (error) {
    console.error("Error fetching clearance reports:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Get clearance reports by clearance ID
router.get("/clearance/:clearanceId", auth, checkPermission("asbestos.view"), async (req, res) => {
  try {
    const reports = await AsbestosClearanceReport.find({ clearanceId: req.params.clearanceId })
      .populate("clearanceId", "projectId clearanceDate status")
      .populate("createdBy", "firstName lastName")
      .populate("updatedBy", "firstName lastName")
      .sort({ createdAt: -1 });

    res.json(reports);
  } catch (error) {
    console.error("Error fetching clearance reports:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Get clearance report by ID
router.get("/:id", auth, checkPermission("asbestos.view"), async (req, res) => {
  try {
    const report = await AsbestosClearanceReport.findById(req.params.id)
      .populate("clearanceId", "projectId clearanceDate status")
      .populate("createdBy", "firstName lastName")
      .populate("updatedBy", "firstName lastName");

    if (!report) {
      return res.status(404).json({ message: "Clearance report not found" });
    }

    res.json(report);
  } catch (error) {
    console.error("Error fetching clearance report:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Create new clearance report
router.post("/", auth, checkPermission("asbestos.create"), async (req, res) => {
  try {
    const { clearanceId, locationDescription, materialDescription, photograph, notes } = req.body;

    const report = new AsbestosClearanceReport({
      clearanceId,
      locationDescription,
      materialDescription,
      photograph,
      notes,
      createdBy: req.user.id,
    });

    const savedReport = await report.save();
    
    const populatedReport = await AsbestosClearanceReport.findById(savedReport._id)
      .populate("clearanceId", "projectId clearanceDate status")
      .populate("createdBy", "firstName lastName");

    res.status(201).json(populatedReport);
  } catch (error) {
    console.error("Error creating clearance report:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Update clearance report
router.put("/:id", auth, checkPermission("asbestos.edit"), async (req, res) => {
  try {
    const { locationDescription, materialDescription, photograph, notes } = req.body;

    const report = await AsbestosClearanceReport.findById(req.params.id);
    if (!report) {
      return res.status(404).json({ message: "Clearance report not found" });
    }

    report.locationDescription = locationDescription || report.locationDescription;
    report.materialDescription = materialDescription || report.materialDescription;
    report.photograph = photograph || report.photograph;
    report.notes = notes || report.notes;
    report.updatedBy = req.user.id;

    const updatedReport = await report.save();
    
    const populatedReport = await AsbestosClearanceReport.findById(updatedReport._id)
      .populate("clearanceId", "projectId clearanceDate status")
      .populate("createdBy", "firstName lastName")
      .populate("updatedBy", "firstName lastName");

    res.json(populatedReport);
  } catch (error) {
    console.error("Error updating clearance report:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Delete clearance report
router.delete("/:id", auth, checkPermission("asbestos.delete"), async (req, res) => {
  try {
    const report = await AsbestosClearanceReport.findById(req.params.id);
    if (!report) {
      return res.status(404).json({ message: "Clearance report not found" });
    }

    await report.remove();
    res.json({ message: "Clearance report deleted successfully" });
  } catch (error) {
    console.error("Error deleting clearance report:", error);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router; 