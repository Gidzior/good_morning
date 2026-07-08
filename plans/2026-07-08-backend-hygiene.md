# Plan: Backend hygiene — resolveTasklist + spojne kody bledow + registerUserListCrud

Data: 2026-07-08. Zrodlo: PATHFINDER-2026-07-08/04-handoff-prompts.md (P3) + discovery na aktualnym main (91645c0, po merge P1/P2).
Branch roboczy: `refactor/backend-hygiene`. Przed KAZDYM commitem: `npm run lint && npm run build` (root) musza wyjsc 0.

## Phase 0: Ustalenia discovery (FAKTY, zweryfikowane na main 91645c0)

**Numery linii z audytu byly stale — ponizej AKTUALNE pozycje (zweryfikowane przez subagenty grepem/odczytem):**

Helpery istniejace w `src/server.ts` (wzorce do kopiowania):
- `userId(req)` :14-16 (`return req.user!.user_id;`)
- `errMsg(e)` :18-21
- `cached(key, ttl, fetcher)` — cache helper uzywany wszedzie
- `cachedHistoryHandler` :139-152 — WZORZEC dla cachedListHandler:
  ```typescript
  async function cachedHistoryHandler(res: express.Response, cacheKey: string, fetcher: () => Promise<ChartPoint[]>): Promise<void> {
    try {
      const points = await cached(cacheKey, THIRTY_MIN, fetcher);
      res.json(points);
    } catch (e: unknown) {
      console.error(`History error [${cacheKey}]:`, errMsg(e));
      res.status(502).json({ error: 'History data unavailable' });
    }
  }
  ```
  uzywany 3x: :304 (nbp), :332 (stock), :418 (crypto)
- `app.use('/api', apiLimiter, requireAuth)` :161 — wszystkie /api za auth
- `getOAuth2ClientForUser(userId)` w src/auth.ts:217-243 — zwraca `null` gdy brak tokenow (NIE rzuca); auto-refresh przez `oauth2Client.on('tokens', ...)`

HTTP 200 + `{error}` (5 miejsc):
- `/api/calendar` :638 — brak oauth → `res.json({ error: 'Kalendarz nie polaczony...' })` → ma byc **401**
- `/api/calendar` :689 — catch → `res.json({ error: \`Blad kalendarza: ${msg}\` })` → ma byc **502**
- GET `/api/todo-lists/:id/tasks` :749 (brak google_tasklist_id), :752 (brak oauth), :769 (insufficient scopes catch) — wszystkie `{items:[], error}` @200 — **ZOSTAJA** (soft-wariant celowy, widget nie crashuje; TodoList.tsx :66-67 na tym polega → zero zmian w TodoList)

Task routes (`src/server.ts`):
- GET :745-773 (soft — NIE RUSZAC logiki odpowiedzi), POST :775-796, PATCH :798-825, POST .../move :827-848, DELETE :850-866
- 4 mutacje maja identyczna preambule: lookup listy + `getOAuth2ClientForUser` + `if (!oauth2Client) return res.status(401)` + `google.tasks({version:'v1', auth})`; identyczne catche z `errMsg` + `res.status(500)`

CRUD triples (GET/POST/DELETE):
- cities :202-218 (**DELETE czyta lat/lon z req.body — ZOSTAJE**, composite key)
- cryptos :357-369 (DELETE /:symbol), currencies :433-445 (DELETE /:code), stocks :478-493 (DELETE /:symbol)
- db.ts funkcje (BEZ ZMIAN): getUserCities/addUserCity/deleteUserCity :225-230, cryptos :204-209, currencies :211-216, stocks :218-223

available-lists (kandydaci na cachedListHandler):
- `/api/cryptos/available` :372-388 (cache 'binance-usdt-pairs')
- `/api/currencies/available` :448-460 (cache 'nbp-currencies')

