const express = require('express');
const router = express.Router();
const IAQRecord = require('../models/IAQRecord');
const IAQSample = require('../models/IAQSample');
const User = require('../models/User');
const { sendMail } = require('../services/mailer');
const auth = require('../middleware/auth');
const checkPermission = require('../middleware/checkPermission');

// Get all IAQ records
router.get('/', auth, checkPermission(['projects.view']), async (req, res) => {
  try {
    const records = await IAQRecord.find()
      .populate('samples')
      .sort({ monitoringDate: -1, createdAt: -1 });
    res.json(records);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get single IAQ record
router.get('/:id', auth, checkPermission(['projects.view']), async (req, res) => {
  try {
    const record = await IAQRecord.findById(req.params.id)
      .populate({
        path: 'samples',
        populate: {
          path: 'collectedBy sampler analysedBy',
          select: 'firstName lastName email'
        }
      });
    if (!record) {
      return res.status(404).json({ message: 'IAQ record not found' });
    }
    res.json(record);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Create IAQ record
router.post('/', auth, checkPermission(['projects.create']), async (req, res) => {
  try {
    const record = new IAQRecord({
      monitoringDate: req.body.monitoringDate,
      status: req.body.status || 'In Progress'
    });

    const newRecord = await record.save();
    res.status(201).json(newRecord);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Update IAQ record
router.patch('/:id', auth, checkPermission(['projects.edit']), async (req, res) => {
  try {
    const record = await IAQRecord.findById(req.params.id);
    if (!record) {
      return res.status(404).json({ message: 'IAQ record not found' });
    }

    // Update fields
    if (req.body.monitoringDate !== undefined) {
      record.monitoringDate = req.body.monitoringDate;
    }
    if (req.body.status !== undefined) {
      record.status = req.body.status;
    }
    if (req.body.reportApprovedBy !== undefined) {
      record.reportApprovedBy = req.body.reportApprovedBy;
    }
    if (req.body.reportIssueDate !== undefined) {
      record.reportIssueDate = req.body.reportIssueDate;
    }
    if (req.body.analysedBy !== undefined) {
      record.analysedBy = req.body.analysedBy;
    }

    const updatedRecord = await record.save();
    res.json(updatedRecord);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// POST /api/iaq-records/:id/authorise - authorise an IAQ report
router.post('/:id/authorise', auth, checkPermission(['projects.edit']), async (req, res) => {
  try {
    const record = await IAQRecord.findById(req.params.id);

    if (!record) {
      return res.status(404).json({ message: 'IAQ record not found' });
    }

    if (record.status !== 'Complete - Satisfactory' && record.status !== 'Complete - Failed') {
      return res.status(400).json({
        message: 'Record must be completed before authorising the report'
      });
    }

    if (record.reportApprovedBy) {
      return res.status(400).json({
        message: 'Report has already been authorised'
      });
    }

    const approver =
      req.user?.firstName && req.user?.lastName
        ? `${req.user.firstName} ${req.user.lastName}`
        : req.user?.email || 'Unknown';

    record.reportApprovedBy = approver;
    record.reportIssueDate = new Date();
    record.updatedAt = new Date();

    const updatedRecord = await record.save();

    // Send notification email to the user who requested authorisation
    if (updatedRecord.authorisationRequestedBy) {
      try {
        const requester = await User.findById(updatedRecord.authorisationRequestedBy)
          .select('firstName lastName email');
        
        if (requester && requester.email) {
          const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
          const recordUrl = `${frontendUrl}/records/indoor-air-quality`;
          
          await sendMail({
            to: requester.email,
            subject: `IAQ Report Authorised - ${generateIAQReference(record)}`,
            text: `
Your IAQ report has been authorised.

IAQ Reference: ${generateIAQReference(record)}
Authorised by: ${approver}
Authorisation Date: ${new Date().toLocaleDateString()}

You can view the authorised report at: ${recordUrl}
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
                  <p>Your IAQ report has been authorised:</p>
                  <div style="background-color: #f5f5f5; padding: 15px; border-radius: 4px; margin: 20px 0;">
                    <p style="margin: 5px 0;"><strong>IAQ Reference:</strong> ${generateIAQReference(record)}</p>
                    <p style="margin: 5px 0;"><strong>Authorised by:</strong> ${approver}</p>
                    <p style="margin: 5px 0;"><strong>Authorisation Date:</strong> ${new Date().toLocaleDateString()}</p>
                  </div>
                  <div style="text-align: center; margin: 30px 0;">
                    <a href="${recordUrl}" style="background-color: rgb(25, 138, 44); color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">View Report</a>
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

    res.json({
      message: 'Report authorised successfully',
      record: updatedRecord
    });
  } catch (err) {
    console.error('Error authorising IAQ report:', err);
    res.status(500).json({ message: err.message });
  }
});

// Helper function to generate IAQ reference (simplified version)
function generateIAQReference(record) {
  if (!record || !record.monitoringDate) return 'N/A';
  const dateObj = new Date(record.monitoringDate);
  const month = dateObj.toLocaleString("default", { month: "short" });
  const year = dateObj.getFullYear();
  return `IAQ ${month} ${year}`;
}

// POST /api/iaq-records/:id/send-for-authorisation - send authorisation request emails
router.post('/:id/send-for-authorisation', auth, checkPermission(['projects.edit']), async (req, res) => {
  try {
    const record = await IAQRecord.findById(req.params.id);

    if (!record) {
      return res.status(404).json({ message: 'IAQ record not found' });
    }

    if (record.status !== 'Complete - Satisfactory' && record.status !== 'Complete - Failed') {
      return res.status(400).json({
        message: 'Record must be completed before sending for authorisation'
      });
    }

    if (record.reportApprovedBy) {
      return res.status(400).json({
        message: 'Report has already been authorised'
      });
    }

    // Get all users with report proofer approval
    const reportProoferUsers = await User.find({
      reportProofer: true,
      isActive: true
    }).select('firstName lastName email');

    if (reportProoferUsers.length === 0) {
      return res.status(400).json({
        message: 'No report proofer users found'
      });
    }

    const requesterName =
      req.user?.firstName && req.user?.lastName
        ? `${req.user.firstName} ${req.user.lastName}`
        : req.user?.email || 'A user';

    // Store who requested authorisation
    record.authorisationRequestedBy = req.user._id;
    record.authorisationRequestedByEmail = req.user.email;
    await record.save();

    const iaqReference = generateIAQReference(record);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const recordUrl = `${frontendUrl}/records/indoor-air-quality`;

    // Send email to all report proofer users
    const emailPromises = reportProoferUsers.map(async (user) => {
      try {
        await sendMail({
          to: user.email,
          subject: `IAQ Report Authorisation Required - ${iaqReference}`,
          text: `
An IAQ report is ready for authorisation.

IAQ Reference: ${iaqReference}
Requested by: ${requesterName}

Please review and authorise the report at: ${recordUrl}
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
                <p>An IAQ report is ready for your authorisation:</p>
                <div style="background-color: #f5f5f5; padding: 15px; border-radius: 4px; margin: 20px 0;">
                  <p style="margin: 5px 0;"><strong>IAQ Reference:</strong> ${iaqReference}</p>
                  <p style="margin: 5px 0;"><strong>Requested by:</strong> ${requesterName}</p>
                </div>
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${recordUrl}" style="background-color: rgb(25, 138, 44); color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">Review Report</a>
                </div>
                <p>Please review and authorise the report at your earliest convenience.</p>
                <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">
                <p style="color: #666; font-size: 12px;">This is an automated message, please do not reply to this email.</p>
              </div>
            </div>
          `
        });
        return { success: true, email: user.email };
      } catch (error) {
        console.error(`Error sending email to ${user.email}:`, error);
        return { success: false, email: user.email, error: error.message };
      }
    });

    const emailResults = await Promise.all(emailPromises);
    const successful = emailResults.filter(r => r.success);
    const failed = emailResults.filter(r => !r.success);

    res.json({
      message: `Authorisation request emails sent to ${successful.length} of ${reportProoferUsers.length} report proofer user(s)`,
      recipients: successful.map(r => r.email),
      failed: failed.map(r => ({ email: r.email, error: r.error }))
    });
  } catch (err) {
    console.error('Error sending authorisation request emails:', err);
    res.status(500).json({ message: err.message });
  }
});

// Delete IAQ record
router.delete('/:id', auth, checkPermission(['projects.delete']), async (req, res) => {
  try {
    const record = await IAQRecord.findById(req.params.id);
    if (!record) {
      return res.status(404).json({ message: 'IAQ record not found' });
    }

    // Delete all associated samples
    await IAQSample.deleteMany({ iaqRecord: req.params.id });

    // Delete the record
    await record.deleteOne();
    res.json({ message: 'IAQ record and associated samples deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
