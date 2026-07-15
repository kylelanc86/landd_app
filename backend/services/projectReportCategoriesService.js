const mongoose = require('mongoose');
const Project = require('../models/Project');
const AsbestosRemovalJob = require('../models/AsbestosRemovalJob');
const AsbestosAssessment = require('../models/assessmentTemplates/asbestos/AsbestosAssessment');

const REPORT_CATEGORIES = {
  ASBESTOS_ASSESSMENT: 'asbestos-assessment',
  ASBESTOS_REMOVAL: 'asbestos-removal-jobs',
  LEAD_REMOVAL: 'lead-removal-jobs',
  FIBRE_ID: 'fibre-id',
  FIBRE_COUNT: 'fibre-count',
};

const notDeleted = {
  $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
};

const notDeletedClearanceFilter = {
  $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
};

const completedClientSuppliedJobFilter = {
  $or: [
    { status: 'Completed' },
    { reportApprovedBy: { $exists: true, $nin: [null, ''] } },
  ],
};

const reportableAsbestosShiftMatch = {
  $or: [
    { status: { $in: ['analysis_complete', 'shift_complete', 'complete'] } },
    { reportApprovedBy: { $exists: true, $ne: null } },
  ],
};

const reportableLeadShiftMatch = {
  jobModel: 'LeadRemovalJob',
  $and: [
    notDeleted,
    {
      $or: [
        { status: { $in: ['analysis_complete', 'shift_complete'] } },
        { reportApprovedBy: { $exists: true, $ne: null } },
      ],
    },
  ],
};

function toObjectId(projectId) {
  if (!projectId) return null;
  if (projectId instanceof mongoose.Types.ObjectId) return projectId;
  const id = projectId._id || projectId;
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  return new mongoose.Types.ObjectId(id);
}

function hasJobWithReportableShift(JobModel, projectObjectId, shiftMatch) {
  return JobModel.aggregate([
    { $match: { projectId: projectObjectId } },
    {
      $lookup: {
        from: 'air_monitoring_shifts',
        localField: '_id',
        foreignField: 'job',
        pipeline: [
          { $match: shiftMatch },
          { $limit: 1 },
          { $project: { _id: 1 } },
        ],
        as: 'hits',
      },
    },
    { $match: { 'hits.0': { $exists: true } } },
    { $limit: 1 },
    { $project: { _id: 1 } },
  ]).then((rows) => rows.length > 0);
}

/**
 * Full existence scan for a project (used for lazy fill only).
 */
