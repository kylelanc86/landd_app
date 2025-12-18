const express = require('express');
const router = express.Router();
const CalibrationFrequency = require('../models/CalibrationFrequency');
const VariableCalibrationFrequency = require('../models/VariableCalibrationFrequency');
const Equipment = require('../models/Equipment');
const FlowmeterCalibration = require('../models/FlowmeterCalibration');
const GraticuleCalibration = require('../models/GraticuleCalibration');
const HSETestSlideCalibration = require('../models/HSETestSlideCalibration');
const AirPumpCalibration = require('../models/AirPumpCalibration');
const AirPump = require('../models/AirPump');
const auth = require('../middleware/auth');
const checkPermission = require('../middleware/checkPermission');

// Helper function to recalculate calibration dates for an equipment reference
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
    // Don't throw - we don't want to fail if recalculation fails
  }
};

// Helper function to recalculate calibration dates for all equipment of a type
const recalculateCalibrationDatesForEquipmentType = async (equipmentType, newCalibrationFrequency) => {
  if (!newCalibrationFrequency) return;

  try {
    // Get all equipment of this type
    const equipmentList = await Equipment.find({ equipmentType });
    
    // Recalculate calibration dates for each equipment
    for (const equipment of equipmentList) {
      await recalculateCalibrationDates(equipment.equipmentReference, newCalibrationFrequency);
    }
  } catch (error) {
    console.error(`Error recalculating calibration dates for equipment type ${equipmentType}:`, error);
    // Don't throw - we don't want to fail if recalculation fails
  }
};

// ===== FIXED CALIBRATION FREQUENCY ROUTES =====

