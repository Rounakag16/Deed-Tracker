# CHAT_STATE.md

## Current Objective

The user uploaded the whole repo as a zip into a **fresh chat with direct
codebase access** (not the diff-only chat-tier workflow this file was
written under) and asked whether the full original project scope was
built. Answer: yes, functionally - see `PROJECT_CONTEXT.md`'s "Current
Project Status". They then asked to fix the outstanding hardening items
*before* the first live end-to-end test - that was diff `0009`, **confirmed
applied**, and the user did the first-ever live run against a real
MongoDB: server connected fine, but the canvas crashed with a React
"Maximum update depth exceeded" error when a card was positioned near the
canvas boundary. Diff `0010` below fixes that. Live testing is still
in progress - this is the first real bug found, not the only one expected.

## Work Completed In This Chat

Chronological, as delivered diffs `0001`-`0008` (see Files Changed below
for exact repo mapping):

1. **Initial MERN scaffold** - rewrote the original Firebase/tree-based app
   from scratch as workspaces + deed graph + search + Excel export,
   preserving the original deed field schema.
2. **Bug fix**: saved-deed edits were firing a PUT + full reload on every
   keystroke (cursor-jumping, unusable typing). Fixed by adding local edit
   buffering with explicit Save/Discard in `DeedCard.jsx`.
3. **Lineage graph tab** - first version, SVG diagram, auto-layout,
   left-to-right at this point.
4. **Lineage detail panel** - click a node, see full deed fields + clickable
   parent/child lists.
5. **Node-editor canvas rebuild** - replaced click-to-select connecting
   with true drag-from-dot-to-dot wiring, matching a reference screenshot
   (GitHub-Actions-style workflow diagram) the user provided. Switched
   layout from left-to-right to **top-to-bottom** to match that reference.
   Extracted shared layout math into `client/src/layout.js` so the edit
   canvas and the read-only Lineage view stay visually identical. Added
   the "View" button (opens read-only Lineage). Removed the earlier
   "Add 5 Deeds" shortcut per request.
   - Caught and fixed a bug **before shipping** it: pending-edge
     click-to-delete used `pendingEdges.indexOf(edgeObject)` on a freshly
     spread copy, which always returns -1. Fixed by tagging each pending
     edge with `pendingIndex` at map time.
6. **Free-drag card positioning** - cards can now be dragged anywhere;
   position persists per-deed (`Deed.position: {x,y}`) immediately on
   drop for saved deeds, held in draft state for unsaved ones. Added
   "Reset Layout" to clear manual positions back to auto-arrange.
7. **Completion pass** (duplicate deed-number warning banner, workspace
   rename UI wired to the already-existing PATCH endpoint, search results
   made clickable and jump into the Lineage view with cross-workspace
   switching if needed). Added `GET /api/workspaces/:id` server route to
   support that workspace switch.
8. **`PROJECT_CONTEXT.md`** written - stable, non-conversational project
   reference (architecture, schema, API, decisions, known issues, etc).
   Do not duplicate its contents here.
9. **Hardening pass** (this chat, direct codebase access):
   - Multi-hop cycle prevention on relationship creation (BFS against
     existing + same-batch edges; all-or-nothing rejection).
   - Server-side validation: `deedInfo.deedNumber` required + non-blank;
     added `asyncHandler.js` + a generic-error-handler upgrade so Mongoose
     `ValidationError`/`CastError` reach the client as clean 400s instead
     of hanging (previously async route errors were unhandled rejections).
   - Search now uses the Mongo `$text` index for `topic=all` (relevance-
     sorted); scoped single-field topics still use regex (a `$text` query
     can't be restricted to one field of a compound text index).
   - Pagination added to `/workspaces` (`{ workspaces, total, page,
     limit }`) and `/search` (`{ results, total, page, limit }`);
     per-workspace deed list left unpaginated on purpose (canvas needs
     the full graph).
   - Canvas: wider viewport (max-w-1800px, viewport-relative max-height),
     pan-by-dragging the background, zoom controls (40%-150%), and cards
     widened 320px->400px (`NODE_W`, kept in sync with `DeedCard.jsx`) to
     fix the land-parcel RS/LR/Area row overflowing the card.
10. **Live-testing bug fix (diff 0010)**: first live run (real MongoDB)
    surfaced a React "Maximum update depth exceeded" crash on `Canvas.jsx`
    when a card sat near/past the canvas's assumed boundary. Root cause:
    the auto-layout math that sizes the canvas's content box only knows
    about auto-arranged card positions, not manually-dragged ones - a
    dragged card past that assumed boundary overflowed the stated content
    box, and the anchor-measurement effect had no guard against
    re-triggering on essentially-unchanged geometry, so the two could
    cascade. Fixed by (a) growing the content box to also cover every
    card's actual `position` (including the live position of a card
    currently mid-drag), and (b) adding an equality check before
    `setAnchors` so a measurement that didn't actually change never
    triggers a re-render.