async function computeReportCategories(projectId) {
  const projectObjectId = toObjectId(projectId);
  if (!projectObjectId) return [];

  const AsbestosClearance = require('../models/clearanceTemplates/asbestos/AsbestosClearance');
  const LeadClearance = require('../models/clearanceTemplates/lead/LeadClearance');
  const ClientSuppliedJob = require('../models/ClientSuppliedJob');
  const LeadRemovalJob = require('../models/LeadRemovalJob');

  let UploadedReport = null;
  try {
    UploadedReport = mongoose.model('UploadedReport');
  } catch (_) {
    UploadedReport = null;
  }

  const [
    hasAsbestosAssessment,
    hasAsbestosClearance,
    hasAsbestosAirMonitoring,
    hasLeadClearance,
    hasLeadMonitoring,
    fibreJobs,
    uploadedTypes,
  ] = await Promise.all([
    AsbestosAssessment.exists({
      projectId: projectObjectId,
      $and: [
        notDeleted,
        {
          $or: [
            { jobType: { $in: ['asbestos-assessment', 'residential-asbestos'] } },
            { jobType: { $exists: false } },
            { jobType: null },
            { jobType: '' },
          ],
        },
        { reportAuthorisedBy: { $exists: true, $nin: [null, ''] } },
      ],
    }),
    AsbestosClearance.exists({
      projectId: projectObjectId,
      status: { $in: ['complete', 'Site Work Complete'] },
      ...notDeletedClearanceFilter,
    }),
    hasJobWithReportableShift(
      AsbestosRemovalJob,
      projectObjectId,
      reportableAsbestosShiftMatch,
    ),
    LeadClearance.exists({
      projectId: projectObjectId,
      status: { $in: ['complete', 'Site Work Complete'] },
    }),
    hasJobWithReportableShift(
      LeadRemovalJob,
      projectObjectId,
      reportableLeadShiftMatch,
    ),
    ClientSuppliedJob.aggregate([
      {
        $match: {
          projectId: projectObjectId,
          jobType: { $in: ['Fibre ID', 'Fibre Count'] },
          ...completedClientSuppliedJobFilter,
        },
      },
      { $group: { _id: '$jobType' } },
    ]),
    UploadedReport
      ? UploadedReport.distinct('reportType', { projectId: projectObjectId })
      : Promise.resolve([]),
  ]);

  const fibreTypes = new Set((fibreJobs || []).map((row) => row._id));
  const categories = [];

  if (hasAsbestosAssessment) categories.push(REPORT_CATEGORIES.ASBESTOS_ASSESSMENT);
  if (hasAsbestosAirMonitoring || hasAsbestosClearance) {
    categories.push(REPORT_CATEGORIES.ASBESTOS_REMOVAL);
  }
  if (hasLeadMonitoring || hasLeadClearance) {
    categories.push(REPORT_CATEGORIES.LEAD_REMOVAL);
  }
  if (fibreTypes.has('Fibre ID')) categories.push(REPORT_CATEGORIES.FIBRE_ID);
  if (fibreTypes.has('Fibre Count')) categories.push(REPORT_CATEGORIES.FIBRE_COUNT);

  (uploadedTypes || []).forEach((type) => {
    if (type && !categories.includes(type)) {
      categories.push(type);
    }
  });

  return categories;
}

/**
 * Fast path when cached; otherwise compute once, persist, return.
 */
async function getReportCategories(projectId) {
  const projectObjectId = toObjectId(projectId);
  if (!projectObjectId) {
    throw new Error('Invalid project ID');
  }

  const project = await Project.findById(projectObjectId)
    .select('reportCategories reportCategoriesCachedAt')
    .lean();

  if (!project) {
    throw new Error('Project not found');
  }

  if (project.reportCategoriesCachedAt) {
    return Array.isArray(project.reportCategories) ? project.reportCategories : [];
  }

  const categories = await computeReportCategories(projectObjectId);

  await Project.findByIdAndUpdate(projectObjectId, {
    $set: {
      reportCategories: categories,
      reportCategoriesCachedAt: new Date(),
      ...(categories.length > 0 ? { reports_present: true } : {}),
    },
  });

  return categories;
}

/**
 * Add categories to the cache if it already exists.
 * If not cached yet, skip — next GET will compute the full set.
 */
async function addReportCategories(projectId, categories) {
  const projectObjectId = toObjectId(projectId);
  const list = (Array.isArray(categories) ? categories : [categories]).filter(Boolean);
  if (!projectObjectId || list.length === 0) return;

  try {
    const project = await Project.findById(projectObjectId)
      .select('reportCategoriesCachedAt')
      .lean();
    if (!project?.reportCategoriesCachedAt) return;

    await Project.findByIdAndUpdate(projectObjectId, {
      $addToSet: { reportCategories: { $each: list } },
      $set: { reports_present: true },
    });
  } catch (err) {
    console.error('Error adding report categories:', err);
  }
}

/**
 * Force next GET to recompute (e.g. after deleting uploaded reports).
 */
async function invalidateReportCategories(projectId) {
  const projectObjectId = toObjectId(projectId);
  if (!projectObjectId) return;

  try {
    await Project.findByIdAndUpdate(projectObjectId, {
      $unset: { reportCategoriesCachedAt: 1 },
    });
  } catch (err) {
    console.error('Error invalidating report categories:', err);
  }
}

module.exports = {
  REPORT_CATEGORIES,
  computeReportCategories,
  getReportCategories,
  addReportCategories,
  invalidateReportCategories,
};