// Get all fixed calibration frequencies
router.get('/fixed', auth, checkPermission(['admin.access']), async (req, res) => {
  try {
    const frequencies = await CalibrationFrequency.find()
      .populate('createdBy', 'firstName lastName')
      .populate('updatedBy', 'firstName lastName')
      .sort({ equipmentType: 1 });

    res.json({
      data: frequencies.map(freq => ({
        _id: freq._id,
        equipmentType: freq.equipmentType,
        frequencyValue: freq.frequencyValue,
        frequencyUnit: freq.frequencyUnit,
        createdBy: freq.createdBy,
        updatedBy: freq.updatedBy,
        createdAt: freq.createdAt,
        updatedAt: freq.updatedAt
      }))
    });
  } catch (error) {
    console.error('Error fetching calibration frequencies:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get single fixed calibration frequency
router.get('/fixed/:id', auth, checkPermission(['admin.access']), async (req, res) => {
  try {
    const frequency = await CalibrationFrequency.findById(req.params.id)
      .populate('createdBy', 'firstName lastName')
      .populate('updatedBy', 'firstName lastName');

    if (!frequency) {
      return res.status(404).json({ message: 'Calibration frequency not found' });
    }

    res.json({
      _id: frequency._id,
      equipmentType: frequency.equipmentType,
      frequencyValue: frequency.frequencyValue,
      frequencyUnit: frequency.frequencyUnit,
      createdBy: frequency.createdBy,
      updatedBy: frequency.updatedBy,
      createdAt: frequency.createdAt,
      updatedAt: frequency.updatedAt
    });
  } catch (error) {
    console.error('Error fetching calibration frequency:', error);
    res.status(500).json({ message: error.message });
  }
});

// Create new fixed calibration frequency
router.post('/fixed', auth, checkPermission(['admin.access']), async (req, res) => {
  try {
    const frequencyData = {
      ...req.body,
      createdBy: req.user.id,
      updatedBy: req.user.id
    };

    const frequency = new CalibrationFrequency(frequencyData);
    const savedFrequency = await frequency.save();

    // Update all Equipment records of this type with the new calibration frequency (in months)
    try {
      let calibrationFrequencyInMonths = null;
      if (savedFrequency.frequencyUnit === 'years') {
        calibrationFrequencyInMonths = savedFrequency.frequencyValue * 12;
      } else {
        calibrationFrequencyInMonths = savedFrequency.frequencyValue;
      }

      // Update all equipment of this type
      await Equipment.updateMany(
        { equipmentType: savedFrequency.equipmentType },
        { $set: { calibrationFrequency: calibrationFrequencyInMonths } }
      );
      
      console.log(`Updated calibration frequency for all ${savedFrequency.equipmentType} equipment to ${calibrationFrequencyInMonths} months`);

      // Recalculate calibration dates for all equipment of this type
      await recalculateCalibrationDatesForEquipmentType(savedFrequency.equipmentType, calibrationFrequencyInMonths);
    } catch (equipmentUpdateError) {
      // Log error but don't fail the request
      console.error('Error updating equipment calibration frequencies:', equipmentUpdateError);
    }

    const populatedFrequency = await CalibrationFrequency.findById(savedFrequency._id)
      .populate('createdBy', 'firstName lastName')
      .populate('updatedBy', 'firstName lastName');

    res.status(201).json(populatedFrequency);
  } catch (error) {
    console.error('Error creating calibration frequency:', error);
    res.status(400).json({ message: error.message });
  }
});

// Update fixed calibration frequency
router.put('/fixed/:id', auth, checkPermission(['admin.access']), async (req, res) => {
  try {
    const frequency = await CalibrationFrequency.findById(req.params.id);
    if (!frequency) {
      return res.status(404).json({ message: 'Calibration frequency not found' });
    }

    // Store old equipment type for updating equipment records
    const oldEquipmentType = frequency.equipmentType;

    // Update fields
    Object.keys(req.body).forEach(key => {
      if (req.body[key] !== undefined) {
        frequency[key] = req.body[key];
      }
    });
    frequency.updatedBy = req.user.id;

    const updatedFrequency = await frequency.save();

    // Update all Equipment records of this type with the new calibration frequency (in months)
    try {
      const equipmentType = updatedFrequency.equipmentType || oldEquipmentType;
      let calibrationFrequencyInMonths = null;
      
      if (updatedFrequency.frequencyUnit === 'years') {
        calibrationFrequencyInMonths = updatedFrequency.frequencyValue * 12;
      } else {
        calibrationFrequencyInMonths = updatedFrequency.frequencyValue;
      }

      // Update all equipment of this type
      await Equipment.updateMany(
        { equipmentType: equipmentType },
        { $set: { calibrationFrequency: calibrationFrequencyInMonths } }
      );
      
      console.log(`Updated calibration frequency for all ${equipmentType} equipment to ${calibrationFrequencyInMonths} months`);

      // Recalculate calibration dates for all equipment of this type
      await recalculateCalibrationDatesForEquipmentType(equipmentType, calibrationFrequencyInMonths);
    } catch (equipmentUpdateError) {
      // Log error but don't fail the request
      console.error('Error updating equipment calibration frequencies:', equipmentUpdateError);
    }

    const populatedFrequency = await CalibrationFrequency.findById(updatedFrequency._id)
      .populate('createdBy', 'firstName lastName')
      .populate('updatedBy', 'firstName lastName');

    res.json(populatedFrequency);
  } catch (error) {
    console.error('Error updating calibration frequency:', error);
    res.status(400).json({ message: error.message });
  }
});

// Delete fixed calibration frequency
router.delete('/fixed/:id', auth, checkPermission(['admin.access']), async (req, res) => {
  try {
    const frequency = await CalibrationFrequency.findById(req.params.id);
    if (!frequency) {
      return res.status(404).json({ message: 'Calibration frequency not found' });
    }

    await frequency.deleteOne();
    res.json({ message: 'Calibration frequency deleted successfully' });
  } catch (error) {
    console.error('Error deleting calibration frequency:', error);
    res.status(500).json({ message: error.message });
  }
});

// ===== VARIABLE CALIBRATION FREQUENCY ROUTES =====

// Get all variable calibration frequencies
router.get('/variable', auth, checkPermission(['admin.access']), async (req, res) => {
  try {
    const frequencies = await VariableCalibrationFrequency.find()
      .populate('createdBy', 'firstName lastName')
      .populate('updatedBy', 'firstName lastName')
      .sort({ equipmentType: 1 });

    res.json({
      data: frequencies.map(freq => ({
        _id: freq._id,
        equipmentType: freq.equipmentType,
        calibrationRequirements: freq.calibrationRequirements,
        createdBy: freq.createdBy,
        updatedBy: freq.updatedBy,
        createdAt: freq.createdAt,
        updatedAt: freq.updatedAt
      }))
    });
  } catch (error) {
    console.error('Error fetching variable calibration frequencies:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get single variable calibration frequency
router.get('/variable/:id', auth, checkPermission(['admin.access']), async (req, res) => {
  try {
    const frequency = await VariableCalibrationFrequency.findById(req.params.id)
      .populate('createdBy', 'firstName lastName')
      .populate('updatedBy', 'firstName lastName');

    if (!frequency) {
      return res.status(404).json({ message: 'Variable calibration frequency not found' });
    }

    res.json({
      _id: frequency._id,
      equipmentType: frequency.equipmentType,
      calibrationRequirements: frequency.calibrationRequirements,
      createdBy: frequency.createdBy,
      updatedBy: frequency.updatedBy,
      createdAt: frequency.createdAt,
      updatedAt: frequency.updatedAt
    });
  } catch (error) {
    console.error('Error fetching variable calibration frequency:', error);
    res.status(500).json({ message: error.message });
  }
});

// Create new variable calibration frequency
router.post('/variable', auth, checkPermission(['admin.access']), async (req, res) => {
  try {
    const frequencyData = {
      ...req.body,
      createdBy: req.user.id,
      updatedBy: req.user.id
    };

    const frequency = new VariableCalibrationFrequency(frequencyData);
    const savedFrequency = await frequency.save();

    const populatedFrequency = await VariableCalibrationFrequency.findById(savedFrequency._id)
      .populate('createdBy', 'firstName lastName')
      .populate('updatedBy', 'firstName lastName');

    res.status(201).json(populatedFrequency);
  } catch (error) {
    console.error('Error creating variable calibration frequency:', error);
    res.status(400).json({ message: error.message });
  }
});

// Update variable calibration frequency
router.put('/variable/:id', auth, checkPermission(['admin.access']), async (req, res) => {
  try {
    const frequency = await VariableCalibrationFrequency.findById(req.params.id);
    if (!frequency) {
      return res.status(404).json({ message: 'Variable calibration frequency not found' });
    }

    // Update fields
    Object.keys(req.body).forEach(key => {
      if (req.body[key] !== undefined) {
        frequency[key] = req.body[key];
      }
    });
    frequency.updatedBy = req.user.id;

    const updatedFrequency = await frequency.save();

    const populatedFrequency = await VariableCalibrationFrequency.findById(updatedFrequency._id)
      .populate('createdBy', 'firstName lastName')
      .populate('updatedBy', 'firstName lastName');

    res.json(populatedFrequency);
  } catch (error) {
    console.error('Error updating variable calibration frequency:', error);
    res.status(400).json({ message: error.message });
  }
});

// Delete variable calibration frequency
router.delete('/variable/:id', auth, checkPermission(['admin.access']), async (req, res) => {
  try {
    const frequency = await VariableCalibrationFrequency.findById(req.params.id);
    if (!frequency) {
      return res.status(404).json({ message: 'Variable calibration frequency not found' });
    }

    await frequency.deleteOne();
    res.json({ message: 'Variable calibration frequency deleted successfully' });
  } catch (error) {
    console.error('Error deleting variable calibration frequency:', error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