## Files Changed

Cumulative, across diffs `0001`-`0010` (`0001`-`0009` confirmed applied by
the user to `github.com/Rounakag16/Deed-Tracker`, `main` branch, including
a successful `npm install` + live MongoDB connection on both `0001`-`0009`;
`0010` was generated in response to the bug that live test surfaced -
**confirm with the user it's been applied** before assuming their repo
matches this file):

- `server/src/models/Deed.js` - full deed schema; `position` field added
  in diff 0006; `deedInfo.deedNumber` made required+non-blank in 0009.
- `server/src/models/Relationship.js`, `server/src/models/Workspace.js` -
  unchanged since diff 0001.
- `server/src/routes/workspaces.js` - `GET /:id` added in diff 0007;
  pagination (`page`/`limit` -> `{workspaces,total,page,limit}`) and
  `asyncHandler` wrap added in 0009.
- `server/src/routes/deeds.js` - `asyncHandler` wrap in 0009 (no
  behavior change besides errors now surfacing instead of hanging);
  unchanged since diff 0001 otherwise.
- `server/src/routes/relationships.js` - multi-hop cycle prevention +
  `asyncHandler` wrap added in 0009; unchanged since diff 0001 otherwise.
- `server/src/routes/search.js` - switched `topic=all` to `$text`,
  added pagination, `asyncHandler` wrap - all in 0009; unchanged since
  diff 0001 before that.
- `server/src/routes/export.js` - `asyncHandler` wrap added in 0009
  (no other change).
- `server/src/server.js` - generic error handler upgraded in 0009 to
  translate Mongoose `ValidationError`/`CastError`/duplicate-key errors
  into 400/409s.
- `server/src/utils/asyncHandler.js` - **created** in diff 0009.
- `client/src/layout.js` - **created** in diff 0005 (shared auto-layout
  algorithm), extended with a `direction` param (vertical/horizontal) in
  the same diff; unchanged in 0009.
- `client/src/api.js` - `updateWorkspace`, `getWorkspace` added in diff
  0007; `listWorkspaces`/`search` updated for pagination params/response
  shape in 0009.
- `client/src/App.jsx` - rewritten in diff 0007 to own `selectedDeedId`
  state and cross-workspace search navigation; unchanged in 0009.
- `client/src/components/Canvas.jsx` - rewritten twice before this chat:
  diff 0005 (node editor with drag-to-wire), diff 0006 (card
  drag-to-reposition + Reset Layout), diff 0007 (duplicate deed-number
  banner). Diff 0009 added pan/zoom, widened the viewport and `NODE_W`
  (320->400), and added `data-card-wrapper`/`stopPropagation` so card-drag
  and background-pan don't fight each other. Diff 0010 (bug fix): content
  box now grows to cover manually-positioned/mid-drag cards, and
  `setAnchors` is equality-guarded to stop a measure/render feedback loop
  - see Work Completed #10. Still the largest/most complex file in the
  project.
- `client/src/components/DeedCard.jsx` - edit-buffering fix in diff 0002;
  simplified in diff 0005 to drop the old click-to-select connect-mode
  props; width bumped 320px->400px (`w-[400px]`) in diff 0009 to match
  `Canvas.jsx`'s `NODE_W`.
