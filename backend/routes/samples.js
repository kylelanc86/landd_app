const express = require('express');
const router = express.Router();
const Sample = require('../models/Sample');

// Get all samples
router.get('/', async (req, res) => {
  try {
    const samples = await Sample.find()
      .populate('job')
      .populate('collectedBy')
      .populate('analyzedBy')
      .sort({ dateCollected: -1 });
    res.json(samples);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get single sample
router.get('/:id', async (req, res) => {
  try {
    const sample = await Sample.findById(req.params.id)
      .populate('job')
      .populate('collectedBy')
      .populate('analyzedBy');
    if (!sample) {
      return res.status(404).json({ message: 'Sample not found' });
    }
    res.json(sample);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Create sample
router.post('/', async (req, res) => {
  const sample = new Sample({
    job: req.body.job,
    sampleNumber: req.body.sampleNumber,
    type: req.body.type,
    location: req.body.location,
    dateCollected: req.body.dateCollected,
    dateAnalyzed: req.body.dateAnalyzed,
    status: req.body.status,
    results: req.body.results,
    notes: req.body.notes,
    collectedBy: req.body.collectedBy,
    analyzedBy: req.body.analyzedBy
  });

  try {
    const newSample = await sample.save();
    res.status(201).json(newSample);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Update sample
router.patch('/:id', async (req, res) => {
  try {
    const sample = await Sample.findById(req.params.id);
    if (!sample) {
      return res.status(404).json({ message: 'Sample not found' });
    }

    Object.keys(req.body).forEach(key => {
      sample[key] = req.body[key];
    });

    const updatedSample = await sample.save();
    res.json(updatedSample);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Delete sample
router.delete('/:id', async (req, res) => {
  try {
    const sample = await Sample.findById(req.params.id);
    if (!sample) {
      return res.status(404).json({ message: 'Sample not found' });
    }

    await sample.deleteOne();
    res.json({ message: 'Sample deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
