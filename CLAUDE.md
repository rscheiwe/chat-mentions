# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm install          # install all dependencies
pnpm dev              # run all packages in dev/watch mode (demo at http://localhost:3003)
pnpm build            # build all packages
pnpm test             # run tests across all packages (vitest)
pnpm lint             # lint all packages

# Package-specific (from repo root)
pnpm --filter ghost-mentions test       # tests for the library
pnpm --filter ghost-mentions test:run   # single vitest run (no watch)
pnpm --filter ghost-mentions build      # build library only (tsup)
pnpm --filter demo dev                  # run demo app only (Next.js on port 3003)
```

## Architecture

**Monorepo** (pnpm workspaces) with two workspace areas:

- `packages/ghost-mentions` — the published library (builds with tsup to ESM + CJS, outputs `"use client"` banner)
- `apps/demo` — Next.js demo app consuming the library via `workspace:*`

### Library structure (`packages/ghost-mentions/src/`)

The central piece is the **`useMentions` hook** (`hooks/use-mentions.ts`). It manages all mention state — tokens, menu, trigger detection, insertion, deletion — and returns `bind` props to spread onto a `<textarea>`. Everything else is built on top of it.

**DOM-first pattern**: The hook uses `setRangeText` to mutate the textarea DOM directly, then syncs the controlled React value afterward. A `pendingCaretRef` stores caret position across React re-renders so `useLayoutEffect` can restore it after the controlled value updates.

**Key modules:**

- `types.ts` — All shared interfaces (`MentionToken`, `MenuState`, `UseMentionsConfig`, etc.)
- `utils/diff.ts` — `computeDiff` / `adjustTokenRanges`: prefix+suffix diffing to shift or remove token positions when text changes externally
- `utils/markdown.ts` — `serializeMarkdown` / `parseMarkdown`: converts between plain text with token positions and markdown format `@[Label](type:id)`
- `utils/caret.ts` — `getCaretRect`: mirror-div technique to get pixel coordinates of textarea caret for popup positioning

**Components** (all consume the hook or its output):

- `MentionInput` — all-in-one component (hook + textarea + popup/dialog + highlights)
- `MentionPopup` — dropdown anchored to caret position
- `MentionDialog` — Radix Dialog modal with search
- `MentionHighlights` — ghost overlay that renders colored spans behind textarea text
- `MentionContainer` — layout wrapper for textarea + highlights

### Token lifecycle

1. User types a trigger char (`@`, `#`, etc.) at a word boundary → `detectTrigger` opens menu and calls `fetch`
2. User selects an entity → `insertMention` does DOM-first replacement, creates a `MentionToken` with character offsets
3. Backspace/Delete at or inside a token → atomistic deletion (whole token removed at once via `deleteTokenRange`)
4. External value changes → `adjustTokenRanges` diffs old/new text and shifts or drops tokens accordingly

### Peer dependencies

React 18, `@radix-ui/react-dialog`, `@radix-ui/react-dropdown-menu` — all externalized in the tsup build.
