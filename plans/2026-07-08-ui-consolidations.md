# Plan P4: Drobne konsolidacje UI + minory z review PR #3

Data: 2026-07-08. Baza: main `5c50d77`. Branch roboczy: `refactor/ui-consolidations`.
Zrodla: PATHFINDER-2026-07-08/02-duplication-report.md (D6, D7, D11), code review PR #3 (2 minory).
Pozycje linii zweryfikowane discovery-agentem na `5c50d77` (2026-07-08).

## Zasady globalne

- Zero nowych warstw abstrakcji — hoisty i fix-in-place.
- Strict TS: zero `any`, zero `@ts-ignore`; `import type` gdzie mozliwe.
- Przed kazdym commitem: root `npm run lint` && `npm run build` exit 0.
- Weryfikacja manualna w Chrome przez claude-in-chrome (NIE preview_*), tab dashboardu na localhost:5173.
- NIE ruszac: Avatar x3, resolveSession (odlozone), generateAuthUrl (tylko TODO-komentarz — decyzja o wezszym scope calendar-connect pozniej).

---

## Phase 1: NameDialog + hoist ConfirmDialog (dialogi)

### 1a. NameDialog — wspolny dialog "dodaj z nazwa"

Nowy plik `frontend/src/components/NameDialog.tsx`. Propsy proste (bez render-props/slots):

```tsx
interface NameDialogProps {
  open: boolean;
  title: string;        // "Nowy widget RSS" | "Nowa lista zadań"
  placeholder: string;  // "Nazwa widgetu" | "Nazwa listy"
  submitting: boolean;
  error: string | null;
  onSubmit: (name: string) => void;
  onClose: () => void;
}
```

Wzorzec do SKOPIOWANIA: App.tsx:260-285 (blok RSS) — struktura `Dialog > DialogContent > DialogHeader/DialogTitle > Input > ErrorMsg > DialogFooter` z importami z `@/components/ui/dialog`. Stan `name` (wartosc inputu) przenosi sie DO NameDialog (lokalny useState, reset przy zamknieciu/submit); `dialogError`/`dialogSubmitting` zostaja w App.tsx (wspoldzielone przez oba dialogi — przekazywane propsami).

Call sites w App.tsx do zastapienia:
- :260-285 (RSS): `<NameDialog open={rssDialogOpen} title="Nowy widget RSS" placeholder="Nazwa widgetu" ... onSubmit={submitRssDialog} />`
- :286-311 (Todo): analogicznie z `submitTodoDialog`
- `submitRssDialog` (:139-148) i `submitTodoDialog` (:150-159) przyjmuja teraz `name: string` z NameDialog zamiast czytac stan `rssName`/`todoName`; stany `rssName` (:82) i `todoName` (:84) do usuniecia z App.tsx
- Enter-to-submit i autoFocus zostaja (przenosza sie do NameDialog)

### 1b. Hoist ConfirmDialog usuwania todo-listy do App.tsx

Duplikaty (identyczna tresc, ten sam callback `deleteTodoList` App.tsx:128-137):
- TodoList.tsx:351-365 — stan `deleteOpen` + `activeList`, prop `onDeleteList` (App.tsx:195)
- AppSidebar.tsx:247-259 — stan `deleteListTarget: {id,name}|null`, prop `onDeleteTodoList` (App.tsx:237)

Docelowo: JEDEN `<ConfirmDialog>` w App.tsx ze stanem `deleteListTarget: { id: string; name: string } | null` (wzorzec stanu SKOPIOWAC z AppSidebar.tsx — juz uzywa dokladnie tego ksztaltu). Tresc/labels przeniesc 1:1 z AppSidebar.tsx:247-259.

- TodoList.tsx: prop `onDeleteList?: (id: string) => Promise<void>` zamienia sie na `onRequestDeleteList?: (target: { id: string; name: string }) => void`; klik w kosz woła go z aktywna lista; caly blok ConfirmDialog + stan `deleteOpen` usunac.
- AppSidebar.tsx: analogicznie — prop `onDeleteTodoList` → `onRequestDeleteList` (ten sam ksztalt), lokalny stan `deleteListTarget` + blok ConfirmDialog usunac.
- App.tsx: oba komponenty dostaja `onRequestDeleteList={setDeleteListTarget}`; `onConfirm` dialogu woła `deleteTodoList(target.id)` i zeruje target.

### Weryfikacja Phase 1
- lint + build exit 0
- Chrome: dodanie widgetu RSS przez dialog (Enter i przycisk), dodanie listy todo, anulowanie; usuniecie listy z poziomu sidebara ORAZ z poziomu widgetu — jeden i ten sam dialog, POST/DELETE 200
- grep: `deleteOpen` (0 trafien w TodoList), `deleteListTarget` (tylko App.tsx), `rssName|todoName` (0 trafien w App.tsx)

