# Good Morning Dashboard

## Stack
- Frontend: React + TypeScript + Vite (port 5173)
- Backend: Express + TypeScript (port 3001)
- Backend proxies all external APIs — frontend never touches secrets

## Running
```bash
# Backend (from project root)
npx ts-node src/server.ts

# Frontend (from frontend/)
npm run dev
```
Vite proxies `/api` → `http://localhost:3001` in dev mode.

## Secrets
- All API keys live in `.env` (gitignored), never in frontend code
- `.env.example` has the template — copy to `.env` and fill in values
- Backend reads keys via `process.env`, frontend calls `/api/*` with no secrets

## Code style
- Polish UI text (no diacritics in code identifiers)
- Functional React components with hooks
- Types in `frontend/src/types.ts`
- One component per file in `frontend/src/components/`

## Key decisions
- Namedays: embedded local database (no external API — too unreliable)
- BTC: Zonda API (use `highestBid`/`lowestAsk`, not `lowRate`/`highRate`)
- Currencies: NBP API for USD/EUR
- Stocks: Yahoo Finance via backend proxy
- RSS: server-side parsing with rss-parser

## Git
- Remote: git@github.com:Gidzior/good_morning.git (SSH)
- Always commit secrets-free; verify .gitignore before pushing

## Planned
- Docker deployment on Synology DS725+ with Tailscale
