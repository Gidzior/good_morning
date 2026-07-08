# Flowchart: market-tickers

Pathfinder Phase 1 — 2026-07-08

## Sources consulted (exact paths + line ranges read)

**Backend:**
- `src/server.ts` lines 1-160 (imports, cache setup, helpers)
- `src/server.ts` lines 270-293 (/api/btc)
- `src/server.ts` lines 295-323 (/api/currencies)
- `src/server.ts` lines 325-334 (/api/currencies/history/:code)
- `src/server.ts` lines 336-351 (/api/btc/history)
- `src/server.ts` lines 353-366 (/api/stock/:symbol)
- `src/server.ts` lines 368-396 (/api/stock/:symbol/history)
- `src/server.ts` lines 398-411 (user-cryptos CRUD)
- `src/server.ts` lines 413-430 (/api/cryptos/available)
- `src/server.ts` lines 432-454 (/api/crypto/:symbol)
- `src/server.ts` lines 456-472 (/api/crypto/:symbol/history)
- `src/server.ts` lines 474-487 (user-currencies CRUD)
- `src/server.ts` lines 489-502 (/api/currencies/available)
- `src/server.ts` lines 504-517 (/api/currency/:code)
- `src/server.ts` lines 519-535 (user-stocks CRUD)
- `src/server.ts` lines 537-553 (/api/stocks/search)
- `src/db.ts` lines 68-90 (table schemas)
- `src/db.ts` lines 204-223 (user_cryptos/currencies/stocks CRUD statements)
- `src/db.ts` lines 387-417 (public API exports)

**Frontend:**
- `frontend/src/components/Crypto.tsx` (full file)
- `frontend/src/components/Currencies.tsx` (full file)
- `frontend/src/components/Stocks.tsx` (full file)
- `frontend/src/components/TickerCards.tsx` (full file)
- `frontend/src/hooks/useChartData.ts` (full file)
- `frontend/src/components/SettingsModal.tsx` (full file)
- `frontend/src/config.ts` (PERIODS, CHART_CACHE_TTL)
- `frontend/src/types.ts` (ChartPoint interface)

---

## Findings

### Shared Happy Path Pattern (all three sub-domains)

1. **Component Mount**
   - `useEffect` fetches `/api/user-X` (lines: Crypto 32–37, Currencies 32–37, Stocks 35–40)
   - Parses list of user-selected items into state: `cryptos`/`currencies`/`stocks`
   - Sets `active` to first item if not set (line: Crypto 35, Currencies 35, Stocks 38)

2. **Per-Item Current Price Fetch**
   - `useEffect` on `[cryptos/currencies/stocks, tick]` (lines: Crypto 39–57, Currencies 39–56, Stocks 42–61)
   - `Promise.all()` maps over all items → fetch `/api/crypto/:symbol` / `/api/currency/:code` / `/api/stock/:symbol`
   - Parse price + previous price → compute change % (lines: Crypto 48–50, Currencies 48–49, Stocks 52–54)
   - On error: catch, log, return stub with `error: true` (lines: Crypto 51–54, Currencies 50–53, Stocks 55–58)
   - Render `TickerCards` component with results (lines: Crypto 91–98, Currencies 89–96, Stocks 100–107)

3. **Chart Data Fetch (via useChartData hook)**
   - `useChartData(chartUrl, tick)` called with `chartUrl = /api/X/history?days={period}`
   - Hook on line Crypto 59, Currencies 58, Stocks 63
   - Hook implementation (`frontend/src/hooks/useChartData.ts` lines 14–31):
     - Check in-memory `useRef` cache (line 16), TTL = `CHART_CACHE_TTL` = 30min (config.ts line 10)
     - If miss or stale: `fetch(url)` → parse `ChartPoint[]` → store in cache (lines 23–28)
     - On error: log to console, show "Brak danych" message (line 31)

