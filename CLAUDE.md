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
- `/src/server.ts` — backend Express, proxy API
- `/frontend/src/components/` — atomic React components
- `/frontend/src/types.ts` — wspolne typy
- `/frontend/src/utils.ts` — type-safe utils
- `/frontend/src/config.ts` — non-secret config (stocks, intervals)
- State: `useState`/`useEffect` dla local state
- Async: `async/await`, error handling w try-catch

## Key Decisions
- Namedays: embedded local database (no external API — too unreliable)
- BTC: Zonda API (`highestBid`/`lowestAsk`, not `lowRate`/`highRate`)
- Currencies: NBP API for USD/EUR
- Stocks: Yahoo Finance via backend proxy
- RSS: server-side parsing with rss-parser

## Git
- Remote: git@github.com:Gidzior/good_morning.git (SSH)
- Always commit secrets-free; verify .gitignore before pushing

## Planned
- Docker deployment on Synology DS725+ with Tailscale
