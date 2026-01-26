const express = require('express');
const router = express.Router();
const IAQSample = require('../models/IAQSample');
const IAQRecord = require('../models/IAQRecord');
const auth = require('../middleware/auth');
const checkPermission = require('../middleware/checkPermission');

// Get all IAQ samples
router.get('/', auth, checkPermission(['jobs.view']), async (req, res) => {
  try {
    const samples = await IAQSample.find()
      .populate('iaqRecord')
      .populate('collectedBy')
      .populate('sampler')
      .populate('analysedBy')
      .sort({ createdAt: -1 });
    res.json(samples);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get samples by IAQ record
router.get('/iaq-record/:iaqRecordId', auth, checkPermission(['jobs.view']), async (req, res) => {
  try {
    const samples = await IAQSample.find({ iaqRecord: req.params.iaqRecordId })
      .populate('collectedBy')
      .populate('sampler')
      .populate('analysedBy')
      .sort({ createdAt: -1 });
    res.json(samples);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get single IAQ sample
router.get('/:id', auth, checkPermission(['jobs.view']), async (req, res) => {
  try {
    const sample = await IAQSample.findById(req.params.id)
      .populate('iaqRecord')
      .populate('collectedBy')
      .populate('sampler')
      .populate('analysedBy');
    if (!sample) {
      return res.status(404).json({ message: 'IAQ sample not found' });
    }
    res.json(sample);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Create IAQ sample
router.post('/', auth, checkPermission(['jobs.create']), async (req, res) => {
  try {
    console.log('Creating IAQ sample with data:', req.body);
    
    // Verify IAQ record exists
    const iaqRecord = await IAQRecord.findById(req.body.iaqRecord);
    if (!iaqRecord) {
      return res.status(404).json({ message: 'IAQ record not found' });
    }

    // Ensure cowlNo has "C" prefix
    const cowlNoWithPrefix =
      req.body.cowlNo && !req.body.cowlNo.startsWith("C")
        ? `C${req.body.cowlNo}`
        : req.body.cowlNo || "";

    const sample = new IAQSample({
      iaqRecord: req.body.iaqRecord,
      sampleNumber: req.body.sampleNumber,
      fullSampleID: req.body.fullSampleID || req.body.sampleNumber,
      location: req.body.location,
      pumpNo: req.body.pumpNo,
      flowmeter: req.body.flowmeter,
      cowlNo: cowlNoWithPrefix,
      sampler: req.body.sampler,
      filterSize: req.body.filterSize,
      startTime: req.body.startTime,
      endTime: req.body.endTime,
      initialFlowrate: req.body.initialFlowrate ? parseFloat(req.body.initialFlowrate) : null,
      finalFlowrate: req.body.finalFlowrate ? parseFloat(req.body.finalFlowrate) : null,
      averageFlowrate: req.body.averageFlowrate ? parseFloat(req.body.averageFlowrate) : null,
      status: req.body.status || 'pending',
      notes: req.body.notes,
      collectedBy: req.body.collectedBy || req.body.sampler,
      isFieldBlank: req.body.isFieldBlank || false
    });

    const newSample = await sample.save();

    // Add sample to IAQ record's samples array
    iaqRecord.samples.push(newSample._id);
    await iaqRecord.save();

    console.log('IAQ sample created successfully:', newSample);
    res.status(201).json(newSample);
  } catch (err) {
    console.error('Error creating IAQ sample:', err);
    res.status(400).json({ message: err.message });
  }
});

// Update IAQ sample
router.patch('/:id', auth, checkPermission(['jobs.edit']), async (req, res) => {
  try {
    console.log('Updating IAQ sample with data:', JSON.stringify(req.body, null, 2));
    
    const sample = await IAQSample.findById(req.params.id);
    if (!sample) {
      console.log('IAQ sample not found:', req.params.id);
      return res.status(404).json({ message: 'IAQ sample not found' });
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
        if (req.body.analysis.uncountableDueToDust === true) {
          req.body.analysis.fibresCounted = req.body.analysis.fibresCounted === '-' ? '-' : (parseInt(req.body.analysis.fibresCounted) || 0);
          req.body.analysis.fieldsCounted = req.body.analysis.fieldsCounted === '-' ? '-' : (parseInt(req.body.analysis.fieldsCounted) || 0);
        } else {
          req.body.analysis.fibresCounted = parseInt(req.body.analysis.fibresCounted) || 0;
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
        if (key === 'cowlNo' && req.body[key] && !req.body[key].startsWith("C")) {
          sample[key] = `C${req.body[key]}`;
        } else if (key === 'initialFlowrate' || key === 'finalFlowrate' || key === 'averageFlowrate') {
          sample[key] = req.body[key] ? parseFloat(req.body[key]) : null;
        } else {
          sample[key] = req.body[key];
        }
      }
    });

    try {
      const updatedSample = await sample.save();
      console.log('IAQ sample updated successfully:', JSON.stringify(updatedSample, null, 2));
      res.json(updatedSample);
    } catch (err) {
      console.error('Error saving IAQ sample:', err);
      return res.status(400).json({ 
        message: 'Error saving IAQ sample',
        details: err.message
      });
    }
  } catch (err) {
    console.error('Error updating IAQ sample:', err);
    res.status(400).json({ 
      message: err.message,
      details: err.stack
    });
  }
});

// Delete IAQ sample
router.delete('/:id', auth, checkPermission(['jobs.delete']), async (req, res) => {
  try {
    const sample = await IAQSample.findById(req.params.id);
    if (!sample) {
      return res.status(404).json({ message: 'IAQ sample not found' });
    }

    // Remove sample from IAQ record's samples array
    const iaqRecord = await IAQRecord.findById(sample.iaqRecord);
    if (iaqRecord) {
      iaqRecord.samples = iaqRecord.samples.filter(
        (id) => id.toString() !== sample._id.toString()
      );
      await iaqRecord.save();
    }

    await sample.deleteOne();
    res.json({ message: 'IAQ sample deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
