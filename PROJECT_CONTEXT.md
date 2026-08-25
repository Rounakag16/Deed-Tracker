# PROJECT_CONTEXT.md

## Project Overview

**DeedTracker** is a web app for tracking the lineage of land deeds as a
graph. Land is often bought as one large parcel, then subdivided and resold
repeatedly over years, sometimes by multiple co-owners, sometimes
recombined from several sellers into a single new deed. The purpose of this
app is to let a user record that chain of custody and see it visually.

**Core concept:** a deed can have any number of *source* deeds (it
converged from several earlier deeds - e.g. one buyer purchasing from 3
different sellers) and any number of *derived* deeds (it diverged into
several later deeds - e.g. the land was subsequently subdivided and sold
piecemeal). This is a DAG (directed acyclic graph), not a tree: a node can
have multiple parents and multiple children simultaneously.

**Target user:** a single person (no multi-user auth) managing land records
for one or more distinct tracts, each tracked as its own "workspace".

**Origin:** this is a full rewrite of an earlier Firebase/single-tree
version of the same idea (that version stored each deed as a strict
single-parent tree node; this rewrite replaces that with the graph model
above). The original app's deed field schema (purchasers, sellers, deed
info, land parcels/khatiyas/plots) was preserved as-is by request; only the
relationship model and stack changed.

## Tech Stack

- **Frontend:** React 18 + Vite 5, Tailwind CSS 3. Plain `fetch`-based API
  client (no React Query/Redux/etc - state is local `useState`/`useEffect`
  per component).
- **Backend:** Node.js + Express 4, REST API (no GraphQL).
- **Database:** MongoDB via Mongoose 8. Chosen because deeds are naturally
  document-shaped (nested purchasers/sellers/land parcels) and
  relationships are a simple thin collection of ObjectId references.
- **Authentication:** **none.** Single-user tool, no login, no sessions,
  no protected routes. This was an explicit choice for v1 (see Important
  Decisions).
- **Key libraries:** `mongoose` (ODM), `exceljs` (Excel export),
  `cors`, `dotenv` on the server; no extra client libraries beyond
  React/Vite/Tailwind - specifically **no** node-graph library (react-flow
  etc.) was used; the node-editor canvas is hand-built with SVG + absolute
  positioning (see Architecture).
- **Deployment/hosting:** not yet deployed anywhere. No CI/CD, no
  Dockerfile, no hosting config exists in the repo yet. Designed to run as
  two local dev servers (Vite on 5173 proxying `/api` to Express on 4000)
  plus a MongoDB instance (local or Atlas).
- **Versions:** see `server/package.json` / `client/package.json` for exact
  pinned versions (React ^18.3.1, Express ^4.19.2, Mongoose ^8.5.1,
  Vite ^5.3.4, Tailwind ^3.4.7, exceljs ^4.4.0).

## Project Architecture

Standard three-tier MERN, no message queues, no server-side rendering, no
websockets:

```
React SPA (client/)  <--HTTP/JSON-->  Express API (server/)  <--Mongoose-->  MongoDB
```

- The client never talks to MongoDB directly; everything goes through the
  Express REST API under `/api/...`.
- In dev, Vite proxies `/api/*` to `http://localhost:4000` (see
  `client/vite.config.js`), so the client always calls relative paths like
  `/api/workspaces`.
- All API responses are JSON. Excel export is the one exception: it streams
  an `.xlsx` binary with a `Content-Disposition: attachment` header instead
  of JSON.
- **No caching layer** - every list/detail view fetches fresh from the API
  on mount via `useEffect`.

### Key data flow: the node-editor canvas

This is the least conventional part of the app and worth understanding
before touching `Canvas.jsx`:

1. Card **positions** are computed two ways: (a) an auto-layout algorithm
   (`client/src/layout.js`, function `computeLayers` + `computePositions`)
   assigns every deed a layer (generation depth from its earliest root
   ancestor) and lays layers out top-to-bottom; (b) a deed can override this
   with a manually-dragged `position: {x, y}` stored on the Deed document
   itself. `resolvedPos()` in `Canvas.jsx` picks the manual position if
   present, else falls back to the computed auto-layout position.
