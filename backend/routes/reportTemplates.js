const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const checkPermission = require("../middleware/checkPermission");
const ReportTemplate = require("../models/ReportTemplate");

// Get all report templates
router.get("/", auth, checkPermission("admin.view"), async (req, res) => {
  try {
    const templates = await ReportTemplate.find({})
      .populate("createdBy", "firstName lastName")
      .populate("updatedBy", "firstName lastName")
      .sort({ createdAt: -1 });

    res.json(templates);
  } catch (error) {
    console.error("Error fetching report templates:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Get a specific template by type
router.get("/:templateType", auth, checkPermission("admin.view"), async (req, res) => {
  try {
    const { templateType } = req.params;
    
    const template = await ReportTemplate.findOne({ templateType })
      .populate("createdBy", "firstName lastName")
      .populate("updatedBy", "firstName lastName");

    if (!template) {
      return res.status(404).json({ message: "Template not found" });
    }

    res.json(template);
  } catch (error) {
    console.error("Error fetching template:", error);
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
      return res.status(400).json({ message: `${templateType} template already exists` });
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
router.put("/:templateType", auth, checkPermission("admin.update"), async (req, res) => {
  try {
    const { templateType } = req.params;
    const updateData = req.body;

    const template = await ReportTemplate.findOne({ templateType });
    if (!template) {
      return res.status(404).json({ message: "Template not found" });
    }

    // Update the template
    Object.assign(template, updateData, { updatedBy: req.user.id });
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

// Update specific sections of a template
router.patch("/:templateType", auth, checkPermission("admin.update"), async (req, res) => {
  try {
    const { templateType } = req.params;
    const updateData = req.body;

    const template = await ReportTemplate.findOne({ templateType });
    if (!template) {
      return res.status(404).json({ message: "Template not found" });
    }

    // Handle nested updates for standardSections
    if (updateData.standardSections) {
      template.standardSections = {
        ...template.standardSections,
        ...updateData.standardSections
      };
    }

    // Handle other direct field updates
    if (updateData.companyDetails) {
      template.companyDetails = {
        ...template.companyDetails,
        ...updateData.companyDetails
      };
    }

    if (updateData.reportHeaders) {
      template.reportHeaders = {
        ...template.reportHeaders,
        ...updateData.reportHeaders
      };
    }

    template.updatedBy = req.user.id;
    await template.save();
    
    const populatedTemplate = await template.populate([
      { path: "createdBy", select: "firstName lastName" },
      { path: "updatedBy", select: "firstName lastName" }
    ]);

    res.json(populatedTemplate);
  } catch (error) {
    console.error("Error updating report template sections:", error);
    if (error.name === "ValidationError") {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: "Server error" });
  }
});

// Delete a report template
router.delete("/:templateType", auth, checkPermission("admin.delete"), async (req, res) => {
  try {
    const { templateType } = req.params;
    
    const template = await ReportTemplate.findOneAndDelete({ templateType });
    if (!template) {
      return res.status(404).json({ message: "Template not found" });
    }

    res.json({ message: `${templateType} template deleted successfully` });
  } catch (error) {
    console.error("Error deleting report template:", error);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
