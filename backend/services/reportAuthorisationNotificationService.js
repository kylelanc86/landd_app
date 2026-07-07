const User = require("../models/User");
const Project = require("../models/Project");
const Client = require("../models/Client");
const Shift = require("../models/Shift");
const LeadRemovalJob = require("../models/LeadRemovalJob");
const AsbestosRemovalJob = require("../models/AsbestosRemovalJob");
const { sendMail } = require("./mailer");
const { formatDateSydney } = require("../utils/dateUtils");

const BRAND_GREEN = "rgb(25, 138, 44)";

function getFrontendUrl() {
  return process.env.FRONTEND_URL || "http://localhost:3000";
}

function escapeHtml(value) {
  if (value == null) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildRemovalJobDetailsUrl(jobModel, jobId) {
  if (!jobId) return `${getFrontendUrl()}/projects`;
  const segment =
    jobModel === "LeadRemovalJob" ? "lead-removal" : "asbestos-removal";
  return `${getFrontendUrl()}/${segment}/jobs/${jobId}/details`;
}

function buildReportAuthorisedEmailContent({
  reportTypeLabel,
  subjectIdentifier,
  details,
  viewUrl,
  approverName,
  requesterFirstName,
}) {
  const intro = `The ${reportTypeLabel} report you requested for authorisation has been authorised.`;
  const subject = `Report Authorised - ${subjectIdentifier}: ${reportTypeLabel}`;

  const detailLinesText = (details || [])
    .map((row) => `${row.label}: ${row.value}`)
    .join("\n");

  const detailLinesHtml = (details || [])
    .map(
      (row) =>
        `<p style="margin: 5px 0;"><strong>${escapeHtml(row.label)}:</strong> ${escapeHtml(row.value)}</p>`,
    )
    .join("");

  const greetingName = requesterFirstName
    ? escapeHtml(requesterFirstName)
    : "there";

  const text = `${intro}

${detailLinesText}
Authorised by: ${approverName}

View the report at: ${viewUrl}`;

  return {
    subject,
    text,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
        <div style="margin-bottom: 30px;">
          <h1 style="color: ${BRAND_GREEN}; font-size: 24px; margin: 0; padding: 0;">L&D Consulting App</h1>
        </div>
        <div style="color: #333; line-height: 1.6;">
          <h2 style="color: ${BRAND_GREEN}; margin-bottom: 20px;">Report Authorised</h2>
          <p>Hello ${greetingName},</p>
          <p>The ${escapeHtml(reportTypeLabel)} report you requested for authorisation has been authorised:</p>
          <div style="background-color: #f5f5f5; padding: 15px; border-radius: 4px; margin: 20px 0;">
            ${detailLinesHtml}
            <p style="margin: 5px 0;"><strong>Authorised by:</strong> ${escapeHtml(approverName)}</p>
          </div>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${escapeHtml(viewUrl)}" style="background-color: ${BRAND_GREEN}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">View Report</a>
          </div>
          <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">
          <p style="color: #666; font-size: 12px;">This is an automated message, please do not reply to this email.</p>
        </div>
      </div>
    `,
  };
}

/**
 * Send standardised "report authorised" email when a report is newly authorised.
 */
async function notifyAuthorisationRequesterOnApproval({
  authorisationRequestedBy,
  wasAlreadyAuthorised,
  isNowAuthorised,
  approverName,
  reportTypeLabel,
  subjectIdentifier,
  details,
  viewUrl,
}) {
  if (wasAlreadyAuthorised || !isNowAuthorised || !authorisationRequestedBy) {
    return { sent: false };
  }

  try {
    const requester = await User.findById(authorisationRequestedBy).select(
      "firstName lastName email",
    );
    if (!requester?.email) {
      return { sent: false, reason: "no_requester_email" };
    }

    const { subject, text, html } = buildReportAuthorisedEmailContent({
      reportTypeLabel,
      subjectIdentifier,
      details,
      viewUrl,
      approverName,
      requesterFirstName: requester.firstName,
    });

    await sendMail({ to: requester.email, subject, text, html });
    return { sent: true };
  } catch (error) {
    console.error("Error sending authorisation notification email:", error);
    return { sent: false, error };
  }
}

async function resolveShiftProjectContext(shiftId) {
  const populatedShift = await Shift.findById(shiftId).populate({
    path: "job",
    populate: {
      path: "projectId",
      select: "projectID name client",
      populate: { path: "client", select: "name" },
    },
  });

  if (!populatedShift) return null;

  let projectName =
    populatedShift.job?.projectId?.name ||
    populatedShift.job?.projectName ||
    "Unknown Project";
  let projectID =
    populatedShift.job?.projectId?.projectID ||
    populatedShift.job?.jobID ||
    "N/A";
  let clientName =
    populatedShift.job?.projectId?.client?.name ||
    populatedShift.job?.client ||
    "the client";

  if (
    populatedShift.job?.projectId &&
    typeof populatedShift.job.projectId === "string"
  ) {
    const projectDoc = await Project.findById(
      populatedShift.job.projectId,
    ).populate("client", "name");
    if (projectDoc) {
      projectName = projectDoc.name || projectName;
      projectID = projectDoc.projectID || projectID;
      clientName = projectDoc.client?.name || clientName;
    }
  } else if (
    populatedShift.job?.projectId?.client &&
    typeof populatedShift.job.projectId.client === "string"
  ) {
    const clientDoc = await Client.findById(
      populatedShift.job.projectId.client,
    ).select("name");
    if (clientDoc) {
      clientName = clientDoc.name || clientName;
    }
  }

  const jobModel = populatedShift.jobModel || "AsbestosRemovalJob";
  const jobId =
    typeof populatedShift.job?.id === "string"
      ? populatedShift.job.id
      : populatedShift.job?._id?.toString() ||
        populatedShift.job?.toString();

  return {
    shift: populatedShift,
    projectName,
    projectID,
    clientName,
    jobModel,
    jobId,
    shiftName: populatedShift.name || "Air Monitoring Shift",
    shiftDate: populatedShift.date
      ? formatDateSydney(populatedShift.date)
      : "N/A",
    viewUrl: buildRemovalJobDetailsUrl(jobModel, jobId),
    reportTypeLabel:
      jobModel === "LeadRemovalJob"
        ? "Lead air monitoring shift"
        : "Air monitoring shift",
  };
}

async function notifyShiftAuthorisationRequesterOnApproval(shiftBefore, shiftAfter) {
  const wasAlreadyAuthorised = Boolean(shiftBefore?.reportApprovedBy);
  const isNowAuthorised = Boolean(shiftAfter?.reportApprovedBy);
  const context = await resolveShiftProjectContext(shiftAfter._id);
  if (!context) return { sent: false };

  return notifyAuthorisationRequesterOnApproval({
    authorisationRequestedBy: shiftAfter.authorisationRequestedBy,
    wasAlreadyAuthorised,
    isNowAuthorised,
    approverName: shiftAfter.reportApprovedBy,
    reportTypeLabel: context.reportTypeLabel,
    subjectIdentifier: context.projectID,
    details: [
      { label: "Project", value: `${context.projectName} (${context.projectID})` },
      { label: "Client", value: context.clientName },
      { label: "Shift", value: context.shiftName },
      { label: "Shift date", value: context.shiftDate },
    ],
    viewUrl: context.viewUrl,
  });
}

async function resolveAsbestosClearanceJobUrl(clearance) {
  const frontendUrl = getFrontendUrl();
  if (clearance.asbestosRemovalJobId) {
    return buildRemovalJobDetailsUrl(
      "AsbestosRemovalJob",
      clearance.asbestosRemovalJobId.toString(),
    );
  }

  const projectId =
    clearance.projectId?._id?.toString() || clearance.projectId?.toString();
  if (!projectId) return `${frontendUrl}/projects`;

  const jobs = await AsbestosRemovalJob.find({
    projectId,
    $or: [
      { clearance: true },
      { jobType: { $in: ["clearance", "air_monitoring_and_clearance"] } },
    ],
  })
    .select("_id asbestosRemovalist createdAt")
    .sort({ createdAt: -1 })
    .lean();

  let jobId = null;
  if (jobs.length === 1) {
    jobId = jobs[0]._id.toString();
  } else if (jobs.length > 1) {
    const matchingJob = jobs.find(
      (job) => job.asbestosRemovalist === clearance.asbestosRemovalist,
    );
    jobId = matchingJob ? matchingJob._id.toString() : jobs[0]._id.toString();
  } else {
    const anyJob = await AsbestosRemovalJob.findOne({ projectId })
      .select("_id")
      .sort({ createdAt: -1 })
      .lean();
    jobId = anyJob?._id?.toString();
  }

  return buildRemovalJobDetailsUrl("AsbestosRemovalJob", jobId);
}

async function resolveLeadClearanceJobUrl(clearance) {
  let jobId = clearance.leadRemovalJobId
    ? clearance.leadRemovalJobId.toString()
    : null;
  if (!jobId && clearance.projectId) {
    const projectId =
      clearance.projectId._id?.toString() || clearance.projectId?.toString();
    const job = await LeadRemovalJob.findOne({ projectId })
      .select("_id")
      .sort({ createdAt: -1 })
      .lean();
    jobId = job?._id?.toString();
  }
  return buildRemovalJobDetailsUrl("LeadRemovalJob", jobId);
}

async function notifyClearanceAuthorisationRequesterOnApproval({
  clearance,
  wasAlreadyAuthorised,
  approverName,
  reportTypeLabel,
  resolveJobUrl,
  authorisationRequestedByField = "authorisationRequestedBy",
  authorisationRequestedByEmailField = "authorisationRequestedByEmail",
  isAuthorisedField = "reportApprovedBy",
}) {
  const projectName = clearance.projectId?.name || "Unknown Project";
  const projectID = clearance.projectId?.projectID || "N/A";
  const clientName = clearance.projectId?.client?.name || "the client";
  const clearanceDate = clearance.clearanceDate
    ? formatDateSydney(clearance.clearanceDate)
    : "N/A";
  const clearanceType =
    clearance.clearanceType || reportTypeLabel.replace(/ report$/i, "");

  let viewUrl = await resolveJobUrl(clearance);
  if (authorisationRequestedByField === "enclosureCertificateAuthorisationRequestedBy") {
    const jobId = clearance.asbestosRemovalJobId?.toString();
    if (jobId) {
      viewUrl = `${getFrontendUrl()}/asbestos-removal/jobs/${jobId}/details?tab=enclosure`;
    }
  }

  return notifyAuthorisationRequesterOnApproval({
    authorisationRequestedBy: clearance[authorisationRequestedByField],
    wasAlreadyAuthorised,
    isNowAuthorised: Boolean(clearance[isAuthorisedField]),
    approverName,
    reportTypeLabel,
    subjectIdentifier: projectID,
    details: [
      { label: "Project", value: `${projectName} (${projectID})` },
      { label: "Client", value: clientName },
      { label: "Clearance type", value: clearanceType },
      { label: "Clearance date", value: clearanceDate },
    ],
    viewUrl,
  });
}

module.exports = {
  buildReportAuthorisedEmailContent,
  notifyAuthorisationRequesterOnApproval,
  notifyShiftAuthorisationRequesterOnApproval,
  notifyClearanceAuthorisationRequesterOnApproval,
  resolveAsbestosClearanceJobUrl,
  resolveLeadClearanceJobUrl,
  buildRemovalJobDetailsUrl,
  getFrontendUrl,
};
