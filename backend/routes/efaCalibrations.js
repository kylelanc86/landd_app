const express = require('express');
const router = express.Router();
const EFACalibration = require('../models/EFACalibration');
const Equipment = require('../models/Equipment');
const EFAArchiveService = require('../services/efaArchiveService');
const auth = require('../middleware/auth');
const checkPermission = require('../middleware/checkPermission');

// Helper function to update EFA equipment calibration dates
const updateEFAEquipmentCalibration = async (efaId, calibrationDate) => {
  try {
    await Equipment.findOneAndUpdate(
      { equipmentReference: efaId },
      { 
        lastCalibration: calibrationDate,
        // For EFA, calibration due is always "On change of Filter Holder model"
        calibrationDue: null 
      }
    );
  } catch (error) {
    console.error('Error updating EFA equipment calibration:', error);
    // Don't throw error as this is not critical to the main operation
  }
};

// Helper function to clear EFA equipment calibration dates
const clearEFAEquipmentCalibration = async (efaId) => {
  try {
    await Equipment.findOneAndUpdate(
      { equipmentReference: efaId },
      { 
        lastCalibration: null,
        calibrationDue: null 
      }
    );
  } catch (error) {
    console.error('Error clearing EFA equipment calibration:', error);
    // Don't throw error as this is not critical to the main operation
  }
};

