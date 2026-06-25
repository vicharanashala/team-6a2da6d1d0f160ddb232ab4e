/**
 * heatScoreCron.ts  —  backend/scripts/heatScoreCron.ts
 *
 * Daily cron job that recalculates FAQ heatScore values from SearchLog data.
 *
 * Schedule: daily at 03:00 IST (21:30 UTC previous day)
 * Trigger:  add to your existing cron scheduler in server.ts alongside
 *           the FAQ audit and freshness crons.
 *
 * Usage in server.ts:
 *   import { scheduleHeatScoreCron } from './scripts/heatScoreCron.js';
 *   scheduleHeatScoreCron();   // call after DB connects
 *
 * The cron uses node-cron (already in your package.json as a transitive dep
 * via express-rate-limit or agenda — add it explicitly if needed):
 *   npm install node-cron
 *   npm install -D @types/node-cron
 */

import cron from 'node-cron';
import mongoose from 'mongoose';
import FAQ from '../models/FAQ.js';
import SearchLog from '../models/SearchLog.js';
import Batch from '../models/Batch.js';
import { cronLog } from '../utils/logger.js';

async function runHeatScoreRecalc(): Promise<void> {
  cronLog.info('[ cron ] heatScoreCron: starting heat score recalculation');

  const currentBatch = await Batch.findOne({ isCurrent: true }).select('_id').lean();
  if (!currentBatch) {
    cronLog.warn('[ cron ] heatScoreCron: no current batch — skipping');
    return;
  }

  const batchId = currentBatch._id;
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // Count SearchLog entries that resolved to a specific FAQ (via click-through)
  const clickCounts = await SearchLog.aggregate([
    {
      $match: {
        resolvedFaqId: { $exists: true, $ne: null },
        createdAt: { $gte: since },
      },
    },
    {
      $group: {
        _id: '$resolvedFaqId',
        count: { $sum: 1 },
      },
    },
  ]);

  if (clickCounts.length === 0) {
    cronLog.info('[ cron ] heatScoreCron: no SearchLog data — all heat scores set to 0');
    await FAQ.updateMany(
      { batchId, status: 'approved' },
      { $set: { heatScore: 0 } }
    );
    return;
  }

  const maxCount = Math.max(...clickCounts.map((c: { count: number }) => c.count));

  // Bulk write normalized scores
  const bulkOps = clickCounts.map((c: { _id: mongoose.Types.ObjectId; count: number }) => ({
    updateOne: {
      filter: { _id: c._id, batchId, status: 'approved' },
      update: { $set: { heatScore: Math.round((c.count / maxCount) * 100) } },
    },
  }));

  const bulkResult = await FAQ.bulkWrite(bulkOps, { ordered: false });

  // FAQs with zero clicks this window get score 0
  await FAQ.updateMany(
    {
      batchId,
      status: 'approved',
      _id: { $nin: clickCounts.map((c: { _id: mongoose.Types.ObjectId }) => c._id) },
    },
    { $set: { heatScore: 0 } }
  );

  cronLog.info(
    `[ cron ] heatScoreCron: done — ${bulkResult.modifiedCount} FAQs updated, maxClicks=${maxCount}`
  );
}

export function scheduleHeatScoreCron(): void {
  // Run at 03:00 IST = 21:30 UTC
  cron.schedule('30 21 * * *', async () => {
    try {
      await runHeatScoreRecalc();
    } catch (err) {
      cronLog.error('[ cron ] heatScoreCron: unhandled error', err);
    }
  });
  cronLog.info('[ cron ] heatScoreCron: scheduled (daily 03:00 IST)');
}

// Also export for manual admin trigger
export { runHeatScoreRecalc };
