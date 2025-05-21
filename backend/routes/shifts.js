const express = require('express');
const router = express.Router();
const Shift = require('../models/Shift');
const auth = require('../middleware/auth');

// Get all shifts
router.get('/', auth, async (req, res) => {
  try {
    console.log('Fetching all shifts...');
    const shifts = await Shift.find()
      .populate({
        path: 'job',
        populate: {
          path: 'project',
          select: 'projectID name'
        }
      })
      .populate('supervisor', 'firstName lastName')
      .sort({ date: -1 });
    console.log(`Found ${shifts.length} shifts`);
    res.json(shifts);
  } catch (err) {
    console.error('Error fetching shifts:', err);
    res.status(500).json({ message: err.message });
  }
});

// Get shifts by job ID
router.get('/job/:jobId', auth, async (req, res) => {
  try {
    console.log(`Fetching shifts for job ${req.params.jobId}...`);
    const shifts = await Shift.find({ job: req.params.jobId })
      .populate({
        path: 'job',
        populate: {
          path: 'project',
          select: 'projectID name'
        }
      })
      .populate('supervisor', 'firstName lastName')
      .sort({ date: -1 });
    console.log(`Found ${shifts.length} shifts for job ${req.params.jobId}`);
    res.json(shifts);
  } catch (err) {
    console.error('Error fetching shifts by job:', err);
    res.status(500).json({ message: err.message });
  }
});

// Get single shift
router.get('/:id', auth, async (req, res) => {
  try {
    console.log(`Fetching shift ${req.params.id}...`);
    const shift = await Shift.findById(req.params.id)
      .populate({
        path: 'job',
        select: 'jobID name project status asbestosRemovalist description',
        populate: {
          path: 'project',
          select: 'projectID name'
        }
      })
      .populate('supervisor', 'firstName lastName');
    if (!shift) {
      console.log(`Shift ${req.params.id} not found`);
      return res.status(404).json({ message: 'Shift not found' });
    }
    console.log(`Found shift ${req.params.id} with job data:`, shift.job);
    console.log(`Job ID from populated data:`, shift.job?.jobID);
    res.json(shift);
  } catch (err) {
    console.error('Error fetching shift:', err);
    res.status(500).json({ message: err.message });
  }
});

// Create shift
router.post('/', auth, async (req, res) => {
  try {
    console.log('Creating new shift with data:', req.body);
    const shift = new Shift({
      job: req.body.job,
      name: req.body.name,
      date: req.body.date,
      startTime: req.body.startTime,
      endTime: req.body.endTime,
      supervisor: req.body.supervisor,
      status: req.body.status || 'pending',
      notes: req.body.notes
    });

    const newShift = await shift.save();
    console.log('Created shift:', newShift._id);
    
    const populatedShift = await Shift.findById(newShift._id)
      .populate({
        path: 'job',
        populate: {
          path: 'project',
          select: 'projectID name'
        }
      })
      .populate('supervisor', 'firstName lastName');
    
    res.status(201).json(populatedShift);
  } catch (err) {
    console.error('Error creating shift:', err);
    res.status(400).json({ message: err.message });
  }
});

// Update shift
router.put('/:id', auth, async (req, res) => {
  try {
    console.log(`Updating shift ${req.params.id} with data:`, req.body);
    const shift = await Shift.findById(req.params.id);
    if (!shift) {
      console.log(`Shift ${req.params.id} not found`);
      return res.status(404).json({ message: 'Shift not found' });
    }

    Object.assign(shift, req.body);
    const updatedShift = await shift.save();
    console.log(`Updated shift ${req.params.id}`);
    
    const populatedShift = await Shift.findById(updatedShift._id)
      .populate({
        path: 'job',
        populate: {
          path: 'project',
          select: 'projectID name'
        }
      })
      .populate('supervisor', 'firstName lastName');
    
    res.json(populatedShift);
  } catch (err) {
    console.error('Error updating shift:', err);
    res.status(400).json({ message: err.message });
  }
});

// Delete shift
router.delete('/:id', auth, async (req, res) => {
  try {
    console.log(`Deleting shift ${req.params.id}...`);
    const shift = await Shift.findById(req.params.id);
    if (!shift) {
      console.log(`Shift ${req.params.id} not found`);
      return res.status(404).json({ message: 'Shift not found' });
    }

    await shift.deleteOne();
    console.log(`Deleted shift ${req.params.id}`);
    res.json({ message: 'Shift deleted' });
  } catch (err) {
    console.error('Error deleting shift:', err);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router; 