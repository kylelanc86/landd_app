'use strict';

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const ReportRevision = require('../models/ReportRevision');
const User = require('../models/User');
const Project = require('../models/Project');
const AsbestosClearance = require('../models/clearanceTemplates/asbestos/AsbestosClearance');
const LeadClearance = require('../models/clearanceTemplates/lead/LeadClearance');
const { sendMail } = require('./mailer');
const { getFrontendUrl } = require('./reportAuthorisationNotificationService');
const { buildContentDispositionAttachment } = require('../utils/contentDisposition');

const GENERATED_PDF_DIR = path.join(__dirname, '..', 'generated-pdfs');
const MAX_PDF_BYTES = 30 * 1024 * 1024;
const BRAND_GREEN = 'rgb(25, 138, 44)';

const REPORT_LABELS = {
  shift: 'Air monitoring report',
  lead_shift: 'Lead monitoring report',
  clearance: 'Asbestos clearance report',
  enclosure_certificate: 'Enclosure certificate',
  lead_clearance: 'Lead clearance report',
  fibre_id: 'Fibre ID report',
  fibre_count: 'Fibre count report',
  asbestos_assessment: 'Asbestos assessment report',
  mycometer: 'Mycometer report',
};

function isAdminRole(user) {
  return user?.role === 'admin' || user?.role === 'super_admin';
}

function unchangedSentence() {
  return 'The report is still authorised and the revision number has not changed.';
}

function rejection(status, code, publicMessage, publicDetail) {
  const error = new Error(publicMessage);
  error.status = status;
  error.code = code;
  error.publicMessage = publicMessage;
  error.publicDetail = publicDetail || null;
  return error;
}

function readRevisionRequest(req) {
  const informal = req.body?.informal === true;
  if (informal) {
    if (!isAdminRole(req.user)) {
      throw rejection(
        403,
        'INFORMAL_FORBIDDEN',
        'Only an admin or super admin can reopen a report without changing the revision number.',
        'Ask an admin if this report needs to be edited without a new revision.'
      );
    }
    return { informal: true };
  }

  const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
  if (!reason) {
    throw rejection(
      400,
      'REASON_REQUIRED',
      `Enter a reason for this revision. ${unchangedSentence()}`,
      null
    );
  }
  if (reason.length > 2000) {
    throw rejection(
      400,
      'REASON_TOO_LONG',
      `The revision reason is too long. Shorten it and try again. ${unchangedSentence()}`,
      null
    );
  }

  const pdfBuffer = decodePdf(req.body?.pdfBase64);
  if (!pdfBuffer) {
    throw rejection(
      400,
      'PDF_MISSING',
      `The PDF could not be read, so the revision was not saved. ${unchangedSentence()}`,
      'The file sent to the server was empty or was not a PDF.'
    );
  }

  return {
    informal: false,
    reason,
    pdfBuffer,
    filename: typeof req.body?.filename === 'string' ? req.body.filename : '',
  };
}

function decodePdf(value) {
  if (!value || typeof value !== 'string') return null;
  const base64 = value.includes(',') ? value.split(',').pop() : value;
  let buffer;
  try {
    buffer = Buffer.from(base64, 'base64');
  } catch (err) {
    return null;
  }
  if (!buffer || buffer.length < 5) return null;
  if (buffer.slice(0, 4).toString() !== '%PDF') return null;
  if (buffer.length > MAX_PDF_BYTES) {
    throw rejection(
      413,
      'PDF_TOO_LARGE',
      `The PDF is too large to store, so the revision was not saved. ${unchangedSentence()}`,
      'Contact tech support if this report needs to be revised. The generated PDF is over 30 MB.'
    );
  }
  return buffer;
}

function safePdfFilename(filename, fallback) {
  const base = path.basename(String(filename || fallback || 'report.pdf'));
  const cleaned = base.replace(/[^A-Za-z0-9._ -]/g, '_').trim() || 'report.pdf';
  const withExt = cleaned.toLowerCase().endsWith('.pdf') ? cleaned : `${cleaned}.pdf`;
  return withExt.slice(0, 180);
}

