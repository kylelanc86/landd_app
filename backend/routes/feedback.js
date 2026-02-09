const express = require('express');
const router = express.Router();
const Feedback = require('../models/Feedback');
const auth = require('../middleware/auth');
const checkPermission = require('../middleware/checkPermission');

// Get all feedback records
router.get('/', auth, checkPermission(['projects.view']), async (req, res) => {
  try {
    const records = await Feedback.find().sort({ date: -1, createdAt: -1 });
    res.json(records);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get single feedback record
router.get('/:id', auth, checkPermission(['projects.view']), async (req, res) => {
  try {
    const record = await Feedback.findById(req.params.id);
    if (!record) {
      return res.status(404).json({ message: 'Feedback record not found' });
    }
    res.json(record);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Create feedback record
router.post('/', auth, checkPermission(['projects.create']), async (req, res) => {
  try {
    const record = new Feedback({
      date: req.body.date,
      feedbackDescription: req.body.feedbackDescription,
      feedbackType: req.body.feedbackType,
      nonConformance: req.body.nonConformance || '',
      nonConformanceReference: req.body.nonConformanceReference || null,
      receivedBy: req.body.receivedBy
    });

    const newRecord = await record.save();
    res.status(201).json(newRecord);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Update feedback record
router.patch('/:id', auth, checkPermission(['projects.edit']), async (req, res) => {
  try {
    const record = await Feedback.findById(req.params.id);
    if (!record) {
      return res.status(404).json({ message: 'Feedback record not found' });
    }

    const allowed = [
      'date', 'feedbackDescription', 'feedbackType', 'nonConformance',
      'nonConformanceReference', 'receivedBy'
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

// Delete feedback record (admin only)
router.delete('/:id', auth, checkPermission(['admin.delete']), async (req, res) => {
  try {
    const record = await Feedback.findById(req.params.id);
    if (!record) {
      return res.status(404).json({ message: 'Feedback record not found' });
    }
    await record.deleteOne();
    res.json({ message: 'Feedback record deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
