# Flowchart: todos

Pathfinder Phase 1 — 2026-07-08

## Sources consulted (exact paths + line ranges read)

- `src/server.ts` lines 735-908 (todo-lists and tasks CRUD endpoints)
- `src/auth.ts` lines 218-243 (getOAuth2ClientForUser helper with auto-refresh)
- `src/db.ts` lines 119-126 (schema), lines 247-253 (prepared statements), lines 481-499 (functions)
- `frontend/src/components/TodoList.tsx` lines 1-368 (full component)
- `frontend/src/App.tsx` lines 43-157 (Dashboard mount, loadTodoLists, deleteTodoList, TodoList prop binding)
- `frontend/src/components/AppSidebar.tsx` lines 247-259 (ConfirmDialog for delete-list)

## Findings

**Happy Path Trace:**
1. App.tsx mounts → loadTodoLists() fetches GET /api/todo-lists → getTodoLists(userId) from db → returns array with google_tasklist_id mapping
2. TodoList.tsx mounts with lists prop → sets activeId to first list → useCallback loadTasks → GET /api/todo-lists/:id/tasks
3. Backend validates list exists and google_tasklist_id is present (line 791), retrieves oauth2Client via getOAuth2ClientForUser
4. Calls google.tasks().tasks.list() with tasklist ID, maxResults 100, showCompleted/showHidden flags
5. Frontend receives items, sorts by status (needsAction first), renders task list
6. Add task: POST /api/todo-lists/:id/tasks → server creates Google task via tasks.insert() → frontend reloads tasks
7. Toggle task: PATCH /api/todo-lists/:id/tasks/:taskId with status='needsAction'|'completed'
8. Delete task: DELETE /api/todo-lists/:id/tasks/:taskId
9. Move task (drag-drop): POST /api/todo-lists/:id/tasks/:taskId/move with previousTaskId → tasks.move()

**Error Branches & Graceful Fallbacks:**
- Missing google_tasklist_id (never created in Google): GET /api/todo-lists/:id/tasks returns `{items: [], error: 'Brak polaczenia z Google Tasks'}` (line 791)
- No oauth2Client: returns `{items: [], error: 'Polacz konto Google w ustawieniach.'}` (line 794)
- Insufficient scopes (tasks API not enabled): caught at line 810, returns `{items: [], error: 'Wlacz Google Tasks API i zaloguj sie ponownie.'}` with auto-reconnect prompt
- API errors during task operations: caught, logged, status 500 returned (lines 834-836, 864-865, 887-888, 905-906)
- Network errors: TodoList catches and refetches on failure (lines 96, 118, 130, 156-157)

**Optimistic UI Updates vs Refetch:**
- Add task (line 93-94): sets draft='', then refetches full list
- Toggle task (line 105-107): optimistic state update immediately, PATCH server, refetch on error
- Delete task (line 124): optimistic removal from state, DELETE, refetch on error
- Move task (line 140-143): optimistic reorder, POST move, refetch on error

**Side Effects & External Dependencies:**
- F1 auth (src/auth.ts): getOAuth2ClientForUser retrieves token from db, auto-refreshes via oauth2Client.on('tokens') event, persists new tokens (lines 231-240)
- Google Tasks API v1: tasks.list(), tasks.insert(), tasks.patch(), tasks.move(), tasks.delete()
- Database: user_todo_lists table with google_tasklist_id nullable field (lines 119-126)

## Mermaid diagram

