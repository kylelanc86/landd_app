const express = require("express");
const router = express.Router();
const AsbestosClearance = require("../models/clearanceTemplates/asbestos/AsbestosClearance");
const auth = require("../middleware/auth");
const checkPermission = require("../middleware/checkPermission");
const {
  syncClearanceForProject,
} = require("../services/asbestosRemovalJobSyncService");
const { getLegislationForReportTemplate } = require("../services/templateService");
const { formatDateSydney } = require("../utils/dateUtils");

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
      .populate("updatedBy", "firstName lastName")
      .populate("revisionReasons.revisedBy", "firstName lastName");

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
    const {
      projectId,
      asbestosRemovalJobId,
      clearanceDate,
      inspectionTime,
      status,
      clearanceType,
      jurisdiction,
      secondaryHeader,
      LAA,
      asbestosRemovalist,
      airMonitoring,
      airMonitoringReport,
      sitePlan,
      sitePlanFile,
      sitePlanSource,
      sitePlanLegend,
      sitePlanLegendTitle,
      sitePlanFigureTitle,
      jobSpecificExclusions,
      notes,
      vehicleEquipmentDescription,
    } = req.body;

    // Calculate sequence number for clearances of the same type, project, and date
    let sequenceNumber = 1;
    if (clearanceDate && projectId && clearanceType) {
      try {
        // Normalize clearanceDate to start of day for comparison
        const clearanceDateObj = new Date(clearanceDate);
        const startOfDay = new Date(clearanceDateObj);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(clearanceDateObj);
        endOfDay.setHours(23, 59, 59, 999);

        // Find existing clearances with same project, type, and date
        const existingClearances = await AsbestosClearance.find({
          projectId,
          clearanceType,
          clearanceDate: {
            $gte: startOfDay,
            $lte: endOfDay,
          },
        })
          .select("sequenceNumber")
          .lean();

        if (existingClearances.length > 0) {
          // Find the maximum sequence number
          const maxSequence = existingClearances.reduce((max, clearance) => {
            const seq = clearance.sequenceNumber || 1;
            return Math.max(max, seq);
          }, 0);
          sequenceNumber = maxSequence + 1;
        }
      } catch (error) {
        console.error("Error calculating sequence number:", error);
        // Default to 1 if there's an error
        sequenceNumber = 1;
      }
    }

    // Legislation snapshot at job creation (state-specific from report template)
    let legislation = [];
    try {
      const templateType =
        clearanceType === "Friable"
          ? "asbestosClearanceFriable"
          : clearanceType === "Friable (Non-Friable Conditions)"
            ? "asbestosClearanceFriableNonFriableConditions"
            : clearanceType === "Vehicle/Equipment"
              ? "asbestosClearanceVehicle"
              : "asbestosClearanceNonFriable";
      legislation = await getLegislationForReportTemplate(templateType, jurisdiction || "ACT");
    } catch (err) {
      console.error("Error fetching legislation for clearance:", err);
    }

    const clearance = new AsbestosClearance({
      projectId,
      ...(asbestosRemovalJobId && { asbestosRemovalJobId }),
      clearanceDate,
      inspectionTime,
      status: status || "in progress",
      clearanceType,
      jurisdiction: jurisdiction || "ACT",
      legislation,
      secondaryHeader: secondaryHeader || "",
      LAA,
      asbestosRemovalist,
      airMonitoring: airMonitoring || false,
      airMonitoringReport: airMonitoringReport || null,
      sitePlan: sitePlan || false,
      sitePlanFile: sitePlanFile || null,
      ...(sitePlanSource && { sitePlanSource }),
      sitePlanLegend: sitePlanLegend || [],
      sitePlanLegendTitle: sitePlanLegendTitle || undefined,
      sitePlanFigureTitle: sitePlanFigureTitle || undefined,
      sitePlanFigureTitle: sitePlanFigureTitle || undefined,
      jobSpecificExclusions: jobSpecificExclusions || null,
      notes,
      vehicleEquipmentDescription,
      sequenceNumber,
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

    const projectIdForSync =
      populatedClearance.projectId?._id || populatedClearance.projectId;
    try {
      await syncClearanceForProject(projectIdForSync);
    } catch (syncError) {
      console.error(
        "Error syncing asbestos removal job clearance flags after creation:",
        syncError
      );
    }

    res.status(201).json(populatedClearance);
  } catch (error) {
    console.error("Error creating asbestos clearance:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Update asbestos clearance
router.put("/:id", auth, checkPermission("asbestos.edit"), async (req, res) => {
  try {
    const {
      projectId,
      asbestosRemovalJobId,
      clearanceDate,
      inspectionTime,
      status,
      clearanceType,
      jurisdiction,
      secondaryHeader,
      LAA,
      asbestosRemovalist,
      airMonitoring,
      airMonitoringReport,
      airMonitoringReports,
      sitePlan,
      sitePlanFile,
      sitePlanSource,
      sitePlanLegend,
      sitePlanLegendTitle,
      sitePlanFigureTitle,
      jobSpecificExclusions,
      notes,
      revision,
      revisionReasons,
      vehicleEquipmentDescription,
      reportViewedAt,
    } = req.body;

    const clearance = await AsbestosClearance.findById(req.params.id);
    if (!clearance) {
      return res.status(404).json({ message: "Asbestos clearance not found" });
    }

    const previousProjectId = clearance.projectId
      ? clearance.projectId.toString()
      : null;

    clearance.projectId = projectId || clearance.projectId;
    if (asbestosRemovalJobId !== undefined) {
      clearance.asbestosRemovalJobId = asbestosRemovalJobId || null;
    }
    clearance.clearanceDate = clearanceDate || clearance.clearanceDate;
    clearance.inspectionTime = inspectionTime || clearance.inspectionTime;
    clearance.status = status || clearance.status;
    clearance.clearanceType = clearanceType || clearance.clearanceType;
    clearance.jurisdiction = jurisdiction || clearance.jurisdiction;
    clearance.secondaryHeader = secondaryHeader !== undefined ? secondaryHeader : clearance.secondaryHeader;
    clearance.LAA = LAA || clearance.LAA;
    clearance.asbestosRemovalist = asbestosRemovalist || clearance.asbestosRemovalist;
    clearance.airMonitoring = airMonitoring !== undefined ? airMonitoring : clearance.airMonitoring;
    clearance.airMonitoringReport = airMonitoringReport !== undefined ? airMonitoringReport : clearance.airMonitoringReport;
    if (airMonitoringReports !== undefined) {
      clearance.airMonitoringReports = airMonitoringReports;
    }
    clearance.sitePlan = sitePlan !== undefined ? sitePlan : clearance.sitePlan;
    clearance.sitePlanFile = sitePlanFile !== undefined ? sitePlanFile : clearance.sitePlanFile;
    if (sitePlanLegend !== undefined) {
      clearance.sitePlanLegend = sitePlanLegend;
    }
    if (sitePlanLegendTitle !== undefined) {
      clearance.sitePlanLegendTitle = sitePlanLegendTitle;
    }
    // Handle sitePlanFigureTitle - default to 'Asbestos Removal Site Plan' if site plan exists but title not provided
    if (sitePlanFigureTitle !== undefined) {
      clearance.sitePlanFigureTitle = sitePlanFigureTitle;
    } else if ((sitePlan !== undefined && sitePlan) || (sitePlanFile !== undefined && sitePlanFile)) {
      // If site plan is being set/updated but no title provided, use default
      if (!clearance.sitePlanFigureTitle) {
        clearance.sitePlanFigureTitle = 'Asbestos Removal Site Plan';
      }
    }
    if (sitePlanSource && ["uploaded", "drawn"].includes(sitePlanSource)) {
      clearance.sitePlanSource = sitePlanSource;
    } else if (sitePlanSource === null) {
      clearance.sitePlanSource = undefined; // Remove the field instead of setting to null
    }
    clearance.jobSpecificExclusions = jobSpecificExclusions !== undefined ? jobSpecificExclusions : clearance.jobSpecificExclusions;
    clearance.notes = notes || clearance.notes;
    clearance.vehicleEquipmentDescription = vehicleEquipmentDescription !== undefined ? vehicleEquipmentDescription : clearance.vehicleEquipmentDescription;
    clearance.updatedBy = req.user.id;
    
    // Handle revision fields
    if (revision !== undefined) {
      clearance.revision = revision;
    }
    if (revisionReasons !== undefined) {
      clearance.revisionReasons = revisionReasons;
    }
    if (reportViewedAt !== undefined) {
      clearance.reportViewedAt = reportViewedAt;
    }

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
      .populate("updatedBy", "firstName lastName")
      .populate("revisionReasons.revisedBy", "firstName lastName");

    const newProjectId = populatedClearance.projectId?._id
      ? populatedClearance.projectId._id.toString()
      : populatedClearance.projectId?.toString();

    const projectsToSync = new Set();
    if (previousProjectId) {
      projectsToSync.add(previousProjectId);
    }
    if (newProjectId) {
      projectsToSync.add(newProjectId);
    }

    for (const id of projectsToSync) {
      try {
        await syncClearanceForProject(id);
      } catch (syncError) {
        console.error(
          "Error syncing asbestos removal job clearance flags after update:",
          { projectId: id, error: syncError }
        );
      }
    }

    res.json(populatedClearance);
  } catch (error) {
    console.error("Error updating asbestos clearance:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// PATCH clearance - report viewed (persist so Send/Authorise buttons stay visible)
router.patch("/:id", auth, checkPermission("asbestos.edit"), async (req, res) => {
  try {
    const { reportViewedAt } = req.body;
    if (reportViewedAt === undefined) {
      return res.status(400).json({ message: "reportViewedAt is required" });
    }
    const clearance = await AsbestosClearance.findByIdAndUpdate(
      req.params.id,
      { reportViewedAt: reportViewedAt ? new Date(reportViewedAt) : null },
      { new: true }
    );
    if (!clearance) {
      return res.status(404).json({ message: "Asbestos clearance not found" });
    }
    res.json(clearance);
  } catch (error) {
    console.error("Error updating clearance reportViewedAt:", error);
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

// Upload air monitoring report(s) - supports single (legacy) or multiple reports
router.post("/:id/air-monitoring-report", auth, checkPermission("asbestos.edit"), async (req, res) => {
  try {
    const { reportData, shiftDate, shiftId, airMonitoring, reports } = req.body;

    const clearance = await AsbestosClearance.findById(req.params.id);
    if (!clearance) {
      return res.status(404).json({ message: "Asbestos clearance not found" });
    }

    if (airMonitoring !== undefined) {
      clearance.airMonitoring = airMonitoring;
    }
    clearance.updatedBy = req.user.id;

    if (Array.isArray(reports) && reports.length > 0) {
      // Multiple reports: store in airMonitoringReports, sorted by shiftDate (earliest first)
      const sorted = [...reports].sort(
        (a, b) => new Date(a.shiftDate || 0) - new Date(b.shiftDate || 0)
      );
      clearance.airMonitoringReports = sorted.map((r) => ({
        reportData: r.reportData,
        shiftDate: r.shiftDate,
        shiftId: r.shiftId,
      }));
      // Legacy single field: first report for backward compatibility
      clearance.airMonitoringReport = sorted[0].reportData;
    } else if (reportData != null) {
      // Legacy single report
      clearance.airMonitoringReport = reportData;
      clearance.airMonitoringReports = [{ reportData, shiftDate, shiftId }];
    }

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
    
    // Get all jobs for this project - check both regular Job and AsbestosRemovalJob
    const Job = require('../models/Job');
    const AsbestosRemovalJob = require('../models/AsbestosRemovalJob');
    const Shift = require('../models/Shift');
    
    // Get regular jobs
    const regularJobs = await Job.find({ projectId: projectId }).populate('projectId', 'name projectID');
    
    // Get asbestos removal jobs - only completed ones
    const asbestosJobs = await AsbestosRemovalJob.find({ 
      projectId: projectId,
      status: "completed"
    }).populate('projectId', 'name projectID');
    
    // Combine both job types
    const allJobs = [...regularJobs, ...asbestosJobs];
    
    console.log(`Found ${allJobs.length} jobs for project ${projectId}:`, allJobs.map(job => ({ id: job._id, name: job.name, type: job.constructor.modelName })));
    
    const airMonitoringReports = [];
    
    // Get shifts for each job
    for (const job of allJobs) {
      const shifts = await Shift.find({ 
        job: job._id,
        $or: [
          { status: "analysis_complete" },
          { status: "shift_complete" },
          { status: "complete" },
          { reportApprovedBy: { $exists: true, $ne: null } }
        ]
      }).populate('job', 'name')
        .populate('supervisor', 'firstName lastName')
        .populate('defaultSampler', 'firstName lastName');
      
      console.log(`Found ${shifts.length} shifts for job ${job._id} (${job.name})`);
      
      shifts.forEach(shift => {
        airMonitoringReports.push({
          _id: shift._id,
          name: shift.name,
          date: shift.date,
          status: shift.status,
          reportApprovedBy: shift.reportApprovedBy,
          reportIssueDate: shift.reportIssueDate,
          supervisor: shift.supervisor,
          defaultSampler: shift.defaultSampler,
          revision: shift.revision || 0,
          jobName: job.name,
          jobId: job._id,
          projectName: job.projectId?.name,
          projectId: job.projectId?._id,
          asbestosRemovalist: job.asbestosRemovalist || null
        });
      });
    }
    
    // Sort by date (newest first)
    airMonitoringReports.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    console.log(`Returning ${airMonitoringReports.length} air monitoring reports`);
    res.json(airMonitoringReports);
  } catch (error) {
    console.error("Error fetching air monitoring reports:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Get air monitoring reports for a specific asbestos removal job
router.get("/air-monitoring-reports-by-job/:jobId", auth, async (req, res) => {
  try {
    const { jobId } = req.params;
    
    const Shift = require('../models/Shift');
    const AsbestosRemovalJob = require('../models/AsbestosRemovalJob');
    
    console.log(`Searching for air monitoring reports for job ${jobId}`);
    
    // Get the asbestos removal job to access the asbestosRemovalist field
    const asbestosRemovalJob = await AsbestosRemovalJob.findById(jobId);
    if (!asbestosRemovalJob) {
      return res.status(404).json({ message: "Asbestos removal job not found" });
    }
    
    // Get shifts for this specific job
    const shifts = await Shift.find({ 
      job: jobId,
      $or: [
        { status: "analysis_complete" },
        { status: "shift_complete" },
        { status: "complete" },
        { reportApprovedBy: { $exists: true, $ne: null } }
      ]
    })
    .populate('defaultSampler', 'firstName lastName');
    
    console.log(`Found ${shifts.length} shifts for job ${jobId}`);
    
    const airMonitoringReports = shifts.map(shift => ({
      _id: shift._id,
      name: shift.name,
      date: shift.date,
      status: shift.status,
      reportApprovedBy: shift.reportApprovedBy,
      reportIssueDate: shift.reportIssueDate,
      asbestosRemovalist: asbestosRemovalJob.asbestosRemovalist,
      defaultSampler: shift.defaultSampler,
      descriptionOfWorks: shift.descriptionOfWorks,
      revision: shift.revision || 0,
      jobId: jobId
    }));
    
    // Sort by date (newest first)
    airMonitoringReports.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    console.log(`Returning ${airMonitoringReports.length} air monitoring reports for job ${jobId}`);
    res.json(airMonitoringReports);
  } catch (error) {
    console.error("Error fetching air monitoring reports by job:", error);
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

    const projectIdForSync = clearance.projectId
      ? clearance.projectId.toString()
      : null;

    if (projectIdForSync) {
      try {
        await syncClearanceForProject(projectIdForSync);
      } catch (syncError) {
        console.error(
          "Error syncing asbestos removal job clearance flags after deletion:",
          { projectId: projectIdForSync, error: syncError }
        );
      }
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

    // Preserve existing fields like photographs when updating
    const existingItem = clearance.items[itemIndex];
    // Only update fields that are explicitly provided in the request
    if (locationDescription !== undefined) existingItem.locationDescription = locationDescription;
    if (levelFloor !== undefined) existingItem.levelFloor = levelFloor;
    if (roomArea !== undefined) existingItem.roomArea = roomArea;
    if (materialDescription !== undefined) existingItem.materialDescription = materialDescription;
    if (asbestosType !== undefined) existingItem.asbestosType = asbestosType;
    if (photograph !== undefined) existingItem.photograph = photograph;
    if (notes !== undefined) existingItem.notes = notes;
    // Photographs array is preserved automatically since we're modifying the existing item in place

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

// Add photo to clearance item
router.post("/:id/items/:itemId/photos", auth, checkPermission("asbestos.edit"), async (req, res) => {
  try {
    const { photoData, includeInReport = true } = req.body;

    if (!photoData) {
      return res.status(400).json({ message: "Photo data is required" });
    }

    const clearance = await AsbestosClearance.findById(req.params.id);
    if (!clearance) {
      return res.status(404).json({ message: "Asbestos clearance not found" });
    }

    const item = clearance.items.id(req.params.itemId);
    if (!item) {
      return res.status(404).json({ message: "Clearance item not found" });
    }

    // Initialize photographs array if it doesn't exist
    if (!item.photographs) {
      item.photographs = [];
    }

    // Calculate next photo number for this item
    const existingPhotoNumbers = item.photographs.map(p => p.photoNumber || 0);
    const nextPhotoNumber = existingPhotoNumbers.length > 0 ? Math.max(...existingPhotoNumbers) + 1 : 1;
    
    // If this is the first photo and no photo numbers exist, start from 1
    const actualPhotoNumber = item.photographs.length === 0 ? 1 : nextPhotoNumber;

    // Add new photo
    item.photographs.push({
      data: photoData,
      includeInReport: includeInReport,
      uploadedAt: new Date(),
      photoNumber: actualPhotoNumber,
    });

    clearance.updatedBy = req.user.id;
    await clearance.save();

    res.status(201).json(item);
  } catch (error) {
    console.error("Error adding photo to clearance item:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Delete photo from clearance item
router.delete("/:id/items/:itemId/photos/:photoId", auth, checkPermission("asbestos.edit"), async (req, res) => {
  try {
    const clearance = await AsbestosClearance.findById(req.params.id);
    if (!clearance) {
      return res.status(404).json({ message: "Asbestos clearance not found" });
    }

    const item = clearance.items.id(req.params.itemId);
    if (!item) {
      return res.status(404).json({ message: "Clearance item not found" });
    }

    const photoIndex = item.photographs.findIndex(photo => photo._id.toString() === req.params.photoId);
    if (photoIndex === -1) {
      return res.status(404).json({ message: "Photo not found" });
    }

    item.photographs.splice(photoIndex, 1);
    clearance.updatedBy = req.user.id;
    await clearance.save();

    res.json({ message: "Photo deleted successfully", item });
  } catch (error) {
    console.error("Error deleting photo from clearance item:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Toggle photo inclusion in report
router.patch("/:id/items/:itemId/photos/:photoId/toggle", auth, checkPermission("asbestos.edit"), async (req, res) => {
  try {
    const clearance = await AsbestosClearance.findById(req.params.id);
    if (!clearance) {
      return res.status(404).json({ message: "Asbestos clearance not found" });
    }

    const item = clearance.items.id(req.params.itemId);
    if (!item) {
      return res.status(404).json({ message: "Clearance item not found" });
    }

    const photo = item.photographs.id(req.params.photoId);
    if (!photo) {
      return res.status(404).json({ message: "Photo not found" });
    }

    photo.includeInReport = !photo.includeInReport;
    clearance.updatedBy = req.user.id;
    await clearance.save();

    res.json({ message: "Photo inclusion toggled successfully", item });
  } catch (error) {
    console.error("Error toggling photo inclusion:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Update photo description
router.patch("/:id/items/:itemId/photos/:photoId/description", auth, checkPermission("asbestos.edit"), async (req, res) => {
  try {
    const { description } = req.body;

    const clearance = await AsbestosClearance.findById(req.params.id);
    if (!clearance) {
      return res.status(404).json({ message: "Asbestos clearance not found" });
    }

    const item = clearance.items.id(req.params.itemId);
    if (!item) {
      return res.status(404).json({ message: "Clearance item not found" });
    }

    const photo = item.photographs.id(req.params.photoId);
    if (!photo) {
      return res.status(404).json({ message: "Photo not found" });
    }

    photo.description = description !== undefined ? description : photo.description;
    clearance.updatedBy = req.user.id;
    await clearance.save();

    res.json({ message: "Photo description updated successfully", item });
  } catch (error) {
    console.error("Error updating photo description:", error);
    res.status(500).json({ message: "Server error" });
  }
});

function ensureArrowsArray(photo) {
  if (!photo.arrows) photo.arrows = [];
  const leg = photo.arrow;
  if (leg != null && typeof leg === "object") {
    const hasPosition = leg.x != null || leg.y != null;
    if (hasPosition) {
      photo.arrows.push({
        x: leg.x ?? 0.5,
        y: leg.y ?? 0.5,
        rotation: leg.rotation ?? 0,
        color: leg.color,
      });
    }
    delete photo.arrow;
  }
}

router.post("/:id/items/:itemId/photos/:photoId/arrows", auth, checkPermission("asbestos.edit"), async (req, res) => {
  try {
    const { x, y, rotation, color } = req.body;
    const clearance = await AsbestosClearance.findById(req.params.id);
    if (!clearance) return res.status(404).json({ message: "Asbestos clearance not found" });
    const item = clearance.items.id(req.params.itemId);
    if (!item) return res.status(404).json({ message: "Clearance item not found" });
    const photo = item.photographs.id(req.params.photoId);
    if (!photo) return res.status(404).json({ message: "Photo not found" });
    ensureArrowsArray(photo);
    photo.arrows.push({
      x: typeof x === "number" ? x : 0.5,
      y: typeof y === "number" ? y : 0.5,
      rotation: typeof rotation === "number" ? rotation : -45,
      color: color || "#f44336",
    });
    clearance.updatedBy = req.user.id;
    await clearance.save();
    res.status(201).json({ message: "Arrow added", item });
  } catch (err) {
    console.error("Error adding arrow:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

router.patch("/:id/items/:itemId/photos/:photoId/arrows/:arrowId", auth, checkPermission("asbestos.edit"), async (req, res) => {
  try {
    const { x, y, rotation, color } = req.body;
    const clearance = await AsbestosClearance.findById(req.params.id);
    if (!clearance) return res.status(404).json({ message: "Asbestos clearance not found" });
    const item = clearance.items.id(req.params.itemId);
    if (!item) return res.status(404).json({ message: "Clearance item not found" });
    const photo = item.photographs.id(req.params.photoId);
    if (!photo) return res.status(404).json({ message: "Photo not found" });
    ensureArrowsArray(photo);
    const arrow = photo.arrows.id(req.params.arrowId);
    if (!arrow) return res.status(404).json({ message: "Arrow not found" });
    if (typeof x === "number") arrow.x = x;
    if (typeof y === "number") arrow.y = y;
    if (typeof rotation === "number") arrow.rotation = rotation;
    if (color !== undefined) arrow.color = color;
    clearance.updatedBy = req.user.id;
    await clearance.save();
    res.json({ message: "Arrow updated", item });
  } catch (err) {
    console.error("Error updating arrow:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

router.delete("/:id/items/:itemId/photos/:photoId/arrows/:arrowId", auth, checkPermission("asbestos.edit"), async (req, res) => {
  try {
    const clearance = await AsbestosClearance.findById(req.params.id);
    if (!clearance) return res.status(404).json({ message: "Asbestos clearance not found" });
    const item = clearance.items.id(req.params.itemId);
    if (!item) return res.status(404).json({ message: "Clearance item not found" });
    const photo = item.photographs.id(req.params.photoId);
    if (!photo) return res.status(404).json({ message: "Photo not found" });
    ensureArrowsArray(photo);
    const arrow = photo.arrows.id(req.params.arrowId);
    if (!arrow) return res.status(404).json({ message: "Arrow not found" });
    photo.arrows.pull(req.params.arrowId);
    clearance.updatedBy = req.user.id;
    await clearance.save();
    res.json({ message: "Arrow deleted", item });
  } catch (err) {
    console.error("Error deleting arrow:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

router.patch("/:id/items/:itemId/photos/:photoId/arrow", auth, checkPermission("asbestos.edit"), async (req, res) => {
  try {
    const { x, y, rotation, color, arrow } = req.body;
    const clearance = await AsbestosClearance.findById(req.params.id);
    if (!clearance) return res.status(404).json({ message: "Asbestos clearance not found" });
    const item = clearance.items.id(req.params.itemId);
    if (!item) return res.status(404).json({ message: "Clearance item not found" });
    const photo = item.photographs.id(req.params.photoId);
    if (!photo) return res.status(404).json({ message: "Photo not found" });
    ensureArrowsArray(photo);
    if (arrow === null) {
      photo.arrows = [];
      delete photo.arrow;
    } else if (x !== undefined || y !== undefined || rotation !== undefined || color !== undefined) {
      const existing = photo.arrows[0] || {};
      photo.arrows = [{
        x: typeof x === "number" ? x : (existing.x ?? 0.5),
        y: typeof y === "number" ? y : (existing.y ?? 0.5),
        rotation: typeof rotation === "number" ? rotation : (existing.rotation ?? -45),
        color: color !== undefined ? color : (existing.color || "#f44336"),
      }];
    }
    clearance.updatedBy = req.user.id;
    await clearance.save();
    res.json({ message: "Photo arrow updated successfully", item });
  } catch (err) {
    console.error("Error updating photo arrow:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// Authorise clearance report
router.post("/:id/authorise", auth, checkPermission("asbestos.edit"), async (req, res) => {
  try {
    const clearance = await AsbestosClearance.findById(req.params.id)
      .populate({
        path: "projectId",
        select: "projectID name client",
        populate: {
          path: "client",
          select: "name"
        }
      });

    if (!clearance) {
      return res.status(404).json({ message: "Asbestos clearance not found" });
    }

    if (clearance.status !== "complete") {
      return res.status(400).json({
        message: "Clearance must be complete before authorising the report"
      });
    }

    if (clearance.reportApprovedBy) {
      return res.status(400).json({
        message: "Report has already been authorised"
      });
    }

    const approver =
      req.user?.firstName && req.user?.lastName
        ? `${req.user.firstName} ${req.user.lastName}`
        : req.user?.email || "Unknown";

    clearance.reportApprovedBy = approver;
    clearance.reportIssueDate = new Date();
    clearance.updatedBy = req.user.id;

    const updatedClearance = await clearance.save();

    // Send notification email to the user who requested authorisation
    if (updatedClearance.authorisationRequestedBy) {
      try {
        const { sendMail } = require("../services/mailer");
        const User = require("../models/User");

        // Get requester user details
        const requester = await User.findById(updatedClearance.authorisationRequestedBy)
          .select("firstName lastName email");
        
        if (requester && requester.email) {
          const projectName = clearance.projectId?.name || "Unknown Project";
          const projectID = clearance.projectId?.projectID || "N/A";
          const clientName = clearance.projectId?.client?.name || "the client";
          const clearanceDate = clearance.clearanceDate
            ? formatDateSydney(clearance.clearanceDate)
            : "N/A";
          const clearanceType = clearance.clearanceType || "Asbestos Clearance";
          const approverName = approver;
          const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
          
          // Use direct link if available, otherwise fall back to finding the job
          let jobId = null;
          if (clearance.asbestosRemovalJobId) {
            jobId = clearance.asbestosRemovalJobId.toString();
          } else {
            // Fallback for existing clearances that don't have the direct link
            const AsbestosRemovalJob = require("../models/AsbestosRemovalJob");
            const projectId = clearance.projectId?._id?.toString() || clearance.projectId?.toString();
            
            if (projectId) {
              const jobs = await AsbestosRemovalJob.find({ 
                projectId,
                $or: [
                  { clearance: true },
                  { jobType: { $in: ["clearance", "air_monitoring_and_clearance"] } }
                ]
              })
              .select("_id asbestosRemovalist createdAt")
              .sort({ createdAt: -1 })
              .lean();
              
              if (jobs.length === 1) {
                jobId = jobs[0]._id.toString();
              } else if (jobs.length > 1) {
                const matchingJob = jobs.find(job => 
                  job.asbestosRemovalist === clearance.asbestosRemovalist
                );
                jobId = matchingJob 
                  ? matchingJob._id.toString() 
                  : jobs[0]._id.toString();
              } else {
                const anyJob = await AsbestosRemovalJob.findOne({ projectId })
                  .select("_id")
                  .sort({ createdAt: -1 })
                  .lean();
                jobId = anyJob?._id?.toString();
              }
            }
          }
          
          const clearanceUrl = jobId
            ? `${frontendUrl}/asbestos-removal/jobs/${jobId}/details`
            : `${frontendUrl}/projects`;

          await sendMail({
            to: requester.email,
            subject: `Report Authorised - ${projectID}: ${clearanceType}`,
            text: `
The asbestos clearance report you requested for authorisation has been authorised.

Project: ${projectName} (${projectID})
Client: ${clientName}
Clearance Type: ${clearanceType}
Clearance Date: ${clearanceDate}
Authorised by: ${approverName}

View the report at: ${clearanceUrl}
            `.trim(),
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
                <div style="margin-bottom: 30px;">
                  <h1 style="color: rgb(25, 138, 44); font-size: 24px; margin: 0; padding: 0;">L&D Consulting App</h1>
                  <p style="color: #666; font-size: 16px; margin: 10px 0 0 0;">Environmental Services</p>
                </div>
                <div style="color: #333; line-height: 1.6;">
                  <h2 style="color: rgb(25, 138, 44); margin-bottom: 20px;">Report Authorised</h2>
                  <p>Hello ${requester.firstName},</p>
                  <p>The asbestos clearance report you requested for authorisation has been authorised:</p>
                  <div style="background-color: #f5f5f5; padding: 15px; border-radius: 4px; margin: 20px 0;">
                    <p style="margin: 5px 0;"><strong>Project:</strong> ${projectName}</p>
                    <p style="margin: 5px 0;"><strong>Project ID:</strong> ${projectID}</p>
                    <p style="margin: 5px 0;"><strong>Client:</strong> ${clientName}</p>
                    <p style="margin: 5px 0;"><strong>Clearance Type:</strong> ${clearanceType}</p>
                    <p style="margin: 5px 0;"><strong>Clearance Date:</strong> ${clearanceDate}</p>
                    <p style="margin: 5px 0;"><strong>Authorised by:</strong> ${approverName}</p>
                  </div>
                  <div style="text-align: center; margin: 30px 0;">
                    <a href="${clearanceUrl}" style="background-color: rgb(25, 138, 44); color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">View Report</a>
                  </div>
                  <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">
                  <p style="color: #666; font-size: 12px;">This is an automated message, please do not reply to this email.</p>
                </div>
              </div>
            `,
          });
        }
      } catch (emailError) {
        // Log error but don't fail the request
        console.error("Error sending authorisation notification email:", emailError);
      }
    }

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
    console.error("Error authorising clearance report:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Send clearance report for authorisation
router.post("/:id/send-for-authorisation", auth, checkPermission("asbestos.edit"), async (req, res) => {
  try {
    const { sendMail } = require("../services/mailer");
    const User = require("../models/User");
    const Project = require("../models/Project");
    const Client = require("../models/Client");

    const clearance = await AsbestosClearance.findById(req.params.id)
      .populate({
        path: "projectId",
        select: "projectID name client",
        populate: {
          path: "client",
          select: "name"
        }
      })
      .populate("createdBy", "firstName lastName");

    if (!clearance) {
      return res.status(404).json({ message: "Asbestos clearance not found" });
    }

    if (clearance.status !== "complete") {
      return res.status(400).json({
        message: "Clearance must be complete before sending for authorisation"
      });
    }

    if (clearance.reportApprovedBy) {
      return res.status(400).json({
        message: "Report has already been authorised"
      });
    }

    const reportProoferUsers = await User.find({
      reportProofer: true,
      isActive: true,
    }).select("firstName lastName email");

    if (reportProoferUsers.length === 0) {
      return res.status(400).json({
        message: "No report proofer users found"
      });
    }

    const projectName = clearance.projectId?.name || "Unknown Project";
    const projectID = clearance.projectId?.projectID || "N/A";
    const clientName = clearance.projectId?.client?.name || "the client";

    const requesterName =
      req.user?.firstName && req.user?.lastName
        ? `${req.user.firstName} ${req.user.lastName}`
        : req.user?.email || "A user";

    // Store who requested authorisation
    clearance.authorisationRequestedBy = req.user._id;
    clearance.authorisationRequestedByEmail = req.user.email;
    await clearance.save();

    const clearanceDate = clearance.clearanceDate
      ? formatDateSydney(clearance.clearanceDate)
      : "N/A";
    const clearanceType = clearance.clearanceType || "Asbestos Clearance";

    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    
    // Use direct link if available, otherwise fall back to finding the job
    let jobId = null;
    if (clearance.asbestosRemovalJobId) {
      // Use the direct link
      jobId = clearance.asbestosRemovalJobId.toString();
    } else {
      // Fallback for existing clearances that don't have the direct link
      // Find the asbestos removal job for this clearance
      const AsbestosRemovalJob = require("../models/AsbestosRemovalJob");
      const projectId = clearance.projectId?._id?.toString() || clearance.projectId?.toString();
      
      if (projectId) {
        // Find all asbestos removal jobs for this project that have clearance enabled
        const jobs = await AsbestosRemovalJob.find({ 
          projectId,
          $or: [
            { clearance: true },
            { jobType: { $in: ["clearance", "air_monitoring_and_clearance"] } }
          ]
        })
        .select("_id asbestosRemovalist createdAt")
        .sort({ createdAt: -1 }) // Most recent first
        .lean();
        
        if (jobs.length === 1) {
          // Only one job with clearance - use it
          jobId = jobs[0]._id.toString();
        } else if (jobs.length > 1) {
          // Multiple jobs - try to match by asbestosRemovalist name
          const matchingJob = jobs.find(job => 
            job.asbestosRemovalist === clearance.asbestosRemovalist
          );
          jobId = matchingJob 
            ? matchingJob._id.toString() 
            : jobs[0]._id.toString(); // Fallback to most recent
        } else {
          // No jobs with clearance flag - try finding any job for this project
          const anyJob = await AsbestosRemovalJob.findOne({ projectId })
            .select("_id")
            .sort({ createdAt: -1 })
            .lean();
          jobId = anyJob?._id?.toString();
        }
      }
    }
    
    const clearanceUrl = jobId
      ? `${frontendUrl}/asbestos-removal/jobs/${jobId}/details`
      : `${frontendUrl}/projects`;

    await Promise.all(
      reportProoferUsers.map(async (user) => {
        await sendMail({
          to: user.email,
          subject: `Report Authorisation Required - ${projectID}: ${clearanceType}`,
          text: `
An asbestos clearance report is ready for authorisation.

Project: ${projectName} (${projectID})
Client: ${clientName}
Clearance Type: ${clearanceType}
Clearance Date: ${clearanceDate}
Requested by: ${requesterName}

Review the report at: ${clearanceUrl}
          `.trim(),
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
              <div style="margin-bottom: 30px;">
                <h1 style="color: rgb(25, 138, 44); font-size: 24px; margin: 0; padding: 0;">L&D Consulting App</h1>
                <p style="color: #666; font-size: 16px; margin: 10px 0 0 0;">Environmental Services</p>
              </div>
              <div style="color: #333; line-height: 1.6;">
                <h2 style="color: rgb(25, 138, 44); margin-bottom: 20px;">Report Authorisation Required</h2>
                <p>Hello ${user.firstName},</p>
                <p>An asbestos clearance report is ready for your authorisation:</p>
                <div style="background-color: #f5f5f5; padding: 15px; border-radius: 4px; margin: 20px 0;">
                  <p style="margin: 5px 0;"><strong>Project:</strong> ${projectName}</p>
                  <p style="margin: 5px 0;"><strong>Project ID:</strong> ${projectID}</p>
                  <p style="margin: 5px 0;"><strong>Client:</strong> ${clientName}</p>
                  <p style="margin: 5px 0;"><strong>Clearance Type:</strong> ${clearanceType}</p>
                  <p style="margin: 5px 0;"><strong>Clearance Date:</strong> ${clearanceDate}</p>
                  <p style="margin: 5px 0;"><strong>Requested by:</strong> ${requesterName}</p>
                </div>
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${clearanceUrl}" style="background-color: rgb(25, 138, 44); color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">Review Report</a>
                </div>
                <p>Please review and authorise the report at your earliest convenience.</p>
                <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">
                <p style="color: #666; font-size: 12px;">This is an automated message, please do not reply to this email.</p>
              </div>
            </div>
          `,
        });
      })
    );

    return res.json({
      message: `Authorisation request emails sent successfully to ${reportProoferUsers.length} report proofer user(s)`,
      recipients: reportProoferUsers.map((user) => ({
        email: user.email,
        name: `${user.firstName} ${user.lastName}`,
      })),
    });
  } catch (error) {
    console.error("Error sending authorisation request emails:", error);
    return res.status(500).json({
      message: "Failed to send authorisation request emails",
      error: error.message,
    });
  }
});

module.exports = router; 