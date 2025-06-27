const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const checkPermission = require("../middleware/checkPermission");
const Equipment = require("../models/Equipment");

// Get all equipment
router.get("/", auth, checkPermission("equipment.view"), async (req, res) => {
  try {
    const { page = 1, limit = 10, search = "", equipmentType = "", section = "", status = "" } = req.query;
    
    let query = {};
    
    // Add search functionality
    if (search) {
      query.$or = [
        { equipmentReference: { $regex: search, $options: "i" } },
        { brandModel: { $regex: search, $options: "i" } },
      ];
    }
    
    // Add equipment type filter
    if (equipmentType) {
      query.equipmentType = equipmentType;
    }
    
    // Add section filter
    if (section) {
      query.section = section;
    }
    
    // Add status filter
    if (status) {
      query.status = status;
    }
    
    const skip = (page - 1) * limit;
    
    const equipment = await Equipment.find(query)
      .sort({ equipmentReference: 1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await Equipment.countDocuments(query);
    
    res.json({
      equipment,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Error fetching equipment:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Get equipment by ID
router.get("/:id", auth, checkPermission("equipment.view"), async (req, res) => {
  try {
    const equipment = await Equipment.findById(req.params.id);
    
    if (!equipment) {
      return res.status(404).json({ message: "Equipment not found" });
    }
    
    res.json({ equipment });
  } catch (error) {
    console.error("Error fetching equipment:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Create new equipment
router.post("/", auth, checkPermission("equipment.create"), async (req, res) => {
  try {
    const { 
      equipmentReference, 
      equipmentType, 
      section, 
      brandModel, 
      status,
      lastCalibration, 
      calibrationDue, 
      calibrationFrequency 
    } = req.body;
    
    // Check if equipment reference already exists
    const existingEquipment = await Equipment.findOne({ equipmentReference });
    if (existingEquipment) {
      return res.status(400).json({ message: "Equipment reference already exists" });
    }
    
    const equipment = new Equipment({
      equipmentReference,
      equipmentType,
      section,
      brandModel,
      status,
      lastCalibration,
      calibrationDue,
      calibrationFrequency,
    });
    
    await equipment.save();
    
    res.status(201).json({ 
      message: "Equipment created successfully",
      equipment 
    });
  } catch (error) {
    console.error("Error creating equipment:", error);
    if (error.name === "ValidationError") {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: "Server error" });
  }
});

// Update equipment
router.put("/:id", auth, checkPermission("equipment.edit"), async (req, res) => {
  try {
    const { 
      equipmentReference, 
      equipmentType, 
      section, 
      brandModel, 
      status,
      lastCalibration, 
      calibrationDue, 
      calibrationFrequency 
    } = req.body;
    
    // Check if equipment reference already exists for different equipment
    if (equipmentReference) {
      const existingEquipment = await Equipment.findOne({ 
        equipmentReference, 
        _id: { $ne: req.params.id } 
      });
      if (existingEquipment) {
        return res.status(400).json({ message: "Equipment reference already exists" });
      }
    }
    
    const equipment = await Equipment.findByIdAndUpdate(
      req.params.id,
      {
        equipmentReference,
        equipmentType,
        section,
        brandModel,
        status,
        lastCalibration,
        calibrationDue,
        calibrationFrequency,
      },
      { new: true, runValidators: true }
    );
    
    if (!equipment) {
      return res.status(404).json({ message: "Equipment not found" });
    }
    
    res.json({ 
      message: "Equipment updated successfully",
      equipment 
    });
  } catch (error) {
    console.error("Error updating equipment:", error);
    if (error.name === "ValidationError") {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: "Server error" });
  }
});

// Delete equipment
router.delete("/:id", auth, checkPermission("equipment.delete"), async (req, res) => {
  try {
    const equipment = await Equipment.findByIdAndDelete(req.params.id);
    
    if (!equipment) {
      return res.status(404).json({ message: "Equipment not found" });
    }
    
    res.json({ message: "Equipment deleted successfully" });
  } catch (error) {
    console.error("Error deleting equipment:", error);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router; 