const express = require('express');
const router = express.Router();
const ClientSuppliedJob = require('../models/ClientSuppliedJob');
const Project = require('../models/Project');
const User = require('../models/User');
const { sendMail } = require('../services/mailer');
const auth = require('../middleware/auth');
const checkPermission = require('../middleware/checkPermission');

// GET /api/client-supplied-jobs - get all client supplied jobs (excludes archived by default)
// Query: supplyType=client | ld — when 'ld', return only L&D supplied (standalone) jobs; when 'client' or omitted, return only client supplied jobs
router.get('/', auth, checkPermission('clientSup.view'), async (req, res) => {
  try {
    // Filter out archived jobs by default
    const filter = { archived: { $ne: true } };
    const supplyType = req.query.supplyType;
    if (supplyType === 'ld') {
      filter.supplyType = 'ld';
    } else {
      // client or omitted: exclude LD jobs so client supplied list is unchanged
      filter.supplyType = { $ne: 'ld' };
    }

    const jobs = await ClientSuppliedJob.find(filter)
      .populate({
        path: 'projectId',
        select: 'name projectID d_Date createdAt projectContact',
        populate: {
          path: 'client',
          select: 'name contact1Name contact1Email address invoiceEmail'
        }
      })
      .sort({ createdAt: -1 });
    
    res.json(jobs);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch client supplied jobs', error: err.message });
  }
});

