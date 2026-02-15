const express = require('express');
const router = express.Router();
const Sample = require('../models/Sample');
const AsbestosRemovalJob = require('../models/AsbestosRemovalJob');
const Project = require('../models/Project');
const auth = require('../middleware/auth');
const checkPermission = require('../middleware/checkPermission');

// Get all samples
router.get('/', auth, checkPermission(['jobs.view']), async (req, res) => {
  try {
    const samples = await Sample.find()
      .populate('job')
      .populate('collectedBy')
      .populate('sampler')
      .populate('analysedBy')
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
      .populate('sampler')
      .populate('analysedBy')
      .populate({
        path: 'job',
        populate: {
          path: 'projectId'
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
    // First, find the Project by projectID to get its _id
    const project = await Project.findOne({ projectID: req.params.projectId });
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    // Query samples by fullSampleID pattern to include ALL samples for this project,
    // including orphaned samples (where job/shift may have been deleted)
    // This ensures we don't create duplicate sample numbers
    const fullSampleIDPattern = new RegExp(`^${req.params.projectId}-AM\\d+$`);
    const allSamples = await Sample.find({ fullSampleID: fullSampleIDPattern })
      .populate('collectedBy')
      .populate('sampler')
      .populate('analysedBy')
      .populate({
        path: 'job',
        populate: {
          path: 'projectId'
        }
      })
      .sort({ createdAt: -1 });

    res.json(allSamples);
  } catch (err) {
    console.error('Error getting samples by project:', err);
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
          path: 'projectId'
        }
      })
      .populate('collectedBy')
      .populate('sampler')
      .populate('analysedBy');
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
      jobModel: req.body.jobModel,
      sampleNumber: req.body.sampleNumber,
      fullSampleID: req.body.fullSampleID,
      type: req.body.type,
      location: req.body.location,
      pumpNo: req.body.pumpNo,
      flowmeter: req.body.flowmeter,
      cowlNo: req.body.cowlNo,
      sampler: req.body.sampler,
      filterSize: req.body.filterSize,
      startTime: req.body.startTime,
      endTime: req.body.endTime,
      nextDay: req.body.nextDay === true || req.body.nextDay === 'on' || req.body.nextDay === 'true',
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

            // Handle uncountableDueToDust - ensure it's a boolean
            if (req.body.analysis.uncountableDueToDust !== undefined) {
              req.body.analysis.uncountableDueToDust = req.body.analysis.uncountableDueToDust === true || req.body.analysis.uncountableDueToDust === 'true';
            }

            // Convert fibresCounted and fieldsCounted to numbers, but preserve '-' if uncountableDueToDust is true
            // fibresCounted can be decimal (e.g. 2.5 for half fibres); fieldsCounted is integer
            if (req.body.analysis.uncountableDueToDust === true) {
              // When uncountableDueToDust is true, keep '-' as a string (will be stored in DB)
              req.body.analysis.fibresCounted = req.body.analysis.fibresCounted === '-' ? '-' : (parseFloat(req.body.analysis.fibresCounted) || 0);
              req.body.analysis.fieldsCounted = req.body.analysis.fieldsCounted === '-' ? '-' : (parseInt(req.body.analysis.fieldsCounted) || 0);
            } else {
              // Convert to numbers for normal samples (fibresCounted allows decimals for half-fibre counts)
              req.body.analysis.fibresCounted = parseFloat(req.body.analysis.fibresCounted) || 0;
              req.body.analysis.fieldsCounted = parseInt(req.body.analysis.fieldsCounted) || 0;
            }

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
        // Convert nextDay from string "on" to boolean if needed
        if (key === 'nextDay') {
          sample[key] = req.body[key] === true || req.body[key] === 'on' || req.body[key] === 'true';
        } else {
          sample[key] = req.body[key];
        }
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

// Export the helper function for use in other routes
module.exports = router;
