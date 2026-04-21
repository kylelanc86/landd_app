const mongoose = require('mongoose');
const ClientSuppliedJob = require('../models/ClientSuppliedJob');
const AsbestosAssessment = require('../models/assessmentTemplates/asbestos/AsbestosAssessment');

const TRACKED_ASSESSMENT_JOB_TYPES = ['asbestos-assessment', 'residential-asbestos'];

function parseArgs(argv) {
  const args = new Set(argv.slice(2));
  return {
    apply: args.has('--apply'),
    verbose: args.has('--verbose'),
  };
}

function toYmd(dateValue) {
  if (!dateValue) return null;
  const d = new Date(dateValue);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function pickBestDeletedAssessment(ldJob, deletedAssessments) {
  if (!Array.isArray(deletedAssessments) || deletedAssessments.length === 0) {
    return { assessment: null, reason: 'no-deleted-assessment' };
  }

  if (deletedAssessments.length === 1) {
    return { assessment: deletedAssessments[0], reason: 'single-candidate' };
  }

  const jobSampleDate = toYmd(ldJob.sampleReceiptDate);
  const exactDateMatches = deletedAssessments.filter(
    (a) => toYmd(a.samplesReceivedDate) && toYmd(a.samplesReceivedDate) === jobSampleDate,
  );

  if (exactDateMatches.length === 1) {
    return { assessment: exactDateMatches[0], reason: 'matched-sample-date' };
  }

  return { assessment: null, reason: 'ambiguous-multiple-candidates' };
}

async function backfillLdSuppliedLinksAndArchiveDeletedAssessments() {
  const { apply, verbose } = parseArgs(process.argv);
  const mode = apply ? 'APPLY' : 'DRY RUN';

  try {
    require('dotenv').config();
    const connectDB = require('../config/db');
    await connectDB();

    console.log(`=== ${mode}: Backfill LD supplied links + archive by deleted assessments ===\n`);

    const deletedAssessments = await AsbestosAssessment.find({
      jobType: { $in: TRACKED_ASSESSMENT_JOB_TYPES },
      deletedAt: { $exists: true, $ne: null },
    })
      .select('_id projectId jobType deletedAt samplesReceivedDate')
      .lean();

    const deletedByProject = new Map();
    for (const a of deletedAssessments) {
      const key = String(a.projectId);
      if (!deletedByProject.has(key)) deletedByProject.set(key, []);
      deletedByProject.get(key).push(a);
    }

    const ldJobs = await ClientSuppliedJob.find({
      supplyType: 'ld',
    })
      .select('_id projectId archived linkedAssessmentId sampleReceiptDate')
      .lean();

    let linkedCount = 0;
    let archivedCount = 0;
    let skippedAmbiguousCount = 0;
    let skippedNoDeletedAssessmentCount = 0;
    let alreadyArchivedCount = 0;
    let alreadyLinkedCount = 0;

    for (const job of ldJobs) {
      const now = new Date();
      let targetAssessment = null;
      let linkageReason = null;

      if (job.linkedAssessmentId) {
        alreadyLinkedCount += 1;
        const linked = deletedAssessments.find(
          (a) => String(a._id) === String(job.linkedAssessmentId),
        );
        if (linked) {
          targetAssessment = linked;
          linkageReason = 'existing-link';
        }
      }

      if (!targetAssessment) {
        const projectDeletedAssessments =
          deletedByProject.get(String(job.projectId)) || [];
        const picked = pickBestDeletedAssessment(job, projectDeletedAssessments);
        targetAssessment = picked.assessment;
        linkageReason = picked.reason;
      }

      if (!targetAssessment) {
        if (linkageReason === 'ambiguous-multiple-candidates') {
          skippedAmbiguousCount += 1;
          if (verbose) {
            console.log(`- skip ambiguous: ldJob=${job._id} project=${job.projectId}`);
          }
        } else {
          skippedNoDeletedAssessmentCount += 1;
          if (verbose) {
            console.log(`- skip none: ldJob=${job._id} project=${job.projectId}`);
          }
        }
        continue;
      }

      const shouldLink = !job.linkedAssessmentId;
      const shouldArchive = job.archived !== true;

      if (!shouldLink && !shouldArchive) {
        alreadyArchivedCount += 1;
        if (verbose) {
          console.log(`- already linked+archived: ldJob=${job._id}`);
        }
        continue;
      }

      if (shouldLink) linkedCount += 1;
      if (shouldArchive) archivedCount += 1;

      if (verbose) {
        console.log(
          `- ${apply ? 'update' : 'would update'} ldJob=${job._id} assessment=${targetAssessment._id} reason=${linkageReason} link=${shouldLink} archive=${shouldArchive}`,
        );
      }

      if (apply) {
        const setPayload = {
          updatedAt: now,
        };
        if (shouldLink) {
          setPayload.linkedAssessmentId = targetAssessment._id;
          setPayload.linkedAssessmentJobType = targetAssessment.jobType;
        }
        if (shouldArchive) {
          setPayload.archived = true;
          setPayload.archivedAt = now;
        }

        await ClientSuppliedJob.updateOne(
          { _id: job._id },
          { $set: setPayload },
        );
      }
    }

    console.log('\n=== SUMMARY ===');
    console.log(`Mode: ${mode}`);
    console.log(`Deleted asbestos/residential assessments considered: ${deletedAssessments.length}`);
    console.log(`LD supplied jobs scanned: ${ldJobs.length}`);
    console.log(`LD jobs ${apply ? '' : 'to be '}linked: ${linkedCount}`);
    console.log(`LD jobs ${apply ? '' : 'to be '}archived: ${archivedCount}`);
    console.log(`Skipped (ambiguous candidates): ${skippedAmbiguousCount}`);
    console.log(`Skipped (no deleted assessment in project): ${skippedNoDeletedAssessmentCount}`);
    console.log(`Already linked rows encountered: ${alreadyLinkedCount}`);
    console.log(`Already linked+archived rows: ${alreadyArchivedCount}`);
    console.log('\nDone.');
  } catch (error) {
    console.error('Script failed:', error);
    throw error;
  } finally {
    await mongoose.connection.close();
  }
}

if (require.main === module) {
  backfillLdSuppliedLinksAndArchiveDeletedAssessments()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = backfillLdSuppliedLinksAndArchiveDeletedAssessments;
