const express = require('express');
const router = express.Router();
const AsbestosAssessment = require('../models/assessmentTemplates/asbestos/AsbestosAssessment');

// GET /api/assessments - list all assessment jobs (populate project and assessor); excludes archived
router.get('/', async (req, res) => {
  try {
    const jobs = await AsbestosAssessment.find({ archived: { $ne: true } })
      .sort({ createdAt: -1 })
      .populate({
        path: "projectId",
        select: "projectID name client",
        populate: {
          path: "client",
          select: "name contact1Name contact1Email address"
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
    const { projectId, assessmentDate, LAA, state } = req.body;
    if (!projectId || !assessmentDate) {
      return res.status(400).json({ message: 'projectId and assessmentDate are required' });
    }
    const job = new AsbestosAssessment({
      projectId,
      assessorId: req.user._id,
      assessmentDate,
      LAA: LAA || null,
      state: state && ['ACT', 'NSW', 'Commonwealth'].includes(state) ? state : null,
    });
    await job.save();
    const populatedJob = await AsbestosAssessment.findById(job._id)
      .populate({
        path: "projectId",
        select: "projectID name client",
        populate: {
          path: "client",
          select: "name contact1Name contact1Email address"
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
          select: "name contact1Name contact1Email address"
        }
      })
      .populate('assessorId')
      .populate('analyst', 'firstName lastName email');
    if (!job) return res.status(404).json({ message: 'Assessment job not found' });
    
    // Manually populate analysedBy for items (Mongoose doesn't support nested array population directly)
    if (job.items && job.items.length > 0) {
      const User = require('../models/User');
      const userIds = [];
      const itemMap = new Map();
      
      // Collect all user IDs that need to be populated
      job.items.forEach((item, index) => {
        if (item.analysedBy) {
          let userId;
          // Handle different types: ObjectId, string, or already populated object
          if (typeof item.analysedBy === 'object' && item.analysedBy._id) {
            // Already populated or has _id property
            if (item.analysedBy.firstName) {
              // Already populated, skip
              return;
            }
            userId = item.analysedBy._id.toString();
          } else if (item.analysedBy.toString) {
            // It's an ObjectId
            userId = item.analysedBy.toString();
          } else if (typeof item.analysedBy === 'string') {
            // It's already a string
            userId = item.analysedBy;
          } else {
            // Unknown type, skip
            return;
          }
          
          if (userId && !userIds.includes(userId)) {
            userIds.push(userId);
          }
          itemMap.set(index, userId);
        }
      });
      
      // Fetch all users at once
      if (userIds.length > 0) {
        try {
          const users = await User.find({ _id: { $in: userIds } }).select('firstName lastName email');
          const userMap = new Map(users.map(u => [u._id.toString(), u]));
          
          // Assign populated users back to items
          itemMap.forEach((userId, itemIndex) => {
            const user = userMap.get(userId);
            if (user) {
              job.items[itemIndex].analysedBy = user;
            }
          });
        } catch (userError) {
          console.error('Error populating analysedBy users:', userError);
        }
      }
    }
    
    // Debug logging for fibre analysis report
    // console.log('=== ASSESSMENT FETCH DEBUG ===');
    // console.log('Assessment ID:', job._id);
    // console.log('Assessment fields:', Object.keys(job.toObject()));
    // console.log('fibreAnalysisReport exists:', !!job.fibreAnalysisReport);
    // console.log('fibreAnalysisReport type:', typeof job.fibreAnalysisReport);
    // console.log('fibreAnalysisReport length:', job.fibreAnalysisReport ? job.fibreAnalysisReport.length : 'N/A');
    // if (job.fibreAnalysisReport) {
    //   console.log('fibreAnalysisReport starts with:', job.fibreAnalysisReport.substring(0, 50));
    //   console.log('fibreAnalysisReport ends with:', job.fibreAnalysisReport.substring(job.fibreAnalysisReport.length - 50));
    //   console.log('fibreAnalysisReport middle (100 chars):', job.fibreAnalysisReport.substring(Math.floor(job.fibreAnalysisReport.length / 2) - 50, Math.floor(job.fibreAnalysisReport.length / 2) + 50));
      
    //   // Check for common corruption patterns
    //   console.log('=== CORRUPTION PATTERN CHECK ===');
    //   console.log('Contains null bytes:', job.fibreAnalysisReport.includes('\0'));
    //   console.log('Contains undefined:', job.fibreAnalysisReport.includes('undefined'));
    //   console.log('Contains [object Object]:', job.fibreAnalysisReport.includes('[object Object]'));
    //   console.log('Contains NaN:', job.fibreAnalysisReport.includes('NaN'));
    //   console.log('Contains Infinity:', job.fibreAnalysisReport.includes('Infinity'));
    //   console.log('Contains -Infinity:', job.fibreAnalysisReport.includes('-Infinity'));
    //   console.log('Contains invalid base64 chars:', /[^A-Za-z0-9+/=]/.test(job.fibreAnalysisReport));
      
    //   // More specific NaN detection
    //   if (job.fibreAnalysisReport.includes('NaN')) {
    //     console.log('=== DETAILED NaN ANALYSIS ===');
    //     const nanIndex = job.fibreAnalysisReport.indexOf('NaN');
    //     console.log('First NaN found at index:', nanIndex);
    //     console.log('Context around NaN (50 chars before):', job.fibreAnalysisReport.substring(Math.max(0, nanIndex - 50), nanIndex));
    //     console.log('Context around NaN (50 chars after):', job.fibreAnalysisReport.substring(nanIndex + 3, nanIndex + 53));
        
    //     // Check if it's actually part of base64 data or text content
    //     const beforeContext = job.fibreAnalysisReport.substring(Math.max(0, nanIndex - 10), nanIndex);
    //     const afterContext = job.fibreAnalysisReport.substring(nanIndex + 3, nanIndex + 13);
    //     console.log('Immediate context before NaN:', beforeContext);
    //     console.log('Immediate context after NaN:', afterContext);
        
    //     // Check if it's surrounded by valid base64 characters
    //     const isBase64Context = /^[A-Za-z0-9+/=]*$/.test(beforeContext + afterContext);
    //     console.log('NaN is in base64 context:', isBase64Context);
    //     console.log('=== END DETAILED NaN ANALYSIS ===');
    //   }
      
    //   // Check for other potential PDF corruption patterns
    //   console.log('=== ADDITIONAL CORRUPTION CHECKS ===');
    //   console.log('Contains "null" string:', job.fibreAnalysisReport.includes('null'));
    //   console.log('Contains "undefined" string:', job.fibreAnalysisReport.includes('undefined'));
    //   console.log('Contains "false" string:', job.fibreAnalysisReport.includes('false'));
    //   console.log('Contains "true" string:', job.fibreAnalysisReport.includes('true'));
    //   console.log('Contains "0" string:', job.fibreAnalysisReport.includes('0'));
    //   console.log('Contains "1" string:', job.fibreAnalysisReport.includes('1'));
      
    //   // Check for potential PDF structure issues
    //   console.log('Contains PDF header "JVBERi0xLjMK":', job.fibreAnalysisReport.startsWith('JVBERi0xLjMK'));
    //   console.log('Contains PDF trailer "%%EOF":', job.fibreAnalysisReport.includes('%%EOF'));
    //   console.log('Contains PDF object markers "obj":', job.fibreAnalysisReport.includes('obj'));
    //   console.log('Contains PDF stream markers "stream":', job.fibreAnalysisReport.includes('stream'));
      
    //   // Check for potential encoding issues
    //   console.log('Contains non-ASCII characters:', /[^\x00-\x7F]/.test(job.fibreAnalysisReport));
    //   console.log('Contains control characters:', /[\x00-\x1F\x7F]/.test(job.fibreAnalysisReport));
    //   console.log('=== END ADDITIONAL CORRUPTION CHECKS ===');
    //   console.log('=== END CORRUPTION PATTERN CHECK ===');
    // }
    // console.log('=== END ASSESSMENT FETCH DEBUG ===');
    
    // // Log the final state before sending response
    // console.log('=== PRE-RESPONSE DEBUG ===');
    // if (job.fibreAnalysisReport) {
    //   console.log('About to send - fibreAnalysisReport length:', job.fibreAnalysisReport.length);
    //   console.log('About to send - fibreAnalysisReport starts with:', job.fibreAnalysisReport.substring(0, 50));
    //   console.log('About to send - fibreAnalysisReport ends with:', job.fibreAnalysisReport.substring(job.fibreAnalysisReport.length - 50));
    //   console.log('About to send - fibreAnalysisReport type:', typeof job.fibreAnalysisReport);
    //   console.log('About to send - fibreAnalysisReport is string:', typeof job.fibreAnalysisReport === 'string');
    //   console.log('About to send - fibreAnalysisReport is null:', job.fibreAnalysisReport === null);
    //   console.log('About to send - fibreAnalysisReport is undefined:', job.fibreAnalysisReport === undefined);
    // } else {
    //   console.log('About to send - fibreAnalysisReport is missing/null/undefined');
    // }
    // console.log('=== END PRE-RESPONSE DEBUG ===');
    
    res.json(job);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch assessment job', error: err.message });
  }
});

// PUT /api/assessments/:id - update assessment job
router.put('/:id', async (req, res) => {
  try {
    const { 
      projectId, 
      assessmentDate, 
      status, 
      assessmentScope,
      samplesReceivedDate,
      submittedBy,
      turnaroundTime,
      analysisDueDate,
      jobSpecificExclusions,
      discussionConclusions,
      sitePlan,
      sitePlanFile,
      sitePlanLegend,
      sitePlanLegendTitle,
      sitePlanFigureTitle,
      sitePlanSource,
      LAA,
      state,
      reportApprovedBy,
      reportAuthorisedBy,
      reportAuthorisedAt,
      archived
    } = req.body;
    if (!projectId || !assessmentDate) {
      return res.status(400).json({ message: 'projectId and assessmentDate are required' });
    }
    
    const updateData = {
      projectId,
      assessmentDate,
      updatedAt: new Date()
    };
    // Only update status when explicitly provided; otherwise preserve current value
    if (status !== undefined) {
      updateData.status = status;
    }
    
    // Include assessmentScope if provided
    if (assessmentScope !== undefined) {
      updateData.assessmentScope = assessmentScope;
    }
    
    // Include samples submission data if provided
    if (samplesReceivedDate !== undefined) {
      updateData.samplesReceivedDate = samplesReceivedDate;
    }
    if (submittedBy !== undefined) {
      updateData.submittedBy = submittedBy;
    }
    if (turnaroundTime !== undefined) {
      updateData.turnaroundTime = turnaroundTime;
    }
    if (analysisDueDate !== undefined) {
      updateData.analysisDueDate = analysisDueDate;
    }
    if (jobSpecificExclusions !== undefined) {
      updateData.jobSpecificExclusions = jobSpecificExclusions;
    }
    if (discussionConclusions !== undefined) {
      updateData.discussionConclusions = discussionConclusions;
    }
    if (sitePlan !== undefined) updateData.sitePlan = sitePlan;
    if (sitePlanFile !== undefined) updateData.sitePlanFile = sitePlanFile;
    if (sitePlanLegend !== undefined) updateData.sitePlanLegend = sitePlanLegend;
    if (sitePlanLegendTitle !== undefined) updateData.sitePlanLegendTitle = sitePlanLegendTitle;
    if (sitePlanFigureTitle !== undefined) updateData.sitePlanFigureTitle = sitePlanFigureTitle;
    if (sitePlanSource !== undefined) updateData.sitePlanSource = sitePlanSource;
    if (LAA !== undefined) {
      updateData.LAA = LAA;
    }
    if (state !== undefined) {
      updateData.state = state && ['ACT', 'NSW', 'Commonwealth'].includes(state) ? state : null;
    }
    if (reportApprovedBy !== undefined) {
      updateData.reportApprovedBy = reportApprovedBy;
    }
    if (reportAuthorisedBy !== undefined) {
      updateData.reportAuthorisedBy = reportAuthorisedBy;
    }
    if (reportAuthorisedAt !== undefined) {
      updateData.reportAuthorisedAt = reportAuthorisedAt;
    }
    if (archived !== undefined) {
      updateData.archived = archived;
    }
    
    const job = await AsbestosAssessment.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    ).populate({
      path: "projectId",
      select: "projectID name client",
      populate: {
        path: "client",
        select: "name contact1Name contact1Email address"
      }
    }).populate('assessorId');
    
    if (!job) return res.status(404).json({ message: 'Assessment job not found' });
    res.json(job);
  } catch (err) {
    res.status(400).json({ message: 'Failed to update assessment job', error: err.message });
  }
});

// PATCH /api/assessments/:id/archive - mark assessment as complete (removes from table)
router.patch('/:id/archive', async (req, res) => {
  try {
    const job = await AsbestosAssessment.findByIdAndUpdate(
      req.params.id,
      { archived: true, updatedAt: new Date() },
      { new: true }
    )
      .populate({
        path: "projectId",
        select: "projectID name client",
        populate: { path: "client", select: "name contact1Name contact1Email address" },
      })
      .populate('assessorId');
    if (!job) return res.status(404).json({ message: 'Assessment job not found' });
    res.json(job);
  } catch (err) {
    res.status(400).json({ message: 'Failed to archive assessment', error: err.message });
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
          select: "name contact1Name contact1Email address"
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
    const resetStatuses = ['site-works-complete', 'samples-with-lab', 'sample-analysis-complete'];
    if (resetStatuses.includes(job.status)) {
      job.status = 'in-progress';
    }
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

// PATCH /api/assessments/:id/status - update assessment status
router.patch('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    if (!status) {
      return res.status(400).json({ message: 'Status is required' });
    }

    // Validate status
    const validStatuses = [
      'in-progress',
      'samples-with-lab',
      'sample-analysis-complete',
      'report-ready-for-review',
      'complete'
    ];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ 
        message: 'Invalid status. Must be one of: ' + validStatuses.join(', ') 
      });
    }

    const job = await AsbestosAssessment.findById(req.params.id);
    if (!job) return res.status(404).json({ message: 'Assessment job not found' });
    
    job.status = status;
    job.updatedAt = new Date();
    await job.save();
    
    res.json(job);
  } catch (err) {
    res.status(400).json({ message: 'Failed to update assessment status', error: err.message });
  }
});

