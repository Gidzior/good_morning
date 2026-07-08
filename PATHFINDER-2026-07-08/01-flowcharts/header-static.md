# Flowchart: header-static

Pathfinder Phase 1 — 2026-07-08

## Sources consulted (exact paths + line ranges read)

1. **src/server.ts** — lines 170-199: `/api/quote` route with quotable.io fetch and fallback error handling
2. **frontend/src/components/Quote.tsx** — lines 1-40: Full component, FALLBACK_QUOTES array (lines 6-14), useEffect with tick dependency (lines 19-28)
3. **frontend/src/components/Nameday.tsx** — lines 1-376: NAMEDAYS constant (lines 2-369), getTodayNameday function (lines 371-375)
4. **frontend/src/lib/holidays.ts** — lines 1-378: WORLD_HOLIDAYS constant (lines 6-364), getTodayHolidays function (lines 373-377), getTodayHoliday function (lines 366-371)
5. **frontend/src/components/DashboardHeader.tsx** — lines 1-170: Full component, greeting/nameday/holidays logic (lines 30-34), display badges (lines 53-72)
6. **frontend/src/components/AppSidebar.tsx** — lines 1-494: Full component, countdown display (line 210), lastUpdate display (line 227), refresh button (line 209-213)
7. **frontend/src/hooks/useRefresh.ts** — lines 1-30: Full hook, interval management (lines 15-27), tick increment (line 12), countdown calculation (lines 22-24)
8. **frontend/src/utils.ts** — lines 1-57: getGreeting (lines 42-48), getFirstName (lines 50-52), getInitials (lines 54-57), formatDate (lines 5-8), formatTime (lines 1-3)

## Findings

### Happy Path Traces

**1. Quote Widget (GET /api/quote)**
- Server fetch → quotable.io API → parse JSON (text, author)
- Fallback: On 502 error or network fail → pick from FALLBACK_QUOTES using `new Date().getDate() % FALLBACK_QUOTES.length`
- Quote.tsx respects `tick` prop to refetch on interval (line 28)

**2. Header Display (getGreeting + getTodayNameday + getTodayHolidays)**
- **Greeting:** getGreeting() inspects hour (h < 5 → "Dobranoc", h < 12 → "Dzień dobry", h < 17 → "Dzień dobry", else → "Dobry wieczór")
- **Nameday:** getTodayNameday() constructs key `${date}-${month}` from NAMEDAYS constant
- **Holidays:** getTodayHolidays() constructs key `${padded-month}-${padded-date}` from WORLD_HOLIDAYS, returns array
- **Rotation:** When multiple holidays exist, line 34 DashboardHeader.tsx rotates: `holidays[tick % holidays.length]`
- Badges render conditionally (nameday: cake icon + names, holiday: gift icon + name)

**3. Refresh Cycle (useRefresh tick → widget refetch)**
- useRefresh(60000) initializes tick=0, lastUpdate=now
- Interval checks every 60s if time elapsed since nextRef
- On trigger: setLastUpdate(new Date()), setTick(t ⇒ t + 1)
- Countdown shown in sidebar: "Xh Ymin" format (padded to 60s intervals)
- `tick` prop flows to Quote, DashboardHeader, implied to other widgets
- AppSidebar displays countdown (line 210) and lastUpdate (line 227)

### External Dependencies

