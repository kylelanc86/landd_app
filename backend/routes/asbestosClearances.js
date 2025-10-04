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
    const { projectId, clearanceDate, inspectionTime, status, clearanceType, jurisdiction, secondaryHeader, LAA, asbestosRemovalist, airMonitoring, airMonitoringReport, sitePlan, sitePlanFile, sitePlanSource, jobSpecificExclusions, notes } = req.body;

    const clearance = new AsbestosClearance({
      projectId,
      clearanceDate,
      inspectionTime,
      status: status || "in progress",
      clearanceType,
      jurisdiction: jurisdiction || "ACT",
      secondaryHeader: secondaryHeader || "",
      LAA,
      asbestosRemovalist,
      airMonitoring: airMonitoring || false,
      airMonitoringReport: airMonitoringReport || null,
      sitePlan: sitePlan || false,
      sitePlanFile: sitePlanFile || null,
      ...(sitePlanSource && { sitePlanSource }),
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
    const { projectId, clearanceDate, inspectionTime, status, clearanceType, jurisdiction, secondaryHeader, LAA, asbestosRemovalist, airMonitoring, airMonitoringReport, sitePlan, sitePlanFile, sitePlanSource, jobSpecificExclusions, notes, revision, revisionReasons } = req.body;

    const clearance = await AsbestosClearance.findById(req.params.id);
    if (!clearance) {
      return res.status(404).json({ message: "Asbestos clearance not found" });
    }

    clearance.projectId = projectId || clearance.projectId;
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
    clearance.sitePlan = sitePlan !== undefined ? sitePlan : clearance.sitePlan;
    clearance.sitePlanFile = sitePlanFile !== undefined ? sitePlanFile : clearance.sitePlanFile;
    if (sitePlanSource && ["uploaded", "drawn"].includes(sitePlanSource)) {
      clearance.sitePlanSource = sitePlanSource;
    } else if (sitePlanSource === null) {
      clearance.sitePlanSource = undefined; // Remove the field instead of setting to null
    }
    clearance.jobSpecificExclusions = jobSpecificExclusions !== undefined ? jobSpecificExclusions : clearance.jobSpecificExclusions;
    clearance.notes = notes || clearance.notes;
    clearance.updatedBy = req.user.id;
    
    // Handle revision fields
    if (revision !== undefined) {
      clearance.revision = revision;
    }
    if (revisionReasons !== undefined) {
      clearance.revisionReasons = revisionReasons;
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
    const { reportData, shiftDate, shiftId, airMonitoring } = req.body; // Expecting base64 data and metadata

    const clearance = await AsbestosClearance.findById(req.params.id);
    if (!clearance) {
      return res.status(404).json({ message: "Asbestos clearance not found" });
    }

    // Enable air monitoring when uploading a report (new approach)
    if (airMonitoring !== undefined) {
      clearance.airMonitoring = airMonitoring;
    }

    clearance.airMonitoringReport = reportData;
    clearance.airMonitoringShiftDate = shiftDate;
    clearance.airMonitoringShiftId = shiftId;
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

module.exports = router; 