```mermaid
flowchart TD
    A["App mounts<br/>App.tsx:43"] --> B["loadTodoLists<br/>App.tsx:60-65"]
    B --> C["GET /api/todo-lists<br/>server.ts:736-738"]
    C --> D["getTodoLists userId<br/>db.ts:483-485"]
    D --> E["Return TodoList[]<br/>with google_tasklist_id<br/>db.ts:247"]
    E --> F["Set state: todoLists<br/>App.tsx:63"]
    
    F --> G["Render TodoList component<br/>App.tsx:144-148"]
    G --> H["TodoList.tsx:32 mounts<br/>sets activeId=lists[0].id<br/>TodoList.tsx:33"]
    H --> I["useEffect loadTasks<br/>TodoList.tsx:80"]
    I --> J["GET /api/todo-lists/:id/tasks<br/>server.ts:787-815"]
    
    J --> K{List exists &<br/>google_tasklist_id<br/>set?<br/>server.ts:789-791}
    K -->|No| L["Return error:<br/>Brak polaczenia<br/>server.ts:791"]
    K -->|Yes| M["getOAuth2ClientForUser<br/>auth.ts:218-243"]
    
    M --> N{oauth2Client<br/>found?<br/>server.ts:793-794}
    N -->|No| O["Return error:<br/>Polacz konto Google<br/>server.ts:794"]
    N -->|Yes| P["Call google.tasks<br/>with oauth2Client<br/>server.ts:797-803"]
    
    P --> Q["tasksApi.tasks.list<br/>tasklist:id<br/>maxResults:100<br/>showCompleted:true<br/>server.ts:798-803"]
    Q --> R{Auth scopes<br/>or API error?<br/>server.ts:810-813}
    R -->|Scopes missing| S["Return error:<br/>Wlacz Google Tasks API<br/>server.ts:811"]
    R -->|Other error| T["Return 500 error<br/>server.ts:813"]
    R -->|Success| U["Sort items by<br/>position<br/>server.ts:805"]
    
    U --> V["Return items[]<br/>server.ts:806"]
    L --> W["Frontend receives<br/>error message<br/>TodoList.tsx:66-67"]
    O --> W
    S --> W
    T --> W
    V --> X["Frontend receives<br/>items[]<br/>TodoList.tsx:65"]
    
    W --> Y["setErrorMsg<br/>setTasks=empty<br/>TodoList.tsx:67-68"]
    X --> Z["sortTasks by status<br/>setTasks<br/>TodoList.tsx:70-71"]
    
    Y --> AA["Render error msg<br/>TodoList.tsx:232-233"]
    Z --> AB["Render task list<br/>TodoList.tsx:237-320"]
    
    AB --> AC{"User action:<br/>add/toggle/<br/>delete/move?<br/>TodoList.tsx"}
    
    AC -->|Add task| AD["Form submit<br/>addTask<br/>TodoList.tsx:82-100"]
    AD --> AE["POST /api/todo-lists/:id/tasks<br/>server.ts:817-838"]
    AE --> AF["getOAuth2ClientForUser<br/>server.ts:824-825"]
    AF --> AG{List linked &<br/>oauth2Client?<br/>server.ts:822-825}
    AG -->|No| AH["Return 400/401<br/>server.ts:822,825"]
    AG -->|Yes| AI["tasksApi.tasks.insert<br/>title:title<br/>status:needsAction<br/>server.ts:829-832"]
    AI --> AJ{Success?<br/>server.ts:834-837}
    AJ -->|Error| AK["Console error<br/>return 500<br/>server.ts:835-836"]
    AJ -->|Success| AL["Return task data<br/>server.ts:833"]
    AK --> AM["setDraft='<br/>loadTasks refetch<br/>TodoList.tsx:93-94"]
    AL --> AN["setDraft='<br/>loadTasks refetch<br/>TodoList.tsx:93-94"]
    
    AC -->|Toggle task| AO["toggleTask<br/>TodoList.tsx:102-120"]
    AO --> AP["Optimistic update<br/>setTasks status<br/>TodoList.tsx:105-107"]
    AP --> AQ["PATCH /api/todo-lists/:id/tasks/:taskId<br/>server.ts:840-867"]
    AQ --> AR["getOAuth2ClientForUser<br/>server.ts:849-850"]
    AR --> AS{List linked &<br/>oauth2Client?<br/>server.ts:847-850}
    AS -->|No| AT["Return 400/401<br/>server.ts:847,850"]
    AS -->|Yes| AU["tasksApi.tasks.patch<br/>status, completed<br/>server.ts:854-861"]
    AU --> AV{Success?<br/>server.ts:863-865}
    AV -->|Error| AW["Console error<br/>loadTasks refetch<br/>TodoList.tsx:118"]
    AV -->|Success| AX["Return patched task<br/>server.ts:862"]
    AX --> AY["loadTasks refetch<br/>TodoList.tsx:115"]
    
    AC -->|Delete task| AZ["deleteTask<br/>TodoList.tsx:122-132"]
    AZ --> BA["Optimistic removal<br/>setTasks filter<br/>TodoList.tsx:124"]
    BA --> BB["DELETE /api/todo-lists/:id/tasks/:taskId<br/>server.ts:892-908"]
    BB --> BC["getOAuth2ClientForUser<br/>server.ts:897-898"]
    BC --> BD{List linked &<br/>oauth2Client?<br/>server.ts:895-898}
    BD -->|No| BE["Return 400/401<br/>server.ts:895,898"]
    BD -->|Yes| BF["tasksApi.tasks.delete<br/>server.ts:902"]
    BF --> BG{Success?<br/>server.ts:904-906}
    BG -->|Error| BH["Console error<br/>loadTasks refetch<br/>TodoList.tsx:130"]
    BG -->|Success| BI["Return ok:true<br/>server.ts:903"]
    BI --> BJ["loadTasks refetch<br/>TodoList.tsx:127"]
    
    AC -->|Move drag-drop| BK["handleDrop<br/>TodoList.tsx:134-159"]
    BK --> BL["Optimistic reorder<br/>setTasks splice<br/>TodoList.tsx:140-143"]
    BL --> BM["POST /api/todo-lists/:id/tasks/:taskId/move<br/>server.ts:869-890"]
    BM --> BN["getOAuth2ClientForUser<br/>server.ts:875-876"]
    BN --> BO{List linked &<br/>oauth2Client?<br/>server.ts:873-876}
    BO -->|No| BP["Return 400/401<br/>server.ts:873,876"]
    BO -->|Yes| BQ["tasksApi.tasks.move<br/>previous:taskId<br/>server.ts:880-884"]
    BQ --> BR{Success?<br/>server.ts:886-888}
    BR -->|Error| BS["Console error<br/>loadTasks refetch<br/>TodoList.tsx:157"]
    BR -->|Success| BT["Return moved task<br/>server.ts:885"]
    BT --> BU["loadTasks refetch<br/>TodoList.tsx:154"]
    
    AB --> BV["Delete list button<br/>TodoList.tsx:211-221"]
    BV --> BW["setDeleteOpen=true<br/>TodoList.tsx:214"]
    BW --> BX["ConfirmDialog opens<br/>TodoList.tsx:351-365"]
    BX --> BY["User confirms<br/>TodoList.tsx:358-362"]
    BY --> BZ["Call onDeleteList<br/>App.tsx:107-111"]
    BZ --> CA["DELETE /api/todo-lists/:id<br/>server.ts:768-784"]
    CA --> CB["getTodoLists to find list<br/>server.ts:769"]
    CB --> CC{list.google_tasklist_id<br/>exists?<br/>server.ts:771}
    CC -->|Yes| CD["getOAuth2ClientForUser<br/>server.ts:772-773"]
    CD --> CE{oauth2Client?<br/>server.ts:773}
    CE -->|Yes| CF["tasksApi.tasklists.delete<br/>server.ts:776"]
    CF --> CG["Console log on error<br/>server.ts:778"]
    CE -->|No skip|
    CC -->|No skip|
    CG --> CH["deleteTodoList userId,id<br/>server.ts:782"]
    CH --> CI["Return ok:true<br/>server.ts:783"]
    CI --> CJ["loadTodoLists refetch<br/>App.tsx:110"]
    CJ --> CK["TodoList remounts<br/>with updated lists<br/>TodoList.tsx:55"]
    
    style A fill:#e1f5ff
    style J fill:#fff9c4
    style AE fill:#fff9c4
    style AQ fill:#fff9c4
    style BB fill:#fff9c4
    style BM fill:#fff9c4
    style CA fill:#fff9c4
    style L fill:#ffebee
    style O fill:#ffebee
    style S fill:#ffebee
    style T fill:#ffebee
    style AH fill:#ffebee
    style AT fill:#ffebee
    style BE fill:#ffebee
    style BP fill:#ffebee
```

