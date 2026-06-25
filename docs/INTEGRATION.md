# FAQ Journey Health Map — Integration Guide

Full wiring instructions for dropping this feature into the existing
`crowd-source-faq` codebase without touching any existing logic.

---

## 1. File placement

Copy each file from this delivery to the repo path shown:

```
backend/scripts/FAQ.migration.ts       → backend/scripts/FAQ.migration.ts
backend/FAQ.schema-patch.ts            → (read instructions inside — paste fields into backend/models/FAQ.ts)
backend/journeyController.ts           → backend/controllers/journeyController.ts
backend/journeyRoutes.ts               → backend/routes/journeyRoutes.ts
backend/heatScoreCron.ts               → backend/scripts/heatScoreCron.ts

frontend/src/journey.types.ts          → frontend/src/types/journey.types.ts
frontend/src/useJourneyMap.ts          → frontend/src/hooks/useJourneyMap.ts
frontend/src/components/faq/JourneyHealthMap.tsx       → (same path)
frontend/src/components/faq/JourneyStageSelector.tsx   → (same path)
frontend/src/admin/pages/AdminJourneyMap.tsx           → (same path)
```

---

## 2. Patch backend/models/FAQ.ts

Open `backend/models/FAQ.ts`. Locate the Mongoose SchemaDefinition object.
Add the following fields **before** the closing `}` of the schema:

```ts
// ── Journey Health Map ──────────────────────────────────────────
journeyStage: {
  type: String,
  enum: [
    'pre_application', 'interview', 'result_offer', 'noc_paperwork',
    'day_one', 'phase1_vibe', 'team_formation', 'phase2_project', 'completion',
  ],
  default: 'pre_application',
  index: true,
},
journeyOrder: {
  type: Number,
  default: 0,
},
heatScore: {
  type: Number,
  default: 0,
  min: 0,
  max: 100,
},
issueFlags: {
  type: [String],
  default: [],
},
helpfulCount: {
  type: Number,
  default: 0,
},
flagCount: {
  type: Number,
  default: 0,
},
// ── End Journey Health Map ──────────────────────────────────────
```

Also add this export at the top of FAQ.ts (or in a shared types file):

```ts
export const JOURNEY_STAGE_ORDER = [
  'pre_application', 'interview', 'result_offer', 'noc_paperwork',
  'day_one', 'phase1_vibe', 'team_formation', 'phase2_project', 'completion',
] as const;
export type JourneyStage = typeof JOURNEY_STAGE_ORDER[number];
```

---

## 3. Mount the route in server.ts

```ts
// In backend/server.ts, alongside other route imports:
import journeyRoutes from './routes/journeyRoutes.js';

// After other app.use() calls:
app.use('/api/faq', journeyRoutes);

// Also import and start the heat score cron:
import { scheduleHeatScoreCron } from './scripts/heatScoreCron.js';
// After your DB connects (inside the mongoose.connect callback or after await):
scheduleHeatScoreCron();
```

---

## 4. Patch the existing FAQ PATCH endpoint

In `backend/controllers/faqController.ts`, find the FAQ update handler
(usually `updateFAQ` or similar). Add these fields to the allowed update set:

```ts
// Inside the update handler, add to the $set object:
...(journeyStage  && { journeyStage }),
...(journeyOrder  !== undefined && { journeyOrder }),
...(issueFlags    && { issueFlags }),
```

And destructure them from `req.body`:
```ts
const { journeyStage, journeyOrder, issueFlags, ...existingFields } = req.body;
```

---

## 5. Patch SearchLog to track resolvedFaqId

The heat score cron works best when `SearchLog` records which FAQ a user
clicked after a search. In `backend/models/SearchLog.ts`, add:

```ts
resolvedFaqId: {
  type: mongoose.Schema.Types.ObjectId,
  ref: 'FAQ',
  default: null,
  index: true,
},
```

In `backend/controllers/searchController.ts`, when a user clicks a search
result (if you have a click-tracking endpoint), update the SearchLog:

