# Samagama — Yaksha FAQ Portal

**Team:** team-6a2da6d1d0f160ddb232ab4e | Vicharanashala Internship 2026

**Priyanjali Chaudhary** | VINS @ IIT Ropar


> Built on top of [vicharanashala/crowd-source-faq](https://github.com/vicharanashala/crowd-source-faq) (MIT License) with an original team contribution: the **FAQ Journey Health Map** feature.

---

## 🗺 Team Contribution: FAQ Journey Health Map

| | |
|---|---|
| **Feature docs** | [docs/JOURNEY_MAP.md](docs/JOURNEY_MAP.md) |
| **Integration guide** | [docs/INTEGRATION.md](docs/INTEGRATION.md) |
| **Audit report** | [docs/audit/samagama_faq_audit_report.docx](docs/audit/samagama_faq_audit_report.docx) |
| **Product overview** | [PRODUCT.md](PRODUCT.md) |

### What it is

The FAQ Journey Health Map is a new navigation layer on top of the existing FAQ platform. Instead of browsing 130+ entries organised by topic, interns can browse FAQs **in the order they actually encounter them** — from "Before you apply" all the way to "Completion & certificate" — with live health signals, heat scores, and inline feedback buttons.

### Why it was built

A comprehensive [audit of samagama.in/internship/faq](docs/audit/samagama_faq_audit_report.docx) (28 issues across 7 layers) identified four problems that none of the platform's eight flagship features address:

| Issue | Severity | Problem |
|---|---|---|
| #2 | **CRITICAL** | Section order doesn't follow the intern journey — ViBe help appears before offer letter guidance |
| #6 | **HIGH** | 130-entry Table of Contents is unusable as navigation |
| #7 | **MEDIUM** | No signal distinguishes high-traffic entries from edge cases |
| #21 | **HIGH** | No per-entry feedback mechanism — interns can't flag wrong answers |

The Journey Health Map solves all four in a single feature.

### Ordinary Samagama vs. Journey Health Map

| Dimension | Samagama (original) | Journey Health Map |
|---|---|---|
| Navigation | 130-entry flat ToC | 9-stage accordion timeline |
| Order | By topic (pipeline order) | By time-in-journey (chronological) |
| Traffic signal | None — all entries look identical | Heat score 0–100%, colour-coded bar |
| Quality signal | None | Issue flags, health dots (green/amber/red) |
| Feedback | None | Per-entry Helpful / Needs update buttons |
| Admin tooling | Edit FAQs one by one | Bulk stage assignment table with heat bars |
| Feedback loop | Intern → Yaksha → human → pipeline | Intern → flag button → auto-review queue |

### The 9 Journey Stages

```
1. Before you apply          →  6. Phase 1 — ViBe coursework
2. The Yaksha interview      →  7. Team formation
3. Result & offer letter     →  8. Phase 2 — project work
4. NOC & college paperwork   →  9. Completion & certificate
5. Day 1 — onboarding
```

### Live URLs (local)

| URL | What it is |
|---|---|
| `http://localhost:5173/csfaq/faq` → **Journey map** tab | Public intern view |
| `http://localhost:5173/csfaq/admin/journey-map` | Admin bulk-assignment panel |

---

## Platform Features (base platform)

The platform is a self-maintaining FAQ + community Q&A portal combining semantic vector search, AI-powered ingestion, and an expert promotion layer.

### Eight flagship capabilities

- **Zoom transcript ingestion** — per-user OAuth, webhook-fired VTT parsing, AI Q&A extraction, dual-publish to ZoomInsight (admin-reviewed) and TranscriptKnowledge (auto-approved). See [docs/PIPELINES.md](docs/PIPELINES.md#zoom-ingestion-pipeline)
- **AI auto-answer pipeline** — scheduler (every 24h) + one-click Run AI button searches all three knowledge sources in parallel. ≥0.85 confidence auto-posts; 0.60–0.84 queues for review; below 0.60 escalates
- **FAQ audit pipeline** — re-evaluates approved FAQs every 6h against the live knowledge base. Emits `correct`, `drift_detected`, `contradiction`, or `stale` verdicts
- **FAQ freshness & staleness detection** — per-FAQ `freshness_tier` (evergreen/seasonal/volatile) with daily cron auto-flagging and peer-review voting
- **Golden Ticket escalation** — Spurti Points economy lets users bump time-sensitive queries to the top of the admin queue
- **Batch management + public guest FAQ portal** — FAQs scoped to a Batch (cohort/term/programme), guest browse at `/faq` with no account required
- **Schema-driven context fields** — admin-editable per-support-category schemas without redeploying
- **Soft-delete with anonymisation** — user deletion anonymises records without destroying attribution history

### Other capabilities

Semantic hybrid search, community Q&A board, reputation system + badges + leaderboard, SpillTheTea event-driven notifications, per-user Zoom OAuth, RAG-powered `/ask-ai` assistant with image + file attachments, experimental feature flags, support tickets (troubleshoot → admin triage → resolution).

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite + TypeScript + Tailwind CSS + Framer Motion |
| Backend | Node.js 22 + Express 4 + TypeScript (ESM) + Mongoose 8 |
| Database | MongoDB Atlas (Vector Search) + Upstash Redis (optional) |
| AI / Search | HuggingFace Inference API (`mixedbread-ai/mxbai-embed-large-v1`, 1024-dim), RRF, Atlas `$vectorSearch` |
| AI Providers | Anthropic Claude, OpenAI GPT, xAI Grok, Google Gemini, MiniMax — admin-configurable |
| Monorepo | pnpm workspaces + Turborepo |

---

## Local Setup

### Prerequisites

- Node.js >= 18
- pnpm — `npm install -g pnpm`
- MongoDB Atlas account (free M0 tier works)
- HuggingFace account (free API key)

### 1. Clone the repo

```bash
git clone https://github.com/vicharanashala/team-6a2da6d1d0f160ddb232ab4e.git
cd team-6a2da6d1d0f160ddb232ab4e
```

### 2. Install dependencies

```bash
pnpm install
```

### 3. Configure backend environment

```bash
cp apps/backend/.env.example apps/backend/.env.local
```

Edit `apps/backend/.env.local` and set:

```env
MONGODB_URI=your_mongodb_atlas_connection_string
JWT_SECRET=any_string_at_least_32_characters_long
JWT_REFRESH_SECRET=another_string_at_least_32_characters
REDIS_URL=http://localhost:6379
REDIS_TOKEN=dummytoken
ZOOM_REDIRECT_URI=http://localhost:6767/api/zoom/callback
```

### 4. Seed the database

```bash
cd apps/backend
MONGODB_URI=your_uri pnpm run seed
cd ../..
```

### 5. Configure HuggingFace embeddings

1. Get a free API key at https://huggingface.co/settings/tokens (Read type)
2. Start the backend (step 6 below)
3. Go to `http://localhost:5173/csfaq/admin/settings/ai`
4. Under **Embedding Model Configuration** → select **HuggingFace Inference API**
5. Paste your API key → click **Save Embedding settings** → click **Test Connection**

### 6. Start the servers

**Terminal 1 — Backend:**
```bash
cd apps/backend
pnpm dev
# Runs at http://localhost:6767
```

**Terminal 2 — Frontend:**
```bash
cd apps/frontend
pnpm dev
# Runs at http://localhost:5173/csfaq/
```

### 7. Create admin account

In MongoDB Atlas → Browse Collections → `yaksha_faq` → `yaksha_faq_registration_config`:
- Edit the document → set `registrationEnabled: true`

Register via API (invite token shown once in backend terminal logs on first startup):
```
POST http://localhost:6767/csfaq/api/auth/register?token=YOUR_INVITE_TOKEN
Body: { "name": "Your Name", "email": "you@email.com", "password": "YourPassword" }
```

Then in Atlas → `yaksha_faq_users` → find your user → set `role: "admin"`.

---

## Key URLs (local)

| URL | Page |
|---|---|
| `http://localhost:5173/csfaq/` | Home |
| `http://localhost:5173/csfaq/faq` | FAQ page (with Journey Map tab) |
| `http://localhost:5173/csfaq/admin` | Admin dashboard |
| `http://localhost:5173/csfaq/admin/journey-map` | **Journey Map admin** ← team feature |
| `http://localhost:5173/csfaq/admin/faqs` | FAQ management |
| `http://localhost:5173/csfaq/admin/settings/ai` | AI & embedding settings |
| `http://localhost:5173/csfaq/community` | Community Q&A |

---

## Documentation

| Document | Description |
|---|---|
| [docs/JOURNEY_MAP.md](docs/JOURNEY_MAP.md) | Journey Health Map feature docs (team contribution) |
| [docs/INTEGRATION.md](docs/INTEGRATION.md) | Integration guide for the journey map |
| [docs/audit/samagama_faq_audit_report.docx](docs/audit/samagama_faq_audit_report.docx) | Full Samagama FAQ audit (28 issues, 7 layers) |
| [PRODUCT.md](PRODUCT.md) | Full platform product overview + team contribution |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | System architecture deep-dive |
| [docs/PIPELINES.md](docs/PIPELINES.md) | AI pipeline documentation |
| [docs/reference/database-schema.md](docs/reference/database-schema.md) | Database schema reference |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Contribution guidelines |

---

## Repository

- **Team repo:** https://github.com/vicharanashala/team-6a2da6d1d0f160ddb232ab4e
- **Base platform:** https://github.com/vicharanashala/crowd-source-faq
- **License:** [MIT](LICENSE)
