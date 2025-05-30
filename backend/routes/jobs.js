const express = require('express');
const router = express.Router();
const AirMonitoringJob = require('../models/Job');
const auth = require('../middleware/auth');
const checkPermission = require('../middleware/checkPermission');

// Get all air monitoring jobs
router.get('/', auth, checkPermission(['jobs.view']), async (req, res) => {
  try {
    const jobs = await AirMonitoringJob.find()
      .populate('project')
      .populate('assignedTo', 'firstName lastName');
    res.json(jobs);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get a single air monitoring job
router.get('/:id', auth, checkPermission(['jobs.view']), async (req, res) => {
  try {
    const job = await AirMonitoringJob.findById(req.params.id)
      .populate('project')
      .populate('assignedTo', 'firstName lastName');
    if (!job) {
      return res.status(404).json({ message: 'Air monitoring job not found' });
    }
    res.json(job);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create a new air monitoring job
router.post('/', auth, checkPermission(['jobs.create']), async (req, res) => {
  try {
    console.log('Creating new air monitoring job with data:', req.body);

    // Validate required fields
    const requiredFields = ['project', 'asbestosRemovalist', 'startDate'];
    const missingFields = requiredFields.filter(field => !req.body[field]);
    
    if (missingFields.length > 0) {
      console.log('Missing required fields:', missingFields);
      return res.status(400).json({ 
        message: 'Missing required fields', 
        fields: missingFields 
      });
    }

    // Generate a unique jobID
    const jobID = `AMJ-${Date.now().toString().slice(-6)}-${Math.random().toString(36).substr(2, 4)}`;
    console.log('Generated jobID:', jobID);

    const job = new AirMonitoringJob({
      jobID: jobID,
      name: req.body.name || 'Air Monitoring Job',
      project: req.body.project,
      status: req.body.status || 'pending',
      startDate: req.body.startDate,
      endDate: req.body.endDate,
      asbestosRemovalist: req.body.asbestosRemovalist,
      description: req.body.description,
      location: req.body.location,
      assignedTo: req.body.assignedTo
    });

    console.log('Created job object:', job);

    const newJob = await job.save();
    console.log('Saved job:', newJob);
    
    // Populate the project and assignedTo fields before sending response
    const populatedJob = await AirMonitoringJob.findById(newJob._id)
      .populate('project')
      .populate('assignedTo', 'firstName lastName');

    res.status(201).json(populatedJob);
  } catch (error) {
    console.error('Error creating air monitoring job:', error);
    res.status(400).json({ 
      message: error.message,
      details: error.errors // Include validation errors if any
    });
  }
});

// Update an air monitoring job
router.put('/:id', auth, checkPermission(['jobs.edit']), async (req, res) => {
  try {
    const job = await AirMonitoringJob.findById(req.params.id);
    if (!job) {
      return res.status(404).json({ message: 'Air monitoring job not found' });
    }

    Object.assign(job, req.body);
    const updatedJob = await job.save();
    res.json(updatedJob);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Delete an air monitoring job
router.delete('/:id', auth, checkPermission(['jobs.delete']), async (req, res) => {
  try {
    const job = await AirMonitoringJob.findByIdAndDelete(req.params.id);
    if (!job) {
      return res.status(404).json({ message: 'Air monitoring job not found' });
    }
    res.json({ message: 'Air monitoring job deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