async function archiveSupersededPdf({
  reportType,
  reportId,
  reportKey,
  projectId,
  currentRevision,
  reason,
  revisedBy,
  pdfBuffer,
  filename,
}) {
  const supersededRevision = Number(currentRevision) || 0;
  const revisionNumber = supersededRevision + 1;
  const id = new mongoose.Types.ObjectId();
  const pdfFilename = safePdfFilename(
    filename,
    `${reportType}-revision-${supersededRevision}.pdf`
  );
  const relativeDir = path.join('revisions', String(reportType), String(reportId));
  const pdfRelativePath = path.join(relativeDir, `${id}.pdf`).replace(/\\/g, '/');
  const fullDir = path.join(GENERATED_PDF_DIR, relativeDir);

  try {
    fs.mkdirSync(fullDir, { recursive: true });
    fs.writeFileSync(path.join(GENERATED_PDF_DIR, pdfRelativePath), pdfBuffer);
  } catch (err) {
    console.error('Failed to write revision PDF:', err);
    throw rejection(
      500,
      'PDF_STORE_FAILED',
      `The PDF was generated but could not be stored, so the revision was not saved. ${unchangedSentence()}`,
      'The server could not save the revision file.'
    );
  }

  try {
    return await ReportRevision.create({
      _id: id,
      reportType,
      reportId,
      reportKey: reportKey || reportType,
      projectId: projectId || undefined,
      revisionNumber,
      supersededRevision,
      reason,
      revisedBy,
      revisedAt: new Date(),
      pdfFilename,
      pdfRelativePath,
      pdfSize: pdfBuffer.length,
    });
  } catch (err) {
    try {
      fs.unlinkSync(path.join(GENERATED_PDF_DIR, pdfRelativePath));
    } catch (unlinkErr) {
      console.error('Failed to remove revision PDF after save error:', unlinkErr);
    }
    console.error('Failed to record revision:', err);
    throw rejection(
      500,
      'PDF_STORE_FAILED',
      `The PDF was generated but could not be stored, so the revision was not saved. ${unchangedSentence()}`,
      'The server could not save the revision record.'
    );
  }
}

async function rollbackArchive(record) {
  if (!record) return;
  const relative = record.pdfRelativePath;
  if (relative) {
    try {
      const fullPath = path.join(GENERATED_PDF_DIR, relative);
      if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
    } catch (err) {
      console.error('Failed to delete revision PDF during rollback:', err);
    }
  }
  try {
    await ReportRevision.deleteOne({ _id: record._id });
  } catch (err) {
    console.error('Failed to delete revision record during rollback:', err);
  }
}

function sendRevisionError(res, err) {
  const status = err.status && Number(err.status) >= 400 && Number(err.status) < 600
    ? Number(err.status)
    : 500;
  const code = err.code || (status >= 500 ? 'REVISION_FAILED' : 'REVISION_REJECTED');
  if (status >= 500) {
    console.error('Report revision failed:', err);
  }
  const message = err.publicMessage
    || `The revision could not be completed. ${unchangedSentence()}`;
  return res.status(status).json({
    message,
    code,
    detail: err.publicDetail || null,
    unchanged: true,
  });
}

