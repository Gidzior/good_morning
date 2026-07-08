# 02 — Duplication Report

Data: 2026-07-08. Synteza orchestratora z dwoch rownoleglych subagentow (within-feature + cross-feature). Kazdy claim cytuje >=2 lokalizacje `file:line` zweryfikowane pelnym odczytem zrodel w tej sesji.

Ranking wg wartosci konsolidacji (linie x ryzyko x realne bugi).

---

## D1. Trio ticker-widgetow: Crypto / Currencies / Stocks (~90-95% identyczne)

**Najwiekszy pojedynczy payoff w repo: ~140 z ~190 ln zduplikowane x3 (~280 ln do usuniecia).**

Rownolegle bloki (Crypto.tsx / Currencies.tsx / Stocks.tsx):
- deklaracje stanu: `Crypto.tsx:22-30` / `Currencies.tsx:22-30` / `Stocks.tsx:23-33`
- mount list-fetch: `:32-37` / `:32-37` / `:35-40`
- Promise.all price fetch z per-item error stub: `:39-57` / `:39-56` / `:42-61`
- chartUrl + useChartData: `:59-60` / `:58-59` / `:63-64`
- add handler: `:69-75` / `:68-74` / `:79-86`
- remove handler: `:77-85` / `:76-84` / `:88-96`
- header + przyciski okresu JSX: `:112-127` / `:110-125` / `:121-137`
- blok AreaChart: `:129-153` / `:127-150` / `:139-162`
- TickerGrid: `:155` / `:152` / `:164`
- SettingsModal body: `:159-185` / `:156-182` / `:168-197`

Realne delty behawioralne (konfig musi je objac):
- Crypto: `isBig` formatowanie (Crypto.tsx:89,141-142)
- Currencies: 4 miejsca dziesietne
- Stocks: debounced search (Stocks.tsx:66-77) vs statyczna available-list u pozostalych; klucz `symbol` vs `code`

Wspoldzielone bugi (x3, naprawia sie raz przy konsolidacji):
- brak `.catch` na mount fetch — unhandled rejection + loading wisi na zawsze: Crypto.tsx:32-37, Currencies.tsx:32-37, Stocks.tsx:35-40
- stale `active` closure przy remove: Crypto.tsx:81-83, Currencies.tsx:80-82, Stocks.tsx:92-94
- `fmtPLN(s.price!)` non-null assertion na opcjonalnym polu: Stocks.tsx:103 (typ `:19`)
- nieuzywany import `useCallback`: linia 1 kazdego z trzech plikow

Werdykt: **accidental** — trzy kopie tego samego komponentu z innym zrodlem danych.

## D2. Preambula Google tasks/calendar routes + rozjazd error-shape

~100+ zduplikowanych linii, najgorszy backendowy wzorzec.

- Powtarzana ~15-liniowa preambula (`getTodoLists(uid)` → `find` list → check `google_tasklist_id` → `getOAuth2ClientForUser(uid)` → null check → `google.tasks({version:'v1', auth})` → try/catch): server.ts:820-825 (POST), :845-850 (PATCH), :871-876 (move), :893-898 (DELETE); soft-wariant :788-794 (GET).
- `google.tasks(...)` konstruowane 7x: server.ts:749, :775, :797, :828, :853, :879, :901.
- Identyczne catch-bloki 4x: server.ts:834-837, :863-866, :886-889, :904-907.
- Rozjazd error-shape: calendar + tasks zwracaja `res.json({error})` z HTTP **200** (server.ts:680, :731, :791, :794, :811), reszta routes uzywa status 500/502. Frontend musi sniffowac: Calendar.tsx:53-62 (`msg.includes('ustawien')` — kruche).
- Calendar bonus: `calendarList.list()` + mapowanie `backgroundColor || '#4285f4'` zduplikowane: server.ts:633-658 vs :674-733 (mapowanie ~:693-697 vs :644-649).

Werdykt: **accidental** — czysty copy-paste per route.

## D3. Silent-failure mutations + brak .catch (~15 realnych defektow frontendu)