4. **Backend Ticker Endpoints (price + change)**
   - `/api/crypto/:symbol` (server.ts 433–454): fetch Binance USDT, convert PLN via USD/PLN rate, return `{ticker: {rate, previousRate}}`
   - `/api/currency/:code` (server.ts 505–517): fetch NBP table A, return `{mid, prev}` for change calc
   - `/api/stock/:symbol` (server.ts 354–366): fetch Yahoo Finance meta, return raw chart object with `regularMarketPrice`, `chartPreviousClose`

5. **Backend History Endpoints (cached 30min)**
   - Shared handler: `cachedHistoryHandler` (server.ts 140–151)
   - Cache mechanism: `cached(key, THIRTY_MIN, fetcher)` (server.ts 72–88)
   - In-memory `Map<string, CacheEntry<T>>` with max size 200 (lines 70, 82–84)
   - LRU eviction on overflow (line 84)
   - `/api/crypto/:symbol/history` (server.ts 457–471): fetch Binance klines + NBP USD/PLN series, compose PLN prices
   - `/api/currencies/history/:code` (server.ts 326–333): fetch NBP historical rates
   - `/api/stock/:symbol/history` (server.ts 369–395): fetch Yahoo Finance chart, extract close prices, filter nulls

6. **Frontend Rendering**
   - Ticker rows/cards (TickerCards.tsx lines 21–60): display `displayValue` + `unit` + `change%`
   - Area chart with Recharts (Crypto 129–152, Currencies 127–150, Stocks 139–162): `chart` state from `useChartData`
   - Period selector buttons (PERIODS from config.ts, mapped at Crypto 120–125, Currencies 118–123, Stocks 130–135)
   - Period change updates `period` state → rebuilds `chartUrl` → triggers chart re-fetch

---

## Mermaid diagram