```ts
await SearchLog.findByIdAndUpdate(searchLogId, {
  $set: { resolvedFaqId: faqId }
});
```

If you don't have a click-tracking endpoint yet, add:
```
POST /api/search/click  { searchLogId, faqId }
```

Without this, `heatScore` will remain 0 for all FAQs until click tracking
is in place. The journey map still works — it just shows 0% for all heat bars.

---

## 6. Add to AdminFAQs edit modal

In `frontend/src/admin/pages/AdminFAQs.tsx`, inside the FAQ edit form:

```tsx
import { JourneyStageSelector } from '../../components/faq/JourneyStageSelector';

// Inside the form JSX:
<JourneyStageSelector
  value={editFaq.journeyStage ?? 'pre_application'}
  order={editFaq.journeyOrder ?? 0}
  onChange={(stage, order) =>
    setEditFaq((f) => ({ ...f, journeyStage: stage, journeyOrder: order }))
  }
/>
```

---

## 7. Add admin route

In `frontend/src/App.tsx` (or your router file), inside the admin routes:

```tsx
import AdminJourneyMap from './admin/pages/AdminJourneyMap';

// Inside <Routes> under the admin prefix:
<Route path="/admin/journey-map" element={<AdminJourneyMap />} />
```

Add to the admin sidebar navigation alongside existing pages:
```tsx
{ href: '/admin/journey-map', label: 'Journey map', icon: 'MapPin' }
```

---

## 8. Expose the journey map to users

Option A — replace the existing FAQ ToC with the journey map:

```tsx
// In frontend/src/pages/FAQPage.tsx, replace the existing FAQ list:
import { JourneyHealthMap } from '../components/faq/JourneyHealthMap';

// Replace your existing FAQ content section with:
<JourneyHealthMap />
```

Option B — add as a tab alongside the existing FAQ view:

```tsx
// In FAQPage.tsx, add a tab switcher:
const [view, setView] = useState<'classic' | 'journey'>('journey');

// Tab buttons:
<button onClick={() => setView('classic')}>All FAQs</button>
<button onClick={() => setView('journey')}>Journey map</button>

// Conditional render:
{view === 'journey' ? <JourneyHealthMap /> : <ExistingFAQContent />}
```

Option B is lower-risk — you can ship journey map as opt-in and switch
the default once you're confident in the stage assignments.

---

## 9. Run the migration

```bash
cd backend
npx tsx scripts/FAQ.migration.ts
```

This backfills all existing FAQs with `journeyStage: 'pre_application'` and
creates the compound index. Idempotent — safe to run again.

Then open `/admin/journey-map` and assign each FAQ to its correct stage.
With 130 FAQs and the bulk table UI this takes ~20 minutes.

---

## 10. Checklist

- [ ] Fields added to `FAQ.ts` schema
- [ ] `journeyRoutes.ts` mounted in `server.ts`
- [ ] `scheduleHeatScoreCron()` called after DB connects
- [ ] PATCH FAQ controller updated to accept new fields
- [ ] `SearchLog.resolvedFaqId` field added (optional, for heat scores)
- [ ] Migration script run against production MongoDB
- [ ] `JourneyStageSelector` added to AdminFAQs edit modal
- [ ] `AdminJourneyMap` route added
- [ ] `JourneyHealthMap` added to FAQPage (tab or replace)
- [ ] Admin stages assigned for all 130 FAQs via `/admin/journey-map`
- [ ] Heat score sync run manually once via the admin button

---

## Estimated effort

| Task | Time |
|---|---|
| Schema + migration | 30 min |
| Backend routes + controller | 1 hr |
| Frontend components (already written) | 30 min wiring |
| Admin stage assignment (130 FAQs) | 1–2 hrs |
| Testing + QA | 1 hr |
| **Total** | **~4–5 hrs** |

The bulk of the time is assigning stages to the 130 existing FAQs — the
`/admin/journey-map` table is designed to make this as fast as possible
(dropdown per row, save on button click, filter by stage to batch-process).