2. Card **connector dots** (top = input/"derives from", bottom =
   output/"derives into") are real DOM elements. Their pixel positions are
   **measured directly via `getBoundingClientRect()`** (see
   `recomputeAnchors` in `Canvas.jsx`), not computed mathematically. This is
   deliberate: it means SVG wires stay glued to the dots correctly even
   though cards have variable height (collapsed vs. expanded-for-editing),
   without needing to track expand/collapse state in the layout math.
3. Dragging a wire between dots, or dragging a card to reposition it, both
   work via manual `window.addEventListener("mousemove"/"mouseup", ...)`
   during the gesture (not native HTML5 drag-and-drop, not a library).
4. New deeds and new relationship links are held in local React state
   (`draftDeeds`, `pendingEdges`) and are **not** persisted to the server
   until the user clicks "Save" - at which point drafts are POSTed first
   (to get real `_id`s), then pending edges are POSTed with those real ids
   substituted in for the temporary draft ids. A manually dragged card
   **position**, however, persists immediately on drop for already-saved
   deeds (it does not wait for the batch Save), since it's considered a
   low-risk, easily-undone action.
5. `LineageGraph.jsx` (the read-only "View" mode) shares the exact same
   `layout.js` auto-layout functions as the edit canvas, so the two stay
   visually consistent. It does NOT reflect manual per-card positions from
   the canvas - it always shows the pure auto-arranged layout.

## Repository Structure

```
/
├── .gitignore
├── README.md                  Setup instructions (MongoDB, server, client)
├── server/
│   ├── .env.example            MONGODB_URI, PORT
│   ├── package.json
│   └── src/
│       ├── server.js           Express app entrypoint; mounts all routers
│       ├── utils/db.js         Mongoose connection helper
│       ├── models/
│       │   ├── Workspace.js    { name, description }
│       │   ├── Deed.js         Full deed schema (see Database section)
│       │   └── Relationship.js Directed edge between two deeds
│       └── routes/
│           ├── workspaces.js   CRUD for workspaces (cascading delete)
│           ├── deeds.js        CRUD for deeds within a workspace
│           ├── relationships.js CRUD for edges within a workspace
│           ├── search.js       Field-scoped + global search across deeds
│           └── export.js       Streams the two-sheet Excel export
└── client/
    ├── index.html
    ├── vite.config.js          Dev proxy: /api -> localhost:4000
    ├── tailwind.config.js / postcss.config.js
    └── src/
        ├── main.jsx             ReactDOM root
        ├── App.jsx              Top-level tab router (canvas/search/lineage)
        ├── api.js               Thin fetch wrapper - the ONLY place that
        │                        knows API URLs; all components go through it
        ├── layout.js            Shared auto-layout algorithm (computeLayers,
        │                        computePositions) - used by both Canvas and
        │                        LineageGraph, keep them in sync if editing
        ├── index.css            Tailwind directives
        └── components/
            ├── WorkspaceList.jsx  Landing page: list/create/rename/delete
            ├── Canvas.jsx         THE main editing surface - node-editor
            │                      (see Architecture above). Largest/most
            │                      complex file in the project.
            ├── DeedCard.jsx       One deed's card UI: collapsed summary,
            │                      expand-to-edit, local-buffered edits with
            │                      explicit Save/Discard (see Known Issues -
            │                      this buffering was a deliberate bug fix)
            ├── DeedForm.jsx       The actual field-by-field edit form
            │                      (purchasers/sellers/land parcels/etc) +
            │                      exports `blankDeed()` factory used when
            │                      adding a new deed
            ├── LineageGraph.jsx   Read-only "View" mode - auto-arranged
            │                      diagram + click-to-inspect side panel
            └── SearchPanel.jsx    Field-scoped search UI, results are
                                   clickable and jump into LineageGraph
```

## Database

MongoDB, three collections, all accessed only via Mongoose models in
`server/src/models/`.

### `workspaces`
```
{ _id, name, description, createdAt, updatedAt }
```
One workspace = one land tract/area a user is tracking. No further nesting.