calendarList duplikat:
- `/api/calendars` :590-616 — inline `.map(c => ({id, summary, primary, backgroundColor: c.backgroundColor || '#4285f4'}))`, `cal.calendarList.list()` :601
- `/api/calendar` :631-691 — colorMap `Map` :652-655, `list()` :651, fallback `'#4285f4'`

Frontend (skoordynowane zmiany):
- `frontend/src/components/Calendar.tsx` :50-62 — plain fetch, sniff `msg.includes('ustawien')` z body @200 → setNoKey; **MUSI przejsc na rozroznienie po statusie** (401 → setNoKey → "Zaloguj się do kalendarza Google" :98; inne bledy → setError → ErrorMsg :101)
- `frontend/src/lib/api.ts` — apiFetch<T> z P2 rzuca `Error` z trescia `{error}`; NIE niesie statusu — trzeba dodac `ApiError extends Error { status }` (patrz Phase 2)
- `frontend/src/components/TodoList.tsx` :59-78 loadTasks — czyta `{items, error}` z 200; soft-wariant zostaje → **BEZ ZMIAN**. Mutacje :87-159 loguja na !r.ok — poza zakresem.
- `frontend/src/components/AccountPage.tsx` :42-62 fetchCalendars — plain fetch `/api/calendars`, catch → console only. Implementer MUSI zweryfikowac co `/api/calendars` robi dzis przy braku oauth (discovery nie wykazal 200+{error} — prawdopodobnie juz zwraca status lub crashuje na null). Jesli zmiana na 401: AccountPage rzuca na !ok → console → pusta lista = zachowanie jak dzis, akceptowalne.

**Poza zakresem (NIE RUSZAC):**
- db.ts — zero zmian (per-domain prepared statements = idiom better-sqlite3)
- Ksztalt happy-path odpowiedzi — tylko kody bledow
- Cities DELETE body-vs-param — zostaje
- TodoList.tsx (GET soft zostaje), mutacje TodoList
- App.tsx loadery (/api/rss-widgets, /api/todo-lists — DB-backed, nietkniete)

## Phase 1: Task routes — resolveTasklist + taskError + kody 400/401/502

**1a. Helper `resolveTasklist` w src/server.ts (przy pozostalych helperach):**
```typescript
type ResolvedTasklist = { tasks: tasks_v1.Tasks; tasklistId: string };

// Wspolna preambula mutacji Google Tasks: lookup listy, oauth, klient.
// Pisze 4xx do res i zwraca null gdy brak listy/tokenow.
async function resolveTasklist(req: express.Request, res: express.Response): Promise<ResolvedTasklist | null> {
  const list = getTodoList(req.params.id, userId(req));   // dokladna nazwa fn — zweryfikowac w db.ts
  if (!list || !list.google_tasklist_id) {
    res.status(400).json({ error: 'Lista nie istnieje lub nie jest polaczona z Google Tasks' });
    return null;
  }
  const oauth2Client = getOAuth2ClientForUser(userId(req));
  if (!oauth2Client) {
    res.status(401).json({ error: 'Polacz konto Google w ustawieniach.' });
    return null;
  }
  return { tasks: google.tasks({ version: 'v1', auth: oauth2Client }), tasklistId: list.google_tasklist_id };
}

function taskError(res: express.Response, label: string, e: unknown): void {
  console.error(`${label}:`, errMsg(e));
  res.status(502).json({ error: `Blad Google Tasks: ${errMsg(e)}` });
}
```
Implementer KOPIUJE dokladne nazwy/typy z istniejacych route'ow (:775-866) — typ `tasks_v1` jest juz importowany albo dostepny przez `google.tasks` return type (`ReturnType<typeof google.tasks>` jesli import typu klopotliwy — wybrac to co juz w pliku).

**1b. Przepisz 4 mutacje (POST :775-796, PATCH :798-825, MOVE :827-848, DELETE :850-866):**
- preambula → `const ctx = await resolveTasklist(req, res); if (!ctx) return;`
- catch → `taskError(res, 'Task create/update/move/delete error', e)`
- happy-path body odpowiedzi BEZ ZMIAN