- **quotable.io API** (GET https://api.quotable.io/quotes/random?limit=1): Single external call
- **Date/Time APIs:** Only local JS Date objects, no external time service
- **Tick prop:** Consumed by Quote (line 28), DashboardHeader (line 34), flows from useRefresh hook

### Side Effects

- **Network:** quotable.io fetch in Quote.useEffect (lines 20-27)
- **DOM:** Interval registration in useRefresh (lines 16-26), cleanup on unmount
- **State mutations:** setQuote, setLastUpdate, setCountdown, setTick all local to component/hook

---

## Mermaid diagram

```mermaid
flowchart TD
    A["<b>App init</b><br/>App.tsx"] -->|useRefresh 60s| B["<b>useRefresh hook</b><br/>useRefresh.ts:1-30"]
    B -->|state| C["lastUpdate: Date<br/>countdown: string<br/>tick: number"]
    B -->|setInterval 60s| D["<b>Check elapsed</b><br/>useRefresh.ts:16-26"]
    D -->|diff ≤ 0| E["<b>Trigger refresh</b><br/>useRefresh.ts:9-13"]
    E -->|setLastUpdate, setTick++| C
    E -->|tick+1| F["tick passed to widgets"]
    
    F -->|tick prop| G["<b>Quote widget</b><br/>Quote.tsx:16"]
    G -->|useEffect tick dependency| H["<b>Fetch quote</b><br/>Quote.tsx:19-28"]
    H -->|GET /api/quote| I["<b>Server route</b><br/>server.ts:185-199"]
    I -->|fetch quotable.io| J["<b>quotable.io API</b><br/>api.quotable.io/quotes/random"]
    J -->|success| K["<b>Parse response</b><br/>server.ts:189-191"]
    K -->|{text, author}| L["<b>Return to client</b><br/>Quote.tsx:21-22"]
    L -->|setQuote| M["<b>Render quote</b><br/>Quote.tsx:31-39"]
    
    J -->|network error| N["<b>Fallback logic</b><br/>Quote.tsx:23-27"]
    I -->|HTTP 502| N
    N -->|FALLBACK_QUOTES<br/>index = date % length| O["<b>Polish fallback</b><br/>Quote.tsx:6-14"]
    O -->|setQuote fallback| M
    
    F -->|tick prop, now| P["<b>DashboardHeader</b><br/>DashboardHeader.tsx:14"]
    P -->|getGreeting| Q["<b>Get greeting</b><br/>utils.ts:42-48"]
    Q -->|hour inspect| R["Greeting text<br/>5h:Dobranoc, 12h:Dzień dobry,<br/>17h:Dzień dobry, else:Dobry wieczór"]
    
    P -->|getTodayNameday| S["<b>Get nameday</b><br/>Nameday.tsx:371-375"]
    S -->|key = d-M| T["NAMEDAYS constant<br/>Nameday.tsx:2-369"]
    T -->|return names or null| U["<b>Render nameday badge</b><br/>DashboardHeader.tsx:53-61"]
    
    P -->|getTodayHolidays, tick| V["<b>Get holidays array</b><br/>holidays.ts:373-377"]
    V -->|key = MM-DD| W["WORLD_HOLIDAYS constant<br/>holidays.ts:6-364"]
    W -->|return array or []| X["<b>Rotate holiday display</b><br/>DashboardHeader.tsx:34"]
    X -->|tick % holidays.length| Y["<b>Render holiday badge</b><br/>DashboardHeader.tsx:63-72"]
    
    C -->|lastUpdate| Z["<b>AppSidebar</b><br/>AppSidebar.tsx:75-91"]
    Z -->|countdown, lastUpdate| AA["<b>Render sidebar</b><br/>AppSidebar.tsx:191-230"]
    AA -->|countdown Xh Ymin| AB["Footer countdown display<br/>AppSidebar.tsx:210"]
    AA -->|lastUpdate time| AC["Footer timestamp<br/>AppSidebar.tsx:227"]
    
    E -->|manual call| AD["<b>onRefresh button</b><br/>AppSidebar.tsx:209-213"]
    AD -->|trigger refresh| E
    
    style A fill:#e1f5ff
    style B fill:#fff3e0
    style E fill:#fff3e0
    style I fill:#f3e5f5
    style J fill:#fce4ec
    style P fill:#e8f5e9
    style Z fill:#e8f5e9
    style M fill:#c8e6c9
    style U fill:#c8e6c9
    style Y fill:#c8e6c9
```

## External dependencies

- **quotable.io** (https://api.quotable.io/quotes/random?limit=1): Single network call per refresh cycle in Quote component
- **Browser Date object:** Only local client-side time, no external time service
- **Tick prop:** Published from useRefresh hook to Quote, DashboardHeader, and inherited by widgets in the dashboard

## Observations (bugs/dead code, file:line)

**DEAD CODE - Search Button:**
- **Location:** `frontend/src/components/DashboardHeader.tsx:78-84`
- **Issue:** SearchIcon button has no `onClick` handler, only aria-label and styling
- **Impact:** Button is visually present but non-functional; clicking does nothing
- **Severity:** UX bug — suggests unfinished feature

**STALE INTERVAL - useRefresh countdown:**
- **Location:** `frontend/src/hooks/useRefresh.ts:16-26`
- **Issue:** `setCountdown` updates fire every 60 seconds (setInterval 60000), but the countdown string is calculated fresh each cycle without continuous decrement. This means:
  - Countdown jumps in 60-second increments rather than smooth countdown
  - Initial load shows "Xh Ymin" but then stays static until next 60s tick
- **Severity:** Minor UX quirk — countdown appears frozen between updates; user expects live countdown

**UNCONFIRMED NAMEDAY EDGE CASE:**
- **Location:** `frontend/src/components/Nameday.tsx:371-375`
- **Issue:** For dates outside the NAMEDAYS constant (e.g., Feb 29 leap year), returns null cleanly, but the key construction `${date}-${month+1}` assumes 1-indexed months (line 373: `getMonth() + 1`)
- **Verification needed:** Confirm Feb 29 entry exists in NAMEDAYS ('29-2' vs '2-29')
- **Current:** Line 62 in NAMEDAYS shows '29-2' (Feb 29), so this is correct

**ROTATION SIDE EFFECT:**
- **Location:** `frontend/src/components/DashboardHeader.tsx:34`
- **Issue:** Holiday rotation on `tick % holidays.length` means every 60s interval changes the displayed holiday. If there are 5 holidays, user sees all 5 in rotation every ~5 minutes. Design may be intentional but is non-obvious from code alone.
- **Severity:** Minor — documented behavior, likely intentional for visual variety

## Confidence + gaps

**High confidence (>90%):**
- Quote fetch → fallback pipeline and rendering
- Greeting logic based on hour
- Nameday lookup from NAMEDAYS constant
- Holiday lookup and rotation mechanism
- useRefresh tick publishing and countdown calculation
- AppSidebar display of lastUpdate and countdown

**Medium confidence (70-85%):**
- Holiday rotation user-facing behavior (intentional design or side effect?)
- Countdown granularity (60s jumps vs. continuous; appears to be by design)

**Low confidence / gaps:**
- Whether quotable.io is subject to rate limiting or CORS issues (not validated in error handling)
- Whether FALLBACK_QUOTES Polish spelling/grammar is canonical (spot-checked 2-3 entries, appear correct)
- Integration with other widgets beyond Quote — getDashboardData, weather widget refresh pattern (out of scope for F8 header-static)
- Account menu behavior (onAccount handler origin unclear; wired but parent not traced)
- Settings icon in header (line 85-92, wired to onAccount, parent component not verified)
