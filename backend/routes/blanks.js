const express = require('express');
const router = express.Router();
const Blank = require('../models/Blank');
const auth = require('../middleware/auth');
const checkPermission = require('../middleware/checkPermission');

// Get all blank records
router.get('/', auth, checkPermission(['projects.view']), async (req, res) => {
  try {
    const blanks = await Blank.find()
      .sort({ blankDate: -1, createdAt: -1 });
    res.json(blanks);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get single blank record
router.get('/:id', auth, checkPermission(['projects.view']), async (req, res) => {
  try {
    const blank = await Blank.findById(req.params.id);
    if (!blank) {
      return res.status(404).json({ message: 'Blank record not found' });
    }
    res.json(blank);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Create blank record
router.post('/', auth, checkPermission(['projects.create']), async (req, res) => {
  try {
    const blank = new Blank({
      blankDate: req.body.blankDate,
      status: req.body.status || 'N/A'
    });

    const newBlank = await blank.save();
    res.status(201).json(newBlank);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Update blank record
router.patch('/:id', auth, checkPermission(['projects.edit']), async (req, res) => {
  try {
    const blank = await Blank.findById(req.params.id);
    if (!blank) {
      return res.status(404).json({ message: 'Blank record not found' });
    }

    // Update fields
    if (req.body.blankDate !== undefined) {
      blank.blankDate = req.body.blankDate;
    }
    if (req.body.status !== undefined) {
      blank.status = req.body.status;
    }
    if (req.body.analysis !== undefined) {
      blank.analysis = req.body.analysis;
    }
    if (req.body.analysedBy !== undefined) {
      blank.analysedBy = req.body.analysedBy;
    }

    const updatedBlank = await blank.save();
    res.json(updatedBlank);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Delete blank record
router.delete('/:id', auth, checkPermission(['projects.delete']), async (req, res) => {
  try {
    const blank = await Blank.findById(req.params.id);
    if (!blank) {
      return res.status(404).json({ message: 'Blank record not found' });
    }

    await blank.deleteOne();
    res.json({ message: 'Blank record deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
