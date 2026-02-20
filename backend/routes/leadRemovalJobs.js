const express = require("express");
const router = express.Router();
const LeadRemovalJob = require("../models/LeadRemovalJob");
const LeadClearance = require("../models/clearanceTemplates/lead/LeadClearance");
const Project = require("../models/Project");
const Shift = require("../models/Shift");
const LeadAirSample = require("../models/LeadAirSample");
const auth = require("../middleware/auth");
const checkPermission = require("../middleware/checkPermission");

// Use asbestos permissions for lead removal (same role access)
const permView = "asbestos.view";
const permCreate = "asbestos.create";
const permEdit = "asbestos.edit";
const permDelete = "asbestos.delete";

// Get all lead removal jobs with filtering and pagination
router.get("/", auth, checkPermission(permView), async (req, res) => {
  try {
    const {
      page = 1,
      limit = 1000,
      status,
      excludeStatus,
      projectId,
      sortBy = "createdAt",
      sortOrder = "desc",
      minimal,
    } = req.query;

    const filter = {};

    if (excludeStatus) {
      const excludedStatuses = excludeStatus.includes(",")
        ? excludeStatus.split(",").map((s) => s.trim())
        : [excludeStatus];
      filter.status = { $nin: excludedStatuses };
    } else if (status) {
      if (status.includes(",")) {
        filter.status = { $in: status.split(",").map((s) => s.trim()) };
      } else {
        filter.status = status;
      }
    }

    if (projectId) {
      filter.projectId = projectId;
    }

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === "desc" ? -1 : 1;

    const isMinimal = minimal === "true" || minimal === true;

    if (isMinimal) {
      const jobs = await LeadRemovalJob.find(filter)
        .select("_id projectId projectName client leadAbatementContractor status")
        .populate({
          path: "projectId",
          select: "projectID name",
        })
        .sort(sortOptions)
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .lean()
        .exec();

      const count = await LeadRemovalJob.countDocuments(filter);

      // Enrich with job type (lead monitoring shifts + clearances) for table display
      if (jobs.length > 0) {
        const jobIds = jobs.map((j) => j._id);

        const [shiftCounts, clearanceCounts] = await Promise.all([
          Shift.aggregate([
            {
              $match: {
                jobModel: "LeadRemovalJob",
                job: { $in: jobIds },
              },
            },
            { $group: { _id: "$job", count: { $sum: 1 } } },
          ]),
          LeadClearance.aggregate([
            { $match: { leadRemovalJobId: { $in: jobIds } } },
            { $group: { _id: "$leadRemovalJobId", count: { $sum: 1 } } },
          ]),
        ]);

        const shiftMap = new Map(
          shiftCounts.map((r) => [r._id.toString(), r.count])
        );
        const clearanceMap = new Map(
          clearanceCounts.map((r) => [r._id.toString(), r.count])
        );

        const deriveJobType = (hasAirMonitoring, hasClearance) => {
          if (hasAirMonitoring && hasClearance) return "air_monitoring_and_clearance";
          if (hasAirMonitoring) return "air_monitoring";
          if (hasClearance) return "clearance";
          return "none";
        };

        const resolveJobTypeLabel = (jobTypeRaw, airMonitoringFlag, clearanceFlag) => {
          switch (jobTypeRaw) {
            case "air_monitoring_and_clearance":
              return "Air Monitoring & Clearance";
            case "air_monitoring":
              return "Air Monitoring";
            case "clearance":
              return "Clearance";
            default: {
              if (airMonitoringFlag && clearanceFlag) return "Air Monitoring & Clearance";
              if (airMonitoringFlag) return "Air Monitoring";
              if (clearanceFlag) return "Clearance";
              return "None";
            }
          }
        };

        jobs.forEach((job) => {
          const idStr = job._id.toString();
          const hasLeadMonitoringShifts = (shiftMap.get(idStr) || 0) > 0;
          const hasClearances = (clearanceMap.get(idStr) || 0) > 0;
          const jobTypeRaw = deriveJobType(hasLeadMonitoringShifts, hasClearances);
          job.airMonitoring = hasLeadMonitoringShifts;
          job.clearance = hasClearances;
          job.jobType = jobTypeRaw;
          job.jobTypeLabel = resolveJobTypeLabel(
            jobTypeRaw,
            hasLeadMonitoringShifts,
            hasClearances
          );
        });
      }

      return res.json({
        jobs,
        totalPages: Math.ceil(count / limit),
        currentPage: page,
        totalCount: count,
      });
    }

    const jobs = await LeadRemovalJob.find(filter)
      .populate({
        path: "projectId",
        select: "projectID name client",
        populate: {
          path: "client",
          select: "name contact1Name contact1Email invoiceEmail contact2Email",
        },
      })
      .populate("createdBy", "firstName lastName")
      .populate("updatedBy", "firstName lastName")
      .sort(sortOptions)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    const count = await LeadRemovalJob.countDocuments(filter);

    res.json({
      jobs,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      totalCount: count,
    });
  } catch (error) {
    console.error("Error fetching lead removal jobs:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Get lead removal job with related data by ID (lead shifts + lead clearances only; no link to asbestos)
router.get(
  "/:id/details",
  auth,
  checkPermission(permView),
  async (req, res) => {
    try {
      const job = await LeadRemovalJob.findById(req.params.id)
        .select("_id projectId projectName client leadAbatementContractor status createdAt updatedAt")
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
          .json({ message: "Lead removal job not found" });
      }

      const jobIdStr = job._id.toString();
      const excludeClearances = req.query.excludeClearances === "true";

      // Lead clearances only (leadRemovalJobId = this job)
      let clearances = [];
      if (!excludeClearances) {
        clearances = await LeadClearance.find({
          leadRemovalJobId: job._id,
        })
          .select("_id projectId clearanceDate clearanceType status inspectionTime leadAbatementContractor LAA jurisdiction secondaryHeader vehicleEquipmentDescription notes jobSpecificExclusions reportApprovedBy reportIssueDate reportViewedAt authorisationRequestedBy")
          .populate({
            path: "projectId",
            select: "projectID name",
          })
          .lean();
      }

      // Lead monitoring shifts only (jobModel = LeadRemovalJob)
      const shiftDocs = await Shift.find({
        job: jobIdStr,
        jobModel: "LeadRemovalJob",
      })
        .select("_id job date status jobModel reportApprovedBy reportIssueDate reportViewedAt authorisationRequestedBy")
        .lean();

      const decoratedShifts = shiftDocs.map((shift) => ({
        ...shift,
        jobId: shift.job?.toString(),
        jobName: job.projectName || "Lead Removal Job",
      }));

      const shiftIds = decoratedShifts.map((s) => s._id);
      // Use LeadAirSample collection for lead job sample numbers
      const sampleDocs = shiftIds.length
        ? await LeadAirSample.find({ shift: { $in: shiftIds } })
            .select("shift fullSampleID")
            .lean()
        : [];

      const sampleMap = new Map();
      sampleDocs.forEach((sample) => {
        const shiftKey = sample.shift?.toString();
        if (!shiftKey) return;
        const match = sample.fullSampleID?.match(/LP(\d+)$/);
        if (!match) return;
        if (!sampleMap.has(shiftKey)) sampleMap.set(shiftKey, []);
        sampleMap.get(shiftKey).push(match[1]);
      });

      const sampleNumbers = Array.from(sampleMap.entries()).map(
        ([shiftId, numbers]) => ({
          shiftId,
          sampleNumbers: numbers
            .map((v) => parseInt(v, 10))
            .filter((n) => !Number.isNaN(n))
            .sort((a, b) => a - b)
            .map((v) => v.toString()),
        })
      );

      res.json({
        job,
        shifts: decoratedShifts,
        clearances,
        sampleNumbers,
      });
    } catch (error) {
      console.error("Error fetching lead removal job details:", error);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// Get clearances for a lead removal job (lazy loading)
router.get(
  "/:id/clearances",
  auth,
  checkPermission(permView),
  async (req, res) => {
    try {
      const job = await LeadRemovalJob.findById(req.params.id)
        .select("projectId")
        .lean();
      if (!job) {
        return res.status(404).json({ message: "Lead removal job not found" });
      }
      const clearances = await LeadClearance.find({
        leadRemovalJobId: req.params.id,
      })
        .select("_id projectId clearanceDate clearanceType status inspectionTime leadAbatementContractor LAA jurisdiction secondaryHeader vehicleEquipmentDescription notes jobSpecificExclusions reportApprovedBy reportIssueDate")
        .populate({
          path: "projectId",
          select: "projectID name",
        })
        .lean();
      res.json({ clearances });
    } catch (error) {
      console.error("Error fetching lead clearances for job:", error);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// Get lead removal job by ID
router.get("/:id", auth, checkPermission(permView), async (req, res) => {
  try {
    const job = await LeadRemovalJob.findById(req.params.id)
      .populate({
        path: "projectId",
        select: "projectID name client",
        populate: {
          path: "client",
          select: "name contact1Name contact1Email invoiceEmail contact2Email",
        },
      })
      .populate("createdBy", "firstName lastName")
      .populate("updatedBy", "firstName lastName");

    if (!job) {
      return res
        .status(404)
        .json({ message: "Lead removal job not found" });
    }

    res.json(job);
  } catch (error) {
    console.error("Error fetching lead removal job:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Create new lead removal job
router.post("/", auth, checkPermission(permCreate), async (req, res) => {
  try {
    const {
      projectId,
      projectName,
      client,
      leadAbatementContractor,
      status,
    } = req.body;

    const job = new LeadRemovalJob({
      projectId,
      projectName,
      client,
      leadAbatementContractor,
      status: status || "in_progress",
      createdBy: req.user.id,
    });

    const savedJob = await job.save();

    if (savedJob.projectId) {
      try {
        const pid = savedJob.projectId._id || savedJob.projectId;
        await Project.findByIdAndUpdate(pid, { reports_present: true });
      } catch (err) {
        console.error("Error updating project reports_present:", err);
      }
    }

    const populatedJob = await LeadRemovalJob.findById(savedJob._id)
      .populate("projectId", "projectID name client")
      .populate("createdBy", "firstName lastName");

    res.status(201).json(populatedJob);
  } catch (error) {
    console.error("Error creating lead removal job:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Update lead removal job
router.put("/:id", auth, checkPermission(permEdit), async (req, res) => {
  try {
    const {
      projectId,
      projectName,
      client,
      leadAbatementContractor,
      status,
    } = req.body;

    const job = await LeadRemovalJob.findById(req.params.id);
    if (!job) {
      return res
        .status(404)
        .json({ message: "Lead removal job not found" });
    }

    if (projectId !== undefined) job.projectId = projectId;
    if (projectName !== undefined) job.projectName = projectName;
    if (client !== undefined) job.client = client;
    if (leadAbatementContractor !== undefined)
      job.leadAbatementContractor = leadAbatementContractor;
    if (status !== undefined) job.status = status;
    job.updatedBy = req.user.id;

    const updatedJob = await job.save();

    const populatedJob = await LeadRemovalJob.findById(updatedJob._id)
      .populate({
        path: "projectId",
        select: "projectID name client",
        populate: {
          path: "client",
          select:
            "name contact1Name contact1Email invoiceEmail contact2Email",
        },
      })
      .populate("createdBy", "firstName lastName")
      .populate("updatedBy", "firstName lastName");

    res.json(populatedJob);
  } catch (error) {
    console.error("Error updating lead removal job:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Delete lead removal job (soft delete: set status to archived)
router.delete("/:id", auth, checkPermission(permDelete), async (req, res) => {
  try {
    const job = await LeadRemovalJob.findById(req.params.id);
    if (!job) {
      return res
        .status(404)
        .json({ message: "Lead removal job not found" });
    }

    job.status = "archived";
    job.updatedBy = req.user?.id;
    await job.save();

    res.json({ message: "Lead removal job archived successfully" });
  } catch (error) {
    console.error("Error deleting lead removal job:", error);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