Narusza wlasna regule projektu ("Error Handling — nigdy nie polykaj bledow").

- Silent mutation handlers (`console.error` + return, user nie widzi nic): Weather.tsx:100-110 (addCity), :112-121 (removeCity); RSS.tsx:70-84 (addFeed), :86-90 (removeFeed); TodoList.tsx:102-120 (toggle), :122-132 (delete); App.tsx:85-94 (addRssWidget), :96-105 (addTodoList), :107-111 (deleteTodoList); useWidgetPrefs.ts:40 (enable), :57 (disable).
- Brak `.catch` w ogole (unhandled rejection, loading wisi): Crypto.tsx:32-37, Currencies.tsx:32-37, Stocks.tsx:35-40; RSS.tsx:63 (malformed JSON → wieczny loading).
- Trzy rozne strategie bledow bez powodu: error-state (Weather.tsx:77-85, Calendar.tsx:50-88), console-only (TodoList.tsx:59-78, useLayout.ts:57-87), brak (trio).
- Brak AbortController w calym frontendzie (race przy tick refetch): Calendar.tsx:50-88, useChartData.ts:9-37, Weather.tsx i in.

Werdykt: **accidental** — wspolny anty-wzorzec copy-paste.

## D4. User-list CRUD route triples x4 domeny (backend)

- Identyczny ksztalt GET/POST(walidacja→400)/DELETE: server.ts:202-218 (cities), :398-411 (cryptos), :475-487 (currencies), :520-535 (stocks) — ~70 ln.
- Lustrzane triple prepared statements w db.ts: :204-209 (cryptos), :211-216 (currencies), :218-223 (stocks), :225-230 (cities) + wrappery :387-432 (ten sam `INSERT OR IGNORE + COALESCE(MAX(sort_order),0)+1`).
- Gratisowa niespojnosc API: cities DELETE bierze lat/lon w **body** (server.ts:213-218) vs URL param u reszty (klucz zlozony — wymuszone czesciowo, ale ksztalt API niespojny).

Werdykt: routes **accidental** (4 powtorzenia — przekracza prog "abstrakcja przy 3+"); statements db.ts **borderline legit** (idiomatyczne better-sqlite3, generyk walczylby z typowaniem — zostawic).

## D5. Martwe endpointy /api/btc*

- `/api/btc` (server.ts:271-293) = hardcoded kopia `/api/crypto/:symbol` (:433-454); delta tylko `highestBid`/`lowestAsk` (:284-285).
- `/api/btc/history` (:337-351) vs `/api/crypto/:symbol/history` (:457-472) — blok klines→ChartPoint bajt-w-bajt identyczny (:344-349 vs :465-470).
- **Zweryfikowane grep-em przez orchestratora: frontend NIE wola `/api/btc*` nigdzie** (Crypto.tsx uzywa `/api/crypto/...` :45,:59,:65). Routes martwe → DELETE bez migracji.

## D6. Duplikat ConfirmDialog usuwania todo-listy

- TodoList.tsx:351-365 vs AppSidebar.tsx:247-259 — identyczny tytul "Usuń listę zadań", identyczny template opisu, identyczny confirmLabel; oba podpiete do tego samego App.tsx:107-111 (przekazane w App.tsx:147 i :189).

Werdykt: **accidental** — polska kopia rozjedzie sie przy pierwszej edycji. Hoist do App.tsx (stan `deleteListTarget`).

## D7. Blizniacze dialogi "dodaj z nazwa" w App.tsx

- RSS dialog App.tsx:211-238 vs Todo dialog :239-266 — strukturalnie identyczne (Dialog + Input + Enter-submit + Anuluj/Dodaj), roznia sie tylko stringami i handlerem.

Werdykt: **accidental**. Jeden `NameDialog` uzyty 2x.

## D8. Recznie sklecone debounce z wyciekiem, dwa timery, dwa opoznienia

- Weather.tsx:87-98 (400ms, ref :64, **brak cleanup na unmount** — late setState); Stocks.tsx:66-77 (300ms, ref :33, tez bez cleanup).

