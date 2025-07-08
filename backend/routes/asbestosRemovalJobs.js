const express = require("express");
const router = express.Router();
const AsbestosRemovalJob = require("../models/AsbestosRemovalJob");
const auth = require("../middleware/auth");
const checkPermission = require("../middleware/checkPermission");

// Get all asbestos removal jobs with filtering and pagination
router.get("/", auth, checkPermission("asbestos.view"), async (req, res) => {
  try {
    const { page = 1, limit = 10, status, projectId, sortBy = "createdAt", sortOrder = "desc" } = req.query;

    const filter = {};
    
    if (status) {
      filter.status = status;
    }
    
    if (projectId) {
      filter.projectId = projectId;
    }

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === "desc" ? -1 : 1;

    const jobs = await AsbestosRemovalJob.find(filter)
      .populate("projectId", "projectID name client")
      .populate("createdBy", "firstName lastName")
      .populate("updatedBy", "firstName lastName")
      .sort(sortOptions)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    const count = await AsbestosRemovalJob.countDocuments(filter);

    res.json({
      jobs,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      totalCount: count,
    });
  } catch (error) {
    console.error("Error fetching asbestos removal jobs:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Get asbestos removal job by ID
router.get("/:id", auth, checkPermission("asbestos.view"), async (req, res) => {
  try {
    const job = await AsbestosRemovalJob.findById(req.params.id)
      .populate("projectId", "projectID name client")
      .populate("createdBy", "firstName lastName")
      .populate("updatedBy", "firstName lastName");

    if (!job) {
      return res.status(404).json({ message: "Asbestos removal job not found" });
    }

    res.json(job);
  } catch (error) {
    console.error("Error fetching asbestos removal job:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Create new asbestos removal job
router.post("/", auth, checkPermission("asbestos.create"), async (req, res) => {
  try {
    const { projectId, projectName, client, asbestosRemovalist, airMonitoring, clearance } = req.body;

    const job = new AsbestosRemovalJob({
      projectId,
      projectName,
      client,
      asbestosRemovalist,
      airMonitoring,
      clearance,
      createdBy: req.user.id,
    });

    const savedJob = await job.save();
    
    const populatedJob = await AsbestosRemovalJob.findById(savedJob._id)
      .populate("projectId", "projectID name client")
      .populate("createdBy", "firstName lastName");

    res.status(201).json(populatedJob);
  } catch (error) {
    console.error("Error creating asbestos removal job:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Update asbestos removal job
router.put("/:id", auth, checkPermission("asbestos.edit"), async (req, res) => {
  try {
    const { projectId, projectName, client, asbestosRemovalist, airMonitoring, clearance, status } = req.body;

    const job = await AsbestosRemovalJob.findById(req.params.id);
    if (!job) {
      return res.status(404).json({ message: "Asbestos removal job not found" });
    }

    // Update fields
    if (projectId !== undefined) job.projectId = projectId;
    if (projectName !== undefined) job.projectName = projectName;
    if (client !== undefined) job.client = client;
    if (asbestosRemovalist !== undefined) job.asbestosRemovalist = asbestosRemovalist;
    if (airMonitoring !== undefined) job.airMonitoring = airMonitoring;
    if (clearance !== undefined) job.clearance = clearance;
    if (status !== undefined) job.status = status;
    job.updatedBy = req.user.id;

    const updatedJob = await job.save();
    
    const populatedJob = await AsbestosRemovalJob.findById(updatedJob._id)
      .populate("projectId", "projectID name client")
      .populate("createdBy", "firstName lastName")
      .populate("updatedBy", "firstName lastName");

    res.json(populatedJob);
  } catch (error) {
    console.error("Error updating asbestos removal job:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Delete asbestos removal job
router.delete("/:id", auth, checkPermission("asbestos.delete"), async (req, res) => {
  try {
    const job = await AsbestosRemovalJob.findByIdAndDelete(req.params.id);
    if (!job) {
      return res.status(404).json({ message: "Asbestos removal job not found" });
    }

    res.json({ message: "Asbestos removal job deleted successfully" });
  } catch (error) {
    console.error("Error deleting asbestos removal job:", error);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router; 