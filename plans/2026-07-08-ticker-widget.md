# Plan: TickerWidget — konsolidacja Crypto/Currencies/Stocks + dead code

Data: 2026-07-08. Zrodlo: PATHFINDER-2026-07-08/04-handoff-prompts.md P1 (dowody: 02-duplication-report.md D1, D5; flowchart 01-flowcharts/market-tickers.md). Kazda faza samowystarczalna — wykonuj kolejno, kazda w swiezym kontekscie jesli trzeba.

Reguly projektu (CLAUDE.md): strict TS zero `any` (uzywaj `unknown` + type guards), zero `@ts-ignore`, named exports, jeden komponent na plik, typy wspolne w `frontend/src/types.ts`, polski tekst UI bez diakrytykow w identyfikatorach. Przed commitem: `npm run lint && npm run build` musza przejsc.

---

## Phase 0 — Zweryfikowane API (DONE, wyniki ponizej; NIE wymyslaj innych)

### Allowed APIs (dokladne, z odczytu zrodel 2026-07-08)

| API | Zrodlo | Sygnatura |
|---|---|---|
| `TickerData` | TickerCards.tsx:3-10 | `{ id: string; label: string; displayValue: string; unit: string; change: number; error?: boolean }` |
| `TickerGrid` | TickerCards.tsx:50 | `{ items: TickerData[]; active: string; onSelect: (id: string) => void }` |
| `SettingsModal` | SettingsModal.tsx:9-16 | `{ open: boolean; onClose: () => void; title: string; children: ReactNode }` (default export) |
| `useChartData` | useChartData.ts:9-37 | hook fetch+cache historii; **NIE MODYFIKOWAC** — przeczytaj plik przed uzyciem, zwracany ksztalt stamtad |
| `fmtPLN` | utils.ts:32-34 | `(val: number, maxDecimals = 2) => string` |
| `fmtChartDate` | utils.ts:36-40 | `(dateStr: string, period: number) => string` |
| `PERIODS`, `CHART_CACHE_TTL` | config.ts:1-10 | okresy 7/30/90/365 |
| `ChartPoint` | types.ts:49-52 | wspolny typ punktu wykresu |

### Endpointy i ksztalty odpowiedzi (per domena)

| Operacja | Crypto | Currencies | Stocks |
|---|---|---|---|
| Lista usera | GET `/api/user-cryptos` | GET `/api/user-currencies` | GET `/api/user-stocks` |
| Dodaj | POST `/api/user-cryptos` body `{symbol, name}` | POST `/api/user-currencies` body `{code, name}` | POST `/api/user-stocks` body `{symbol, name}` |
| Usun | DELETE `/api/user-cryptos/{symbol}` | DELETE `/api/user-currencies/{code}` | DELETE `/api/user-stocks/{symbol}` |
| Cena | `/api/crypto/{symbol}` → `data.ticker.rate`, `.previousRate` | `/api/currency/{code}` → `data.mid`, `.prev` (moze byc undefined) | `/api/stock/{symbol}` → `data.chart.result[0].meta.regularMarketPrice`, `.chartPreviousClose \|\| .previousClose`, `.currency` (default 'PLN') |
| Historia | `/api/crypto/{symbol}/history?days={d}` | `/api/currencies/history/{code}?days={d}` | `/api/stock/{symbol}/history?days={d}` |
| Picker | GET `/api/cryptos/available` (statyczna lista) | GET `/api/currencies/available` (statyczna) | GET `/api/stocks/search?q={q}` (live search) |

### Tabela delt (config MUSI je jawnie zakodowac)

