const {
  invalidateReportCategories,
} = require('../services/projectReportCategoriesService');
const AsbestosRemovalJob = require('../models/AsbestosRemovalJob');
const LeadRemovalJob = require('../models/LeadRemovalJob');

function hasNonEmptyApproval(value) {
  return value != null && String(value).trim() !== '';
}

const notDeletedShiftFilter = {
  $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
};

const reportableShiftApprovalMatch = {
  reportApprovedBy: { $exists: true, $nin: [null, ''] },
};

function reportableShiftFindFilter(statuses) {
  return {
    $and: [
      notDeletedShiftFilter,
      {
        $or: [
          { status: { $in: statuses } },
          reportableShiftApprovalMatch,
        ],
      },
    ],
  };
}

function reportableShiftLookupMatch(statuses) {
  return {
    $and: [
      notDeletedShiftFilter,
      {
        $or: [
          { status: { $in: statuses } },
          reportableShiftApprovalMatch,
        ],
      },
    ],
  };
}

async function reopenRemovalJob({ jobId, jobModel, projectId }) {
  const isLead = jobModel === 'LeadRemovalJob';
  const Model = isLead ? LeadRemovalJob : AsbestosRemovalJob;
  let job = null;

  if (jobId) {
    job = await Model.findById(jobId);
  } else if (projectId) {
    const candidates = await Model.find({
      projectId,
      status: { $in: ['completed', 'archived'] },
    })
      .select('_id')
      .limit(2)
      .lean();
    if (candidates.length === 1) {
      job = await Model.findById(candidates[0]._id);
    }
  }

  if (!job) return null;
  if (job.status === 'completed' || job.status === 'archived') {
    job.status = 'in_progress';
    await job.save();
  }
  return job;
}

async function invalidateProjectReportCategories(projectId) {
  if (!projectId) return;
  try {
    await invalidateReportCategories(projectId._id || projectId);
  } catch (err) {
    console.error('Error invalidating report categories:', err);
  }
}

module.exports = {
  hasNonEmptyApproval,
  notDeletedShiftFilter,
  reportableShiftApprovalMatch,
  reportableShiftFindFilter,
  reportableShiftLookupMatch,
  reopenRemovalJob,
  invalidateProjectReportCategories,
};
