const express = require("express");
const router = express.Router();
const AsbestosRemovalJob = require("../models/AsbestosRemovalJob");
const Project = require("../models/Project");
const auth = require("../middleware/auth");
const checkPermission = require("../middleware/checkPermission");

// Get all asbestos removal jobs with filtering and pagination
router.get("/", auth, checkPermission("asbestos.view"), async (req, res) => {
  try {
    const { page = 1, limit = 1000, status, excludeStatus, projectId, sortBy = "createdAt", sortOrder = "desc" } = req.query;

    const filter = {};
    
    // Support excluding statuses (e.g., excludeStatus=completed,cancelled)
    // This takes precedence if both status and excludeStatus are provided
    if (excludeStatus) {
      const excludedStatuses = excludeStatus.includes(',') 
        ? excludeStatus.split(',').map(s => s.trim())
        : [excludeStatus];
      filter.status = { $nin: excludedStatuses };
    } else if (status) {
      // Support single status or comma-separated statuses
      if (status.includes(',')) {
        filter.status = { $in: status.split(',').map(s => s.trim()) };
      } else {
        filter.status = status;
      }
    }
    
    if (projectId) {
      filter.projectId = projectId;
    }

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === "desc" ? -1 : 1;

    const jobs = await AsbestosRemovalJob.find(filter)
      .populate({
        path: "projectId",
        select: "projectID name client",
        populate: {
          path: "client",
          select: "name contact1Name contact1Email invoiceEmail contact2Email"
        }
      })
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
      .populate({
        path: "projectId",
        select: "projectID name client",
        populate: {
          path: "client",
          select: "name contact1Name contact1Email invoiceEmail contact2Email"
        }
      })
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
    
    // Update the project's reports_present field to true
    if (savedJob.projectId) {
      try {
        const projectId = savedJob.projectId._id || savedJob.projectId;
        await Project.findByIdAndUpdate(
          projectId,
          { reports_present: true }
        );
        console.log(`Updated project ${projectId} reports_present to true due to asbestos removal job creation`);
      } catch (error) {
        console.error("Error updating project reports_present field:", error);
        // Don't fail the main request if project update fails
      }
    }
    
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

    const previousStatus = job.status;

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

    // If job status is being updated to "completed", also update associated shifts
    if (status === "completed" && previousStatus !== "completed") {
      try {
        const Shift = require('../models/Shift');
        
        // Update all shifts associated with this job to "complete" status
        const shiftUpdateResult = await Shift.updateMany(
          { job: job._id },
          { 
            status: "complete",
            updatedBy: req.user.id
          }
        );
        
        console.log(`Updated ${shiftUpdateResult.modifiedCount} shifts to complete status for job ${job._id}`);
      } catch (shiftError) {
        console.error("Error updating shifts when completing asbestos removal job:", shiftError);
        // Don't fail the main request if shift update fails
      }
    }
    
    const populatedJob = await AsbestosRemovalJob.findById(updatedJob._id)
      .populate({
        path: "projectId",
        select: "projectID name client",
        populate: {
          path: "client",
          select: "name contact1Name contact1Email invoiceEmail contact2Email"
        }
      })
      .populate("createdBy", "firstName lastName")
      .populate("updatedBy", "firstName lastName");

    res.json(populatedJob);
  } catch (error) {
    console.error("Error updating asbestos removal job:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Update asbestos removal job status
router.patch("/:id/status", auth, checkPermission("asbestos.edit"), async (req, res) => {
  try {
    const { status } = req.body;

    const job = await AsbestosRemovalJob.findById(req.params.id);
    if (!job) {
      return res.status(404).json({ message: "Asbestos removal job not found" });
    }

    const previousStatus = job.status;
    job.status = status;
    job.updatedBy = req.user.id;

    const updatedJob = await job.save();

    // If job status is being updated to "completed", also update associated shifts
    if (status === "completed" && previousStatus !== "completed") {
      try {
        const Shift = require('../models/Shift');
        
        // Update all shifts associated with this job to "complete" status
        const shiftUpdateResult = await Shift.updateMany(
          { job: job._id },
          { 
            status: "complete",
            updatedBy: req.user.id
          }
        );
        
        console.log(`Updated ${shiftUpdateResult.modifiedCount} shifts to complete status for job ${job._id}`);
      } catch (shiftError) {
        console.error("Error updating shifts when completing asbestos removal job:", shiftError);
        // Don't fail the main request if shift update fails
      }
    }
    
    const populatedJob = await AsbestosRemovalJob.findById(updatedJob._id)
      .populate({
        path: "projectId",
        select: "projectID name client",
        populate: {
          path: "client",
          select: "name contact1Name contact1Email invoiceEmail contact2Email"
        }
      })
      .populate("createdBy", "firstName lastName")
      .populate("updatedBy", "firstName lastName");

    res.json(populatedJob);
  } catch (error) {
    console.error("Error updating asbestos removal job status:", error);
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