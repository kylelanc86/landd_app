const express = require("express");
const { performance } = require("perf_hooks");
const router = express.Router();
const AsbestosRemovalJob = require("../models/AsbestosRemovalJob");
const Project = require("../models/Project");
const AirMonitoringJob = require("../models/Job");
const Shift = require("../models/Shift");
const Sample = require("../models/Sample");
const AsbestosClearance = require("../models/clearanceTemplates/asbestos/AsbestosClearance");
const auth = require("../middleware/auth");
const checkPermission = require("../middleware/checkPermission");

// Get all asbestos removal jobs with filtering and pagination
router.get("/", auth, checkPermission("asbestos.view"), async (req, res) => {
  try {
    const routeStart = performance.now();
    const { page = 1, limit = 1000, status, excludeStatus, projectId, sortBy = "createdAt", sortOrder = "desc", minimal } = req.query;

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

    const metrics = {
      filter,
      sortBy,
      minimal: minimal === "true" || minimal === true,
      timings: {},
    };

    // If minimal=true, only fetch fields needed for table display
    if (minimal === "true" || minimal === true) {
      const queryStart = performance.now();
      const jobs = await AsbestosRemovalJob.find(filter)
        .select(
          "_id projectId projectName client asbestosRemovalist status airMonitoring clearance jobType"
        )
        .populate({
          path: "projectId",
          select: "projectID name",
        })
        .sort(sortOptions)
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .lean()
        .exec();
      metrics.timings.find = `${(performance.now() - queryStart).toFixed(2)}ms`;

      const countStart = performance.now();
      const count = await AsbestosRemovalJob.countDocuments(filter);
      metrics.timings.count = `${(performance.now() - countStart).toFixed(2)}ms`;

      metrics.timings.total = `${(performance.now() - routeStart).toFixed(
        2
      )}ms`;

      console.log("[AsbestosRemovalJobs] Minimal fetch metrics:", {
        ...metrics,
        count,
        resultSize: jobs.length,
      });

      return res.json({
        jobs,
        totalPages: Math.ceil(count / limit),
        currentPage: page,
        totalCount: count,
      });
    }

    // Full data for detailed views
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

    metrics.timings.total = `${(performance.now() - routeStart).toFixed(2)}ms`;
    console.log("[AsbestosRemovalJobs] Full fetch metrics:", {
      ...metrics,
      resultSize: jobs.length,
      count,
    });

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

// Get asbestos removal job with related data by ID
router.get(
  "/:id/details",
  auth,
  checkPermission("asbestos.view"),
  async (req, res) => {
    const routeStart = performance.now();
    try {
      // Only select fields needed for the details page
      const job = await AsbestosRemovalJob.findById(req.params.id)
        .select("_id projectId projectName asbestosRemovalist status createdAt updatedAt")
        .populate({
          path: "projectId",
          select: "projectID name client",
          populate: {
            path: "client",
            select: "name",
          },
        })
        .lean();

      if (!job) {
        return res
          .status(404)
          .json({ message: "Asbestos removal job not found" });
      }

      const projectId =
        job.projectId?._id?.toString() ||
        (typeof job.projectId === "string" ? job.projectId : null);

      const metrics = {
        timings: {},
        counts: {},
      };

      if (!projectId) {
        metrics.timings.total = `${(performance.now() - routeStart).toFixed(
          2
        )}ms`;
        console.log("[AsbestosRemovalJobs] Details fetch metrics:", metrics);
        return res.json({
          job,
          shifts: [],
          clearances: [],
          sampleNumbers: [],
        });
      }

      // Check if clearances should be excluded (for lazy loading optimization)
      const excludeClearances = req.query.excludeClearances === "true";

      // Fetch air monitoring jobs
      const jobsStart = performance.now();
      const airMonitoringJobs = await AirMonitoringJob.find({ projectId })
        .select("_id name")
        .lean();
      metrics.timings.projectJobs = `${(
        performance.now() - jobsStart
      ).toFixed(2)}ms`;
      metrics.counts.projectJobs = airMonitoringJobs.length;

      // Only fetch clearances if not excluded (for lazy loading)
      let clearances = [];
      if (!excludeClearances) {
        const clearancesStart = performance.now();
        // Fetch clearances - fields needed for table and edit form, but exclude large fields
        clearances = await AsbestosClearance.find({ projectId })
          .select("_id projectId clearanceDate clearanceType status inspectionTime asbestosRemovalist jurisdiction secondaryHeader vehicleEquipmentDescription notes useComplexTemplate jobSpecificExclusions")
          .populate({
            path: "projectId",
            select: "projectID name",
          })
          .lean();
        metrics.timings.clearances = `${(
          performance.now() - clearancesStart
        ).toFixed(2)}ms`;
        metrics.counts.clearances = clearances.length;
      } else {
        metrics.timings.clearances = "0.00ms (excluded)";
        metrics.counts.clearances = 0;
      }

      const jobNameMap = new Map();
      jobNameMap.set(job._id.toString(), job.projectName || "Asbestos Removal Job");
      airMonitoringJobs.forEach((monitoringJob) => {
        if (monitoringJob?._id) {
          jobNameMap.set(
            monitoringJob._id.toString(),
            monitoringJob.name || "Air Monitoring Job"
          );
        }
      });

      const shiftJobIds = Array.from(jobNameMap.keys());

      const shiftsStart = performance.now();
      // Only select fields needed for list view - no need to populate supervisor/sampler for table display
      const shiftDocs = shiftJobIds.length
        ? await Shift.find({ job: { $in: shiftJobIds } })
            .select("_id job date status jobModel reportApprovedBy reportIssueDate")
            .lean()
        : [];
      metrics.timings.shifts = `${(
        performance.now() - shiftsStart
      ).toFixed(2)}ms`;
      metrics.counts.shifts = shiftDocs.length;

      const decoratedShifts = shiftDocs.map((shift) => {
        const jobKey = shift.job?.toString();
        return {
          ...shift,
          jobId: jobKey,
          jobName:
            (jobKey && jobNameMap.get(jobKey)) ||
            job.projectName ||
            "Asbestos Removal Job",
        };
      });

      const shiftIds = decoratedShifts.map((shift) => shift._id);

      const samplesStart = performance.now();
      const sampleDocs = shiftIds.length
        ? await Sample.find({ shift: { $in: shiftIds } })
            .select("shift fullSampleID")
            .lean()
        : [];
      metrics.timings.samples = `${(
        performance.now() - samplesStart
      ).toFixed(2)}ms`;
      metrics.counts.samples = sampleDocs.length;

      const sampleMap = new Map();
      sampleDocs.forEach((sample) => {
        const shiftKey = sample.shift?.toString();
        if (!shiftKey) return;

        const match = sample.fullSampleID?.match(/AM(\d+)$/);
        if (!match) return;

        if (!sampleMap.has(shiftKey)) {
          sampleMap.set(shiftKey, []);
        }
        sampleMap.get(shiftKey).push(match[1]);
      });

      const sampleNumbers = Array.from(sampleMap.entries()).map(
        ([shiftId, numbers]) => ({
          shiftId,
          sampleNumbers: numbers
            .map((value) => parseInt(value, 10))
            .filter((n) => !Number.isNaN(n))
            .sort((a, b) => a - b)
            .map((value) => value.toString()),
        })
      );

      metrics.timings.total = `${(performance.now() - routeStart).toFixed(
        2
      )}ms`;

      console.log("[AsbestosRemovalJobs] Details fetch metrics:", {
        jobId: job._id,
        ...metrics,
      });

      res.json({
        job,
        shifts: decoratedShifts,
        clearances,
        sampleNumbers,
      });
    } catch (error) {
      console.error("Error fetching asbestos removal job details:", error);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// Get clearances for an asbestos removal job (lazy loading endpoint)
router.get(
  "/:id/clearances",
  auth,
  checkPermission("asbestos.view"),
  async (req, res) => {
    const routeStart = performance.now();
    try {
      const job = await AsbestosRemovalJob.findById(req.params.id)
        .select("projectId")
        .lean();

      if (!job) {
        return res.status(404).json({ message: "Asbestos removal job not found" });
      }

      const projectId =
        job.projectId?._id?.toString() ||
        (typeof job.projectId === "string" ? job.projectId : null);

      if (!projectId) {
        return res.json({ clearances: [] });
      }

      const clearancesStart = performance.now();
      // Fetch clearances - fields needed for table and edit form, but exclude large fields
      const clearances = await AsbestosClearance.find({ projectId })
        .select("_id projectId clearanceDate clearanceType status inspectionTime asbestosRemovalist jurisdiction secondaryHeader vehicleEquipmentDescription notes useComplexTemplate jobSpecificExclusions reportApprovedBy reportIssueDate")
        .populate({
          path: "projectId",
          select: "projectID name",
        })
        .lean();
      
      const queryTime = performance.now() - clearancesStart;
      console.log(`[AsbestosRemovalJobs] Fetched ${clearances.length} clearances in ${queryTime.toFixed(2)}ms`);

      res.json({ clearances });
    } catch (error) {
      console.error("Error fetching clearances:", error);
      res.status(500).json({ message: "Server error" });
    }
  }
);

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

    // If status is being set to "completed", validate that all shifts and clearances are authorised
    if (status === "completed" && previousStatus !== "completed") {
      const Shift = require('../models/Shift');
      const AsbestosClearance = require('../models/clearanceTemplates/asbestos/AsbestosClearance');
      
      // Check all shifts for this job are complete AND authorised
      const shifts = await Shift.find({ 
        job: job._id,
        $or: [
          { jobModel: { $exists: false } },
          { jobModel: null },
          { jobModel: "AsbestosRemovalJob" },
        ]
      }).select("status reportApprovedBy").lean();
      
      if (shifts.length > 0) {
        const unauthorisedShifts = shifts.filter(
          (shift) => shift.status !== "shift_complete" || !shift.reportApprovedBy
        );
        
        if (unauthorisedShifts.length > 0) {
          return res.status(400).json({
            message: `Cannot complete job: ${unauthorisedShifts.length} shift(s) are not complete or not authorised. All shifts must be complete and authorised before completing the job.`
          });
        }
      }
      
      // Check all clearances for this project are complete AND authorised
      const projectIdToCheck = job.projectId?._id?.toString() || job.projectId?.toString() || job.projectId;
      if (projectIdToCheck) {
        const clearances = await AsbestosClearance.find({ projectId: projectIdToCheck })
          .select("status reportApprovedBy").lean();
        
        if (clearances.length > 0) {
          const unauthorisedClearances = clearances.filter(
            (clearance) => clearance.status !== "complete" || !clearance.reportApprovedBy
          );
          
          if (unauthorisedClearances.length > 0) {
            return res.status(400).json({
              message: `Cannot complete job: ${unauthorisedClearances.length} clearance(s) are not complete or not authorised. All clearances must be complete and authorised before completing the job.`
            });
          }
        }
      }
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
    
    // If status is being set to "completed", validate that all shifts and clearances are authorised
    if (status === "completed" && previousStatus !== "completed") {
      const Shift = require('../models/Shift');
      const AsbestosClearance = require('../models/clearanceTemplates/asbestos/AsbestosClearance');
      
      // Check all shifts for this job are complete AND authorised
      const shifts = await Shift.find({ 
        job: job._id,
        $or: [
          { jobModel: { $exists: false } },
          { jobModel: null },
          { jobModel: "AsbestosRemovalJob" },
        ]
      }).select("status reportApprovedBy").lean();
      
      if (shifts.length > 0) {
        const unauthorisedShifts = shifts.filter(
          (shift) => shift.status !== "shift_complete" || !shift.reportApprovedBy
        );
        
        if (unauthorisedShifts.length > 0) {
          return res.status(400).json({
            message: `Cannot complete job: ${unauthorisedShifts.length} shift(s) are not complete or not authorised. All shifts must be complete and authorised before completing the job.`
          });
        }
      }
      
      // Check all clearances for this project are complete AND authorised
      const projectIdToCheck = job.projectId?._id?.toString() || job.projectId?.toString() || job.projectId;
      if (projectIdToCheck) {
        const clearances = await AsbestosClearance.find({ projectId: projectIdToCheck })
          .select("status reportApprovedBy").lean();
        
        if (clearances.length > 0) {
          const unauthorisedClearances = clearances.filter(
            (clearance) => clearance.status !== "complete" || !clearance.reportApprovedBy
          );
          
          if (unauthorisedClearances.length > 0) {
            return res.status(400).json({
              message: `Cannot complete job: ${unauthorisedClearances.length} clearance(s) are not complete or not authorised. All clearances must be complete and authorised before completing the job.`
            });
          }
        }
      }
    }
    
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