# CHAT_STATE.md

## Current Objective

Same chat as diff `0011` (direct codebase access via a re-uploaded zip,
still using the diff-delivery workflow per the user's standing
requirement). After `0011` shipped, the user reported it live-tested as
still buggy: clicking a deed card made the canvas shorten (the inline
expand-to-edit behavior resizing/reflowing the canvas), and asked for a
redesign - card details/editing in a sidebar instead, with the canvas
taking the rest of the page and staying independently
scrollable/pannable/zoomable. This turn is that redesign, delivered as
diff `0012`.

## Work Completed In This Chat

**Diff `0011`** (previous turn, recap): row-overlap fix for expanded
cards + PUT-hardening on the deeds route. See the diff file itself and
`PROJECT_CONTEXT.md`'s Known Issues for detail - it's now marked
`[SUPERSEDED]`, not reverted (see below).

**Diff `0012`** (this turn): moved all deed detail/editing off the canvas
card and into a new sidebar, per the user's explicit request. Concretely:

1. **`DeedCard.jsx` rewritten** to a small, fixed-height, stateless
   summary chip (deed number + buyer name, `isSelected` highlight border).
   No more expand/collapse, no buttons, no local edit-buffering state -
   all of that moved out.
2. **New `DeedSidebar.jsx`**: the full `DeedForm` plus Save
   changes/Discard/Delete/Close, for whichever card is currently selected.
   Carries over the exact local-edit-buffering pattern (`localDeed`/`dirty`
   state, re-sync from the `deed` prop only when not dirty) that used to
   live in `DeedCard.jsx` - this pattern is load-bearing (see
   `PROJECT_CONTEXT.md`), only its file moved. Reports its `dirty` state
   up to `Canvas.jsx` via a new `onDirtyChange` prop.
3. **`Canvas.jsx`**:
   - New `selectedKey`/`sidebarDirty` state; `selectedDeed` derived from
     `selectedKey`.
   - `startCardDrag`'s mousedown/mousemove/mouseup handling now
     distinguishes a plain click (mouse never moved past the existing 3px
     jitter threshold) from an actual drag: a click calls a new
     `trySelect(key)` to open the sidebar, instead of (as before) doing
     nothing. A real drag still repositions the card exactly as before -
     unrelated to diff `0010`'s crash fix or `0011`'s row-height fix, both
     of which are untouched and still apply.
   - `trySelect(key)` confirms before switching the sidebar to a
     different card (or closing it, or adding a new draft) if the
     currently-open sidebar has unsaved edits - same `confirm()` pattern
     the file already used for Delete/Reset Layout. Without this, clicking
     a different card while mid-edit on the previous one would have
     silently discarded the edit, since there's only one sidebar instance
     now (unlike the old design, where every card could be independently
     expanded/edited at once).
   - `addDraftDeed`/`removeDraft`/`deleteSavedDeed` updated to manage
     `selectedKey`/`sidebarDirty` alongside their existing responsibilities
     (new draft auto-selects and opens the sidebar, matching the old
     auto-expand-on-add behavior; deleting the selected deed closes the
     sidebar). `deleteSavedDeed` now returns whether it actually deleted
     (the user can cancel the `confirm()`), used for correctness even
     though nothing currently branches on it beyond what's already
     handled internally.
   - JSX layout restructured: `h-full flex flex-col` (toolbar → error/
     banner strip → `flex-1 min-h-0 flex` row containing the scrollable/
     pannable/zoomable canvas pane and, when a card is selected, the
     sidebar). Card rendering in the canvas now renders the compact
     `DeedCard` (no `onChange`/`onSave`/`onDelete` props - those moved to
     the sidebar instance) with `isSelected` for the highlight border, and
     cursor changed from "grab" to "pointer" on idle cards since clicking
     now does something (select) distinct from dragging.
4. **`App.jsx`**: changed to a `h-screen` flex-column layout (nav bar
   `shrink-0`, active tab wrapped in `flex-1 min-h-0 overflow-auto`) so
   the canvas tab can actually fill the remaining viewport height, which
   `Canvas.jsx`'s new `h-full` layout needs. Search/Lineage tabs keep
   working exactly as before - they just scroll within this wrapper now
   instead of the whole page scrolling, no visible difference expected.