**1c. GET :745-773 — NIE zmieniac odpowiedzi soft (200 + items:[] + error).** Wolno wewnetrznie uzyc wspolnych nazw jesli zero zmiany zachowania; w razie watpliwosci zostawic jak jest.

**Weryfikacja Phase 1:**
- `rg "google.tasks\(" src/server.ts` → 1 trafienie w resolveTasklist + ewentualnie 1 w GET (soft)
- `rg "status\(500\)" src/server.ts` → zero w task routes
- lint + build exit 0 (root)
- Kontrola: happy-path response body identyczny (diff review)

**Anti-pattern guards:** NIE zmieniac GET soft-wariantu; NIE dotykac db.ts; zero `any`.

## Phase 2: Calendar — fetchCalendarList + kody 401/502 + skoordynowany Calendar.tsx

**2a. Helper `fetchCalendarList(auth)` w src/server.ts:**
```typescript
type CalendarInfo = { id: string; summary: string; primary: boolean; backgroundColor: string };

async function fetchCalendarList(auth: OAuth2Client /* typ jak w istniejacym kodzie */): Promise<CalendarInfo[]> {
  const cal = google.calendar({ version: 'v3', auth });
  const response = await cal.calendarList.list();
  return (response.data.items || []).map(c => ({
    id: c.id || '',
    summary: c.summary || '',
    primary: c.primary || false,
    backgroundColor: c.backgroundColor || '#4285f4',
  }));
}
```
Dokladny ksztalt pol SKOPIOWAC z /api/calendars :590-616 (happy-path bez zmian!). Uzyc w:
- `/api/calendars` :590-616 — zwraca liste jak dotad
- `/api/calendar` :631-691 — buduje colorMap z wyniku (`new Map(list.map(c => [c.id, c.backgroundColor]))`), reszta bez zmian

**2b. Kody bledow /api/calendar:**
- :638 brak oauth → `res.status(401).json({ error: 'Kalendarz nie polaczony' })`
- :689 catch → `res.status(502).json({ error: \`Blad kalendarza: ${msg}\` })`
- Zweryfikowac /api/calendars przy braku oauth — ustawic to samo 401 (spojnie)

**2c. Frontend `frontend/src/lib/api.ts` — dodaj ApiError (rozszerzenie P2, minimalne):**
```typescript
export class ApiError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = 'ApiError';
  }
}
```
`apiFetch` rzuca `new ApiError(detail || \`HTTP ${res.status}\`, res.status)` zamiast `Error` (Error pozostaje nadklasa — istniejace catche `err instanceof Error` dzialaja bez zmian).

**2d. `frontend/src/components/Calendar.tsx` :50-62 — migracja na apiFetch + status:**
- usun sniff `msg.includes('ustawien')`
- `apiFetch<{ items: CalendarEvent[] }>('/api/calendar...')` w try/catch (lub .catch)
- catch: `if (err instanceof ApiError && err.status === 401) setNoKey(true); else setError(...)`
- happy-path (setEvents itd.) bez zmian; setLoading(false) w finally/obu galeziach

**Weryfikacja Phase 2:**
- `rg "ustawien" frontend/src/components/Calendar.tsx` → 0
- `rg "calendarList.list" src/server.ts` → 1 (tylko w fetchCalendarList)
- lint + build exit 0
- Test manualny (Chrome, claude-in-chrome, NIE preview_*): kalendarz renderuje eventy po zalogowaniu; network tab: /api/calendar → 200 happy-path

**Anti-pattern guards:** happy-path ksztalt bez zmian; NIE dodawac globalnego error-handlingu; ApiError to jedyna zmiana w api.ts.

## Phase 3: registerUserListCrud + cachedListHandler

