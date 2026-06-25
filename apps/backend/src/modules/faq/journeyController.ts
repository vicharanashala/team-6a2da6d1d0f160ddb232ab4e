/**
 * journeyController.ts  —  backend/controllers/journeyController.ts
 *
 * Three exported handlers:
 *   getJourneyMap         GET  /api/faq/journey
 *   submitFeedback        POST /api/faq/:id/feedback
 *   recalculateHeatScores POST /api/admin/faq/heat-sync
 */

import { Request, Response } from 'express';
import mongoose from 'mongoose';
import FAQ from '../models/FAQ.js';
import SearchLog from '../models/SearchLog.js';
import Batch from '../models/Batch.js';
import { getCache, setCache } from '../utils/cache.js';
import { JOURNEY_STAGE_ORDER, JOURNEY_STAGE_META } from './FAQ.schema-patch.js';

// ── Types ────────────────────────────────────────────────────────────────────

type JourneyStage = typeof JOURNEY_STAGE_ORDER[number];
type HealthStatus = 'healthy' | 'needs_review' | 'critical';

interface FAQJourneyItem {
  _id: string;
  question: string;
  answer: string;
  journeyStage: JourneyStage;
  journeyOrder: number;
  heatScore: number;
  issueFlags: string[];
  helpfulCount: number;
  flagCount: number;
  freshnessStatus?: string;  // from existing FreshnessBadge logic
  tags: string[];            // derived from heatScore + issueFlags
  health: HealthStatus;      // derived
}

