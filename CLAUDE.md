# Good Morning Dashboard

Poranny dashboard briefingowy. TypeScript + Vite + React (frontend), Express + TypeScript (backend).
Kod musi byc: strict-typed (zero `any`), bezpieczny (secrets w .env, walidacja danych), wydajny (lazy loading, code splitting).

## Stack
- Frontend: React 19 + TypeScript strict + Vite 8 (port 5173)
- Backend: Express + TypeScript strict (port 3001)
- Backend proxies all external APIs — frontend never touches secrets

## Running
```bash
# Backend
npx ts-node src/server.ts

# Frontend (osobny terminal)
cd frontend && npm run dev
```
Vite proxies `/api` → `http://localhost:3001` in dev mode.

## Secrets & Security
- All API keys live in `.env` (gitignored), never in frontend code
- `.env.example` has the template — copy to `.env` and fill in values
- Backend reads keys via `process.env`, frontend calls `/api/*` with no secrets
- NIGDY: nie commituj `.env*`, nie hardcode secrets, nie ustawiaj `// @ts-ignore`
- Env vars na froncie: prefix `VITE_*` (ale unikaj — sekrety przez backend)

## Code Style
- **Strict TypeScript**: `"strict": true`. Nigdy `any` — uzywaj `unknown` + type guards
- **Type-only imports**: `import type { T }` gdzie mozliwe
- **Functional patterns**: hooks, type aliases, discriminated unions
- **Named exports**, destrukturyzacja imports
- **Polish UI text** (no diacritics in code identifiers)
- **One component per file** in `frontend/src/components/`
- **Types** in `frontend/src/types.ts`
- **ESLint + Prettier** — formatowanie przed commitem

## Commands
```bash
npm run dev:backend    # Express dev server
npm run dev:frontend   # Vite dev server
npm run build          # tsc + vite build
npm run lint           # ESLint + typecheck (cd frontend && npm run lint)
```
Przed commitem: `lint && build` musza przejsc.

## Architecture
- `/src/server.ts` — backend Express, proxy API + calendar/layout endpoints
- `/src/auth.ts` — Google OAuth2 router (login, callback, session, token management)
- `/src/db.ts` — SQLite (better-sqlite3) with prepared statements
- `/frontend/src/components/` — atomic React components
- `/frontend/src/components/DashboardGrid.tsx` — react-grid-layout v2 responsive grid
- `/frontend/src/hooks/useLayout.ts` — layout persistence hook (debounced save)
- `/frontend/src/hooks/useAuth.tsx` — AuthProvider + useAuth context
- `/frontend/src/types.ts` — wspolne typy
- `/frontend/src/utils.ts` — type-safe utils
- `/frontend/src/config.ts` — non-secret config (stocks, intervals)
- State: `useState`/`useEffect` dla local state
- Async: `async/await`, error handling w try-catch
- DB file: `data/dashboard.db` (gitignored)

## Key Decisions
- Namedays: embedded local database (no external API — too unreliable)
- BTC: Zonda API (`highestBid`/`lowestAsk`, not `lowRate`/`highRate`)
- Currencies: NBP API for USD/EUR
- Stocks: Yahoo Finance via backend proxy
- RSS: server-side parsing with rss-parser
- Google Keep: brak publicznego API (tylko Workspace Enterprise) — odrzucone

## Auth & Database
- Google OAuth2 (scopes: openid, email, profile, calendar.readonly)
- Session-based auth: httpOnly cookies, 30-day TTL, `requireAuth` middleware on all /api
- SQLite tables: users, sessions, user_tokens, user_calendar_prefs, user_layouts
- Per-user Google Calendar tokens with auto-refresh in `getOAuth2ClientForUser()`
- `/auth/dev-login` — DEV ONLY, auto-login as first user (localhost check via BASE_URL)

## Dashboard Grid (react-grid-layout v2)
- `useContainerWidth()` hook (v2 removed WidthProvider HOC)
- `dragConfig.enabled` / `resizeConfig.enabled` (v2 renamed from isDraggable/isResizable)
- `dragConfig.handle` (v2 renamed from draggableHandle)
- Breakpoints: 900/600/0 — based on CONTAINER width, not viewport (sidebar takes ~300px)
- Only save layout on `lg` breakpoint to avoid overwriting with collapsed layout
- Weather is single widget with internal 2-col grid (not two separate grid items)

## shadcn/ui base-nova gotchas
- Button has NO `asChild` prop — use `buttonVariants()` + plain `<a>` instead
- Components use `data-slot` attributes (e.g. `data-slot="card"`, `data-slot="card-content"`)

## Features (as of 2026-04-06)
- Weather (OpenWeatherMap) — current + hourly forecast + 3-day, city selector
- Quote of the day (Polish)
- Google Calendar — multi-calendar, colored event borders, per-user OAuth
- BTC + USD/EUR exchange rates with Recharts charts
- Stocks (Yahoo Finance) with chart timeframe selector (7D/1M/3M/1R)
- Polish news + AI News RSS feeds
- Nameday in dashboard header (local DB)
- Drag-and-drop grid with per-user layout persistence
- Edit mode toggle + reset in sidebar
- Full-height card stretching in grid cells

## Git
- Remote: git@github.com:Gidzior/good_morning.git (SSH)
- Always commit secrets-free; verify .gitignore before pushing

## Production Deployment Plan (TODO)

> Hosting: **publiczny VPS** (nie Synology NAS) — Google OAuth wymaga publicznego redirect_uri.

### Faza 1: Security hardening (BLOCKER przed deploy)
1. `/auth/dev-login` — usunac lub zamienic na `NODE_ENV !== 'production'` (src/auth.ts)
2. Cookie `secure: true` w produkcji — wzorzec: `secure: process.env.NODE_ENV === 'production'`
3. HTTPS — reverse proxy (Caddy/nginx) z auto-SSL
4. Rate limiting — `express-rate-limit` (/auth: 10 req/min, /api: 60 req/min)
5. CSRF — sprawdzac Origin header lub SameSite=Strict na cookie
6. SESSION_SECRET — silny (32+ znaków) w .env produkcyjnym

### Faza 2: Docker (VPS)
7. Dockerfile multi-stage: build frontend → production backend + static serve
8. docker-compose.yml: volume data/ (SQLite) + .env, restart: unless-stopped
9. Google OAuth redirect URI — ustawic na produkcyjny publiczny URL w Google Cloud Console
10. BASE_URL w .env — ustawic na produkcyjny publiczny URL

### Faza 3: Opcjonalne
11. Health check endpoint — GET /api/health (bez auth)
12. Structured logging (pino/winston)
13. SQLite backup cron
