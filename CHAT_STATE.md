# CHAT_STATE.md

## Current Objective

Same session as diffs `0014` (search/export fixes) and `0015` (dark
redesign) - see PROJECT_CONTEXT.md for the decisions that framed the
whole session. This entry covers diff `0016`: the user ran the app live
for the first time this session (after applying `0013`-`0015`) and hit a
real crash with a full console stack trace - the first genuine live bug
report of this session, and only the third live test attempt in the
project's history. Diagnosed and fixed; not yet re-confirmed live.

## Work Completed In This Chat

**Diffs `0014` and `0015`** - already delivered, see PROJECT_CONTEXT.md.

**Diff `0016` - fixed a live-reported crash**: the user pasted a full
console stack trace showing "Maximum update depth exceeded" crashing
`<Canvas>`, pointing at `Canvas.jsx:240` and `:272` - the exact same
effect diff `0013` was supposed to have fixed. Confirmed diff `0015`
didn't touch that code at all (no logic in the redesign, only the parts
above/below it), so this isn't a regression from the restyle - it's
diff `0013`'s fix getting its first-ever live test, this session, and
turning out to be incomplete.

Root cause: `heightsEqual`/`anchorsEqual` (the equality guards diff
`0013` added) compare `getBoundingClientRect()` floats with exact `!==`.
Elements inside `contentRef`'s `transform: scale(zoom)` can report
slightly different floats across otherwise-identical measurements
(subpixel rounding in the transform matrix, worse under non-100% OS
display scaling - plausible here since the user's `node_modules` is a
Windows install). A measurement that isn't really different still fails
the exact-equality check, triggers `setState`, gets picked back up by the
`ResizeObserver`, and the loop that diff `0013`'s structural fix was
supposed to prevent comes back through a different door.

Fix: round every measured coordinate/height to the nearest half-pixel
before storing/comparing, in both `recomputeAnchors` and
`recomputeCardHeights`. While fixing this, also found and fixed a real
(separate, non-crash) bug: `recomputeAnchors` never divided its
post-transform measurements back out by `zoom`, so wires would visually
drift out of position at any zoom other than 100% - applied the same
divide-by-zoom fix to `recomputeCardHeights` too, since it feeds the same
unscaled layout math. Verified with a standalone script confirming the
rounding collapses realistic subpixel-jitter pairs and that dividing a
scaled measurement by zoom recovers the true value - not a live repro,
since this sandbox still can't run a browser (see the build-tooling note
from diff `0015`'s session in PROJECT_CONTEXT.md).

The other line in the user's paste - `Failed to load resource: ... 400
(Bad Request)` - wasn't addressed, because there's not enough information
to diagnose it yet (no request URL or response body visible in what was
pasted). Left as an open question - see Exact Next Steps.

## Files Changed (diff `0016`)

`client/src/components/Canvas.jsx` (the `recomputeAnchors`/
`recomputeCardHeights` functions only), plus `PROJECT_CONTEXT.md`.

## Current Implementation State

Diffs `0001`-`0015` unchanged. Diff `0016` is a narrow, two-function fix
inside `Canvas.jsx` - no other file touched. Still unverified in an
actual browser (same sandbox constraint as `0015`), but grounded in a
concrete, well-understood failure mode (subpixel float jitter defeating
an exact-equality guard on a `transform`-scaled element), not a guess.

## Problems / Errors

**Open**: the `400 (Bad Request)` line from the user's paste - need the
actual request URL and response body (browser Network tab) to diagnose.
Could be unrelated to the crash, or could be a symptom of something else
entirely. Not blocking - ask for it on the next turn if it's still
happening once the crash fix is confirmed.

## Debugging Already Done

See "Diff `0016` - fixed a live-reported crash" under Work Completed
above for the full root-cause chain and fix.

## Important Decisions Made

See PROJECT_CONTEXT.md's Important Decisions for the lasting ones from
this session (visual direction, color/font tokens, audit-before-redesign
ordering). No new lasting decisions in diff `0016` - it's a bug fix.

## Current Code/Architecture Considerations

- `recomputeAnchors` and `recomputeCardHeights` now both take `zoom` as a
  dependency (previously `recomputeCardHeights` had an empty dep array).
  This means both re-run on zoom changes, which is harmless/idempotent -
  the descaled value converges to the same true measurement regardless of
  zoom level, so the equality guard bails out once it settles.
- The half-pixel rounding grain (`Math.round(n * 2) / 2`) was a judgment
  call - fine enough that misaligned wires won't be visible, coarse
  enough to absorb realistic subpixel jitter. If a live test somehow
  still shows the crash, this grain is the first thing to widen (e.g. to
  whole pixels) before looking elsewhere.
- Still no live browser/network/MongoDB/build access in this sandbox -
  unchanged constraint, carried over from every prior session.
- The scratch working copy for this chat (`/home/claude/work/DeedTracker`)
  is local to this sandbox and won't persist to a future chat.

## Pending Work

- **Live re-test is now more important than ever** - three separate
  fixes (`0013`, `0014`, `0016`) and one full redesign (`0015`) are all
  still unconfirmed in an actual browser. Priority order for the next
  live attempt: does the app load without crashing at all (the thing
  diff `0016` targets); does the dark redesign render as intended; then
  the functional smoke-test checklist pending since diff `0009`
  (relationships/cycles, Search, Lineage/View, Excel export).
- **The 400 Bad Request** - need the request URL + response body to
  diagnose; ask for it if it's still happening after the crash fix.
- Authentication (explicitly deferred, only add if asked).
- Deployment/hosting setup (explicitly deprioritized - "we have a lot of
  time").
- Bulk import from the old Firebase version (never requested).
- Format validation beyond deed number (not requested).
- The unidentified benign 404 from the first live test, several sessions
  ago (only worth investigating if it recurs independently and is
  reported again - distinct from this session's 400, different status
  code).

## Exact Next Steps

1. Present diff `0016` with exact `git apply`/`git add -A`/`git commit`/
   `git push` instructions, noting it applies after `0015`.
2. Ask the user to retest live and, if the 400 is still happening, get
   the request URL and response body from the browser's Network tab.
3. Continue down the pending smoke-test checklist as reports come in -
   same "send the exact console stack trace" pattern that made this fix
   fast and precise (found the exact two lines immediately, no guessing).

## User Requirements For The Current Task

- Always deliver changes as `.diff` files (git-apply-able), never full
  file rewrites, never assume Claude Code / direct repo access.
- Keep diff numbering sequential and continuous across the whole project
  (currently through `0016`).
- Give exact shell commands for applying each diff every time.
- `CHAT_STATE.md` should stay narrowly conversation-focused, not a
  restatement of `PROJECT_CONTEXT.md`.
- Keep `PROJECT_CONTEXT.md` and `CHAT_STATE.md` updated side-by-side with
  each improvement/build going forward, not just at session handoff.
- Visual direction: dark "data-flow" redesign (see PROJECT_CONTEXT.md) -
  delivered in diff `0015`, functionality must be preserved (explicit
  ask before `0015` started, reaffirmed implicitly by this crash report
  since the user is actively trying to run the real app).
- Priority: audit/fix before redesign (done); deployment deprioritized
  for now.
