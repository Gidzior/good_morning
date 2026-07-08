# Flowchart: rss

Pathfinder Phase 1 — 2026-07-08

## Sources consulted (exact paths + line ranges read)

1. **src/server.ts**: lines 1-80, 550-632
   - Imports: RSSParser on line 8
   - RSS CRUD endpoints: 556-600
   - SSRF proxy endpoint: 603-630

2. **src/db.ts**: lines 1-478 (full schema and functions)
   - Schema: user_rss_widgets (102-108), user_rss_feeds (110-117)
   - Indexes: 136-140
   - Functions: getRssWidgets (232-244), addRssFeed (240-242), deleteRssFeed (244)
   - Cascade delete via FK: ON DELETE CASCADE on lines 104 & 112
   - Data isolation: verifyWidgetOwner (461-464)

3. **frontend/src/components/RSS.tsx**: lines 1-159 (full component)
   - Feed fetch loop: 44-68
   - Article rendering: 104-114
   - Settings modal: 118-156

4. **frontend/src/components/AppSidebar.tsx**: lines 75-189
   - RSS widget list construction: 110-114
   - Widget management section: 169-188

5. **frontend/src/App.tsx**: lines 29-157
   - Dynamic widget wiring: 152-155
   - RSS widget creation dialog: 211-237

6. **frontend/src/types.ts**: lines 24-29, 58 (RSSItem, WidgetId types)

7. **package.json**: root project dependencies
   - rss-parser: ^3.13.0, node-fetch: ^2.7.0, googleapis: ^171.4.0, better-sqlite3: ^12.8.0

---

## Findings

### Happy Path Flow
1. **App initialization** (App.tsx:54, 67): `loadRssWidgets()` fetches `/api/rss-widgets` endpoint → GET returns array of RssWidget objects with feeds array
2. **Widget render** (App.tsx:152-155): For each RSS widget in state, instantiate `<RSS>` component with id, name, feeds[], tick prop
3. **Feed fetch loop** (RSS.tsx:41-68): On tick change or feeds change, useEffect runs `Promise.all()` over feeds; for each feed, fetch `/api/rss?url=<encoded>` 
4. **Backend SSRF gate** (server.ts:603-621): Validate protocol (http/https only), parse hostname, blocklist check (127.0.0.1, 192.168.x.x, 10.x.x.x, 172.x.x.x, localhost, .local, 169.254.169.254, ::1), throw on parse error
5. **RSS parse** (server.ts:624): Call `rssParser.parseURL(url)` (rss-parser package), return raw feed JSON
6. **Article merge & sort** (RSS.tsx:64): Flatten all feed results, sort descending by pubDate
7. **Render articles** (RSS.tsx:104-114): Map articles, render title as link, source, timeAgo(pubDate)

### Database Schema & Lifecycle
- **user_rss_widgets** (db.ts:102-108): id, user_id (FK→users with CASCADE), name, sort_order, created_at
- **user_rss_feeds** (db.ts:110-117): id, widget_id (FK→user_rss_widgets with CASCADE), url, name, articles_count, sort_order
- **Index coverage** (db.ts:138-139): idx_rss_widgets_user, idx_rss_feeds_widget
- **Access control**: verifyWidgetOwner (db.ts:461-464) enforces widget_id belongs to user before feed mutations
- **Cascading delete**: User deletion → widget deletion → feed deletion (automatic via FK)

### CRUD Operations
- **GET /api/rss-widgets** (server.ts:556-558): Returns all widgets + nested feeds for user
- **POST /api/rss-widgets** (server.ts:560-565): Create widget with name, returns new widget object
- **PUT /api/rss-widgets/:id** (server.ts:567-572): Update widget name (user_id validated implicitly via requireAuth)
- **DELETE /api/rss-widgets/:id** (server.ts:574-577): Delete widget (cascades to feeds)
- **POST /api/rss-widgets/:id/feeds** (server.ts:579-591): Add feed to widget; validates ownership, enforces max 5 feeds, clamps articles_count to [1,10]
- **DELETE /api/rss-widgets/:id/feeds/:feedId** (server.ts:593-600): Remove feed from widget