interface StageGroup {
  stage: JourneyStage;
  label: string;
  icon: string;
  description: string;
  health: HealthStatus;
  faqCount: number;
  issueCount: number;
  hotCount: number;
  faqs: FAQJourneyItem[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function deriveHealth(issueFlags: string[], heatScore: number, flagCount: number, helpfulCount: number): HealthStatus {
  // Critical: has a known issue flag that contains CRITICAL keyword
  if (issueFlags.some(f => f.toLowerCase().includes('critical'))) return 'critical';
  // Critical: high flag ratio (many interns flagged as wrong vs helpful)
  const totalFeedback = flagCount + helpfulCount;
  if (totalFeedback >= 5 && flagCount / totalFeedback > 0.3) return 'critical';
  // Needs review: has any issue flags
  if (issueFlags.length > 0) return 'needs_review';
  // Needs review: moderate flag ratio
  if (totalFeedback >= 3 && flagCount / totalFeedback > 0.15) return 'needs_review';
  return 'healthy';
}

function deriveTags(faq: FAQJourneyItem): string[] {
  const tags: string[] = [];
  if (faq.heatScore >= 75) tags.push('hot');
  if (faq.issueFlags.length > 0) tags.push('issues');
  if (faq.freshnessStatus === 'under_review') tags.push('stale');
  if (faq.issueFlags.some(f => f.toLowerCase().includes('duplicate'))) tags.push('duplicate');
  return tags;
}

function deriveStageHealth(faqs: FAQJourneyItem[]): HealthStatus {
  if (faqs.some(f => f.health === 'critical')) return 'critical';
  if (faqs.some(f => f.health === 'needs_review')) return 'needs_review';
  return 'healthy';
}

// ── getJourneyMap ─────────────────────────────────────────────────────────────

export async function getJourneyMap(req: Request, res: Response) {
  try {
    const { stage, filter, batchId } = req.query as Record<string, string>;

    // Resolve batch
    let resolvedBatchId: mongoose.Types.ObjectId | undefined;
    if (batchId) {
      resolvedBatchId = new mongoose.Types.ObjectId(batchId);
    } else {
      const currentBatch = await Batch.findOne({ isCurrent: true }).select('_id').lean();
      if (currentBatch) resolvedBatchId = currentBatch._id as mongoose.Types.ObjectId;
    }

    // Cache key
    const cacheKey = `journey:${resolvedBatchId?.toString() ?? 'all'}:${stage ?? 'all'}:${filter ?? 'all'}`;
    const cached = getCache<StageGroup[]>(cacheKey);
    if (cached) return res.json({ ok: true, data: cached, cached: true });

    // Build query
    const query: Record<string, unknown> = {
      status: 'approved',
      ...(resolvedBatchId && { batchId: resolvedBatchId }),
      ...(stage && { journeyStage: stage }),
    };

    // Apply convenience filters
    if (filter === 'hot') query.heatScore = { $gte: 75 };
    if (filter === 'issues') query.issueFlags = { $not: { $size: 0 } };
    if (filter === 'stale') query['freshness.reviewStatus'] = 'pending_review';

    // Fetch FAQs (never include embedding)
    const rawFaqs = await FAQ.find(query)
      .select(
        'question answer journeyStage journeyOrder heatScore issueFlags helpfulCount flagCount freshness'
      )
      .sort({ journeyOrder: 1, heatScore: -1 })
      .lean<Array<{
        _id: mongoose.Types.ObjectId;
        question: string;
        answer: string;
        journeyStage: JourneyStage;
        journeyOrder: number;
        heatScore: number;
        issueFlags: string[];
        helpfulCount: number;
        flagCount: number;
        freshness?: { reviewStatus?: string };
      }>>();

    // Shape into FAQJourneyItem
    const shaped: FAQJourneyItem[] = rawFaqs.map((f) => {
      const base: FAQJourneyItem = {
        _id: f._id.toString(),
        question: f.question,
        answer: f.answer,
        journeyStage: f.journeyStage ?? 'pre_application',
        journeyOrder: f.journeyOrder ?? 0,
        heatScore: f.heatScore ?? 0,
        issueFlags: f.issueFlags ?? [],
        helpfulCount: f.helpfulCount ?? 0,
        flagCount: f.flagCount ?? 0,
        freshnessStatus: f.freshness?.reviewStatus,
        tags: [],
        health: 'healthy',
      };
      base.health = deriveHealth(base.issueFlags, base.heatScore, base.flagCount, base.helpfulCount);
      base.tags = deriveTags(base);
      return base;
    });

    // Group by stage in journey order
    const stageMap = new Map<JourneyStage, FAQJourneyItem[]>();
    for (const s of JOURNEY_STAGE_ORDER) stageMap.set(s, []);
    for (const faq of shaped) {
      const arr = stageMap.get(faq.journeyStage);
      if (arr) arr.push(faq);
    }

    const groups: StageGroup[] = [];
    for (const s of JOURNEY_STAGE_ORDER) {
      const faqs = stageMap.get(s)!;
      // Skip empty stages only if a specific stage filter isn't applied
      if (!stage && faqs.length === 0) continue;
      const meta = JOURNEY_STAGE_META[s];
      groups.push({
        stage: s,
        label: meta.label,
        icon: meta.icon,
        description: meta.description,
        health: deriveStageHealth(faqs),
        faqCount: faqs.length,
        issueCount: faqs.filter(f => f.issueFlags.length > 0).length,
        hotCount: faqs.filter(f => f.heatScore >= 75).length,
        faqs,
      });
    }

    // Summary stats across all stages (always full, not filtered)
    const summary = {
      totalFaqs: shaped.length,
      healthyCount: shaped.filter(f => f.health === 'healthy').length,
      issueCount: shaped.filter(f => f.issueFlags.length > 0).length,
      hotCount: shaped.filter(f => f.heatScore >= 75).length,
      criticalCount: shaped.filter(f => f.health === 'critical').length,
    };

    const payload = { groups, summary };
    setCache(cacheKey, groups, 5 * 60 * 1000); // 5 min TTL

    return res.json({ ok: true, data: payload });
  } catch (err) {
    console.error('[journey] getJourneyMap error:', err);
    return res.status(500).json({ ok: false, error: 'Failed to load journey map' });
  }
}

// ── submitFeedback ─────────────────────────────────────────────────────────────

export async function submitFeedback(req: Request, res: Response) {
  const { id } = req.params;
  const { vote } = req.body as { vote: 'helpful' | 'needs_update' };

  if (!['helpful', 'needs_update'].includes(vote)) {
    return res.status(400).json({ ok: false, error: 'vote must be "helpful" or "needs_update"' });
  }
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ ok: false, error: 'Invalid FAQ id' });
  }

  try {
    const update =
      vote === 'helpful'
        ? { $inc: { helpfulCount: 1 } }
        : { $inc: { flagCount: 1 } };

    const faq = await FAQ.findByIdAndUpdate(id, update, { new: true })
      .select('flagCount helpfulCount issueFlags reviewStatus')
      .lean<{ flagCount: number; helpfulCount: number; issueFlags: string[]; reviewStatus?: string }>();

    if (!faq) return res.status(404).json({ ok: false, error: 'FAQ not found' });

    // Auto-flag for review if flagCount exceeds 15% of total feedback
    const total = faq.flagCount + faq.helpfulCount;
    const shouldAutoFlag =
      total >= 5 && faq.flagCount / total > 0.15 && faq.reviewStatus !== 'pending_review';

    if (shouldAutoFlag && vote === 'needs_update') {
      await FAQ.findByIdAndUpdate(id, {
        $set: {
          reviewStatus: 'pending_review',
          flagType: 'user_feedback',
        },
      });
    }

    return res.json({
      ok: true,
      flagCount: faq.flagCount,
      helpfulCount: faq.helpfulCount,
      autoFlagged: shouldAutoFlag,
    });
  } catch (err) {
    console.error('[journey] submitFeedback error:', err);
    return res.status(500).json({ ok: false, error: 'Failed to submit feedback' });
  }
}

