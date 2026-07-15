const express = require('express');
const router = express.Router();
const MycometerJob = require('../models/MycometerJob');
const {
  SAMPLE_TYPES,
  CLEANING_STAGES,
  YES_NO_OPTIONS,
  TURNAROUND_OPTIONS,
} = require('../models/MycometerJob');
const User = require('../models/User');
const { sendMail } = require('../services/mailer');
const {
  notifyAuthorisationRequesterOnApproval,
  getFrontendUrl,
} = require('../services/reportAuthorisationNotificationService');
const {
  buildMycometerSurfaceFungiFilename,
  buildMycometerAirFungiFilename,
  buildMycometerAirAllergenFilename,
  toReportReference,
} = require('../utils/reportFilenames');
const auth = require('../middleware/auth');
const checkPermission = require('../middleware/checkPermission');

const populateJob = [
  {
    path: 'projectId',
    select: 'projectID name client projectContact',
    populate: {
      path: 'client',
      select:
        'name contact1Name contact1Email contact2Email invoiceEmail',
    },
  },
  {
    path: 'samplingMeta.sampledBy',
    select: 'firstName lastName email licences',
  },
  {
    path: 'analysisMeta.analyst',
    select: 'firstName lastName email licences',
  },
  {
    path: 'analysisMeta.authorisationRequestedBy',
    select: 'firstName lastName email',
  },
];

function sanitizeScopeOfWorks(scopeOfWorks) {
  if (!Array.isArray(scopeOfWorks)) return [];
  return [
    ...new Set(scopeOfWorks.filter((type) => SAMPLE_TYPES.includes(type))),
  ];
}

