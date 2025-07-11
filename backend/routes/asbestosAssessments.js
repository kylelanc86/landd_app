const express = require('express');
const router = express.Router();
const AsbestosAssessment = require('../models/assessmentTemplates/asbestos/AsbestosAssessment');

// GET /api/assessments - list all assessment jobs (populate project and assessor)
router.get('/', async (req, res) => {
  try {
    const jobs = await AsbestosAssessment.find()
      .sort({ createdAt: -1 })
      .populate({
        path: "projectId",
        select: "projectID name client",
        populate: {
          path: "client",
          select: "name"
        }
      })
      .populate('assessorId');
    res.json(jobs);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch jobs', error: err.message });
  }
});

// POST /api/assessments - create new assessment job
router.post('/', async (req, res) => {
  try {
    // Assume req.user is set by auth middleware
    if (!req.user || !req.user._id) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    const { projectId, assessmentDate } = req.body;
    if (!projectId || !assessmentDate) {
      return res.status(400).json({ message: 'projectId and assessmentDate are required' });
    }
    const job = new AsbestosAssessment({
      projectId,
      assessorId: req.user._id,
      assessmentDate,
    });
    await job.save();
    const populatedJob = await AsbestosAssessment.findById(job._id)
      .populate({
        path: "projectId",
        select: "projectID name client",
        populate: {
          path: "client",
          select: "name"
        }
      })
      .populate('assessorId');
    res.status(201).json(populatedJob);
  } catch (err) {
    res.status(400).json({ message: 'Failed to create job', error: err.message });
  }
});

// GET /api/assessments/:id - get single assessment job (populate project and assessor)
router.get('/:id', async (req, res) => {
  try {
    const job = await AsbestosAssessment.findById(req.params.id)
      .populate({
        path: "projectId",
        select: "projectID name client",
        populate: {
          path: "client",
          select: "name"
        }
      })
      .populate('assessorId');
    if (!job) return res.status(404).json({ message: 'Assessment job not found' });
    res.json(job);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch assessment job', error: err.message });
  }
});

// PUT /api/assessments/:id - update assessment job
router.put('/:id', async (req, res) => {
  try {
    const { projectId, assessmentDate } = req.body;
    if (!projectId || !assessmentDate) {
      return res.status(400).json({ message: 'projectId and assessmentDate are required' });
    }
    
    const job = await AsbestosAssessment.findByIdAndUpdate(
      req.params.id,
      {
        projectId,
        assessmentDate,
        updatedAt: new Date()
      },
      { new: true }
    ).populate({
      path: "projectId",
      select: "projectID name client",
      populate: {
        path: "client",
        select: "name"
      }
    }).populate('assessorId');
    
    if (!job) return res.status(404).json({ message: 'Assessment job not found' });
    res.json(job);
  } catch (err) {
    res.status(400).json({ message: 'Failed to update assessment job', error: err.message });
  }
});

// GET /api/assessments/:id/items - list items for a job (populate project and assessor)
router.get('/:id/items', async (req, res) => {
  try {
    const job = await AsbestosAssessment.findById(req.params.id)
      .populate({
        path: "projectId",
        select: "projectID name client",
        populate: {
          path: "client",
          select: "name"
        }
      })
      .populate('assessorId');
    if (!job) return res.status(404).json({ message: 'Assessment job not found' });
    res.json(job.items || []);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch items', error: err.message });
  }
});

// POST /api/assessments/:id/items - add item to a job
router.post('/:id/items', async (req, res) => {
  try {
    const job = await AsbestosAssessment.findById(req.params.id);
    if (!job) return res.status(404).json({ message: 'Assessment job not found' });
    job.items.push(req.body);
    await job.save();
    res.status(201).json(job.items[job.items.length - 1]);
  } catch (err) {
    res.status(400).json({ message: 'Failed to add item', error: err.message });
  }
});

// PUT /api/assessments/:id/items/:itemId - update item
router.put('/:id/items/:itemId', async (req, res) => {
  try {
    const job = await AsbestosAssessment.findById(req.params.id);
    if (!job) return res.status(404).json({ message: 'Assessment job not found' });
    const item = job.items.id(req.params.itemId);
    if (!item) return res.status(404).json({ message: 'Item not found' });
    Object.assign(item, req.body);
    item.updatedAt = new Date();
    await job.save();
    res.json(item);
  } catch (err) {
    res.status(400).json({ message: 'Failed to update item', error: err.message });
  }
});

// DELETE /api/assessments/:id/items/:itemId - delete item
router.delete('/:id/items/:itemId', async (req, res) => {
  try {
    const job = await AsbestosAssessment.findById(req.params.id);
    if (!job) return res.status(404).json({ message: 'Assessment job not found' });
    const item = job.items.id(req.params.itemId);
    if (!item) return res.status(404).json({ message: 'Item not found' });
    item.remove();
    await job.save();
    res.json({ message: 'Item deleted' });
  } catch (err) {
    res.status(400).json({ message: 'Failed to delete item', error: err.message });
  }
});

// DELETE /api/assessments/:id - delete assessment job
router.delete('/:id', async (req, res) => {
  try {
    const job = await AsbestosAssessment.findByIdAndDelete(req.params.id);
    if (!job) return res.status(404).json({ message: 'Assessment job not found' });
    res.json({ message: 'Assessment job deleted' });
  } catch (err) {
    res.status(400).json({ message: 'Failed to delete assessment job', error: err.message });
  }
});

module.exports = router; 