Werdykt: **accidental** (brak powodu dla 400 vs 300). `useDebouncedCallback(fn, ms)` z cleanup naprawia tez wyciek.

## D9. Duplikat generateAuthUrl (auth)

- auth.ts:78-84 (`/auth/google`) vs :189-195 (`/auth/calendar-connect`) — identyczne `createOAuth2Client` + `generateAuthUrl({access_type:'offline', prompt:'consent', scope:SCOPES})` + redirect.
- Uwaga: duplikacja maskuje latentne pytanie projektowe — calendar-connect chyba powinien prosic tylko o scope calendar.

## D10. Index-as-React-key (7 miejsc, 3 features)

- Calendar.tsx:106 (dni), :109 (allDay), :131 (timed); RSS.tsx:104-105 (artykuly); Weather.tsx:236 (hourly), :260 (daily), :312 (wyniki wyszukiwania).
- Stabilne id istnieja (event `ev.id`, article `link`, timestamp prognozy). Fix in place, zero abstrakcji.

## D11. Drobnica (do zrobienia przy okazji)

- available-lists endpointy: server.ts:414-430 vs :490-502 — ten sam `cached(key, THIRTY_MIN, ...)` + catch→502; mini-helper wzorem istniejacego `cachedHistoryHandler` (:140-152).
- `buildDefaultLayout`+`deriveBreakpointDefaults` para x3: useLayout.ts:50-51, :58-59, :108-111.
- Avatar-or-initials render x3 (przekracza prog DRY): DashboardHeader.tsx:149-169, AppSidebar.tsx:449-460, AccountPage.tsx:132-143.
- Podwojny 30-min cache historii: server.ts:72-89,:91,:140-152 vs useChartData.ts:12-31 + config.ts:10 — TTL sie sumuja (do ~60 min staleness). Legit warstwowo, ale skrocic frontendowy TTL lub skomentowac sprzezenie.
- Sesja: auth.ts:50-66 (requireAuth) vs :142-155 (/auth/me) — ta sama sciezka lookup+cleanup, inny terminal; wartosc marginalna, borderline legit.

---

## Legitymna specjalizacja (NIE konsolidowac)

- **Quote.tsx lokalny fallback** (:19-28) — celowa offline-odpornosc; nie wciskac we wspolny hook.
- **RSS per-feed try/catch → []** (RSS.tsx:41-68) — tolerancja czesciowej awarii wielu feedow, zamierzona.
- **user_cities klucz zlozony lat/lon** (db.ts:99,:230; server.ts:213-218) — domena naprawde inna niz single-symbol; gratisowa jest tylko niespojnosc body-vs-param.
- **TodoList optimistic updates + rollback** (TodoList.tsx:102-159) — jedyny widget z wolnymi mutacjami zewnetrznymi (Google Tasks); reszta slusznie pesymistyczna.
- **verifyWidgetOwner tylko w RSS** (db.ts:461-478) — jedyna domena nested-resource.
- **SSRF guard tylko na RSS proxy** (server.ts:603-630) — jedyny endpoint fetchujacy user-supplied URL.
- **db.ts per-domain prepared statements** (:204-268) — idiomatyczne better-sqlite3; generyk kosztowalby strict typing za ~40 ln.
- **GET tasks soft-error wariant** (server.ts:788-794) — celowo miekki (widget pokazuje pusta liste zamiast crashowac); zostawic osobno od helpera 4xx.
- **`mergeWithDefaults` (useLayout.ts:28-37) vs `restoreWidgetLayout` (:116-131)** — wygladaja podobnie, semantyka rozna (constraint-preserving vs position-restoring); scalenie byloby zlym abstraktem.
- **`/api/currencies` (:296-323) vs `/api/currency/:code` (:505-517)** — table-scan vs single-rate NBP, legit.

## Poprawka do leadow Phase 1

- Index key w Calendar: timed-event key to `key={j}` w Calendar.tsx:131 (nie :116 — tam zaczyna sie map).
- Lead "buildDefaultLayout vs mergeWithDefaults" NIE trzyma sie — to rozne semantyki (patrz wyzej).
