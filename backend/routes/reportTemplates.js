const express = require("express");
const router = express.Router();
const ReportTemplate = require("../models/ReportTemplate");
const auth = require("../middleware/auth");
const checkPermission = require("../middleware/checkPermission");

// Get all report templates
router.get("/", auth, checkPermission("admin.view"), async (req, res) => {
  try {
    const templates = await ReportTemplate.find()
      .populate("createdBy", "firstName lastName")
      .populate("updatedBy", "firstName lastName")
      .sort({ createdAt: -1 });

    res.json(templates);
  } catch (error) {
    console.error("Error fetching report templates:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Get a specific report template by type
router.get("/:templateType", auth, checkPermission("admin.view"), async (req, res) => {
  try {
    const template = await ReportTemplate.findOne({ 
      templateType: req.params.templateType 
    })
      .populate("createdBy", "firstName lastName")
      .populate("updatedBy", "firstName lastName");

    if (!template) {
      return res.status(404).json({ message: "Report template not found" });
    }

    res.json(template);
  } catch (error) {
    console.error("Error fetching report template:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Create a new report template
router.post("/", auth, checkPermission("admin.create"), async (req, res) => {
  try {
    const { templateType, companyDetails, reportHeaders, standardSections } = req.body;

    // Check if template already exists
    const existingTemplate = await ReportTemplate.findOne({ templateType });
    if (existingTemplate) {
      return res.status(400).json({ message: "Template already exists for this type" });
    }

    const template = new ReportTemplate({
      templateType,
      companyDetails,
      reportHeaders,
      standardSections,
      createdBy: req.user.id,
    });

    await template.save();
    
    const populatedTemplate = await template.populate([
      { path: "createdBy", select: "firstName lastName" },
      { path: "updatedBy", select: "firstName lastName" }
    ]);

    res.status(201).json(populatedTemplate);
  } catch (error) {
    console.error("Error creating report template:", error);
    if (error.name === "ValidationError") {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: "Server error" });
  }
});

// Update a report template
router.put("/:templateType", auth, checkPermission("admin.edit"), async (req, res) => {
  try {
    const { companyDetails, reportHeaders, standardSections } = req.body;

    const template = await ReportTemplate.findOne({ templateType: req.params.templateType });
    
    if (!template) {
      return res.status(404).json({ message: "Report template not found" });
    }

    // Update fields
    if (companyDetails) template.companyDetails = companyDetails;
    if (reportHeaders) template.reportHeaders = reportHeaders;
    if (standardSections) template.standardSections = standardSections;
    
    template.updatedBy = req.user.id;

    await template.save();
    
    const populatedTemplate = await template.populate([
      { path: "createdBy", select: "firstName lastName" },
      { path: "updatedBy", select: "firstName lastName" }
    ]);

    res.json(populatedTemplate);
  } catch (error) {
    console.error("Error updating report template:", error);
    if (error.name === "ValidationError") {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: "Server error" });
  }
});

// Delete a report template
router.delete("/:templateType", auth, checkPermission("admin.delete"), async (req, res) => {
  try {
    const template = await ReportTemplate.findOneAndDelete({ 
      templateType: req.params.templateType 
    });

    if (!template) {
      return res.status(404).json({ message: "Report template not found" });
    }

    res.json({ message: "Report template deleted successfully" });
  } catch (error) {
    console.error("Error deleting report template:", error);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router; 