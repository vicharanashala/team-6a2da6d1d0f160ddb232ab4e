/**
 * AdminJourneyMap.tsx  —  frontend/src/admin/pages/AdminJourneyMap.tsx
 *
 * Admin page at /admin/journey-map
 *
 * Features:
 *  - Table of all FAQs with their current journeyStage
 *  - Bulk-assign stage via inline dropdown (saves on blur)
 *  - "Sync heat scores" button → calls POST /api/admin/faq/heat-sync
 *  - Issue flag editor per FAQ
 *  - Read-only health overview (mirrors the public journey map)
 *
 * Mount in your admin router:
 *   <Route path="/admin/journey-map" element={<AdminJourneyMap />} />
 *
 * Add to AdminDashboard sidebar navigation alongside existing admin pages.
 */

import React, { useEffect, useState, useCallback } from 'react';
import api from '../../utils/api';
import { JOURNEY_STAGE_ORDER } from '../../journey.types';
import { JOURNEY_STAGE_LABELS } from '../components/faq/JourneyStageSelector';
import type { JourneyStage } from '../../journey.types';

interface AdminFAQRow {
  _id: string;
  question: string;
  journeyStage: JourneyStage;
  journeyOrder: number;
  heatScore: number;
  issueFlags: string[];
  status: string;
  category?: string;
}

interface EditState {
  journeyStage: JourneyStage;
  journeyOrder: number;
  issueFlags: string[];
}