## External dependencies

- **F1 Auth (auth.ts:218-243)**: getOAuth2ClientForUser retrieves and auto-refreshes OAuth2 credentials; oauth2Client.on('tokens') event persists refreshed tokens via upsertToken
- **Google Tasks API v1**: oauth2Client.request scope includes 'https://www.googleapis.com/auth/tasks' (auth.ts:33)
  - tasksApi.tasklists.insert() — create list
  - tasksApi.tasklists.delete() — delete list
  - tasksApi.tasks.list() — fetch tasks with pagination (maxResults:100)
  - tasksApi.tasks.insert() — create task
  - tasksApi.tasks.patch() — update status
  - tasksApi.tasks.move() — reorder task
  - tasksApi.tasks.delete() — delete task
- **Database**: user_todo_lists table with id, user_id, name, google_tasklist_id (nullable), sort_order

## Observations (bugs/reliability, file:line)

1. **Duplicate ConfirmDialog for delete-list (DESIGN SMELL)**
   - TodoList.tsx:351-365 defines ConfirmDialog when list tab shows delete button
   - AppSidebar.tsx:247-259 defines identical ConfirmDialog when sidebar list item shows delete button
   - Both call onDeleteTodoList with same logic — confirms deletion from two different UIs
   - **Risk**: User could trigger delete from both UI paths simultaneously (race condition if not careful)
   - **Observation**: AppSidebar passes onDeleteTodoList (App.tsx:189), TodoList also receives onDeleteList (App.tsx:147) — both point to same deleteTodoList callback (App.tsx:107-111)

