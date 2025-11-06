const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const AirMonitoringJob = require('../models/Job');
const Project = require('../models/Project');
const auth = require('../middleware/auth');
const checkPermission = require('../middleware/checkPermission');
const dashboardStatsService = require('../services/dashboardStatsService');

// Get all air monitoring jobs
router.get('/', auth, checkPermission(['jobs.view']), async (req, res) => {
  try {
    const { status, excludeStatus } = req.query;
    
    const filter = {};
    
    // Support excluding statuses (e.g., excludeStatus=completed,cancelled)
    // This takes precedence if both status and excludeStatus are provided
    if (excludeStatus) {
      const excludedStatuses = excludeStatus.includes(',') 
        ? excludeStatus.split(',').map(s => s.trim())
        : [excludeStatus];
      filter.status = { $nin: excludedStatuses };
    } else if (status) {
      // Support single status or comma-separated statuses
      if (status.includes(',')) {
        filter.status = { $in: status.split(',').map(s => s.trim()) };
      } else {
        filter.status = status;
      }
    }

    // Fetch jobs with filter and populate
    const populatedJobs = await AirMonitoringJob.find(filter)
      .populate({
        path: 'projectId',
        select: 'name projectID client projectContact workOrder status category categories department notes',
        populate: {
          path: 'client'
        }
      })
      .populate('assignedTo', 'firstName lastName');
    
    res.json(populatedJobs);
  } catch (error) {
    console.error('Error in GET /air-monitoring-jobs:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Get a single air monitoring job
router.get('/:id', auth, checkPermission(['jobs.view']), async (req, res) => {
  try {
    const job = await AirMonitoringJob.findById(req.params.id)
      .populate({
        path: 'projectId',
        select: 'name projectID client projectContact workOrder status category categories department notes',
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
    console.log('projectId from request:', req.body.projectId);

    // Validate required fields
    const requiredFields = ['projectId', 'asbestosRemovalist', 'startDate'];
    const missingFields = requiredFields.filter(field => !req.body[field]);
    
    if (missingFields.length > 0) {
      console.log('Missing required fields:', missingFields);
      return res.status(400).json({ 
        message: 'Missing required fields', 
        fields: missingFields 
      });
    }

    // Verify that projectId exists in the database
    const project = await Project.findById(req.body.projectId);
    if (!project) {
      console.log('Project not found:', req.body.projectId);
      return res.status(400).json({ message: 'Project not found' });
    }
    console.log('Found project:', { _id: project._id, name: project.name, projectID: project.projectID });

    // Check for existing active jobs for this project
    const existingActiveJobs = await AirMonitoringJob.find({
      projectId: req.body.projectId,
      status: { $in: ['pending', 'in_progress'] }
    });

    // If there are existing active jobs, include them in the response but don't block creation
    if (existingActiveJobs.length > 0) {
      console.log(`Found ${existingActiveJobs.length} existing active jobs for project ${req.body.projectId}`);
      
      // If forceCreate is true, allow creation despite existing jobs
      if (req.body.forceCreate) {
        console.log('Force create requested - allowing job creation despite existing jobs');
      }
    }

    // Generate a unique jobID
    const jobID = `AMJ-${Date.now().toString().slice(-6)}-${Math.random().toString(36).substr(2, 4)}`;
    console.log('Generated jobID:', jobID);

    // Ensure projectId is a valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(req.body.projectId)) {
      console.error('Invalid projectId:', req.body.projectId);
      return res.status(400).json({ message: 'Invalid projectId format' });
    }

    // Create the job object
    const jobData = {
      jobID: jobID,
      name: req.body.name || 'Air Monitoring Job',
      projectId: new mongoose.Types.ObjectId(req.body.projectId),  // Convert to ObjectId
      status: req.body.status || 'pending',
      startDate: req.body.startDate,
      endDate: req.body.endDate,
      asbestosRemovalist: req.body.asbestosRemovalist,
      description: req.body.description,
      location: req.body.location,
      assignedTo: req.body.assignedTo
    };

    console.log('Creating job with data:', JSON.stringify(jobData, null, 2));
    const job = new AirMonitoringJob(jobData);

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

    // Include information about existing active jobs in the response
    const response = {
      job: populatedJob,
      existingActiveJobs: existingActiveJobs.length > 0 ? existingActiveJobs.map(job => ({
        _id: job._id,
        status: job.status,
        createdAt: job.createdAt,
        asbestosRemovalist: job.asbestosRemovalist,
        name: job.name
      })) : [],
      warning: existingActiveJobs.length > 0 ? 
        `This project already has ${existingActiveJobs.length} active air monitoring job(s)` : null
    };

    // Update dashboard stats after job creation
    try {
      await dashboardStatsService.updateStatsOnJobCreate(newJob.status);
    } catch (statsError) {
      console.error('Error updating dashboard stats on job creation:', statsError);
      // Don't fail the job creation if stats update fails
    }

    res.status(201).json(response);
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

    // Store old status for dashboard stats update
    const oldStatus = job.status;
    
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
    
    // Update dashboard stats after job status change
    try {
      await dashboardStatsService.updateStatsOnJobStatusChange(oldStatus, updatedJob.status);
    } catch (statsError) {
      console.error('Error updating dashboard stats on job status change:', statsError);
      // Don't fail the job update if stats update fails
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
    const job = await AirMonitoringJob.findById(req.params.id);
    if (!job) {
      return res.status(404).json({ message: 'Air monitoring job not found' });
    }
    
    // Store job status for dashboard stats update
    const jobStatus = job.status;
    
    // Delete the job
    await AirMonitoringJob.findByIdAndDelete(req.params.id);
    
    // Update dashboard stats after job deletion
    try {
      await dashboardStatsService.updateStatsOnJobDelete(jobStatus);
    } catch (statsError) {
      console.error('Error updating dashboard stats on job deletion:', statsError);
      // Don't fail the job deletion if stats update fails
    }
    
    res.json({ message: 'Air monitoring job deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