```mermaid
flowchart TD
    %% === SHARED INITIALIZATION ===
    CompMount["Component Mount<br/>Crypto/Currencies/Stocks.tsx:32-40"]
    UserFetch["GET /api/user-cryptos/-currencies/-stocks<br/>Crypto.tsx:33 | Currencies.tsx:33 | Stocks.tsx:36"]
    SetItems["setState cryptos/currencies/stocks<br/>Crypto.tsx:34 | Currencies.tsx:34 | Stocks.tsx:37"]
    SetActive["if first item & !active:<br/>setActive to first<br/>Crypto.tsx:35 | Currencies.tsx:35 | Stocks.tsx:38"]
    
    CompMount --> UserFetch
    UserFetch --> SetItems
    SetItems --> SetActive
    
    %% === CURRENT PRICE FETCH (all items) ===
    PriceFetch["useEffect [cryptos/currencies/stocks, tick]<br/>Crypto.tsx:39 | Currencies.tsx:39 | Stocks.tsx:42"]
    PromiseAll["Promise.all( items.map(async item =><br/>fetch /api/crypto/:symbol OR /api/currency/:code OR /api/stock/:symbol))"]
    SetActive --> PriceFetch
    PriceFetch --> PromiseAll
    
    %% === PER-DOMAIN: CRYPTO BRANCH ===
    CryptoBranch["<b>CRYPTO BRANCH</b><br/>Binance USDT + NBP USD/PLN"]
    CryptoFetch["GET /api/crypto/:symbol<br/>server.ts:433"]
    CryptoFetchImpl["fetch Binance<br/>api.binance.com/api/v3/ticker/24hr?symbol=:symbolUSDT<br/>server.ts:436"]
    CryptoGetRate["await getUsdPlnRate()<br/>server.ts:438<br/>cached 5min"]
    CryptoCalc["rate = lastPrice × USD/PLN<br/>previousRate = openPrice × USD/PLN<br/>server.ts:440-441"]
    CryptoReturn["res.json {ticker: {rate, previousRate}}<br/>server.ts:442-449"]
    CryptoFrontend["parse: price, prev<br/>change = (price-prev)/prev * 100<br/>Crypto.tsx:48-50"]
    
    PromiseAll --> CryptoBranch
    CryptoBranch --> CryptoFetch
    CryptoFetch --> CryptoFetchImpl
    CryptoFetchImpl --> CryptoGetRate
    CryptoGetRate --> CryptoCalc
    CryptoCalc --> CryptoReturn
    CryptoReturn --> CryptoFrontend
    
    %% === PER-DOMAIN: CURRENCIES BRANCH ===
    CurrBranch["<b>CURRENCIES BRANCH</b><br/>NBP Table A"]
    CurrFetch["GET /api/currency/:code<br/>server.ts:505"]
    CurrFetchImpl["fetch NBP last/2<br/>api.nbp.pl/api/exchangerates/rates/A/:code<br/>server.ts:507"]
    CurrExtract["extract current (rates[-1]) & prev<br/>server.ts:509-511"]
    CurrReturn["res.json {code, currency, mid, prev}<br/>server.ts:512"]
    CurrFrontend["parse: mid, prev<br/>change = (mid-prev)/prev * 100<br/>Currencies.tsx:48-49"]
    
    PromiseAll --> CurrBranch
    CurrBranch --> CurrFetch
    CurrFetch --> CurrFetchImpl
    CurrFetchImpl --> CurrExtract
    CurrExtract --> CurrReturn
    CurrReturn --> CurrFrontend
    
    %% === PER-DOMAIN: STOCKS BRANCH ===
    StockBranch["<b>STOCKS BRANCH</b><br/>Yahoo Finance"]
    StockFetch["GET /api/stock/:symbol<br/>server.ts:354"]
    StockFetchImpl["fetch Yahoo Finance<br/>query1.finance.yahoo.com/v8/finance/chart/:symbol<br/>?range=2d&interval=1d<br/>server.ts:356-359"]
    StockReturn["res.json raw data<br/>server.ts:361"]
    StockFrontend["parse: meta.regularMarketPrice<br/>meta.chartPreviousClose OR previousClose<br/>change = (price-prev)/prev * 100<br/>Stocks.tsx:51-54"]
    
    PromiseAll --> StockBranch
    StockBranch --> StockFetch
    StockFetch --> StockFetchImpl
    StockFetchImpl --> StockReturn
    StockReturn --> StockFrontend
    
    %% === SHARED: RENDER TICKER CARDS ===
    PriceResults["setResults(tickers)<br/>Crypto.tsx:56 | Currencies.tsx:55 | Stocks.tsx:60"]
    TickerMap["map results → TickerData[]<br/>{id, label, displayValue, unit, change}<br/>Crypto.tsx:91-98 | Currencies.tsx:89-96 | Stocks.tsx:100-107"]
    RenderTickers["<TickerGrid items={tickers} active={active}<br/>onSelect={setActive}/><br/>Crypto.tsx:155 | Currencies.tsx:152 | Stocks.tsx:164"]
    
    CryptoFrontend --> PriceResults
    CurrFrontend --> PriceResults
    StockFrontend --> PriceResults
    PriceResults --> TickerMap
    TickerMap --> RenderTickers
    
    %% === SHARED: CHART DATA FETCH ===
    ChartUrlBuild["chartUrl = /api/crypto/:symbol/history<br/>OR /api/currencies/history/:code<br/>OR /api/stock/:symbol/history<br/>?days={period}"]
    UseChartData["useChartData(chartUrl, tick)<br/>Crypto.tsx:59 | Currencies.tsx:58 | Stocks.tsx:63"]
    
    SetActive --> ChartUrlBuild
    ChartUrlBuild --> UseChartData
    
    %% === CHART HOOK: CLIENT CACHE ===
    ChartCheck["useChartData: check useRef cache<br/>useChartData.ts:16-20"]
    ChartMiss["cache miss or TTL expired?<br/>CHART_CACHE_TTL = 30min<br/>config.ts:10"]
    ChartFetch["fetch(chartUrl)<br/>useChartData.ts:23"]
    ChartParse["parse ChartPoint[]<br/>{date, value}<br/>useChartData.ts:25"]
    ChartStore["cache.current.set(url, {data, ts})<br/>setChart(data)<br/>useChartData.ts:27-28"]
    ChartRender["useEffect [load, tick]<br/>calls load()<br/>useChartData.ts:34"]
    
    UseChartData --> ChartRender
    ChartRender --> ChartCheck
    ChartCheck --> ChartMiss
    ChartMiss -->|hit & fresh| ChartStore
    ChartMiss -->|miss or stale| ChartFetch
    ChartFetch --> ChartParse
    ChartParse --> ChartStore
    
    %% === BACKEND HISTORY: CRYPTO ===
    CryptoHistUrl["GET /api/crypto/:symbol/history<br/>?days={period}<br/>server.ts:457"]
    CryptoHistCache["cachedHistoryHandler<br/>server.ts:460<br/>cache key: crypto-:symbol-:days<br/>TTL: THIRTY_MIN = 30min<br/>server.ts:91"]
    CryptoBinanceFetch["fetch Binance klines<br/>symbol=:symbolUSDAT&interval=1d&limit=:days<br/>server.ts:462"]
    CryptoNBPSeries["getUsdPlnSeries(:days)<br/>cached 30min<br/>NBP USD/PLN historical rates<br/>server.ts:463"]
    CryptoCompose["compose klines[close] × NBP_rate<br/>map to {date, value:PLN}<br/>server.ts:465-470"]
    
    UseChartData --> CryptoHistUrl
    CryptoHistUrl --> CryptoHistCache
    CryptoHistCache --> CryptoBinanceFetch
    CryptoHistCache --> CryptoNBPSeries
    CryptoBinanceFetch --> CryptoCompose
    CryptoNBPSeries --> CryptoCompose
    CryptoCompose --> ChartParse
    
    %% === BACKEND HISTORY: CURRENCIES ===
    CurrHistUrl["GET /api/currencies/history/:code<br/>?days={period}<br/>server.ts:326"]
    CurrHistCache["cachedHistoryHandler<br/>server.ts:329<br/>cache key: nbp-:code-:days<br/>TTL: THIRTY_MIN<br/>server.ts:91"]
    CurrNBPFetch["fetch NBP historical rates<br/>api.nbp.pl/api/exchangerates/rates/A/:code<br/>/last/:days<br/>server.ts:330"]
    CurrHistMap["map {effectiveDate, mid}<br/>to {date, value:mid}<br/>server.ts:332"]
    
    UseChartData --> CurrHistUrl
    CurrHistUrl --> CurrHistCache
    CurrHistCache --> CurrNBPFetch
    CurrNBPFetch --> CurrHistMap
    CurrHistMap --> ChartParse
    
    %% === BACKEND HISTORY: STOCKS ===
    StockHistUrl["GET /api/stock/:symbol/history<br/>?days={period}<br/>server.ts:369"]
    StockHistCache["cachedHistoryHandler<br/>server.ts:374<br/>cache key: stock-:symbol-:range<br/>TTL: THIRTY_MIN<br/>server.ts:91"]
    StockRangeMap["map days → range: 5d/1mo/3mo/1y<br/>server.ts:372-373"]
    StockYahooFetch["fetch Yahoo Finance<br/>query1.finance.yahoo.com/v8/finance/chart/:symbol<br/>?range=:range&interval=1d<br/>server.ts:375"]
    StockExtract["extract timestamps & closes<br/>from chart.result[0].indicators.quote[0].close<br/>server.ts:388-389"]
    StockMap["map {timestamp, close}<br/>to {date, value}<br/>filter nulls<br/>server.ts:390-394"]
    
    UseChartData --> StockHistUrl
    StockHistUrl --> StockHistCache
    StockHistCache --> StockRangeMap
    StockRangeMap --> StockYahooFetch
    StockYahooFetch --> StockExtract
    StockExtract --> StockMap
    StockMap --> ChartParse
    
    %% === RENDER CHART ===
    ChartRender2["Render AreaChart<br/>data={chart}<br/>Crypto.tsx:133-150 | Currencies.tsx:131-148 | Stocks.tsx:143-159"]
    ChartStore --> ChartRender2
    
    %% === SETTINGS / ADD ITEM ===
    OpenSettings["openSettings()<br/>setShowSettings(true)<br/>Crypto.tsx:62 | Currencies.tsx:61 | Stocks.tsx:112"]
    SettingsFetch["if !available.length:<br/>fetch /api/cryptos/available<br/>OR /api/currencies/available<br/>server.ts:414 or 490<br/>Crypto.tsx:65 | Currencies.tsx:64"]
    AvailableCache["cached 30min<br/>server.ts:416 or 492<br/>THIRTY_MIN<br/>Binance exchangeInfo OR NBP table A<br/>server.ts:417-424 or 493-495"]
    ShowModal["<SettingsModal> with search input<br/>filtered available list<br/>+ user's list with delete buttons<br/>Crypto.tsx:159-185 | Currencies.tsx:156-182 | Stocks.tsx:168-197"]
    
    RenderTickers --> OpenSettings
    OpenSettings --> SettingsFetch
    SettingsFetch --> AvailableCache
    AvailableCache --> ShowModal
    
    %% === ADD / REMOVE ===
    AddItem["addCrypto(c)/addCurrency(c)/addStock(s)<br/>Crypto.tsx:69 | Currencies.tsx:68 | Stocks.tsx:79"]
    PostAdd["POST /api/user-cryptos/-currencies/-stocks<br/>body: {symbol/code, name}<br/>server.ts:402 | 478 | 525"]
    DbInsert["db: INSERT user_cryptos/-currencies/-stocks<br/>server.ts: addUserCrypto/addUserCurrency/addUserStock<br/>db.ts:205-207 | 212-214 | 219-221"]
    RefreshState["setCryptos([...prev, item])<br/>triggers price fetch again<br/>Crypto.tsx:73"]
    
    ShowModal --> AddItem
    AddItem --> PostAdd
    PostAdd --> DbInsert
    DbInsert --> RefreshState
    
    RemoveItem["removeCrypto(symbol)/removeCurrency(code)/removeStock(symbol)<br/>Crypto.tsx:77 | Currencies.tsx:76 | Stocks.tsx:88"]
    DeleteRoute["DELETE /api/user-cryptos/:symbol<br/>OR /api/user-currencies/:code<br/>OR /api/user-stocks/:symbol<br/>server.ts:408 | 484 | 532"]
    DbDelete["db: DELETE from user_cryptos/-currencies/-stocks<br/>server.ts: deleteUserCrypto/deleteUserCurrency/deleteUserStock<br/>db.ts:209 | 216 | 223"]
    RefreshRemove["setCryptos(prev.filter(...))<br/>if active === removed: setActive to next<br/>Crypto.tsx:80-84"]
    
    ShowModal --> RemoveItem
    RemoveItem --> DeleteRoute
    DeleteRoute --> DbDelete
    DbDelete --> RefreshRemove
    
    %% === CACHE LAYER ===
    BackendCache["In-memory Backend Cache<br/>server.ts:70<br/>Map<key, {data, expires}>"]
    CacheLru["LRU eviction at max 200 entries<br/>server.ts:82-84"]
    CacheKey["Keys: crypto-:symbol-:days<br/>nbp-:code-:days<br/>stock-:symbol-:range<br/>nbp-usd-pln-series-:days<br/>nbp-usd-pln-current<br/>binance-usdt-pairs<br/>nbp-currencies"]
    
    CryptoHistCache -.->|via cached()| BackendCache
    CurrHistCache -.->|via cached()| BackendCache
    StockHistCache -.->|via cached()| BackendCache
    BackendCache --> CacheLru
    BackendCache --> CacheKey
    
    style CompMount fill:#e1f5ff
    style UserFetch fill:#e1f5ff
    style PriceFetch fill:#fff3e0
    style CryptoBranch fill:#f3e5f5
    style CurrBranch fill:#f3e5f5
    style StockBranch fill:#f3e5f5
    style RenderTickers fill:#e8f5e9
    style UseChartData fill:#e0f2f1
    style BackendCache fill:#fce4ec
    style CacheKey fill:#fce4ec
```

