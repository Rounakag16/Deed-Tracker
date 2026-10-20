# DeedTracker — Project Brief

This document is a complete, standalone brief for continuing development of
DeedTracker. It assumes no prior conversation context — everything you need
to understand the product, the current implementation, the design system,
and what's left to do is below. Upload this alongside the codebase.

---

## 1. What this app is

DeedTracker is a tool for tracking the **lineage of land deeds** — who a
piece of land was bought from, who it was sold to, how a large tract
splits into smaller parcels over time (or several small parcels merge
into one), and the paper trail (deed number, volume, page, office,
khatiya/plot numbers) behind each transaction.

The core idea: a deed is a node. A "derives from" relationship between two
deeds is a directed edge. A deed can have multiple parents (it converged
from several source deeds) and multiple children (it diverged into several
later deeds) — the whole thing is a **DAG (directed acyclic graph)**, not a
simple tree or a flat list. The app's main screen is an interactive
node-graph canvas showing this structure, with a form-based editor for each
deed's details and an Excel export of the whole graph.

This replaces an earlier Firebase-based version of the same idea; this is
a ground-up rewrite (React + Express + MongoDB) built specifically to
handle the converge/diverge graph structure properly, which the Firebase
version reportedly couldn't.

---

## 2. Tech stack

- **Client**: React 18 + Vite, Tailwind CSS v3 (`@tailwind base/components/
  utilities` directive style, not v4's `@import` style)
- **Server**: Node.js + Express, Mongoose ODM
- **Database**: MongoDB (Atlas in production use)
- **Excel export**: `exceljs`
- **No authentication** — single-user tool as currently scoped (see
  §8, this is deliberately deferred, not forgotten)
- **No deployment/hosting config exists yet** — no Dockerfile, no CI,
  nothing beyond `vite build` (deliberately deprioritized so far — see §8)

Repo layout:
```
client/   — React app (src/components/, src/api.js, src/layout.js)
server/   — Express app (src/routes/, src/models/, src/utils/)
```

Client dev server proxies `/api` to the server (see `client/vite.config.js`).
Server needs a `.env` with `MONGODB_URI` and `PORT` (see
`server/.env.example`).

---

## 3. Data model

**Workspace** — a named container for a set of related deeds (e.g. one
workspace per tract of land, per client, per case). Simple: `{ name }`.

**Deed** — the core entity, scoped to a workspace:
```
{
  workspaceId,
  title,                    // user's own free-text label for the deed
  purchasers: [{ name, fatherName }],
  sellers: [{ name, fatherName }],
  deedInfo: { deedNumber, volumeNumber, pageNumber, officeNumber },
  landParcels: [{
    area, mouja, sheetNo,
    khatiyas: [{ number }],
    plots: [{ rs, lr, area }],
  }],
}
```
`deedInfo.deedNumber` is the only required/validated field server-side.
Everything else is free-text by design — this domain's numbering
conventions (khatiya/plot numbers, areas) don't have one canonical format
worth enforcing, and over-validating would just block real data entry.

**Relationship** — a directed edge between two deeds in the same workspace:
```
{ workspaceId, sourceDeedId, targetDeedId, areaTransferred, note }
```
Cycle prevention happens server-side at creation time via a BFS: before
adding edge `source → target`, check whether `target` can already reach
`source`; if so, reject (it would close a cycle). This makes cycles
structurally impossible through normal use of the app — several
downstream pieces of code (the export's ancestor-walk, in particular) are
defensively guarded against cycles anyway, in case data ever becomes
inconsistent some other way (a direct DB edit, a future migration bug).

---

## 4. Core features (implemented)

- **Workspace list** — create, rename, delete, paginated.
- **Canvas** (the main screen) — a pannable/zoomable node graph.
  - Deeds auto-arrange into layers (a topological-sort-style layout: a
    deed's layer = 1 + max(layer of its parents); no parents = layer 0),
    computed in `client/src/layout.js` (pure functions, no DOM
    dependency — `computeLayers` / `computePositions`).
  - Cards can also be manually dragged; a dragged position persists
    immediately (low-risk, no explicit save needed for position alone).
  - Each card has a top "derives from" drop-target dot and a bottom
    "drag to link" dot. Dragging from one card's bottom dot to another
    card's top dot opens a small inline form (area transferred, note) to
    confirm the new relationship before it's added to the pending-changes
    batch.
  - New deeds and new relationships are held as unsaved/"draft" state
    client-side until an explicit "Save" — they don't hit the server
    until then. Draft deeds get a temporary client-side ID; on save, the
    server creates them in one atomic batch (`insertMany` with
    `ordered: true` — all-or-nothing, so a validation failure on one
    draft deed doesn't leave a partial mess), then relationships
    referencing those drafts get their temp IDs resolved to real
    MongoDB `_id`s before being saved.
  - Clicking a card opens a **right-hand sidebar** with the full deed
    form (see `DeedSidebar.jsx` / `DeedForm.jsx`) — editing happens
    there, not inline on the card, specifically so an in-progress edit
    doesn't resize the card and throw off the surrounding auto-layout.
    The sidebar buffers edits locally and only calls the update API on
    an explicit "Save changes" / discards on "Discard" — closing the
    sidebar (or switching to a different card) with unsaved changes
    prompts for confirmation.
  - Wires (SVG paths) connect real measured DOM anchor points (each
    card's top/bottom dot), not hand-computed coordinates — this is
    important; see §7 for why an *approximate* version of this caused a
    real production crash.
- **Search** (`SearchPanel.jsx` + `server/src/routes/search.js`) —
  field-scoped (khatiya number, plot number, deed number, purchaser/
  seller name, mouja, etc.) or all-fields (`$text` index), optionally
  scoped to the current workspace, paginated.
- **Lineage view** (`LineageGraph.jsx`) — a read-only version of the same
  graph, with a detail panel showing a selected deed's full ancestor/
  descendant chain (not just immediate parent/child).
- **Excel export** (`server/src/routes/export.js`) — exports a whole
  workspace's deed graph to a `.xlsx`, including each deed's root
  ancestor(s) (deeds with no incoming edges, walked recursively — this
  is the function with the cycle guard mentioned in §3).

---

## 5. Design system — dark "data-flow" theme

The visual direction was deliberately chosen to avoid the generic "dark
dashboard, one neon accent" look that's the default for node-graph UIs —
instead it's grounded in the actual subject matter (a land-deed *ledger*).

**Color tokens** (add to `tailwind.config.js` under `theme.extend.colors`
if not already present — check the current file first, this may already
be implemented):
```js
colors: {
  canvas: "#12151a",                          // page/canvas background
  surface: { DEFAULT: "#1b2027", raised: "#20262e" },  // cards, panels, toolbar
  border: { DEFAULT: "#2b323c", strong: "#3a4350" },
  ink: { DEFAULT: "#e9e6dc", muted: "#8d94a3", faint: "#5c6373" },
  brass: { DEFAULT: "#c98a3b", soft: "#a9723a" },       // flow wires, primary actions,
                                                          // "not yet committed" state
  verdigris: "#4f9a8c",                       // selection state — deliberately
                                                // distinct from brass
  brick: "#b2543f",                           // destructive actions
},
fontFamily: {
  serif: ["Fraunces", "ui-serif", "Georgia", "serif"],  // deed numbers, headings
  sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],  // everything else
},
```
Fonts load via Google Fonts `<link>` tags in `index.html` (Fraunces
weights 400/500/600, Inter weights 400/500/600).

**Design language**:
- Deep ink-charcoal canvas, not pure black. Warm off-white text, not pure
  white.
- Fraunces (serif) for deed numbers and section headings — a nod to the
  legal/ledger feel of the domain. Inter (sans) for all other UI chrome.
  Don't use serif for buttons, labels, or body text — keep that contrast
  intentional and consistent.
- Brass/ochre (evokes a deed seal / ink stamp) is the "flow" color:
  connector wires, primary action buttons, and — semantically tied
  together — the left accent bar on any card/state that represents
  something *not yet committed* (an unsaved draft deed, a pending
  unconfirmed relationship). This is a deliberate semantic thread; don't
  break it by using brass for something already-saved/committed.
- Verdigris (muted teal, evokes aged copper) means *currently selected*.
  Keep it reserved for that meaning specifically — don't reuse it for
  "pending" or "in progress," which would blur the two concepts.
- Brick red for destructive actions only (delete).
- Connector wires: draw a second, wider/blurred/translucent copy of each
  path underneath the real stroke for a soft glow effect. Saved edges
  use `brass-soft` (slightly duller); pending/unsaved edges use full
  `brass` with a dashed stroke — both from the same color family
  (deliberate restraint — don't introduce a third hue just to
  distinguish saved vs. pending).
- Card left accent bar: implemented as a `before:` pseudo-element (not a
  real DOM node) — 2.5px wide, rounded, inset from the card's top/bottom
  edges. Color per the brass/verdigris/faint logic above.
- SVG `stroke`/`fill` colors should be hardcoded hex (matching the
  `tailwind.config.js` values exactly) rather than Tailwind utility
  classes, since SVG presentation attributes don't take Tailwind classes
  the same way DOM elements do. Keep a small set of named constants at
  the top of any file that draws SVG (see existing `Canvas.jsx`/
  `LineageGraph.jsx` for the pattern) rather than repeating hex literals
  inline.
- Canvas background: a subtle repeating dot grid (`radial-gradient`,
  ~26px spacing, using the `border` color at low visibility) rather than
  a flat fill — gives the canvas some texture without being loud.

This theme (colors, fonts, and the component-level styling built from
them) may already be substantially or fully implemented in the uploaded
codebase — check `tailwind.config.js`, `index.html`, and the component
files before assuming this is greenfield work. If it's already there,
this section is a reference for staying consistent with it, not a
to-do list.

---

## 6. Important architectural decisions (and why — don't undo these
   without a good reason)

- **Editing happens in a sidebar, not inline on the canvas card.** An
  earlier version let cards expand in place for editing; this caused
  layout/overlap bugs with the auto-arranging graph. Moving editing to a
  fixed-position sidebar (`DeedSidebar.jsx`) fixed the class of bug
  entirely rather than patching around it.
- **New deeds/relationships are staged client-side as drafts** and only
  sent to the server on explicit save, as one atomic batch. This is
  intentional (lets a user build out several new deeds and links before
  committing) — don't change this to save-on-every-keystroke or
  save-per-item without discussing it first, it changes the UX
  significantly.
- **Wire endpoints are measured from real DOM anchor points**
  (`getBoundingClientRect()` on small dot elements at each card's
  top/bottom center), not computed from card position + assumed
  dimensions. This was a deliberate fix for a real bug (wires not
  touching cards when dimensions were hand-guessed) — if you're adding
  any new connector-drawing code, follow this same measure-don't-guess
  pattern.
- **Measured coordinates must be rounded before being compared for
  equality**, and if they're read from inside a CSS `transform:
  scale()` container, they must be divided back out by the scale factor.
  This is not optional polish — skipping either one caused a real
  production crash (`Maximum update depth exceeded`, a React render
  loop). Full story: `getBoundingClientRect()` on an element inside a
  scaled container can return slightly different floating-point values
  across otherwise-identical measurements (subpixel rounding in the
  transform matrix, worse under non-100% OS display scaling). Code that
  compares two such measurements with exact `!==` to decide whether to
  re-render will occasionally see a false "changed," update state,
  which triggers a `ResizeObserver` (if one's watching), which
  re-measures, which finds another tiny false difference, forever. The
  fix is to round to a coarse-enough grain (half-pixel has worked) that
  subpixel noise can't register as a change, *and* to make sure any
  comparison is happening in a consistent coordinate space (i.e.
  descaled, if measuring inside a zoomed/scaled container). If you add
  any new `useLayoutEffect`/`ResizeObserver` combination that measures
  DOM elements and calls `setState` based on the result, apply this same
  pattern from the start.
- **The deed-list endpoint is deliberately unpaginated.** The canvas/
  lineage view needs the complete graph to lay out and render correctly
  — paginating it would silently hide deeds from the graph. (Workspace
  list and search *are* paginated; this is a conscious, not-forgotten
  exception.)
- **Cycle prevention is server-side, not client-side** — the client
  doesn't pre-validate a new relationship won't form a cycle; it just
  submits, and the server's BFS check is authoritative (rejects with an
  error the client surfaces). Keep it this way — duplicating that graph
  logic client-side would be a maintenance burden for no real benefit
  given how infrequently it's actually hit.
- **Regex-based search input must be escaped.** Field-scoped search
  builds a MongoDB `RegExp` from raw user input. This domain's data
  (khatiya numbers, decimal areas, plot notations) routinely contains
  characters that are regex-special (`.`, `(`, `)`, `+`, `[`, `]`, etc.)
  — escape them before constructing the `RegExp`, or search will throw
  on realistic, valid inputs (this was a real bug, already fixed — if
  you add any other free-text-to-regex search path, apply the same
  escaping).

---

## 7. Bug history worth knowing (to avoid regressions)

These are all already fixed in the codebase as uploaded, but are worth
knowing about so equivalent mistakes aren't reintroduced elsewhere:

1. A render-loop crash (`Maximum update depth exceeded`) from putting
   two pieces of derived state in one `useLayoutEffect` where one's
   output fed the other's input — fixed by splitting into two effects
   with no circular dependency, *and* (found later, see next item) by
   fixing the underlying float-comparison issue too.
2. The same crash recurred after the above fix, because the equality
   guards used exact float comparison on `getBoundingClientRect()`
   values measured inside a scaled container — see §6's detailed
   writeup, this is the most subtle/important lesson in this whole repo.
3. Field-scoped search 500'd on inputs containing regex metacharacters
   — fixed by escaping before constructing the `RegExp`.
4. The Excel export's recursive root-ancestor walk had no cycle guard —
   structurally unreachable via normal use (cycles are rejected at
   write time) but would stack-overflow on inconsistent data. Fixed
   with a `visiting`-set guard.
5. Wire endpoints computed from hand-guessed pixel coordinates instead
   of measured DOM positions didn't actually touch the cards they were
   meant to connect to — fixed by measuring real anchor points instead.

---

## 8. What "complete" means — scope for this build

**In scope / please build:**
- Everything in §4 working correctly end-to-end, live-tested in a real
  browser against a real MongoDB instance (this has not yet happened —
  the app has had a few live test attempts, each of which surfaced a
  real bug before the full feature set could be exercised; treat
  anything not explicitly confirmed working as "should work" rather
  than "definitely works" until you've verified it yourself).
- The dark "data-flow" design system from §5, applied consistently
  across every screen (workspace list, canvas, sidebar, search,
  lineage view) — not just the canvas.
- Fix any bugs you find during your own testing pass, especially
  anything in the same family as §7's history (float/DOM-measurement
  issues, unescaped user input reaching a regex/query, unguarded
  recursion on graph data).

**Explicitly out of scope unless you're told otherwise:**
- **Authentication/authorization** — deliberately deferred, this is a
  single-user tool as currently scoped. Don't add login/accounts
  speculatively.
- **Deployment/hosting configuration** (Dockerfile, CI, production
  server setup) — deliberately deprioritized so far, not forgotten.
  Only build this if asked.
- **Bulk import** from the old Firebase version — never requested.
- **Format validation** beyond deed-number-required — the free-text
  fields are free-text on purpose (see §3).

**If you're unsure whether something is in scope**, err toward asking
rather than building it speculatively — this project has a habit of
deliberately deferring things (auth, deployment) rather than forgetting
them, so "it's not implemented yet" doesn't always mean "please add it."

---

## 9. Environment setup

`server/.env` (copy from `server/.env.example`, fill in real values):
```
MONGODB_URI=<your MongoDB Atlas connection string>
PORT=<server port>
```
`client` dev server proxies `/api` requests to the server — see
`client/vite.config.js` for the exact port it expects the server on.

Standard install/run:
```
cd server && npm install && npm run dev
cd client && npm install && npm run dev
```