5. **`PROJECT_CONTEXT.md`** updated throughout: repository structure
   entry for `DeedCard.jsx`/new `DeedSidebar.jsx`, the Major
   Features/Canvas bullet list, Important Implementation Details (buffering
   pattern's new home + the new `sidebarDirty`/`trySelect` guard),
   Important Decisions (new bullet explaining the redesign and why), the
   anchor-measurement note (no longer motivated by expand/collapse, kept
   anyway), and Known Issues (marked the row-overlap issue `[SUPERSEDED]`
   rather than removing it, with an explanation of why `0011`'s fix was
   left in place instead of ripped out).

## Files Changed (diff `0012`)

- `client/src/App.jsx` - full-height flex layout (see #4 above).
- `client/src/components/Canvas.jsx` - selection state, click-vs-drag
  detection, dirty-guard, JSX layout restructure (see #3 above).
- `client/src/components/DeedCard.jsx` - rewritten to a stateless compact
  chip (see #1 above).
- `client/src/components/DeedSidebar.jsx` - new file (see #2 above).
- `PROJECT_CONTEXT.md` - see #5 above.

Everything else (all server files, `layout.js`, `DeedForm.jsx`,
`LineageGraph.jsx`, `SearchPanel.jsx`, `WorkspaceList.jsx`, `api.js`) is
unchanged from diff `0011`'s state.

## Current Implementation State

Same live-testing status as before, now one layer deeper: diffs
`0001`-`0009` are confirmed applied and were live-tested against a real
MongoDB. Diff `0010` (crash fix) was applied and is now confirmed
indirectly - the user's bug report this turn was about the *expand*
behavior, not a recurrence of the boundary crash, so `0010` appears to
still be holding. Diff `0011` (row-overlap fix) was live-tested implicitly
too, in the sense that the user's report was specifically about the
resulting canvas-shortens behavior it was meant to smooth over - the fix
itself technically worked as designed (rows did grow to fit), but the
*design* it was patching (inline expand at all) is what the user actually
wanted gone, which is why `0011`'s row-overlap fix is marked
`[SUPERSEDED]`, not wrong. Diff `0012` (this turn) is, like `0010` and
`0011` before their first live test, **only statically verified** - full
`@babel/parser` syntax check across every client file, no build/browser
test possible in this sandbox (see Current Code/Architecture
Considerations, unchanged constraint). The `0012` diff itself was
verified to `git apply --check` cleanly on top of a copy of the repo with
`0011` already applied.

## Problems / Errors

1. **User-reported and now addressed by diff `0012`**: clicking a deed
   card shrank the canvas. Root cause: the card expanded inline in place
   to show its edit form, which grew the card's height, which (even with
   diff `0011`'s row-height fix working correctly) still visibly
   reflowed/resized the surrounding canvas - not what the user wanted.
   Fix was a redesign (move editing to a sidebar), not a smaller patch -
   see Work Completed. Not yet re-tested live.
2. The unidentified benign `404` from the very first live test (mentioned
   in prior `CHAT_STATE.md` revisions) is still unaddressed/unconfirmed -
   no update this turn, still only worth investigating if the user sees it
   again.

## Debugging Already Done

The user's bug report ("canvas shortens" on click) was specific enough
to identify the exact mechanism without needing a live repro: the
inline-expand behavior in the pre-`0012` `DeedCard.jsx`, and diff
`0011`'s row-height-measurement fix (which was *working as intended* -
rows genuinely did grow instead of overlapping) was never going to
satisfy this complaint, because growing rows still means the canvas
visibly changes shape around the clicked card. That's why this turn was
scoped as an interaction redesign (sidebar) rather than trying to patch
`0011` further - no amount of row-height tuning removes the reflow the
user was objecting to, since the reflow is inherent to editing in place
at all.

## Important Decisions Made

See `PROJECT_CONTEXT.md`'s "Important Decisions" for the durable record
(now includes this turn's sidebar-redesign bullet). One decision worth
calling out here specifically since it's easy to second-guess in a future
session: **diff `0011`'s row-height-measurement code in `Canvas.jsx`
(`cardHeights`/`autoPositions`/`rowLayoutHeight`) was deliberately left in
place**, not ripped out, even though on-canvas cards no longer expand and
so the mechanism is now close to a no-op in practice. Reasoning: it's
harmless (settles to a stable value immediately since card height barely
varies now), costs nothing to keep, and still provides real robustness if
a card's summary text content ever grows (e.g. a very long deed number
wrapping to two lines). Don't remove it reflexively in a future cleanup
pass without re-checking whether that reasoning still holds.

## Current Code/Architecture Considerations

- **Single shared sidebar, not per-card state.** Before `0012`, every
  `DeedCard` could independently hold its own expanded/edit-buffer state,
  so multiple cards could theoretically be "open" (expanded) at once. Now
  there is exactly one `DeedSidebar` instance, keyed by `selectedKey`, so
  switching selection unmounts/remounts it. This is why the
  `sidebarDirty`/`trySelect` confirm-guard exists - it's compensating for
  a capability the old design had "for free" (independent per-card state)
  that the new single-sidebar design doesn't. If a future request wants
  multiple cards editable simultaneously again, this whole guard becomes
  unnecessary and should come back out.
- **Still no live browser/network/MongoDB access in this sandbox** -
  unchanged constraint, carried over from every prior turn in this
  project. Diff `0012` should be treated with the same "should fix it, not
  confirmed" caveat diffs `0010` and `0011` were until the user retests
  live - and this diff is a larger, more structural change than either of
  those, so it deserves particularly careful live retesting (see Pending
  Work/Exact Next Steps).
- **`App.jsx`'s layout change is a real (if usually invisible) behavior
  change for Search/Lineage too**, not just Canvas - they now scroll
  within a `flex-1 min-h-0 overflow-auto` wrapper instead of the whole
  page scrolling. Should look identical in practice, but call this out if
  the user reports anything odd about scrolling on those two tabs
  specifically, since it's a shared change underneath a Canvas-focused
  request.
- The scratch working copy for this chat is still
  `/home/claude/work/DeedTracker` (plus a separate clean git checkout at
  `/tmp/patchrepo` used purely for diff generation) - both local to this
  sandbox, neither persists to a future chat.

## Pending Work

- **Re-test live**, and this time specifically exercise the new sidebar
  flow end to end: add a deed (sidebar should open automatically) → fill
  it in → click a different (or no) card while it's "dirty" and confirm
  the discard-confirmation appears → select a saved deed, edit it, Save
  changes, confirm it persists on reload → delete a deed from the sidebar
  → confirm the canvas pane itself never visibly resizes/reflows when the
  sidebar opens or closes → confirm pan/zoom/scroll still work with the
  sidebar open. Then resume the rest of the original smoke-test checklist
  (wiring relationships including a cycle attempt, Search, Lineage/View,
  Excel export) that's been pending since diff `0009`.
- Authentication (explicitly deferred, only add if asked).
- Deployment/hosting setup (none exists).
- Bulk import from the old Firebase version (never requested).
- Format validation beyond deed number (not requested).
- The unidentified benign 404 from the first live test - only worth
  investigating if it recurs independently.

## Exact Next Steps

1. Present diff `0012` (sidebar redesign, bundled with the
   `PROJECT_CONTEXT.md` updates) with exact `git apply`/`git add -A`/
   `git commit`/`git push` instructions.
2. Ask the user to re-test live, specifically the new sidebar flow (see
   Pending Work above) - this is a bigger structural change than `0010`
   or `0011`, so a careful pass here matters more than usual.
3. Whatever breaks, get the exact error/behavior from the user and fix it
   as diff `0013` - do not guess without a concrete repro, same as every
   prior diff in this project.
4. Once smoke-tested clean, return to the open backlog (auth, deployment,
   bulk import) only as the user prioritizes it.

## User Requirements For The Current Task

- Always deliver changes as `.diff` files (git-apply-able), never full
  file rewrites, never assume Claude Code / direct repo access.
- Keep diff numbering sequential and continuous across the whole project
  (currently through `0012`).
- Give exact shell commands for applying each diff every time.
- `CHAT_STATE.md` should stay narrowly conversation-focused, not a
  restatement of `PROJECT_CONTEXT.md`.
- Keep `PROJECT_CONTEXT.md` and `CHAT_STATE.md` updated side-by-side with
  each improvement/build going forward, not just at session handoff.