### `deeds`
```
{
  _id,
  workspaceId,        // ref Workspace, indexed
  title,               // free-text label, default "New Deed"
  purchasers: [{ name, fatherName }],       // at least one entry by default
  sellers:    [{ name, fatherName }],
  deedInfo: { deedNumber, volumeNumber, pageNumber, officeNumber },
  landParcels: [{
    area, mouja, sheetNo,
    khatiyas: [{ number }],
    plots: [{ rs, lr, area }],
  }],
  position: { x, y } | null,   // manual canvas placement; null = use auto-layout
  createdAt, updatedAt
}
```
This schema is a direct carry-over from the original (pre-rewrite) app's
field names - do not rename these fields without checking `DeedForm.jsx`,
`export.js`, and `search.js`, all of which reference them by exact path.

A **text index** covers all the searchable string fields (purchaser/seller
names, deed/volume/page/office numbers, mouja, sheet no., khatiya no., plot
RS/LR) - see bottom of `Deed.js`. In practice `search.js` currently does
**regex** matching per topic rather than using MongoDB's `$text` operator
(see Known Issues), so this text index is currently unused by application
code.

### `relationships`
```
{
  _id,
  workspaceId,      // ref Workspace, indexed
  sourceDeedId,     // ref Deed, indexed - the earlier/parent deed
  targetDeedId,     // ref Deed, indexed - the later/derived deed
  areaTransferred,  // free-text, e.g. "2 acres" - optional
  note,             // free-text - optional
  createdAt, updatedAt
}
```
Directed edge meaning "targetDeed derives from sourceDeed". A unique
compound index on `(workspaceId, sourceDeedId, targetDeedId)` prevents
duplicate edges in the same direction between the same pair (but does
**not** prevent a reverse edge, and does not prevent cycles - see Known
Issues).

**Relationships:** Deed → Workspace (many-to-one). Relationship → Workspace
(many-to-one), Relationship → Deed × 2 (many-to-one each, as source and
target). Deletion cascades application-side (not via Mongo transactions):
deleting a workspace deletes its deeds and relationships; deleting a deed
deletes any relationship referencing it as source or target.

## API

Base path `/api`. All bodies/responses are JSON except `GET .../export`.
No authentication on any route (see Authentication section).

| Method | Route | Purpose |
|---|---|---|
| GET | `/workspaces` | List all workspaces |
| GET | `/workspaces/:id` | Get one workspace |
| POST | `/workspaces` | Create workspace `{ name, description }` |
| PATCH | `/workspaces/:id` | Rename/update description |
| DELETE | `/workspaces/:id` | Delete workspace + cascade its deeds/relationships |
| GET | `/workspaces/:workspaceId/deeds` | List deeds in a workspace |
| POST | `/workspaces/:workspaceId/deeds` | Create one or many deeds - body `{ deeds: [...] }` (or a single deed object as fallback) |
| PUT | `/workspaces/:workspaceId/deeds/:deedId` | Update a deed (partial `$set` of whatever fields are sent, including `position`) |
| DELETE | `/workspaces/:workspaceId/deeds/:deedId` | Delete a deed + cascade its relationships |
| GET | `/workspaces/:workspaceId/relationships` | List edges in a workspace |
| POST | `/workspaces/:workspaceId/relationships` | Create one or many edges - body `{ relationships: [...] }`. Rejects any edge where `sourceDeedId === targetDeedId`. Duplicate edges are silently skipped (207 response) rather than erroring the whole batch. |
| DELETE | `/workspaces/:workspaceId/relationships/:relationshipId` | Delete one edge |
| GET | `/search?q=&topic=&workspaceId=` | Search deeds. `topic` is one of `all, purchaser, seller, deedNo, volumeNo, pageNo, officeNo, mouja, sheetNo, khatiyaNo, plotNoRS, plotNoLR` (see `TOPIC_FIELDS` map in `search.js`). `workspaceId` is optional - omit to search across all workspaces. Returns each match with its immediate parent/child deed ids attached for context. |
| GET | `/workspaces/:workspaceId/export` | Streams an `.xlsx` file: "Deeds" sheet (flattened fields + computed root-ancestor column) and "Relationships" sheet (source/target/area/note) |