**3a. `registerUserListCrud` w src/server.ts — cienki wrapper rejestracji (KISS, bez generycznego SQL):**
```typescript
function registerUserListCrud(opts: {
  path: string;                                             // np. '/api/cryptos'
  list: (uid: string) => unknown;
  add: (uid: string, body: Record<string, unknown>) => { error: string } | null;  // walidacja + insert; null = OK
  removeRoute: string;                                      // np. '/api/cryptos/:symbol' LUB path (cities: body)
  remove: (uid: string, req: express.Request) => void;
}): void
```
Rejestruje GET(path) / POST(path) / DELETE(removeRoute). Handlery-domenowe (walidacja pol, wywolania db.ts) zostaja per-domena jako male closury przy wywolaniu — implementer PRZENOSI istniejaca logike walidacji 1:1 (kody 400 przy zlych polach, ksztalt odpowiedzi identyczny). Cities: removeRoute = path, remove czyta req.body (lat/lon) — zostaje.
Zastosowac do 4 domen: cities :202-218, cryptos :357-369, currencies :433-445, stocks :478-493.
Jesli podczas implementacji factory wychodzi BARDZIEJ zlozony niz suma 4 triple'ow (np. przez rozjazd ksztaltow add/remove) — STOP, zglosic orchestratorowi, dopuszczalne ograniczenie do 3 domen (bez cities) albo rezygnacja. KISS > wymuszony DRY.

**3b. `cachedListHandler` — SKOPIUJ wzorzec cachedHistoryHandler :139-152:**
```typescript
async function cachedListHandler<T>(res: express.Response, cacheKey: string, ttl: number, fetcher: () => Promise<T>): Promise<void> {
  try {
    res.json(await cached(cacheKey, ttl, fetcher));
  } catch (e: unknown) {
    console.error(`List error [${cacheKey}]:`, errMsg(e));
    res.status(502).json({ error: 'List data unavailable' });
  }
}
```
Uwaga na sygnature `cached` — dopasowac do istniejacej (moze wymagac castow generic — zweryfikowac jak cached jest typowany). Zastosowac do `/api/cryptos/available` :372-388 i `/api/currencies/available` :448-460. Komunikat bledu w {error} zachowac per-endpoint jesli dzisiejsze sa rozne (sprawdzic przed zmiana).

**Weryfikacja Phase 3:**
- Odpowiedzi happy-path identyczne: GET listy, POST add (w tym walidacja 400), DELETE — porownac ksztalty z git diff
- lint + build exit 0
- Test manualny (Chrome): dodaj/usun krypto + walute + akcje + miasto w widgetach — dziala jak przed zmiana

**Anti-pattern guards:** db.ts BEZ ZMIAN; NIE generyczny SQL po nazwach tabel; NIE registry/metaprogramowanie — jedna funkcja + 4 wywolania z jawna logika.

## Phase 4: Weryfikacja koncowa + review + PR

1. `npm run lint && npm run build` z roota — exit 0 (rtk moze falszywie zglosic JSON parse error — decyduje exit code).
2. Grepy anty-wzorcow: `rg "\bany\b" src/server.ts` (nowe uzycia), `rg "@ts-ignore" src frontend/src`, `git diff main...HEAD -- src/db.ts` → pusty.
3. Test manualny w Chrome (claude-in-chrome, NIE preview_*):
   - Kalendarz: zalogowany z Google → eventy renderuja sie; network: /api/calendar 200
   - Todos: lista laduje sie, add/toggle/delete dziala; network: mutacje 200
   - Stan bledu: (o ile wykonalne bez psucia sesji) — minimum: sprawdzic w network tab ze nie ma odpowiedzi 200 z {error} dla calendar
   - Tickery + pogoda: add/remove pozycji dziala (regresja CRUD factory)
4. Code review: agent `code-reviewer` na diffie main...HEAD.
5. PR (`gh pr create`) + CI babysit do zielonego + `gh pr merge --squash` (token ma teraz Contents: write).
