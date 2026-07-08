# 04 — Handoff Prompts (do /make-plan)

Data: 2026-07-08. Kazdy blok ponizej to gotowy prompt do skopiowania w `/make-plan`. Kolejnosc = rekomendowany priorytet z `03-unified-proposal.md`.

---

## P1: TickerWidget — konsolidacja trio Crypto/Currencies/Stocks + dead code (U1 + U0) — REKOMENDOWANY START

```
Skonsoliduj trzy niemal identyczne komponenty ticker-widgetow w jeden generyczny TickerWidget i usun potwierdzony dead code.

TARGET: nowy frontend/src/components/TickerWidget.tsx z entry pointem <TickerWidget config={TickerConfig} tick={tick} />. Config to prosty obiekt (title, icon, keyField 'symbol'|'code', listUrl, priceUrl(key), historyUrl(key,days), fmt(v), picker: {kind:'available',url} | {kind:'search',url(q)}, gradientId). ZADNEGO registry/factory — trzy stale configi.

CALL SITES do przepisania (dowody: PATHFINDER-2026-07-08/02-duplication-report.md D1, flowchart: PATHFINDER-2026-07-08/01-flowcharts/market-tickers.md):
- frontend/src/components/Crypto.tsx (188 ln) — delty: isBig fmt :89,:141-142
- frontend/src/components/Currencies.tsx (185 ln) — delta: 4 miejsca dziesietne
- frontend/src/components/Stocks.tsx (200 ln) — delty: debounced search :66-77 (uzyj nowego hooka useDebouncedCallback z cleanup na unmount, delay 300ms), klucz 'symbol', fmtPLN(s.price!) non-null assertion :103 do naprawienia (price opcjonalny w typie :19)
- Rownolegle bloki wszystkich trzech: state :22-30/:22-30/:23-33, mount fetch :32-37/:32-37/:35-40, Promise.all :39-57/:39-56/:42-61, add :69-75/:68-74/:79-86, remove :77-85/:76-84/:88-96, period buttons :112-127/:110-125/:121-137, AreaChart :129-153/:127-150/:139-162, SettingsModal :159-185/:156-182/:168-197
- Uzycia w App.tsx / DashboardGrid — podmien importy na TickerWidget z configami

BUGI DO NAPRAWIENIA PRZY OKAZJI (raz zamiast x3):
- brak .catch na mount fetch (loading wisi na zawsze): Crypto.tsx:32-37, Currencies.tsx:32-37, Stocks.tsx:35-40
- stale active closure przy remove: Crypto.tsx:81-83, Currencies.tsx:80-82, Stocks.tsx:92-94
- nieuzywany import useCallback linia 1 kazdego pliku

DEAD CODE DO USUNIECIA (zweryfikowane zero referencji):
- server.js (root, legacy port 3000), start-frontend.js (root)
- frontend/src/template/metrica-theme.css + template/README.md (AppShell.tsx ZOSTAJE — uzywany przez App.tsx)
- routes /api/btc (src/server.ts:271-293) i /api/btc/history (:337-351) — frontend wola tylko /api/crypto/* (grep-verified); /api/crypto/:symbol (:433-472) pokrywa BTC
- martwy przycisk search DashboardHeader.tsx:78-84 (brak onClick)

ANTI-PATTERN GUARDS:
- NIE tworzyc registry/factory komponentow — trzy stale configi w jednym pliku
- NIE dodawac feature flagi ani nie zostawiac starych komponentow "na wszelki wypadek" — delete
- NIE generalizowac useChartData (dziala, zostaje bez zmian)
- Strict TS, zero any, zero @ts-ignore; delty zachowania (isBig, decimals, search-vs-list) jawnie w configu — reczny test wszystkich 3 widgetow po zmianie
- Przed commitem: npm run lint && npm run build musza przejsc
```

## P2: apiFetch — jednolita obsluga bledow frontendu + stabilne React keys (U2 + U5.4)

```
Zunifikuj obsluge bledow HTTP na froncie: jeden helper apiFetch, widoczne bledy zamiast cichych porazek, stabilne React keys.

TARGET: nowy frontend/src/lib/api.ts z apiFetch<T>(url, init?): Promise<T> — rzuca Error na !res.ok (tresc z serwera gdy dostepna), parsuje JSON. Komponenty pokazuja blad istniejacym ErrorMsg / inline — BEZ nowej biblioteki toastow.

CALL SITES (dowody: PATHFINDER-2026-07-08/02-duplication-report.md D3, D10):
Silent-fail mutations (console.error + return, user nie widzi nic):
- Weather.tsx:100-110 addCity, :112-121 removeCity
- RSS.tsx:70-84 handleAddFeed, :86-90 handleRemoveFeed
- TodoList.tsx:102-120 toggleTask, :122-132 deleteTask (zachowaj optimistic update + rollback — legit)
- App.tsx:85-94 addRssWidget, :96-105 addTodoList, :107-111 deleteTodoList
- useWidgetPrefs.ts:40 enableWidget, :57 disableWidget
Brak .catch (unhandled rejection / wieczny loading):
- RSS.tsx:63 (malformed JSON → loading wisi)
- (trio Crypto/Currencies/Stocks naprawia P1 — jesli P1 juz wdrozony, pomin)
Index-as-key → stabilne klucze:
- Calendar.tsx:106 (dni → day.label), :109 (allDay → ev.id), :131 (timed → ev.id)
- RSS.tsx:104-105 (→ article.link)
- Weather.tsx:236 (hourly → timestamp), :260 (daily → timestamp), :312 (search → lat,lon)

NIE RUSZAC (legit specjalizacja):
- Quote.tsx:19-28 lokalny fallback (celowy offline)
- RSS.tsx:41-68 per-feed try/catch → [] (tolerancja czesciowej awarii)
- TodoList optimistic+rollback :102-159

ANTI-PATTERN GUARDS:
- NIE wprowadzac globalnego error-store/context — blad lokalny per widget
- NIE dodawac AbortController wszedzie (poza zakresem; tick co 15 min)
- Strict TS: apiFetch<T> z unknown + walidacja tam gdzie juz jest
- Przed commitem: npm run lint && npm run build
```