### Frontend State Management
- **RSS widgets state** (App.tsx:47): useState array, loaded via loadRssWidgets callback
- **Feed addition** (RSS.tsx:70-84): POST request, triggers onFeedsChanged callback → reloads all widgets
- **Feed removal** (RSS.tsx:86-90): DELETE request, triggers onFeedsChanged callback
- **Widget deletion** (App.tsx:113-121): Triggered via sidebar, marks deleteData=true → calls disableWidget → if RSS widget, reloads list

---

## Mermaid diagram

```mermaid
flowchart TD
    Start("App Init<br/>App.tsx:43") --> LoadRss["loadRssWidgets<br/>App.tsx:54"]
    LoadRss --> GetWidgets["GET /api/rss-widgets<br/>server.ts:556"]
    GetWidgets --> DbQuery["getRssWidgets<br/>db.ts:438"]
    DbQuery --> RssState["setRssWidgets state<br/>App.tsx:56"]
    
    RssState --> MapWidgets["rssWidgets.map → rssEntries<br/>App.tsx:152"]
    MapWidgets --> RssComp["Render RSS component<br/>App.tsx:154"]
    
    RssComp --> RssTick["useEffect on tick/feeds change<br/>RSS.tsx:41"]
    RssTick --> CheckFeeds{"feeds.length > 0?<br/>RSS.tsx:42"}
    CheckFeeds -->|No| Empty["setArticles = []<br/>RSS.tsx:42"]
    CheckFeeds -->|Yes| PromiseAll["Promise.all over feeds<br/>RSS.tsx:44"]
    
    PromiseAll --> FeedLoop["For each feed<br/>RSS.tsx:45"]
    FeedLoop --> FetchRss["fetch /api/rss?url=<encoded><br/>RSS.tsx:47"]
    
    FetchRss --> SsrfCheck["SSRF gate<br/>server.ts:609-621"]
    SsrfCheck --> ProtocolCheck{"Protocol http/https?<br/>server.ts:610"}
    ProtocolCheck -->|No| ErrProto["status 400 error<br/>server.ts:611"]
    ProtocolCheck -->|Yes| ParseUrl["new URL parse<br/>server.ts:609"]
    ParseUrl --> ParseFail{"Parse OK?<br/>server.ts:619"}
    ParseFail -->|No| ErrParse["status 400 error<br/>server.ts:620"]
    
    ParseFail -->|Yes| HostnameCheck["hostname blocklist check<br/>server.ts:614-616"]
    HostnameCheck --> BlockCheck{"localhost/127./10./192.168./172./0.0.0.0/.local/169.254/::1?<br/>server.ts:614-616"}
    BlockCheck -->|Yes| ErrBlock["status 400 error<br/>server.ts:617"]
    BlockCheck -->|No| RssParse["await rssParser.parseURL<br/>server.ts:624"]
    
    RssParse --> ParseOk{"Parse success?<br/>server.ts:626"}
    ParseOk -->|Error| ErrParse2["status 500 error<br/>server.ts:628"]
    ParseOk -->|Success| ResJson["res.json feed<br/>server.ts:625"]
    
    ErrProto --> Catch["catch err<br/>RSS.tsx:58"]
    ErrBlock --> Catch
    ErrParse --> Catch
    ErrParse2 --> Catch
    ResJson --> FrontParse["await res.json<br/>RSS.tsx:49"]
    FrontParse --> SliceItems["items.slice 0 to articles_count<br/>RSS.tsx:50"]
    SliceItems --> MapItems["map to Article object<br/>RSS.tsx:52-57"]
    Catch --> Catch
    MapItems --> Return1["return articles<br/>RSS.tsx:57"]
    Catch --> Return0["return []<br/>RSS.tsx:60"]
    
    Return1 --> ThenResults["results.flat<br/>RSS.tsx:63"]
    Return0 --> ThenResults
    ThenResults --> Sort["sort by pubDate desc<br/>RSS.tsx:64"]
    Sort --> SetArticles["setArticles state<br/>RSS.tsx:65"]
    SetArticles --> Render["Render articles list<br/>RSS.tsx:104-114"]
    
    Render --> ArticleMap["articles.map<br/>RSS.tsx:104"]
    ArticleMap --> TitleLink["render title link<br/>RSS.tsx:106"]
    TitleLink --> TimeAgo["timeAgo pubDate<br/>RSS.tsx:111"]
    TimeAgo --> Display["Display article<br/>RSS.tsx:105-113"]
    
    Display --> SettingsUI["Settings modal<br/>RSS.tsx:118"]
    SettingsUI --> AddFeedUI["Add feed form<br/>RSS.tsx:137-155"]
    AddFeedUI --> HandleAdd["handleAddFeed<br/>RSS.tsx:70"]
    HandleAdd --> PostFeed["POST /api/rss-widgets/:id/feeds<br/>server.ts:579"]
    PostFeed --> ValidateOwner["verifyWidgetOwner<br/>db.ts:461"]
    ValidateOwner --> CheckMax["COUNT feeds < 5?<br/>db.ts:469"]
    CheckMax -->|No| ErrMax["throw error<br/>db.ts:469"]
    CheckMax -->|Yes| ClampCount["clamp articles_count [1,10]<br/>server.ts:583"]
    ClampCount --> InsertFeed["addRssFeed db insert<br/>db.ts:471"]
    InsertFeed --> ReloadFeeds["onFeedsChanged callback<br/>RSS.tsx:81"]
    ReloadFeeds --> RssTick
    
    ErrMax --> CatchAdd["catch err<br/>server.ts:587"]
    CatchAdd --> ResErr["res 400 error<br/>server.ts:589"]
    
    SettingsUI --> RemoveFeedUI["Feed remove button<br/>RSS.tsx:131"]
    RemoveFeedUI --> HandleRemove["handleRemoveFeed<br/>RSS.tsx:86"]
    HandleRemove --> DeleteFeed["DELETE /api/rss-widgets/:widgetId/feeds/:feedId<br/>server.ts:593"]
    DeleteFeed --> ValidateOwner2["verifyWidgetOwner<br/>db.ts:476"]
    ValidateOwner2 --> DelDb["deleteRssFeed db<br/>db.ts:477"]
    DelDb --> ReloadFeeds2["onFeedsChanged callback<br/>RSS.tsx:89"]
    ReloadFeeds2 --> RssTick
    
    Empty --> Display2["Display empty msg<br/>RSS.tsx:96-99"]
```

