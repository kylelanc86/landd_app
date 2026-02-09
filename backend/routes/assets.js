const express = require('express');
const router = express.Router();
const Asset = require('../models/Asset');
const auth = require('../middleware/auth');
const checkPermission = require('../middleware/checkPermission');

// Get all assets
router.get('/', auth, checkPermission(['projects.view']), async (req, res) => {
  try {
    const records = await Asset.find().sort({ assetReference: 1, createdAt: -1 });
    res.json(records);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get single asset
router.get('/:id', auth, checkPermission(['projects.view']), async (req, res) => {
  try {
    const record = await Asset.findById(req.params.id);
    if (!record) {
      return res.status(404).json({ message: 'Asset not found' });
    }
    res.json(record);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Create asset
router.post('/', auth, checkPermission(['projects.create']), async (req, res) => {
  try {
    const record = new Asset({
      assetReference: req.body.assetReference?.trim() || '',
      assetDescription: req.body.assetDescription?.trim() || '',
      electrical: req.body.electrical,
      testAndTagDate: req.body.electrical === 'yes' && req.body.testAndTagDate ? req.body.testAndTagDate : null,
      status: req.body.status
    });

    const newRecord = await record.save();
    res.status(201).json(newRecord);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Update asset
router.patch('/:id', auth, checkPermission(['projects.edit']), async (req, res) => {
  try {
    const record = await Asset.findById(req.params.id);
    if (!record) {
      return res.status(404).json({ message: 'Asset not found' });
    }

    if (req.body.assetReference !== undefined) record.assetReference = req.body.assetReference.trim();
    if (req.body.assetDescription !== undefined) record.assetDescription = req.body.assetDescription.trim();
    if (req.body.electrical !== undefined) {
      record.electrical = req.body.electrical;
      if (req.body.electrical === 'no') record.testAndTagDate = null;
    }
    if (req.body.testAndTagDate !== undefined) {
      record.testAndTagDate = (record.electrical === 'yes' && req.body.testAndTagDate) ? req.body.testAndTagDate : null;
    }
    if (req.body.status !== undefined) record.status = req.body.status;

    const updatedRecord = await record.save();
    res.json(updatedRecord);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Delete asset (admin only)
router.delete('/:id', auth, checkPermission(['admin.delete']), async (req, res) => {
  try {
    const record = await Asset.findById(req.params.id);
    if (!record) {
      return res.status(404).json({ message: 'Asset not found' });
    }
    await record.deleteOne();
    res.json({ message: 'Asset deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