// GET /api/client-supplied-jobs/by-project/:projectId - get jobs by project
router.get('/by-project/:projectId', auth, checkPermission('clientSup.view'), async (req, res) => {
  try {
    const { projectId } = req.params;
    
    console.log('Fetching client supplied jobs by project:', projectId);
    
    const jobs = await ClientSuppliedJob.find({ projectId })
      .populate({
        path: 'projectId',
        select: 'name projectID d_Date createdAt projectContact',
        populate: {
          path: 'client',
          select: 'name contact1Name contact1Email address invoiceEmail'
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
router.get('/:id', auth, checkPermission('clientSup.view'), async (req, res) => {
  try {
    const job = await ClientSuppliedJob.findById(req.params.id)
      .populate({
        path: 'projectId',
        select: 'name projectID d_Date createdAt projectContact',
        populate: {
          path: 'client',
          select: 'name contact1Name contact1Email address invoiceEmail'
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
router.post('/', auth, checkPermission('clientSup.create'), async (req, res) => {
  try {
    const { projectId, jobType, sampleReceiptDate, sampleCount, turnaroundTime, analysisDueDate, supplyType } = req.body;
    
    console.log('Creating client supplied job with data:', { projectId, jobType, sampleReceiptDate, sampleCount, turnaroundTime, analysisDueDate });
    
    if (!projectId) {
      return res.status(400).json({ 
        message: 'projectId is required' 
      });
    }

    // Validate projectId is a valid MongoDB ObjectId
    if (!require('mongoose').Types.ObjectId.isValid(projectId)) {
      return res.status(400).json({ 
        message: 'Invalid projectId format. Must be a valid MongoDB ObjectId.' 
      });
    }

    // Verify project exists
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(400).json({ 
        message: 'Project not found with the provided projectId' 
      });
    }
    
    // Validate jobType if provided
    if (jobType && jobType !== 'Fibre ID' && jobType !== 'Fibre Count') {
      return res.status(400).json({ 
        message: 'Invalid jobType. Must be either "Fibre ID" or "Fibre Count"' 
      });
    }
    
    const jobData = {
      projectId
    };
    
    // Only add jobType if provided (for backward compatibility)
    if (jobType) {
      jobData.jobType = jobType;
    }
    
    // Add sample receipt date if provided (and not empty)
    if (sampleReceiptDate && sampleReceiptDate !== '' && sampleReceiptDate.trim() !== '') {
      const receiptDate = new Date(sampleReceiptDate);
      if (isNaN(receiptDate.getTime())) {
        return res.status(400).json({ 
          message: 'Invalid sampleReceiptDate format. Please use a valid date.' 
        });
      }
      jobData.sampleReceiptDate = receiptDate;
    }
    
    // Add sample count if provided (explicitly set, not just undefined/null)
    // Only validate and set if it's actually provided in the request
    if (sampleCount !== undefined && sampleCount !== null && sampleCount !== '') {
      const count = parseInt(sampleCount, 10);
      if (isNaN(count) || count < 0) {
        return res.status(400).json({ 
          message: 'Invalid sampleCount. Must be a non-negative integer.' 
        });
      }
      jobData.sampleCount = count;
    }
    // If not provided, the model default (0) will be used

    // Add turnaround time if provided
    if (turnaroundTime !== undefined && turnaroundTime !== null && String(turnaroundTime).trim() !== '') {
      jobData.turnaroundTime = String(turnaroundTime).trim();
    }

    // Add analysis due date if provided
    if (analysisDueDate) {
      const dueDate = new Date(analysisDueDate);
      if (!isNaN(dueDate.getTime())) {
        jobData.analysisDueDate = dueDate;
      }
    }

    // L&D supplied jobs (standalone, no asbestos/residential link)
    if (supplyType === 'ld') {
      jobData.supplyType = 'ld';
    }
    
    console.log('Creating job with data:', jobData);
    
    // Job number is optional - only generate if needed for reports
    // For now, we'll skip it to avoid race conditions and complexity
    // Reports can use project ID + job _id instead
    
    const job = new ClientSuppliedJob(jobData);
    
    try {
      await job.save();
      console.log('Job created successfully:', job._id);
    } catch (saveError) {
      console.error('Error saving job:', saveError);
      throw saveError;
    }
    
    // Update the project's reports_present field to true
    if (job.projectId) {
      try {
        const projectId = job.projectId._id || job.projectId;
        await Project.findByIdAndUpdate(
          projectId,
          { reports_present: true }
        );
        console.log(`Updated project ${projectId} reports_present to true due to client supplied job creation`);
      } catch (error) {
        console.error("Error updating project reports_present field:", error);
        // Don't fail the main request if project update fails
      }
    }
    
    try {
      const populatedJob = await ClientSuppliedJob.findById(job._id)
        .populate({
          path: 'projectId',
          select: 'name projectID d_Date createdAt',
          populate: {
            path: 'client',
            select: 'name contact1Name contact1Email address'
          }
        });
      
      if (!populatedJob) {
        throw new Error('Failed to retrieve created job');
      }
      
      console.log('Job populated successfully, sending response');
      res.status(201).json(populatedJob);
    } catch (populateError) {
      console.error('Error populating job:', populateError);
      // If population fails, still return the job without population
      res.status(201).json(job);
    }
  } catch (err) {
    console.error('Error in create job route:', err);
    const errorMessage = err.message || 'Failed to create client supplied job';
    const statusCode = err.message?.includes('already exists') || err.message?.includes('unique') ? 409 : 400;
    res.status(statusCode).json({ 
      message: errorMessage,
      error: err.message 
    });
  }
});

// PUT /api/client-supplied-jobs/:id - update job
router.put('/:id', auth, checkPermission('clientSup.edit'), async (req, res) => {
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

// PUT /api/client-supplied-jobs/:id/archive - archive job
router.put('/:id/archive', auth, checkPermission('clientSup.edit'), async (req, res) => {
  try {
    const job = await ClientSuppliedJob.findByIdAndUpdate(
      req.params.id,
      {
        archived: true,
        archivedAt: new Date()
      },
      { new: true }
    );

    if (!job) {
      return res.status(404).json({ message: 'Client supplied job not found' });
    }

    res.json({ message: 'Job archived successfully', job });
  } catch (err) {
    res.status(500).json({ message: 'Failed to archive job', error: err.message });
  }
});

// DELETE /api/client-supplied-jobs/:id - delete job
router.delete('/:id', auth, checkPermission('clientSup.delete'), async (req, res) => {
  try {
    const job = await ClientSuppliedJob.findByIdAndDelete(req.params.id);
    
    if (!job) {
      return res.status(404).json({ message: 'Client supplied job not found' });
    }
    
    // Samples are now embedded in the job, so they'll be deleted automatically
    
    res.json({ message: 'Client supplied job deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete client supplied job', error: err.message });
  }
});

// POST /api/client-supplied-jobs/:id/send-for-approval - send approval request emails
router.post('/:id/send-for-approval', auth, checkPermission('clientSup.edit'), async (req, res) => {
  try {
    const job = await ClientSuppliedJob.findById(req.params.id)
      .populate({
        path: 'projectId',
        select: 'name projectID',
        populate: {
          path: 'client',
          select: 'name'
        }
      });

    if (!job) {
      return res.status(404).json({ message: 'Client supplied job not found' });
    }

    // Check if job is ready for approval
    if (job.status !== 'Analysis Complete') {
      return res.status(400).json({ message: 'Job must be finalized before sending for approval' });
    }

    if (job.reportApprovedBy) {
      return res.status(400).json({ message: 'Report has already been approved' });
    }

    // Get all users with lab signatory approval
    const signatoryUsers = await User.find({
      labSignatory: true,
      isActive: true
    }).select('firstName lastName email');

    if (signatoryUsers.length === 0) {
      return res.status(400).json({ message: 'No lab signatory users found' });
    }

    // Get the requesting user from request (if available)
    const requesterName = req.user?.firstName && req.user?.lastName
      ? `${req.user.firstName} ${req.user.lastName}`
      : 'A user';

    const projectName = job.projectId?.name || 'Unknown Project';
    const projectID = job.projectId?.projectID || 'N/A';
    const jobType = job.jobType || 'Analysis';
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const basePath = '/client-supplied';
    const jobUrl = `${frontendUrl}${basePath}`;

    // Send email to all signatory users
    const emailPromises = signatoryUsers.map(async (user) => {
      try {
        await sendMail({
          to: user.email,
          subject: `Report Approval Required - ${projectID}: ${jobType} Report`,
          text: `
A ${jobType} report is ready for approval.

Project: ${projectName} (${projectID})
Job Type: ${jobType}
Requested by: ${requesterName}

Please review and approve the report at: ${jobUrl}
          `,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
              <div style="margin-bottom: 30px;">
                <h1 style="color: rgb(25, 138, 44); font-size: 24px; margin: 0; padding: 0;">L&D Consulting App</h1>
                <p style="color: #666; font-size: 16px; margin: 10px 0 0 0;">Environmental Services</p>
              </div>
              <div style="color: #333; line-height: 1.6;">
                <h2 style="color: rgb(25, 138, 44); margin-bottom: 20px;">Report Approval Required</h2>
                <p>Hello ${user.firstName},</p>
                <p>A ${jobType} report is ready for your approval:</p>
                <div style="background-color: #f5f5f5; padding: 15px; border-radius: 4px; margin: 20px 0;">
                  <p style="margin: 5px 0;"><strong>Project:</strong> ${projectName}</p>
                  <p style="margin: 5px 0;"><strong>Project ID:</strong> ${projectID}</p>
                  <p style="margin: 5px 0;"><strong>Job Type:</strong> ${jobType}</p>
                  <p style="margin: 5px 0;"><strong>Requested by:</strong> ${requesterName}</p>
                </div>
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${jobUrl}" style="background-color: rgb(25, 138, 44); color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">Review Report</a>
                </div>
                <p>Please review and approve the report at your earliest convenience.</p>
                <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">
                <p style="color: #666; font-size: 12px;">This is an automated message, please do not reply to this email.</p>
              </div>
            </div>
          `
        });
      } catch (emailError) {
        console.error(`Failed to send email to ${user.email}:`, emailError);
        throw emailError;
      }
    });

    await Promise.all(emailPromises);

    res.json({
      message: `Approval request emails sent successfully to ${signatoryUsers.length} signatory user(s)`,
      recipients: signatoryUsers.map(u => ({ email: u.email, name: `${u.firstName} ${u.lastName}` }))
    });
  } catch (err) {
    console.error('Error sending approval request emails:', err);
    res.status(500).json({ message: 'Failed to send approval request emails', error: err.message });
  }
});

// POST /api/client-supplied-jobs/:id/authorise - authorise report
router.post('/:id/authorise', auth, checkPermission('clientSup.edit'), async (req, res) => {
  try {
    const job = await ClientSuppliedJob.findById(req.params.id)
      .populate({
        path: 'projectId',
        select: 'name projectID',
        populate: {
          path: 'client',
          select: 'name'
        }
      });

    if (!job) {
      return res.status(404).json({ message: 'Client supplied job not found' });
    }

    if (job.status !== 'Analysis Complete') {
      return res.status(400).json({
        message: 'Job must be finalized before authorising the report'
      });
    }

    if (job.reportApprovedBy) {
      return res.status(400).json({
        message: 'Report has already been authorised'
      });
    }

    const approver =
      req.user?.firstName && req.user?.lastName
        ? `${req.user.firstName} ${req.user.lastName}`
        : req.user?.email || 'Unknown';

    job.reportApprovedBy = approver;
    job.reportIssueDate = new Date();
    job.updatedAt = new Date();

    const updatedJob = await job.save();

    // Send notification email to the user who requested authorisation
    if (updatedJob.authorisationRequestedBy) {
      try {
        const requester = await User.findById(updatedJob.authorisationRequestedBy)
          .select('firstName lastName email');
        
        if (requester && requester.email) {
          const projectName = job.projectId?.name || 'Unknown Project';
          const projectID = job.projectId?.projectID || 'N/A';
          const jobType = job.jobType || 'Analysis';
          const approverName = approver;
          const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
          const basePath = '/client-supplied';
          const jobUrl = `${frontendUrl}${basePath}`;

          await sendMail({
            to: requester.email,
            subject: `Report Authorised - ${projectID}: ${jobType} Report`,
            text: `
The ${jobType} report you requested for authorisation has been authorised.

Project: ${projectName} (${projectID})
Job Type: ${jobType}
Authorised by: ${approverName}

View the report at: ${jobUrl}
            `,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
                <div style="margin-bottom: 30px;">
                  <h1 style="color: rgb(25, 138, 44); font-size: 24px; margin: 0; padding: 0;">L&D Consulting App</h1>
                  <p style="color: #666; font-size: 16px; margin: 10px 0 0 0;">Environmental Services</p>
                </div>
                <div style="color: #333; line-height: 1.6;">
                  <h2 style="color: rgb(25, 138, 44); margin-bottom: 20px;">Report Authorised</h2>
                  <p>Hello ${requester.firstName},</p>
                  <p>The ${jobType} report you requested for authorisation has been authorised:</p>
                  <div style="background-color: #f5f5f5; padding: 15px; border-radius: 4px; margin: 20px 0;">
                    <p style="margin: 5px 0;"><strong>Project:</strong> ${projectName}</p>
                    <p style="margin: 5px 0;"><strong>Project ID:</strong> ${projectID}</p>
                    <p style="margin: 5px 0;"><strong>Job Type:</strong> ${jobType}</p>
                    <p style="margin: 5px 0;"><strong>Authorised by:</strong> ${approverName}</p>
                  </div>
                  <div style="text-align: center; margin: 30px 0;">
                    <a href="${jobUrl}" style="background-color: rgb(25, 138, 44); color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">View Report</a>
                  </div>
                  <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">
                  <p style="color: #666; font-size: 12px;">This is an automated message, please do not reply to this email.</p>
                </div>
              </div>
            `
          });
        }
      } catch (emailError) {
        console.error('Error sending authorisation notification email:', emailError);
        // Don't fail the request if email fails
      }
    }

    res.json(updatedJob);
  } catch (err) {
    console.error('Error authorising report:', err);
    res.status(500).json({ message: 'Failed to authorise report', error: err.message });
  }
});

// POST /api/client-supplied-jobs/:id/send-for-authorisation - send authorisation request emails
router.post('/:id/send-for-authorisation', auth, checkPermission('clientSup.edit'), async (req, res) => {
  try {
    const job = await ClientSuppliedJob.findById(req.params.id)
      .populate({
        path: 'projectId',
        select: 'name projectID',
        populate: {
          path: 'client',
          select: 'name'
        }
      });

    if (!job) {
      return res.status(404).json({ message: 'Client supplied job not found' });
    }

    if (job.status !== 'Analysis Complete') {
      return res.status(400).json({
        message: 'Job must be finalized before sending for authorisation'
      });
    }

    if (job.reportApprovedBy) {
      return res.status(400).json({
        message: 'Report has already been authorised'
      });
    }

    // Get all users with lab signatory approval (fibre ID authorisation is done by lab signatories)
    const labSignatoryUsers = await User.find({
      labSignatory: true,
      isActive: true
    }).select('firstName lastName email');

    if (labSignatoryUsers.length === 0) {
      return res.status(400).json({
        message: 'No lab signatory users found'
      });
    }

    const requesterName =
      req.user?.firstName && req.user?.lastName
        ? `${req.user.firstName} ${req.user.lastName}`
        : req.user?.email || 'A user';

    // Store who requested authorisation
    job.authorisationRequestedBy = req.user._id;
    job.authorisationRequestedByEmail = req.user.email;
    await job.save();

    const projectName = job.projectId?.name || 'Unknown Project';
    const projectID = job.projectId?.projectID || 'N/A';
    const jobType = job.jobType || 'Analysis';
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const basePath = '/client-supplied';
    const jobUrl = `${frontendUrl}${basePath}`;

    // Send email to all lab signatory users
    const emailPromises = labSignatoryUsers.map(async (user) => {
      try {
        await sendMail({
          to: user.email,
          subject: `Report Authorisation Required - ${projectID}: ${jobType} Report`,
          text: `
A ${jobType} report is ready for authorisation.

Project: ${projectName} (${projectID})
Job Type: ${jobType}
Requested by: ${requesterName}

Please review and authorise the report at: ${jobUrl}
          `,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
              <div style="margin-bottom: 30px;">
                <h1 style="color: rgb(25, 138, 44); font-size: 24px; margin: 0; padding: 0;">L&D Consulting App</h1>
                <p style="color: #666; font-size: 16px; margin: 10px 0 0 0;">Environmental Services</p>
              </div>
              <div style="color: #333; line-height: 1.6;">
                <h2 style="color: rgb(25, 138, 44); margin-bottom: 20px;">Report Authorisation Required</h2>
                <p>Hello ${user.firstName},</p>
                <p>A ${jobType} report is ready for your authorisation:</p>
                <div style="background-color: #f5f5f5; padding: 15px; border-radius: 4px; margin: 20px 0;">
                  <p style="margin: 5px 0;"><strong>Project:</strong> ${projectName}</p>
                  <p style="margin: 5px 0;"><strong>Project ID:</strong> ${projectID}</p>
                  <p style="margin: 5px 0;"><strong>Job Type:</strong> ${jobType}</p>
                  <p style="margin: 5px 0;"><strong>Requested by:</strong> ${requesterName}</p>
                </div>
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${jobUrl}" style="background-color: rgb(25, 138, 44); color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">Review Report</a>
                </div>
                <p>Please review and authorise the report at your earliest convenience.</p>
                <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">
                <p style="color: #666; font-size: 12px;">This is an automated message, please do not reply to this email.</p>
              </div>
            </div>
          `
        });
      } catch (emailError) {
        console.error(`Failed to send email to ${user.email}:`, emailError);
        throw emailError;
      }
    });

    await Promise.all(emailPromises);

    res.json({
      message: `Authorisation request emails sent successfully to ${labSignatoryUsers.length} lab signatory user(s)`,
      recipients: labSignatoryUsers.map(u => ({ email: u.email, name: `${u.firstName} ${u.lastName}` }))
    });
  } catch (err) {
    console.error('Error sending authorisation request emails:', err);
    res.status(500).json({ message: 'Failed to send authorisation request emails', error: err.message });
  }
});


module.exports = router; 