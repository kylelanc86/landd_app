const express = require("express");
const router = express.Router();
const AsbestosClearance = require("../models/AsbestosClearance");
const auth = require("../middleware/auth");
const checkPermission = require("../middleware/checkPermission");

// Get all asbestos clearances with filtering and pagination
router.get("/", auth, checkPermission("asbestos.view"), async (req, res) => {
  try {
    const { page = 1, limit = 10, status, projectId, sortBy = "createdAt", sortOrder = "desc" } = req.query;

    const filter = {};
    
    if (status) {
      if (status.includes(',')) {
        filter.status = { $in: status.split(',') };
      } else {
        filter.status = status;
      }
    }
    
    if (projectId) {
      filter.projectId = projectId;
    }

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === "desc" ? -1 : 1;

    const clearances = await AsbestosClearance.find(filter)
      .populate("projectId", "projectID name")
      .populate("createdBy", "firstName lastName")
      .populate("updatedBy", "firstName lastName")
      .sort(sortOptions)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    const count = await AsbestosClearance.countDocuments(filter);

    res.json({
      clearances,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      totalCount: count,
    });
  } catch (error) {
    console.error("Error fetching asbestos clearances:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Get asbestos clearance by ID
router.get("/:id", auth, checkPermission("asbestos.view"), async (req, res) => {
  try {
    const clearance = await AsbestosClearance.findById(req.params.id)
      .populate("projectId", "projectID name")
      .populate("createdBy", "firstName lastName")
      .populate("updatedBy", "firstName lastName");

    if (!clearance) {
      return res.status(404).json({ message: "Asbestos clearance not found" });
    }

    res.json(clearance);
  } catch (error) {
    console.error("Error fetching asbestos clearance:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Create new asbestos clearance
router.post("/", auth, checkPermission("asbestos.create"), async (req, res) => {
  try {
    const { projectId, clearanceDate, status, clearanceType, LAA, asbestosRemovalist, notes } = req.body;

    const clearance = new AsbestosClearance({
      projectId,
      clearanceDate,
      status: status || "in progress",
      clearanceType,
      LAA,
      asbestosRemovalist,
      notes,
      createdBy: req.user.id,
    });

    const savedClearance = await clearance.save();
    
    const populatedClearance = await AsbestosClearance.findById(savedClearance._id)
      .populate("projectId", "projectID name")
      .populate("createdBy", "firstName lastName");

    res.status(201).json(populatedClearance);
  } catch (error) {
    console.error("Error creating asbestos clearance:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Update asbestos clearance
router.put("/:id", auth, checkPermission("asbestos.edit"), async (req, res) => {
  try {
    const { projectId, clearanceDate, status, clearanceType, LAA, asbestosRemovalist, notes } = req.body;

    const clearance = await AsbestosClearance.findById(req.params.id);
    if (!clearance) {
      return res.status(404).json({ message: "Asbestos clearance not found" });
    }

    clearance.projectId = projectId || clearance.projectId;
    clearance.clearanceDate = clearanceDate || clearance.clearanceDate;
    clearance.status = status || clearance.status;
    clearance.clearanceType = clearanceType || clearance.clearanceType;
    clearance.LAA = LAA || clearance.LAA;
    clearance.asbestosRemovalist = asbestosRemovalist || clearance.asbestosRemovalist;
    clearance.notes = notes || clearance.notes;
    clearance.updatedBy = req.user.id;

    const updatedClearance = await clearance.save();
    
    const populatedClearance = await AsbestosClearance.findById(updatedClearance._id)
      .populate("projectId", "projectID name")
      .populate("createdBy", "firstName lastName")
      .populate("updatedBy", "firstName lastName");

    res.json(populatedClearance);
  } catch (error) {
    console.error("Error updating asbestos clearance:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Delete asbestos clearance
router.delete("/:id", auth, checkPermission("asbestos.delete"), async (req, res) => {
  try {
    const clearance = await AsbestosClearance.findByIdAndDelete(req.params.id);
    if (!clearance) {
      return res.status(404).json({ message: "Asbestos clearance not found" });
    }

    res.json({ message: "Asbestos clearance deleted successfully" });
  } catch (error) {
    console.error("Error deleting asbestos clearance:", error);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router; 