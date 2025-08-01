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
    const { projectId, assessmentDate, status } = req.body;
    if (!projectId || !assessmentDate) {
      return res.status(400).json({ message: 'projectId and assessmentDate are required' });
    }
    
    const job = await AsbestosAssessment.findByIdAndUpdate(
      req.params.id,
      {
        projectId,
        assessmentDate,
        status: status || 'in-progress',
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

// PATCH /api/assessments/:id/ready-for-analysis - mark entire assessment as ready for analysis
router.patch('/:id/ready-for-analysis', async (req, res) => {
  try {
    const job = await AsbestosAssessment.findById(req.params.id);
    if (!job) return res.status(404).json({ message: 'Assessment job not found' });
    job.status = "ready-for-analysis";
    job.updatedAt = new Date();
    await job.save();
    
    res.json(job);
  } catch (err) {
    res.status(400).json({ message: 'Failed to mark assessment ready for analysis', error: err.message });
  }
});

// PATCH /api/assessments/:id/items/:itemId/ready-for-analysis - mark item as ready for analysis
router.patch('/:id/items/:itemId/ready-for-analysis', async (req, res) => {
  try {
    const { readyForAnalysis } = req.body;
    const job = await AsbestosAssessment.findById(req.params.id);
    if (!job) return res.status(404).json({ message: 'Assessment job not found' });
    const item = job.items.id(req.params.itemId);
    if (!item) return res.status(404).json({ message: 'Item not found' });
    
    item.readyForAnalysis = readyForAnalysis;
    item.updatedAt = new Date();
    await job.save();
    
    res.json(item);
  } catch (err) {
    res.status(400).json({ message: 'Failed to update item ready for analysis status', error: err.message });
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

// POST /api/assessments/:id/upload-analysis-certificate - upload analysis certificate
router.post('/:id/upload-analysis-certificate', async (req, res) => {
  try {
    const { fileData } = req.body;
    if (!fileData) {
      return res.status(400).json({ message: 'File data is required' });
    }

    const job = await AsbestosAssessment.findById(req.params.id);
    if (!job) return res.status(404).json({ message: 'Assessment job not found' });

    job.analysisCertificate = true;
    job.analysisCertificateFile = fileData;
    job.updatedAt = new Date();
    await job.save();

    res.json({ message: 'Analysis certificate uploaded successfully', job });
  } catch (err) {
    res.status(400).json({ message: 'Failed to upload analysis certificate', error: err.message });
  }
});

// POST /api/assessments/:id/upload-site-plan - upload site plan
router.post('/:id/upload-site-plan', async (req, res) => {
  try {
    const { fileData } = req.body;
    if (!fileData) {
      return res.status(400).json({ message: 'File data is required' });
    }

    const job = await AsbestosAssessment.findById(req.params.id);
    if (!job) return res.status(404).json({ message: 'Assessment job not found' });

    job.sitePlan = true;
    job.sitePlanFile = fileData;
    job.updatedAt = new Date();
    await job.save();

    res.json({ message: 'Site plan uploaded successfully', job });
  } catch (err) {
    res.status(400).json({ message: 'Failed to upload site plan', error: err.message });
  }
});

// DELETE /api/assessments/:id/analysis-certificate - delete analysis certificate
router.delete('/:id/analysis-certificate', async (req, res) => {
  try {
    const job = await AsbestosAssessment.findById(req.params.id);
    if (!job) return res.status(404).json({ message: 'Assessment job not found' });

    job.analysisCertificate = false;
    job.analysisCertificateFile = null;
    job.updatedAt = new Date();
    await job.save();

    res.json({ message: 'Analysis certificate deleted successfully', job });
  } catch (err) {
    res.status(400).json({ message: 'Failed to delete analysis certificate', error: err.message });
  }
});

// DELETE /api/assessments/:id/site-plan - delete site plan
router.delete('/:id/site-plan', async (req, res) => {
  try {
    const job = await AsbestosAssessment.findById(req.params.id);
    if (!job) return res.status(404).json({ message: 'Assessment job not found' });

    job.sitePlan = false;
    job.sitePlanFile = null;
    job.updatedAt = new Date();
    await job.save();

    res.json({ message: 'Site plan deleted successfully', job });
  } catch (err) {
    res.status(400).json({ message: 'Failed to delete site plan', error: err.message });
  }
});

// GET /api/assessments/:id/chain-of-custody - generate Chain of Custody PDF
router.get('/:id/chain-of-custody', async (req, res) => {
  try {
    console.log('=== CHAIN OF CUSTODY REQUEST START ===');
    console.log('Assessment ID:', req.params.id);
    
    // First, let's test if we can find the assessment
    const assessment = await AsbestosAssessment.findById(req.params.id);
    console.log('Assessment lookup result:', assessment ? 'Found' : 'Not found');
    
    if (!assessment) {
      console.log('Assessment not found');
      return res.status(404).json({ message: 'Assessment job not found' });
    }

    // Now populate the related data
    const populatedAssessment = await AsbestosAssessment.findById(req.params.id)
      .populate({
        path: "projectId",
        select: "projectID name client",
        populate: {
          path: "client",
          select: "name email contact"
        }
      })
      .populate('assessorId');
    
    console.log('Populated assessment data:', {
      id: populatedAssessment._id,
      projectId: populatedAssessment.projectId?._id,
      projectName: populatedAssessment.projectId?.name,
      clientName: populatedAssessment.projectId?.client?.name,
      assessorName: populatedAssessment.assessorId ? `${populatedAssessment.assessorId.firstName} ${populatedAssessment.assessorId.lastName}` : 'Unknown'
    });

    // Generate Chain of Custody PDF
    console.log('Generating PDF...');
    const { generateChainOfCustodyPDF } = require('../services/chainOfCustodyService');
    const pdfBuffer = await generateChainOfCustodyPDF(populatedAssessment);
    console.log('PDF generated successfully, size:', pdfBuffer.length);
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="ChainOfCustody_${populatedAssessment.projectId?.projectID || 'Unknown'}.pdf"`);
    res.send(pdfBuffer);
    
    console.log('=== CHAIN OF CUSTODY REQUEST END ===');
    
  } catch (err) {
    console.error('=== CHAIN OF CUSTODY ERROR ===');
    console.error('Error:', err.message);
    console.error('Stack:', err.stack);
    res.status(500).json({ message: 'Failed to generate Chain of Custody PDF', error: err.message });
  }
});

module.exports = router; 