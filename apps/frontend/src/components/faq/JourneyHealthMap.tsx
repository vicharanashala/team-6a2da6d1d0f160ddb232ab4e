/**
 * JourneyHealthMap.tsx  —  frontend/src/components/faq/JourneyHealthMap.tsx
 *
 * The main FAQ Journey Health Map component.
 *
 * Features:
 *  - Journey-ordered accordion (pre_application → completion)
 *  - Per-FAQ heat bar (from SearchLog click-through data)
 *  - Per-FAQ issue flags from audit pipeline
 *  - Inline helpful / needs-update feedback
 *  - Filter bar (all / hot / issues / stale)
 *  - Debounced search across questions + answers
 *  - Health dot per stage (healthy / needs_review / critical)
 *  - Skeleton loader while fetching
 *
 * Usage:
 *   <JourneyHealthMap />          — in FAQPage or as a new /journey route
 *   <JourneyHealthMap batchId="..." />  — scoped to a specific batch
 */

import React, { useState, useMemo, useCallback, useRef } from 'react';
import { useJourneyMap } from '../../hooks/useJourneyMap';
import type {
  StageGroup,
  FAQJourneyItem,
  JourneyFilter,
  FeedbackVote,
  HealthStatus,
} from '../../journey.types';
import { HEALTH_COLORS } from '../../journey.types';
import { FreshnessBadge } from './FreshnessBadge';

// ── Sub-components ────────────────────────────────────────────────────────────

