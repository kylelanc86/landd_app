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
      .populate('flowmeterId', 'equipmentReference brandModel')
      .lean(); // Use lean() to allow manual population

    // Manually populate pumpId with Equipment data since schema references AirPump but stores Equipment IDs
    for (let cal of calibrations) {
      if (cal.pumpId) {
        const pumpIdValue = cal.pumpId._id || cal.pumpId;
        if (pumpIdValue) {
          const equipment = await Equipment.findById(pumpIdValue);
          if (equipment) {
            cal.pumpId = equipment;
          }
        }
      }
    }

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
        flowmeterId: cal.flowmeterId,
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

// Bulk fetch calibrations for multiple pumps (must be before /:id route)
router.post('/pumps/bulk', auth, checkPermission(['calibrations.view']), async (req, res) => {
  try {
    const { pumpIds, limit = 1000 } = req.body;
    
    if (!Array.isArray(pumpIds) || pumpIds.length === 0) {
      return res.status(400).json({ message: 'pumpIds must be a non-empty array' });
    }

    // Convert pumpIds to ObjectIds, handling both ObjectId strings and equipment references
    const objectIds = [];
    const equipmentRefs = [];
    
    for (const pumpId of pumpIds) {
      if (mongoose.Types.ObjectId.isValid(pumpId)) {
        objectIds.push(new mongoose.Types.ObjectId(pumpId));
      } else {
        equipmentRefs.push(pumpId);
      }
    }

    // If there are equipment references, look them up
    if (equipmentRefs.length > 0) {
      const equipment = await Equipment.find({ 
        equipmentReference: { $in: equipmentRefs },
        equipmentType: 'Air pump'
      });
      equipment.forEach(eq => {
        if (eq._id) {
          objectIds.push(eq._id);
        }
      });
    }

    if (objectIds.length === 0) {
      console.log('Bulk fetch: No valid pump IDs found, returning empty object');
      return res.json({});
    }

    console.log(`Bulk fetch: Fetching calibrations for ${objectIds.length} pumps`);

    // Fetch all calibrations for all pumps in one query
    // Note: pumpId in AirPumpCalibration references 'AirPump' model in schema,
    // but in practice it stores Equipment IDs. We need to populate manually.
    const calibrations = await AirPumpCalibration.find({ 
      pumpId: { $in: objectIds } 
    })
      .sort({ calibrationDate: -1 })
      .limit(parseInt(limit))
      .populate('calibratedBy', 'firstName lastName')
      .populate('flowmeterId', 'equipmentReference brandModel')
      .lean(); // Use lean() for better performance and to allow manual population

    console.log(`Bulk fetch: Found ${calibrations.length} total calibrations`);
    
    // Manually populate pumpId with Equipment data since schema says it references AirPump
    // but in practice it's Equipment IDs
    for (let cal of calibrations) {
      if (cal.pumpId) {
        const pumpIdValue = cal.pumpId._id || cal.pumpId;
        if (pumpIdValue) {
          const equipment = await Equipment.findById(pumpIdValue);
          if (equipment) {
            cal.pumpId = equipment;
          }
        }
      }
    }

    // Group calibrations by pumpId
    const calibrationsByPump = {};
    calibrations.forEach(cal => {
      // Handle both populated and non-populated pumpId
      let pumpId;
      if (cal.pumpId) {
        if (typeof cal.pumpId === 'object' && cal.pumpId._id) {
          // Populated: use the _id from the populated object
          pumpId = cal.pumpId._id.toString();
        } else {
          // Not populated: use the ObjectId directly
          pumpId = cal.pumpId.toString();
        }
      } else {
        // Skip if no pumpId
        console.warn('Bulk fetch: Calibration missing pumpId:', cal._id);
        return;
      }
      
      if (!calibrationsByPump[pumpId]) {
        calibrationsByPump[pumpId] = [];
      }
      calibrationsByPump[pumpId].push({
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
        flowmeterId: cal.flowmeterId,
        createdAt: cal.createdAt,
        updatedAt: cal.updatedAt
      });
    });

    console.log(`Bulk fetch: Returning calibrations for ${Object.keys(calibrationsByPump).length} pumps`);
    res.json(calibrationsByPump);
  } catch (error) {
    console.error('Error bulk fetching pump calibrations:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get single calibration record
router.get('/:id', auth, checkPermission(['calibrations.view']), async (req, res) => {
  try {
    const calibration = await AirPumpCalibration.findById(req.params.id)
      .populate('calibratedBy', 'firstName lastName')
      .populate('pumpId', 'pumpReference pumpDetails')
      .populate('flowmeterId', 'equipmentReference brandModel');

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
      flowmeterId: calibration.flowmeterId,
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

    // Always create a new calibration record (never update existing)
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
        // If equipment was out-of-service and this calibration passed, update status to active
        if (equipment.status === 'out-of-service') {
          // Check if at least one test result passed
          const hasPassedTest = savedCalibration.testResults && 
            savedCalibration.testResults.some(result => result.passed === true);
          
          // Also check overallResult as fallback
          const calibrationPassed = hasPassedTest || savedCalibration.overallResult === 'Pass';
          
          if (calibrationPassed) {
            await Equipment.findByIdAndUpdate(calibrationData.pumpId, {
              status: 'active'
            });
            console.log(`Updated equipment ${equipment.equipmentReference} status from out-of-service to active after passed calibration`);
          }
        }
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
    
    // Check if equipment status should be updated (if it was out-of-service and calibration now passes)
    try {
      const equipment = await Equipment.findById(calibration.pumpId);
      if (equipment && equipment.equipmentType === 'Air pump' && equipment.status === 'out-of-service') {
        // Check if at least one test result passed
        const hasPassedTest = updatedCalibration.testResults && 
          updatedCalibration.testResults.some(result => result.passed === true);
        
        // Also check overallResult as fallback
        const calibrationPassed = hasPassedTest || updatedCalibration.overallResult === 'Pass';
        
        if (calibrationPassed) {
          await Equipment.findByIdAndUpdate(calibration.pumpId, {
            status: 'active'
          });
          console.log(`Updated equipment ${equipment.equipmentReference} status from out-of-service to active after calibration update`);
        }
      }
    } catch (equipmentError) {
      // If pumpId doesn't reference Equipment, try AirPump (for backward compatibility)
      console.log('Note: Could not update Equipment status, trying AirPump');
    }
    
    // Update the pump's calibration date and due date if calibration date changed
    if (req.body.calibrationDate) {
      try {
        await AirPump.findByIdAndUpdate(calibration.pumpId, {
          calibrationDate: req.body.calibrationDate,
          calibrationDue: updatedCalibration.nextCalibrationDue,
          lastCalibratedBy: req.user.id
        });
      } catch (pumpError) {
        // Ignore if AirPump not found
        console.log('Note: Could not update AirPump record');
      }
    }

    const populatedCalibration = await AirPumpCalibration.findById(updatedCalibration._id)
      .populate('calibratedBy', 'firstName lastName')
      .populate('pumpId', 'pumpReference pumpDetails')
      .populate('flowmeterId', 'equipmentReference brandModel');

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