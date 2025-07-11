const express = require("express");
const router = express.Router();
const AsbestosClearanceItems = require("../models/clearanceTemplates/asbestos/AsbestosClearanceItems");
const Project = require("../models/Project");
const auth = require("../middleware/auth");
const checkPermission = require("../middleware/checkPermission");

// Get all clearance reports with filtering and pagination
router.get("/", auth, checkPermission("asbestos.view"), async (req, res) => {
  try {
    const { page = 1, limit = 10, clearanceId, projectId, sortBy = "createdAt", sortOrder = "desc" } = req.query;

    const filter = {};
    
    if (clearanceId) {
      filter.clearanceId = clearanceId;
    }

    // If projectId is provided, we need to filter through the clearance relationship
    if (projectId) {
      // First get all clearances for this project
      const AsbestosClearance = require("../models/clearanceTemplates/asbestos/AsbestosClearance");
      const clearances = await AsbestosClearance.find({ projectId: projectId }).select('_id');
      const clearanceIds = clearances.map(c => c._id);
      
      // Then filter reports by those clearance IDs
      filter.clearanceId = { $in: clearanceIds };
    }

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === "desc" ? -1 : 1;

    const reports = await AsbestosClearanceItems.find(filter)
      .populate("clearanceId", "projectId clearanceDate status")
      .populate("createdBy", "firstName lastName")
      .populate("updatedBy", "firstName lastName")
      .sort(sortOptions)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    const count = await AsbestosClearanceItems.countDocuments(filter);

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
    const reports = await AsbestosClearanceItems.find({ clearanceId: req.params.clearanceId })
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
    const report = await AsbestosClearanceItems.findById(req.params.id)
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
    const { clearanceId, locationDescription, materialDescription, asbestosType, photograph, notes } = req.body;

    const report = new AsbestosClearanceItems({
      clearanceId,
      locationDescription,
      materialDescription,
      asbestosType,
      photograph,
      notes,
      createdBy: req.user.id,
    });

    const savedReport = await report.save();
    
    // Update the project's reports_present field to true
    if (savedReport.clearanceId) {
      try {
        const clearance = await savedReport.populate("clearanceId");
        if (clearance.clearanceId && clearance.clearanceId.projectId) {
          await Project.findByIdAndUpdate(
            clearance.clearanceId.projectId,
            { reports_present: true }
          );
          console.log(`Updated project ${clearance.clearanceId.projectId} reports_present to true`);
        }
      } catch (error) {
        console.error("Error updating project reports_present field:", error);
      }
    }
    
    const populatedReport = await AsbestosClearanceItems.findById(savedReport._id)
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
    const { locationDescription, materialDescription, asbestosType, photograph, notes } = req.body;

    const report = await AsbestosClearanceItems.findById(req.params.id);
    if (!report) {
      return res.status(404).json({ message: "Clearance report not found" });
    }

    // Update fields, allowing empty strings for photograph to remove images
    if (locationDescription !== undefined) report.locationDescription = locationDescription;
    if (materialDescription !== undefined) report.materialDescription = materialDescription;
    if (asbestosType !== undefined) report.asbestosType = asbestosType;
    if (photograph !== undefined) report.photograph = photograph; // Allow empty string to remove image
    if (notes !== undefined) report.notes = notes;
    report.updatedBy = req.user.id;

    const updatedReport = await report.save();
    
    const populatedReport = await AsbestosClearanceItems.findById(updatedReport._id)
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
    const report = await AsbestosClearanceItems.findByIdAndDelete(req.params.id);
    if (!report) {
      return res.status(404).json({ message: "Clearance report not found" });
    }

    res.json({ message: "Clearance report deleted successfully" });
  } catch (error) {
    console.error("Error deleting clearance report:", error);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router; 