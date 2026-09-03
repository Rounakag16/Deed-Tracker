# CHAT_STATE.md

## Current Objective

Fresh chat, again with direct codebase access (a re-uploaded zip, not
Claude Code) - the user asked to read the whole project + git history +
prior chat state, then fix current bugs/issues and keep building toward
the end goal. This chat's zip was diff `0010`'s state (confirmed: the
working tree matched `HEAD` exactly except for CRLF line-ending noise
introduced by the user's local Windows checkout, and a leftover
`0010-canvas-boundary-crash-fix.diff` file that had already been applied
and could be deleted). No new live-testing has happened since diff `0010`
was generated - this chat is still static-review-only (see Current
Code/Architecture Considerations).

This chat produced diff `0011`, delivered below.

## Work Completed In This Chat

1. **Read the full repo, `git log`, and both hand-off docs** before
   touching anything. Confirmed via `git diff --stat -w` that the
   uploaded zip's working tree matched commit `247853a` (diff `0010`)
   exactly aside from CRLF noise - i.e. diff `0010` is applied and
   committed, contrary to the prior chat's uncertainty about that.
2. **Attempted to actually run the app** (not just statically review it)
   since this chat had direct file access: `node_modules` were present for
   both `client` and `server`, but they were installed on Windows
   (`@esbuild/win32-x64`, `@rollup/rollup-win32-x64-msvc` etc., no Linux
   binaries) and this sandbox has no network access to fetch Linux
   equivalents or to install/run MongoDB - so `vite build`, `esbuild`, and
   any real client build all failed at the native-binary-resolution step.
   Fell back to `@babel/parser` (pure JS, no native binary) to
   syntax-check every client `.js`/`.jsx` file, and `node --check` for
   every server file - all clean. This is a weaker check than a real build
   (catches syntax errors, not type/logic bugs) but is strictly better
   than the pure manual-reading review prior chats were limited to.
3. **Fixed the Known Issues row-overlap bug** (`client/src/components/Canvas.jsx`):
   an expanded (mid-edit) card could visually overlap the card below it in
   the same auto-layout row, because row spacing used a fixed height
   estimate (`NODE_H_ESTIMATE`) instead of the card's real (much taller)
   expanded height. Fixed by extending the existing DOM-measurement
   pattern (the same one `recomputeAnchors`/`ResizeObserver` already use
   for wire endpoints) to also measure each auto-positioned card's actual
   rendered height (`cardHeights` state, `recomputeCardHeights`
   callback), then computing per-row spacing from the tallest card
   actually measured in that row instead of the fixed estimate. Manually
   positioned/mid-drag cards are excluded from the row-height calculation
   since they don't live in an auto-layout row. Same equality-guard
   pattern as the existing anchor measurement (`heightsEqual`, mirroring
   `anchorsEqual`) to avoid reintroducing the "Maximum update depth
   exceeded" render-loop class of bug that diff `0010` fixed - reasoned
   through carefully since there's no live browser here to catch a
   render-loop regression by just running it.
