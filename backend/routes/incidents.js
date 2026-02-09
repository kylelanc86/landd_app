const express = require('express');
const router = express.Router();
const Incident = require('../models/Incident');
const auth = require('../middleware/auth');
const checkPermission = require('../middleware/checkPermission');

// Get all incident/non-conformance records
// Note: reportedBy is Mixed (ObjectId or string for free text) - do not populate
router.get('/', auth, checkPermission(['projects.view']), async (req, res) => {
  try {
    const records = await Incident.find()
      .populate('personResponsible', 'firstName lastName')
      .populate('signedOffBy', 'firstName lastName')
      .sort({ date: -1, createdAt: -1 });
    res.json(records);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get single record
router.get('/:id', auth, checkPermission(['projects.view']), async (req, res) => {
  try {
    const record = await Incident.findById(req.params.id)
      .populate('personResponsible', 'firstName lastName email')
      .populate('signedOffBy', 'firstName lastName email');
    if (!record) {
      return res.status(404).json({ message: 'Record not found' });
    }
    res.json(record);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Create record
router.post('/', auth, checkPermission(['projects.create']), async (req, res) => {
  try {
    const record = new Incident({
      type: req.body.type,
      ref: req.body.ref,
      date: req.body.date,
      reportedBy: req.body.reportedBy,
      nature: req.body.nature,
      description: req.body.description,
      category: req.body.category,
      correctiveActionRequired: req.body.correctiveActionRequired ?? false,
      correctiveAction: req.body.correctiveAction || null,
      personResponsible: req.body.personResponsible || null,
      correctiveActionDue: req.body.correctiveActionDue || null,
      attachments: req.body.attachments || []
    });

    const newRecord = await record.save();
    const populated = await Incident.findById(newRecord._id)
      .populate('personResponsible', 'firstName lastName')
      .populate('signedOffBy', 'firstName lastName');
    res.status(201).json(populated);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Update record
router.patch('/:id', auth, checkPermission(['projects.edit']), async (req, res) => {
  try {
    const record = await Incident.findById(req.params.id);
    if (!record) {
      return res.status(404).json({ message: 'Record not found' });
    }

    const updates = [
      'type', 'ref', 'date', 'reportedBy', 'nature', 'description', 'category',
      'correctiveActionRequired', 'correctiveAction', 'personResponsible',
      'correctiveActionDue', 'attachments',
      'signedOffBy', 'signedOffByName', 'signedOffAt', 'signOffEvidence',
      'signOffEvidenceFileName', 'signOffEvidenceFileData'
    ];
    updates.forEach((field) => {
      if (req.body[field] !== undefined) record[field] = req.body[field];
    });

    const updatedRecord = await record.save();
    const populated = await Incident.findById(updatedRecord._id)
      .populate('personResponsible', 'firstName lastName')
      .populate('signedOffBy', 'firstName lastName');
    res.json(populated);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Sign off record (PATCH subset)
router.patch('/:id/sign-off', auth, checkPermission(['projects.edit']), async (req, res) => {
  try {
    const record = await Incident.findById(req.params.id);
    if (!record) {
      return res.status(404).json({ message: 'Record not found' });
    }

    record.signedOffBy = req.body.signedOffBy;
    record.signedOffByName = req.body.signedOffByName;
    record.signedOffAt = req.body.signedOffAt;
    record.signOffEvidence = req.body.signOffEvidence;
    record.signOffEvidenceFileName = req.body.signOffEvidenceFileName || null;
    record.signOffEvidenceFileData = req.body.signOffEvidenceFileData || null;

    const updatedRecord = await record.save();
    const populated = await Incident.findById(updatedRecord._id)
      .populate('personResponsible', 'firstName lastName')
      .populate('signedOffBy', 'firstName lastName');
    res.json(populated);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Delete record (admin only)
router.delete('/:id', auth, checkPermission(['admin.delete']), async (req, res) => {
  try {
    const record = await Incident.findById(req.params.id);
    if (!record) {
      return res.status(404).json({ message: 'Record not found' });
    }
    await record.deleteOne();
    res.json({ message: 'Record deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
