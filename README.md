# LFC Church Management System

Two independent Next.js apps that share one Postgres database, managed as
npm workspaces. Each is meant to be deployed on its own domain — there is
no UI coupling or cross-linking between them.

| Workspace | What it is | Routes |
|-----------|------------|--------|
| `synago/` | **Synago** — leader-facing Saturday arrivals portal. Unit shepherds upload premobilisation photos, log bussing vehicles, and track counter verification. | `/`, `/synago`, `/api/*` |
| `poimen/` | **Poimen** — admin console. Hierarchy explorer (areas → governorships → units → members), membership directory, service reports, arrivals approvals, shepherding analytics, audit history. | `/`, `/poimen`, `/area/:id`, `/unit/:id`, `/directory`, `/services`, `/arrivals-admin`, ..., `/api/*` |
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
npm run dev:poimen   # http://localhost:3000
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
full list), and the default password **`changeme123`**. Every seeded or
admin-created account starts on this password and is forced to set its
own on first login (`must_change_password`). After login, the session
is just the user id in localStorage sent back as an `X-User-Id` header —
there's no cookie/session store.

Only **Chief Admin** can create new leader accounts (Governor,
Governorship Admin, Area 1 Shepherd, Area 2 Schacenta Leader) via
Poimen's Governorship and Unit pages.

## Deploying

Deploy each workspace as its own independent project (e.g. two Vercel
projects with root directories `poimen/` and `synago/`, on two separate
domains). Configure both with the same `DATABASE_URL` and the `R2_*`
variables — that shared database is the only thing connecting them.
