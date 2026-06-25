/**
 * useJourneyMap.ts  —  frontend/src/hooks/useJourneyMap.ts
 *
 * Fetches journey map data from GET /api/faq/journey.
 * Handles loading, error, and filter state.
 *
 * Usage:
 *   const { data, loading, error, refetch, setFilter, filter } = useJourneyMap();
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../utils/api';
import type {
  JourneyMapPayload,
  JourneyFilter,
  FeedbackVote,
} from '../journey.types';

interface UseJourneyMapReturn {
  data: JourneyMapPayload | null;
  loading: boolean;
  error: string | null;
  filter: JourneyFilter;
  setFilter: (f: JourneyFilter) => void;
  search: string;
  setSearch: (s: string) => void;
  submitFeedback: (faqId: string, vote: FeedbackVote) => Promise<void>;
  refetch: () => void;
}

export function useJourneyMap(batchId?: string): UseJourneyMapReturn {
  const [data, setData] = useState<JourneyMapPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<JourneyFilter>('all');
  const [search, setSearch] = useState('');
  const [fetchKey, setFetchKey] = useState(0);

  // Track local feedback votes in memory so the UI updates immediately
  // without waiting for the next full refetch
  const localVotes = useRef<Map<string, FeedbackVote>>(new Map());

  const refetch = useCallback(() => setFetchKey((k) => k + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    if (filter !== 'all') params.set('filter', filter);
    if (batchId) params.set('batchId', batchId);

    api
      .get<{ ok: boolean; data: JourneyMapPayload }>(`/api/faq/journey?${params}`)
      .then((res) => {
        if (!cancelled) setData(res.data.data);
      })
      .catch((err) => {
        if (!cancelled) setError(err?.response?.data?.error ?? 'Failed to load journey map');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [filter, batchId, fetchKey]);

  const submitFeedback = useCallback(
    async (faqId: string, vote: FeedbackVote) => {
      // Optimistic update
      const prev = localVotes.current.get(faqId);
      localVotes.current.set(faqId, vote);

      setData((prev_data) => {
        if (!prev_data) return prev_data;
        return {
          ...prev_data,
          groups: prev_data.groups.map((g) => ({
            ...g,
            faqs: g.faqs.map((f) => {
              if (f._id !== faqId) return f;
              const delta = vote === 'helpful' ? 1 : 0;
              const flagDelta = vote === 'needs_update' ? 1 : 0;
              return {
                ...f,
                helpfulCount: f.helpfulCount + delta,
                flagCount: f.flagCount + flagDelta,
              };
            }),
          })),
        };
      });

      try {
        await api.post(`/api/faq/${faqId}/feedback`, { vote });
      } catch {
        // Revert optimistic update on error
        if (prev) localVotes.current.set(faqId, prev);
        else localVotes.current.delete(faqId);
        refetch();
      }
    },
    [refetch]
  );

  return { data, loading, error, filter, setFilter, search, setSearch, submitFeedback, refetch };
}
