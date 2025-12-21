const express = require('express');
const router = express.Router();
const FlowmeterCalibration = require('../models/FlowmeterCalibration');
const auth = require('../middleware/auth');
const checkPermission = require('../middleware/checkPermission');

// Note: Calibration data is now fetched dynamically from calibration records,
// not stored in the Equipment model

// Get all flowmeter calibrations with optional filtering
router.get('/', auth, checkPermission(['calibrations.view']), async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 50, 
      flowmeterId, 
      status, 
      technician, 
      sortBy = 'date',
      sortOrder = 'desc'
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Build filter object
    const filter = {};
    if (flowmeterId) filter.flowmeterId = new RegExp(flowmeterId, 'i');
    if (status) filter.status = status;
    if (technician) filter.technician = new RegExp(technician, 'i');

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const total = await FlowmeterCalibration.countDocuments(filter);
    const pages = Math.ceil(total / parseInt(limit));

    const calibrations = await FlowmeterCalibration.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .populate('calibratedBy', 'firstName lastName');

    const response = {
      data: calibrations.map(cal => ({
        _id: cal._id,
        flowmeterId: cal.flowmeterId,
        date: cal.date,
        flowRate: cal.flowRate,
        bubbleflowVolume: cal.bubbleflowVolume,
        status: cal.status,
        technician: cal.technician,
        nextCalibration: cal.nextCalibration,
        notes: cal.notes,
        runtime1: cal.runtime1,
        runtime2: cal.runtime2,
        runtime3: cal.runtime3,
        averageRuntime: cal.averageRuntime,
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
    console.error('Error fetching flowmeter calibrations:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get single flowmeter calibration record
router.get('/:id', auth, checkPermission(['calibrations.view']), async (req, res) => {
  try {
    const calibration = await FlowmeterCalibration.findById(req.params.id)
      .populate('calibratedBy', 'firstName lastName');

    if (!calibration) {
      return res.status(404).json({ message: 'Flowmeter calibration record not found' });
    }

    const calibrationData = {
      _id: calibration._id,
      flowmeterId: calibration.flowmeterId,
      date: calibration.date,
      flowRate: calibration.flowRate,
      bubbleflowVolume: calibration.bubbleflowVolume,
      status: calibration.status,
      technician: calibration.technician,
      nextCalibration: calibration.nextCalibration,
      notes: calibration.notes,
      runtime1: calibration.runtime1,
      runtime2: calibration.runtime2,
      runtime3: calibration.runtime3,
      averageRuntime: calibration.averageRuntime,
      calibratedBy: calibration.calibratedBy,
      createdAt: calibration.createdAt,
      updatedAt: calibration.updatedAt
    };

    res.json(calibrationData);
  } catch (error) {
    console.error('Error fetching flowmeter calibration:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get flowmeter calibrations by flowmeter ID (equipment reference)
router.get('/flowmeter/:flowmeterId', auth, checkPermission(['calibrations.view']), async (req, res) => {
  try {
    const { flowmeterId } = req.params;
    const { page = 1, limit = 50 } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const total = await FlowmeterCalibration.countDocuments({ flowmeterId });
    const pages = Math.ceil(total / parseInt(limit));

    const calibrations = await FlowmeterCalibration.find({ flowmeterId })
      .sort({ date: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('calibratedBy', 'firstName lastName');

    const response = {
      data: calibrations.map(cal => ({
        _id: cal._id,
        flowmeterId: cal.flowmeterId,
        date: cal.date,
        flowRate: cal.flowRate,
        bubbleflowVolume: cal.bubbleflowVolume,
        status: cal.status,
        technician: cal.technician,
        technicianName: cal.technician,
        nextCalibration: cal.nextCalibration,
        notes: cal.notes,
        runtime1: cal.runtime1,
        runtime2: cal.runtime2,
        runtime3: cal.runtime3,
        averageRuntime: cal.averageRuntime,
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
    console.error('Error fetching flowmeter calibrations by flowmeter:', error);
    res.status(500).json({ message: error.message });
  }
});

// Create new flowmeter calibration record
router.post('/', auth, checkPermission(['calibrations.create']), async (req, res) => {
  try {
    const calibrationData = {
      ...req.body,
      calibratedBy: req.user.id
    };

    // Convert flowRate to number if it's a string
    if (calibrationData.flowRate && typeof calibrationData.flowRate === 'string') {
      calibrationData.flowRate = parseFloat(calibrationData.flowRate);
    }

    // Ensure date is a Date object
    if (calibrationData.date && typeof calibrationData.date === 'string') {
      calibrationData.date = new Date(calibrationData.date);
    }

    // Ensure nextCalibration is a Date object
    if (calibrationData.nextCalibration && typeof calibrationData.nextCalibration === 'string') {
      calibrationData.nextCalibration = new Date(calibrationData.nextCalibration);
    }

    console.log('Creating flowmeter calibration with data:', JSON.stringify(calibrationData, null, 2));

    const calibration = new FlowmeterCalibration(calibrationData);
    const savedCalibration = await calibration.save();
    console.log('Flowmeter calibration saved successfully:', savedCalibration._id);

    // Note: Calibration data is now fetched dynamically from calibration records
    // No need to update Equipment model

    const populatedCalibration = await FlowmeterCalibration.findById(savedCalibration._id)
      .populate('calibratedBy', 'firstName lastName');

    res.status(201).json(populatedCalibration);
  } catch (error) {
    console.error('Error creating flowmeter calibration:', error);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    if (error.errors) {
      console.error('Validation errors:', error.errors);
    }
    res.status(400).json({ message: error.message });
  }
});

// Update flowmeter calibration record
router.put('/:id', auth, checkPermission(['calibrations.edit']), async (req, res) => {
  try {
    const calibration = await FlowmeterCalibration.findById(req.params.id);
    if (!calibration) {
      return res.status(404).json({ message: 'Flowmeter calibration record not found' });
    }

    // Update fields
    Object.keys(req.body).forEach(key => {
      if (req.body[key] !== undefined) {
        // Convert flowRate to number if it's a string
        if (key === 'flowRate' && typeof req.body[key] === 'string') {
          calibration[key] = parseFloat(req.body[key]);
        }
        // Convert date fields to Date objects if they're strings
        else if ((key === 'date' || key === 'nextCalibration') && typeof req.body[key] === 'string') {
          calibration[key] = new Date(req.body[key]);
        }
        else {
          calibration[key] = req.body[key];
        }
      }
    });

    const updatedCalibration = await calibration.save();

    // Note: Calibration data is now fetched dynamically from calibration records
    // No need to update Equipment model

    const populatedCalibration = await FlowmeterCalibration.findById(updatedCalibration._id)
      .populate('calibratedBy', 'firstName lastName');

    res.json(populatedCalibration);
  } catch (error) {
    console.error('Error updating flowmeter calibration:', error);
    res.status(400).json({ message: error.message });
  }
});

// Delete flowmeter calibration record
router.delete('/:id', auth, checkPermission(['calibrations.delete']), async (req, res) => {
  try {
    const calibration = await FlowmeterCalibration.findById(req.params.id);
    if (!calibration) {
      return res.status(404).json({ message: 'Flowmeter calibration record not found' });
    }

    await calibration.deleteOne();

    // Note: Calibration data is now fetched dynamically from calibration records
    // No need to update Equipment model

    res.json({ message: 'Flowmeter calibration record deleted successfully' });
  } catch (error) {
    console.error('Error deleting flowmeter calibration:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get flowmeter calibration statistics
router.get('/stats', auth, checkPermission(['calibrations.view']), async (req, res) => {
  try {
    const stats = await FlowmeterCalibration.aggregate([
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
    console.error('Error fetching flowmeter calibration statistics:', error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
