const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const AsbestosAssessmentTemplate = require("../models/assessmentTemplates/asbestos/AsbestosAssessmentTemplate");
const User = require("../models/User");
const auth = require("../middleware/auth");
const checkPermission = require("../middleware/checkPermission");

// Get all asbestos assessment templates
router.get("/", auth, checkPermission("admin.view"), async (req, res) => {
  try {
    const templates = await AsbestosAssessmentTemplate.find()
      .populate("createdBy", "firstName lastName")
      .populate("updatedBy", "firstName lastName")
      .sort({ createdAt: -1 });

    // Add templateType to each template
    const formattedTemplates = templates.map(template => ({
      ...template.toObject(),
      templateType: "asbestosAssessment"
    }));

    res.json(formattedTemplates);
  } catch (error) {
    console.error("Error fetching asbestos assessment templates:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Get a specific asbestos assessment template by type
router.get("/:templateType", auth, checkPermission("admin.view"), async (req, res) => {
  try {
    const template = await AsbestosAssessmentTemplate.findOne()
      .populate("createdBy", "firstName lastName")
      .populate("updatedBy", "firstName lastName");

    if (!template) {
      return res.status(404).json({ message: "Asbestos assessment template not found" });
    }

    // Add templateType to the response
    const response = {
      ...template.toObject(),
      templateType: "asbestosAssessment"
    };

    res.json(response);
  } catch (error) {
    console.error("Error fetching asbestos assessment template:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Create a new asbestos assessment template
router.post("/", auth, checkPermission("admin.create"), async (req, res) => {
  try {
    const { companyDetails, reportHeaders, standardSections } = req.body;

    // Check if template already exists
    const existingTemplate = await AsbestosAssessmentTemplate.findOne();
    if (existingTemplate) {
      return res.status(400).json({ message: "Asbestos assessment template already exists" });
    }

    const template = new AsbestosAssessmentTemplate({
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

    // Add templateType to the response
    const response = {
      ...populatedTemplate.toObject(),
      templateType: "asbestosAssessment"
    };

    res.status(201).json(response);
  } catch (error) {
    console.error("Error creating asbestos assessment template:", error);
    if (error.name === "ValidationError") {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: "Server error" });
  }
});

// Update an asbestos assessment template
router.put("/:templateType", auth, checkPermission("admin.edit"), async (req, res) => {
  try {
    const template = await AsbestosAssessmentTemplate.findOne();
    
    if (!template) {
      return res.status(404).json({ message: "Asbestos assessment template not found" });
    }

    // Handle nested updates for standardSections
    if (req.body.standardSections) {
      template.standardSections = {
        ...template.standardSections,
        ...req.body.standardSections
      };
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
      templateType: "asbestosAssessment"
    };

    res.json(response);
  } catch (error) {
    console.error("Error updating asbestos assessment template:", error);
    if (error.name === "ValidationError") {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: "Server error" });
  }
});

// Delete an asbestos assessment template
router.delete("/:templateType", auth, checkPermission("admin.delete"), async (req, res) => {
  try {
    const template = await AsbestosAssessmentTemplate.findOneAndDelete();

    if (!template) {
      return res.status(404).json({ message: "Asbestos assessment template not found" });
    }

    res.json({ message: "Asbestos assessment template deleted successfully" });
  } catch (error) {
    console.error("Error deleting asbestos assessment template:", error);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router; 