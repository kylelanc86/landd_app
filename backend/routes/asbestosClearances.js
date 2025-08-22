const express = require("express");
const router = express.Router();
const AsbestosClearance = require("../models/clearanceTemplates/asbestos/AsbestosClearance");
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
      .populate({
        path: "projectId",
        select: "projectID name client",
        populate: {
          path: "client",
          select: "name"
        }
      })
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
      .populate({
        path: "projectId",
        select: "projectID name client",
        populate: {
          path: "client",
          select: "name"
        }
      })
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
    const { projectId, clearanceDate, inspectionTime, status, clearanceType, LAA, asbestosRemovalist, airMonitoring, airMonitoringReport, sitePlan, sitePlanFile, jobSpecificExclusions, notes } = req.body;

    const clearance = new AsbestosClearance({
      projectId,
      clearanceDate,
      inspectionTime,
      status: status || "in progress",
      clearanceType,
      LAA,
      asbestosRemovalist,
      airMonitoring: airMonitoring || false,
      airMonitoringReport: airMonitoringReport || null,
      sitePlan: sitePlan || false,
      sitePlanFile: sitePlanFile || null,
      jobSpecificExclusions: jobSpecificExclusions || null,
      notes,
      createdBy: req.user.id,
    });

    const savedClearance = await clearance.save();
    
    const populatedClearance = await AsbestosClearance.findById(savedClearance._id)
      .populate({
        path: "projectId",
        select: "projectID name client",
        populate: {
          path: "client",
          select: "name"
        }
      })
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
    const { projectId, clearanceDate, inspectionTime, status, clearanceType, LAA, asbestosRemovalist, airMonitoring, airMonitoringReport, sitePlan, sitePlanFile, jobSpecificExclusions, notes } = req.body;

    const clearance = await AsbestosClearance.findById(req.params.id);
    if (!clearance) {
      return res.status(404).json({ message: "Asbestos clearance not found" });
    }

    clearance.projectId = projectId || clearance.projectId;
    clearance.clearanceDate = clearanceDate || clearance.clearanceDate;
    clearance.inspectionTime = inspectionTime || clearance.inspectionTime;
    clearance.status = status || clearance.status;
    clearance.clearanceType = clearanceType || clearance.clearanceType;
    clearance.LAA = LAA || clearance.LAA;
    clearance.asbestosRemovalist = asbestosRemovalist || clearance.asbestosRemovalist;
    clearance.airMonitoring = airMonitoring !== undefined ? airMonitoring : clearance.airMonitoring;
    clearance.airMonitoringReport = airMonitoringReport !== undefined ? airMonitoringReport : clearance.airMonitoringReport;
    clearance.sitePlan = sitePlan !== undefined ? sitePlan : clearance.sitePlan;
    clearance.sitePlanFile = sitePlanFile !== undefined ? sitePlanFile : clearance.sitePlanFile;
    clearance.jobSpecificExclusions = jobSpecificExclusions !== undefined ? jobSpecificExclusions : clearance.jobSpecificExclusions;
    clearance.notes = notes || clearance.notes;
    clearance.updatedBy = req.user.id;

    const updatedClearance = await clearance.save();
    
    const populatedClearance = await AsbestosClearance.findById(updatedClearance._id)
      .populate({
        path: "projectId",
        select: "projectID name client",
        populate: {
          path: "client",
          select: "name"
        }
      })
      .populate("createdBy", "firstName lastName")
      .populate("updatedBy", "firstName lastName");

    res.json(populatedClearance);
  } catch (error) {
    console.error("Error updating asbestos clearance:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Update clearance status
router.patch("/:id/status", auth, checkPermission("asbestos.edit"), async (req, res) => {
  try {
    const { status } = req.body;

    const clearance = await AsbestosClearance.findById(req.params.id);
    if (!clearance) {
      return res.status(404).json({ message: "Asbestos clearance not found" });
    }

    clearance.status = status;
    clearance.updatedBy = req.user.id;

    const updatedClearance = await clearance.save();
    
    const populatedClearance = await AsbestosClearance.findById(updatedClearance._id)
      .populate({
        path: "projectId",
        select: "projectID name client",
        populate: {
          path: "client",
          select: "name"
        }
      })
      .populate("createdBy", "firstName lastName")
      .populate("updatedBy", "firstName lastName");

    res.json(populatedClearance);
  } catch (error) {
    console.error("Error updating asbestos clearance status:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Upload air monitoring report
router.post("/:id/air-monitoring-report", auth, checkPermission("asbestos.edit"), async (req, res) => {
  try {
    const { reportData } = req.body; // Expecting base64 data

    const clearance = await AsbestosClearance.findById(req.params.id);
    if (!clearance) {
      return res.status(404).json({ message: "Asbestos clearance not found" });
    }

    // Validate that air monitoring is enabled
    if (!clearance.airMonitoring) {
      return res.status(400).json({ message: "Air monitoring must be enabled to upload a report" });
    }

    clearance.airMonitoringReport = reportData;
    clearance.updatedBy = req.user.id;

    const updatedClearance = await clearance.save();
    
    const populatedClearance = await AsbestosClearance.findById(updatedClearance._id)
      .populate({
        path: "projectId",
        select: "projectID name client",
        populate: {
          path: "client",
          select: "name"
        }
      })
      .populate("createdBy", "firstName lastName")
      .populate("updatedBy", "firstName lastName");

    res.json(populatedClearance);
  } catch (error) {
    console.error("Error uploading air monitoring report:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Get air monitoring reports for a project
router.get("/air-monitoring-reports/:projectId", auth, async (req, res) => {
  try {
    const { projectId } = req.params;
    
    // Get all jobs for this project
    const Job = require('../models/Job');
    const Shift = require('../models/Shift');
    
    const jobs = await Job.find({ projectId: projectId }).populate('projectId', 'name projectID');
    
    const airMonitoringReports = [];
    
    // Get shifts for each job
    for (const job of jobs) {
      const shifts = await Shift.find({ 
        job: job._id,
        $or: [
          { status: "analysis_complete" },
          { status: "shift_complete" },
          { reportApprovedBy: { $exists: true, $ne: null } }
        ]
      }).populate('job', 'name');
      
      shifts.forEach(shift => {
        airMonitoringReports.push({
          _id: shift._id,
          name: shift.name,
          date: shift.date,
          status: shift.status,
          reportApprovedBy: shift.reportApprovedBy,
          reportIssueDate: shift.reportIssueDate,
          jobName: job.name,
          jobId: job._id,
          projectName: job.projectId?.name,
          projectId: job.projectId?._id
        });
      });
    }
    
    // Sort by date (newest first)
    airMonitoringReports.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    res.json(airMonitoringReports);
  } catch (error) {
    console.error("Error fetching air monitoring reports:", error);
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

// Get clearance items
router.get("/:id/items", auth, checkPermission("asbestos.view"), async (req, res) => {
  try {
    const clearance = await AsbestosClearance.findById(req.params.id);
    if (!clearance) {
      return res.status(404).json({ message: "Asbestos clearance not found" });
    }

    res.json(clearance.items || []);
  } catch (error) {
    console.error("Error fetching clearance items:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Add clearance item
router.post("/:id/items", auth, checkPermission("asbestos.edit"), async (req, res) => {
  try {
    const { locationDescription, levelFloor, roomArea, materialDescription, asbestosType, photograph, notes } = req.body;

    const clearance = await AsbestosClearance.findById(req.params.id);
    if (!clearance) {
      return res.status(404).json({ message: "Asbestos clearance not found" });
    }

    const newItem = {
      locationDescription,
      levelFloor,
      roomArea,
      materialDescription,
      asbestosType,
      photograph,
      notes,
    };

    clearance.items.push(newItem);
    clearance.updatedBy = req.user.id;

    const updatedClearance = await clearance.save();
    
    const populatedClearance = await AsbestosClearance.findById(updatedClearance._id)
      .populate({
        path: "projectId",
        select: "projectID name client",
        populate: {
          path: "client",
          select: "name"
        }
      })
      .populate("createdBy", "firstName lastName")
      .populate("updatedBy", "firstName lastName");

    res.status(201).json(populatedClearance);
  } catch (error) {
    console.error("Error adding clearance item:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Update clearance item
router.put("/:id/items/:itemId", auth, checkPermission("asbestos.edit"), async (req, res) => {
  try {
    const { locationDescription, levelFloor, roomArea, materialDescription, asbestosType, photograph, notes } = req.body;

    const clearance = await AsbestosClearance.findById(req.params.id);
    if (!clearance) {
      return res.status(404).json({ message: "Asbestos clearance not found" });
    }

    const itemIndex = clearance.items.findIndex(item => item._id.toString() === req.params.itemId);
    if (itemIndex === -1) {
      return res.status(404).json({ message: "Clearance item not found" });
    }

    clearance.items[itemIndex] = {
      ...clearance.items[itemIndex],
      locationDescription,
      levelFloor,
      roomArea,
      materialDescription,
      asbestosType,
      photograph,
      notes,
    };

    clearance.updatedBy = req.user.id;

    const updatedClearance = await clearance.save();
    
    const populatedClearance = await AsbestosClearance.findById(updatedClearance._id)
      .populate({
        path: "projectId",
        select: "projectID name client",
        populate: {
          path: "client",
          select: "name"
        }
      })
      .populate("createdBy", "firstName lastName")
      .populate("updatedBy", "firstName lastName");

    res.json(populatedClearance);
  } catch (error) {
    console.error("Error updating clearance item:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Delete clearance item
router.delete("/:id/items/:itemId", auth, checkPermission("asbestos.edit"), async (req, res) => {
  try {
    const clearance = await AsbestosClearance.findById(req.params.id);
    if (!clearance) {
      return res.status(404).json({ message: "Asbestos clearance not found" });
    }

    const itemIndex = clearance.items.findIndex(item => item._id.toString() === req.params.itemId);
    if (itemIndex === -1) {
      return res.status(404).json({ message: "Clearance item not found" });
    }

    clearance.items.splice(itemIndex, 1);
    clearance.updatedBy = req.user.id;

    const updatedClearance = await clearance.save();
    
    const populatedClearance = await AsbestosClearance.findById(updatedClearance._id)
      .populate({
        path: "projectId",
        select: "projectID name client",
        populate: {
          path: "client",
          select: "name"
        }
      })
      .populate("createdBy", "firstName lastName")
      .populate("updatedBy", "firstName lastName");

    res.json(populatedClearance);
  } catch (error) {
    console.error("Error deleting clearance item:", error);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router; 