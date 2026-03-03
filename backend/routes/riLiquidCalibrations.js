const express = require('express');
const router = express.Router();
const RiLiquidCalibration = require('../models/RiLiquidCalibration');
const CalibrationFrequency = require('../models/CalibrationFrequency');
const auth = require('../middleware/auth');
const checkPermission = require('../middleware/checkPermission');

// Get all RI Liquid calibrations
router.get('/', auth, checkPermission(['calibrations.view']), async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 50, 
      bottleId,
      status, 
      sortBy = 'date',
      sortOrder = 'desc'
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Build filter object
    const filter = {};
    if (bottleId) filter.bottleId = bottleId;
    if (status) filter.status = status;
    // By default, exclude empty bottles unless explicitly requested
    if (req.query.includeEmpty !== 'true') {
      filter.isEmpty = { $ne: true };
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const total = await RiLiquidCalibration.countDocuments(filter);
    const pages = Math.ceil(total / parseInt(limit));

    const calibrations = await RiLiquidCalibration.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .populate('calibratedBy', 'firstName lastName');

    const response = {
      data: calibrations.map(cal => ({
        _id: cal._id,
        bottleId: cal.bottleId,
        date: cal.date,
        refractiveIndex: cal.refractiveIndex,
        asbestosTypeVerified: cal.asbestosTypeVerified,
        dateOpened: cal.dateOpened,
        batchNumber: cal.batchNumber,
        status: cal.status,
        nextCalibration: cal.nextCalibration,
        notes: cal.notes,
        isEmpty: cal.isEmpty,
        calibratedBy: cal.calibratedBy,
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
    console.error('Error fetching RI Liquid calibrations:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get calibrations by bottle ID
router.get('/bottle/:bottleId', auth, checkPermission(['calibrations.view']), async (req, res) => {
  try {
    const { bottleId } = req.params;
    const { page = 1, limit = 50 } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const total = await RiLiquidCalibration.countDocuments({ bottleId: bottleId });
    const pages = Math.ceil(total / parseInt(limit));

    const calibrations = await RiLiquidCalibration.find({ bottleId: bottleId })
      .sort({ date: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('calibratedBy', 'firstName lastName');

    const response = {
      data: calibrations.map(cal => ({
        _id: cal._id,
        bottleId: cal.bottleId,
        date: cal.date,
        refractiveIndex: cal.refractiveIndex,
        asbestosTypeVerified: cal.asbestosTypeVerified,
        dateOpened: cal.dateOpened,
        batchNumber: cal.batchNumber,
        status: cal.status,
        nextCalibration: cal.nextCalibration,
        notes: cal.notes,
        isEmpty: cal.isEmpty,
        calibratedBy: cal.calibratedBy,
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
    console.error('Error fetching RI Liquid calibrations by bottle:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get single calibration record
router.get('/:id', auth, checkPermission(['calibrations.view']), async (req, res) => {
  try {
    const calibration = await RiLiquidCalibration.findById(req.params.id)
      .populate('calibratedBy', 'firstName lastName');

    if (!calibration) {
      return res.status(404).json({ message: 'RI Liquid calibration record not found' });
    }

    const calibrationData = {
      _id: calibration._id,
      bottleId: calibration.bottleId,
      date: calibration.date,
      refractiveIndex: calibration.refractiveIndex,
      asbestosTypeVerified: calibration.asbestosTypeVerified,
      dateOpened: calibration.dateOpened,
      batchNumber: calibration.batchNumber,
      status: calibration.status,
      nextCalibration: calibration.nextCalibration,
      notes: calibration.notes,
      isEmpty: calibration.isEmpty,
      calibratedBy: calibration.calibratedBy,
      createdAt: calibration.createdAt,
      updatedAt: calibration.updatedAt
    };

    res.json(calibrationData);
  } catch (error) {
    console.error('Error fetching RI Liquid calibration:', error);
    res.status(500).json({ message: error.message });
  }
});

// Create new calibration record
router.post('/', auth, checkPermission(['calibrations.create']), async (req, res) => {
  try {
    const {
      equipmentId,
      date,
      refractiveIndex,
      asbestosTypeVerified,
      dateOpened,
      batchNumber,
      status,
      notes,
      technicianId
    } = req.body;

    // Validate required fields
    if (!equipmentId || !date || refractiveIndex === undefined || refractiveIndex === null || 
        !asbestosTypeVerified || !dateOpened || !batchNumber || !technicianId) {
      return res.status(400).json({ message: 'Missing required fields: bottleId, date, refractiveIndex, asbestosTypeVerified, dateOpened, batchNumber, and technicianId are required' });
    }

    // Validate refractive index is one of the allowed values
    const allowedRefractiveIndices = [1.55, 1.67, 1.70];
    const refractiveIndexValue = parseFloat(refractiveIndex);
    if (!allowedRefractiveIndices.includes(refractiveIndexValue)) {
      return res.status(400).json({ message: 'Refractive index must be one of: 1.55, 1.67, or 1.70' });
    }

    // Validate asbestos type
    const allowedAsbestosTypes = ['Chrysotile', 'Amosite', 'Crocidolite'];
    if (!allowedAsbestosTypes.includes(asbestosTypeVerified)) {
      return res.status(400).json({ message: 'Asbestos type verified must be one of: Chrysotile, Amosite, or Crocidolite' });
    }

    // Auto-calculate status based on refractive index and asbestos type
    const passCombinations = [
      { refractiveIndex: 1.55, asbestosType: 'Chrysotile' },
      { refractiveIndex: 1.67, asbestosType: 'Amosite' },
      { refractiveIndex: 1.70, asbestosType: 'Crocidolite' }
    ];
    
    const isPass = passCombinations.some(combo => 
      Math.abs(refractiveIndexValue - combo.refractiveIndex) < 0.001 && 
      asbestosTypeVerified === combo.asbestosType
    );
    
    const calculatedStatus = isPass ? 'Pass' : 'Fail';

    // Calculate next calibration date (6 months from calibration date)
    let nextCalibration = null;
    try {
      const calibrationFreqConfig = await CalibrationFrequency.findOne({ 
        equipmentType: 'RI Liquids' 
      });
      
      const calibrationDate = new Date(date);
      if (calibrationFreqConfig) {
        if (calibrationFreqConfig.frequencyUnit === 'years') {
          calibrationDate.setFullYear(calibrationDate.getFullYear() + calibrationFreqConfig.frequencyValue);
        } else {
          calibrationDate.setMonth(calibrationDate.getMonth() + calibrationFreqConfig.frequencyValue);
        }
        nextCalibration = calibrationDate;
      } else {
        // Default to 6 months
        calibrationDate.setMonth(calibrationDate.getMonth() + 6);
        nextCalibration = calibrationDate;
      }
    } catch (error) {
      console.error('Error calculating next calibration date:', error);
      // Default to 6 months
      const calibrationDate = new Date(date);
      calibrationDate.setMonth(calibrationDate.getMonth() + 6);
      nextCalibration = calibrationDate;
    }

    const calibrationData = {
      bottleId: equipmentId,
      date: new Date(date),
      refractiveIndex: parseFloat(refractiveIndex),
      asbestosTypeVerified: asbestosTypeVerified,
      dateOpened: new Date(dateOpened),
      batchNumber: batchNumber.trim(),
      status: calculatedStatus,
      calibratedBy: technicianId,
      nextCalibration: nextCalibration,
      notes: notes || ''
    };

    const calibration = new RiLiquidCalibration(calibrationData);
    await calibration.save();

    const populatedCalibration = await RiLiquidCalibration.findById(calibration._id)
      .populate('calibratedBy', 'firstName lastName');

    res.status(201).json(populatedCalibration);
  } catch (error) {
    console.error('Error creating RI Liquid calibration:', error);
    res.status(400).json({ message: error.message });
  }
});

// Update calibration record
router.put('/:id', auth, checkPermission(['calibrations.edit']), async (req, res) => {
  try {
    const calibration = await RiLiquidCalibration.findById(req.params.id);
    if (!calibration) {
      return res.status(404).json({ message: 'Calibration record not found' });
    }

    // Update fields
    if (req.body.date !== undefined) calibration.date = new Date(req.body.date);
    if (req.body.refractiveIndex !== undefined) calibration.refractiveIndex = parseFloat(req.body.refractiveIndex);
    if (req.body.asbestosTypeVerified !== undefined) calibration.asbestosTypeVerified = req.body.asbestosTypeVerified;
    if (req.body.dateOpened !== undefined) calibration.dateOpened = new Date(req.body.dateOpened);
    if (req.body.batchNumber !== undefined) calibration.batchNumber = req.body.batchNumber.trim();
    if (req.body.notes !== undefined) calibration.notes = req.body.notes;
    if (req.body.technicianId !== undefined) calibration.calibratedBy = req.body.technicianId;

    // Validate refractive index if being updated
    if (req.body.refractiveIndex !== undefined) {
      const allowedRefractiveIndices = [1.55, 1.67, 1.70];
      const refractiveIndexValue = parseFloat(req.body.refractiveIndex);
      if (!allowedRefractiveIndices.includes(refractiveIndexValue)) {
        return res.status(400).json({ message: 'Refractive index must be one of: 1.55, 1.67, or 1.70' });
      }
    }

    // Validate asbestos type if being updated
    if (req.body.asbestosTypeVerified !== undefined) {
      const allowedAsbestosTypes = ['Chrysotile', 'Amosite', 'Crocidolite'];
      if (!allowedAsbestosTypes.includes(req.body.asbestosTypeVerified)) {
        return res.status(400).json({ message: 'Asbestos type verified must be one of: Chrysotile, Amosite, or Crocidolite' });
      }
    }

    // Auto-calculate status if refractive index or asbestos type changed
    if (req.body.refractiveIndex !== undefined || req.body.asbestosTypeVerified !== undefined) {
      const refractiveIndexValue = calibration.refractiveIndex;
      const asbestosType = calibration.asbestosTypeVerified;
      
      const passCombinations = [
        { refractiveIndex: 1.55, asbestosType: 'Chrysotile' },
        { refractiveIndex: 1.67, asbestosType: 'Amosite' },
        { refractiveIndex: 1.70, asbestosType: 'Crocidolite' }
      ];
      
      const isPass = passCombinations.some(combo => 
        Math.abs(refractiveIndexValue - combo.refractiveIndex) < 0.001 && 
        asbestosType === combo.asbestosType
      );
      
      calibration.status = isPass ? 'Pass' : 'Fail';
    }

    // Recalculate next calibration if calibration date changed
    if (req.body.date !== undefined) {
      try {
        const calibrationFreqConfig = await CalibrationFrequency.findOne({ 
          equipmentType: 'RI Liquids' 
        });
        
        const calibrationDate = new Date(calibration.date);
        if (calibrationFreqConfig) {
          if (calibrationFreqConfig.frequencyUnit === 'years') {
            calibrationDate.setFullYear(calibrationDate.getFullYear() + calibrationFreqConfig.frequencyValue);
          } else {
            calibrationDate.setMonth(calibrationDate.getMonth() + calibrationFreqConfig.frequencyValue);
          }
          calibration.nextCalibration = calibrationDate;
        } else {
          // Default to 6 months
          calibrationDate.setMonth(calibrationDate.getMonth() + 6);
          calibration.nextCalibration = calibrationDate;
        }
      } catch (error) {
        console.error('Error recalculating next calibration date:', error);
      }
    }

    const updatedCalibration = await calibration.save();

    const populatedCalibration = await RiLiquidCalibration.findById(updatedCalibration._id)
      .populate('calibratedBy', 'firstName lastName');

    res.json(populatedCalibration);
  } catch (error) {
    console.error('Error updating RI Liquid calibration:', error);
    res.status(400).json({ message: error.message });
  }
});

// Delete calibration record
router.delete('/:id', auth, checkPermission(['calibrations.delete']), async (req, res) => {
  try {
    const calibration = await RiLiquidCalibration.findById(req.params.id);
    if (!calibration) {
      return res.status(404).json({ message: 'Calibration record not found' });
    }

    await calibration.deleteOne();
    res.json({ message: 'Calibration record deleted successfully' });
  } catch (error) {
    console.error('Error deleting RI Liquid calibration:', error);
    res.status(500).json({ message: error.message });
  }
});

// Mark bottle as empty (marks all calibrations for a bottle as empty)
router.put('/bottle/:bottleId/mark-empty', auth, checkPermission(['calibrations.edit']), async (req, res) => {
  try {
    const { bottleId } = req.params;
    
    // Update all calibrations for this bottle to mark as empty
    const result = await RiLiquidCalibration.updateMany(
      { bottleId: bottleId },
      { isEmpty: true }
    );

    res.json({ 
      message: 'Bottle marked as empty successfully',
      updatedCount: result.modifiedCount
    });
  } catch (error) {
    console.error('Error marking bottle as empty:', error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
