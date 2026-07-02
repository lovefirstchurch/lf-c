# LFC Church Management System

Two Next.js apps sharing one Postgres database, managed as npm workspaces:

| Workspace | What it is | Routes |
|-----------|------------|--------|
| `synago/` | **Synago** — leader-facing Saturday arrivals portal. Unit shepherds upload premobilisation photos, log bussing vehicles, and track counter verification. | `/synago`, `/api/*` |
| `poimen/` | **Poimen** — admin console. Hierarchy explorer (areas → governorships → units → members), membership directory, midweek service reports, arrivals approvals, shepherding analytics, audit history. Also serves the landing page at `/`. | `/`, `/poimen`, `/area/:id`, `/unit/:id`, `/directory`, `/arrivals-admin`, ..., `/api/*` |
| `db/` | Shared data layer: Postgres access, schema init + demo seed, Cloudflare R2 uploads. | — |
| `shared/` | Shared React components (login gate, sidebar) and the `apiFetch` helper. | — |

## Requirements

- Node.js 20+
- A Postgres database (Supabase, Neon, or local)
- A Cloudflare R2 bucket (only needed for photo-upload features)

## Setup

```bash
npm install
```

Create `synago/.env.local` and `poimen/.env.local` from `.env.example`
(both apps must use the same `DATABASE_URL`). On the first API request each
app creates the `lfc_demo_*` tables and seeds demo areas, users, units, and
members automatically; `lfc-demo-schema.sql` is an equivalent one-time
manual setup script.

## Running locally

```bash
npm run dev:poimen   # http://localhost:3000  (landing page + Poimen)
npm run dev:synago   # start on another port, e.g. --workspace with -p 3001
```

Or production builds:

```bash
npm run build
npm run start --workspace=@lfc/poimen   # -p 3000
npm run start --workspace=@lfc/synago   # -p 3001
```

Sign in with a seeded username, e.g. `chief_admin`, `shepherd1`,
`schacenta_leader1`, `arrivals_admin` (see `db/src/database.ts` for the
full list). Auth is demo-grade: the picked user id is stored in
localStorage and sent as an `X-User-Id` header.

## Deploying

Deploy each workspace as its own Next.js project (e.g. two Vercel projects
with root directories `poimen/` and `synago/`), both configured with the
same `DATABASE_URL` and the `R2_*` variables. To make the cross-app links
(`/synago` ↔ `/poimen`) work under one domain, put both apps behind one
host with rewrites: route `/synago/*` to the Synago deployment and
everything else to Poimen.
