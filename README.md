# ACITY CONNECT: Backend API

Node.js + Express + PostgreSQL service for the ACITY CONNECT campus marketplace: institutional email onboarding, moderated listings with item/skill modes, tracked interests, threaded messaging, and admin analytics.

## Deployment links

| Surface | Example URL |
|---------|-------------|
| **Hosted API (Render)** | Replace with your Render web service URL, e.g. `https://YOUR-SERVICE.onrender.com` |
| **Managed PostgreSQL** | Connection string injected as `DATABASE_URL` on Render |
| **SPA (GitHub Pages)** | Listed in your Frontend coursework repository README |

Provision a Render Postgres instance or bring your own connection string. Point `FRONTEND_ORIGIN` at the HTTPS origin GitHub Pages will serve.

## README requirements (rubrics)

### Login credentials (seed defaults)

Populate the database (`npm run db:seed`) or use credentials you configure:

| Role | Email | Password |
|------|-------|-----------|
| Student | `fidelia.chimezie@acity.edu.gh` | `Password123!` |
| Administrator | `admin@acity.edu.gh` | `Password123!` |

Override via `SEED_USER_EMAIL`, `SEED_ADMIN_EMAIL`, and `SEED_PASSWORD`.

### Deployment links (assignment)

- Backend on **Render**: document your live API base URL (`https://...onrender.com`).
- Frontend on **GitHub Pages**: link to the SPA URL from [`frontend/README.md`](../frontend/README.md).

## Feature checklist

1. **User system & profiles (15 pts):** Secure auth, `@acity.edu.gh` gated signup, editable profile incl. skills offered/needed.
2. **Marketplace (15 pts):** Item listings + skill offer/request modes, searchable feed, statuses + moderation lifecycle.
3. **Interactions (15 pts):** “Interested” action, threaded messaging, statuses for interest workflow.
4. **Admin controls (15 pts):** Approve/reject/delete listings, audit trail, moderation flags, KPI stats dashboard.

Everything above is reachable through the REST API described below (`/health` probes).

## Installation (local development)

### Prerequisites

- Node.js 22+
- PostgreSQL 14+ (Docker command in quickstart below)

### Quickstart

```bash
cd backend
cp .env.example .env
# edit DATABASE_URL / JWT_SECRET / FRONTEND_ORIGIN / ALLOWED_EMAIL_DOMAIN
npm install
npx prisma migrate dev
npm run db:seed
npm run dev
```

Dockerized Postgres snippet (optional):

```bash
docker run --name acity-pg \\
  -e POSTGRES_PASSWORD=postgres \\
  -e POSTGRES_DB=acity_connect \\
  -p 5433:5432 \\
  -d postgres:16-alpine
```

Then aim `DATABASE_URL` at port `5433` as shown inside `.env.example`.

### Helpful npm scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | `tsx watch` on `src/index.ts` |
| `npm run build` | emits `dist/` for production (`node dist/index.js`) |
| `npm run db:migrate:dev` | create dev migrations interactively |
| `npm run db:migrate` | `prisma migrate deploy` |
| `npm run db:seed` | seed demo listings + demo users |
| `npm run lint` | `tsc --noEmit` |

### Render / production rollout

Typical lifecycle:

```
npm ci
npm run build
npx prisma migrate deploy
node dist/index.js
```

Expose `PORT`, `DATABASE_URL`, `JWT_SECRET`, `FRONTEND_ORIGIN`, and `ALLOWED_EMAIL_DOMAIN`.

## REST surface (abbrev.)

- `POST /api/auth/register` · `POST /api/auth/login`
- `GET|PATCH /api/users/me`
- `GET /api/users/:id`
- `GET|POST /api/listings`
- `GET|PATCH|DELETE /api/listings/:id`
- `POST /api/listings/:id/interest`
- `GET /api/interests/mine`, `GET /api/interests/incoming`
- `PATCH /api/listings/:listingId/interests/:interestId`
- Messaging: `POST /api/conversations`, `GET /api/conversations`, `GET|POST /api/conversations/:id/messages`
- Admin: `/api/admin/**` guarded by JWT `role === admin`

## Technology stack · assignment

Frontend is React + Vite (separate repo). Backend is **Node.js + PostgreSQL**.