// PATCH /api/assessments/:id/ready-for-analysis - mark entire assessment as ready for analysis (DEPRECATED)
router.patch('/:id/ready-for-analysis', async (req, res) => {
  try {
    const job = await AsbestosAssessment.findById(req.params.id);
    if (!job) return res.status(404).json({ message: 'Assessment job not found' });
    job.status = "samples-with-lab"; // Updated to use new status
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
    // Use pull() to remove subdocument from array (recommended for Mongoose)
    job.items.pull(req.params.itemId);
    await job.save();
    res.json({ message: 'Item deleted' });
  } catch (err) {
    console.error('Error deleting item:', err);
    res.status(400).json({ message: 'Failed to delete item', error: err.message });
  }
});

// POST /api/assessments/:id/items/:itemId/photos - add photo to assessment item
router.post('/:id/items/:itemId/photos', async (req, res) => {
  try {
    const { photoData, includeInReport = true } = req.body;

    if (!photoData) {
      return res.status(400).json({ message: 'Photo data is required' });
    }

    const job = await AsbestosAssessment.findById(req.params.id);
    if (!job) return res.status(404).json({ message: 'Assessment job not found' });

    const item = job.items.id(req.params.itemId);
    if (!item) return res.status(404).json({ message: 'Assessment item not found' });

    // Initialize photographs array if it doesn't exist
    if (!item.photographs) {
      item.photographs = [];
    }

    // Calculate next photo number for this item
    const existingPhotoNumbers = item.photographs.map(p => p.photoNumber || 0);
    const nextPhotoNumber = existingPhotoNumbers.length > 0 ? Math.max(...existingPhotoNumbers) + 1 : 1;
    
    // If this is the first photo and no photo numbers exist, start from 1
    const actualPhotoNumber = item.photographs.length === 0 ? 1 : nextPhotoNumber;

    // Add new photo
    item.photographs.push({
      data: photoData,
      includeInReport: includeInReport,
      uploadedAt: new Date(),
      photoNumber: actualPhotoNumber,
    });

    item.updatedAt = new Date();
    await job.save();

    res.status(201).json(item);
  } catch (err) {
    console.error('Error adding photo to assessment item:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// DELETE /api/assessments/:id/items/:itemId/photos/:photoId - delete photo from assessment item
router.delete('/:id/items/:itemId/photos/:photoId', async (req, res) => {
  try {
    const job = await AsbestosAssessment.findById(req.params.id);
    if (!job) return res.status(404).json({ message: 'Assessment job not found' });

    const item = job.items.id(req.params.itemId);
    if (!item) return res.status(404).json({ message: 'Assessment item not found' });

    const photoIndex = item.photographs.findIndex(photo => photo._id.toString() === req.params.photoId);
    if (photoIndex === -1) {
      return res.status(404).json({ message: 'Photo not found' });
    }

    item.photographs.splice(photoIndex, 1);
    item.updatedAt = new Date();
    await job.save();

    res.json({ message: 'Photo deleted successfully', item });
  } catch (err) {
    console.error('Error deleting photo from assessment item:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// PATCH /api/assessments/:id/items/:itemId/photos/:photoId/toggle - toggle photo inclusion in report
router.patch('/:id/items/:itemId/photos/:photoId/toggle', async (req, res) => {
  try {
    const job = await AsbestosAssessment.findById(req.params.id);
    if (!job) return res.status(404).json({ message: 'Assessment job not found' });

    const item = job.items.id(req.params.itemId);
    if (!item) return res.status(404).json({ message: 'Assessment item not found' });

    const photo = item.photographs.id(req.params.photoId);
    if (!photo) {
      return res.status(404).json({ message: 'Photo not found' });
    }

    photo.includeInReport = !photo.includeInReport;
    item.updatedAt = new Date();
    await job.save();

    res.json({ message: 'Photo inclusion toggled successfully', item });
  } catch (err) {
    console.error('Error toggling photo inclusion:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// PATCH /api/assessments/:id/items/:itemId/photos/:photoId/description - update photo description
router.patch('/:id/items/:itemId/photos/:photoId/description', async (req, res) => {
  try {
    const { description } = req.body;

    const job = await AsbestosAssessment.findById(req.params.id);
    if (!job) return res.status(404).json({ message: 'Assessment job not found' });

    const item = job.items.id(req.params.itemId);
    if (!item) return res.status(404).json({ message: 'Assessment item not found' });

    const photo = item.photographs.id(req.params.photoId);
    if (!photo) {
      return res.status(404).json({ message: 'Photo not found' });
    }

    photo.description = description !== undefined ? description : photo.description;
    item.updatedAt = new Date();
    await job.save();

    res.json({ message: 'Photo description updated successfully', item });
  } catch (err) {
    console.error('Error updating photo description:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
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

// POST /api/assessments/:id/upload-fibre-analysis-report - upload fibre analysis report
router.post('/:id/upload-fibre-analysis-report', async (req, res) => {
  try {
    const { reportData } = req.body; // Expecting base64 data
    if (!reportData) {
      return res.status(400).json({ message: 'Report data is required' });
    }

    console.log('=== FIBRE ANALYSIS REPORT UPLOAD DEBUG ===');
    console.log('Assessment ID:', req.params.id);
    console.log('Report data length:', reportData.length);
    console.log('Report data type:', typeof reportData);
    console.log('Report data starts with:', reportData.substring(0, 50));
    console.log('Report data ends with:', reportData.substring(reportData.length - 50));
    console.log('Report data middle (100 chars):', reportData.substring(Math.floor(reportData.length / 2) - 50, Math.floor(reportData.length / 2) + 50));
    console.log('=== END UPLOAD DEBUG ===');

    const job = await AsbestosAssessment.findById(req.params.id);
    if (!job) return res.status(404).json({ message: 'Assessment job not found' });

    console.log('=== BEFORE SAVE DEBUG ===');
    console.log('Found assessment job:', job._id);
    console.log('Previous fibreAnalysisReport field:', job.fibreAnalysisReport ? 'Present' : 'Missing');
    if (job.fibreAnalysisReport) {
      console.log('Previous fibreAnalysisReport length:', job.fibreAnalysisReport.length);
      console.log('Previous fibreAnalysisReport starts with:', job.fibreAnalysisReport.substring(0, 50));
      console.log('Previous fibreAnalysisReport ends with:', job.fibreAnalysisReport.substring(job.fibreAnalysisReport.length - 50));
    }
    console.log('=== END BEFORE SAVE DEBUG ===');

    // Store original data for comparison
    const originalReportData = reportData;
    
    job.fibreAnalysisReport = reportData;
    job.updatedAt = new Date();
    
    console.log('=== IMMEDIATELY BEFORE SAVE DEBUG ===');
    console.log('About to save - fibreAnalysisReport length:', job.fibreAnalysisReport.length);
    console.log('About to save - fibreAnalysisReport starts with:', job.fibreAnalysisReport.substring(0, 50));
    console.log('About to save - fibreAnalysisReport ends with:', job.fibreAnalysisReport.substring(job.fibreAnalysisReport.length - 50));
    console.log('Data integrity check - lengths match:', originalReportData.length === job.fibreAnalysisReport.length);
    console.log('Data integrity check - content matches:', originalReportData === job.fibreAnalysisReport);
    console.log('=== END IMMEDIATELY BEFORE SAVE DEBUG ===');
    
    await job.save();

    console.log('=== AFTER SAVE DEBUG ===');
    console.log('Assessment saved successfully');
    console.log('New fibreAnalysisReport field:', job.fibreAnalysisReport ? 'Present' : 'Missing');
    console.log('After save - fibreAnalysisReport length:', job.fibreAnalysisReport.length);
    console.log('After save - fibreAnalysisReport starts with:', job.fibreAnalysisReport.substring(0, 50));
    console.log('After save - fibreAnalysisReport ends with:', job.fibreAnalysisReport.substring(job.fibreAnalysisReport.length - 50));
    
    // Compare with original data
    console.log('=== DATA INTEGRITY COMPARISON ===');
    console.log('Original data length:', originalReportData.length);
    console.log('Stored data length:', job.fibreAnalysisReport.length);
    console.log('Lengths match:', originalReportData.length === job.fibreAnalysisReport.length);
    console.log('Content matches:', originalReportData === job.fibreAnalysisReport);
    if (originalReportData !== job.fibreAnalysisReport) {
      console.log('WARNING: Data corruption detected during save!');
      console.log('First 100 chars match:', originalReportData.substring(0, 100) === job.fibreAnalysisReport.substring(0, 100));
      console.log('Last 100 chars match:', originalReportData.substring(originalReportData.length - 100) === job.fibreAnalysisReport.substring(job.fibreAnalysisReport.length - 100));
    }
    console.log('=== END DATA INTEGRITY COMPARISON ===');

    res.json({ message: 'Fibre analysis report uploaded successfully', job });
  } catch (err) {
    console.error('Error uploading fibre analysis report:', err);
    res.status(400).json({ message: 'Failed to upload fibre analysis report', error: err.message });
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

// PUT /api/assessments/:id/items/:itemNumber/analysis - update analysis data for a specific assessment item
router.put('/:id/items/:itemNumber/analysis', async (req, res) => {
  try {
    const { id, itemNumber } = req.params;
    const requestData = req.body;
    
    // Extract analysedBy from request body if provided (it's not part of analysisData)
    const requestedAnalystId = requestData.analysedBy;
    
    // Extract analysisData (everything except analysedBy)
    const { analysedBy, ...analysisData } = requestData;
    
    const assessment = await AsbestosAssessment.findById(id);
    if (!assessment) {
      return res.status(404).json({ message: 'Assessment job not found' });
    }
    
    // Find the specific item by itemNumber first, then fall back to array index
    let itemIndex = assessment.items.findIndex(item => item.itemNumber === parseInt(itemNumber));
    
    // If not found by itemNumber, try by array index (itemNumber - 1 for 1-based indexing)
    if (itemIndex === -1 && assessment.items && assessment.items.length > 0) {
      const index = parseInt(itemNumber) - 1;
      if (index >= 0 && index < assessment.items.length) {
        itemIndex = index;
      }
    }
    
    if (itemIndex === -1) {
      return res.status(404).json({ message: 'Assessment item not found' });
    }
    
    // Update the analysis data for the item
    // Respect the isAnalysed value from the request, or default to true if not provided
    const isAnalysed = analysisData.isAnalysed !== undefined ? analysisData.isAnalysed : true;
    
    // Only set analysedBy and analysedAt if the analysis is marked as complete
    const updateData = {
      ...assessment.items[itemIndex].analysisData,
      ...analysisData,
      isAnalysed: isAnalysed
    };
    
    assessment.items[itemIndex].analysisData = updateData;
    
    // Set analysedBy and analysedAt on the item itself if analysis is complete
    // Also set analyst at assessment level (for all samples)
    // Use the analyst from the request body if provided, otherwise use the current user
    const analystId = requestedAnalystId || req.user._id;
    
    if (isAnalysed) {
      assessment.items[itemIndex].analysedBy = analystId;
      assessment.items[itemIndex].analysedAt = analysisData.analysedAt ? new Date(analysisData.analysedAt) : new Date();
      
      // Set analyst at assessment level (for all samples in this job)
      if (analystId) {
        assessment.analyst = analystId;
      }
      
      console.log('Backend - Setting analysedBy:', {
        requestedAnalystId,
        currentUserId: req.user._id,
        finalAnalystId: assessment.items[itemIndex].analysedBy,
        assessmentAnalyst: assessment.analyst,
        isAnalysed
      });
    } else {
      console.log('Backend - Not setting analysedBy because isAnalysed is false:', isAnalysed);
    }
    
    // Update the item's updatedAt timestamp
    assessment.items[itemIndex].updatedAt = new Date();
    
    // Check if all items are analysed to update assessment status
    const allItemsAnalysed = assessment.items.every(item => item.analysisData?.isAnalysed);
    if (allItemsAnalysed && assessment.status === 'samples-with-lab') {
      assessment.status = 'sample-analysis-complete';
    }
    
    assessment.updatedAt = new Date();
    await assessment.save();
    
    // Populate analysedBy before sending response
    const responseItem = assessment.items[itemIndex].toObject();
    if (responseItem.analysedBy) {
      try {
        const User = require('../models/User');
        const user = await User.findById(responseItem.analysedBy).select('firstName lastName email');
        if (user) {
          responseItem.analysedBy = user;
        }
      } catch (populateError) {
        console.error('Error populating analysedBy in response:', populateError);
      }
    }
    
    res.json({ 
      message: 'Analysis data updated successfully', 
      item: responseItem,
      assessmentStatus: assessment.status
    });
    
  } catch (err) {
    res.status(500).json({ message: 'Failed to update analysis data', error: err.message });
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
          select: "name contact1Name contact1Email address"
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
    res.setHeader('Content-Disposition', `attachment; filename="${populatedAssessment.projectId?.projectID || 'Unknown'}: Chain of Custody - ${populatedAssessment.projectId?.name || 'Unknown'}.pdf"`);
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