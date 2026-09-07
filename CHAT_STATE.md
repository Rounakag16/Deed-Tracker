# CHAT_STATE.md

## Current Objective

Same session as diff `0014` (zip re-uploaded fresh at the start of this
chat; see PROJECT_CONTEXT.md for the two decisions that framed the whole
session - dark "data-flow" visual direction, audit-before-redesign
ordering, deployment deprioritized). This entry covers diff `0015`: the
actual visual redesign, done after the user reacted to two check-in
mockups (a static HTML preview, then a corrected one after the user
pointed out the connector wires weren't touching the cards) and gave the
go-ahead to build it for real.

## Work Completed In This Chat

**Diff `0014`** (search regex fix + export cycle-guard) - see the entry
already recorded in this file's prior version / PROJECT_CONTEXT.md's
Known Issues. Unchanged, already delivered.

**Design check-in before touching the real codebase**: built a standalone
HTML mockup (not part of the app, a throwaway preview file) of the dark
"data-flow" direction, grounded in the land-deed-ledger subject matter
specifically to avoid the generic "near-black + one neon accent" look -
see PROJECT_CONTEXT.md's Important Decisions for the palette/font
reasoning. First version had hand-guessed SVG wire coordinates that didn't
actually touch the card edges - the user caught this. Fixed by measuring
real DOM anchor positions with a small script (the same technique
`Canvas.jsx` already uses for the real app) instead of guessing pixel
values. User confirmed the corrected version looked right and asked for
the real functionality to be preserved, not just the look.

**Diff `0015` - the actual redesign**, applied directly to the client
codebase:
- `tailwind.config.js` - added the theme's color tokens (`canvas`,
  `surface`/`surface-raised`, `border`/`border-strong`,
  `ink`/`ink-muted`/`ink-faint`, `brass`/`brass-soft`, `verdigris`,
  `brick`) and font families (`serif`: Fraunces, `sans`: Inter,
  overriding the Tailwind defaults).
- `index.html` - Google Fonts `<link>` tags for Fraunces + Inter.
- `src/index.css` - base `body` styles now use the new tokens.
- Every component restyled (`App.jsx`, `Canvas.jsx`, `DeedCard.jsx`,
  `DeedSidebar.jsx`, `DeedForm.jsx`, `LineageGraph.jsx`,
  `WorkspaceList.jsx`, `SearchPanel.jsx`) - swapped every `slate-`/
  `blue-`/`red-`/`green-`/`amber-`/`bg-white` class for the new tokens,
  confirmed with a repo-wide grep afterward that none were left anywhere
  in `client/src`.
- `Canvas.jsx`'s SVG wires got a second, wider/blurred/translucent copy
  of each path underneath the real one for a glow effect, plus a second
  arrowhead marker so saved (brass-soft) vs. pending (brass) edges are
  visually distinct the way the pre-redesign gray/amber distinction used
  to work. `LineageGraph.jsx`'s read-only view got the equivalent
  treatment (no glow there, just the color/font swap, since that view
  doesn't have the pending/saved distinction to preserve).
- `DeedCard.jsx` gained a left accent bar (via a `before:` pseudo-element,
  not a real DOM node) - brass for an unsaved draft, verdigris for
  selected, faint gray otherwise. Deed numbers render in Fraunces
  (serif) everywhere; everything else stayed in Inter (sans).
- This was a pure restyle: no state, handlers, props, or logic changed
  anywhere. Verified two ways: (1) diffed every edited file against its
  pre-redesign version and confirmed only `className`/color/font lines
  differ; (2) syntax-checked every touched `.jsx` file with
  `@babel/parser` (see below for why not a real build).

**Build tooling investigation**: tried to actually run `npm run build`
before/after the redesign to catch real errors. `client/node_modules` is
present in the zip (nice), but it's a **Windows (win32-x64) install** -
`rollup`'s and `esbuild`'s native binaries don't run in this Linux
sandbox (`Cannot find module @rollup/rollup-linux-x64-gnu`, and a
matching esbuild platform-mismatch error). No network here to install the
Linux binaries either. Landed on `@babel/parser` (present transitively as
a dependency of `@vitejs/plugin-react`, pure JS, no native binary) as a
syntax checker instead - real, but not equivalent to an actual browser
render. This is now recorded in PROJECT_CONTEXT.md's Partially Completed
section for future sessions. On the user's own Windows machine,
`npm run build` should work normally - this is purely a sandbox
limitation, not a problem with the code or the zip.

## Files Changed (diff `0015`)

`client/tailwind.config.js`, `client/index.html`, `client/src/index.css`,
`client/src/App.jsx`, `client/src/components/Canvas.jsx`,
`client/src/components/DeedCard.jsx`,
`client/src/components/DeedSidebar.jsx`,
`client/src/components/DeedForm.jsx`,
`client/src/components/LineageGraph.jsx`,
`client/src/components/WorkspaceList.jsx`,
`client/src/components/SearchPanel.jsx`, plus `PROJECT_CONTEXT.md`.

## Current Implementation State

Diffs `0001`-`0014` unchanged. Diff `0015` (this entry) restyles the
entire client to the dark "data-flow" theme with zero logic changes -
every feature that worked before diff `0015` should work identically
after it (same handlers, same state, same API calls), just rendered
differently. Not yet confirmed in an actual browser (see build tooling
note above) - static/diff-based verification only.

## Problems / Errors

None outstanding. The mockup's misaligned-wires issue (user-reported) was
fixed within the same turn it was raised, before the real redesign
started - see Work Completed above.

## Debugging Already Done

- Mockup wire misalignment: root-caused to hand-guessed SVG coordinates
  (compounded by a stretched `viewBox` that would've drifted further at
  different widths) - fixed by measuring real DOM anchor points, same
  technique the real `Canvas.jsx` uses.
- Build tooling: root-caused the `npm run build` failure to a Windows-
  built `node_modules` running on Linux, not a code problem - see above.

## Important Decisions Made

See PROJECT_CONTEXT.md's Important Decisions for the lasting ones (visual
direction, color/font token choices and why, audit-before-redesign
ordering) - recorded there since they're permanent project facts.