### Anti-pattern guards Phase 1
- NameDialog bez children/slots/render-props — tylko wymienione propsy
- NIE tworzyc generycznego "DialogManager" — dwa uzycia NameDialog + jeden ConfirmDialog inline w App.tsx

---

## Phase 2: Fix-in-place (useLayout, TTL, Calendar, TodoList)

### 2a. defaultBreakpointLayouts w useLayout.ts

Pary `buildDefaultLayout` + `deriveBreakpointDefaults` wywolywane 3x: :50-51, :62-63, :113-114.
Dodac one-liner nad definicjami (obie funkcje juz w pliku, :13-18 i :20-26):

```ts
const defaultBreakpointLayouts = (ids: string[]): BreakpointLayouts =>
  deriveBreakpointDefaults(buildDefaultLayout(ids));
```

Uwaga: call site :50-51 uzywa TAKZE posredniego `defaultLayout` (LayoutItem[]) osobno — sprawdzic; jesli tak, tam zostawic pare albo siegac po `.lg` z wyniku. Pozostale 2 miejsca podmienic na helper.

### 2b. Chart TTL — frontend 30 min → 5 min

`frontend/src/config.ts:10`: `CHART_CACHE_TTL = 30 * 60 * 1000` → `5 * 60 * 1000` + komentarz:
`// 5 min — backend cache'uje dane wykresow przez 30 min (server.ts THIRTY_MIN); frontendowy TTL musi byc krotszy, inaczej worst-case staleness ~60 min`

### 2c. Calendar.tsx — reset noKey/error w sciezce sukcesu

useEffect :46-86: `.then` NIE resetuje `noKey` ani `error` (discovery potwierdzone na kodzie; po podlaczeniu kalendarza widget wisi na "Zaloguj sie do kalendarza Google" do remountu). Fix: w `.then` po `setDays(...)` dodac `setNoKey(false); setError('');`.

### 2d. TodoList.tsx — widoczny blad + obsluga 403 (minor #2 z review PR #3)

`loadTasks` :59-78: raw `fetch`, martwa sciezka `data.error` (backend od P3 nie zwraca 200+{error}), catch tylko `console.error` → przy bledzie user widzi mylace "Brak zadan — dodaj ponizej".

Przepisac na `apiFetch` (wzorzec: Calendar.tsx:51-85 — catch z `instanceof ApiError`):
- import `{ apiFetch, ApiError }` z `@/lib/api` (patrz istniejacy import w Calendar.tsx:3)
- happy path: `const data = await apiFetch<{ items?: GoogleTask[] }>(apiBase); setTasks(sortTasks(data.items ?? [])); setErrorMsg('');`
- catch: `err instanceof ApiError && err.status === 403` → `setErrorMsg('Google Tasks niepolaczone — przejdz do ustawien konta.')`; inne bledy → `console.error` + `setErrorMsg('Nie udalo sie pobrac zadan')`
- w obu galeziach bledu `setTasks([])` — render errorMsg (:232-233) ma pierwszenstwo przed "Brak zadan"
- usunac martwa galaz `data.error`
- NIE ruszac mutacji toggle/delete (optimistic+rollback zostaje — legit)

### Weryfikacja Phase 2
- lint + build exit 0
- Chrome: wykresy ticker renderuja (TTL zmiana nie psuje fetchu), kalendarz renderuje eventy, lista zadan laduje sie i toggle dziala; reset layoutu w trybie edycji dziala (useLayout helper)
- grep: `deriveBreakpointDefaults(buildDefaultLayout` lub helper — pary zredukowane; `data.error` w TodoList (0 trafien)

### Anti-pattern guards Phase 2
- NIE dodawac AbortController/cache-busting przy TTL — tylko stala + komentarz
- NIE zmieniac semantyki soft-wariantu GET /api/tasks na backendzie (poza zakresem)
- TodoList: NIE przenosic mutacji na apiFetch w tym pakiecie (zrobione w P2 tam gdzie trzeba; toggle/delete maja wlasna logike rollback)

---

## Phase 3: Weryfikacja koncowa + review + PR

1. Root lint + build exit 0.
2. Chrome pelny smoke: dashboard laduje, wszystkie widgety renderuja, dialogi (RSS/todo/usun lista), brak nowych bledow konsoli.
3. Code review: subagent `code-reviewer` na `git diff main...HEAD`.
4. Push + `gh pr create` (body przez --body-file; stopka 🤖).
5. CI babysit (`gh pr checks N --watch`), pytanie do usera o squash merge.
