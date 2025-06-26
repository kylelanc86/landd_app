const express = require('express');
const router = express.Router();
const AirPump = require('../models/AirPump');
const auth = require('../middleware/auth');
const checkPermission = require('../middleware/checkPermission');

// Get all air pumps with pagination and filtering
router.get('/', auth, checkPermission(['calibrations.view']), async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      sortBy = 'pumpReference',
      sortOrder = 'asc',
      status,
      search
    } = req.query;

    // Build query
    const query = {};
    
    if (status && status !== 'all') {
      query.status = status;
    }
    
    if (search) {
      query.$or = [
        { pumpReference: { $regex: search, $options: 'i' } },
        { pumpDetails: { $regex: search, $options: 'i' } },
        { manufacturer: { $regex: search, $options: 'i' } },
        { model: { $regex: search, $options: 'i' } }
      ];
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const total = await AirPump.countDocuments(query);
    const pages = Math.ceil(total / parseInt(limit));

    // Get pumps with pagination and sorting
    const pumps = await AirPump.find(query)
      .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('lastCalibratedBy', 'firstName lastName');

    // Transform response to include virtual fields
    const response = {
      data: pumps.map(pump => ({
        _id: pump._id,
        pumpReference: pump.pumpReference,
        pumpDetails: pump.pumpDetails,
        calibrationDate: pump.calibrationDate,
        calibrationDue: pump.calibrationDue,
        maxFlowrate: pump.maxFlowrate,
        status: pump.status,
        notes: pump.notes,
        lastCalibratedBy: pump.lastCalibratedBy,
        manufacturer: pump.manufacturer,
        model: pump.model,
        serialNumber: pump.serialNumber,
        location: pump.location,
        purchaseDate: pump.purchaseDate,
        warrantyExpiry: pump.warrantyExpiry,
        isCalibrationOverdue: pump.isCalibrationOverdue,
        daysUntilCalibration: pump.daysUntilCalibration,
        calibrationStatus: pump.getCalibrationStatus(),
        createdAt: pump.createdAt,
        updatedAt: pump.updatedAt
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
    console.error('Error fetching air pumps:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get single air pump by ID
router.get('/:id', auth, checkPermission(['calibrations.view']), async (req, res) => {
  try {
    const pump = await AirPump.findById(req.params.id)
      .populate('lastCalibratedBy', 'firstName lastName');
    
    if (!pump) {
      return res.status(404).json({ message: 'Air pump not found' });
    }

    const pumpData = {
      _id: pump._id,
      pumpReference: pump.pumpReference,
      pumpDetails: pump.pumpDetails,
      calibrationDate: pump.calibrationDate,
      calibrationDue: pump.calibrationDue,
      maxFlowrate: pump.maxFlowrate,
      status: pump.status,
      notes: pump.notes,
      lastCalibratedBy: pump.lastCalibratedBy,
      manufacturer: pump.manufacturer,
      model: pump.model,
      serialNumber: pump.serialNumber,
      location: pump.location,
      purchaseDate: pump.purchaseDate,
      warrantyExpiry: pump.warrantyExpiry,
      isCalibrationOverdue: pump.isCalibrationOverdue,
      daysUntilCalibration: pump.daysUntilCalibration,
      calibrationStatus: pump.getCalibrationStatus(),
      createdAt: pump.createdAt,
      updatedAt: pump.updatedAt
    };

    res.json(pumpData);
  } catch (error) {
    console.error('Error fetching air pump:', error);
    res.status(500).json({ message: error.message });
  }
});

// Create new air pump
router.post('/', auth, checkPermission(['calibrations.create']), async (req, res) => {
  try {
    const pumpData = {
      ...req.body,
      lastCalibratedBy: req.user.id
    };

    const pump = new AirPump(pumpData);
    const savedPump = await pump.save();
    
    const populatedPump = await AirPump.findById(savedPump._id)
      .populate('lastCalibratedBy', 'firstName lastName');

    res.status(201).json(populatedPump);
  } catch (error) {
    console.error('Error creating air pump:', error);
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Pump reference already exists' });
    }
    res.status(400).json({ message: error.message });
  }
});

// Update air pump
router.put('/:id', auth, checkPermission(['calibrations.edit']), async (req, res) => {
  try {
    const pump = await AirPump.findById(req.params.id);
    if (!pump) {
      return res.status(404).json({ message: 'Air pump not found' });
    }

    // Update fields
    Object.keys(req.body).forEach(key => {
      if (req.body[key] !== undefined) {
        pump[key] = req.body[key];
      }
    });

    // Update lastCalibratedBy if calibration date is being updated
    if (req.body.calibrationDate) {
      pump.lastCalibratedBy = req.user.id;
      // The pre-save middleware will automatically recalculate calibrationDue
    }

    const updatedPump = await pump.save();
    
    const populatedPump = await AirPump.findById(updatedPump._id)
      .populate('lastCalibratedBy', 'firstName lastName');

    res.json(populatedPump);
  } catch (error) {
    console.error('Error updating air pump:', error);
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Pump reference already exists' });
    }
    res.status(400).json({ message: error.message });
  }
});

// Delete air pump
router.delete('/:id', auth, checkPermission(['calibrations.delete']), async (req, res) => {
  try {
    const pump = await AirPump.findById(req.params.id);
    if (!pump) {
      return res.status(404).json({ message: 'Air pump not found' });
    }

    await pump.deleteOne();
    res.json({ message: 'Air pump deleted successfully' });
  } catch (error) {
    console.error('Error deleting air pump:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get air pump statistics
router.get('/stats/overview', auth, checkPermission(['calibrations.view']), async (req, res) => {
  try {
    const stats = await AirPump.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const totalPumps = await AirPump.countDocuments();
    const overduePumps = await AirPump.countDocuments({
      calibrationDue: { $lt: new Date() }
    });
    const dueSoonPumps = await AirPump.countDocuments({
      calibrationDue: {
        $gte: new Date(),
        $lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
      }
    });

    const statsObject = stats.reduce((acc, stat) => {
      acc[stat._id] = stat.count;
      return acc;
    }, {});

    res.json({
      totalPumps,
      activePumps: statsObject['Active'] || 0,
      inactivePumps: statsObject['Inactive'] || 0,
      overduePumps,
      dueSoonPumps
    });
  } catch (error) {
    console.error('Error fetching air pump statistics:', error);
    res.status(500).json({ message: error.message });
  }
});

// Fix date parsing issues in existing data
router.post('/fix-dates', auth, checkPermission(['calibrations.edit']), async (req, res) => {
  try {
    const updatedCount = await AirPump.fixDateIssues();
    res.json({ 
      message: `Successfully updated ${updatedCount} air pumps with date fixes`,
      updatedCount 
    });
  } catch (error) {
    console.error('Error fixing date issues:', error);
    res.status(500).json({ message: error.message });
  }
});

// Update all "Inactive" statuses to "Out of Service"
router.post('/update-inactive-status', auth, checkPermission(['calibrations.edit']), async (req, res) => {
  try {
    const result = await AirPump.updateMany(
      { status: "Inactive" },
      { status: "Out of Service" }
    );
    
    res.json({ 
      message: `Successfully updated ${result.modifiedCount} air pumps from "Inactive" to "Out of Service"`,
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    console.error('Error updating inactive statuses:', error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router; 