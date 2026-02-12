/**
 * Backfill legislation on existing clearance jobs only.
 * Sets clearance.legislation to the current legislation from custom data fields
 * (CustomDataFieldGroup type 'legislation'), filtered by each clearance's
 * jurisdiction (ACT or NSW) so it stays state-specific.
 *
 * Run from backend: node scripts/backfillJobLegislation.js
 */
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const CustomDataFieldGroup = require('../models/CustomDataFieldGroup');
const AsbestosClearance = require('../models/clearanceTemplates/asbestos/AsbestosClearance');

function toStoredShape(item) {
  return {
    _id: item._id,
    text: item.text,
    legislationTitle: item.legislationTitle,
    jurisdiction: item.jurisdiction,
  };
}

async function backfillJobLegislation() {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI environment variable is not set. Check your .env file.');
    }

    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB\n');

    const legislation = await CustomDataFieldGroup.getFieldsByType('legislation');
    console.log(`Loaded ${legislation.length} legislation items from custom data fields.`);

    if (legislation.length === 0) {
      console.log('No legislation in custom data fields. Clearances will get an empty legislation array.');
    }

    // Filter by jurisdiction (ACT or NSW) so each clearance gets state-specific legislation only
    const byJurisdiction = (jurisdiction) => {
      const j = jurisdiction === 'ACT' || jurisdiction === 'NSW' ? jurisdiction : 'ACT';
      return legislation
        .filter((item) => (item.jurisdiction || 'ACT') === j)
        .map(toStoredShape);
    };

    const clearances = await AsbestosClearance.find({}).lean();
    let updated = 0;
    for (const doc of clearances) {
      const jurisdiction = doc.jurisdiction || 'ACT';
      const jobLegislation = byJurisdiction(jurisdiction);
      await AsbestosClearance.updateOne(
        { _id: doc._id },
        { $set: { legislation: jobLegislation } }
      );
      updated++;
    }
    console.log(`Updated ${updated} clearance(s) with state-specific legislation.`);

    console.log('\nDone.');
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
  }
}

backfillJobLegislation();
