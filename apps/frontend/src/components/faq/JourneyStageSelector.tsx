/**
 * JourneyStageSelector.tsx  —  frontend/src/components/faq/JourneyStageSelector.tsx
 *
 * Drop-in selector for the AdminFAQs edit modal.
 * Lets admins assign a journeyStage and journeyOrder to any FAQ.
 *
 * Usage inside AdminFAQs.tsx (in your existing FAQ edit form):
 *   import { JourneyStageSelector } from '../components/faq/JourneyStageSelector';
 *   ...
 *   <JourneyStageSelector
 *     value={faq.journeyStage}
 *     order={faq.journeyOrder}
 *     onChange={(stage, order) => setFaq({ ...faq, journeyStage: stage, journeyOrder: order })}
 *   />
 */

import React from 'react';
import { JOURNEY_STAGE_ORDER } from '../../journey.types';
import type { JourneyStage } from '../../journey.types';

const STAGE_LABELS: Record<JourneyStage, string> = {
  pre_application: 'Before you apply',
  interview:       'The Yaksha interview',
  result_offer:    'Result & offer letter',
  noc_paperwork:   'NOC & college paperwork',
  day_one:         'Day 1 — onboarding',
  phase1_vibe:     'Phase 1 — ViBe coursework',
  team_formation:  'Team formation',
  phase2_project:  'Phase 2 — project work',
  completion:      'Completion & certificate',
};

interface JourneyStageSelectorProps {
  value: JourneyStage;
  order: number;
  onChange: (stage: JourneyStage, order: number) => void;
  className?: string;
}

export function JourneyStageSelector({
  value,
  order,
  onChange,
  className = '',
}: JourneyStageSelectorProps) {
  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      <div>
        <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5 block">
          Journey stage
        </label>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value as JourneyStage, order)}
          className="w-full text-sm rounded-lg border border-gray-200 dark:border-gray-700
                     bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100
                     px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          {JOURNEY_STAGE_ORDER.map((s) => (
            <option key={s} value={s}>
              {JOURNEY_STAGE_LABELS[s]}
            </option>
          ))}
        </select>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
          Controls where this FAQ appears in the journey map timeline.
        </p>
      </div>

      <div>
        <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5 block">
          Order within stage
        </label>
        <input
          type="number"
          min={0}
          max={999}
          value={order}
          onChange={(e) => onChange(value, parseInt(e.target.value, 10) || 0)}
          className="w-24 text-sm rounded-lg border border-gray-200 dark:border-gray-700
                     bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100
                     px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
          Lower numbers appear first. 0 = top of stage.
        </p>
      </div>
    </div>
  );
}

// Named export for the stage labels (re-used in AdminFAQs table column)
export const JOURNEY_STAGE_LABELS = STAGE_LABELS;