---

## Sub-domain comparison table

| Aspect | **Crypto** | **Currencies** | **Stocks** |
|--------|-----------|----------------|-----------|
| **Backend routes** | `/api/btc` (271) + `/api/crypto/:symbol` (433) | `/api/currencies` (296) + `/api/currency/:code` (505) | `/api/stock/:symbol` (354) |
| **Current price fetcher** | Binance `ticker/24hr?symbol=BTCUSDT` (274) → `lastPrice`, `openPrice` | NBP Table A `exchangerates/tables/A` (299) → `rates[].mid` | Yahoo Finance `v8/finance/chart/:symbol?range=2d` (356) → `meta.regularMarketPrice`, `meta.chartPreviousClose` |
| **USD/PLN conversion** | `getUsdPlnRate()` (438, cached 5min) × Binance price (277) | None (direct mid rate) | None (Yahoo returns currency) |
| **History route** | `/api/crypto/:symbol/history` (457) | `/api/currencies/history/:code` (326) | `/api/stock/:symbol/history` (369) |
| **History fetch impl** | Binance `klines?symbol=:symbolUSDAT&interval=1d&limit=:days` (462) + `getUsdPlnSeries()` (463) | NBP `exchangerates/rates/A/:code/last/:days` (330) | Yahoo Finance `chart/:symbol?range=:range&interval=1d` (375), range mapped from days (372–373) |
| **History cache key** | `crypto-:symbol-:days` (460) | `nbp-:code-:days` (329) | `stock-:symbol-:range` (374) |
| **Cache TTL** | 30min (THIRTY_MIN, 91) | 30min (THIRTY_MIN, 91) | 30min (THIRTY_MIN, 91) |
| **Available/search route** | `/api/cryptos/available` (414) | `/api/currencies/available` (490) | `/api/stocks/search` (538) |
| **Available/search impl** | Binance `exchangeInfo` (417), filter USDT + TRADING, cache 30min (416) | NBP Table A (493), cache 30min (492) | Yahoo Finance `v1/finance/search?q=:q&region=PL` (542), NO cache, filter `.WA` (546) |
| **DB table** | `user_cryptos` (68–74 in db.ts) | `user_currencies` (76–82 in db.ts) | `user_stocks` (84–90 in db.ts) |
| **CRUD routes** | POST (402) / DELETE (408) | POST (478) / DELETE (484) | POST (525) / DELETE (532) |
| **Frontend component** | `Crypto.tsx` | `Currencies.tsx` | `Stocks.tsx` |
| **Frontend state vars** | `cryptos`, `results` (CryptoResult[]), `active`, `period`, `available`, `query`, `showSettings` | `currencies`, `results` (CurrencyResult[]), `active`, `period`, `available`, `query`, `showSettings` | `stocks`, `results` (StockResult[]), `active`, `period`, `searchResults`, `query`, `searching`, `searchTimeout` (useRef) |
| **Ticker data** | `{id: symbol, label: "BTC/PLN", displayValue: formatted price or "1.2k", unit: "zl", change: %, error?}` (Crypto 91–98) | `{id: code, label: "USD/PLN", displayValue: formatted mid 4 decimals, unit: "zl", change: %, error?}` (Currencies 89–96) | `{id: symbol, label: symbol only, displayValue: formatted price or "—", unit: currency from meta, change: %, error?}` (Stocks 100–107) |
| **Chart rendering** | AreaChart gradient (135–149), YAxis auto-scale with 1000+ abbreviation (141–142) | AreaChart gradient (133–147), YAxis fixed 2 decimals (139) | AreaChart gradient (145–159), YAxis via fmtPLN (151) |
| **Format functions** | `fmtPLN(price)` (94) or abbreviate to 1.2k (94) | `fmtPLN(mid, 4)` decimals (92, 113, 143) | `fmtPLN(price!)` with non-null assertion (103) |

