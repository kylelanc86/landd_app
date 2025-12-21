const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const AirPumpCalibration = require('../models/AirPumpCalibration');
const AirPump = require('../models/AirPump');
const Equipment = require('../models/Equipment');
const auth = require('../middleware/auth');
const checkPermission = require('../middleware/checkPermission');

// Get all calibrations for a specific pump
router.get('/pump/:pumpId', auth, checkPermission(['calibrations.view']), async (req, res) => {
  try {
    const { pumpId } = req.params;
    const { page = 1, limit = 50 } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Check if pumpId is a valid ObjectId, if not, try to find Equipment by reference
    let queryPumpId = pumpId;
    if (!mongoose.Types.ObjectId.isValid(pumpId)) {
      // If it's not a valid ObjectId, it might be an equipmentReference
      const equipment = await Equipment.findOne({ equipmentReference: pumpId });
      if (equipment) {
        queryPumpId = equipment._id;
      } else {
        // If not found, return empty results
        return res.json({
          data: [],
          pagination: {
            total: 0,
            pages: 0,
            page: parseInt(page),
            limit: parseInt(limit),
          }
        });
      }
    }
    
    const total = await AirPumpCalibration.countDocuments({ pumpId: queryPumpId });
    const pages = Math.ceil(total / parseInt(limit));

    const calibrations = await AirPumpCalibration.find({ pumpId: queryPumpId })
      .sort({ calibrationDate: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('calibratedBy', 'firstName lastName')
      .populate('pumpId', 'pumpReference pumpDetails equipmentReference brandModel');

    const response = {
      data: calibrations.map(cal => ({
        _id: cal._id,
        pumpId: cal.pumpId,
        calibrationDate: cal.calibrationDate,
        calibratedBy: cal.calibratedBy,
        testResults: cal.testResults,
        overallResult: cal.overallResult,
        notes: cal.notes,
        nextCalibrationDue: cal.nextCalibrationDue,
        averagePercentError: cal.averagePercentError,
        testsPassed: cal.testsPassed,
        totalTests: cal.totalTests,
        createdAt: cal.createdAt,
        updatedAt: cal.updatedAt
      })),
      pagination: {
        total,
        pages,
        page: parseInt(page),
        limit: parseInt(limit),
      }
    };

    res.json(response);
  } catch (error) {
    console.error('Error fetching pump calibrations:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get single calibration record
router.get('/:id', auth, checkPermission(['calibrations.view']), async (req, res) => {
  try {
    const calibration = await AirPumpCalibration.findById(req.params.id)
      .populate('calibratedBy', 'firstName lastName')
      .populate('pumpId', 'pumpReference pumpDetails');

    if (!calibration) {
      return res.status(404).json({ message: 'Calibration record not found' });
    }

    const calibrationData = {
      _id: calibration._id,
      pumpId: calibration.pumpId,
      calibrationDate: calibration.calibrationDate,
      calibratedBy: calibration.calibratedBy,
      testResults: calibration.testResults,
      overallResult: calibration.overallResult,
      notes: calibration.notes,
      nextCalibrationDue: calibration.nextCalibrationDue,
      averagePercentError: calibration.averagePercentError,
      testsPassed: calibration.testsPassed,
      totalTests: calibration.totalTests,
      createdAt: calibration.createdAt,
      updatedAt: calibration.updatedAt
    };

    res.json(calibrationData);
  } catch (error) {
    console.error('Error fetching calibration:', error);
    res.status(500).json({ message: error.message });
  }
});

// Create new calibration record
router.post('/', auth, checkPermission(['calibrations.create']), async (req, res) => {
  try {
    console.log('Received calibration data:', JSON.stringify(req.body, null, 2));
    
    const calibrationData = {
      ...req.body,
      calibratedBy: req.user.id
    };

    console.log('Calibration data after adding user:', JSON.stringify(calibrationData, null, 2));

    const calibration = new AirPumpCalibration(calibrationData);
    
    // Validate before saving
    const validationError = calibration.validateSync();
    if (validationError) {
      console.error('Validation error:', validationError);
      return res.status(400).json({ 
        message: 'Validation error', 
        errors: validationError.errors 
      });
    }
    
    const savedCalibration = await calibration.save();
    
    // Try to update Equipment if pumpId is an Equipment ID
    try {
      const equipment = await Equipment.findById(calibrationData.pumpId);
      if (equipment && equipment.equipmentType === 'Air pump') {
        // Equipment calibration data is fetched dynamically, so we don't need to update it
        // Just dispatch an event or update if needed
      }
    } catch (equipmentError) {
      // If pumpId doesn't reference Equipment, try AirPump (for backward compatibility)
      try {
        await AirPump.findByIdAndUpdate(calibrationData.pumpId, {
          calibrationDate: calibrationData.calibrationDate,
          calibrationDue: savedCalibration.nextCalibrationDue,
          lastCalibratedBy: req.user.id
        });
      } catch (pumpError) {
        // Ignore if neither Equipment nor AirPump found
        console.log('Note: Could not update Equipment or AirPump record');
      }
    }

    const populatedCalibration = await AirPumpCalibration.findById(savedCalibration._id)
      .populate('calibratedBy', 'firstName lastName')
      .populate('pumpId', 'pumpReference pumpDetails equipmentReference brandModel');

    res.status(201).json(populatedCalibration);
  } catch (error) {
    console.error('Error creating calibration:', error);
    res.status(400).json({ message: error.message });
  }
});

// Update calibration record
router.put('/:id', auth, checkPermission(['calibrations.edit']), async (req, res) => {
  try {
    const calibration = await AirPumpCalibration.findById(req.params.id);
    if (!calibration) {
      return res.status(404).json({ message: 'Calibration record not found' });
    }

    // Update fields
    Object.keys(req.body).forEach(key => {
      if (req.body[key] !== undefined) {
        calibration[key] = req.body[key];
      }
    });

    const updatedCalibration = await calibration.save();
    
    // Update the pump's calibration date and due date if calibration date changed
    if (req.body.calibrationDate) {
      await AirPump.findByIdAndUpdate(calibration.pumpId, {
        calibrationDate: req.body.calibrationDate,
        calibrationDue: updatedCalibration.nextCalibrationDue,
        lastCalibratedBy: req.user.id
      });
    }

    const populatedCalibration = await AirPumpCalibration.findById(updatedCalibration._id)
      .populate('calibratedBy', 'firstName lastName')
      .populate('pumpId', 'pumpReference pumpDetails');

    res.json(populatedCalibration);
  } catch (error) {
    console.error('Error updating calibration:', error);
    res.status(400).json({ message: error.message });
  }
});

// Delete calibration record
router.delete('/:id', auth, checkPermission(['calibrations.delete']), async (req, res) => {
  try {
    const calibration = await AirPumpCalibration.findById(req.params.id);
    if (!calibration) {
      return res.status(404).json({ message: 'Calibration record not found' });
    }

    await calibration.deleteOne();
    res.json({ message: 'Calibration record deleted successfully' });
  } catch (error) {
    console.error('Error deleting calibration:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get calibration statistics for a pump
router.get('/pump/:pumpId/stats', auth, checkPermission(['calibrations.view']), async (req, res) => {
  try {
    const { pumpId } = req.params;
    
    const stats = await AirPumpCalibration.aggregate([
      { $match: { pumpId: new mongoose.Types.ObjectId(pumpId) } },
      {
        $group: {
          _id: null,
          totalCalibrations: { $sum: 1 },
          passedCalibrations: {
            $sum: { $cond: [{ $eq: ['$overallResult', 'Pass'] }, 1, 0] }
          },
          failedCalibrations: {
            $sum: { $cond: [{ $eq: ['$overallResult', 'Fail'] }, 1, 0] }
          },
          averagePercentError: { $avg: '$averagePercentError' },
          lastCalibrationDate: { $max: '$calibrationDate' }
        }
      }
    ]);

    const result = stats[0] || {
      totalCalibrations: 0,
      passedCalibrations: 0,
      failedCalibrations: 0,
      averagePercentError: 0,
      lastCalibrationDate: null
    };

    res.json(result);
  } catch (error) {
    console.error('Error fetching calibration statistics:', error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router; 