No route currently supports partial/paginated results - `search` caps at
200 results, everything else returns full collections unpaginated.

## Authentication & Authorization

**None implemented.** Every API route is open; there is no user model, no
session/JWT middleware, no concept of "who owns this workspace". This was
an explicit v1 scope decision (assumed single user running their own
instance), not an oversight - see Important Decisions. If auth is added
later, every route in `server/src/routes/` will need protecting, and the
client will need a login flow added ahead of `WorkspaceList.jsx`.

## Major Features

- **Workspaces** - top-level containers, one per land tract. Create,
  rename (inline edit), delete (cascades).
- **Node-editor canvas** (`Canvas.jsx`) - the main deed-entry screen.
  - "+ Add Deed" drops a new blank, expanded card.
  - Drag from a card's bottom dot to another card's top dot to mark
    "derives from"; a small popover asks for optional area-transferred and
    note text before the link is queued.
  - Cards are freely draggable to reposition; position persists per-deed
    immediately on drop. "Reset Layout" clears all manual positions back to
    auto-arrange.
  - New deeds/links are drafts until "Save" is clicked (batch-commits
    drafts then links, resolving temp ids to real ones).
  - Already-saved deeds can be expanded and edited inline; edits are
    buffered locally and only PUT to the server on an explicit "Save
    changes" click (see Known Issues / Important Implementation Details for
    why this matters).
  - A banner warns (non-blocking) if two deeds in the workspace share the
    same deed number.
- **Lineage view** (`LineageGraph.jsx`, reached via the "View" button) -
  read-only, auto-arranged top-to-bottom diagram of the same
  workspace. Clicking a node opens a side panel with full deed detail plus
  clickable lists of its parent/child deeds, letting you walk the chain.
- **Search** (`SearchPanel.jsx`) - field-scoped or all-fields search, can
  be scoped to the current workspace or global. Clicking a result jumps
  straight into the Lineage view for that deed, switching workspaces first
  if the result belongs to a different one.
- **Excel export** - per-workspace two-sheet `.xlsx` (Deeds, Relationships)
  including a computed "root ancestor deed(s)" column per deed.

## Important Implementation Details

- **`DeedCard.jsx`'s local edit buffering is load-bearing, not
  optional.** Earlier in development, saved-deed edits fired a PUT + full
  list reload on every keystroke, which reset the input's cursor position
  and made typing unusable. The fix: for a saved (non-draft) deed,
  `DeedCard` keeps its own `localDeed`/`dirty` state and only calls the
  parent's `onSave` when the user clicks "Save changes"; the parent-provided
  `deed` prop is only re-synced into local state when not dirty (so a
  background reload doesn't clobber an in-progress edit). Do not "simplify"
  this back to a direct `onChange` → API call.
- **`Canvas.jsx`'s anchor measurement must stay DOM-based, not
  math-based.** The vertical layout math (`layout.js`) assumes a fixed
  estimated node height (`NODE_H_ESTIMATE`) purely for spacing between
  layers/columns - actual card heights vary a lot between collapsed and
  expanded (mid-edit) states. Wires are drawn using real
  `getBoundingClientRect()` measurements of the dot elements
  (`recomputeAnchors`), re-triggered via a `ResizeObserver` on each card
  wrapper plus a `useLayoutEffect`. If you change card markup, make sure
  the top/bottom dot `ref`s stay attached directly to the dot elements (not
  a wrapping element), or wire positions will be wrong.
- **Pending (unsaved) relationship edges must carry their own index.**
  `graphEdges` in `Canvas.jsx` tags each pending edge with `pendingIndex`
  at map-time specifically so click-to-delete can find it again -
  `pendingEdges.indexOf(edgeObject)` does NOT work because the rendered
  edge objects are freshly spread copies, not the same reference as what's
  in `pendingEdges`. This was a real bug caught during development; if
  you're touching this code, preserve `pendingIndex` (or replace it with
  another stable identifier), don't reach for `indexOf`.
