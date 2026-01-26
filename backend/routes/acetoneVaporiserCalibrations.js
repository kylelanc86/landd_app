const express = require('express');
const router = express.Router();
const AcetoneVaporiserCalibration = require('../models/AcetoneVaporiserCalibration');
const Equipment = require('../models/Equipment');
const CalibrationFrequency = require('../models/CalibrationFrequency');
const auth = require('../middleware/auth');
const checkPermission = require('../middleware/checkPermission');

// Get all acetone vaporiser calibrations
router.get('/', auth, checkPermission(['calibrations.view']), async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 50, 
      vaporiserId,
      status, 
      sortBy = 'date',
      sortOrder = 'desc'
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Build filter object
    const filter = {};
    if (vaporiserId) filter.vaporiserId = vaporiserId;
    if (status) filter.status = status;

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const total = await AcetoneVaporiserCalibration.countDocuments(filter);
    const pages = Math.ceil(total / parseInt(limit));

    const calibrations = await AcetoneVaporiserCalibration.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .populate('vaporiserId', 'equipmentReference brandModel')
      .populate('calibratedBy', 'firstName lastName');

    const response = {
      data: calibrations.map(cal => ({
        _id: cal._id,
        vaporiserId: cal.vaporiserId?._id || cal.vaporiserId,
        vaporiserReference: cal.vaporiserId?.equipmentReference || '',
        date: cal.date,
        temperature: cal.temperature,
        status: cal.status,
        nextCalibration: cal.nextCalibration,
        notes: cal.notes,
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
    console.error('Error fetching acetone vaporiser calibrations:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get calibrations by equipment ID
router.get('/equipment/:equipmentId', auth, checkPermission(['calibrations.view']), async (req, res) => {
  try {
    const { equipmentId } = req.params;
    const { page = 1, limit = 50 } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Check if equipmentId is a valid ObjectId, if not, try to find Equipment by reference
    let queryEquipmentId = equipmentId;
    if (!require('mongoose').Types.ObjectId.isValid(equipmentId)) {
      const equipment = await Equipment.findOne({ equipmentReference: equipmentId });
      if (equipment) {
        queryEquipmentId = equipment._id;
      } else {
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

    const total = await AcetoneVaporiserCalibration.countDocuments({ vaporiserId: queryEquipmentId });
    const pages = Math.ceil(total / parseInt(limit));

    const calibrations = await AcetoneVaporiserCalibration.find({ vaporiserId: queryEquipmentId })
      .sort({ date: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('vaporiserId', 'equipmentReference brandModel')
      .populate('calibratedBy', 'firstName lastName');

    const response = {
      data: calibrations.map(cal => ({
        _id: cal._id,
        vaporiserId: cal.vaporiserId?._id || cal.vaporiserId,
        vaporiserReference: cal.vaporiserId?.equipmentReference || '',
        date: cal.date,
        temperature: cal.temperature,
        status: cal.status,
        nextCalibration: cal.nextCalibration,
        notes: cal.notes,
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
    console.error('Error fetching acetone vaporiser calibrations by equipment:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get single calibration record
router.get('/:id', auth, checkPermission(['calibrations.view']), async (req, res) => {
  try {
    const calibration = await AcetoneVaporiserCalibration.findById(req.params.id)
      .populate('vaporiserId', 'equipmentReference brandModel')
      .populate('calibratedBy', 'firstName lastName');

    if (!calibration) {
      return res.status(404).json({ message: 'Acetone vaporiser calibration record not found' });
    }

    const calibrationData = {
      _id: calibration._id,
      vaporiserId: calibration.vaporiserId?._id || calibration.vaporiserId,
      vaporiserReference: calibration.vaporiserId?.equipmentReference || '',
      date: calibration.date,
      temperature: calibration.temperature,
      status: calibration.status,
      nextCalibration: calibration.nextCalibration,
      notes: calibration.notes,
      calibratedBy: calibration.calibratedBy,
      createdAt: calibration.createdAt,
      updatedAt: calibration.updatedAt
    };

    res.json(calibrationData);
  } catch (error) {
    console.error('Error fetching acetone vaporiser calibration:', error);
    res.status(500).json({ message: error.message });
  }
});

// Create new calibration record
router.post('/', auth, checkPermission(['calibrations.create']), async (req, res) => {
  try {
    const {
      equipmentId,
      date,
      temperature,
      notes,
      technicianId
    } = req.body;

    // Validate required fields
    if (!equipmentId || !date || temperature === undefined || temperature === null || !technicianId) {
      return res.status(400).json({ message: 'Missing required fields: equipmentId, date, temperature, and technicianId are required' });
    }

    // Verify equipment exists and is an Acetone Vaporiser
    const equipment = await Equipment.findById(equipmentId);
    if (!equipment) {
      return res.status(404).json({ message: 'Equipment not found' });
    }
    if (equipment.equipmentType !== 'Acetone Vaporiser') {
      return res.status(400).json({ message: 'Equipment is not an Acetone Vaporiser' });
    }

    // Calculate status based on temperature
    let status = 'Fail';
    if (temperature >= 65 && temperature <= 100) {
      status = 'Pass';
    }

    // Calculate next calibration date
    let nextCalibration = null;
    try {
      const CalibrationFrequency = require('../models/CalibrationFrequency');
      const calibrationFreqConfig = await CalibrationFrequency.findOne({ 
        equipmentType: 'Acetone Vaporiser' 
      });
      
      if (calibrationFreqConfig) {
        const calibrationDate = new Date(date);
        if (calibrationFreqConfig.frequencyUnit === 'years') {
          calibrationDate.setFullYear(calibrationDate.getFullYear() + calibrationFreqConfig.frequencyValue);
        } else {
          calibrationDate.setMonth(calibrationDate.getMonth() + calibrationFreqConfig.frequencyValue);
        }
        nextCalibration = calibrationDate;
      }
    } catch (error) {
      console.error('Error calculating next calibration date:', error);
    }

    const calibrationData = {
      vaporiserId: equipmentId,
      date: new Date(date),
      temperature: parseFloat(temperature),
      status: status,
      calibratedBy: technicianId,
      nextCalibration: nextCalibration,
      notes: notes || ''
    };

    const calibration = new AcetoneVaporiserCalibration(calibrationData);
    await calibration.save();

    const populatedCalibration = await AcetoneVaporiserCalibration.findById(calibration._id)
      .populate('vaporiserId', 'equipmentReference brandModel')
      .populate('calibratedBy', 'firstName lastName');

    res.status(201).json(populatedCalibration);
  } catch (error) {
    console.error('Error creating acetone vaporiser calibration:', error);
    res.status(400).json({ message: error.message });
  }
});

// Update calibration record
router.put('/:id', auth, checkPermission(['calibrations.edit']), async (req, res) => {
  try {
    const calibration = await AcetoneVaporiserCalibration.findById(req.params.id);
    if (!calibration) {
      return res.status(404).json({ message: 'Calibration record not found' });
    }

    // Update fields
    if (req.body.date !== undefined) calibration.date = new Date(req.body.date);
    if (req.body.temperature !== undefined) {
      calibration.temperature = parseFloat(req.body.temperature);
      // Recalculate status
      if (calibration.temperature >= 65 && calibration.temperature <= 100) {
        calibration.status = 'Pass';
      } else {
        calibration.status = 'Fail';
      }
    }
    if (req.body.notes !== undefined) calibration.notes = req.body.notes;
    if (req.body.technicianId !== undefined) calibration.calibratedBy = req.body.technicianId;

    // Recalculate next calibration if date changed
    if (req.body.date || req.body.temperature !== undefined) {
      try {
        const CalibrationFrequency = require('../models/CalibrationFrequency');
        const calibrationFreqConfig = await CalibrationFrequency.findOne({ 
          equipmentType: 'Acetone Vaporiser' 
        });
        
        if (calibrationFreqConfig) {
          const calibrationDate = new Date(calibration.date);
          if (calibrationFreqConfig.frequencyUnit === 'years') {
            calibrationDate.setFullYear(calibrationDate.getFullYear() + calibrationFreqConfig.frequencyValue);
          } else {
            calibrationDate.setMonth(calibrationDate.getMonth() + calibrationFreqConfig.frequencyValue);
          }
          calibration.nextCalibration = calibrationDate;
        }
      } catch (error) {
        console.error('Error recalculating next calibration date:', error);
      }
    }

    const updatedCalibration = await calibration.save();

    const populatedCalibration = await AcetoneVaporiserCalibration.findById(updatedCalibration._id)
      .populate('vaporiserId', 'equipmentReference brandModel')
      .populate('calibratedBy', 'firstName lastName');

    res.json(populatedCalibration);
  } catch (error) {
    console.error('Error updating acetone vaporiser calibration:', error);
    res.status(400).json({ message: error.message });
  }
});

// Delete calibration record
router.delete('/:id', auth, checkPermission(['calibrations.delete']), async (req, res) => {
  try {
    const calibration = await AcetoneVaporiserCalibration.findById(req.params.id);
    if (!calibration) {
      return res.status(404).json({ message: 'Calibration record not found' });
    }

    await calibration.deleteOne();
    res.json({ message: 'Calibration record deleted successfully' });
  } catch (error) {
    console.error('Error deleting acetone vaporiser calibration:', error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