---

## External dependencies

1. **Binance API:**
   - `https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT` (server.ts 274)
   - `https://api.binance.com/api/v3/ticker/24hr?symbol=:symbolUSDT` (server.ts 437)
   - `https://api.binance.com/api/v3/klines?symbol=:symbolUSDAT&interval=1d&limit=:days` (server.ts 341, 462)
   - `https://api.binance.com/api/v3/exchangeInfo` (server.ts 417)

2. **NBP (Narodowy Bank Polski) API:**
   - `https://api.nbp.pl/api/exchangerates/tables/A/?format=json` (server.ts 299, 493)
   - `https://api.nbp.pl/api/exchangerates/tables/A/last/2/?format=json` (server.ts 300)
   - `https://api.nbp.pl/api/exchangerates/rates/A/:code/last/2/?format=json` (server.ts 507)
   - `https://api.nbp.pl/api/exchangerates/rates/A/USD/?format=json` (server.ts 99)
   - `https://api.nbp.pl/api/exchangerates/rates/A/USD/last/:days/?format=json` (server.ts 112)
   - `https://api.nbp.pl/api/exchangerates/rates/A/:code/last/:days/?format=json` (server.ts 330)

3. **Yahoo Finance API:**
   - `https://query1.finance.yahoo.com/v8/finance/chart/:symbol?range=2d&interval=1d` (server.ts 356)
   - `https://query1.finance.yahoo.com/v8/finance/chart/:symbol?range=:range&interval=1d` (server.ts 375)
   - `https://query1.finance.yahoo.com/v1/finance/search?q=:q&quotesCount=10&newsCount=0&region=PL` (server.ts 542)
   - User-Agent header: `Mozilla/5.0` (server.ts 358, 376, 543)

