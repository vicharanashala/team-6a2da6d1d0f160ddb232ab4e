# Samagama — Yaksha FAQ Portal

## team-6a2da6d1d0f160ddb232ab4e — FAQ Crowdsourcing Project

**Priyanjali Chaudhary** | Vicharanashala Internship 2026| VINS @ IIT Ropar

Built on top of the crowd-source-faq platform with an added FAQ Journey Health Map feature.

Feature documentation: docs/JOURNEY_MAP.md
Integration guide: docs/INTEGRATION.md

---

## What was added

The FAQ Journey Health Map is a new navigation layer that lets interns browse FAQs in the order they will actually encounter them during the internship — from Before you apply to Completion and certificate — with live health signals, heat scores, and inline feedback.

It directly solves four critical issues identified in the Samagama FAQ audit:
* Section order does not follow intern journey (#2 CRITICAL)
* 130-entry ToC is unusable (#6 HIGH)
* No signal for high-traffic entries (#7 MEDIUM)
* No per-entry feedback mechanism (#21 HIGH)

Public view: /faq -> click the Journey map tab
Admin panel: /admin/journey-map

---

## Tech stack

* Backend: Node.js, Express, TypeScript, MongoDB (Mongoose), JWT auth
* Frontend: React, Vite, TypeScript, Tailwind CSS
* AI: HuggingFace Inference API (embeddings), configurable LLM providers
* Monorepo: pnpm workspaces + Turborepo

---

## Local setup

### Prerequisites
* Node.js >= 18
* pnpm (npm install -g pnpm)
* MongoDB Atlas account (free tier works)
* HuggingFace account (free API key)

### 1. Clone the repo
git clone https://github.com/vicharanashala/team-6a2da6d1d0f160ddb232ab4e.git
cd team-6a2da6d1d0f160ddb232ab4e

### 2. Install dependencies
pnpm install

### 3. Configure backend environment
cp apps/backend/.env.example apps/backend/.env.local

Edit apps/backend/.env.local and set these required values:
MONGODB_URI=your_mongodb_atlas_uri
JWT_SECRET=any_32_character_string
JWT_REFRESH_SECRET=any_32_character_string
REDIS_URL=http://localhost:6379
REDIS_TOKEN=dummytoken
ZOOM_REDIRECT_URI=http://localhost:6767/api/zoom/callback

### 4. Seed the database
cd apps/backend
MONGODB_URI=your_uri pnpm run seed
cd ../..

### 5. Configure HuggingFace embeddings
1. Get a free API key at https://huggingface.co/settings/tokens
2. Start the backend (step 6 below)
3. Go to http://localhost:5173/csfaq/admin/settings/ai
4. Under Embedding Model Configuration select HuggingFace Inference API
5. Paste your API key and click Save Embedding settings

### 6. Start the servers

Terminal 1 - Backend:
cd apps/backend
pnpm dev
Backend runs at http://localhost:6767

Terminal 2 - Frontend:
cd apps/frontend
pnpm dev
Frontend runs at http://localhost:5173/csfaq/

### 7. Create admin account

Enable registration in MongoDB Atlas:
* Go to your cluster -> Browse Collections -> yaksha_faq -> yaksha_faq_registration_config
* Edit the document: set registrationEnabled to true

Register (invite token shown once in backend logs on first startup):
POST http://localhost:6767/csfaq/api/auth/register?token=YOUR_INVITE_TOKEN
Body: { "name": "Your Name", "email": "you@email.com", "password": "YourPassword" }

Then in MongoDB Atlas -> yaksha_faq_users -> find your user -> set role to admin.

---

## Key URLs (local)

* http://localhost:5173/csfaq/ — Home page
* http://localhost:5173/csfaq/faq — FAQ page (with Journey Map tab)
* http://localhost:5173/csfaq/admin — Admin dashboard
* http://localhost:5173/csfaq/admin/journey-map — Journey Map admin
* http://localhost:5173/csfaq/admin/faqs — FAQ management
* http://localhost:5173/csfaq/admin/settings/ai — AI and embedding settings

---

## Original platform

This project is built on top of vicharanashala/crowd-source-faq, an open-source FAQ crowdsourcing platform (MIT License). The Journey Health Map feature is an original contribution.

Full platform documentation: docs/ARCHITECTURE.md