interface HeatBarProps {
  score: number; // 0–100
}
function HeatBar({ score }: HeatBarProps) {
  const color =
    score >= 75 ? '#ef4444' :   // red-500
    score >= 50 ? '#f59e0b' :   // amber-500
                  '#10b981';    // emerald-500
  return (
    <div className="flex items-center gap-2 flex-1">
      <span className="text-xs text-gray-400 dark:text-gray-500 tabular-nums w-8 text-right">
        {score}%
      </span>
      <div className="flex-1 h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${score}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

interface TagPillProps {
  tag: string;
}
function TagPill({ tag }: TagPillProps) {
  const styles: Record<string, string> = {
    hot:       'bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300',
    issues:    'bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300',
    stale:     'bg-pink-50 dark:bg-pink-950 text-pink-700 dark:text-pink-300',
    duplicate: 'bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-300',
  };
  const labels: Record<string, string> = {
    hot:       '🔥 High-traffic',
    issues:    '⚠ Issue flagged',
    stale:     '⏳ Stale',
    duplicate: '⎘ Duplicate',
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${styles[tag] ?? 'bg-gray-100 text-gray-600'}`}>
      {labels[tag] ?? tag}
    </span>
  );
}

interface FeedbackButtonsProps {
  faqId: string;
  voted: FeedbackVote | null;
  onVote: (id: string, vote: FeedbackVote) => void;
}
function FeedbackButtons({ faqId, voted, onVote }: FeedbackButtonsProps) {
  return (
    <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={() => onVote(faqId, 'helpful')}
        className={`text-xs px-2.5 py-1 rounded-full border transition-colors
          ${voted === 'helpful'
            ? 'bg-emerald-50 dark:bg-emerald-950 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300'
            : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
          }`}
        aria-label="Mark as helpful"
      >
        👍 {voted === 'helpful' ? 'Helped' : 'Helpful'}
      </button>
      <button
        onClick={() => onVote(faqId, 'needs_update')}
        className={`text-xs px-2.5 py-1 rounded-full border transition-colors
          ${voted === 'needs_update'
            ? 'bg-amber-50 dark:bg-amber-950 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300'
            : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
          }`}
        aria-label="Flag as needing update"
      >
        ✎ Needs update
      </button>
    </div>
  );
}

interface FAQCardProps {
  faq: FAQJourneyItem;
  voted: FeedbackVote | null;
  onVote: (id: string, vote: FeedbackVote) => void;
  searchTerm: string;
}
function FAQCard({ faq, voted, onVote, searchTerm }: FAQCardProps) {
  const [expanded, setExpanded] = useState(false);

  // Highlight search term in question text
  function highlight(text: string): React.ReactNode {
    if (!searchTerm) return text;
    const idx = text.toLowerCase().indexOf(searchTerm.toLowerCase());
    if (idx === -1) return text;
    return (
      <>
        {text.slice(0, idx)}
        <mark className="bg-yellow-100 dark:bg-yellow-900 rounded">{text.slice(idx, idx + searchTerm.length)}</mark>
        {text.slice(idx + searchTerm.length)}
      </>
    );
  }

  return (
    <div
      className={`border rounded-xl bg-white dark:bg-gray-900 transition-colors cursor-pointer
        ${expanded
          ? 'border-gray-300 dark:border-gray-600'
          : 'border-gray-100 dark:border-gray-800 hover:border-gray-200 dark:hover:border-gray-700'
        }`}
      onClick={() => setExpanded((e) => !e)}
    >
      {/* Question row */}
      <div className="flex items-start gap-3 px-4 py-3">
        <span className="text-gray-300 dark:text-gray-600 mt-0.5 flex-shrink-0 text-sm">Q</span>
        <span className="text-sm text-gray-800 dark:text-gray-200 flex-1 leading-snug">
          {highlight(faq.question)}
        </span>
        <svg
          className={`w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {/* Tag pills (always visible) */}
      {faq.tags.length > 0 && (
        <div className="flex gap-1.5 px-4 pb-2 flex-wrap">
          {faq.tags.map((t) => <TagPill key={t} tag={t} />)}
        </div>
      )}

      {/* Expanded answer */}
      {expanded && (
        <div
          className="px-4 pb-4 pt-2 border-t border-gray-100 dark:border-gray-800"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed mb-3">
            {faq.answer}
          </p>

          {/* Issue flags */}
          {faq.issueFlags.map((flag, i) => (
            <div
              key={i}
              className="flex items-start gap-2 text-xs text-red-700 dark:text-red-300
                         bg-red-50 dark:bg-red-950 rounded-lg px-3 py-2 mb-2"
            >
              <span className="flex-shrink-0 mt-0.5" aria-hidden="true">⚠</span>
              <span>{flag}</span>
            </div>
          ))}

          {/* Freshness badge if present */}
          {faq.freshnessStatus && faq.freshnessStatus !== 'verified' && (
            <div className="mb-3">
              <FreshnessBadge status={faq.freshnessStatus} />
            </div>
          )}

          {/* Footer: heat bar + feedback */}
          <div className="flex items-center gap-3 mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
            <span className="text-xs text-gray-400">Asked by</span>
            <HeatBar score={faq.heatScore} />
            <span className="text-xs text-gray-400">interns</span>
            <FeedbackButtons faqId={faq._id} voted={voted} onVote={onVote} />
          </div>
        </div>
      )}
    </div>
  );
}

interface StageAccordionProps {
  group: StageGroup;
  defaultOpen: boolean;
  votedFaqs: Map<string, FeedbackVote>;
  onVote: (id: string, vote: FeedbackVote) => void;
  searchTerm: string;
}
function StageAccordion({ group, defaultOpen, votedFaqs, onVote, searchTerm }: StageAccordionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const hc = HEALTH_COLORS[group.health];

  return (
    <div className="relative pl-8">
      {/* Timeline dot */}
      <div
        className={`absolute left-0 top-3.5 w-4 h-4 rounded-full border-2 border-white dark:border-gray-950 ${hc.dot}`}
        aria-hidden="true"
      />

      {/* Stage header */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border
                   border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900
                   hover:bg-white dark:hover:bg-gray-800 transition-colors text-left"
        aria-expanded={open}
      >
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${hc.dot}`} aria-hidden="true" />
        <span className="text-sm font-medium text-gray-800 dark:text-gray-200 flex-1">
          {group.label}
        </span>
        <span className="flex items-center gap-2">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${hc.badge} ${hc.badgeText}`}>
            {hc.label}
          </span>
          <span className="text-xs text-gray-400 dark:text-gray-500">
            {group.faqCount} {group.faqCount === 1 ? 'entry' : 'entries'}
          </span>
          {group.issueCount > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400">
              {group.issueCount} issue{group.issueCount > 1 ? 's' : ''}
            </span>
          )}
        </span>
        <svg
          className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* FAQ list */}
      {open && (
        <div className="mt-2 flex flex-col gap-2 ml-1">
          {group.faqs.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-600 px-4 py-3">
              No entries match the current filter.
            </p>
          ) : (
            group.faqs.map((faq) => (
              <FAQCard
                key={faq._id}
                faq={faq}
                voted={votedFaqs.get(faq._id) ?? null}
                onVote={onVote}
                searchTerm={searchTerm}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-3">
      <p className={`text-2xl font-medium ${color}`}>{value}</p>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{label}</p>
    </div>
  );
}

function SkeletonStage() {
  return (
    <div className="pl-8 relative">
      <div className="absolute left-0 top-3.5 w-4 h-4 rounded-full bg-gray-200 dark:bg-gray-700" />
      <div className="h-12 rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface JourneyHealthMapProps {
  batchId?: string;
  className?: string;
}

export function JourneyHealthMap({ batchId, className = '' }: JourneyHealthMapProps) {
  const { data, loading, error, filter, setFilter, search, setSearch, submitFeedback } =
    useJourneyMap(batchId);

  // Track votes locally (optimistic)
  const [votedFaqs, setVotedFaqs] = useState<Map<string, FeedbackVote>>(new Map());

  const handleVote = useCallback(
    async (faqId: string, vote: FeedbackVote) => {
      setVotedFaqs((prev) => {
        const next = new Map(prev);
        if (next.get(faqId) === vote) next.delete(faqId); // toggle off
        else next.set(faqId, vote);
        return next;
      });
      await submitFeedback(faqId, vote);
    },
    [submitFeedback]
  );

  // Client-side search filter applied on top of server filter
  const filteredGroups = useMemo(() => {
    if (!data || !search.trim()) return data?.groups ?? [];
    const q = search.toLowerCase();
    return data.groups
      .map((g) => ({
        ...g,
        faqs: g.faqs.filter(
          (f) =>
            f.question.toLowerCase().includes(q) ||
            f.answer.toLowerCase().includes(q)
        ),
      }))
      .filter((g) => g.faqs.length > 0);
  }, [data, search]);

  const FILTERS: { value: JourneyFilter; label: string }[] = [
    { value: 'all',    label: 'All stages' },
    { value: 'hot',    label: '🔥 High-traffic' },
    { value: 'issues', label: '⚠ Has issues' },
    { value: 'stale',  label: '⏳ Stale / drift' },
  ];

  return (
    <section className={`max-w-2xl mx-auto ${className}`} aria-label="FAQ journey health map">
      {/* Header */}
      <div className="mb-5">
        <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">
          FAQ journey map
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Browse every FAQ in the order you'll actually encounter it, with live health signals.
        </p>
      </div>

      {/* Summary cards */}
      {data && (
        <div className="grid grid-cols-4 gap-2 mb-5">
          <SummaryCard label="Total entries"   value={data.summary.totalFaqs}     color="text-gray-800 dark:text-gray-200" />
          <SummaryCard label="No issues"       value={data.summary.healthyCount}  color="text-emerald-600 dark:text-emerald-400" />
          <SummaryCard label="Flagged issues"  value={data.summary.issueCount}    color="text-red-600 dark:text-red-400" />
          <SummaryCard label="High-traffic"    value={data.summary.hotCount}      color="text-amber-600 dark:text-amber-400" />
        </div>
      )}

      {/* Search + filters */}
      <div className="flex flex-wrap gap-2 mb-5">
        <input
          type="search"
          placeholder="Search questions…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[180px] text-sm rounded-lg border border-gray-200 dark:border-gray-700
                     bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100
                     px-3 py-2 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          aria-label="Search FAQ entries"
        />
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`text-xs px-3 py-2 rounded-full border transition-colors
              ${filter === f.value
                ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 border-gray-900 dark:border-gray-100'
                : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Error state */}
      {error && (
        <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950
                        rounded-xl px-4 py-3 mb-4">
          {error}
        </div>
      )}

      {/* Timeline */}
      <div className="relative">
        {/* Vertical line */}
        <div
          className="absolute left-1.5 top-5 bottom-5 w-px bg-gray-200 dark:bg-gray-800"
          aria-hidden="true"
        />

        <div className="flex flex-col gap-3">
          {loading
            ? Array.from({ length: 6 }).map((_, i) => <SkeletonStage key={i} />)
            : filteredGroups.length === 0
            ? (
              <p className="text-sm text-gray-400 dark:text-gray-600 text-center py-10 pl-8">
                No FAQ entries match your current filter.
              </p>
            )
            : filteredGroups.map((group, i) => (
              <StageAccordion
                key={group.stage}
                group={group}
                defaultOpen={i === 0}
                votedFaqs={votedFaqs}
                onVote={handleVote}
                searchTerm={search}
              />
            ))
          }
        </div>
      </div>
    </section>
  );
}

export default JourneyHealthMap;
