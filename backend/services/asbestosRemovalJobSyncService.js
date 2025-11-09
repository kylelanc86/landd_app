const AsbestosRemovalJob = require("../models/AsbestosRemovalJob");
const AsbestosClearance = require("../models/clearanceTemplates/asbestos/AsbestosClearance");
const Shift = require("../models/Shift");

const deriveJobType =
  AsbestosRemovalJob.deriveJobType ||
  ((airMonitoring, clearance) => {
    if (airMonitoring && clearance) {
      return "air_monitoring_and_clearance";
    }
    if (airMonitoring) {
      return "air_monitoring";
    }
    if (clearance) {
      return "clearance";
    }
    return "none";
  });

const ASBESTOS_JOB_MODEL = "AsbestosRemovalJob";

const buildShiftQueryForJob = (jobId) => ({
  job: jobId,
  $or: [
    { jobModel: { $exists: false } },
    { jobModel: null },
    { jobModel: ASBESTOS_JOB_MODEL },
  ],
});

const updateJobFlags = async (job, { hasAirMonitoring, hasClearance }) => {
  let shouldSave = false;

  if (typeof hasAirMonitoring === "boolean") {
    if (job.airMonitoring !== hasAirMonitoring) {
      job.airMonitoring = hasAirMonitoring;
      shouldSave = true;
    }
  }

  if (typeof hasClearance === "boolean") {
    if (job.clearance !== hasClearance) {
      job.clearance = hasClearance;
      shouldSave = true;
    }
  }

  if (shouldSave) {
    job.jobType = deriveJobType(job.airMonitoring, job.clearance);
    try {
      await job.save();
    } catch (error) {
      console.error(
        "[AsbestosRemovalJobSync] Error saving job while updating flags:",
        job._id,
        error
      );
      throw error;
    }
  }
};

const syncAirMonitoringForJob = async (jobId) => {
  if (!jobId) return;

  try {
    const [job, hasAirMonitoring] = await Promise.all([
      AsbestosRemovalJob.findById(jobId),
      Shift.exists(buildShiftQueryForJob(jobId)),
    ]);

    if (!job) {
      return;
    }

    await updateJobFlags(job, {
      hasAirMonitoring: !!hasAirMonitoring,
    });
  } catch (error) {
    console.error(
      "[AsbestosRemovalJobSync] Failed to sync air monitoring for job",
      jobId,
      error
    );
  }
};

const syncClearanceForProject = async (projectId) => {
  if (!projectId) return;

  try {
    const [jobs, hasClearance] = await Promise.all([
      AsbestosRemovalJob.find({ projectId }),
      AsbestosClearance.exists({ projectId }),
    ]);

    if (!jobs.length) {
      return;
    }

    await Promise.all(
      jobs.map((job) =>
        updateJobFlags(job, {
          hasClearance: !!hasClearance,
        })
      )
    );
  } catch (error) {
    console.error(
      "[AsbestosRemovalJobSync] Failed to sync clearance for project",
      projectId,
      error
    );
  }
};

module.exports = {
  syncAirMonitoringForJob,
  syncClearanceForProject,
};