2. **Missing error surfacing in optimistic UI updates**
   - TodoList.tsx:114-118, 127, 153: console.error() but no user-facing error message on toggle/delete/move failures
   - Only network catch blocks log errors; no UI toast/snackbar to alert user
   - **Risk**: User sees task removed/toggled but if API fails, refetch may restore, creating confusion

3. **Race condition: optimistic update + refetch**
   - TodoList.tsx:105-107: toggleTask optimistically updates state
   - Line 115: loadTasks() refetches — but if server patch failed, user sees stale state until refetch
   - If multiple operations fire in quick succession (e.g., toggle task A, toggle task B, drag task C), refetch ordering is non-deterministic

4. **No error boundary in TodoList**
   - ErrorMsg state (line 36) is set when data.error exists (line 67)
   - But if Google API throws unexpected error, no fallback UI — just blank/loading state

5. **tasks.list() sorting assumption**
   - Server sorts by position (server.ts:805) but relies on google.tasks API returning position field
   - Frontend sortTasks() uses status only (TodoList.tsx:26-30)
   - **Risk**: Frontend sort differs from backend sort; dnd doesn't persist position properly if position field is missing

6. **Missing list validation before task operations**
   - App.tsx:145: passes todoLists.map(t => ({id: t.id, name: t.name}))
   - TodoList never verifies list still exists in DB when activeId is selected
   - **Risk**: If list deleted externally, activeId still valid but API returns 404 (not caught)

7. **google_tasklist_id nullable but not handled gracefully**
   - db.ts:481: TodoList interface has google_tasklist_id: string | null
   - Server checks at line 791, 822, 847, 873, 895 — returns error instead of creating Google list
   - **Better UX**: If google_tasklist_id is null, could auto-create list on first task add

8. **Token refresh edge case**
   - auth.ts:231-240: Token refresh persists via oauth2Client.on('tokens')
   - But if refresh fails, no retry or fallback — error logged only (line 778)
   - **Risk**: Access token expires mid-request, refresh fails, user gets vague API error

## Confidence + gaps

**Confidence: HIGH (95%)**
- All happy-path flows traced through code
- Error branches verified with line-by-line server/frontend mapping
- External dependencies (F1 auth, Google Tasks API v1) confirmed
- UI component hierarchy and state management fully reviewed

**Gaps/Unknowns:**
- Exact error messages returned by Google Tasks API (server catches generically, logs but doesn't expose scope/rate-limit details)
- Behavior if user deletes list in Google Tasks web UI while app is open (no sync, activeId stale)
- Whether dragGhost cleanup (TodoList.tsx:274-279) handles all edge cases (e.g., browser tab blur during drag)
- No tests visible — no verification of race conditions or offline scenarios
- ConfirmDialog component implementation not reviewed (assume standard modal)