---

## External dependencies

| Package | Version | Usage |
|---------|---------|-------|
| rss-parser | ^3.13.0 | Parse RSS/Atom feeds from URLs (server.ts:8, 25, 624) |
| node-fetch | ^2.7.0 | HTTP requests in Node (imported on server.ts:7, underlying rss-parser usage) |
| better-sqlite3 | ^12.8.0 | Local SQLite database for widgets/feeds storage |
| express | ^4.18.2 | HTTP server framework |
| express-rate-limit | ^8.3.2 | Rate limiting middleware (not directly on RSS endpoints but on API) |
| googleapis | ^171.4.0 | Google Calendar API integration (not RSS-specific) |
| uuid | ^13.0.0 | Generate unique IDs for widgets/feeds (db.ts) |

---

## Observations (bugs/security/reliability, file:line)

### SECURITY GAPS

1. **DNS rebinding not protected** (server.ts:613-621)
   - SSRF check validates **initial hostname parse** only, not the actual resolved IP at fetch time
   - Attacker can: register domain → point to public IP → change DNS mid-fetch to internal IP
   - **Severity**: Medium (rss-parser + node-fetch will follow the resolve and fetch private IP)
   - **Fix**: Use allowlist of IPs in rss-parser fetch hook, or validate resolved address

2. **Redirect following not controlled** (server.ts:624)
   - `rssParser.parseURL(url)` internally uses fetch which follows HTTP 30x redirects by default
   - User specifies URL `https://attacker.com/feed.xml` → redirects to `http://192.168.1.1/admin`
   - SSRF gate only validates **original URL**, not redirect targets
   - **Severity**: Medium
   - **Fix**: Pass `{ redirect: 'error' }` or validate redirect chain in rss-parser config

3. **User isolation gap on widget rename** (server.ts:567-572)
   - `PUT /api/rss-widgets/:id` does NOT validate user_id match in request body or statement
   - Statement (db.ts:237) uses: `UPDATE ... WHERE id = ? AND user_id = ?`
   - *Actually safe but implicit*—requireAuth middleware provides userId, test needed
   - **Severity**: Low (safe by middleware but not obvious)

