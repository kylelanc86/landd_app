const express = require('express');
const router = express.Router();
const AirMonitoringJob = require('../models/Job');
const Project = require('../models/Project');
const auth = require('../middleware/auth');
const checkPermission = require('../middleware/checkPermission');

// Get all air monitoring jobs
router.get('/', auth, checkPermission(['jobs.view']), async (req, res) => {
  try {
    const jobs = await AirMonitoringJob.find()
      .populate({
        path: 'project',
        populate: {
          path: 'client'
        }
      })
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
      .populate({
        path: 'project',
        populate: {
          path: 'client'
        }
      })
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

    // Check for existing active jobs for this project
    const existingActiveJob = await AirMonitoringJob.findOne({
      project: req.body.project,
      status: { $in: ['pending', 'in_progress'] }
    });

    if (existingActiveJob) {
      return res.status(400).json({
        message: 'This project already has an active air monitoring job',
        existingJobId: existingActiveJob._id
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

    // Update project status to "In progress" if it's currently "Assigned"
    try {
      const project = await Project.findById(req.body.projectId);
      if (project && project.status === 'Assigned') {
        project.status = 'In progress';
        await project.save();
        console.log(`Updated project ${project._id} status to In progress`);
      }
    } catch (projectError) {
      console.error('Error updating project status:', projectError);
      // Don't fail the job creation if project update fails
    }
    
    // Populate the project and assignedTo fields before sending response
    const populatedJob = await AirMonitoringJob.findById(newJob._id)
      .populate({
        path: 'projectId',
        populate: {
          path: 'client'
        }
      })
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
router.patch('/:id', auth, checkPermission(['jobs.edit']), async (req, res) => {
  try {
    const job = await AirMonitoringJob.findById(req.params.id);
    if (!job) {
      return res.status(404).json({ message: 'Air monitoring job not found' });
    }

    // Only update the fields that are provided in the request
    Object.keys(req.body).forEach(key => {
      job[key] = req.body[key];
    });

    const updatedJob = await job.save();
    
    // If job status is being updated to 'completed', update the project status
    if (req.body.status === 'completed' && job.projectId) {
      try {
        await Project.findByIdAndUpdate(job.projectId, {
          status: 'Ready for invoicing'
        });
        console.log(`Updated project ${job.projectId} status to Ready for invoicing`);
      } catch (projectError) {
        console.error('Error updating project status:', projectError);
        // Don't fail the job update if project update fails
      }
    }
    
    // Populate the project and assignedTo fields before sending response
    const populatedJob = await AirMonitoringJob.findById(updatedJob._id)
      .populate({
        path: 'projectId',
        populate: {
          path: 'client'
        }
      })
      .populate('assignedTo', 'firstName lastName');

    res.json(populatedJob);
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