function escapeHtml(value) {
  if (value == null) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function personName(user) {
  const name = [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim();
  return name || user?.email || 'A user';
}

async function notifyEmployeeRevision({
  user,
  projectId,
  reportLabel,
  revisionNumber,
  reason,
}) {
  if (user?.role !== 'employee') return null;
  try {
    const admins = await User.find({
      role: { $in: ['admin', 'super_admin'] },
      isActive: { $ne: false },
      email: { $exists: true, $nin: [null, ''] },
    })
      .select('email')
      .lean();
    const emails = [...new Set(admins.map((admin) => String(admin.email || '').trim()).filter(Boolean))];
    if (emails.length === 0) {
      console.error('Revision notification skipped: no admin email addresses');
      return 'The revision was saved, but no admin email address is on file, so nobody was notified. Contact tech support if an admin should have been told.';
    }

    const project = projectId
      ? await Project.findById(projectId).select('name projectID').lean()
      : null;
    const projectName = project?.name || 'Unknown project';
    const projectCode = project?.projectID || 'N/A';
    const label = reportLabel || 'Report';
    const viewUrl = projectId
      ? `${getFrontendUrl()}/reports/project/${projectId}`
      : `${getFrontendUrl()}/projects`;
    const reviser = personName(user);
    const subject = `Report revised - ${projectCode}: ${label}`;
    const text = `${reviser} revised a report.

Project: ${projectName} (${projectCode})
Report: ${label}
New revision: ${revisionNumber}
Reason: ${reason}

View project reports: ${viewUrl}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
        <h1 style="color: ${BRAND_GREEN}; font-size: 24px; margin: 0 0 20px;">L&D Consulting App</h1>
        <h2 style="color: ${BRAND_GREEN}; margin-bottom: 12px;">Report revised</h2>
        <p>${escapeHtml(reviser)} revised a report.</p>
        <div style="background-color: #f5f5f5; padding: 15px; border-radius: 4px; margin: 20px 0;">
          <p style="margin: 5px 0;"><strong>Project:</strong> ${escapeHtml(projectName)} (${escapeHtml(projectCode)})</p>
          <p style="margin: 5px 0;"><strong>Report:</strong> ${escapeHtml(label)}</p>
          <p style="margin: 5px 0;"><strong>New revision:</strong> ${escapeHtml(revisionNumber)}</p>
          <p style="margin: 5px 0;"><strong>Reason:</strong> ${escapeHtml(reason)}</p>
        </div>
        <p><a href="${escapeHtml(viewUrl)}">View project reports</a></p>
      </div>`;

    await sendMail({
      to: emails.join(', '),
      subject,
      text,
      html,
    });
    return null;
  } catch (err) {
    console.error('Revision notification email failed:', err);
    return 'The revision was saved, but the email to admins could not be sent. Contact tech support if this keeps happening.';
  }
}

function mapEntry(entry, legacy) {
  const revisedBy = entry.revisedBy;
  const revisedByName = revisedBy && typeof revisedBy === 'object'
    ? personName(revisedBy)
    : '';
  return {
    id: entry._id,
    revisionNumber: entry.revisionNumber,
    supersededRevision: entry.supersededRevision,
    reason: entry.reason,
    revisedByName,
    revisedAt: entry.revisedAt,
    hasPdf: !legacy && Boolean(entry.pdfRelativePath),
    legacy: Boolean(legacy),
    pdfFilename: legacy ? null : entry.pdfFilename,
  };
}

async function loadLegacyReasons(reportType, reportId) {
  let doc = null;
  if (reportType === 'clearance' || reportType === 'enclosure_certificate') {
    doc = await AsbestosClearance.findById(reportId)
      .select('revisionReasons')
      .populate('revisionReasons.revisedBy', 'firstName lastName')
      .lean();
  } else if (reportType === 'lead_clearance') {
    doc = await LeadClearance.findById(reportId)
      .select('revisionReasons')
      .populate('revisionReasons.revisedBy', 'firstName lastName')
      .lean();
  }
  if (!doc?.revisionReasons?.length) return [];
  return doc.revisionReasons.map((row) => mapEntry({
    _id: row._id,
    revisionNumber: row.revisionNumber,
    supersededRevision: Math.max(0, (Number(row.revisionNumber) || 1) - 1),
    reason: row.reason,
    revisedBy: row.revisedBy,
    revisedAt: row.revisedAt,
  }, true));
}

async function listHistory({ reportType, reportId, reportKey }) {
  const key = reportKey || reportType;
  const stored = await ReportRevision.find({
    reportType,
    reportId,
    reportKey: key,
  })
    .populate('revisedBy', 'firstName lastName')
    .sort({ revisionNumber: 1 })
    .lean();
  const entries = stored.map((entry) => mapEntry(entry, false));
  const seen = new Set(entries.map((entry) => entry.revisionNumber));
  const legacy = await loadLegacyReasons(reportType, reportId);
  legacy.forEach((row) => {
    if (!seen.has(row.revisionNumber)) entries.push(row);
  });
  entries.sort((a, b) => a.revisionNumber - b.revisionNumber);
  return entries;
}

async function streamRevisionPdf(id, res) {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(404).json({ message: 'Revision PDF not found' });
  }
  const record = await ReportRevision.findById(id).lean();
  if (!record?.pdfRelativePath) {
    return res.status(404).json({ message: 'No PDF was retained for this revision' });
  }
  const root = path.resolve(GENERATED_PDF_DIR);
  const fullPath = path.resolve(GENERATED_PDF_DIR, record.pdfRelativePath);
  const rootPrefix = root.endsWith(path.sep) ? root : `${root}${path.sep}`;
  if (!fullPath.startsWith(rootPrefix) || !fs.existsSync(fullPath)) {
    console.error('Revision PDF file missing:', fullPath);
    return res.status(404).json({
      message: 'The retained PDF could not be found. Contact tech support.',
      code: 'PDF_FILE_MISSING',
    });
  }
  const filename = record.pdfFilename || 'revision.pdf';
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', buildContentDispositionAttachment(filename));
  return res.sendFile(fullPath, (err) => {
    if (!err || res.headersSent) return;
    console.error('Failed to send revision PDF:', err);
    res.status(500).json({
      message: 'The retained PDF could not be downloaded. Contact tech support.',
      code: 'PDF_FILE_MISSING',
    });
  });
}

module.exports = {
  REPORT_LABELS,
  isAdminRole,
  readRevisionRequest,
  archiveSupersededPdf,
  rollbackArchive,
  sendRevisionError,
  notifyEmployeeRevision,
  listHistory,
  streamRevisionPdf,
};
