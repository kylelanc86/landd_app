const express = require('express');
const router = express.Router();
const Shift = require('../models/Shift');
const auth = require('../middleware/auth');
const checkPermission = require('../middleware/checkPermission');
const mongoose = require('mongoose');

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
    console.log('Fetching shifts for job:', req.params.jobId);
    console.log('User making request:', req.user._id);
    
    // First check if the job exists
    const job = await mongoose.model('AirMonitoringJob').findById(req.params.jobId);
    if (!job) {
      console.log('Job not found:', req.params.jobId);
      return res.status(404).json({ message: 'Job not found' });
    }
    console.log('Found job:', job.jobID);

    // Then fetch the shifts
    const shifts = await Shift.find({ job: req.params.jobId })
      .populate({
        path: 'job',
        select: 'jobID name project status asbestosRemovalist description',
        populate: {
          path: 'project',
          select: 'projectID name'
        }
      })
      .populate('samples');
    
    console.log('Found shifts:', shifts.length);
    res.json(shifts);
  } catch (error) {
    console.error('Error fetching shifts by job:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
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
router.patch('/:id', auth, checkPermission(['jobs.edit', 'jobs.authorize_reports']), async (req, res) => {
  try {
    console.log('Updating shift with data:', req.body);
    
    const shift = await Shift.findById(req.params.id);
    if (!shift) {
      return res.status(404).json({ message: 'Shift not found' });
    }

    // Only update the fields that are provided in the request
    const allowedUpdates = [
      'status',
      'reportApprovedBy',
      'reportIssueDate',
      'analysedBy',
      'analysisDate',
      'samplesReceivedDate',
      'descriptionOfWorks',
      'notes'
    ];

    // Filter out any fields that aren't in allowedUpdates
    const updates = Object.keys(req.body)
      .filter(key => allowedUpdates.includes(key))
      .reduce((obj, key) => {
        obj[key] = req.body[key];
        return obj;
      }, {});

    console.log('Filtered updates:', updates);

    // Update each field individually
    for (const [key, value] of Object.entries(updates)) {
      shift[key] = value;
    }

    try {
      // Validate the document before saving
      const validationError = shift.validateSync();
      if (validationError) {
        console.error('Validation error:', validationError);
        return res.status(400).json({ 
          message: 'Validation error updating shift',
          details: validationError.message,
          errors: validationError.errors
        });
      }

      const updatedShift = await shift.save();
      console.log('Successfully updated shift:', updatedShift);
      res.json(updatedShift);
    } catch (saveError) {
      console.error('Error saving shift:', saveError);
      return res.status(400).json({ 
        message: 'Error saving shift',
        details: saveError.message,
        errors: saveError.errors
      });
    }
  } catch (error) {
    console.error('Error updating shift:', error);
    res.status(400).json({ 
      message: error.message,
      details: error.stack
    });
  }
});

// Update a shift (PUT)
router.put('/:id', auth, checkPermission(['jobs.edit', 'jobs.authorize_reports']), async (req, res) => {
  try {
    console.log('Updating shift with data:', req.body);
    
    const shift = await Shift.findById(req.params.id);
    if (!shift) {
      return res.status(404).json({ message: 'Shift not found' });
    }

    // Log the current shift data
    console.log('Current shift data:', shift.toObject());

    // Update all fields from the request body
    Object.assign(shift, req.body);

    // Log the updated shift data before saving
    console.log('Updated shift data before save:', shift.toObject());

    try {
      // Validate before saving
      const validationError = shift.validateSync();
      if (validationError) {
        console.error('Validation error:', validationError);
        return res.status(400).json({ 
          message: 'Validation error updating shift',
          details: validationError.message,
          errors: validationError.errors
        });
      }

      const updatedShift = await shift.save();
      console.log('Successfully updated shift:', updatedShift);
      res.json(updatedShift);
    } catch (saveError) {
      console.error('Error saving shift:', saveError);
      return res.status(400).json({ 
        message: 'Error saving shift',
        details: saveError.message,
        errors: saveError.errors
      });
    }
  } catch (error) {
    console.error('Error updating shift:', error);
    res.status(400).json({ 
      message: error.message,
      details: error.stack
    });
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