// Get all EFA calibrations with optional filtering
router.get('/', auth, checkPermission(['calibrations.view']), async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 50, 
      filterHolderModel, 
      status, 
      technician, 
      sortBy = 'date',
      sortOrder = 'desc'
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Build filter object
    const filter = {
      archivedAt: { $exists: false } // Only show non-archived calibrations
    };
    if (filterHolderModel) filter.filterHolderModel = new RegExp(filterHolderModel, 'i');
    if (status) filter.status = status;
    if (technician) filter.technician = new RegExp(technician, 'i');

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const total = await EFACalibration.countDocuments(filter);
    const pages = Math.ceil(total / parseInt(limit));

    const calibrations = await EFACalibration.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .populate('calibratedBy', 'firstName lastName');

    const response = {
      data: calibrations.map(cal => ({
        _id: cal._id,
        date: cal.date,
        filterHolderModel: cal.filterHolderModel,
        filter1Diameter1: cal.filter1Diameter1,
        filter1Diameter2: cal.filter1Diameter2,
        filter2Diameter1: cal.filter2Diameter1,
        filter2Diameter2: cal.filter2Diameter2,
        filter3Diameter1: cal.filter3Diameter1,
        filter3Diameter2: cal.filter3Diameter2,
        status: cal.status,
        technician: cal.technician,
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
    console.error('Error fetching EFA calibrations:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get all archived EFA calibrations
router.get('/archived', auth, checkPermission(['calibrations.view']), async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 50, 
      filterHolderModel, 
      status, 
      technician, 
      sortBy = 'archivedAt',
      sortOrder = 'desc'
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Build filter object
    const filter = {};
    if (filterHolderModel) filter.filterHolderModel = new RegExp(filterHolderModel, 'i');
    if (status) filter.status = status;
    if (technician) filter.technician = new RegExp(technician, 'i');

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Get archived calibrations using the archive service
    const archivedCalibrations = await EFAArchiveService.getArchivedEFACalibrations(filter);
    
    // Apply pagination
    const total = archivedCalibrations.length;
    const pages = Math.ceil(total / parseInt(limit));
    const paginatedCalibrations = archivedCalibrations.slice(skip, skip + parseInt(limit));

    const response = {
      data: paginatedCalibrations.map(cal => ({
        _id: cal._id,
        date: cal.date,
        filterHolderModel: cal.filterHolderModel,
        filter1Diameter1: cal.filter1Diameter1,
        filter1Diameter2: cal.filter1Diameter2,
        filter2Diameter1: cal.filter2Diameter1,
        filter2Diameter2: cal.filter2Diameter2,
        filter3Diameter1: cal.filter3Diameter1,
        filter3Diameter2: cal.filter3Diameter2,
        status: cal.status,
        technician: cal.technician,
        nextCalibration: cal.nextCalibration,
        notes: cal.notes,
        calibratedBy: cal.calibratedBy,
        archivedAt: cal.archivedAt,
        archivedBy: cal.archivedBy,
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
    console.error('Error fetching archived EFA calibrations:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get EFA calibration by ID
router.get('/:id', auth, checkPermission(['calibrations.view']), async (req, res) => {
  try {
    const calibration = await EFACalibration.findById(req.params.id)
      .populate('calibratedBy', 'firstName lastName');

    if (!calibration) {
      return res.status(404).json({ message: 'EFA calibration record not found' });
    }

    res.json(calibration);
  } catch (error) {
    console.error('Error fetching EFA calibration:', error);
    res.status(500).json({ message: error.message });
  }
});

// Create new EFA calibration record
router.post('/', auth, checkPermission(['calibrations.create']), async (req, res) => {
  try {
    const calibrationData = {
      ...req.body,
      calibratedBy: req.user.id
    };

    console.log('Creating EFA calibration with data:', JSON.stringify(calibrationData, null, 2));

    // Archive old calibrations before creating the new one
    if (calibrationData.filterHolderModel && calibrationData.date) {
      try {
        const archiveResult = await EFAArchiveService.archiveOldEFACalibrations(
          calibrationData.filterHolderModel,
          calibrationData.date,
          req.user.id
        );
        console.log('Archive result:', archiveResult);
      } catch (archiveError) {
        console.error('Warning: Failed to archive old calibrations:', archiveError);
        // Continue with creating the new calibration even if archiving fails
      }
    }

    // Check for existing calibrations with same filterHolderModel
    const existingCalibration = await EFACalibration.findOne({
      filterHolderModel: calibrationData.filterHolderModel,
      archivedAt: { $exists: false } // Only check non-archived calibrations
    });
    
    if (existingCalibration) {
      console.log('Found existing calibration:', existingCalibration._id);
      console.log('Existing calibration date:', existingCalibration.date);
    } else {
      console.log('No existing calibration found with same filterHolderModel');
    }

    const calibration = new EFACalibration(calibrationData);
    const savedCalibration = await calibration.save();
    console.log('EFA calibration saved successfully:', savedCalibration._id);


    const populatedCalibration = await EFACalibration.findById(savedCalibration._id)
      .populate('calibratedBy', 'firstName lastName');

    res.status(201).json(populatedCalibration);
  } catch (error) {
    console.error('Error creating EFA calibration:', error);
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

// Update EFA calibration record
router.put('/:id', auth, checkPermission(['calibrations.update']), async (req, res) => {
  try {
    const calibration = await EFACalibration.findById(req.params.id);
    if (!calibration) {
      return res.status(404).json({ message: 'EFA calibration record not found' });
    }

    // Update fields
    Object.keys(req.body).forEach(key => {
      if (req.body[key] !== undefined) {
        calibration[key] = req.body[key];
      }
    });

    const updatedCalibration = await calibration.save();


    const populatedCalibration = await EFACalibration.findById(updatedCalibration._id)
      .populate('calibratedBy', 'firstName lastName');

    res.json(populatedCalibration);
  } catch (error) {
    console.error('Error updating EFA calibration:', error);
    res.status(400).json({ message: error.message });
  }
});

// Delete EFA calibration record
router.delete('/:id', auth, checkPermission(['calibrations.delete']), async (req, res) => {
  try {
    const calibration = await EFACalibration.findById(req.params.id);
    if (!calibration) {
      return res.status(404).json({ message: 'EFA calibration record not found' });
    }

    await EFACalibration.findByIdAndDelete(req.params.id);

    res.json({ message: 'EFA calibration record deleted successfully' });
  } catch (error) {
    console.error('Error deleting EFA calibration:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get EFA calibrations by filter holder model
router.get('/equipment/:filterHolderModel', auth, checkPermission(['calibrations.view']), async (req, res) => {
  try {
    const calibrations = await EFACalibration.find({ filterHolderModel: req.params.filterHolderModel })
      .populate('calibratedBy', 'firstName lastName')
      .sort({ date: -1 });

    res.json({ data: calibrations });
  } catch (error) {
    console.error('Error fetching EFA calibrations by filter holder model:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get EFA calibration statistics
router.get('/stats/overview', auth, checkPermission(['calibrations.view']), async (req, res) => {
  try {
    const totalCalibrations = await EFACalibration.countDocuments();
    const passCount = await EFACalibration.countDocuments({ status: 'Pass' });
    const failCount = await EFACalibration.countDocuments({ status: 'Fail' });
    
    const recentCalibrations = await EFACalibration.find()
      .sort({ date: -1 })
      .limit(5)
      .populate('calibratedBy', 'firstName lastName');

    res.json({
      totalCalibrations,
      passCount,
      failCount,
      recentCalibrations
    });
  } catch (error) {
    console.error('Error fetching EFA calibration statistics:', error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