| Wymiar | Crypto | Currencies | Stocks |
|---|---|---|---|
| Klucz elementu | `symbol` | `code` | `symbol` |
| Label karty | `${symbol}/PLN` | `${code}/PLN` | `symbol` (bez /PLN) |
| Miejsca dziesietne | 2 | 4 (`fmtPLN(mid, 4)` :92) | 2 |
| Skalowanie "k" | `price >= 1000 → (price/1000).toFixed(1)k` (Crypto.tsx:89,94) | brak | brak |
| Unit | `'zl'` | `'zl'` | `s.currency \|\| 'PLN'` (dynamiczny) |
| YAxis width | 70/50 dynamiczne od isBig (:141) | 50 (:139) | 55 (:151) |
| YAxis formatter | `isBig ? (v/1000)k : v.toFixed(2)` (:142) | `v.toFixed(2)` (:139) | `fmtPLN(v)` (:151) |
| Tooltip | `fmtPLN(v) zl` (:146) | `fmtPLN(v, 4) zl` (:143) | `fmtPLN(v) {currency}` (:155) |
| Picker | available list, filtr client-side (:87) | available list, filtr client-side (:86) | server search, debounce 300ms useRef+setTimeout (:33,:66-77) |
| Tytul modala | "Zarzadzaj kryptowalutami" | "Zarzadzaj walutami" | "Zarzadzaj spolkami" |
| Gradient id | `cryptoGradient` (:135) | `currGradient` (:133) | `stockGradient` (:145) |

### Rozstrzygniecia faktow (orchestrator, grep-verified)

- **`/api/btc` i `/api/btc/history` (server.ts:271-293, :337-351) sa MARTWE.** Grep calego repo: jedyne referencje to martwy `server.js` i same definicje routes. Frontend wola wylacznie `/api/crypto/*` (Crypto.tsx:45,:59,:65). Raport discovery blednie twierdzil inaczej — odrzucone z dowodem.
- Sciezka dead CSS: `frontend/src/template/theme/metrica-theme.css` (w podkatalogu theme/). `frontend/src/template/components/AppShell.tsx` ZOSTAJE (uzywany przez App.tsx).
- package.json scripts nie referuja `server.js` (root) ani `start-frontend.js`.
- Montaz trio: App.tsx:136-138 w `staticWidgets` (`{ id: 'crypto' as WidgetId, node: <Crypto tick={tick} /> }` itd.).
- Martwy search button: DashboardHeader.tsx:78-84 (brak onClick).

### Anti-patterns (NIE istnieja / NIE robic)

- shadcn base-nova `Button` NIE ma propa `asChild` (gotcha z CLAUDE.md).
- NIE wymyslaj pol odpowiedzi API — ksztalty tylko z tabeli wyzej.
- NIE modyfikuj useChartData.ts, TickerCards.tsx, SettingsModal.tsx — sa juz wspolne i dzialaja.
- NIE twórz registry/factory ani feature flagi.

---

## Phase 1 — `useDebouncedCallback` + `TickerWidget`

### Co zaimplementowac

**1. `frontend/src/hooks/useDebouncedCallback.ts`** — hook `useDebouncedCallback<Args extends unknown[]>(fn: (...args: Args) => void, delay: number)`. Timer w `useRef`, **cleanup w useEffect return** (naprawia wyciek z Weather/Stocks). Delay w uzyciu: 300ms. Wzorzec do zastapienia: Stocks.tsx:33,:66-77 (useRef + setTimeout + clearTimeout, bez cleanup).

**2. `frontend/src/components/TickerWidget.tsx`** — jeden komponent `<TickerWidget config={...} tick={tick} />`. Sugerowany ksztalt configu (delty z tabeli Phase 0 jawnie; executor moze doszlifowac pola, ale KAZDA delta musi byc w configu, nie w if-ach po tytule):

