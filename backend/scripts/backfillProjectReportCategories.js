/**
 * Backfill Project.reportCategories and reportCategoriesCachedAt for historical projects.
 *
 * Uses the same logic as GET /reports/project/:id/categories (lazy fill).
 * Safe default: DRY RUN — no writes unless you pass --apply.
 *
 * Usage (from backend/):
 *   node scripts/backfillProjectReportCategories.js
 *   node scripts/backfillProjectReportCategories.js --verbose
 *   node scripts/backfillProjectReportCategories.js --apply
 *   node scripts/backfillProjectReportCategories.js --apply --limit=50
 *   node scripts/backfillProjectReportCategories.js --apply --projectId=<mongoId>
 *   node scripts/backfillProjectReportCategories.js --apply --force
 *
 * Options:
 *   --apply              Persist changes (default is dry run)
 *   --verbose            Log each project processed
 *   --force              Recompute even if reportCategoriesCachedAt is already set
 *   --limit=N            Process at most N projects (useful for small batches)
 *   --projectId=<id>     Only process one project
 *   --only-with-reports  Only projects where reports_present is true (smaller set)
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const Project = require('../models/Project');
const { computeReportCategories } = require('../services/projectReportCategoriesService');

function parseArgs(argv) {
  const args = argv.slice(2);
  const flags = new Set();
  let limit = null;
  let projectId = null;

  for (const arg of args) {
    if (arg.startsWith('--limit=')) {
      const n = parseInt(arg.slice('--limit='.length), 10);
      if (!Number.isNaN(n) && n > 0) limit = n;
    } else if (arg.startsWith('--projectId=')) {
      projectId = arg.slice('--projectId='.length).trim();
    } else {
      flags.add(arg);
    }
  }

  return {
    apply: flags.has('--apply'),
    verbose: flags.has('--verbose'),
    force: flags.has('--force'),
    onlyWithReports: flags.has('--only-with-reports'),
    limit,
    projectId,
  };
}

async function connectDB() {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI environment variable is not set. Check your .env file.');
  }
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB\n');
}

async function backfillProjectReportCategories() {
  const { apply, verbose, force, onlyWithReports, limit, projectId } = parseArgs(
    process.argv,
  );
  const mode = apply ? 'APPLY' : 'DRY RUN';

  console.log(`=== ${mode}: Backfill project reportCategories ===\n`);
  if (!apply) {
    console.log('No changes will be written. Pass --apply to persist.\n');
  }

  await connectDB();

  const query = {};

  if (projectId) {
    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      throw new Error(`Invalid --projectId: ${projectId}`);
    }
    query._id = new mongoose.Types.ObjectId(projectId);
  }

  if (!force) {
    query.$or = [
      { reportCategoriesCachedAt: { $exists: false } },
      { reportCategoriesCachedAt: null },
    ];
  }

  if (onlyWithReports) {
    query.reports_present = true;
  }

  let cursor = Project.find(query)
    .select('_id projectID name reportCategories reportCategoriesCachedAt reports_present')
    .sort({ projectID: -1 })
    .lean();

  if (limit) {
    cursor = cursor.limit(limit);
  }

  const projects = await cursor;
  console.log(`Projects to process: ${projects.length}`);
  if (force) console.log('(--force: recomputing even when already cached)');
  if (onlyWithReports) console.log('(--only-with-reports: filtered subset)');
  if (limit) console.log(`(--limit=${limit})`);
  if (projectId) console.log(`(--projectId=${projectId})`);
  console.log('');

  let processed = 0;
  let withCategories = 0;
  let unchanged = 0;
  let errors = 0;

  for (const project of projects) {
    processed += 1;
    const label = `${project.projectID || 'N/A'} (${project._id})`;

    try {
      const categories = await computeReportCategories(project._id);
      const prev = Array.isArray(project.reportCategories)
        ? project.reportCategories
        : [];
      const prevKey = [...prev].sort().join(',');
      const nextKey = [...categories].sort().join(',');
      const isSame = prevKey === nextKey && project.reportCategoriesCachedAt && !force;

      if (categories.length > 0) {
        withCategories += 1;
      }

      if (isSame) {
        unchanged += 1;
        if (verbose) {
          console.log(`  skip (unchanged): ${label} → [${categories.join(', ') || 'none'}]`);
        }
        continue;
      }

      if (verbose || categories.length > 0) {
        console.log(
          `  ${apply ? 'update' : 'would update'}: ${label} → [${categories.join(', ') || 'none'}]`,
        );
      }

      if (apply) {
        await Project.findByIdAndUpdate(project._id, {
          $set: {
            reportCategories: categories,
            reportCategoriesCachedAt: new Date(),
            ...(categories.length > 0 ? { reports_present: true } : {}),
          },
        });
      }
    } catch (err) {
      errors += 1;
      console.error(`  error: ${label} — ${err.message}`);
    }
  }

  console.log('\n--- Summary ---');
  console.log(`Processed: ${processed}`);
  console.log(`With at least one category: ${withCategories}`);
  console.log(`Unchanged (skipped): ${unchanged}`);
  console.log(`Errors: ${errors}`);
  if (!apply) {
    console.log('\nDry run complete. Re-run with --apply to write changes.');
  } else {
    console.log('\nBackfill complete.');
  }
}

backfillProjectReportCategories()
  .catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  })
  .finally(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
      console.log('Disconnected from MongoDB.');
    }
  });
