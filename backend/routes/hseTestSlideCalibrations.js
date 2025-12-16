const express = require('express');
const router = express.Router();
const HSETestSlideCalibration = require('../models/HSETestSlideCalibration');
const Equipment = require('../models/Equipment');

// Get all HSE Test Slide calibrations
router.get('/', async (req, res) => {
  try {
    const { testSlideReference } = req.query;
    
    let filter = {};
    if (testSlideReference) {
      filter.testSlideReference = { $regex: testSlideReference, $options: 'i' };
    }

    const calibrations = await HSETestSlideCalibration.find(filter)
      .populate('calibratedBy', 'firstName lastName')
      .sort({ date: -1 });

    const data = calibrations.map(calibration => ({
      _id: calibration._id,
      calibrationId: calibration.calibrationId,
      testSlideReference: calibration.testSlideReference,
      date: calibration.date,
      calibrationCompany: calibration.calibrationCompany,
      certificateNumber: calibration.certificateNumber,
      certificateUrl: calibration.certificateUrl,
      notes: calibration.notes,
      calibratedBy: calibration.calibratedBy ? {
        _id: calibration.calibratedBy._id,
        name: `${calibration.calibratedBy.firstName} ${calibration.calibratedBy.lastName}`
      } : null,
      createdAt: calibration.createdAt,
      updatedAt: calibration.updatedAt
    }));

    res.json(data);
  } catch (error) {
    console.error('Error fetching HSE Test Slide calibrations:', error);
    res.status(500).json({ error: 'Failed to fetch HSE Test Slide calibrations' });
  }
});

// Get calibrations by test slide reference
router.get('/equipment/:testSlideReference', async (req, res) => {
  try {
    const calibrations = await HSETestSlideCalibration.find({
      testSlideReference: req.params.testSlideReference
    })
      .populate('calibratedBy', 'firstName lastName')
      .sort({ date: -1 });

    const data = calibrations.map(calibration => ({
      _id: calibration._id,
      calibrationId: calibration.calibrationId,
      testSlideReference: calibration.testSlideReference,
      date: calibration.date,
      calibrationCompany: calibration.calibrationCompany,
      certificateNumber: calibration.certificateNumber,
      certificateUrl: calibration.certificateUrl,
      notes: calibration.notes,
      calibratedBy: calibration.calibratedBy ? {
        _id: calibration.calibratedBy._id,
        name: `${calibration.calibratedBy.firstName} ${calibration.calibratedBy.lastName}`
      } : null,
      createdAt: calibration.createdAt,
      updatedAt: calibration.updatedAt
    }));

    res.json({ data: data });
  } catch (error) {
    console.error('Error fetching HSE Test Slide calibrations by equipment:', error);
    res.status(500).json({ error: 'Failed to fetch HSE Test Slide calibrations' });
  }
});

// Create new HSE Test Slide calibration
router.post('/', async (req, res) => {
  try {
    console.log('HSE Test Slide calibration creation request:', req.body);
    
    const {
      testSlideReference,
      date,
      calibrationCompany,
      certificateNumber,
      certificateUrl,
      notes,
      calibratedBy
    } = req.body;

    // Generate calibration ID if not provided
    let calibrationId = req.body.calibrationId;
    if (!calibrationId) {
      const count = await HSETestSlideCalibration.countDocuments();
      calibrationId = `HSE-${String(count + 1).padStart(4, '0')}`;
    }

    // Validate required fields
    if (!testSlideReference || !date || !calibrationCompany || !calibratedBy) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const calibrationData = {
      calibrationId,
      testSlideReference,
      date: new Date(date),
      calibrationCompany,
      certificateNumber: certificateNumber || null,
      certificateUrl: certificateUrl || null,
      notes: notes || '',
      calibratedBy
    };

    console.log('Calibration data to save:', calibrationData);
    
    const calibration = new HSETestSlideCalibration(calibrationData);
    await calibration.save();

    console.log('Calibration saved successfully:', calibration);

    res.status(201).json({
      message: 'HSE Test Slide calibration created successfully',
      calibration: calibration
    });
  } catch (error) {
    console.error('Error creating HSE Test Slide calibration:', error);
    res.status(500).json({ error: 'Failed to create HSE Test Slide calibration' });
  }
});

// Update HSE Test Slide calibration
router.put('/:id', async (req, res) => {
  try {
    const {
      testSlideReference,
      date,
      calibrationCompany,
      certificateNumber,
      certificateUrl,
      notes
    } = req.body;

    // Validate required fields
    if (!testSlideReference || !date || !calibrationCompany) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const updateData = {
      testSlideReference,
      date: new Date(date),
      calibrationCompany,
      certificateNumber: certificateNumber || null,
      certificateUrl: certificateUrl || null,
      notes: notes || ''
    };

    const calibration = await HSETestSlideCalibration.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!calibration) {
      return res.status(404).json({ error: 'HSE Test Slide calibration not found' });
    }

    res.json({
      message: 'HSE Test Slide calibration updated successfully',
      calibration: calibration
    });
  } catch (error) {
    console.error('Error updating HSE Test Slide calibration:', error);
    res.status(500).json({ error: 'Failed to update HSE Test Slide calibration' });
  }
});

// Delete HSE Test Slide calibration
router.delete('/:id', async (req, res) => {
  try {
    const calibration = await HSETestSlideCalibration.findByIdAndDelete(req.params.id);

    if (!calibration) {
      return res.status(404).json({ error: 'HSE Test Slide calibration not found' });
    }

    res.json({ message: 'HSE Test Slide calibration deleted successfully' });
  } catch (error) {
    console.error('Error deleting HSE Test Slide calibration:', error);
    res.status(500).json({ error: 'Failed to delete HSE Test Slide calibration' });
  }
});

module.exports = router;