4. **Frontend libraries:**
   - Recharts (AreaChart, Area, XAxis, YAxis, ChartContainer, ChartTooltip)
   - React UI components (Button, Input, Dialog)
   - Utility function: `fmtPLN(value, decimals?)` (utils.ts, lines used: Crypto 94, 115, 146; Currencies 92, 113, 143; Stocks 103, 124, 155)

---

## Observations (bugs/reliability, file:line)

### Critical Issues

1. **Non-null assertion on optional field (Stocks.tsx:103)**
   ```typescript
   displayValue: s.error ? '—' : fmtPLN(s.price!),
   ```
   - `price` is optional in `StockResult` (Stocks.tsx:19 `price?: number`)
   - Non-null assertion `!` suppresses TypeScript check but crashes if `price` is undefined during render
   - **Risk:** If API returns missing price without error flag, UI breaks
   - **Fix:** Change to `fmtPLN(s.price ?? 0)` or validate before assignment

2. **Stale `active` closure in Stocks.tsx removals (lines 92–94)**
   ```typescript
   if (active === symbol) {
     const remaining = stocks.filter(s => s.symbol !== symbol);
     setActive(remaining[0]?.symbol || '');
   }
   ```
   - `active` state is read inside filter callback but not in dependency array for the handler
   - In Crypto/Currencies, same pattern exists (Crypto 81–83, Currencies 80–82)
   - **Risk:** If user rapidly removes items, `active` may reference stale closure value
   - **Severity:** Low (affects rapid double-clicks), but should use state setter callback