4. **Small server hardening pass** (`server/src/routes/deeds.js`), found
   during the same read-through:
   - Fixed a stale comment on the deed-creation route that said
     `insertMany` runs `ordered:false` when the code actually (and
     correctly) uses `ordered:true` - no behavior change, just corrected
     the comment to match the code and explain why `ordered:true` matters
     here (all-or-nothing batch validation, which `Canvas.jsx`'s
     `handleSaveAll` already assumes when it maps `created[i]` back onto
     `draftDeeds` by index).
   - The PUT deed route now strips `_id`/`__v`/`createdAt`/`updatedAt`/
     `workspaceId` from the request body server-side before `$set`. The
     client already does this (`Canvas.jsx`'s `onSave`), but that was only
     a client-side courtesy - a stray or old client build could otherwise
     move a deed to a different workspace or overwrite its id via the PUT
     body. Defense-in-depth, not a live bug report.
5. **Reviewed every other file for correctness** (`App.jsx`, `api.js`,
   `DeedCard.jsx`, `DeedForm.jsx`, `LineageGraph.jsx`, `SearchPanel.jsx`,
   `WorkspaceList.jsx`, `search.js`, `relationships.js`, `export.js`,
   `workspaces.js`, `server.js`, both Mongoose models) - traced the cycle
   BFS logic, the search pagination/text-index branching, the
   edit-buffering pattern, the Save/id-resolution flow, and the Lineage
   view's key handling. No further bugs found; nothing else changed.
6. **`PROJECT_CONTEXT.md`**: marked the row-overlap Known Issue `[FIXED]`
   with the fix description above; added a one-line note to the PUT-deed
   API row about the new server-side field-stripping.

## Files Changed

- `client/src/components/Canvas.jsx` - row-overlap fix (see #3 above):
  new `cardHeights` state + `recomputeCardHeights` callback +
  `heightsEqual` guard; `layerById` pulled out into its own memo so it's
  shared between the position calculation and the new row-height
  calculation; `positions`/`layoutHeight` (fixed-estimate) replaced by
  `autoPositions`/`rowLayoutHeight` (row-aware) everywhere they were used
  (`resolvedPos`, the content-box-growing memo from diff `0010`, the
  anchor-measurement effect's dependency array).
- `server/src/routes/deeds.js` - comment fix on POST (no behavior
  change) + PUT now strips protected fields from the body server-side
  (see #4 above).
- `PROJECT_CONTEXT.md` - Known Issues + API table updated to match.
- `CHAT_STATE.md` - this file, rewritten for this chat.

Everything else in the repo (`server/src/models/*`, `server/src/routes/{workspaces,relationships,search,export}.js`,
`server/src/server.js`, `server/src/utils/*`, and every other `client/src`
file) is unchanged from diff `0010`'s state.

## Current Implementation State

Same live-testing status as before this chat: diffs `0001`-`0009` are
confirmed applied and server-side confirmed live-working (real MongoDB
connection); diff `0010`'s crash fix and this chat's diff `0011` are both
**only statically reviewed** (syntax-checked via `@babel/parser`/`node
--check`, and diff `0011`'s patch itself was verified to `git apply
--check` cleanly against a pristine copy of `HEAD` in this sandbox) -
neither has been exercised in a real browser against a real MongoDB yet.
The very first live smoke test (diff `0009`'s state) got as far as
"connect to MongoDB, hit the boundary crash" before diff `0010` was
written to fix that crash - the rest of the smoke-test checklist below
has never been run.

## Problems / Errors

1. **[FIXED, not yet re-tested]** Canvas row-overlap - see Work Completed
   #3. Same caveat as everything below: no live browser/MongoDB access in
   this sandbox, so this is "should fix it," not "confirmed fixed."
2. The benign-looking `Failed to load resource: 404` mentioned in the
   previous chat's browser console (alongside the now-fixed boundary
   crash) is still unidentified - not investigated this chat either,
   since it wasn't reported as recurring independently and there's no way
   to reproduce it without a live browser. Revisit if the user sees it
   again after retesting.

## Debugging Already Done

Row-overlap fix (#3 above) was diagnosed directly from `PROJECT_CONTEXT.md`'s
own Known Issues writeup (which already correctly identified the root
cause: fixed-estimate row spacing vs. variable expanded-card height) - not
from a fresh repro, since none is possible here. The fix mirrors the
existing anchor-measurement pattern in the same file as closely as
possible, specifically to avoid introducing a new inconsistent
measurement mechanism, and reuses the exact equality-guard technique
(`heightsEqual`, modeled on the file's own `anchorsEqual`) that fixed the
prior render-loop crash in diff `0010`, to avoid reintroducing that class
of bug.

## Important Decisions Made

No new architectural decisions this chat - see `PROJECT_CONTEXT.md`'s
"Important Decisions" (unchanged) for the full list. The row-overlap fix
is a bug fix within the existing architecture (DOM-measured layout,
shared `layout.js`), not a design change; `LineageGraph.jsx`'s read-only
view intentionally still uses the pure fixed-estimate `layout.js` output
without this row-height adjustment, since it has no inline-expand state to
overlap in the first place - see Current Code/Architecture Considerations.

## Current Code/Architecture Considerations

- **The row-height fix is deliberately Canvas-only, not pushed into the
  shared `layout.js`.** `LineageGraph.jsx` (read-only) never has an
  expanded/mid-edit card, so it has nothing to measure and no overlap
  problem to solve - adding this complexity there would be unused code.
  If a future feature gives the Lineage view its own variable-height
  cards (e.g. an inline preview), revisit whether to lift this into
  `layout.js` properly instead of duplicating it.
- **Still no live browser/network/MongoDB access in this sandbox** -
  identical constraint to the prior chat. This chat did get further than
  pure manual reading by using `@babel/parser`/`node --check` for syntax
  verification and `git apply --check` to verify the diff's mechanical
  correctness, but none of that catches a logic or render-loop bug the
  way actually running the app would. Diff `0011` should be treated with
  the same "should fix it, not confirmed" caveat as diff `0010` was until
  the user retests live.
- **Diff-based delivery remains the workflow** even with this chat's
  direct file access, per the user's standing requirement - continuing
  the numbering from `0010` to `0011`.
- The scratch working copy for this chat is `/home/claude/work/DeedTracker`
  (unzipped from the re-uploaded zip) - local to this sandbox, will not
  exist in a future chat. A future chat should ask for a fresh zip or
  `git diff`/file contents rather than assume this persists.

## Pending Work

- **Re-test live**, resuming exactly where the diff-`0009` smoke test was
  interrupted by the (now-fixed) boundary crash: create a workspace → add
  several deeds (including one with a blank deed number, to confirm
  validation) → drag-wire converging/diverging relationships (including a
  3-hop cycle attempt) → drag-reposition a card → **expand a card to edit
  it while other cards sit in the same auto-layout row, to specifically
  exercise diff `0011`'s row-overlap fix** → try pan/zoom → Save → reload
  and confirm persistence → export to Excel → open the Lineage/View tab →
  search (scoped and global, paginated) and click through.
- Authentication (explicitly deferred, only add if asked).
- Deployment/hosting setup (none exists).
- Bulk import from the old Firebase version (never requested).
- Format validation beyond deed number (not requested).
- The unidentified benign 404 from the first live test (Problems/Errors
  #2) - only worth investigating if it recurs independently.

## Exact Next Steps

1. Present diff `0011` (row-overlap fix + PUT hardening, bundled with the
   doc updates) with exact `git apply`/`git add -A`/`git commit`/
   `git push` instructions.
2. Ask the user to re-run the app and specifically retry: (a) the
   original boundary-crash drag scenario from diff `0010`, to reconfirm
   that's still fixed, and (b) expanding a card that shares an
   auto-layout row with another card, to confirm the row now grows
   instead of overlapping.
3. If that's clean, resume the full smoke-test checklist from Pending
   Work above, stopping at the first thing that breaks.
4. Whatever breaks next, get the exact error/behavior from the user and
   fix it as diff `0012` - do not guess without a concrete repro, same as
   every prior diff in this project.
5. Once smoke-tested clean, return to the open backlog (auth, deployment,
   bulk import) only as the user prioritizes it.

## User Requirements For The Current Task

- Always deliver changes as `.diff` files (git-apply-able), never full
  file rewrites, never assume Claude Code / direct repo access.
- Keep diff numbering sequential and continuous across the whole project
  (currently through `0011`).
- Give exact shell commands for applying each diff every time.
- `CHAT_STATE.md` should stay narrowly conversation-focused, not a
  restatement of `PROJECT_CONTEXT.md`.
- Keep `PROJECT_CONTEXT.md` and `CHAT_STATE.md` updated side-by-side with
  each improvement/build going forward, not just at session handoff.
