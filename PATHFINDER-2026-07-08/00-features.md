# 00 — Feature Inventory (approved boundaries)

Data: 2026-07-08. Zrodlo: Feature Discovery subagent (pelny odczyt src/server.ts 1-935, src/auth.ts 1-243, src/db.ts 1-571, frontend/src) + wiedza orchestratora z learn-codebase.

Konsolidacja wzgledem surowego raportu discovery: 17 kandydatow -> 8 feature'ow. Uzasadnienie przy kazdym.

## F1: auth-session

Google OAuth2 + sesje + frontend auth state. Scalone A+N+O+P z discovery — jeden przeplyw zaufania, jeden zestaw tabel.

- Entry points: `src/auth.ts:72` (GET /auth/google), `src/auth.ts:88` (callback), `src/auth.ts:142` (GET /auth/me), `src/auth.ts:172` (POST /auth/logout), `src/auth.ts:182` (disconnect-calendar), `src/auth.ts:188` (calendar-connect), `src/auth.ts:199` (dev-login), `frontend/src/hooks/useAuth.tsx` (AuthProvider/useAuth), `frontend/src/components/LoginPage.tsx`, `frontend/src/components/AccountPage.tsx`
- Core files: src/auth.ts, src/db.ts (users, sessions, user_tokens), useAuth.tsx, LoginPage.tsx, AccountPage.tsx
- Side effects: DB users/sessions/user_tokens; Google OAuth2 API; cookie session_id (httpOnly, Lax, 30 dni); token auto-refresh w `getOAuth2ClientForUser()`

## F2: calendar

Google Calendar multi-calendar z per-user OAuth.

- Entry points: `src/server.ts:633` (GET /api/calendars), `src/server.ts:661` (POST /api/calendars/prefs), `src/server.ts:674` (GET /api/calendar), `frontend/src/components/Calendar.tsx:38`
- Core files: server.ts (calendar routes), db.ts (user_calendar_prefs), Calendar.tsx
- Side effects: DB user_calendar_prefs; Google Calendar API v3; zalezy od F1 (tokeny)

## F3: weather

Pogoda multi-city (OpenWeatherMap) — jeden widget, wewnetrzny grid.

- Entry points: `src/server.ts:243` (GET /api/weather), `src/server.ts:221` (cities/search), `src/server.ts:202,206,213` (user-cities CRUD), `frontend/src/components/Weather.tsx`
- Core files: server.ts, db.ts (user_cities), Weather.tsx
- Side effects: DB user_cities; OWM current+forecast+geocoding

## F4: market-tickers

**Scalone E+F+G (crypto, currencies, stocks)** — decyzja orchestratora: trzy pod-domeny o identycznym ksztalcie (user-list CRUD w DB -> proxy zewnetrznego API -> ticker + wykres historyczny z cache TTL -> frontend fetch+ticker+chart). To glowny kandydat duplikacji; jeden flowchart pokazuje wzorzec i rozgalezienia per zrodlo danych.

- Entry points crypto: `src/server.ts:271` (/api/btc), `:337` (/api/btc/history), `:398,402,408` (user-cryptos CRUD), `:414` (available), `:433` (/api/crypto/:symbol), `:457` (history), `frontend/src/components/Crypto.tsx:21`
- Entry points currencies: `src/server.ts:296` (/api/currencies), `:326` (history/:code), `:475,478,484` (user-currencies CRUD), `:490` (available), `:505` (/api/currency/:code), `frontend/src/components/Currencies.tsx:21`
- Entry points stocks: `src/server.ts:354` (/api/stock/:symbol), `:369` (history), `:520,525,532` (user-stocks CRUD), `:538` (search), `frontend/src/components/Stocks.tsx:22`
- Core files: server.ts, db.ts (user_cryptos, user_currencies, user_stocks), Crypto.tsx, Currencies.tsx, Stocks.tsx, TickerCards.tsx, useChartData.ts
- Side effects: Binance (ticker+klines), NBP (kursy biezace+historyczne), Yahoo Finance (quote+historia); cache TTL 30min historia / 5min kursy

## F5: rss

Dynamiczne widgety RSS z custom feedami i SSRF guard.

- Entry points: `src/server.ts:556,560,567,574` (rss-widgets CRUD), `:579,593` (feeds add/remove), `:603` (GET /api/rss proxy + SSRF), `frontend/src/components/RSS.tsx:32`
- Core files: server.ts, db.ts (user_rss_widgets, user_rss_feeds FK cascade), RSS.tsx
- Side effects: fetch dowolnych URL-i RSS (server-side, rss-parser); SSRF blocklist IP wewnetrznych

## F6: todos

Google Tasks multi-list.

- Entry points: `src/server.ts:736,740,761,768` (todo-lists CRUD), `:787,817,840,869,892` (tasks CRUD+move), `frontend/src/components/TodoList.tsx:32`
- Core files: server.ts, db.ts (user_todo_lists), TodoList.tsx
- Side effects: Google Tasks API v1; DB mapowanie list; zalezy od F1 (tokeny, scope tasks)

## F7: layout-prefs

**Scalone J+K** — layout grid i widget-prefs sprzezone przez `saved_layout` (disable zapisuje layout widgetu, enable przywraca).

- Entry points: `src/server.ts:911` (GET /api/layout), `:917` (PUT /api/layout), `:164` (GET /api/widget-prefs), `:168` (PUT /api/widget-prefs/:widgetId), `frontend/src/hooks/useLayout.ts`, `frontend/src/hooks/useWidgetPrefs.ts`, `frontend/src/components/DashboardGrid.tsx`, `frontend/src/components/DisableWidgetDialog.tsx`
- Core files: jw. + db.ts (user_layouts, user_widget_prefs, clearWidgetData())
- Side effects: DB user_layouts (JSON per-breakpoint lg/md/sm), user_widget_prefs; debounced save 800ms; clearWidgetData() kasuje dane domenowe przy disable z opcja

## F8: header-static

**Scalone D+L+M+Q** — quote + nameday + holidays + header/sidebar UI. Male, przewaznie statyczne; jeden lekki flowchart.

- Entry points: `src/server.ts:185` (GET /api/quote), `frontend/src/components/Quote.tsx:16`, `frontend/src/components/Nameday.tsx` (getTodayNameday, embedded DB), `frontend/src/lib/holidays.ts` (getTodayHolidays), `frontend/src/components/DashboardHeader.tsx`, `frontend/src/components/AppSidebar.tsx`
- Side effects: quotable.io z fallbackiem lokalnym; reszta czysto statyczna

## Dead code (potwierdzone grep-em przez discovery)

1. `server.js` (root, 103 ln) — legacy backend port 3000, klucze API w query params, RSS bez SSRF guard; zero referencji, package.json wskazuje src/server.ts. **DELETE**
2. `start-frontend.js` (root) — nieuzywany launcher (spawn vite) + martwy import execSync; zero referencji. **DELETE**
3. `frontend/src/template/metrica-theme.css` — nieuzywany (tokeny sa w index.css). UWAGA: `template/AppShell.tsx` JEST uzywany przez App.tsx (discovery blednie oznaczyl caly katalog — orchestrator koryguje na bazie learn-codebase: App.tsx importuje AppShell). Dead tylko metrica-theme.css + ew. template/README.md.