function toOptionalNumber(value) {
  if (value === '' || value === null || value === undefined) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function sanitizeSamples(samples, existingSamples = []) {
  if (!Array.isArray(samples)) return [];
  return samples
    .filter((sample) => SAMPLE_TYPES.includes(sample?.sampleType))
    .map((sample) => {
      const existing =
        existingSamples.find(
          (item) =>
            (sample._id && String(item._id) === String(sample._id)) ||
            (sample.sampleId && item.sampleId === sample.sampleId)
        ) || {};

      return {
        _id: sample._id || existing._id,
        sampleType: sample.sampleType,
        sampleId:
          typeof sample.sampleId === 'string' ? sample.sampleId.trim() : '',
        sampleLocation:
          typeof sample.sampleLocation === 'string'
            ? sample.sampleLocation.trim()
            : '',
        cleaningStage: CLEANING_STAGES.includes(sample.cleaningStage)
          ? sample.cleaningStage
          : undefined,
        flowRate:
          sample.flowRate !== undefined
            ? toOptionalNumber(sample.flowRate)
            : existing.flowRate,
        qualityControl:
          sample.sampleType === 'Air Allergen'
            ? undefined
            : YES_NO_OPTIONS.includes(sample.qualityControl)
              ? sample.qualityControl
              : existing.qualityControl,
        blankValue:
          sample.blankValue !== undefined
            ? toOptionalNumber(sample.blankValue)
            : existing.blankValue,
        analysisValue:
          sample.analysisValue !== undefined
            ? toOptionalNumber(sample.analysisValue)
            : existing.analysisValue,
      };
    });
}

function findAnalysisMeta(job, sampleType) {
  return (job.analysisMeta || []).find((meta) => meta.sampleType === sampleType);
}

function findSamplingMeta(job, sampleType) {
  return (job.samplingMeta || []).find((meta) => meta.sampleType === sampleType);
}

function formatUserDisplayName(user) {
  if (!user) return '';
  return (
    `${user.firstName || ''} ${user.lastName || ''}`.trim() ||
    user.email ||
    ''
  );
}

function getMycometerCertFromUser(user, sampleType) {
  if (!user) return '';
  const licence = (user.licences || []).find(
    (item) => item.licenceType === 'Mycometer Certification'
  );
  if (!licence) return '';
  const cert =
    sampleType === 'Surface Fungi' ? licence.surface : licence.air;
  return typeof cert === 'string' ? cert.trim() : '';
}

/**
 * Resolve sampler/analyst display fields from the current user record.
 * If the user no longer exists, keep any existing snapshot on the job.
 */
async function resolvePersonSnapshot(userId, sampleType, existing = {}) {
  const previousId = existing.userId;
  const previousName = existing.name || '';
  const previousCert = existing.certification || '';

  if (!userId) {
    return { userId: undefined, name: undefined, certification: undefined };
  }

  const user = await User.findById(userId)
    .select('firstName lastName email licences')
    .lean();

  if (user) {
    return {
      userId,
      name: formatUserDisplayName(user),
      certification:
        getMycometerCertFromUser(user, sampleType) ||
        previousCert ||
        'MSF-3176-AU',
    };
  }

  // User removed — retain prior snapshot when the same person is still on the job
  if (String(previousId || '') === String(userId) && previousName) {
    return {
      userId,
      name: previousName,
      certification: previousCert || 'MSF-3176-AU',
    };
  }

  return {
    userId,
    name: previousName || 'Unknown user',
    certification: previousCert || 'MSF-3176-AU',
  };
}

function upsertSamplingMeta(job, sampleType, updates) {
  const existing = findSamplingMeta(job, sampleType) || { sampleType };
  const nextMeta = {
    sampleType,
    sampledBy:
      updates.sampledBy !== undefined
        ? updates.sampledBy || undefined
        : existing.sampledBy,
    sampledByName:
      updates.sampledByName !== undefined
        ? updates.sampledByName || undefined
        : existing.sampledByName,
    mycometerCertificationNumber:
      updates.mycometerCertificationNumber !== undefined
        ? updates.mycometerCertificationNumber || undefined
        : existing.mycometerCertificationNumber,
    sampleDate:
      updates.sampleDate !== undefined
        ? updates.sampleDate
          ? new Date(updates.sampleDate)
          : undefined
        : existing.sampleDate,
    samplingComplete:
      updates.samplingComplete !== undefined
        ? Boolean(updates.samplingComplete)
        : Boolean(existing.samplingComplete),
    turnaroundTime:
      updates.turnaroundTime !== undefined
        ? updates.turnaroundTime
        : existing.turnaroundTime,
    analysisDueDate:
      updates.analysisDueDate !== undefined
        ? updates.analysisDueDate
          ? new Date(updates.analysisDueDate)
          : undefined
        : existing.analysisDueDate,
    flowmeter:
      updates.flowmeter !== undefined
        ? typeof updates.flowmeter === 'string'
          ? updates.flowmeter.trim() || undefined
          : updates.flowmeter || undefined
        : existing.flowmeter,
  };

  job.samplingMeta = [
    ...(job.samplingMeta || []).filter((meta) => meta.sampleType !== sampleType),
    nextMeta,
  ];
  return nextMeta;
}

function upsertAnalysisMeta(job, sampleType, updates) {
  const existing =
    (job.analysisMeta || []).find((meta) => meta.sampleType === sampleType) || {
      sampleType,
      mycometerCertificationNumber: 'MSF-3176-AU',
      standardValue: 535,
    };

  const nextMeta = {
    sampleType,
    analyst:
      updates.analyst !== undefined
        ? updates.analyst || undefined
        : existing.analyst,
    analystName:
      updates.analystName !== undefined
        ? updates.analystName || undefined
        : existing.analystName,
    analysisDate:
      updates.analysisDate !== undefined
        ? updates.analysisDate
          ? new Date(updates.analysisDate)
          : undefined
        : existing.analysisDate,
    mycometerCertificationNumber:
      updates.mycometerCertificationNumber !== undefined
        ? updates.mycometerCertificationNumber
        : existing.mycometerCertificationNumber || 'MSF-3176-AU',
    standardValue:
      updates.standardValue !== undefined
        ? updates.standardValue
        : existing.standardValue ?? 535,
    measuredStandardValue:
      updates.measuredStandardValue !== undefined
        ? updates.measuredStandardValue === '' ||
          updates.measuredStandardValue === null
          ? undefined
          : Number(updates.measuredStandardValue)
        : existing.measuredStandardValue,
    roomTemperature:
      updates.roomTemperature !== undefined
        ? updates.roomTemperature === '' || updates.roomTemperature === null
          ? undefined
          : Number(updates.roomTemperature)
        : existing.roomTemperature,
    analysisComplete:
      updates.analysisComplete !== undefined
        ? Boolean(updates.analysisComplete)
        : Boolean(existing.analysisComplete),
    reportViewedAt:
      updates.reportViewedAt !== undefined
        ? updates.reportViewedAt
          ? new Date(updates.reportViewedAt)
          : undefined
        : existing.reportViewedAt,
    reportApprovedBy:
      updates.reportApprovedBy !== undefined
        ? updates.reportApprovedBy
        : existing.reportApprovedBy,
    reportIssueDate:
      updates.reportIssueDate !== undefined
        ? updates.reportIssueDate
          ? new Date(updates.reportIssueDate)
          : undefined
        : existing.reportIssueDate,
    reportReference:
      updates.reportReference !== undefined
        ? updates.reportReference
        : existing.reportReference,
    revision:
      updates.revision !== undefined
        ? Number(updates.revision) || 0
        : existing.revision || 0,
    authorisationRequestedBy:
      updates.authorisationRequestedBy !== undefined
        ? updates.authorisationRequestedBy
        : existing.authorisationRequestedBy,
    authorisationRequestedByEmail:
      updates.authorisationRequestedByEmail !== undefined
        ? updates.authorisationRequestedByEmail
        : existing.authorisationRequestedByEmail,
  };

  job.analysisMeta = [
    ...(job.analysisMeta || []).filter((meta) => meta.sampleType !== sampleType),
    nextMeta,
  ];
  return nextMeta;
}

async function respondWithJob(res, jobId, status = 200) {
  const populatedJob = await MycometerJob.findById(jobId).populate(populateJob);
  res.status(status).json(populatedJob);
}

// GET /api/mycometer-jobs
router.get('/', auth, checkPermission(['projects.view']), async (req, res) => {
  try {
    const includeCompleted = req.query.includeCompleted === 'true';
    const filter = includeCompleted ? {} : { status: { $ne: 'Completed' } };
    const jobs = await MycometerJob.find(filter)
      .populate(populateJob)
      .sort({ createdAt: -1 });
    res.json(jobs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/mycometer-jobs/:id
router.get('/:id', auth, checkPermission(['projects.view']), async (req, res) => {
  try {
    const job = await MycometerJob.findById(req.params.id).populate(populateJob);
    if (!job) {
      return res.status(404).json({ message: 'Mycometer job not found' });
    }
    res.json(job);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/mycometer-jobs
router.post('/', auth, checkPermission(['projects.create']), async (req, res) => {
  try {
    const { projectId, scopeOfWorks } = req.body;

    if (!projectId) {
      return res.status(400).json({ message: 'Project is required' });
    }

    const cleanedScope = sanitizeScopeOfWorks(scopeOfWorks);

    const job = new MycometerJob({
      projectId,
      scopeOfWorks: cleanedScope,
      createdBy: req.user?.id || req.user?._id,
    });

    const savedJob = await job.save();
    await respondWithJob(res, savedJob._id, 201);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// PUT /api/mycometer-jobs/:id
router.put('/:id', auth, checkPermission(['projects.edit']), async (req, res) => {
  try {
    const job = await MycometerJob.findById(req.params.id);
    if (!job) {
      return res.status(404).json({ message: 'Mycometer job not found' });
    }

    if (req.body.projectId !== undefined) {
      if (!req.body.projectId) {
        return res.status(400).json({ message: 'Project is required' });
      }
      job.projectId = req.body.projectId;
    }

    if (req.body.scopeOfWorks !== undefined) {
      job.scopeOfWorks = sanitizeScopeOfWorks(req.body.scopeOfWorks);
    }

    if (req.body.status !== undefined) {
      if (!['In Progress', 'Completed'].includes(req.body.status)) {
        return res.status(400).json({ message: 'Invalid status' });
      }
      if (req.body.status === 'Completed') {
        const scope = (job.scopeOfWorks || []).filter(Boolean);
        if (scope.length === 0) {
          return res.status(400).json({
            message: 'Cannot close a job with no reports in scope',
          });
        }
        const allAuthorised = scope.every((sampleType) => {
          const analysisMeta = (job.analysisMeta || []).find(
            (item) => item.sampleType === sampleType
          );
          return Boolean(analysisMeta?.reportApprovedBy);
        });
        if (!allAuthorised) {
          return res.status(400).json({
            message:
              'All reports must be authorised before the job can be closed',
          });
        }
      }
      job.status = req.body.status;
    }

    job.updatedBy = req.user?.id || req.user?._id;

    const updatedJob = await job.save();
    await respondWithJob(res, updatedJob._id);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// POST /api/mycometer-jobs/:id/reports
router.post(
  '/:id/reports',
  auth,
  checkPermission(['projects.edit']),
  async (req, res) => {
    try {
      const { sampleType, sampledBy, sampleDate } = req.body;

      if (!SAMPLE_TYPES.includes(sampleType)) {
        return res.status(400).json({ message: 'Invalid report type' });
      }
      if (!sampledBy) {
        return res.status(400).json({ message: 'Sampler is required' });
      }
      if (!sampleDate) {
        return res.status(400).json({ message: 'Sampling date is required' });
      }

      const job = await MycometerJob.findById(req.params.id);
      if (!job) {
        return res.status(404).json({ message: 'Mycometer job not found' });
      }

      if ((job.scopeOfWorks || []).includes(sampleType)) {
        return res.status(400).json({
          message: `${sampleType} report already exists on this job`,
        });
      }

      job.scopeOfWorks = [...(job.scopeOfWorks || []), sampleType];
      const samplerSnapshot = await resolvePersonSnapshot(sampledBy, sampleType, {
        userId: undefined,
        name: undefined,
        certification: undefined,
      });
      upsertSamplingMeta(job, sampleType, {
        sampledBy: samplerSnapshot.userId,
        sampledByName: samplerSnapshot.name,
        mycometerCertificationNumber: samplerSnapshot.certification,
        sampleDate,
      });

      job.updatedBy = req.user?.id || req.user?._id;
      const updatedJob = await job.save();
      await respondWithJob(res, updatedJob._id, 201);
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  }
);

// PUT /api/mycometer-jobs/:id/reports/:sampleType
router.put(
  '/:id/reports/:sampleType',
  auth,
  checkPermission(['projects.edit']),
  async (req, res) => {
    try {
      const sampleType = decodeURIComponent(req.params.sampleType);
      if (!SAMPLE_TYPES.includes(sampleType)) {
        return res.status(400).json({ message: 'Invalid report type' });
      }

      const { sampledBy, sampleDate } = req.body;
      if (!sampledBy) {
        return res.status(400).json({ message: 'Sampler is required' });
      }
      if (!sampleDate) {
        return res.status(400).json({ message: 'Sampling date is required' });
      }

      const job = await MycometerJob.findById(req.params.id);
      if (!job) {
        return res.status(404).json({ message: 'Mycometer job not found' });
      }

      if (!(job.scopeOfWorks || []).includes(sampleType)) {
        return res.status(404).json({ message: 'Report not found on this job' });
      }

      const existingSampling = findSamplingMeta(job, sampleType);
      const samplerSnapshot = await resolvePersonSnapshot(
        sampledBy,
        sampleType,
        {
          userId: existingSampling?.sampledBy,
          name: existingSampling?.sampledByName,
          certification: existingSampling?.mycometerCertificationNumber,
        }
      );
      upsertSamplingMeta(job, sampleType, {
        sampledBy: samplerSnapshot.userId,
        sampledByName: samplerSnapshot.name,
        mycometerCertificationNumber: samplerSnapshot.certification,
        sampleDate,
      });

      job.updatedBy = req.user?.id || req.user?._id;
      const updatedJob = await job.save();
      await respondWithJob(res, updatedJob._id);
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  }
);

// DELETE /api/mycometer-jobs/:id/reports/:sampleType
router.delete(
  '/:id/reports/:sampleType',
  auth,
  checkPermission(['projects.edit']),
  async (req, res) => {
    try {
      const userRole = req.user?.role;
      if (userRole !== 'admin' && userRole !== 'super_admin') {
        return res.status(403).json({
          message: 'Only admin users can delete Mycometer reports',
        });
      }

      const sampleType = decodeURIComponent(req.params.sampleType);
      if (!SAMPLE_TYPES.includes(sampleType)) {
        return res.status(400).json({ message: 'Invalid report type' });
      }

      const job = await MycometerJob.findById(req.params.id);
      if (!job) {
        return res.status(404).json({ message: 'Mycometer job not found' });
      }

      if (!(job.scopeOfWorks || []).includes(sampleType)) {
        return res.status(404).json({ message: 'Report not found on this job' });
      }

      job.scopeOfWorks = (job.scopeOfWorks || []).filter(
        (type) => type !== sampleType
      );
      job.samplingMeta = (job.samplingMeta || []).filter(
        (meta) => meta.sampleType !== sampleType
      );
      job.analysisMeta = (job.analysisMeta || []).filter(
        (meta) => meta.sampleType !== sampleType
      );
      job.samples = (job.samples || []).filter(
        (sample) => sample.sampleType !== sampleType
      );

      job.updatedBy = req.user?.id || req.user?._id;
      const updatedJob = await job.save();
      await respondWithJob(res, updatedJob._id);
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  }
);

// PUT /api/mycometer-jobs/:id/sample-types/:sampleType
router.put(
  '/:id/sample-types/:sampleType',
  auth,
  checkPermission(['projects.edit']),
  async (req, res) => {
    try {
      const sampleType = decodeURIComponent(req.params.sampleType);
      if (!SAMPLE_TYPES.includes(sampleType)) {
        return res.status(400).json({ message: 'Invalid sample type' });
      }

      const job = await MycometerJob.findById(req.params.id);
      if (!job) {
        return res.status(404).json({ message: 'Mycometer job not found' });
      }

      if (!job.scopeOfWorks.includes(sampleType)) {
        return res.status(400).json({
          message: 'Sample type is not in this job scope of works',
        });
      }

      if (!req.body.sampledBy) {
        return res.status(400).json({ message: 'Sampled by is required' });
      }

      const existingSampling = findSamplingMeta(job, sampleType);
      const samplerSnapshot = await resolvePersonSnapshot(
        req.body.sampledBy,
        sampleType,
        {
          userId: existingSampling?.sampledBy,
          name: existingSampling?.sampledByName,
          certification: existingSampling?.mycometerCertificationNumber,
        }
      );
      upsertSamplingMeta(job, sampleType, {
        sampledBy: samplerSnapshot.userId,
        sampledByName: samplerSnapshot.name,
        mycometerCertificationNumber: samplerSnapshot.certification,
        sampleDate: req.body.sampleDate,
        flowmeter: req.body.flowmeter,
      });

      if (Array.isArray(req.body.samples)) {
        const invalidSample = req.body.samples.find(
          (sample) =>
            !String(sample?.sampleId || '').trim() ||
            !String(sample?.sampleLocation || '').trim()
        );
        if (invalidSample) {
          return res.status(400).json({
            message: 'Sample ID and Sample location are required for every sample',
          });
        }

        const existingTypeSamples = (job.samples || []).filter(
          (sample) => sample.sampleType === sampleType
        );
        const typedSamples = sanitizeSamples(
          req.body.samples.map((sample) => ({
            ...sample,
            sampleType,
          })),
          existingTypeSamples
        );

        job.samples = [
          ...(job.samples || []).filter(
            (sample) => sample.sampleType !== sampleType
          ),
          ...typedSamples,
        ];
      }

      job.updatedBy = req.user?.id || req.user?._id;

      const updatedJob = await job.save();
      await respondWithJob(res, updatedJob._id);
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  }
);

// POST /api/mycometer-jobs/:id/sample-types/:sampleType/complete-sampling
router.post(
  '/:id/sample-types/:sampleType/complete-sampling',
  auth,
  checkPermission(['projects.edit']),
  async (req, res) => {
    try {
      const sampleType = decodeURIComponent(req.params.sampleType);
      if (!SAMPLE_TYPES.includes(sampleType)) {
        return res.status(400).json({ message: 'Invalid sample type' });
      }

      const job = await MycometerJob.findById(req.params.id);
      if (!job) {
        return res.status(404).json({ message: 'Mycometer job not found' });
      }

      if (!job.scopeOfWorks.includes(sampleType)) {
        return res.status(400).json({
          message: 'Sample type is not in this job scope of works',
        });
      }

      const typeSamples = (job.samples || []).filter(
        (sample) => sample.sampleType === sampleType
      );
      if (typeSamples.length === 0) {
        return res.status(400).json({
          message: 'Add at least one sample before completing sampling',
        });
      }

      const existingMeta = findSamplingMeta(job, sampleType);
      if (!existingMeta?.sampledBy || !existingMeta?.sampleDate) {
        return res.status(400).json({
          message: 'Sampled by and Sample Date are required before completing sampling',
        });
      }

      const isAirLike =
        sampleType === 'Air Fungi' || sampleType === 'Air Allergen';
      if (isAirLike && !existingMeta?.flowmeter) {
        return res.status(400).json({
          message: `Flowmeter is required before completing ${sampleType} sampling`,
        });
      }

      const { turnaroundTime, analysisDueDate } = req.body;
      if (!TURNAROUND_OPTIONS.includes(turnaroundTime)) {
        return res.status(400).json({ message: 'Valid turnaround time is required' });
      }
      if (turnaroundTime === 'custom' && !analysisDueDate) {
        return res.status(400).json({
          message: 'Analysis due date is required for custom turnaround',
        });
      }

      // Freeze sampler name/cert from the current user profile at completion time.
      const samplerSnapshot = await resolvePersonSnapshot(
        existingMeta.sampledBy,
        sampleType,
        {
          userId: existingMeta.sampledBy,
          name: existingMeta.sampledByName,
          certification: existingMeta.mycometerCertificationNumber,
        }
      );
      upsertSamplingMeta(job, sampleType, {
        sampledByName: samplerSnapshot.name,
        mycometerCertificationNumber: samplerSnapshot.certification,
        samplingComplete: true,
        turnaroundTime,
        analysisDueDate: analysisDueDate || undefined,
      });

      // Ensure analysis meta shell exists for the type.
      upsertAnalysisMeta(job, sampleType, {});

      job.updatedBy = req.user?.id || req.user?._id;
      const updatedJob = await job.save();
      await respondWithJob(res, updatedJob._id);
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  }
);

// PATCH /api/mycometer-jobs/:id/sample-types/:sampleType/reopen
// Admin-only: reopen sampling/analysis for editing (mirrors air monitoring shift reopen).
router.patch(
  '/:id/sample-types/:sampleType/reopen',
  auth,
  checkPermission(['admin.update']),
  async (req, res) => {
    try {
      const sampleType = decodeURIComponent(req.params.sampleType);
      if (!SAMPLE_TYPES.includes(sampleType)) {
        return res.status(400).json({ message: 'Invalid sample type' });
      }

      const job = await MycometerJob.findById(req.params.id);
      if (!job) {
        return res.status(404).json({ message: 'Mycometer job not found' });
      }

      if (!job.scopeOfWorks.includes(sampleType)) {
        return res.status(400).json({
          message: 'Sample type is not in this job scope of works',
        });
      }

      const samplingMeta = findSamplingMeta(job, sampleType);
      const analysisMeta = findAnalysisMeta(job, sampleType);

      if (!samplingMeta?.samplingComplete && !analysisMeta?.analysisComplete) {
        return res.status(400).json({
          message: 'Nothing to reopen — sampling and analysis are already open',
        });
      }

      upsertSamplingMeta(job, sampleType, {
        samplingComplete: false,
      });

      const wasAuthorised = Boolean(analysisMeta?.reportApprovedBy);
      const nextRevision = wasAuthorised
        ? (typeof analysisMeta.revision === 'number' ? analysisMeta.revision : 0) +
          1
        : analysisMeta?.revision || 0;

      upsertAnalysisMeta(job, sampleType, {
        analysisComplete: false,
        reportApprovedBy: '',
        reportViewedAt: null,
        authorisationRequestedBy: null,
        authorisationRequestedByEmail: '',
        revision: nextRevision,
        // Preserve first reportIssueDate / reportReference for stable filenames.
      });

      job.updatedBy = req.user?.id || req.user?._id;
      const updatedJob = await job.save();
      await respondWithJob(res, updatedJob._id);
    } catch (err) {
      console.error('Error reopening Mycometer sample type:', err);
      res.status(400).json({ message: err.message });
    }
  }
);

// PUT /api/mycometer-jobs/:id/sample-types/:sampleType/analysis
router.put(
  '/:id/sample-types/:sampleType/analysis',
  auth,
  checkPermission(['projects.edit']),
  async (req, res) => {
    try {
      const sampleType = decodeURIComponent(req.params.sampleType);
      if (!SAMPLE_TYPES.includes(sampleType)) {
        return res.status(400).json({ message: 'Invalid sample type' });
      }

      const job = await MycometerJob.findById(req.params.id);
      if (!job) {
        return res.status(404).json({ message: 'Mycometer job not found' });
      }

      const meta = findSamplingMeta(job, sampleType);
      if (!meta?.samplingComplete) {
        return res.status(400).json({
          message: 'Sampling must be completed before analysis can be saved',
        });
      }

      const existingAnalysisMeta = findAnalysisMeta(job, sampleType);
      if (existingAnalysisMeta?.analysisComplete) {
        return res.status(400).json({
          message: 'Analysis is finalised and cannot be edited',
        });
      }

      const analystSnapshot = await resolvePersonSnapshot(
        req.body.analyst,
        sampleType,
        {
          userId: existingAnalysisMeta?.analyst,
          name: existingAnalysisMeta?.analystName,
          certification: existingAnalysisMeta?.mycometerCertificationNumber,
        }
      );

      // Prefer explicit certification from the request (current selection), then
      // the live user licence snapshot, then any previously stored value.
      // When finalising analysis, always refresh from the live user profile so
      // the snapshotted cert is locked to the value at completion time.
      const isFinalising = Boolean(req.body.analysisComplete);
      const certificationNumber = isFinalising
        ? analystSnapshot.certification ||
          (typeof req.body.mycometerCertificationNumber === 'string' &&
            req.body.mycometerCertificationNumber.trim()) ||
          existingAnalysisMeta?.mycometerCertificationNumber ||
          'MSF-3176-AU'
        : (typeof req.body.mycometerCertificationNumber === 'string' &&
            req.body.mycometerCertificationNumber.trim()) ||
          analystSnapshot.certification ||
          existingAnalysisMeta?.mycometerCertificationNumber ||
          'MSF-3176-AU';

      upsertAnalysisMeta(job, sampleType, {
        analyst: analystSnapshot.userId,
        analystName: analystSnapshot.name,
        analysisDate: req.body.analysisDate,
        mycometerCertificationNumber: certificationNumber,
        standardValue:
          req.body.standardValue !== undefined ? req.body.standardValue : 535,
        measuredStandardValue: req.body.measuredStandardValue,
        roomTemperature: req.body.roomTemperature,
        analysisComplete: req.body.analysisComplete,
      });

      if (Array.isArray(req.body.samples)) {
        const otherSamples = (job.samples || []).filter(
          (sample) => sample.sampleType !== sampleType
        );
        const existingTypeSamples = (job.samples || []).filter(
          (sample) => sample.sampleType === sampleType
        );

        const updatedTypeSamples = existingTypeSamples.map((existing) => {
          const update = req.body.samples.find(
            (sample) =>
              (sample._id && String(sample._id) === String(existing._id)) ||
              (sample.sampleId && sample.sampleId === existing.sampleId)
          );
          if (!update) return existing;

          const next = existing.toObject ? existing.toObject() : { ...existing };
          if (update.blankValue !== undefined) {
            next.blankValue = toOptionalNumber(update.blankValue);
          }
          if (update.analysisValue !== undefined) {
            next.analysisValue = toOptionalNumber(update.analysisValue);
          }
          return next;
        });

        job.samples = [...otherSamples, ...updatedTypeSamples];
      }

      job.updatedBy = req.user?.id || req.user?._id;
      const updatedJob = await job.save();
      await respondWithJob(res, updatedJob._id);
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  }
);

// PUT /api/mycometer-jobs/:id/sample-types/:sampleType/report-viewed
router.put(
  '/:id/sample-types/:sampleType/report-viewed',
  auth,
  checkPermission(['projects.edit']),
  async (req, res) => {
    try {
      const sampleType = decodeURIComponent(req.params.sampleType);
      if (!SAMPLE_TYPES.includes(sampleType)) {
        return res.status(400).json({ message: 'Invalid sample type' });
      }

      const job = await MycometerJob.findById(req.params.id);
      if (!job) {
        return res.status(404).json({ message: 'Mycometer job not found' });
      }

      const analysisMeta = findAnalysisMeta(job, sampleType);
      if (!analysisMeta?.analysisComplete) {
        return res.status(400).json({
          message: 'Analysis must be finalised before the report can be viewed',
        });
      }

      upsertAnalysisMeta(job, sampleType, {
        reportViewedAt: req.body.reportViewedAt || new Date(),
      });
      job.updatedBy = req.user?.id || req.user?._id;
      const updatedJob = await job.save();
      await respondWithJob(res, updatedJob._id);
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  }
);

// POST /api/mycometer-jobs/:id/sample-types/:sampleType/authorise
router.post(
  '/:id/sample-types/:sampleType/authorise',
  auth,
  checkPermission(['projects.edit']),
  async (req, res) => {
    try {
      const sampleType = decodeURIComponent(req.params.sampleType);
      if (!SAMPLE_TYPES.includes(sampleType)) {
        return res.status(400).json({ message: 'Invalid sample type' });
      }

      const job = await MycometerJob.findById(req.params.id).populate({
        path: 'projectId',
        select: 'name projectID',
        populate: { path: 'client', select: 'name' },
      });
      if (!job) {
        return res.status(404).json({ message: 'Mycometer job not found' });
      }

      const analysisMeta = findAnalysisMeta(job, sampleType);
      if (!analysisMeta?.analysisComplete) {
        return res.status(400).json({
          message: 'Analysis must be finalised before authorising the report',
        });
      }
      if (analysisMeta.reportApprovedBy) {
        return res.status(400).json({
          message: 'Report has already been authorised',
        });
      }

      const wasAlreadyAuthorised = Boolean(analysisMeta.reportApprovedBy);
      const approver =
        req.user?.firstName && req.user?.lastName
          ? `${req.user.firstName} ${req.user.lastName}`
          : req.user?.email || 'Unknown';

      // First authorisation locks the issue date; later re-authorisations keep it
      // for stable report references/filenames.
      const reportIssueDate = analysisMeta.reportIssueDate || new Date();
      const projectName = job.projectId?.name || 'Unknown';
      const projectID = job.projectId?.projectID || 'Unknown';
      const filenameBuilder =
        sampleType === 'Air Fungi'
          ? buildMycometerAirFungiFilename
          : sampleType === 'Air Allergen'
            ? buildMycometerAirAllergenFilename
            : buildMycometerSurfaceFungiFilename;
      const reportReference =
        analysisMeta.reportReference ||
        toReportReference(
          filenameBuilder({
            projectId: projectID,
            siteName: projectName,
            reportIssueDate,
            includeRevision: false,
            includeExtension: false,
          })
        );

      upsertAnalysisMeta(job, sampleType, {
        reportApprovedBy: approver,
        reportIssueDate,
        reportReference,
      });
      job.updatedBy = req.user?.id || req.user?._id;
      const updatedJob = await job.save();

      const sampleTypeSlug =
        {
          'Surface Fungi': 'surface-fungi',
          'Air Fungi': 'air-fungi',
          'Air Allergen': 'air-allergen',
          'Air FAI': 'air-fai',
        }[sampleType] || sampleType.toLowerCase().replace(/\s+/g, '-');
      await notifyAuthorisationRequesterOnApproval({
        authorisationRequestedBy: analysisMeta.authorisationRequestedBy,
        wasAlreadyAuthorised,
        isNowAuthorised: true,
        approverName: approver,
        reportTypeLabel: `Mycometer ${sampleType} report`,
        subjectIdentifier: projectID,
        details: [
          { label: 'Project', value: `${projectName} (${projectID})` },
          { label: 'Sample type', value: sampleType },
        ],
        viewUrl: `${getFrontendUrl()}/laboratory-services/mycometer-analysis/${
          job._id
        }/${sampleTypeSlug}`,
      });

      await respondWithJob(res, updatedJob._id);
    } catch (err) {
      console.error('Error authorising Mycometer report:', err);
      res.status(500).json({
        message: 'Failed to authorise report',
        error: err.message,
      });
    }
  }
);

// POST /api/mycometer-jobs/:id/sample-types/:sampleType/send-for-authorisation
router.post(
  '/:id/sample-types/:sampleType/send-for-authorisation',
  auth,
  checkPermission(['projects.edit']),
  async (req, res) => {
    try {
      const sampleType = decodeURIComponent(req.params.sampleType);
      if (!SAMPLE_TYPES.includes(sampleType)) {
        return res.status(400).json({ message: 'Invalid sample type' });
      }

      const job = await MycometerJob.findById(req.params.id).populate({
        path: 'projectId',
        select: 'name projectID',
        populate: { path: 'client', select: 'name' },
      });
      if (!job) {
        return res.status(404).json({ message: 'Mycometer job not found' });
      }

      const analysisMeta = findAnalysisMeta(job, sampleType);
      if (!analysisMeta?.analysisComplete) {
        return res.status(400).json({
          message:
            'Analysis must be finalised before sending for authorisation',
        });
      }
      if (analysisMeta.reportApprovedBy) {
        return res.status(400).json({
          message: 'Report has already been authorised',
        });
      }

      const reportProoferUsers = await User.find({
        reportProofer: true,
        isActive: true,
      }).select('firstName lastName email');

      if (reportProoferUsers.length === 0) {
        return res.status(400).json({
          message: 'No report proofer users found',
        });
      }

      const requesterName =
        req.user?.firstName && req.user?.lastName
          ? `${req.user.firstName} ${req.user.lastName}`
          : req.user?.email || 'A user';

      upsertAnalysisMeta(job, sampleType, {
        authorisationRequestedBy: req.user._id,
        authorisationRequestedByEmail: req.user.email,
      });
      job.updatedBy = req.user?.id || req.user?._id;
      await job.save();

      const projectName = job.projectId?.name || 'Unknown Project';
      const projectID = job.projectId?.projectID || 'N/A';
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      const sampleTypeSlug = sampleType.toLowerCase().replace(/\s+/g, '-');
      const jobUrl = `${frontendUrl}/laboratory-services/mycometer-analysis/${job._id}/${sampleTypeSlug}`;

      const emailPromises = reportProoferUsers.map(async (user) => {
        await sendMail({
          to: user.email,
          subject: `Report Authorisation Required - ${projectID}: Mycometer ${sampleType}`,
          text: `
A Mycometer ${sampleType} report is ready for authorisation.

Project: ${projectName} (${projectID})
Sample Type: ${sampleType}
Requested by: ${requesterName}

Please review and authorise the report at: ${jobUrl}
          `,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
              <div style="margin-bottom: 30px;">
                <h1 style="color: rgb(25, 138, 44); font-size: 24px; margin: 0; padding: 0;">L&D Consulting App</h1>
              </div>
              <div style="color: #333; line-height: 1.6;">
                <h2 style="color: rgb(25, 138, 44); margin-bottom: 20px;">Report Authorisation Required</h2>
                <p>Hello ${user.firstName},</p>
                <p>A Mycometer ${sampleType} report is ready for your authorisation:</p>
                <div style="background-color: #f5f5f5; padding: 15px; border-radius: 4px; margin: 20px 0;">
                  <p style="margin: 5px 0;"><strong>Project:</strong> ${projectName}</p>
                  <p style="margin: 5px 0;"><strong>Project ID:</strong> ${projectID}</p>
                  <p style="margin: 5px 0;"><strong>Sample Type:</strong> ${sampleType}</p>
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
          `,
        });
      });

      await Promise.all(emailPromises);

      res.json({
        message: `Authorisation request emails sent successfully to ${reportProoferUsers.length} report proofer user(s)`,
        recipients: reportProoferUsers.map((u) => ({
          email: u.email,
          name: `${u.firstName} ${u.lastName}`,
        })),
      });
    } catch (err) {
      console.error('Error sending Mycometer authorisation emails:', err);
      res.status(500).json({
        message: 'Failed to send authorisation request emails',
        error: err.message,
      });
    }
  }
);

// DELETE /api/mycometer-jobs/:id
router.delete(
  '/:id',
  auth,
  checkPermission(['projects.delete']),
  async (req, res) => {
    try {
      const job = await MycometerJob.findById(req.params.id);
      if (!job) {
        return res.status(404).json({ message: 'Mycometer job not found' });
      }

      await job.deleteOne();
      res.json({ message: 'Mycometer job deleted successfully' });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  }
);

module.exports = router;