```ts
export interface TickerItem { id: string; name: string }
export interface TickerPrice { value: number; change: number; currency?: string; error?: boolean }

export interface TickerConfig {
  settingsTitle: string;
  gradientId: string;
  listUrl: string;
  addUrl: string;
  addBody: (item: TickerItem) => Record<string, string>;   // {symbol,name} vs {code,name}
  deleteUrl: (id: string) => string;
  fetchPrice: (id: string) => Promise<TickerPrice>;         // parsowanie ksztaltu odpowiedzi TUTAJ (unknown + type guard)
  historyUrl: (id: string, days: number) => string;
  cardLabel: (id: string) => string;                        // `${id}/PLN` vs id
  displayValue: (p: TickerPrice) => string;                 // k-skalowanie BTC, 4 miejsca walut
  unit: (p: TickerPrice) => string;                         // 'zl' vs currency
  yAxis: (activeValue: number) => { width: number; tickFormatter: (v: number) => string };
  tooltipFormatter: (v: number, p: TickerPrice) => string;
  picker:
    | { kind: 'available'; url: string }
    | { kind: 'search'; url: (q: string) => string };
}
```

Kanoniczne zrodla do SKOPIOWANIA (nie transformuj w glowie — otworz plik i kopiuj):

| Element | Kopiuj z | Linie |
|---|---|---|
| AreaChart + defs wrapper | Stocks.tsx | 142-161 (najprostszy, bez isBig w srodku) |
| linearGradient | Crypto.tsx | 135-138 (id z configu) |
| Period buttons | Crypto.tsx | 120-126 (identyczne we wszystkich) |
| Glowny display ceny | Currencies.tsx | 110-115 (neutralny) |
| Settings body z search | Stocks.tsx | 168-197 (najpelniejszy: input + results + spinner + user list) |
| Settings body available | Crypto.tsx | 159-185 (filtr client-side) |
| Promise.all price fetch | Crypto.tsx | 39-57 (per-item error stub → `error: true`) |

### Bugi do naprawienia W TICKERWIDGET (raz, zamiast x3)

1. Mount fetch listy MUSI miec `.catch` ustawiajacy error-state + koniec loadingu (bug: Crypto.tsx:32-37, Currencies.tsx:32-37, Stocks.tsx:35-40 — loading wisi na zawsze).
2. Remove: uzyj funkcyjnego `setActive(prev => ...)` zamiast domkniecia na `active` (bug: Crypto.tsx:81-83, Currencies.tsx:80-82, Stocks.tsx:92-94).
3. ZERO non-null assertions na opcjonalnych polach (bug: `fmtPLN(s.price!)` Stocks.tsx:103 przy `price?:` w typie :19) — `TickerPrice.value` jest wymagany, brak ceny = `error: true`.
4. Search w pickerze `kind: 'search'` przez `useDebouncedCallback` (300ms, cleanup).

### Weryfikacja Phase 1

- `cd frontend && npm run lint` przechodzi (nowe pliki, stare jeszcze nietkniete).
- `npx tsc --noEmit` w frontend bez bledow.
- Grep: `grep -n "as any\|@ts-ignore\|!" TickerWidget.tsx` — zero any/ts-ignore; non-null assertions tylko jesli naprawde niezbedne (cel: zero).

---

## Phase 2 — Configi + podmiana call sites + delete trio

### Co zaimplementowac

**1. `frontend/src/components/tickerConfigs.tsx`** — trzy STALE configi: `CRYPTO_CONFIG`, `CURRENCIES_CONFIG`, `STOCKS_CONFIG` (named exports). Wartosci WYLACZNIE z tabel Phase 0 (endpointy, ksztalty odpowiedzi, delty). `fetchPrice` parsuje odpowiedz przez `unknown` + type guard (zero any):
- crypto: `data.ticker.rate`/`.previousRate`, change = `(rate - prev) / prev * 100` — SKOPIUJ logike liczenia change z Crypto.tsx:45-50 (nie wymyslaj)
- currencies: `data.mid`/`.prev` (prev moze byc undefined → change 0 lub error, skopiuj z Currencies.tsx:45-49)
- stocks: `data.chart.result[0].meta` — skopiuj z Stocks.tsx:50-54 wraz z fallbackiem `chartPreviousClose || previousClose` i `currency || 'PLN'`