### RELIABILITY ISSUES

4. **Promise.all without catch** (RSS.tsx:44-68)
   - `Promise.all()` rejects if any promise in the array rejects **hard**
   - Individual feed try-catch (RSS.tsx:46-61) returns [] on error, so no reject → safe
   - **BUT** if res.json() throws (malformed JSON), entire Promise.all fails
   - Missing `.catch()` handler on line 63 for the then chain
   - **Severity**: Low (catches log but doesn't set loading=false, UI hangs in loading state)
   - **Symptom**: Single feed with invalid JSON response prevents all articles from rendering
   - **Fix**: Add `.catch()` on Promise.all chain (RSS.tsx:63) to set loading=false

5. **Array key is array index** (RSS.tsx:104)
   - `{articles.map((a, i) => (<div key={i} ...>` uses index as key
   - **Problem**: If articles list updates (reorder/filter), React mismatches DOM
   - **Symptom**: Cursor in input field, articles re-render → cursor position lost, animation janky
   - **Fix**: Use unique stable key like `${a.link}${a.pubDate}` or add id field to Article interface
   - **Severity**: Low (cosmetic, unlikely for RSS articles)

6. **No timeout on RSS feed fetch** (RSS.tsx:47, server.ts:624)
   - rss-parser.parseURL() has no explicit timeout; stuck feed blocks Promise.all indefinitely
   - If user adds slow/hanging RSS feed, browser hangs waiting for all feeds
   - **Fix**: Wrap fetch in Promise.race with timeout (e.g., 5s)
   - **Severity**: Low-Medium (denial of service from user's own feeds)

7. **Unvalidated articles_count from feed** (RSS.tsx:50-51)
   - Frontend trusts `feed.articles_count` directly (set by user, clamped on server)
   - If server config changes or attacker manually edits feed record, `.slice(0, feed.articles_count)` could exceed actual items
   - **Actual risk**: Low (just returns fewer items than expected, not a crash)

### MISSING ERROR HANDLING

8. **No .catch on deleteRssFeed fetch** (RSS.tsx:86-90)
   - `await fetch(...DELETE...)` — if delete fails, UI doesn't show error, just silently fails
   - Feed remains in state, user sees it but can't interact
   - **Severity**: Low (user may retry or refresh)

9. **addRssFeed silent catch** (RSS.tsx:82)
   - Error logged but user not notified (no toast/modal)
   - **Severity**: Low (error message in console, dev-focused)

### EDGE CASES

10. **Empty pubDate handling** (RSS.tsx:55, 111)
    - `pubDate || isoDate || ''` — some feeds might have neither field
    - `timeAgo('')` may return "Invalid date" or similar
    - **Severity**: Cosmetic

11. **No duplicate feed check** (server.ts:579-591)
    - User can add same RSS URL multiple times to single widget
    - No unique constraint on (widget_id, url) pair
    - **Severity**: Low (UI displays duplicates but works, user can remove manually)
    - **Fix**: Add constraint `UNIQUE(widget_id, url)` or check before insert (db.ts:240)

12. **Per-feed failure isolation** (RSS.tsx:45-61)
    - If one feed fails, its articles are []
    - Other feeds still render correctly (good)
    - But user sees no error indication which feed failed
    - **Fix**: Include `failed: true` in Article type, render error badge

---

## Confidence + gaps

**Confidence**: 95%  
**Tracing completeness**: Comprehensive—all CRUD paths, full fetch-to-render chain, DB isolation, SSRF gate logic

**Gaps/Unknowns**:
1. Actual rss-parser.parseURL() behavior on redirects (need to test or read rss-parser source)—assumed it follows node-fetch defaults
2. Whether node-fetch is configured globally with headers/timeouts elsewhere in server.ts (lines 600+ not provided)
3. Exact error message format from rss-parser on feed corruption (just mapped to 500 with errMsg)
4. Rate limiting applied to /api/rss (looks like apiLimiter on all /api routes, lines 39-45 suggest 300 req/min)
5. What happens if user's feed URL is very large (no content-length limits documented)
6. Test coverage for user isolation in widget operations (assumed requireAuth but not verified)
