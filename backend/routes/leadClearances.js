const express = require("express");
const router = express.Router();
const LeadClearance = require("../models/clearanceTemplates/lead/LeadClearance");
const LeadRemovalJob = require("../models/LeadRemovalJob");
const auth = require("../middleware/auth");
const checkPermission = require("../middleware/checkPermission");

// Use same permission names as asbestos for role consistency
const permView = "asbestos.view";
const permCreate = "asbestos.create";
const permEdit = "asbestos.edit";
const permDelete = "asbestos.delete";

// Get all lead clearances with filtering
router.get("/", auth, checkPermission(permView), async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      projectId,
      leadRemovalJobId,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    const filter = {};
    if (status) {
      filter.status = status.includes(",") ? { $in: status.split(",") } : status;
    }
    if (projectId) filter.projectId = projectId;
    if (leadRemovalJobId) filter.leadRemovalJobId = leadRemovalJobId;

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === "desc" ? -1 : 1;

    const clearances = await LeadClearance.find(filter)
      .populate({
        path: "projectId",
        select: "projectID name client",
        populate: { path: "client", select: "name" },
      })
      .populate("createdBy", "firstName lastName")
      .populate("updatedBy", "firstName lastName")
      .sort(sortOptions)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    const count = await LeadClearance.countDocuments(filter);
    res.json({
      clearances,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      totalCount: count,
    });
  } catch (error) {
    console.error("Error fetching lead clearances:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Get lead clearance by ID
router.get("/:id", auth, checkPermission(permView), async (req, res) => {
  try {
    const clearance = await LeadClearance.findById(req.params.id)
      .populate({
        path: "projectId",
        select: "projectID name client",
        populate: { path: "client", select: "name" },
      })
      .populate("createdBy", "firstName lastName")
      .populate("updatedBy", "firstName lastName")
      .populate("revisionReasons.revisedBy", "firstName lastName");

    if (!clearance) {
      return res.status(404).json({ message: "Lead clearance not found" });
    }
    res.json(clearance);
  } catch (error) {
    console.error("Error fetching lead clearance:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Create new lead clearance
router.post("/", auth, checkPermission(permCreate), async (req, res) => {
  try {
    const {
      projectId,
      leadRemovalJobId,
      clearanceDate,
      inspectionTime,
      status,
      secondaryHeader,
      consultant,
      leadAbatementContractor,
      jurisdiction: bodyJurisdiction,
      leadMonitoring,
      jobSpecificExclusions,
      notes,
      descriptionOfWorks,
      vehicleEquipmentDescription,
      useComplexTemplate,
    } = req.body;

    let jurisdiction = bodyJurisdiction;
    if (jurisdiction === undefined && leadRemovalJobId) {
      const job = await LeadRemovalJob.findById(leadRemovalJobId).select("jurisdiction").lean();
      if (job && job.jurisdiction) jurisdiction = job.jurisdiction;
    }
    if (jurisdiction === undefined) jurisdiction = "ACT";

    let sequenceNumber = 1;
    if (clearanceDate && projectId) {
      try {
        const d = new Date(clearanceDate);
        const startOfDay = new Date(d);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(d);
        endOfDay.setHours(23, 59, 59, 999);
        const existing = await LeadClearance.find({
          projectId,
          clearanceDate: { $gte: startOfDay, $lte: endOfDay },
        })
          .select("sequenceNumber")
          .lean();
        if (existing.length > 0) {
          const max = existing.reduce(
            (m, c) => Math.max(m, c.sequenceNumber || 1),
            0
          );
          sequenceNumber = max + 1;
        }
      } catch (e) {
        console.error("Error calculating sequence number:", e);
      }
    }

    const clearance = new LeadClearance({
      projectId,
      ...(leadRemovalJobId && { leadRemovalJobId }),
      clearanceDate,
      inspectionTime,
      status: status || "in progress",
      secondaryHeader: secondaryHeader || "",
      consultant: consultant || "",
      leadAbatementContractor: leadAbatementContractor || "",
      jurisdiction: jurisdiction || null,
      leadMonitoring: leadMonitoring || false,
      jobSpecificExclusions: jobSpecificExclusions || null,
      notes: notes || null,
      descriptionOfWorks: descriptionOfWorks || null,
      vehicleEquipmentDescription: vehicleEquipmentDescription || null,
      useComplexTemplate: useComplexTemplate || false,
      sequenceNumber,
      createdBy: req.user.id,
    });

    const saved = await clearance.save();
    const populated = await LeadClearance.findById(saved._id)
      .populate({
        path: "projectId",
        select: "projectID name client",
        populate: { path: "client", select: "name" },
      })
      .populate("createdBy", "firstName lastName");

    res.status(201).json(populated);
  } catch (error) {
    console.error("Error creating lead clearance:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Update lead clearance
router.put("/:id", auth, checkPermission(permEdit), async (req, res) => {
  try {
    const {
      projectId,
      leadRemovalJobId,
      clearanceDate,
      inspectionTime,
      status,
      secondaryHeader,
      consultant,
      leadAbatementContractor,
      jurisdiction,
      leadMonitoring,
      leadMonitoringReports,
      jobSpecificExclusions,
      notes,
      descriptionOfWorks,
      revision,
      revisionReasons,
      vehicleEquipmentDescription,
      useComplexTemplate,
      items,
    } = req.body;

    const clearance = await LeadClearance.findById(req.params.id);
    if (!clearance) {
      return res.status(404).json({ message: "Lead clearance not found" });
    }

    if (projectId !== undefined) clearance.projectId = projectId;
    if (leadRemovalJobId !== undefined)
      clearance.leadRemovalJobId = leadRemovalJobId || null;
    if (clearanceDate !== undefined) clearance.clearanceDate = clearanceDate;
    if (inspectionTime !== undefined)
      clearance.inspectionTime = inspectionTime;
    if (status !== undefined) clearance.status = status;
    if (secondaryHeader !== undefined)
      clearance.secondaryHeader = secondaryHeader;
    if (consultant !== undefined) clearance.consultant = consultant;
    if (leadAbatementContractor !== undefined)
      clearance.leadAbatementContractor = leadAbatementContractor;
    if (jurisdiction !== undefined) clearance.jurisdiction = jurisdiction;
    if (leadMonitoring !== undefined) clearance.leadMonitoring = leadMonitoring;
    if (leadMonitoringReports !== undefined)
      clearance.leadMonitoringReports = leadMonitoringReports;
    if (jobSpecificExclusions !== undefined)
      clearance.jobSpecificExclusions = jobSpecificExclusions;
    if (notes !== undefined) clearance.notes = notes;
    if (descriptionOfWorks !== undefined) clearance.descriptionOfWorks = descriptionOfWorks;
    if (revision !== undefined) clearance.revision = revision;
    if (revisionReasons !== undefined)
      clearance.revisionReasons = revisionReasons;
    if (vehicleEquipmentDescription !== undefined)
      clearance.vehicleEquipmentDescription = vehicleEquipmentDescription;
    if (useComplexTemplate !== undefined)
      clearance.useComplexTemplate = useComplexTemplate;
    if (items !== undefined) clearance.items = items;
    clearance.updatedBy = req.user.id;

    const updated = await clearance.save();
    const populated = await LeadClearance.findById(updated._id)
      .populate({
        path: "projectId",
        select: "projectID name client",
        populate: { path: "client", select: "name" },
      })
      .populate("createdBy", "firstName lastName")
      .populate("updatedBy", "firstName lastName");

    res.json(populated);
  } catch (error) {
    console.error("Error updating lead clearance:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// PATCH - report viewed
router.patch("/:id", auth, checkPermission(permEdit), async (req, res) => {
  try {
    const { reportViewedAt } = req.body;
    if (reportViewedAt === undefined) {
      return res.status(400).json({ message: "reportViewedAt is required" });
    }
    const clearance = await LeadClearance.findByIdAndUpdate(
      req.params.id,
      { reportViewedAt: reportViewedAt ? new Date(reportViewedAt) : null },
      { new: true }
    );
    if (!clearance) {
      return res.status(404).json({ message: "Lead clearance not found" });
    }
    res.json(clearance);
  } catch (error) {
    console.error("Error updating lead clearance reportViewedAt:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// PATCH status
router.patch("/:id/status", auth, checkPermission(permEdit), async (req, res) => {
  try {
    const { status } = req.body;
    const clearance = await LeadClearance.findById(req.params.id);
    if (!clearance) {
      return res.status(404).json({ message: "Lead clearance not found" });
    }
    clearance.status = status;
    clearance.updatedBy = req.user.id;
    const updated = await clearance.save();
    const populated = await LeadClearance.findById(updated._id)
      .populate({
        path: "projectId",
        select: "projectID name client",
        populate: { path: "client", select: "name" },
      })
      .populate("createdBy", "firstName lastName")
      .populate("updatedBy", "firstName lastName");
    res.json(populated);
  } catch (error) {
    console.error("Error updating lead clearance status:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Delete lead clearance
router.delete("/:id", auth, checkPermission(permDelete), async (req, res) => {
  try {
    const clearance = await LeadClearance.findByIdAndDelete(req.params.id);
    if (!clearance) {
      return res.status(404).json({ message: "Lead clearance not found" });
    }
    res.json({ message: "Lead clearance deleted successfully" });
  } catch (error) {
    console.error("Error deleting lead clearance:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Authorise report (parity with asbestos)
router.post("/:id/authorise", auth, checkPermission(permEdit), async (req, res) => {
  try {
    const clearance = await LeadClearance.findById(req.params.id)
      .populate({
        path: "projectId",
        select: "projectID name client",
        populate: { path: "client", select: "name" },
      });
    if (!clearance) {
      return res.status(404).json({ message: "Lead clearance not found" });
    }
    if (clearance.status !== "complete") {
      return res.status(400).json({
        message: "Clearance must be complete before authorising the report",
      });
    }
    if (clearance.reportApprovedBy) {
      return res.status(400).json({
        message: "Report has already been authorised",
      });
    }
    const approver =
      req.user?.firstName && req.user?.lastName
        ? `${req.user.firstName} ${req.user.lastName}`
        : req.user?.email || "Unknown";
    clearance.reportApprovedBy = approver;
    clearance.reportIssueDate = new Date();
    clearance.updatedBy = req.user.id;
    const updated = await clearance.save();
    const populated = await LeadClearance.findById(updated._id)
      .populate({
        path: "projectId",
        select: "projectID name client",
        populate: { path: "client", select: "name" },
      })
      .populate("createdBy", "firstName lastName")
      .populate("updatedBy", "firstName lastName");
    res.json(populated);
  } catch (error) {
    console.error("Error authorising lead clearance:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Get lead clearance sampling (pre-works and validation samples)
router.get("/:id/sampling", auth, checkPermission(permView), async (req, res) => {
  try {
    const clearance = await LeadClearance.findById(req.params.id);
    if (!clearance) {
      return res.status(404).json({ message: "Lead clearance not found" });
    }
    const sampling = clearance.sampling || {};
    res.json({
      preWorksSamples: Array.isArray(sampling.preWorksSamples) ? sampling.preWorksSamples : [],
      validationSamples: Array.isArray(sampling.validationSamples) ? sampling.validationSamples : [],
    });
  } catch (error) {
    console.error("Error fetching lead clearance sampling:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Update lead clearance sampling (pre-works and validation samples)
router.patch("/:id/sampling", auth, checkPermission(permEdit), async (req, res) => {
  try {
    const { preWorksSamples, validationSamples } = req.body;
    const clearance = await LeadClearance.findById(req.params.id);
    if (!clearance) {
      return res.status(404).json({ message: "Lead clearance not found" });
    }
    if (!clearance.sampling) clearance.sampling = {};
    if (Array.isArray(preWorksSamples)) clearance.sampling.preWorksSamples = preWorksSamples;
    if (Array.isArray(validationSamples)) clearance.sampling.validationSamples = validationSamples;
    clearance.updatedBy = req.user.id;
    await clearance.save();
    res.json({
      preWorksSamples: clearance.sampling.preWorksSamples || [],
      validationSamples: clearance.sampling.validationSamples || [],
    });
  } catch (error) {
    console.error("Error updating lead clearance sampling:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Get lead clearance items (embedded in clearance document)
router.get("/:id/items", auth, checkPermission(permView), async (req, res) => {
  try {
    const clearance = await LeadClearance.findById(req.params.id);
    if (!clearance) {
      return res.status(404).json({ message: "Lead clearance not found" });
    }
    res.json(clearance.items || []);
  } catch (error) {
    console.error("Error fetching lead clearance items:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Add lead clearance item (no asbestosType)
router.post("/:id/items", auth, checkPermission(permEdit), async (req, res) => {
  try {
    const { locationDescription, levelFloor, roomArea, worksCompleted, leadValidationType, samples, notes } = req.body;

    const clearance = await LeadClearance.findById(req.params.id);
    if (!clearance) {
      return res.status(404).json({ message: "Lead clearance not found" });
    }

    const newItem = {
      locationDescription: locationDescription || "",
      levelFloor: levelFloor || "",
      roomArea: roomArea || "",
      worksCompleted: worksCompleted || "",
      leadValidationType: leadValidationType || "",
      samples: Array.isArray(samples) ? samples : [],
      photographs: [],
      notes: notes || "",
    };

    clearance.items.push(newItem);
    clearance.updatedBy = req.user.id;

    const updatedClearance = await clearance.save();

    const populated = await LeadClearance.findById(updatedClearance._id)
      .populate({
        path: "projectId",
        select: "projectID name client",
        populate: { path: "client", select: "name" },
      })
      .populate("createdBy", "firstName lastName")
      .populate("updatedBy", "firstName lastName");

    res.status(201).json(populated);
  } catch (error) {
    console.error("Error adding lead clearance item:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Update lead clearance item
router.put("/:id/items/:itemId", auth, checkPermission(permEdit), async (req, res) => {
  try {
    const { locationDescription, levelFloor, roomArea, worksCompleted, leadValidationType, samples, notes } = req.body;

    const clearance = await LeadClearance.findById(req.params.id);
    if (!clearance) {
      return res.status(404).json({ message: "Lead clearance not found" });
    }

    const itemIndex = clearance.items.findIndex((item) => item._id.toString() === req.params.itemId);
    if (itemIndex === -1) {
      return res.status(404).json({ message: "Clearance item not found" });
    }

    const existingItem = clearance.items[itemIndex];
    if (locationDescription !== undefined) existingItem.locationDescription = locationDescription;
    if (levelFloor !== undefined) existingItem.levelFloor = levelFloor;
    if (roomArea !== undefined) existingItem.roomArea = roomArea;
    if (worksCompleted !== undefined) existingItem.worksCompleted = worksCompleted;
    if (leadValidationType !== undefined) existingItem.leadValidationType = leadValidationType || "";
    if (samples !== undefined) existingItem.samples = Array.isArray(samples) ? samples : [];
    if (notes !== undefined) existingItem.notes = notes;

    clearance.updatedBy = req.user.id;

    const updatedClearance = await clearance.save();

    const populated = await LeadClearance.findById(updatedClearance._id)
      .populate({
        path: "projectId",
        select: "projectID name client",
        populate: { path: "client", select: "name" },
      })
      .populate("createdBy", "firstName lastName")
      .populate("updatedBy", "firstName lastName");

    res.json(populated);
  } catch (error) {
    console.error("Error updating lead clearance item:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Delete lead clearance item
router.delete("/:id/items/:itemId", auth, checkPermission(permEdit), async (req, res) => {
  try {
    const clearance = await LeadClearance.findById(req.params.id);
    if (!clearance) {
      return res.status(404).json({ message: "Lead clearance not found" });
    }

    const itemIndex = clearance.items.findIndex((item) => item._id.toString() === req.params.itemId);
    if (itemIndex === -1) {
      return res.status(404).json({ message: "Clearance item not found" });
    }

    clearance.items.splice(itemIndex, 1);
    clearance.updatedBy = req.user.id;

    const updatedClearance = await clearance.save();

    const populated = await LeadClearance.findById(updatedClearance._id)
      .populate({
        path: "projectId",
        select: "projectID name client",
        populate: { path: "client", select: "name" },
      })
      .populate("createdBy", "firstName lastName")
      .populate("updatedBy", "firstName lastName");

    res.json(populated);
  } catch (error) {
    console.error("Error deleting lead clearance item:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Add photo to lead clearance item
router.post("/:id/items/:itemId/photos", auth, checkPermission(permEdit), async (req, res) => {
  try {
    const { photoData, includeInReport = true } = req.body;

    if (!photoData) {
      return res.status(400).json({ message: "Photo data is required" });
    }

    const clearance = await LeadClearance.findById(req.params.id);
    if (!clearance) {
      return res.status(404).json({ message: "Lead clearance not found" });
    }

    const item = clearance.items.id(req.params.itemId);
    if (!item) {
      return res.status(404).json({ message: "Clearance item not found" });
    }

    if (!item.photographs) {
      item.photographs = [];
    }

    const existingPhotoNumbers = item.photographs.map((p) => p.photoNumber || 0);
    const nextPhotoNumber = existingPhotoNumbers.length > 0 ? Math.max(...existingPhotoNumbers) + 1 : 1;

    item.photographs.push({
      data: photoData,
      includeInReport,
      uploadedAt: new Date(),
      photoNumber: nextPhotoNumber,
    });

    clearance.updatedBy = req.user.id;
    await clearance.save();

    res.status(201).json(item);
  } catch (error) {
    console.error("Error adding photo to lead clearance item:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Delete photo from lead clearance item
router.delete("/:id/items/:itemId/photos/:photoId", auth, checkPermission(permEdit), async (req, res) => {
  try {
    const clearance = await LeadClearance.findById(req.params.id);
    if (!clearance) {
      return res.status(404).json({ message: "Lead clearance not found" });
    }

    const item = clearance.items.id(req.params.itemId);
    if (!item) {
      return res.status(404).json({ message: "Clearance item not found" });
    }

    const photoIndex = item.photographs.findIndex((p) => p._id.toString() === req.params.photoId);
    if (photoIndex === -1) {
      return res.status(404).json({ message: "Photo not found" });
    }

    item.photographs.splice(photoIndex, 1);
    clearance.updatedBy = req.user.id;
    await clearance.save();

    res.json({ message: "Photo deleted successfully", item });
  } catch (error) {
    console.error("Error deleting photo from lead clearance item:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Toggle photo inclusion in report
router.patch("/:id/items/:itemId/photos/:photoId/toggle", auth, checkPermission(permEdit), async (req, res) => {
  try {
    const clearance = await LeadClearance.findById(req.params.id);
    if (!clearance) {
      return res.status(404).json({ message: "Lead clearance not found" });
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
router.patch("/:id/items/:itemId/photos/:photoId/description", auth, checkPermission(permEdit), async (req, res) => {
  try {
    const { description } = req.body;

    const clearance = await LeadClearance.findById(req.params.id);
    if (!clearance) {
      return res.status(404).json({ message: "Lead clearance not found" });
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

    res.json({ message: "Photo description updated", item });
  } catch (error) {
    console.error("Error updating photo description:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Send for authorisation (parity with asbestos)
router.post("/:id/send-for-authorisation", auth, checkPermission(permEdit), async (req, res) => {
  try {
    const clearance = await LeadClearance.findById(req.params.id);
    if (!clearance) {
      return res.status(404).json({ message: "Lead clearance not found" });
    }
    if (clearance.status !== "complete") {
      return res.status(400).json({
        message: "Clearance must be complete before sending for authorisation",
      });
    }
    clearance.authorisationRequestedBy = req.user.id;
    clearance.authorisationRequestedByEmail = req.user?.email || null;
    clearance.updatedBy = req.user.id;
    const updated = await clearance.save();
    const populated = await LeadClearance.findById(updated._id)
      .populate({
        path: "projectId",
        select: "projectID name client",
        populate: { path: "client", select: "name" },
      })
      .populate("createdBy", "firstName lastName")
      .populate("updatedBy", "firstName lastName");
    res.json(populated);
  } catch (error) {
    console.error("Error sending lead clearance for authorisation:", error);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