- **Auto-layout uses "longest path" layering** (`computeLayers` in
  `layout.js`): a deed's layer/generation = 1 + the max layer of its
  parents (0 if it has none). This guarantees a converging deed always sits
  visually after every one of its source deeds. It has a cycle guard
  (returns layer 0 if it detects revisiting a node mid-computation) but
  cycles shouldn't be possible given the app never lets you link a deed to
  itself - see Known Issues re: multi-hop cycles.
- **`DeedForm.jsx` exports `blankDeed()`** - the canonical shape of a new,
  empty deed. Anywhere a new deed is created client-side goes through this
  function; keep it in sync with the Mongoose schema defaults in `Deed.js`
  if fields are added/changed.
- Mongo `_id`, `__v`, `createdAt`, `updatedAt`, `workspaceId` are explicitly
  stripped out client-side before PUTing a deed back (see the destructuring
  in `Canvas.jsx`'s `onSave` handler) so they don't get sent back as part of
  the update payload.

## Important Decisions

- **Graph model over tree, no separate "sibling" edge type.** Originally
  scoped as "sibling or child" relationships, but the real use case
  (deeds converging from multiple sources and diverging into multiple
  derived deeds) is better modeled as a single directed edge type
  (`derives from` / DAG), where "siblings" fall out naturally as deeds
  sharing a common source - no dedicated sibling relationship was built.
- **MongoDB over a relational DB**, chosen for the natural document fit of
  nested deed fields, despite the user being open to either.
- **No authentication for v1**, single-user assumption, explicitly
  deferred rather than overlooked.
- **Vertical (top-to-bottom) auto-layout**, matching a reference
  screenshot the user provided of a GitHub-Actions-style workflow diagram,
  after an earlier left-to-right version was built and then replaced.
- **Manual card position persists immediately; deed/relationship edits do
  not** - deliberately inconsistent on purpose: repositioning is
  low-stakes and easily undone (drag it back, or "Reset Layout"), whereas
  batch-committing new deeds/links avoids half-finished data hitting the
  server and gives the user an explicit "I'm done" moment.
- **Client and edit-canvas share one layout algorithm** (`layout.js`)
  specifically so the read-only "View" mode is a faithful representation
  of the same graph, per an explicit user request ("View" should show "a
  read-only version of this same canvas").
- **Delivery workflow**: the user is on Claude's free tier without Claude
  Code, so all changes are delivered as git-apply-able `.diff` files rather
  than direct repo access, built and reviewed against a local scratch copy
  of the repo before being handed over.

## Current Project Status

**Completed:**
- Workspace CRUD (create/list/rename/delete)
- Deed CRUD, full field parity with the original app's schema
- Relationship CRUD (directed edges, converge/diverge support)
- Node-editor canvas: add deed, drag-to-wire, drag-to-reposition, batch
  save, duplicate deed-number warning
- Read-only Lineage/View mode with click-to-inspect panel
- Field-scoped + cross-workspace search, with click-through navigation
- Two-sheet Excel export with root-ancestor tracing

**Partially completed:**
- Search uses regex matching, not the Mongo text index that's actually
  defined on the schema (functionally fine at small scale, just an unused
  index and no relevance ranking)
- No automated tests exist anywhere in the repo (manual testing only, and
  as of the last conversation turn the user had not yet run the app
  end-to-end against a live MongoDB instance)

**Not implemented:**
- Authentication/authorization (explicitly deferred, see Important
  Decisions)
- Pan/zoom on the canvas (you get browser scroll within a max-height
  container, not a true zoomable/pannable viewport)
- Any deployment/hosting configuration (no Dockerfile, no CI, no
  production build/serve setup beyond `vite build`)
- Bulk import (e.g. migrating data out of the old Firebase version)
- Any confirmation/undo beyond native `confirm()` dialogs

## Known Issues

- **Cycle prevention is incomplete.** The API only rejects a direct
  self-loop (`sourceDeedId === targetDeedId`); it does not check for
  multi-hop cycles (A→B→C→A). The auto-layout algorithm has a guard that
  prevents infinite recursion if a cycle exists (falls back to layer 0),
  but a cycle would still be semantically nonsensical data. Uncertain
  whether this can happen in practice given the UI only lets you link
  existing/draft cards you can see, but it's not structurally prevented.
- **Search doesn't use the Mongo text index** defined on `Deed.js` -
  `search.js` does per-field regex `$or` matching instead. Fine at small
  data volumes; would need revisiting for relevance ranking or larger
  datasets.
- **Expanded (mid-edit) cards can visually overlap the card below them**
  in the same auto-layout column, because layout spacing is based on an
  estimated fixed node height while actual expanded height is much larger.
  Collapsing the card fixes it. Known and accepted trade-off, not yet
  fixed.
- **No server-side validation** beyond Mongoose schema types/defaults - no
  required-field enforcement (e.g. a deed can be saved with an empty deed
  number), no format validation on area/plot fields (all free-text
  strings).
- **No pagination anywhere** - `search` caps at 200 results; deed lists,
  workspace lists, and relationship lists are unbounded. Would need
  addressing before this scales to a large number of deeds per workspace.
- **The app has not yet been run end-to-end against a live database** as
  of the last development session - all review so far has been static
  (syntax checks, manual code tracing, balance checks), not live testing.
  Treat as "should work" rather than "confirmed working" until the user
  reports back.

## Development Conventions

- **Diff-based delivery**: changes to this project are delivered as
  git-apply-able unified diffs, numbered sequentially
  (`000N-description.diff`), each representing one focused change,
  committed individually in the working history.
- **Component style**: functional components + hooks only, no class
  components. No external state management - local `useState`/`useEffect`,
  props drilled directly (no context API in use yet).
- **Styling**: Tailwind utility classes inline in JSX, no CSS modules, no
  styled-components. Sparse color palette: slate for neutral UI, blue for
  primary actions/links, green for save/success, red for
  delete/destructive, amber for warnings.
- **API client discipline**: all client-server calls go through
  `client/src/api.js` - components never call `fetch` directly. Add new
  endpoints there first.
- **Server routes**: one router file per resource under
  `server/src/routes/`, mounted with `{ mergeParams: true }` where nested
  under `:workspaceId` so nested routers can read the parent param.
- **Cascading deletes are handled in route handlers**, not Mongoose
  middleware/hooks - if you add a new child collection under Deed or
  Workspace, remember to add its cleanup to the relevant DELETE handler.
- **Schema field names are load-bearing** across client and server
  (`DeedForm.jsx`, `Deed.js`, `search.js`, `export.js` all reference exact
  paths like `deedInfo.deedNumber`, `landParcels[].khatiyas[].number`) -
  treat renames as a cross-cutting change, not a local one.

## Environment Setup

Server (`server/.env`, based on `server/.env.example`):
- `MONGODB_URI` - Mongo connection string (local `mongodb://localhost:27017/deedtracker`
  or an Atlas SRV URI). **Required**, server exits on startup if missing.
- `PORT` - defaults to `4000` if unset.

No client-side `.env` is currently required (the Vite dev proxy hardcodes
`http://localhost:4000` in `vite.config.js`).

No secrets, API keys, or credentials of any kind currently exist in this
repo or are needed beyond the Mongo connection string above.

## Deployment

Not yet deployed. Current setup is dev-only: `npm run dev` for both
`server/` (nodemon) and `client/` (Vite dev server with API proxy). No
production build/serve path has been wired up (e.g. serving `client`'s
`vite build` output from Express, or separate static hosting), no
Dockerfile, no CI/CD pipeline, no hosting provider chosen.

## Important Constraints

- Do not add authentication without the user's explicit go-ahead - it's a
  deliberate v1 scope decision, not a gap to silently fill.
- Do not rename existing Deed schema fields without updating all
  dependent files (`DeedForm.jsx`, `search.js`'s `TOPIC_FIELDS`,
  `export.js`'s column mapping) in the same change.
- Preserve the local-edit-buffering pattern in `DeedCard.jsx` - do not
  revert to direct onChange-triggers-API-call for saved-deed edits (see
  Important Implementation Details for why).
- Keep `Canvas.jsx` and `LineageGraph.jsx` using the same `layout.js`
  functions - they're meant to stay visually consistent by design.
- This project has no automated tests - manual verification (or writing
  tests) is currently the only safety net against regressions.
