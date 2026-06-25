/**
 * journey.types.ts  —  frontend/src/types/journey.types.ts
 *
 * Shared types for the FAQ Journey Health Map feature.
 * Keep in sync with the backend journeyController.ts shapes.
 */

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
export type HealthStatus = 'healthy' | 'needs_review' | 'critical';
export type FeedbackVote = 'helpful' | 'needs_update';
export type JourneyFilter = 'all' | 'hot' | 'issues' | 'stale';

export interface FAQJourneyItem {
  _id: string;
  question: string;
  answer: string;
  journeyStage: JourneyStage;
  journeyOrder: number;
  heatScore: number;         // 0–100, from SearchLog click-through data
  issueFlags: string[];      // human-readable issue descriptions
  helpfulCount: number;
  flagCount: number;
  freshnessStatus?: string;
  tags: string[];            // 'hot' | 'issues' | 'stale' | 'duplicate'
  health: HealthStatus;
}

export interface StageGroup {
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

export interface JourneyMapSummary {
  totalFaqs: number;
  healthyCount: number;
  issueCount: number;
  hotCount: number;
  criticalCount: number;
}

export interface JourneyMapPayload {
  groups: StageGroup[];
  summary: JourneyMapSummary;
}

// Tabler icon names per stage (must be valid ti- icon names)
export const STAGE_ICONS: Record<JourneyStage, string> = {
  pre_application: 'user-plus',
  interview:       'microphone',
  result_offer:    'file-check',
  noc_paperwork:   'building-school',
  day_one:         'rocket',
  phase1_vibe:     'school',
  team_formation:  'users',
  phase2_project:  'code',
  completion:      'certificate',
};

// Colour tokens per health status (Tailwind classes used in the component)
export const HEALTH_COLORS: Record<HealthStatus, {
  dot: string;
  badge: string;
  badgeText: string;
  label: string;
}> = {
  healthy: {
    dot:       'bg-emerald-500',
    badge:     'bg-emerald-50 dark:bg-emerald-950',
    badgeText: 'text-emerald-700 dark:text-emerald-300',
    label:     'Healthy',
  },
  needs_review: {
    dot:       'bg-amber-500',
    badge:     'bg-amber-50 dark:bg-amber-950',
    badgeText: 'text-amber-700 dark:text-amber-300',
    label:     'Needs review',
  },
  critical: {
    dot:       'bg-red-500',
    badge:     'bg-red-50 dark:bg-red-950',
    badgeText: 'text-red-700 dark:text-red-300',
    label:     'Critical issue',
  },
};