export default function AdminJourneyMap() {
  const [faqs, setFaqs] = useState<AdminFAQRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [edits, setEdits] = useState<Map<string, EditState>>(new Map());
  const [saving, setSaving] = useState<Set<string>>(new Set());
  const [stageFilter, setStageFilter] = useState<JourneyStage | 'all'>('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    setLoading(true);
    api
      .get<{ ok: boolean; data: { faqs: AdminFAQRow[] } }>('/api/admin/faqs?limit=500&select=journey')
      .then((r) => setFaqs(r.data.data.faqs))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const getEdit = useCallback(
    (faq: AdminFAQRow): EditState =>
      edits.get(faq._id) ?? {
        journeyStage: faq.journeyStage ?? 'pre_application',
        journeyOrder: faq.journeyOrder ?? 0,
        issueFlags: faq.issueFlags ?? [],
      },
    [edits]
  );

  const setEdit = (id: string, patch: Partial<EditState>) => {
    setEdits((prev) => {
      const next = new Map(prev);
      const faq = faqs.find((f) => f._id === id)!;
      const current = next.get(id) ?? {
        journeyStage: faq.journeyStage ?? 'pre_application',
        journeyOrder: faq.journeyOrder ?? 0,
        issueFlags: faq.issueFlags ?? [],
      };
      next.set(id, { ...current, ...patch });
      return next;
    });
  };

  const saveRow = useCallback(
    async (id: string) => {
      const edit = edits.get(id);
      if (!edit) return;
      setSaving((prev) => new Set(prev).add(id));
      try {
        await api.patch(`/api/faq/${id}`, {
          journeyStage: edit.journeyStage,
          journeyOrder: edit.journeyOrder,
          issueFlags: edit.issueFlags,
        });
        setFaqs((prev) =>
          prev.map((f) =>
            f._id === id
              ? { ...f, journeyStage: edit.journeyStage, journeyOrder: edit.journeyOrder, issueFlags: edit.issueFlags }
              : f
          )
        );
        setEdits((prev) => { const n = new Map(prev); n.delete(id); return n; });
      } catch (err) {
        console.error('Failed to save journey stage:', err);
      } finally {
        setSaving((prev) => { const n = new Set(prev); n.delete(id); return n; });
      }
    },
    [edits]
  );

  const handleHeatSync = async () => {
    setSyncLoading(true);
    setSyncResult(null);
    try {
      const r = await api.post<{ ok: boolean; updated: number; maxClicks: number }>(
        '/api/admin/faq/heat-sync'
      );
      setSyncResult(`✓ Updated ${r.data.updated} FAQs. Max clicks this window: ${r.data.maxClicks}`);
      // Refresh heat scores
      const fresh = await api.get<{ ok: boolean; data: { faqs: AdminFAQRow[] } }>(
        '/api/admin/faqs?limit=500&select=journey'
      );
      setFaqs(fresh.data.data.faqs);
    } catch {
      setSyncResult('✗ Heat sync failed. Check server logs.');
    } finally {
      setSyncLoading(false);
    }
  };

  // Counts per stage for the overview header
  const stageCounts = JOURNEY_STAGE_ORDER.reduce<Record<JourneyStage, number>>(
    (acc, s) => { acc[s] = faqs.filter((f) => (f.journeyStage ?? 'pre_application') === s).length; return acc; },
    {} as Record<JourneyStage, number>
  );

  const filtered = faqs.filter((f) => {
    const stage = getEdit(f).journeyStage;
    if (stageFilter !== 'all' && stage !== stageFilter) return false;
    if (search && !f.question.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const unassigned = faqs.filter((f) => !f.journeyStage).length;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-medium text-gray-900 dark:text-gray-100">Journey map admin</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Assign each FAQ to the correct stage of the intern journey.
            {unassigned > 0 && (
              <span className="ml-2 text-amber-600 dark:text-amber-400 font-medium">
                {unassigned} FAQs unassigned
              </span>
            )}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <button
            onClick={handleHeatSync}
            disabled={syncLoading}
            className="text-sm px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700
                       text-white font-medium transition-colors disabled:opacity-60"
          >
            {syncLoading ? 'Syncing…' : '↻ Sync heat scores'}
          </button>
          {syncResult && (
            <p className={`text-xs ${syncResult.startsWith('✓') ? 'text-emerald-600' : 'text-red-600'}`}>
              {syncResult}
            </p>
          )}
        </div>
      </div>

      {/* Stage overview pills */}
      <div className="flex flex-wrap gap-2 mb-5">
        <button
          onClick={() => setStageFilter('all')}
          className={`text-xs px-3 py-1.5 rounded-full border transition-colors
            ${stageFilter === 'all' ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 border-transparent' : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
        >
          All ({faqs.length})
        </button>
        {JOURNEY_STAGE_ORDER.map((s) => (
          <button
            key={s}
            onClick={() => setStageFilter(s)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors
              ${stageFilter === s ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 border-transparent' : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
          >
            {JOURNEY_STAGE_LABELS[s]} ({stageCounts[s] ?? 0})
          </button>
        ))}
      </div>

      {/* Search */}
      <input
        type="search"
        placeholder="Search questions…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full mb-4 text-sm rounded-lg border border-gray-200 dark:border-gray-700
                   bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100
                   px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
      />

      {/* Table */}
      {loading ? (
        <div className="text-sm text-gray-400 py-12 text-center">Loading FAQs…</div>
      ) : (
        <div className="border border-gray-100 dark:border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm" style={{ tableLayout: 'fixed' }}>
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 w-[40%]">Question</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 w-[25%]">Journey stage</th>
                <th className="text-left px-3 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 w-[8%]">Order</th>
                <th className="text-left px-3 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 w-[8%]">Heat</th>
                <th className="text-left px-3 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 w-[19%]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((faq, i) => {
                const edit = getEdit(faq);
                const isDirty = edits.has(faq._id);
                const isSaving = saving.has(faq._id);
                return (
                  <tr
                    key={faq._id}
                    className={`border-b border-gray-100 dark:border-gray-800 last:border-0
                      ${isDirty ? 'bg-amber-50 dark:bg-amber-950/30' : i % 2 === 0 ? 'bg-white dark:bg-gray-950' : 'bg-gray-50/50 dark:bg-gray-900/50'}`}
                  >
                    <td className="px-4 py-3 text-gray-800 dark:text-gray-200 text-xs leading-snug truncate" title={faq.question}>
                      {faq.question}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={edit.journeyStage}
                        onChange={(e) => setEdit(faq._id, { journeyStage: e.target.value as JourneyStage })}
                        className="w-full text-xs rounded-md border border-gray-200 dark:border-gray-700
                                   bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100
                                   px-2 py-1 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      >
                        {JOURNEY_STAGE_ORDER.map((s) => (
                          <option key={s} value={s}>{JOURNEY_STAGE_LABELS[s]}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-3">
                      <input
                        type="number"
                        min={0}
                        max={999}
                        value={edit.journeyOrder}
                        onChange={(e) => setEdit(faq._id, { journeyOrder: parseInt(e.target.value, 10) || 0 })}
                        className="w-16 text-xs rounded-md border border-gray-200 dark:border-gray-700
                                   bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100
                                   px-2 py-1 text-center focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1">
                        <div className="flex-1 h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${faq.heatScore ?? 0}%`,
                              backgroundColor: (faq.heatScore ?? 0) >= 75 ? '#ef4444' : (faq.heatScore ?? 0) >= 50 ? '#f59e0b' : '#10b981',
                            }}
                          />
                        </div>
                        <span className="text-xs text-gray-400 tabular-nums">{faq.heatScore ?? 0}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex gap-2">
                        {isDirty && (
                          <button
                            onClick={() => saveRow(faq._id)}
                            disabled={isSaving}
                            className="text-xs px-2.5 py-1 rounded-md bg-emerald-600 hover:bg-emerald-700
                                       text-white transition-colors disabled:opacity-60"
                          >
                            {isSaving ? 'Saving…' : 'Save'}
                          </button>
                        )}
                        {isDirty && (
                          <button
                            onClick={() => setEdits((prev) => { const n = new Map(prev); n.delete(faq._id); return n; })}
                            className="text-xs px-2.5 py-1 rounded-md border border-gray-200 dark:border-gray-700
                                       text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                          >
                            Revert
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-sm text-gray-400">
                    No FAQs match this filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
