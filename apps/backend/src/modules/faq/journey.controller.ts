import { Request, Response } from 'express';
import mongoose from 'mongoose';
import FAQ from './faq.model.js';

const JOURNEY_STAGE_ORDER = [
  'pre_application','interview','result_offer','noc_paperwork',
  'day_one','phase1_vibe','team_formation','phase2_project','completion',
] as const;

const STAGE_META: Record<string, { label: string; description: string }> = {
  pre_application: { label: 'Before you apply', description: 'Eligibility and programme overview' },
  interview:       { label: 'The Yaksha interview', description: 'How the AI interview works' },
  result_offer:    { label: 'Result & offer letter', description: 'Finding and accepting your offer' },
  noc_paperwork:   { label: 'NOC & college paperwork', description: 'Getting your NOC signed' },
  day_one:         { label: 'Day 1 — onboarding', description: 'Communication channels and code of conduct' },
  phase1_vibe:     { label: 'Phase 1 — ViBe coursework', description: 'Logging in and completing courses' },
  team_formation:  { label: 'Team formation', description: 'Finding team members and naming your team' },
  phase2_project:  { label: 'Phase 2 — project work', description: 'Mentorship and deliverables' },
  completion:      { label: 'Completion & certificate', description: 'Silver criteria and certificate' },
};

export async function getJourneyMap(req: Request, res: Response) {
  try {
    const faqs = await FAQ.find({ status: 'approved' })
      .select('question answer journeyStage journeyOrder heatScore issueFlags helpfulCount flagCount freshness category')
      .sort({ journeyOrder: 1, heatScore: -1 })
      .lean();

    const stageMap = new Map<string, any[]>();
    for (const s of JOURNEY_STAGE_ORDER) stageMap.set(s, []);

    for (const faq of faqs) {
      const stage = (faq as any).journeyStage ?? 'pre_application';
      const arr = stageMap.get(stage);
      if (arr) arr.push({
        _id: faq._id,
        question: faq.question,
        answer: faq.answer,
        journeyStage: stage,
        heatScore: (faq as any).heatScore ?? 0,
        issueFlags: (faq as any).issueFlags ?? [],
        helpfulCount: (faq as any).helpfulCount ?? 0,
        flagCount: (faq as any).flagCount ?? 0,
        tags: [
          ...((faq as any).heatScore >= 75 ? ['hot'] : []),
          ...((faq as any).issueFlags?.length > 0 ? ['issues'] : []),
        ],
        health: (faq as any).issueFlags?.length > 0 ? 'needs_review' : 'healthy',
      });
    }

    const groups = JOURNEY_STAGE_ORDER
      .map(s => ({
        stage: s,
        label: STAGE_META[s].label,
        description: STAGE_META[s].description,
        health: stageMap.get(s)!.some((f: any) => f.issueFlags?.length > 0) ? 'needs_review' : 'healthy',
        faqCount: stageMap.get(s)!.length,
        issueCount: stageMap.get(s)!.filter((f: any) => f.issueFlags?.length > 0).length,
        hotCount: stageMap.get(s)!.filter((f: any) => f.heatScore >= 75).length,
        faqs: stageMap.get(s)!,
      }))
      .filter(g => g.faqCount > 0);

    const summary = {
      totalFaqs: faqs.length,
      healthyCount: faqs.filter((f: any) => !f.issueFlags?.length).length,
      issueCount: faqs.filter((f: any) => f.issueFlags?.length > 0).length,
      hotCount: faqs.filter((f: any) => (f as any).heatScore >= 75).length,
    };

    return res.json({ ok: true, data: { groups, summary } });
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'Failed to load journey map' });
  }
}

export async function submitJourneyFeedback(req: Request, res: Response) {
  const { id } = req.params;
  const { vote } = req.body as { vote: 'helpful' | 'needs_update' };
  if (!['helpful', 'needs_update'].includes(vote)) {
    return res.status(400).json({ ok: false, error: 'vote must be helpful or needs_update' });
  }
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ ok: false, error: 'Invalid FAQ id' });
  }
  try {
    const update = vote === 'helpful' ? { $inc: { helpfulCount: 1 } } : { $inc: { flagCount: 1 } };
    await FAQ.findByIdAndUpdate(id, update);
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'Failed to submit feedback' });
  }
}

export async function recalculateHeatScores(req: Request, res: Response) {
  return res.json({ ok: true, message: 'Heat score sync not yet implemented' });
}