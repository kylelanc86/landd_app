const ClientSuppliedJob = require('../models/ClientSuppliedJob');

function hasClientSuppliedReportApproval(doc) {
  const v = doc?.reportApprovedBy;
  return v != null && String(v).trim() !== '';
}

function isReportableClientSuppliedJob(doc) {
  return doc?.status === 'Completed' || hasClientSuppliedReportApproval(doc);
}

function stuckAfterReviseMatch(projectId) {
  const query = {
    archived: true,
    status: { $ne: 'Completed' },
    $or: [
      { reportApprovedBy: { $exists: false } },
      { reportApprovedBy: null },
      { reportApprovedBy: '' },
    ],
  };
  if (projectId) query.projectId = projectId;
  return query;
}

/**
 * Jobs revised after close can be left archived + Analysis Complete with no approval.
 * Put them back on the Fibre ID jobs list so they can be re-authorised.
 */
async function unarchiveClientSuppliedJobsStuckAfterRevise(projectId) {
  const query = stuckAfterReviseMatch(projectId);
  const stuck = await ClientSuppliedJob.find(query).select('_id projectId').lean();
  if (stuck.length === 0) {
    return { count: 0, projectIds: [] };
  }

  await ClientSuppliedJob.updateMany(
    { _id: { $in: stuck.map((job) => job._id) } },
    {
      $set: { archived: false, updatedAt: new Date() },
      $unset: { archivedAt: 1 },
    },
  );

  const projectIds = [
    ...new Set(stuck.map((job) => String(job.projectId || '')).filter(Boolean)),
  ];

  return { count: stuck.length, projectIds };
}

module.exports = {
  hasClientSuppliedReportApproval,
  isReportableClientSuppliedJob,
  unarchiveClientSuppliedJobsStuckAfterRevise,
};
