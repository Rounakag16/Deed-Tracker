# CHAT_STATE.md

## Current Objective

Same chat, direct codebase access via re-uploaded zip, diff-delivery
workflow. After diff `0012` shipped (sidebar redesign), the user
live-tested it and hit a hard crash on load: blank page, console showing
React's "Maximum update depth exceeded" pointing at `Canvas.jsx`'s
`setAnchors` call inside the anchor-measurement `useLayoutEffect`. This
turn (diff `0013`) is that crash fix.

## Work Completed In This Chat

**Diffs `0011`/`0012`** (previous turns, recap): row-overlap fix + PUT
hardening, then the full sidebar redesign moving deed editing off the
canvas card. See those diffs and `PROJECT_CONTEXT.md` for detail.

**Diff `0013`** (this turn): fixed the render-loop crash the user hit
immediately after applying `0012`. Root cause, found by reading (no live
repro was needed or possible - see Debugging Already Done): diff `0011`
put `recomputeCardHeights` (which calls `setCardHeights`) inside the same
`useLayoutEffect` as `recomputeAnchors`, and keyed that effect on
`autoPositions` - a value *derived from* `cardHeights` via a `useMemo`.
That's a self-feeding effect: every `cardHeights` update produces a new
`autoPositions` reference, which re-runs the effect, which can produce
another `cardHeights` update. The existing equality guards
(`heightsEqual`/`anchorsEqual`) catch *spurious* re-fires where nothing
really changed, but not a case where successive real DOM measurements
legitimately differ from pass to pass (which is exactly what a growing/
shrinking row does, by construction, while it's still stabilizing) - so
in practice this became a genuine infinite loop, not just an inefficient
one.

Fix: split the one effect into two. `recomputeAnchors` keeps reacting to
`autoPositions` changing (still needed - wires must follow rows that
grew/shrank). `recomputeCardHeights` moved to its own effect keyed only on
`allKeys` (fires on mount and when cards are added/removed) - it no
longer has any dependency on its own derived output, so the cycle is now
structurally impossible, not just guarded against. The `ResizeObserver`
effect (unchanged) still independently catches a genuine size change to
an *existing* card via the browser's native resize signal, which carries
no React-dependency-cycle risk either way, so nothing was lost by
narrowing the `useLayoutEffect`'s trigger.

Also added a `[FIXED]` entry to `PROJECT_CONTEXT.md`'s Known Issues
explaining this, since the fix comment in `Canvas.jsx` itself references
it.

## Files Changed (diff `0013`)

- `client/src/components/Canvas.jsx` - split the coupled
  `useLayoutEffect` into two independent ones (see above). No other
  changes.
- `PROJECT_CONTEXT.md` - new Known Issues entry.

Everything else is unchanged from diff `0012`'s state.

## Current Implementation State

Diffs `0001`-`0010` remain confirmed live-working (the user's `0012`
bug report was specific to the new sidebar-era code, not a regression in
anything from `0009`/`0010`). Diff `0011`'s actual row-height-growing
logic was never confirmed live working in isolation (superseded by `0012`
before that retest happened) - not a concern on its own since `0012`
made most of that logic dormant anyway (fixed-height cards rarely
exercise it), but worth remembering if a future bug ever traces back into
`autoPositions`/`rowLayoutHeight`. Diff `0012` is now confirmed live in
the sense that the user actually ran it and hit a real, specific,
reproducible bug (good - that's a stronger signal than another round of
static review would give). Diff `0013` (this turn) is, like every prior
diff, only statically verified in this sandbox (syntax check +
`git apply --check` in sequence) - genuinely uncertain until the user
retests, though this fix eliminates the cycle structurally rather than
patching around a symptom, so confidence is higher than usual for an
unverified fix.

## Problems / Errors

1. **[Fixed by diff `0013`, not yet re-tested]** "Maximum update depth
   exceeded" crash on load after applying diff `0012` - see Work
   Completed above for the root cause and fix.
2. The unidentified benign `404` from the very first live test (mentioned
   in earlier `CHAT_STATE.md` revisions) is still unaddressed - no update
   this turn either, still only worth investigating if it recurs
   independently and is reported again.

## Debugging Already Done

The user's report included the exact browser console stack trace, which
was enough to pinpoint the bug without needing a live repro: the trace
showed `dispatchSetState` originating at `Canvas.jsx:231` (the `setAnchors`
call inside `recomputeAnchors`) called from `Canvas.jsx:249` (the
`useLayoutEffect` body that invokes it) - i.e. the *anchors* update was
what React flagged as looping, not the card-heights update directly. That
pointed straight at the effect's dependency array rather than at
`recomputeAnchors`'s own logic (unchanged since diff `0010`, not touched
by `0011`/`0012`). From there, tracing what changed about that effect
between `0010` and `0011` (its dependency swapped from the stable
`positions` memo to the `cardHeights`-derived `autoPositions` memo, and
`recomputeCardHeights` got folded into the same effect body) was enough
to identify the exact cycle without running anything. This is a good
example of why sending the full console stack trace (not just "it
crashed") is valuable - it turned what could've been a guessing exercise
into a precise fix.

## Important Decisions Made

No new architectural decisions this turn - this is a bug fix within the
architecture `0011`/`0012` already established (see `PROJECT_CONTEXT.md`'s
Important Decisions for those). Worth noting for a future session: this
is the *second* time a `useLayoutEffect`/`ResizeObserver` measurement
loop has caused a real production crash in this file (diff `0010` fixed
the first one, a different mechanism - unbounded content-box growth, not
a measurement cycle). If a third one shows up, it's worth stepping back
and asking whether `Canvas.jsx`'s DOM-measurement architecture as a whole
needs a more defensive pattern (e.g. a shared "stabilization" utility with
an iteration cap) rather than fixing each cycle ad hoc as it's found -
not warranted yet after two, but worth flagging if a pattern continues.

## Current Code/Architecture Considerations

- **Two separate `useLayoutEffect`s for `recomputeAnchors` and
  `recomputeCardHeights` is now load-bearing, not a style choice** - see
  the comment in `Canvas.jsx` and the Known Issues entry in
  `PROJECT_CONTEXT.md`. Do not merge them back into one effect keyed on
  `autoPositions` without re-deriving why that's unsafe (see Work
  Completed above).