## Current Code/Architecture Considerations

- No architecture changes in diff `0015` either - purely `className`/CSS/
  font/color changes layered onto the existing component structure and
  handlers.
- The `DeedCard.jsx` left accent bar is implemented as a `before:`
  pseudo-element (Tailwind arbitrary-value + pseudo-element variant
  syntax), not a real DOM node - worth knowing if it ever needs to be
  measured/targeted by a ref, since pseudo-elements aren't part of the
  DOM tree.
- SVG `stroke`/`fill` colors are hardcoded hex constants at the top of
  `Canvas.jsx` and `LineageGraph.jsx` (mirroring `tailwind.config.js`'s
  values) rather than Tailwind utility classes - same pattern the
  pre-redesign code already used for SVG colors, kept for consistency and
  to avoid depending on Tailwind's arbitrary-color-utility generation for
  something unverifiable without a real build.
- Still no live browser/network/MongoDB access in this sandbox, and now
  more specifically: no working local build/dev-server either (see Build
  tooling investigation above) - unchanged/clarified constraint.
- The scratch working copy for this chat (`/home/claude/work/DeedTracker`)
  is local to this sandbox and won't persist to a future chat.

## Pending Work

- **Live re-test, whenever the user runs the app** - this is now more
  important than ever, since diff `0015` has never been seen rendered in
  an actual browser. Start with: does `npm run build` (or `npm run dev`)
  work on the user's machine at all (it should - Windows `node_modules`,
  Windows machine); does the dark theme render as intended; do Fraunces/
  Inter actually load (Google Fonts, needs internet - should be a non-
  issue for a normal browser, but worth confirming); then the same
  functional smoke-test checklist that's been pending since diff `0009`
  (relationships/cycles, Search, Lineage/View, Excel export), now also
  checking diff `0013`'s crash fix and diff `0014`'s two fixes, none of
  which have been confirmed live yet either.
- Authentication (explicitly deferred, only add if asked).
- Deployment/hosting setup (explicitly deprioritized - "we have a lot of
  time").
- Bulk import from the old Firebase version (never requested).
- Format validation beyond deed number (not requested).
- The unidentified benign 404 from the first live test, several sessions
  ago (only worth investigating if it recurs independently and is
  reported again).

## Exact Next Steps

1. Present diff `0015` (the full redesign, bundled with the
   PROJECT_CONTEXT.md update) with exact `git apply`/`git add -A`/
   `git commit`/`git push` instructions, noting it applies after `0014`.
2. Strongly encourage an actual live run before anything else - this diff
   is the least-verified one yet (styling-only, but untested in a real
   browser, on top of three still-unconfirmed-live fixes from `0013`/
   `0014`).
3. Fix whatever the user reports from that live run - ideally with exact
   repro steps and, for anything visual, a screenshot (this is a design-
   heavy diff, so screenshots will matter more than usual for this round
   of feedback).

## User Requirements For The Current Task

- Always deliver changes as `.diff` files (git-apply-able), never full
  file rewrites, never assume Claude Code / direct repo access.
- Keep diff numbering sequential and continuous across the whole project
  (currently through `0015`).
- Give exact shell commands for applying each diff every time.
- `CHAT_STATE.md` should stay narrowly conversation-focused, not a
  restatement of `PROJECT_CONTEXT.md`.
- Keep `PROJECT_CONTEXT.md` and `CHAT_STATE.md` updated side-by-side with
  each improvement/build going forward, not just at session handoff.
- Visual direction: dark "data-flow" redesign (see PROJECT_CONTEXT.md) -
  delivered in diff `0015`, user has not yet seen it live.
- Priority: audit/fix before redesign (done); deployment deprioritized
  for now; functionality must be preserved, not just the look (explicit
  ask before diff `0015` started).
