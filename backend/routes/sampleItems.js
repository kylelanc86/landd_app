const express = require('express');
const router = express.Router();
const SampleItem = require('../models/SampleItem');

// GET /api/sample-items - get all sample items (with optional project and job filter)
router.get('/', async (req, res) => {
  try {
    const { projectId, clientSuppliedJobId } = req.query;
    const filter = {};
    if (projectId) {
      filter.projectId = projectId;
    }
    // Filter by clientSuppliedJobId if provided (for client supplied jobs)
    // Only show samples with this specific jobId (exclude null/undefined)
    if (clientSuppliedJobId) {
      filter.clientSuppliedJobId = { $exists: true, $eq: clientSuppliedJobId };
    }
    
    const sampleItems = await SampleItem.find(filter)
      .populate('projectId', 'name')
      .sort({ labReference: 1 });
    
    res.json(sampleItems);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch sample items', error: err.message });
  }
});

// GET /api/sample-items/:id - get single sample item
router.get('/:id', async (req, res) => {
  try {
    const sampleItem = await SampleItem.findById(req.params.id)
      .populate('projectId', 'name');
    if (!sampleItem) {
      return res.status(404).json({ message: 'Sample item not found' });
    }
    
    // Also fetch the job information for this project
    const ClientSuppliedJob = require('../models/ClientSuppliedJob');
    const job = await ClientSuppliedJob.findOne({ projectId: sampleItem.projectId._id });
    
    // Add job information to the response
    const response = {
      ...sampleItem.toObject(),
      jobId: job ? job._id : null
    };
    
    res.json(response);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch sample item', error: err.message });
  }
});

// POST /api/sample-items - create new sample item
router.post('/', async (req, res) => {
  try {
    const { projectId, labReference, clientReference } = req.body;
    
    if (!projectId || !labReference || !clientReference) {
      return res.status(400).json({ 
        message: 'projectId, labReference, and clientReference are required' 
      });
    }
    
    const sampleItem = new SampleItem({
      projectId,
      labReference,
      clientReference,
      clientSuppliedJobId: req.body.clientSuppliedJobId || undefined
    });
    
    await sampleItem.save();
    
    const populatedSampleItem = await SampleItem.findById(sampleItem._id)
      .populate('projectId', 'name');
    
    res.status(201).json(populatedSampleItem);
  } catch (err) {
    res.status(400).json({ message: 'Failed to create sample item', error: err.message });
  }
});

// POST /api/sample-items/bulk - create multiple sample items
router.post('/bulk', async (req, res) => {
  try {
    const { projectId, samples } = req.body;
    
    if (!projectId || !samples || !Array.isArray(samples)) {
      return res.status(400).json({ 
        message: 'projectId and samples array are required' 
      });
    }
    
    // Filter out empty rows and validate
    const validSamples = samples.filter(sample => 
      sample.labReference && sample.labReference.trim() && 
      sample.clientReference && sample.clientReference.trim()
    );
    
    if (validSamples.length === 0) {
      return res.status(400).json({ 
        message: 'At least one sample with both labReference and clientReference is required' 
      });
    }
    
    const sampleItems = validSamples.map(sample => ({
      projectId,
      labReference: sample.labReference.trim(),
      clientReference: sample.clientReference.trim(),
      analysedBy: sample.analysedBy || undefined,
      analysedAt: sample.analysedAt || undefined,
      clientSuppliedJobId: req.body.clientSuppliedJobId || undefined
    }));
    
    const createdSampleItems = await SampleItem.insertMany(sampleItems);
    
    const populatedSampleItems = await SampleItem.find({
      _id: { $in: createdSampleItems.map(item => item._id) }
    })
    .populate('projectId', 'name');
    
    res.status(201).json(populatedSampleItems);
  } catch (err) {
    res.status(400).json({ message: 'Failed to create sample items', error: err.message });
  }
});

// PUT /api/sample-items/:id - update sample item
router.put('/:id', async (req, res) => {
  try {
    const sampleItem = await SampleItem.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedAt: new Date() },
      { new: true }
    )
    .populate('projectId', 'name');
    
    if (!sampleItem) {
      return res.status(404).json({ message: 'Sample item not found' });
    }
    
    res.json(sampleItem);
  } catch (err) {
    res.status(400).json({ message: 'Failed to update sample item', error: err.message });
  }
});

// DELETE /api/sample-items/:id - delete sample item
router.delete('/:id', async (req, res) => {
  try {
    const sampleItem = await SampleItem.findByIdAndDelete(req.params.id);
    
    if (!sampleItem) {
      return res.status(404).json({ message: 'Sample item not found' });
    }
    
    res.json({ message: 'Sample item deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete sample item', error: err.message });
  }
});

module.exports = router; 