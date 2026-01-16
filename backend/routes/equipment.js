const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const auth = require("../middleware/auth");
const checkPermission = require("../middleware/checkPermission");
const Equipment = require("../models/Equipment");
const FlowmeterCalibration = require("../models/FlowmeterCalibration");
const GraticuleCalibration = require("../models/GraticuleCalibration");
const HSETestSlideCalibration = require("../models/HSETestSlideCalibration");
const AirPumpCalibration = require("../models/AirPumpCalibration");
const AirPump = require("../models/AirPump");

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

// Get equipment by ID or reference
router.get("/:id", auth, checkPermission("equipment.view"), async (req, res) => {
  try {
    let equipment;
    
    // Check if the parameter is a valid MongoDB ObjectId
    if (mongoose.Types.ObjectId.isValid(req.params.id)) {
      // Search by _id
      equipment = await Equipment.findById(req.params.id);
    } else {
      // Search by equipmentReference
      equipment = await Equipment.findOne({ equipmentReference: req.params.id });
    }
    
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

// Helper function to recalculate calibration dates when frequency changes
const recalculateCalibrationDates = async (equipmentReference, newCalibrationFrequency) => {
  if (!newCalibrationFrequency) {
    console.log(`Skipping recalculation for ${equipmentReference}: no calibration frequency provided`);
    return;
  }

  try {
    console.log(`Starting recalculation for ${equipmentReference} with frequency ${newCalibrationFrequency} months`);
    let updatedCount = 0;

    // Recalculate FlowmeterCalibration records
    const flowmeterCalibrations = await FlowmeterCalibration.find({ 
      flowmeterId: equipmentReference 
    });
    console.log(`Found ${flowmeterCalibrations.length} FlowmeterCalibration records`);
    for (const cal of flowmeterCalibrations) {
      if (cal.date) {
        const nextDue = new Date(cal.date);
        nextDue.setMonth(nextDue.getMonth() + newCalibrationFrequency);
        cal.nextCalibration = nextDue;
        // Use updateOne to bypass pre-save middleware that might recalculate
        await FlowmeterCalibration.updateOne(
          { _id: cal._id },
          { $set: { nextCalibration: nextDue } }
        );
        updatedCount++;
      }
    }

    // Recalculate GraticuleCalibration records
    const graticuleCalibrations = await GraticuleCalibration.find({ 
      graticuleId: equipmentReference 
    });
    console.log(`Found ${graticuleCalibrations.length} GraticuleCalibration records`);
    for (const cal of graticuleCalibrations) {
      if (cal.date) {
        const nextDue = new Date(cal.date);
        nextDue.setMonth(nextDue.getMonth() + newCalibrationFrequency);
        // Use updateOne to bypass pre-save middleware
        await GraticuleCalibration.updateOne(
          { _id: cal._id },
          { $set: { nextCalibration: nextDue } }
        );
        updatedCount++;
      }
    }

    // Recalculate HSETestSlideCalibration records
    const hseCalibrations = await HSETestSlideCalibration.find({ 
      testSlideReference: equipmentReference 
    });
    console.log(`Found ${hseCalibrations.length} HSETestSlideCalibration records`);
    for (const cal of hseCalibrations) {
      if (cal.date) {
        const nextDue = new Date(cal.date);
        nextDue.setMonth(nextDue.getMonth() + newCalibrationFrequency);
        // Use updateOne to bypass pre-save middleware
        await HSETestSlideCalibration.updateOne(
          { _id: cal._id },
          { $set: { nextCalibration: nextDue } }
        );
        updatedCount++;
      }
    }

    // Recalculate AirPumpCalibration records (through AirPump model)
    const airPump = await AirPump.findOne({ pumpReference: equipmentReference });
    if (airPump) {
      const airPumpCalibrations = await AirPumpCalibration.find({ 
        pumpId: airPump._id 
      });
      console.log(`Found ${airPumpCalibrations.length} AirPumpCalibration records`);
      for (const cal of airPumpCalibrations) {
        if (cal.calibrationDate) {
          const nextDue = new Date(cal.calibrationDate);
          nextDue.setMonth(nextDue.getMonth() + newCalibrationFrequency);
          // Use updateOne to bypass pre-save middleware
          await AirPumpCalibration.updateOne(
            { _id: cal._id },
            { $set: { nextCalibrationDue: nextDue } }
          );
          updatedCount++;
        }
      }
    }

    console.log(`Completed recalculation for ${equipmentReference}: updated ${updatedCount} calibration records`);
  } catch (error) {
    console.error(`Error recalculating calibration dates for ${equipmentReference}:`, error);
    // Don't throw - we don't want to fail the equipment update if recalculation fails
  }
};

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
    
    // Get the existing equipment to check if calibration frequency is changing
    const existingEquipment = await Equipment.findById(req.params.id);
    if (!existingEquipment) {
      return res.status(404).json({ message: "Equipment not found" });
    }
    
    // Check if equipment reference already exists for different equipment
    if (equipmentReference) {
      const duplicateEquipment = await Equipment.findOne({ 
        equipmentReference, 
        _id: { $ne: req.params.id } 
      });
      if (duplicateEquipment) {
        return res.status(400).json({ message: "Equipment reference already exists" });
      }
    }
    
    // Build update object, explicitly handling null for calibrationFrequency
    const updateData = {
      equipmentReference,
      equipmentType,
      section,
      brandModel,
      status,
      lastCalibration,
      calibrationDue,
    };
    
    // Explicitly set calibrationFrequency to null if provided as null/undefined, otherwise use the value
    if (calibrationFrequency !== undefined) {
      updateData.calibrationFrequency = calibrationFrequency === null || calibrationFrequency === "" ? null : calibrationFrequency;
    }
    
    const equipment = await Equipment.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );
    
    if (!equipment) {
      return res.status(404).json({ message: "Equipment not found" });
    }
    
    // If calibration frequency changed, recalculate calibration dates
    const equipmentRef = equipment.equipmentReference || equipmentReference || existingEquipment.equipmentReference;
    const oldFrequency = existingEquipment.calibrationFrequency;
    const newFrequency = calibrationFrequency !== undefined ? calibrationFrequency : existingEquipment.calibrationFrequency;
    
    // Compare frequencies, converting to numbers if needed to handle type mismatches
    const oldFreqNum = oldFrequency !== null && oldFrequency !== undefined ? Number(oldFrequency) : null;
    const newFreqNum = newFrequency !== null && newFrequency !== undefined ? Number(newFrequency) : null;
    
    // Only recalculate if calibrationFrequency was explicitly provided and it changed
    if (calibrationFrequency !== undefined && 
        oldFreqNum !== newFreqNum) {
      console.log(`Recalculating calibration dates for ${equipmentRef}: ${oldFreqNum} -> ${newFreqNum} months`);
      try {
        await recalculateCalibrationDates(equipmentRef, newFreqNum);
        console.log(`Successfully recalculated calibration dates for ${equipmentRef}`);
      } catch (recalcError) {
        console.error(`Failed to recalculate calibration dates for ${equipmentRef}:`, recalcError);
        // Log but don't fail the request
      }
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