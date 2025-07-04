const express = require('express');
const router = express.Router();
const Sample = require('../models/Sample');
const auth = require('../middleware/auth');
const checkPermission = require('../middleware/checkPermission');

// Get all samples
router.get('/', auth, checkPermission(['jobs.view']), async (req, res) => {
  try {
    const samples = await Sample.find()
      .populate('job')
      .populate('collectedBy')
      .populate('analyzedBy')
      .sort({ createdAt: -1 });
    res.json(samples);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get samples by shift
router.get('/shift/:shiftId', auth, checkPermission(['jobs.view']), async (req, res) => {
  try {
    const samples = await Sample.find({ shift: req.params.shiftId })
      .populate('collectedBy')
      .populate('analyzedBy')
      .populate({
        path: 'job',
        populate: {
          path: 'project'
        }
      })
      .sort({ createdAt: -1 });
    res.json(samples);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get samples by project
router.get('/project/:projectId', auth, checkPermission(['jobs.view']), async (req, res) => {
  try {
    const samples = await Sample.find()
      .populate({
        path: 'job',
        populate: {
          path: 'project',
          match: { projectID: req.params.projectId }
        }
      })
      .populate('collectedBy')
      .populate('analyzedBy')
      .sort({ createdAt: -1 });

    // Filter samples where the populated project matches
    const projectSamples = samples.filter(sample => sample.job?.project);
    res.json(projectSamples);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get single sample
router.get('/:id', auth, checkPermission(['jobs.view']), async (req, res) => {
  try {
    const sample = await Sample.findById(req.params.id)
      .populate({
        path: 'job',
        populate: {
          path: 'project'
        }
      })
      .populate('collectedBy')
      .populate('analyzedBy');
    if (!sample) {
      return res.status(404).json({ message: 'Sample not found' });
    }
    res.json(sample);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Create sample
router.post('/', auth, checkPermission(['jobs.create']), async (req, res) => {
  try {
    console.log('Creating sample with data:', req.body);
    
    const sample = new Sample({
      shift: req.body.shift,
      job: req.body.job,
      sampleNumber: req.body.sampleNumber,
      fullSampleID: req.body.fullSampleID,
      type: req.body.type,
      location: req.body.location,
      pumpNo: req.body.pumpNo,
      flowmeter: req.body.flowmeter,
      cowlNo: req.body.cowlNo,
      filterSize: req.body.filterSize,
      startTime: req.body.startTime,
      endTime: req.body.endTime,
      initialFlowrate: req.body.initialFlowrate,
      finalFlowrate: req.body.finalFlowrate,
      averageFlowrate: req.body.averageFlowrate,
      status: req.body.status || 'pending',
      notes: req.body.notes,
      collectedBy: req.body.collectedBy
    });

    const newSample = await sample.save();
    console.log('Sample created successfully:', newSample);
    res.status(201).json(newSample);
  } catch (err) {
    console.error('Error creating sample:', err);
    res.status(400).json({ message: err.message });
  }
});

// Update sample
router.patch('/:id', auth, checkPermission(['jobs.edit']), async (req, res) => {
  try {
    console.log('Updating sample with data:', JSON.stringify(req.body, null, 2));
    
    const sample = await Sample.findById(req.params.id);
    if (!sample) {
      console.log('Sample not found:', req.params.id);
      return res.status(404).json({ message: 'Sample not found' });
    }

    // Handle nested analysis data
    if (req.body.analysis) {
      try {
        // Keep reportedConcentration as a string
        if (req.body.analysis.reportedConcentration === 'N/A') {
          req.body.analysis.reportedConcentration = null;
        }

        // Convert fibresCounted and fieldsCounted to numbers
        req.body.analysis.fibresCounted = parseInt(req.body.analysis.fibresCounted) || 0;
        req.body.analysis.fieldsCounted = parseInt(req.body.analysis.fieldsCounted) || 0;

        console.log('Processed analysis data:', JSON.stringify(req.body.analysis, null, 2));
        sample.analysis = req.body.analysis;
      } catch (err) {
        console.error('Error processing analysis data:', err);
        return res.status(400).json({ 
          message: 'Error processing analysis data',
          details: err.message
        });
      }
    }

    // Update other fields
    Object.keys(req.body).forEach(key => {
      if (key !== 'analysis') {
        sample[key] = req.body[key];
      }
    });

    try {
      const updatedSample = await sample.save();
      console.log('Sample updated successfully:', JSON.stringify(updatedSample, null, 2));
      res.json(updatedSample);
    } catch (err) {
      console.error('Error saving sample:', err);
      return res.status(400).json({ 
        message: 'Error saving sample',
        details: err.message
      });
    }
  } catch (err) {
    console.error('Error updating sample:', err);
    res.status(400).json({ 
      message: err.message,
      details: err.stack
    });
  }
});

// Delete sample
router.delete('/:id', auth, checkPermission(['jobs.delete']), async (req, res) => {
  try {
    const sample = await Sample.findById(req.params.id);
    if (!sample) {
      return res.status(404).json({ message: 'Sample not found' });
    }

    await sample.deleteOne();
    res.json({ message: 'Sample deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