## P3: Backend hygiene — resolveTasklist + spojne kody bledow + registerUserListCrud (U3 + U4 + U5.7)

```
Uporzadkuj backend: wytnij copy-paste preambuly Google Tasks, zunifikuj kody bledow (koniec z {error} przy HTTP 200), sfaktoryzuj user-list CRUD.

TARGETY (wszystko w src/server.ts, bez nowych plikow):
1. resolveTasklist(req, res) → Promise<{tasks, tasklistId} | null> — lookup listy + getOAuth2ClientForUser + google.tasks(); pisze 4xx i zwraca null. taskError(res, label, e) — jeden catch.
2. Spojne kody bledow: {error} z HTTP 200 → 401 (brak tokenow) / 400 (brak listy) / 502 (blad Google).
3. registerUserListCrud(path, {list, add, remove}) dla 4 domen.
4. cachedListHandler wzorem cachedHistoryHandler (:140-152).
5. fetchCalendarList(auth) — wspolne mapowanie kolorow kalendarzy.

CALL SITES (dowody: PATHFINDER-2026-07-08/02-duplication-report.md D2, D4, D11; flowcharty: 01-flowcharts/todos.md, calendar.md):
- Preambuly task routes: server.ts:820-825, :845-850, :871-876, :893-898; konstrukcje google.tasks: :749,:775,:797,:828,:853,:879,:901; catche: :834-837,:863-866,:886-889,:904-907
- HTTP 200 z {error}: server.ts:680, :731, :791, :794, :811
- SKOORDYNOWANA zmiana frontendu: Calendar.tsx:53-62 — usun sniff msg.includes('ustawien'), rozroznij po statusie (401 → "Zaloguj sie do kalendarza Google")
- ZACHOWAJ soft-wariant GET /api/tasks (server.ts:788-794) — pusta lista zamiast crasha widgetu (celowe)
- CRUD triples: server.ts:202-218 (cities, remove czyta lat/lon z body), :398-411 (cryptos), :475-487 (currencies), :520-535 (stocks)
- available-lists: server.ts:414-430, :490-502
- calendarList duplikat: server.ts:633-658 vs :674-733

ANTI-PATTERN GUARDS:
- db.ts BEZ ZMIAN — per-domain prepared statements zostaja (idiom better-sqlite3)
- NIE robic generycznego SQL po nazwach tabel
- NIE zmieniac ksztaltu happy-path odpowiedzi — tylko kody bledow
- Niespojnosc cities body-vs-param ZOSTAJE (composite key)
- Przed commitem: npm run lint && npm run build; reczny test kalendarza i todos po zmianie kodow bledow
```

## P4: Drobne konsolidacje UI (U5.1, U5.2, U5.5, U5.6)

```
Male porzadki frontendu — hoisty i fix-in-place, zero nowych warstw.

ZMIANY (dowody: PATHFINDER-2026-07-08/02-duplication-report.md D6, D7, D11):
1. Duplikat ConfirmDialog usuwania todo-listy: TodoList.tsx:351-365 vs AppSidebar.tsx:247-259 (identyczna tresc, ten sam callback App.tsx:107-111 przez :147,:189) → hoist jednego dialogu do App.tsx ze stanem deleteListTarget; oba miejsca tylko ustawiaja target.
2. Blizniacze dialogi "dodaj z nazwa": App.tsx:211-238 (RSS) vs :239-266 (Todo) → jeden NameDialog({open, title, placeholder, onSubmit, onClose}) w frontend/src/components/NameDialog.tsx, uzyty 2x.
3. defaultBreakpointLayouts(ids) one-liner w useLayout.ts skladajacy buildDefaultLayout+deriveBreakpointDefaults (:50-51, :58-59, :108-111).
4. Frontend chart TTL: config.ts:10 z 30 min → 5 min + komentarz o sprzezeniu z cache backendu (server.ts:91) — likwiduje ~60-min worst-case staleness wykresow.

ANTI-PATTERN GUARDS:
- NameDialog: propsy proste, bez render-props/slots
- NIE konsolidowac Avatar x3 ani resolveSession (odlozone — wartosc marginalna)
- NIE ruszac generateAuthUrl (auth.ts:78-84 vs :189-195) — najpierw decyzja czy calendar-connect ma miec wezszy scope; dodaj TODO-komentarz
- Przed commitem: npm run lint && npm run build
```
