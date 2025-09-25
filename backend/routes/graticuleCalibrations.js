const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const GraticuleCalibration = require('../models/GraticuleCalibration');
const Equipment = require('../models/Equipment');
const auth = require('../middleware/auth');
const checkPermission = require('../middleware/checkPermission');

// Get all graticule calibrations with optional filtering
router.get('/', auth, checkPermission(['calibrations.view']), async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 50, 
      graticuleId, 
      status, 
      technician, 
      microscopeId,
      sortBy = 'date',
      sortOrder = 'desc'
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Build filter object
    const filter = {};
    if (graticuleId) filter.graticuleId = new RegExp(graticuleId, 'i');
    if (status) filter.status = status;
    if (technician) filter.technician = new RegExp(technician, 'i');
    if (microscopeId) filter.microscopeId = microscopeId;

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const total = await GraticuleCalibration.countDocuments(filter);
    const pages = Math.ceil(total / parseInt(limit));

    const calibrations = await GraticuleCalibration.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .populate('calibratedBy', 'firstName lastName')
      .populate('microscopeId', 'equipmentReference brandModel');

    const response = {
      data: calibrations.map(cal => ({
        _id: cal._id,
        graticuleId: cal.graticuleId,
        date: cal.date,
        scale: cal.scale,
        status: cal.status,
        technician: cal.technician,
        nextCalibration: cal.nextCalibration,
        microscopeId: cal.microscopeId,
        microscopeReference: cal.microscopeReference,
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
    console.error('Error fetching graticule calibrations:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get single graticule calibration record
router.get('/:id', auth, checkPermission(['calibrations.view']), async (req, res) => {
  try {
    const calibration = await GraticuleCalibration.findById(req.params.id)
      .populate('calibratedBy', 'firstName lastName')
      .populate('microscopeId', 'equipmentReference brandModel');

    if (!calibration) {
      return res.status(404).json({ message: 'Graticule calibration record not found' });
    }

    const calibrationData = {
      _id: calibration._id,
      graticuleId: calibration.graticuleId,
      date: calibration.date,
      scale: calibration.scale,
      status: calibration.status,
      technician: calibration.technician,
      nextCalibration: calibration.nextCalibration,
      microscopeId: calibration.microscopeId,
      microscopeReference: calibration.microscopeReference,
      notes: calibration.notes,
      calibratedBy: calibration.calibratedBy,
      createdAt: calibration.createdAt,
      updatedAt: calibration.updatedAt
    };

    res.json(calibrationData);
  } catch (error) {
    console.error('Error fetching graticule calibration:', error);
    res.status(500).json({ message: error.message });
  }
});

// Create new graticule calibration record
router.post('/', auth, checkPermission(['calibrations.create']), async (req, res) => {
  try {
    const calibrationData = {
      ...req.body,
      calibratedBy: req.user.id
    };

    // If microscopeId is provided, get the microscope reference
    if (calibrationData.microscopeId) {
      const microscope = await Equipment.findById(calibrationData.microscopeId);
      if (microscope) {
        calibrationData.microscopeReference = microscope.equipmentReference;
      }
    }

    const calibration = new GraticuleCalibration(calibrationData);
    const savedCalibration = await calibration.save();

    const populatedCalibration = await GraticuleCalibration.findById(savedCalibration._id)
      .populate('calibratedBy', 'firstName lastName')
      .populate('microscopeId', 'equipmentReference brandModel');

    res.status(201).json(populatedCalibration);
  } catch (error) {
    console.error('Error creating graticule calibration:', error);
    res.status(400).json({ message: error.message });
  }
});

// Update graticule calibration record
router.put('/:id', auth, checkPermission(['calibrations.edit']), async (req, res) => {
  try {
    const calibration = await GraticuleCalibration.findById(req.params.id);
    if (!calibration) {
      return res.status(404).json({ message: 'Graticule calibration record not found' });
    }

    // Update fields
    Object.keys(req.body).forEach(key => {
      if (req.body[key] !== undefined) {
        calibration[key] = req.body[key];
      }
    });

    // If microscopeId is provided, get the microscope reference
    if (req.body.microscopeId) {
      const microscope = await Equipment.findById(req.body.microscopeId);
      if (microscope) {
        calibration.microscopeReference = microscope.equipmentReference;
      }
    }

    const updatedCalibration = await calibration.save();

    const populatedCalibration = await GraticuleCalibration.findById(updatedCalibration._id)
      .populate('calibratedBy', 'firstName lastName')
      .populate('microscopeId', 'equipmentReference brandModel');

    res.json(populatedCalibration);
  } catch (error) {
    console.error('Error updating graticule calibration:', error);
    res.status(400).json({ message: error.message });
  }
});

// Delete graticule calibration record
router.delete('/:id', auth, checkPermission(['calibrations.delete']), async (req, res) => {
  try {
    const calibration = await GraticuleCalibration.findById(req.params.id);
    if (!calibration) {
      return res.status(404).json({ message: 'Graticule calibration record not found' });
    }

    await calibration.deleteOne();
    res.json({ message: 'Graticule calibration record deleted successfully' });
  } catch (error) {
    console.error('Error deleting graticule calibration:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get graticule calibrations by microscope
router.get('/microscope/:microscopeId', auth, checkPermission(['calibrations.view']), async (req, res) => {
  try {
    const { microscopeId } = req.params;
    const { page = 1, limit = 50 } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const total = await GraticuleCalibration.countDocuments({ microscopeId });
    const pages = Math.ceil(total / parseInt(limit));

    const calibrations = await GraticuleCalibration.find({ microscopeId })
      .sort({ date: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('calibratedBy', 'firstName lastName')
      .populate('microscopeId', 'equipmentReference brandModel');

    const response = {
      data: calibrations.map(cal => ({
        _id: cal._id,
        graticuleId: cal.graticuleId,
        date: cal.date,
        scale: cal.scale,
        status: cal.status,
        technician: cal.technician,
        nextCalibration: cal.nextCalibration,
        microscopeId: cal.microscopeId,
        microscopeReference: cal.microscopeReference,
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
    console.error('Error fetching microscope calibrations:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get graticule calibration statistics
router.get('/stats', auth, checkPermission(['calibrations.view']), async (req, res) => {
  try {
    const stats = await GraticuleCalibration.aggregate([
      {
        $group: {
          _id: null,
          totalCalibrations: { $sum: 1 },
          passedCalibrations: {
            $sum: { $cond: [{ $eq: ['$status', 'Pass'] }, 1, 0] }
          },
          failedCalibrations: {
            $sum: { $cond: [{ $eq: ['$status', 'Fail'] }, 1, 0] }
          },
          lastCalibrationDate: { $max: '$date' },
          nextCalibrationDue: { $min: '$nextCalibration' }
        }
      }
    ]);

    const result = stats[0] || {
      totalCalibrations: 0,
      passedCalibrations: 0,
      failedCalibrations: 0,
      lastCalibrationDate: null,
      nextCalibrationDue: null
    };

    res.json(result);
  } catch (error) {
    console.error('Error fetching graticule calibration statistics:', error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
