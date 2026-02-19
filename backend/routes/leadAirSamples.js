const express = require('express');
const router = express.Router();
const LeadAirSample = require('../models/LeadAirSample');
const Project = require('../models/Project');
const auth = require('../middleware/auth');
const checkPermission = require('../middleware/checkPermission');

// Get lead air samples by shift
router.get('/shift/:shiftId', auth, checkPermission(['jobs.view']), async (req, res) => {
  try {
    const samples = await LeadAirSample.find({ shift: req.params.shiftId })
      .populate('collectedBy')
      .populate('sampler')
      .populate({
        path: 'job',
        populate: { path: 'projectId' }
      })
      .sort({ fullSampleID: 1 });
    res.json(samples);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get lead air samples by project (for next sample number calculation)
router.get('/project/:projectId', auth, checkPermission(['jobs.view']), async (req, res) => {
  try {
    const project = await Project.findOne({ projectID: req.params.projectId });
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }
    const escaped = req.params.projectId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const fullSampleIDPattern = new RegExp(`^${escaped}-LP\\d+$`);
    const samples = await LeadAirSample.find({ fullSampleID: fullSampleIDPattern })
      .populate('collectedBy')
      .populate('sampler')
      .populate({
        path: 'job',
        populate: { path: 'projectId' }
      })
      .sort({ fullSampleID: 1 });
    res.json(samples);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get single lead air sample
router.get('/:id', auth, checkPermission(['jobs.view']), async (req, res) => {
  try {
    const sample = await LeadAirSample.findById(req.params.id)
      .populate({
        path: 'job',
        populate: { path: 'projectId' }
      })
      .populate('collectedBy')
      .populate('sampler');
    if (!sample) {
      return res.status(404).json({ message: 'Lead air sample not found' });
    }
    res.json(sample);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Create lead air sample
router.post('/', auth, checkPermission(['jobs.create']), async (req, res) => {
  try {
    const doc = {
      shift: req.body.shift,
      job: req.body.job,
      sampleNumber: req.body.sampleNumber,
      fullSampleID: req.body.fullSampleID,
      type: req.body.type,
      location: req.body.location,
      pumpNo: req.body.pumpNo,
      flowmeter: req.body.flowmeter,
      cowlNo: req.body.cowlNo,
      sampler: req.body.sampler,
      startTime: req.body.startTime,
      endTime: req.body.endTime,
      nextDay: req.body.nextDay === true || req.body.nextDay === 'on' || req.body.nextDay === 'true',
      initialFlowrate: req.body.initialFlowrate,
      finalFlowrate: req.body.finalFlowrate,
      averageFlowrate: req.body.averageFlowrate,
      status: req.body.status || 'pending',
      notes: req.body.notes,
      collectedBy: req.body.collectedBy,
      leadContent: req.body.leadContent,
      leadConcentration: req.body.leadConcentration
    };
    const sample = new LeadAirSample(doc);
    const newSample = await sample.save();
    res.status(201).json(newSample);
  } catch (err) {
    console.error('Error creating lead air sample:', err);
    res.status(400).json({ message: err.message });
  }
});

// Update lead air sample (including leadContent)
router.patch('/:id', auth, checkPermission(['jobs.edit']), async (req, res) => {
  try {
    const sample = await LeadAirSample.findById(req.params.id);
    if (!sample) {
      return res.status(404).json({ message: 'Lead air sample not found' });
    }
    const allowed = [
      'sampleNumber', 'fullSampleID', 'type', 'location', 'pumpNo', 'flowmeter',
      'cowlNo', 'sampler', 'startTime', 'endTime', 'nextDay',
      'initialFlowrate', 'finalFlowrate', 'averageFlowrate', 'status', 'notes',
      'collectedBy', 'leadContent', 'leadConcentration'
    ];
    allowed.forEach(key => {
      if (req.body[key] !== undefined) {
        if (key === 'nextDay') {
          sample[key] = req.body[key] === true || req.body[key] === 'on' || req.body[key] === 'true';
        } else {
          sample[key] = req.body[key];
        }
      }
    });
    const updated = await sample.save();
    res.json(updated);
  } catch (err) {
    console.error('Error updating lead air sample:', err);
    res.status(400).json({ message: err.message });
  }
});

// Delete lead air sample
router.delete('/:id', auth, checkPermission(['jobs.delete']), async (req, res) => {
  try {
    const sample = await LeadAirSample.findByIdAndDelete(req.params.id);
    if (!sample) {
      return res.status(404).json({ message: 'Lead air sample not found' });
    }
    res.json({ message: 'Lead air sample deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