3. **Missing `.catch` on initial `/api/user-cryptos` fetch (Crypto.tsx:33, Currencies.tsx:33, Stocks.tsx:36)**
   ```typescript
   fetch('/api/user-cryptos').then(r => { if (!r.ok) throw new Error(...); return r.json(); }).then(setItems)
   ```
   - No `.catch()` handler — if fetch fails (network error), error swallows silently in console
   - **Risk:** Component hangs on `loading: true` forever if backend is unreachable
   - **Fix:** Add `.catch(err => { console.error(...); setLoading(false); })`

4. **Unhandled promise rejection in chart load (useChartData.ts:31)**
   ```typescript
   .catch((err) => { console.error(...); setChartLoading(false); });
   ```
   - **OK:** Error is caught and loading flag cleared — chart shows "Brak danych"
   - **Minor:** No user-facing error message; only console log

### Reliability Concerns

5. **Race condition on period change with stale `active` closure**
   - When user clicks period button quickly after switching active ticker:
     - `chartUrl` is built from `active` state (Crypto.tsx:59)
     - If `active` changes before fetch completes, chart may show data for wrong ticker
   - **Scenario:** User clicks BTC, chart starts loading. Clicks ETH immediately. Chart fetch for BTC completes, overwrites ETH's chart.
   - **Root cause:** `useChartData` hook doesn't invalidate pending requests; just overwrites state
   - **Fix:** Add abort controller or request ID to cancel stale requests