// ── recalculateHeatScores ─────────────────────────────────────────────────────

/**
 * For each approved FAQ in the current batch, count how many unique
 * SearchLog entries in the last 30 days matched (or were later resolved to)
 * that FAQ, then normalize to a 0–100 score relative to the max in the batch.
 *
 * This is intentionally simple — no heavy ML needed. The SearchLog already
 * records `resolvedFaqId` when a search result is clicked. We count those.
 *
 * Called by: POST /api/admin/faq/heat-sync (manual)
 *            heatScoreCron.ts (daily at 03:00 IST)
 */
export async function recalculateHeatScores(req: Request, res: Response) {
  try {
    const currentBatch = await Batch.findOne({ isCurrent: true }).select('_id').lean();
    if (!currentBatch) return res.status(404).json({ ok: false, error: 'No current batch found' });

    const batchId = currentBatch._id;
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Aggregate click-throughs per FAQ from SearchLog
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
      return res.json({ ok: true, message: 'No SearchLog data yet — heat scores unchanged' });
    }

    const maxCount = Math.max(...clickCounts.map((c) => c.count));

    // Bulk update with $set
    const bulkOps = clickCounts.map(({ _id, count }) => ({
      updateOne: {
        filter: { _id, batchId, status: 'approved' },
        update: { $set: { heatScore: Math.round((count / maxCount) * 100) } },
      },
    }));

    const result = await FAQ.bulkWrite(bulkOps, { ordered: false });

    // Zero out FAQs with no clicks in this window
    await FAQ.updateMany(
      {
        batchId,
        status: 'approved',
        _id: { $nin: clickCounts.map((c) => c._id) },
      },
      { $set: { heatScore: 0 } }
    );

    return res.json({
      ok: true,
      updated: result.modifiedCount,
      maxClicks: maxCount,
      batchId,
    });
  } catch (err) {
    console.error('[journey] recalculateHeatScores error:', err);
    return res.status(500).json({ ok: false, error: 'Heat score recalculation failed' });
  }
}
