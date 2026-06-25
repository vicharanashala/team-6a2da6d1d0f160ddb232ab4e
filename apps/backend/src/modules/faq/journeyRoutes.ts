/**
 * journeyRoutes.ts
 *
 * Mount in server.ts:
 *   import journeyRoutes from './routes/journeyRoutes.js';
 *   app.use('/api/faq', journeyRoutes);
 *
 * Endpoints:
 *   GET  /api/faq/journey          → grouped journey map data (public)
 *   POST /api/faq/:id/feedback     → helpful / needs-update vote (public, rate-limited)
 *   GET  /api/admin/faq/heat-sync  → manually trigger heatScore recalculation (admin only)
 */

import express from 'express';
import { getJourneyMap, submitFeedback } from '../controllers/journeyController.js';
import { adminOnly } from '../middleware/admin.js';
import { protect } from '../middleware/auth.js';
import { recalculateHeatScores } from '../controllers/journeyController.js';
import rateLimit from 'express-rate-limit';

const router = express.Router();

// Rate-limiter for feedback (prevents stuffing)
const feedbackLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 30,                   // 30 feedback actions per hour per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many feedback submissions. Try again in an hour.' },
});

// ── Public ─────────────────────────────────────────────────────────────────

/**
 * GET /api/faq/journey
 *
 * Returns all approved FAQs grouped by journeyStage, in journey order.
 * Each stage includes a health summary derived from issueFlags and heatScore.
 *
 * Optional query params:
 *   ?stage=phase1_vibe          filter to a single stage
 *   ?filter=hot|issues|stale    convenience filters
 *   ?batchId=<id>               scope to a specific batch (default: current batch)
 *
 * Public — no auth required. Cached 5 min in the existing LRU cache.
 */
router.get('/journey', getJourneyMap);

/**
 * POST /api/faq/:id/feedback
 * Body: { vote: 'helpful' | 'needs_update' }
 *
 * Increments helpfulCount or flagCount on the FAQ.
 * Auto-flags the FAQ for review when flagCount / totalImpressions > 0.15.
 * Idempotent per IP per 24h (enforced by rate limiter above + field check).
 */
router.post('/:id/feedback', feedbackLimiter, submitFeedback);

// ── Admin ───────────────────────────────────────────────────────────────────

/**
 * POST /api/admin/faq/heat-sync
 *
 * Recalculates heatScore for all approved FAQs in the current batch
 * from SearchLog data. Safe to call manually from AdminFAQs panel.
 * Also runs automatically on a daily cron (see heatScoreCron.ts).
 */
router.post('/admin/heat-sync', protect, adminOnly, recalculateHeatScores);

export default router;