- Still no live browser/network/MongoDB access in this sandbox - unchanged
  constraint, carried over from every prior turn.
- The scratch working copies for this chat
  (`/home/claude/work/DeedTracker`, `/tmp/patchrepo3`) are local to this
  sandbox and won't persist to a future chat.

## Pending Work

- **Re-test live**, starting with just confirming the app loads without
  crashing at all (the immediate regression this diff fixes), then
  resuming the sidebar-flow smoke test from diff `0012`'s hand-off (add a
  deed → sidebar opens automatically → edit/switch-cards confirmation →
  save persists → delete closes sidebar → canvas never visibly
  resizes/reflows → pan/zoom/scroll work with sidebar open), then the
  original checklist pending since diff `0009` (relationships/cycles,
  Search, Lineage/View, Excel export).
- Authentication (explicitly deferred, only add if asked).
- Deployment/hosting setup (none exists).
- Bulk import from the old Firebase version (never requested).
- Format validation beyond deed number (not requested).
- The unidentified benign 404 from the first live test - only worth
  investigating if it recurs independently.

## Exact Next Steps

1. Present diff `0013` (crash fix, bundled with the `PROJECT_CONTEXT.md`
   Known Issues update) with exact `git apply`/`git add -A`/`git commit`/
   `git push` instructions, noting it applies after `0011` and `0012`.
2. Ask the user to confirm the app loads without crashing, then resume
   the sidebar-flow smoke test from diff `0012`'s hand-off.
3. Whatever breaks next, get the exact error/behavior (ideally with the
   full console stack trace again, like this turn - it made this fix much
   faster and more precise than a guess would have been) and fix it as
   diff `0014`.
4. Once smoke-tested clean, return to the open backlog (auth, deployment,
   bulk import) only as the user prioritizes it.

## User Requirements For The Current Task

- Always deliver changes as `.diff` files (git-apply-able), never full
  file rewrites, never assume Claude Code / direct repo access.
- Keep diff numbering sequential and continuous across the whole project
  (currently through `0013`).
- Give exact shell commands for applying each diff every time.
- `CHAT_STATE.md` should stay narrowly conversation-focused, not a
  restatement of `PROJECT_CONTEXT.md`.
- Keep `PROJECT_CONTEXT.md` and `CHAT_STATE.md` updated side-by-side with
  each improvement/build going forward, not just at session handoff.
