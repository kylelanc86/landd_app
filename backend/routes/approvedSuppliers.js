const express = require('express');
const router = express.Router();
const ApprovedSupplier = require('../models/ApprovedSupplier');
const auth = require('../middleware/auth');
const checkPermission = require('../middleware/checkPermission');

// Get all approved supplier records
router.get('/', auth, checkPermission(['projects.view']), async (req, res) => {
  try {
    const records = await ApprovedSupplier.find().sort({ companyName: 1, createdAt: -1 });
    res.json(records);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get single approved supplier record
router.get('/:id', auth, checkPermission(['projects.view']), async (req, res) => {
  try {
    const record = await ApprovedSupplier.findById(req.params.id);
    if (!record) {
      return res.status(404).json({ message: 'Approved supplier record not found' });
    }
    res.json(record);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Create approved supplier record
router.post('/', auth, checkPermission(['projects.create']), async (req, res) => {
  try {
    const record = new ApprovedSupplier({
      supplierType: req.body.supplierType,
      companyName: req.body.companyName,
      description: req.body.description,
      contactName: req.body.contactName || '',
      contactNumber: req.body.contactNumber || '',
      contactEmail: req.body.contactEmail || '',
      accreditationRequired: req.body.accreditationRequired,
      accreditationCheckedDate: req.body.accreditationCheckedDate || null,
      notesItemSpecs: req.body.notesItemSpecs || ''
    });

    const newRecord = await record.save();
    res.status(201).json(newRecord);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Update approved supplier record
router.patch('/:id', auth, checkPermission(['projects.edit']), async (req, res) => {
  try {
    const record = await ApprovedSupplier.findById(req.params.id);
    if (!record) {
      return res.status(404).json({ message: 'Approved supplier record not found' });
    }

    if (req.body.supplierType !== undefined) record.supplierType = req.body.supplierType;
    if (req.body.companyName !== undefined) record.companyName = req.body.companyName;
    if (req.body.description !== undefined) record.description = req.body.description;
    if (req.body.contactName !== undefined) record.contactName = req.body.contactName;
    if (req.body.contactNumber !== undefined) record.contactNumber = req.body.contactNumber;
    if (req.body.contactEmail !== undefined) record.contactEmail = req.body.contactEmail;
    if (req.body.accreditationRequired !== undefined) record.accreditationRequired = req.body.accreditationRequired;
    if (req.body.accreditationCheckedDate !== undefined) record.accreditationCheckedDate = req.body.accreditationCheckedDate;
    if (req.body.notesItemSpecs !== undefined) record.notesItemSpecs = req.body.notesItemSpecs;

    const updatedRecord = await record.save();
    res.json(updatedRecord);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Delete approved supplier record (admin only)
router.delete('/:id', auth, checkPermission(['admin.delete']), async (req, res) => {
  try {
    const record = await ApprovedSupplier.findById(req.params.id);
    if (!record) {
      return res.status(404).json({ message: 'Approved supplier record not found' });
    }
    await record.deleteOne();
    res.json({ message: 'Approved supplier record deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