6. **No retry logic on external API failures**
   - If Binance, NBP, or Yahoo down: user sees empty tickers + "brak danych" chart (no retry UI)
   - Cached data (30min TTL) serves stale data on miss, but no fallback message
   - **Workaround:** User can refresh page to retry, but no exponential backoff

7. **Cache size limit on backend may evict data during high load**
   - `MAX_CACHE_SIZE = 200` (server.ts:69) with LRU eviction (line 84)
   - If many users request different stock symbols simultaneously, older entries drop
   - **Scenario:** User A has 10 cryptos × 4 periods × 2 requests = 80 cache entries. User B adds 150 stocks; User A's crypto history cache purged mid-load.
   - **Severity:** Low (30min TTL resets on miss), but suboptimal UX

8. **Stocks.tsx: Yahoo Finance filters by `.WA` suffix (Warsaw exchange)**
   - Line 546: `.filter(q => q.symbol?.endsWith('.WA'))`
   - **Risk:** Hardcoded to Polish market; non-obvious UI behavior if user doesn't know to search "ORLEN" vs "ORLENPL" vs "PKN.WA"
   - **Workaround:** Search result shows filtered list; user must select from available

### Code Duplication (Phase 2 candidates)

9. **Identical useEffect pattern for price fetches (Crypto.tsx:39–57, Currencies.tsx:39–56, Stocks.tsx:42–61)**
   - Structure: check list length, Promise.all with map, catch & return error stub, setResults
   - **Duplication factor:** ~95% identical
   - **Phase 2:** Extract to `useTickerPrices(items, tick)` hook

10. **Identical SettingsModal structure with search/add/remove (all three components)**
    - Modal → Input search → filtered list (map with add button) → user's list (map with remove button)
    - **Duplication factor:** ~90% identical
    - **Phase 2:** Extract to `<TickerSettingsModal items={items} available={available} onAdd={add} onRemove={remove} />`

11. **Near-identical chart period buttons (Crypto.tsx:120–125, Currencies.tsx:118–123, Stocks.tsx:130–135)**
    - Maps `PERIODS` with same onClick handler
    - **Duplication factor:** 100% identical
    - **Phase 2:** Component prop

---

## Confidence + gaps

**Confidence Level: Very High (95%)**

- All three sub-domains traced end-to-end from component mount to chart render
- Cache mechanisms fully documented with TTLs and keys
- External API contracts extracted (Binance ticker/klines, NBP table/rates, Yahoo Finance chart)
- DB layer reviewed for all three CRUD paths

**Gaps:**

1. **Error handling robustness:** No explicit testing of network failures, API timeouts, malformed responses
2. **Performance under load:** Cache eviction behavior untested with >200 concurrent entries
3. **Crypto symbol mapping:** BTC endpoint (line 271) vs dynamic `/crypto/:symbol` (line 433) — inconsistency not documented (may be intentional for "featured" BTC)
4. **Frontend utils:** `fmtPLN` and `fmtChartDate` signatures not read (assumed to exist and work correctly)
5. **Settings modal search debounce:** Stocks.tsx has 300ms debounce (line 76), but Crypto/Currencies load available list immediately (lines 65, 64) — asymmetric behavior

**Phase 2 recommendations:**
- Extract `useTickerPrices`, `useChartData` (already shared), `TickerSettingsModal` into reusable components
- Add `useAbortController` to cancel stale chart fetches
- Implement retry with exponential backoff for external API failures
- Add `.catch` on initial user-items fetch to unblock loading state
- Replace non-null assertions with optional-coalescing operators
