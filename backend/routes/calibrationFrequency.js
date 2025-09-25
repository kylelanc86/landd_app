const express = require('express');
const router = express.Router();
const CalibrationFrequency = require('../models/CalibrationFrequency');
const VariableCalibrationFrequency = require('../models/VariableCalibrationFrequency');
const auth = require('../middleware/auth');
const checkPermission = require('../middleware/checkPermission');

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

    // Update fields
    Object.keys(req.body).forEach(key => {
      if (req.body[key] !== undefined) {
        frequency[key] = req.body[key];
      }
    });
    frequency.updatedBy = req.user.id;

    const updatedFrequency = await frequency.save();

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
