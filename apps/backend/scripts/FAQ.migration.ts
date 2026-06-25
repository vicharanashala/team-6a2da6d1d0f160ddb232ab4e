/**
 * FAQ.migration.ts
 *
 * Drop this file in backend/scripts/ and run:
 *   npx tsx scripts/FAQ.migration.ts
 *
 * What it does:
 *   1. Adds journeyStage, heatScore, issueFlags to every existing FAQ document
 *      that doesn't already have them (idempotent — safe to re-run).
 *   2. Creates the compound index used by the journey endpoint.
 *
 * No existing fields are touched.
 */

import 'dotenv/config';
import mongoose from 'mongoose';

const MONGO_URI = process.env.MONGODB_URI!;
if (!MONGO_URI) throw new Error('MONGODB_URI is not set');

// Journey stage ordering (used for sort in the API)
export const JOURNEY_STAGE_ORDER = [
  'pre_application',
  'interview',
  'result_offer',
  'noc_paperwork',
  'day_one',
  'phase1_vibe',
  'team_formation',
  'phase2_project',
  'completion',
] as const;

export type JourneyStage = typeof JOURNEY_STAGE_ORDER[number];

async function run() {
  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection.db!;
  const col = db.collection('yaksha_faq_faqs');

  // 1. Backfill missing fields with defaults
  const result = await col.updateMany(
    {
      $or: [
        { journeyStage: { $exists: false } },
        { heatScore: { $exists: false } },
        { issueFlags: { $exists: false } },
        { helpfulCount: { $exists: false } },
        { flagCount: { $exists: false } },
        { journeyOrder: { $exists: false } },
      ],
    },
    {
      $set: {
        journeyStage: 'pre_application',
        heatScore: 0,
        issueFlags: [] as string[],
        helpfulCount: 0,
        flagCount: 0,
        journeyOrder: 0,
      },
    }
  );

  console.log(`[migration] Updated ${result.modifiedCount} FAQ documents`);

  // 2. Create compound index for the journey endpoint query
  await col.createIndex(
    { journeyStage: 1, journeyOrder: 1, heatScore: -1 },
    { name: 'journey_stage_order_heat', background: true }
  );
  console.log('[migration] Index created: journey_stage_order_heat');

  await mongoose.disconnect();
  console.log('[migration] Done.');
}

run().catch((err) => {
  console.error('[migration] Failed:', err);
  process.exit(1);
});
