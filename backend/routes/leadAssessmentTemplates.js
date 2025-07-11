const express = require("express");
const router = express.Router();
const LeadAssessment = require("../models/assessmentTemplates/lead/LeadAssessment");
const auth = require("../middleware/auth");
const checkPermission = require("../middleware/checkPermission");

// Get all lead assessment templates
router.get("/", auth, checkPermission("admin.view"), async (req, res) => {
  try {
    const templates = await LeadAssessment.find()
      .populate("createdBy", "firstName lastName")
      .populate("updatedBy", "firstName lastName")
      .sort({ createdAt: -1 });

    // Add templateType to each template
    const formattedTemplates = templates.map(template => ({
      ...template.toObject(),
      templateType: "leadAssessment"
    }));

    res.json(formattedTemplates);
  } catch (error) {
    console.error("Error fetching lead assessment templates:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Get a specific lead assessment template
router.get("/:templateType", auth, checkPermission("admin.view"), async (req, res) => {
  try {
    const { templateType } = req.params;

    if (templateType !== "leadAssessment") {
      return res.status(400).json({ message: "Invalid template type" });
    }

    const template = await LeadAssessment.findOne()
      .populate("createdBy", "firstName lastName")
      .populate("updatedBy", "firstName lastName");

    if (!template) {
      return res.status(404).json({ message: "Lead assessment template not found" });
    }

    // Add templateType to the response
    const response = {
      ...template.toObject(),
      templateType
    };

    res.json(response);
  } catch (error) {
    console.error("Error fetching lead assessment template:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Create a new lead assessment template
router.post("/", auth, checkPermission("admin.create"), async (req, res) => {
  try {
    const { templateType, companyDetails, reportHeaders, leadAssessmentSections } = req.body;

    if (templateType !== "leadAssessment") {
      return res.status(400).json({ message: "Invalid template type" });
    }

    // Check if template already exists
    const existingTemplate = await LeadAssessment.findOne();
    if (existingTemplate) {
      return res.status(400).json({ message: "Lead assessment template already exists" });
    }

    const template = new LeadAssessment({
      companyDetails,
      reportHeaders,
      leadAssessmentSections,
      createdBy: req.user.id,
    });

    await template.save();
    
    const populatedTemplate = await template.populate([
      { path: "createdBy", select: "firstName lastName" },
      { path: "updatedBy", select: "firstName lastName" }
    ]);

    // Add templateType to the response
    const response = {
      ...populatedTemplate.toObject(),
      templateType
    };

    res.status(201).json(response);
  } catch (error) {
    console.error("Error creating lead assessment template:", error);
    if (error.name === "ValidationError") {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: "Server error" });
  }
});

// Update a lead assessment template
router.put("/:templateType", auth, checkPermission("admin.edit"), async (req, res) => {
  try {
    const { templateType } = req.params;
    console.log('Update request body:', req.body);

    if (templateType !== "leadAssessment") {
      return res.status(400).json({ message: "Invalid template type" });
    }

    const template = await LeadAssessment.findOne();
    
    if (!template) {
      return res.status(404).json({ message: "Lead assessment template not found" });
    }

    // Handle nested updates for leadAssessmentSections
    if (req.body.leadAssessmentSections) {
      // If leadAssessmentSections is provided, merge it with existing leadAssessmentSections
      template.leadAssessmentSections = {
        ...template.leadAssessmentSections,
        ...req.body.leadAssessmentSections
      };
      console.log('Updated leadAssessmentSections:', template.leadAssessmentSections);
    }

    // Handle other top-level updates
    if (req.body.companyDetails) template.companyDetails = req.body.companyDetails;
    if (req.body.reportHeaders) template.reportHeaders = req.body.reportHeaders;
    
    template.updatedBy = req.user.id;

    await template.save();
    
    const populatedTemplate = await template.populate([
      { path: "createdBy", select: "firstName lastName" },
      { path: "updatedBy", select: "firstName lastName" }
    ]);

    // Add templateType to the response
    const response = {
      ...populatedTemplate.toObject(),
      templateType
    };

    res.json(response);
  } catch (error) {
    console.error("Error updating lead assessment template:", error);
    if (error.name === "ValidationError") {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: "Server error" });
  }
});

// Delete a lead assessment template
router.delete("/:templateType", auth, checkPermission("admin.delete"), async (req, res) => {
  try {
    const { templateType } = req.params;

    if (templateType !== "leadAssessment") {
      return res.status(400).json({ message: "Invalid template type" });
    }

    const template = await LeadAssessment.findOneAndDelete();

    if (!template) {
      return res.status(404).json({ message: "Lead assessment template not found" });
    }

    res.json({ message: "Lead assessment template deleted successfully" });
  } catch (error) {
    console.error("Error deleting lead assessment template:", error);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router; 