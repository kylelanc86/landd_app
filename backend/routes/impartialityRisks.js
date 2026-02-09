const express = require('express');
const router = express.Router();
const ImpartialityRisk = require('../models/ImpartialityRisk');
const auth = require('../middleware/auth');
const checkPermission = require('../middleware/checkPermission');

// Get all impartiality risk records
router.get('/', auth, checkPermission(['projects.view']), async (req, res) => {
  try {
    const records = await ImpartialityRisk.find().sort({ createdAt: -1 });
    res.json(records);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get single impartiality risk record
router.get('/:id', auth, checkPermission(['projects.view']), async (req, res) => {
  try {
    const record = await ImpartialityRisk.findById(req.params.id);
    if (!record) {
      return res.status(404).json({ message: 'Impartiality risk record not found' });
    }
    res.json(record);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Create impartiality risk record
router.post('/', auth, checkPermission(['projects.create']), async (req, res) => {
  try {
    const record = new ImpartialityRisk({
      activity: req.body.activity,
      riskToImpartiality: req.body.riskToImpartiality,
      consequenceRating: req.body.consequenceRating,
      likelihood: req.body.likelihood,
      riskRating: req.body.riskRating || null,
      controlsToMitigate: req.body.controlsToMitigate,
      residualConsequence: req.body.residualConsequence,
      residualLikelihood: req.body.residualLikelihood,
      residualRiskRating: req.body.residualRiskRating || null,
      furtherControlsRequired: req.body.furtherControlsRequired || ''
    });

    const newRecord = await record.save();
    res.status(201).json(newRecord);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Update impartiality risk record
router.patch('/:id', auth, checkPermission(['projects.edit']), async (req, res) => {
  try {
    const record = await ImpartialityRisk.findById(req.params.id);
    if (!record) {
      return res.status(404).json({ message: 'Impartiality risk record not found' });
    }

    const allowed = [
      'activity', 'riskToImpartiality', 'consequenceRating', 'likelihood',
      'riskRating', 'controlsToMitigate', 'residualConsequence', 'residualLikelihood',
      'residualRiskRating', 'furtherControlsRequired'
    ];
    allowed.forEach((field) => {
      if (req.body[field] !== undefined) record[field] = req.body[field];
    });

    const updatedRecord = await record.save();
    res.json(updatedRecord);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Delete impartiality risk record (admin only)
router.delete('/:id', auth, checkPermission(['admin.delete']), async (req, res) => {
  try {
    const record = await ImpartialityRisk.findById(req.params.id);
    if (!record) {
      return res.status(404).json({ message: 'Impartiality risk record not found' });
    }
    await record.deleteOne();
    res.json({ message: 'Impartiality risk record deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