**2. App.tsx:136-138** — podmien:
```tsx
{ id: 'crypto' as WidgetId, node: <TickerWidget config={CRYPTO_CONFIG} tick={tick} /> },
{ id: 'currencies' as WidgetId, node: <TickerWidget config={CURRENCIES_CONFIG} tick={tick} /> },
{ id: 'stocks' as WidgetId, node: <TickerWidget config={STOCKS_CONFIG} tick={tick} /> },
```
Widget potrzebuje tez title/icon w naglowku karty — sprawdz jak trio renderuje naglowek (Card + icon; Crypto.tsx:112-127) i przenies do configu (`title`, `icon`).

**3. DELETE:** `frontend/src/components/Crypto.tsx`, `Currencies.tsx`, `Stocks.tsx`. Usun ich importy z App.tsx. Zadnych plikow "starych na wszelki wypadek".

### Weryfikacja Phase 2

- `grep -rn "from './components/Crypto'\|Currencies'\|Stocks'" frontend/src` → zero trafien (poza tickerConfigs jesli nazwa podobna — nazwij plik jednoznacznie).
- `cd frontend && npm run lint && npm run build` przechodzi.
- Reczny test w przegladarce (frontend :5173, backend :3001 juz dzialaja): kazdy z 3 widgetow pokazuje karty + wykres; przelaczanie okresow 7D/1M/3M/1R; dodanie i usuniecie pozycji w kazdym modalu; search spolek (debounce); BTC >= 1000 pokazuje format "k"; waluty 4 miejsca; spolki walute z API.

---

## Phase 3 — Dead code delete

Czyste usuniecia (wszystkie grep-verified w Phase 0):

1. `server.js` (root, 103 ln) i `start-frontend.js` (root).
2. `frontend/src/template/theme/metrica-theme.css` + `frontend/src/template/README.md`. **NIE ruszaj `frontend/src/template/components/AppShell.tsx`** (App.tsx go importuje).
3. `src/server.ts`: routes `/api/btc` (:271-293) i `/api/btc/history` (:337-351). Po usunieciu sprawdz osierocone symbole (typy/importy uzywane tylko przez te routes — np. typ odpowiedzi Binance jesli dedykowany) i usun je tez. Cache key `btc-history-` znika razem z route.
4. `DashboardHeader.tsx:78-84` — martwy przycisk search (brak onClick). Usun tez import `SearchIcon` jesli osierocony.
5. Nieuzywane importy `useCallback` znikaja razem z trio (Phase 2).

### Weryfikacja Phase 3

- `grep -rn "api/btc" src frontend/src` → zero trafien.
- `grep -rn "metrica-theme\|start-frontend" .` (bez node_modules, PATHFINDER-*, plans) → zero trafien w kodzie.
- Backend restart (ts-node bez watch): ubij i wystartuj `npx ts-node src/server.ts`; `curl http://localhost:3001/api/crypto/BTC` (z cookie sesji lub sprawdz w przegladarce) — crypto widget dalej dziala.
- `npm run build` (root, tsc backendu) przechodzi.

---

## Phase 4 — Weryfikacja koncowa

1. `npm run lint` (root — odpala frontend lint + typecheck) i `npm run build` — oba zielone.
2. Grep anti-patterns: `grep -rn "@ts-ignore\|: any\|as any" frontend/src/components/TickerWidget.tsx frontend/src/components/tickerConfigs.tsx frontend/src/hooks/useDebouncedCallback.ts` → zero.
3. Grep martwych referencji: `Crypto.tsx|Currencies.tsx|Stocks.tsx|api/btc|metrica-theme` → zero w kodzie zrodlowym.
4. Reczny smoke test dashboardu (3 widgety ticker + reszta nietknieta: weather, calendar, rss, todos, layout dziala).
5. Dopiero po zielonym lint+build: commit (bez .env*, sprawdz git status przed).

## Poza zakresem (NIE ruszac w tym planie)

- apiFetch / globalna obsluga bledow (P2 z 04-handoff-prompts.md)
- backend resolveTasklist / registerUserListCrud (P3)
- NameDialog, ConfirmDialog hoist (P4)
- useChartData, TickerCards, SettingsModal — bez zmian
