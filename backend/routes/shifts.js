const express = require('express');
const router = express.Router();
const Shift = require('../models/Shift');
const auth = require('../middleware/auth');
const checkPermission = require('../middleware/checkPermission');

// Get all shifts
router.get('/', auth, checkPermission(['jobs.view']), async (req, res) => {
  try {
    const shifts = await Shift.find()
      .populate('job')
      .populate('samples');
    res.json(shifts);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get shifts by job ID
router.get('/job/:jobId', auth, checkPermission(['jobs.view']), async (req, res) => {
  try {
    const shifts = await Shift.find({ job: req.params.jobId })
      .populate('job')
      .populate('samples');
    res.json(shifts);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get shifts by multiple job IDs
router.post('/jobs', auth, checkPermission(['jobs.view']), async (req, res) => {
  try {
    const { jobIds } = req.body;
    const shifts = await Shift.find({ job: { $in: jobIds } })
      .populate('job')
      .populate('samples');
    res.json(shifts);
  } catch (error) {
    res.status(500).json({ message: error.message });
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
    console.log('Shift returned from DB:', shift); // Debug log
    res.json(shift);
  } catch (err) {
    console.error('Error fetching shift:', err);
    res.status(500).json({ message: err.message });
  }
});

// Create a new shift
router.post('/', auth, checkPermission(['jobs.create']), async (req, res) => {
  try {
    const shift = new Shift(req.body);
    const newShift = await shift.save();
    res.status(201).json(newShift);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Update a shift
router.patch('/:id', auth, checkPermission(['jobs.edit']), async (req, res) => {
  try {
    const shift = await Shift.findById(req.params.id);
    if (!shift) {
      return res.status(404).json({ message: 'Shift not found' });
    }

    // Check for report authorization
    if (req.body.reportApprovedBy && !req.user.permissions.includes('jobs.authorize_reports')) {
      return res.status(403).json({ message: 'You do not have permission to authorize reports' });
    }

    Object.assign(shift, req.body);
    const updatedShift = await shift.save();
    res.json(updatedShift);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Delete a shift
router.delete('/:id', auth, checkPermission(['jobs.delete']), async (req, res) => {
  try {
    const shift = await Shift.findByIdAndDelete(req.params.id);
    if (!shift) {
      return res.status(404).json({ message: 'Shift not found' });
    }
    res.json({ message: 'Shift deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;