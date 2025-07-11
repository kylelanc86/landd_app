const express = require("express");
const router = express.Router();
const NonFriableClearance = require("../models/clearanceTemplates/asbestos/NonFriableClearance");
const FriableClearance = require("../models/clearanceTemplates/asbestos/FriableClearance");
const auth = require("../middleware/auth");
const checkPermission = require("../middleware/checkPermission");

// Get all asbestos clearance templates
router.get("/", auth, checkPermission("admin.view"), async (req, res) => {
  try {
    const nonFriableTemplates = await NonFriableClearance.find()
      .populate("createdBy", "firstName lastName")
      .populate("updatedBy", "firstName lastName")
      .sort({ createdAt: -1 });

    const friableTemplates = await FriableClearance.find()
      .populate("createdBy", "firstName lastName")
      .populate("updatedBy", "firstName lastName")
      .sort({ createdAt: -1 });

    // Combine and format the results
    const allTemplates = [
      ...nonFriableTemplates.map(template => ({
        ...template.toObject(),
        templateType: "asbestosClearanceNonFriable"
      })),
      ...friableTemplates.map(template => ({
        ...template.toObject(),
        templateType: "asbestosClearanceFriable"
      }))
    ];

    res.json(allTemplates);
  } catch (error) {
    console.error("Error fetching asbestos clearance templates:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Get a specific asbestos clearance template by type
router.get("/:templateType", auth, checkPermission("admin.view"), async (req, res) => {
  try {
    const { templateType } = req.params;
    let template;

    if (templateType === "asbestosClearanceNonFriable") {
      template = await NonFriableClearance.findOne()
        .populate("createdBy", "firstName lastName")
        .populate("updatedBy", "firstName lastName");
    } else if (templateType === "asbestosClearanceFriable") {
      template = await FriableClearance.findOne()
        .populate("createdBy", "firstName lastName")
        .populate("updatedBy", "firstName lastName");
    }

    if (!template) {
      return res.status(404).json({ message: "Asbestos clearance template not found" });
    }

    // Add templateType to the response
    const response = {
      ...template.toObject(),
      templateType
    };

    res.json(response);
  } catch (error) {
    console.error("Error fetching asbestos clearance template:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Create a new asbestos clearance template
router.post("/", auth, checkPermission("admin.create"), async (req, res) => {
  try {
    const { templateType, companyDetails, reportHeaders, standardSections } = req.body;

    let template;
    let populatedTemplate;

    if (templateType === "asbestosClearanceNonFriable") {
      // Check if template already exists
      const existingTemplate = await NonFriableClearance.findOne();
      if (existingTemplate) {
        return res.status(400).json({ message: "Non-friable clearance template already exists" });
      }

      template = new NonFriableClearance({
        companyDetails,
        reportHeaders,
        standardSections,
        createdBy: req.user.id,
      });
    } else if (templateType === "asbestosClearanceFriable") {
      // Check if template already exists
      const existingTemplate = await FriableClearance.findOne();
      if (existingTemplate) {
        return res.status(400).json({ message: "Friable clearance template already exists" });
      }

      template = new FriableClearance({
        companyDetails,
        reportHeaders,
        standardSections,
        createdBy: req.user.id,
      });
    } else {
      return res.status(400).json({ message: "Invalid template type" });
    }

    await template.save();
    
    populatedTemplate = await template.populate([
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
    console.error("Error creating asbestos clearance template:", error);
    if (error.name === "ValidationError") {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: "Server error" });
  }
});

// Update an asbestos clearance template
router.put("/:templateType", auth, checkPermission("admin.edit"), async (req, res) => {
  try {
    const { templateType } = req.params;
    console.log('Update request body:', req.body);

    let template;
    let populatedTemplate;

    if (templateType === "asbestosClearanceNonFriable") {
      template = await NonFriableClearance.findOne();
    } else if (templateType === "asbestosClearanceFriable") {
      template = await FriableClearance.findOne();
    } else {
      return res.status(400).json({ message: "Invalid template type" });
    }
    
    if (!template) {
      return res.status(404).json({ message: "Asbestos clearance template not found" });
    }

    // Handle nested updates for standardSections
    if (req.body.standardSections) {
      // If standardSections is provided, merge it with existing standardSections
      template.standardSections = {
        ...template.standardSections,
        ...req.body.standardSections
      };
      console.log('Updated standardSections:', template.standardSections);
    }

    // Handle other top-level updates
    if (req.body.companyDetails) template.companyDetails = req.body.companyDetails;
    if (req.body.reportHeaders) template.reportHeaders = req.body.reportHeaders;
    
    template.updatedBy = req.user.id;

    await template.save();
    
    populatedTemplate = await template.populate([
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
    console.error("Error updating asbestos clearance template:", error);
    if (error.name === "ValidationError") {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: "Server error" });
  }
});

// Delete an asbestos clearance template
router.delete("/:templateType", auth, checkPermission("admin.delete"), async (req, res) => {
  try {
    const { templateType } = req.params;
    let template;

    if (templateType === "asbestosClearanceNonFriable") {
      template = await NonFriableClearance.findOneAndDelete();
    } else if (templateType === "asbestosClearanceFriable") {
      template = await FriableClearance.findOneAndDelete();
    } else {
      return res.status(400).json({ message: "Invalid template type" });
    }

    if (!template) {
      return res.status(404).json({ message: "Asbestos clearance template not found" });
    }

    res.json({ message: "Asbestos clearance template deleted successfully" });
  } catch (error) {
    console.error("Error deleting asbestos clearance template:", error);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router; 