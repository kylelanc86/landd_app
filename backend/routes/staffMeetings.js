const express = require('express');
const router = express.Router();
const StaffMeeting = require('../models/StaffMeeting');
const auth = require('../middleware/auth');
const checkPermission = require('../middleware/checkPermission');

// Get all staff meeting records
router.get('/', auth, checkPermission(['projects.view']), async (req, res) => {
  try {
    const records = await StaffMeeting.find()
      .populate('meetingLeaderId', 'firstName lastName')
      .sort({ date: -1, createdAt: -1 });
    res.json(records);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get single staff meeting record
router.get('/:id', auth, checkPermission(['projects.view']), async (req, res) => {
  try {
    const record = await StaffMeeting.findById(req.params.id)
      .populate('meetingLeaderId', 'firstName lastName email');
    if (!record) {
      return res.status(404).json({ message: 'Staff meeting record not found' });
    }
    res.json(record);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Create staff meeting record
router.post('/', auth, checkPermission(['projects.create']), async (req, res) => {
  try {
    const record = new StaffMeeting({
      date: req.body.date,
      meetingLeaderId: req.body.meetingLeaderId,
      fileName: req.body.fileName || null,
      fileData: req.body.fileData || null
    });

    const newRecord = await record.save();
    const populated = await StaffMeeting.findById(newRecord._id)
      .populate('meetingLeaderId', 'firstName lastName');
    res.status(201).json(populated);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Update staff meeting record
router.patch('/:id', auth, checkPermission(['projects.edit']), async (req, res) => {
  try {
    const record = await StaffMeeting.findById(req.params.id);
    if (!record) {
      return res.status(404).json({ message: 'Staff meeting record not found' });
    }

    if (req.body.date !== undefined) record.date = req.body.date;
    if (req.body.meetingLeaderId !== undefined) record.meetingLeaderId = req.body.meetingLeaderId;
    if (req.body.fileName !== undefined) record.fileName = req.body.fileName;
    if (req.body.fileData !== undefined) record.fileData = req.body.fileData;

    const updatedRecord = await record.save();
    const populated = await StaffMeeting.findById(updatedRecord._id)
      .populate('meetingLeaderId', 'firstName lastName');
    res.json(populated);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Delete staff meeting record (admin only)
router.delete('/:id', auth, checkPermission(['admin.delete']), async (req, res) => {
  try {
    const record = await StaffMeeting.findById(req.params.id);
    if (!record) {
      return res.status(404).json({ message: 'Staff meeting record not found' });
    }
    await record.deleteOne();
    res.json({ message: 'Staff meeting record deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