- `client/src/components/LineageGraph.jsx` - created diff 0003; detail
  panel added diff 0004; refactored to use shared `layout.js` + vertical
  orientation in diff 0005; `onBack`/`initialSelectedId` props added in
  diffs 0005/0007 respectively; untouched in 0009 (its own compact
  `NODE_W=190` is intentionally separate from the editable canvas's).
- `client/src/components/WorkspaceList.jsx` - rename UI added diff 0007;
  pagination controls (Prev/Next) added in 0009.
- `client/src/components/SearchPanel.jsx` - results made clickable
  (`onSelectDeed` prop) in diff 0007; pagination controls added in 0009.
- `client/src/components/DeedForm.jsx` - unchanged since diff 0001; exports
  `blankDeed()`. (Not edited in 0009 - the card-width bump on the parent
  was enough to fix the overflow, no internal layout change needed.)
- `PROJECT_CONTEXT.md` - created diff 0008; Current Project Status, Known
  Issues, Repository Structure, Database, API, and Major Features sections
  updated in 0009 to match the hardening pass; Known Issues updated again
  in 0010 for the boundary-crash fix.
- `CHAT_STATE.md` - this file; created (uploaded already-existing) as of
  diff 0008's chat, updated with each diff since (0009, 0010).

## Current Implementation State

Diffs `0001`-`0009` are confirmed applied and the server side is confirmed
live-working: `npm install` succeeded on both server/client, and the
server connected to a real MongoDB instance. The client itself crashed on
first real use (see Problems/Errors) - diff `0010` fixes that specific
crash but **has not yet been re-tested live by the user** as of this
writing. Everything else in `PROJECT_CONTEXT.md`'s "Completed" list is
still only statically reviewed (syntax checks, JSX parse checks, manual
tracing), not live-confirmed - treat those as "should work", and the
canvas specifically as "one confirmed crash, fix applied, awaiting
re-test."

## Problems / Errors

1. **[FIXED in diff 0010]** First live run: dragging/positioning a deed
   card near the canvas's boundary crashed the whole `Canvas` component
   with `Uncaught Error: Maximum update depth exceeded` (React's
   nested-update-cascade guard tripping inside the anchor-measurement
   `useLayoutEffect`/`ResizeObserver` combo), which blanked the page.
   Reported by the user with the full browser console stack trace. Root
   cause and fix described in Work Completed #10 above. **Ask the user to
   confirm this is actually resolved after applying 0010** - the fix was
   derived from static analysis of the crash trace, not a live repro in
   this sandbox (no browser/network access here), so treat it as
   "should fix it" rather than "confirmed fixed" until they retest the
   exact scenario (drag a card near/past the canvas edge, including while
   it's expanded).
2. A benign-looking `Failed to load resource: 404` also appeared in the
   console alongside the crash - not yet identified (most likely an
   unrelated favicon/asset request, could also be an artifact of the
   crash itself interrupting the page). Not investigated since it wasn't
   called out as a separate problem by the user; revisit if it recurs
   independently of the crash after 0010.

## Debugging Already Done

Problem #1 above: diagnosed from the user-supplied stack trace alone (
`checkForNestedUpdates` -> `dispatchSetState` at `Canvas.jsx:125`, inside
the anchor-measurement `useLayoutEffect`). Reasoned through the component
tree statically (no live repro available in this sandbox) to find two
compounding issues: (a) the canvas's content-box sizing only accounted for
auto-layout positions, not manual/live-drag ones, so a dragged card could
overflow the stated box; (b) `setAnchors` had no guard against redundant
updates, so any resulting measure/render cycle had no circuit breaker.
Fixed both; not yet confirmed against the user's actual browser.

## Important Decisions Made

(Full rationale already in `PROJECT_CONTEXT.md`'s "Important Decisions" -
listed here only as a pointer, not duplicated.) Relevant ones a next chat
should not re-litigate without cause: graph/DAG model over tree, no
sibling edge type, MongoDB, no auth for v1, vertical top-to-bottom
auto-layout, manual card position saves immediately while everything else
batches on "Save", Canvas and LineageGraph deliberately share one layout
algorithm (but not the same `NODE_W` - LineageGraph's is intentionally
smaller/read-only-compact). New in this chat: the per-workspace deed list
stays unpaginated on purpose (canvas needs the complete graph); a scoped
single-field search topic uses regex rather than `$text` because Mongo's
`$text` can't be restricted to one field of a compound text index.

## Current Code/Architecture Considerations

- **Diff-based delivery is still the established workflow** even though
  this particular chat had direct file access via an uploaded zip (not
  Claude Code) - the user wants changes as git-apply-able `.diff` files
  regardless of how Claude read the code. Diff numbering continues from
  `0008`; currently at `0010`.
- The scratch working copy for this chat is `/home/claude/deed-tracker/
  Deed-Tracker-main` (unzipped from the user's upload, then `git init`'d
  fresh as a baseline commit) - **local to this sandbox, will not exist in
  a new chat**. A future chat should ask the user to re-upload the zip (or
  paste `git diff`/file contents) rather than assume the scratch repo
  persists.
- The user's repo is `github.com/Rounakag16/Deed-Tracker`, `main` branch.
- Diffs `0001`-`0009` are confirmed applied (the user ran `npm install` +
  connected to a live MongoDB successfully on that state). Diff `0010` was
  generated in response to the crash that live test surfaced -
  **not yet confirmed applied or re-tested as of this writing.**
- **No live browser/network access exists in this sandbox** - diff 0010's
  fix was derived entirely from reading the user's pasted stack trace and
  reasoning through the component statically. This is a meaningfully
  weaker verification standard than the rest of the codebase's own static
  checks (syntax/JSX-parse/balance), since a logic bug like a render loop
  can't be fully ruled out without actually running it. Treat 0010 as
  "should fix it" until the user confirms.

## Pending Work

From `PROJECT_CONTEXT.md`'s "Not implemented" / "Partially completed"
lists, still open as of this chat:
- **Re-test the canvas boundary-crash fix (diff 0010) live** - this is the
  immediate next task. Specifically: drag a card near/past the canvas
  edge (both collapsed and expanded), and drag it while zoomed in/out.
- **Continue the end-to-end smoke test** from where diff 0009's crash
  interrupted it (see Exact Next Steps in the previous entry - workspace
  create, deed CRUD incl. blank-deed-number validation, relationship
  wiring incl. cycle rejection, Save/reload persistence, inline edit,
  Excel export, Lineage view, search incl. pagination) - none of that has
  been confirmed yet, the first crash happened early.
- Authentication (explicitly deferred, only add if the user asks)
- Deployment/hosting setup (none exists)
- Bulk import from the old Firebase version's data (never requested, just
  a plausible future ask given the project's origin)
- Format validation beyond deed number (area/plot fields are still free
  text - not requested, noted as a possible future ask)

## Exact Next Steps

1. Present diff `0010` (Canvas.jsx boundary-crash fix, bundled with both
   doc updates) to the user with exact `git apply`/`git add -A`/
   `git commit`/`git push` instructions.
2. Ask the user to re-run the app and specifically retry the crash
   scenario: drag a deed card near/past the canvas edge, both collapsed
   and expanded, and try it at different zoom levels.
3. If that's clean, resume the original smoke-test checklist from diff
   0009's handoff (see Pending Work above) in order, stopping at the first
   thing that breaks: create a workspace → add several deeds (including
   trying to save one with a blank deed number, to confirm the new
   validation error shows cleanly) → drag-wire some converging/diverging
   relationships (including attempting a 3-hop cycle, to confirm it's
   rejected) → drag-reposition a card → try the pan/zoom controls → Save →
   reload and confirm persistence → expand and edit a saved deed (confirm
   no cursor-jump regression) → export to Excel and open the file → open
   the Lineage/View tab → search (both scoped and global, all-topic and
   single-topic, confirm pagination Prev/Next work once results exceed a
   page) and click a result to confirm it navigates correctly → paginate
   the workspace list once there are >20 workspaces (or lower `PAGE_SIZE`
   temporarily to test with fewer).
4. Whatever breaks next, get the **exact error message/behavior** from the
   user and fix it as the next numbered diff (`0011`) - do not guess at
   fixes without a concrete repro/error, the same way 0010 was diagnosed
   from the actual stack trace rather than a guess.
5. Once smoke-tested clean, return to the still-open backlog (auth,
   deployment, bulk import, etc.) only as the user prioritizes them.

## User Requirements For The Current Task

- Always deliver changes as `.diff` files (git-apply-able), never full
  file rewrites, never assume Claude Code / direct repo access - free
  tier, chat only, no other tools available to the user for applying
  changes besides `git apply`.
- Keep diff numbering sequential and continuous across the whole project
  (currently through `0010`).
- Give exact shell commands for applying each diff every time (the user
  has been running the same `git apply` / `git add -A` / `git commit` /
  `git push` sequence throughout).
- `CHAT_STATE.md` should stay narrowly conversation-focused, not a
  restatement of `PROJECT_CONTEXT.md` - avoid duplicating stable project
  facts here in future updates to this file.
- (This chat) Keep `PROJECT_CONTEXT.md` and `CHAT_STATE.md` updated
  side-by-side with each improvement/build going forward, not just at
  session handoff.
