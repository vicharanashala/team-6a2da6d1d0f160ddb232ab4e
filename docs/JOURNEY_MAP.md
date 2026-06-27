# FAQ Journey Health Map

**Feature by:** Priyanjali Chaudhary — Vicharanashala Internship 2026
**Team:** team-6a2da6d1d0f160ddb232ab4e

## What it is

The FAQ Journey Health Map is a new navigation layer on top of the existing FAQ platform. Instead of browsing 130+ entries by topic category, interns can now browse FAQs in the order they will actually encounter them during the internship — from Before you apply all the way to Completion and certificate.

Each stage of the journey shows:
- All FAQs relevant to that stage
- A health status (Healthy / Needs review / Critical) based on known issues
- A heat score showing how many interns asked this question
- Issue flags surfacing known problems with an entry
- Inline feedback (Helpful / Needs update) that closes the quality loop

## Why it was built

The Samagama FAQ audit report identified several critical problems:
- #2 CRITICAL: Section order does not follow intern journey -> FAQs now displayed in journey order
- #6 HIGH: 130-entry ToC is unusable -> 9 stage accordion groups replace the flat list
- #7 MEDIUM: No signal for high-traffic entries -> Heat bar shows % of interns who asked each question
- #21 HIGH: No per-entry feedback mechanism -> Thumbs up / Needs update on every expanded FAQ

## How to use it

### As an intern (public view)
1. Go to /faq
2. Click the Journey map tab
3. Browse by stage - click any stage to expand it
4. Click any question to read the answer
5. Use filter buttons to find hot, flagged, or stale entries
6. Click Helpful or Needs update to give feedback

### As an admin
1. Go to /admin/journey-map
2. Assign each FAQ to its correct journey stage using the dropdown
3. Set the order within each stage (lower = appears first)
4. Click Sync heat scores to recalculate traffic scores from search logs

## New files added

Backend:
- apps/backend/src/modules/faq/journey.controller.ts
- Journey routes added to apps/backend/src/modules/faq/faq.routes.ts

Frontend:
- apps/frontend/src/components/faq/JourneyHealthMap.tsx
- apps/frontend/src/components/faq/JourneyStageSelector.tsx
- apps/frontend/src/admin/pages/AdminJourneyMap.tsx
- apps/frontend/src/hooks/useJourneyMap.ts
- apps/frontend/src/types/journey.types.ts

## New fields added to FAQ schema
- journeyStage: String - which stage this FAQ belongs to
- journeyOrder: Number - order within the stage
- heatScore: Number - 0-100, from search log data
- issueFlags: [String] - known problems with this entry
- helpfulCount: Number - positive feedback count
- flagCount: Number - needs-update feedback count

## API endpoints
- GET /csfaq/api/faq/journey - grouped journey map data (public)
- POST /csfaq/api/faq/:id/journey-feedback - helpful/flag vote (public)
- POST /csfaq/api/admin/faq/heat-sync - recalculate heat scores (admin)

## Journey stages (in order)
1. pre_application - Before you apply
2. interview - The Yaksha interview
3. result_offer - Result and offer letter
4. noc_paperwork - NOC and college paperwork
5. day_one - Day 1 onboarding
6. phase1_vibe - Phase 1 ViBe coursework
7. team_formation - Team formation
8. phase2_project - Phase 2 project work
9. completion - Completion and certificate

## Running locally
Public view: http://localhost:5173/csfaq/faq -> click Journey map tab
Admin panel: http://localhost:5173/csfaq/admin/journey-map