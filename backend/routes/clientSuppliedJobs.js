const express = require('express');
const router = express.Router();
const ClientSuppliedJob = require('../models/ClientSuppliedJob');
const SampleItem = require('../models/SampleItem');

// GET /api/client-supplied-jobs - get all client supplied jobs
router.get('/', async (req, res) => {
  try {
    const jobs = await ClientSuppliedJob.find()
      .populate({
        path: 'projectId',
        select: 'name projectID d_Date createdAt',
        populate: {
          path: 'client',
          select: 'name contact1Name contact1Email'
        }
      })
      .sort({ createdAt: -1 });
    
    res.json(jobs);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch client supplied jobs', error: err.message });
  }
});

// GET /api/client-supplied-jobs/by-project/:projectId - get jobs by project
router.get('/by-project/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    
    console.log('Fetching client supplied jobs by project:', projectId);
    
    const jobs = await ClientSuppliedJob.find({ projectId })
      .populate({
        path: 'projectId',
        select: 'name projectID d_Date createdAt',
        populate: {
          path: 'client',
          select: 'name contact1Name contact1Email'
        }
      })
      .sort({ createdAt: -1 });
    
    console.log(`Found ${jobs.length} client supplied jobs for project ${projectId}`);
    
    res.json({
      data: jobs,
      count: jobs.length,
      projectId
    });
  } catch (err) {
    console.error('Error fetching client supplied jobs by project:', err);
    res.status(500).json({ 
      message: 'Failed to fetch client supplied jobs by project', 
      error: err.message 
    });
  }
});

// GET /api/client-supplied-jobs/:id - get single job
router.get('/:id', async (req, res) => {
  try {
    const job = await ClientSuppliedJob.findById(req.params.id)
      .populate({
        path: 'projectId',
        select: 'name projectID d_Date createdAt',
        populate: {
          path: 'client',
          select: 'name contact1Name contact1Email'
        }
      });
    
    if (!job) {
      return res.status(404).json({ message: 'Client supplied job not found' });
    }
    
    res.json(job);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch client supplied job', error: err.message });
  }
});

// POST /api/client-supplied-jobs - create new job
router.post('/', async (req, res) => {
  try {
    const { projectId } = req.body;
    
    if (!projectId) {
      return res.status(400).json({ 
        message: 'projectId is required' 
      });
    }
    
    // Generate job number
    const jobCount = await ClientSuppliedJob.countDocuments();
    const jobNumber = `CSJ-${String(jobCount + 1).padStart(4, '0')}`;
    
    const job = new ClientSuppliedJob({
      projectId,
      jobNumber
    });
    
    await job.save();
    
    const populatedJob = await ClientSuppliedJob.findById(job._id)
      .populate({
        path: 'projectId',
        select: 'name projectID d_Date createdAt',
        populate: {
          path: 'client',
          select: 'name contact1Name contact1Email'
        }
      });
    
    res.status(201).json(populatedJob);
  } catch (err) {
    res.status(400).json({ message: 'Failed to create client supplied job', error: err.message });
  }
});

// PUT /api/client-supplied-jobs/:id - update job
router.put('/:id', async (req, res) => {
  try {
    const job = await ClientSuppliedJob.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedAt: new Date() },
      { new: true }
    )
    .populate({
      path: 'projectId',
      select: 'name projectID d_Date createdAt',
      populate: {
        path: 'client',
        select: 'name contact1Name contact1Email'
      }
    });
    
    if (!job) {
      return res.status(404).json({ message: 'Client supplied job not found' });
    }
    
    res.json(job);
  } catch (err) {
    res.status(400).json({ message: 'Failed to update client supplied job', error: err.message });
  }
});

// DELETE /api/client-supplied-jobs/:id - delete job
router.delete('/:id', async (req, res) => {
  try {
    const job = await ClientSuppliedJob.findByIdAndDelete(req.params.id);
    
    if (!job) {
      return res.status(404).json({ message: 'Client supplied job not found' });
    }
    
    // Also delete associated sample items
    await SampleItem.deleteMany({ projectId: job.projectId });
    
    res.json({ message: 'Client supplied job deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete client supplied job', error: err.message });
  }
});

// GET /api/client-supplied-jobs/:id/samples - get samples for a job
router.get('/:id/samples', async (req, res) => {
  try {
    const job = await ClientSuppliedJob.findById(req.params.id);
    
    if (!job) {
      return res.status(404).json({ message: 'Client supplied job not found' });
    }
    
    const samples = await SampleItem.find({ projectId: job.projectId })
      .sort({ labReference: 1 });
    
    res.json(samples);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch samples', error: err.message });
  }
});

module.exports = router; 