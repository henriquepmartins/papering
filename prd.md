# PRD — Local Notes App (working name: Papering)

## Context

Henrique wants a personal, Mac-only notes app that captures the speed, keyboard-first ergonomics, and visual restraint of Raycast Notes — but as a standalone app he controls. Existing tools fail in different ways: Raycast Notes is locked inside Raycast and can't be the canonical home for everything; Apple Notes lacks native markdown; Bear/Obsidian are heavier than the use case. The opportunity is a tightly-scoped app for one user, optimized for typing speed, instant-open, and clean visual feel — no plugins, no sync UI, no marketplace.

This is greenfield, single-user, Mac-only. The goal of v1 is to nail the core loop (open → type → find later) at native-feel quality and explicitly defer everything else.

**Stack reset (2026-05-26).** Originally specced as SwiftUI + GRDB. Pivoted to **Tauri 2 (Rust) + Next.js** to ship faster, leverage the mature web editor ecosystem (CodeMirror 6) for the live-markdown editor, and keep Henrique in his strongest toolchain. Native feel is preserved by using the system WKWebView, native NSWindow chrome via Tauri, and Rust for all file/index/hotkey work — no Node runtime, no Electron.

---

## 1. Executive Summary

**Problem.** Henrique has no single, fast, markdown-native home for personal notes that feels as good to use as Raycast Notes but exists as a real app outside Raycast.

**Solution.** A native macOS app — **Tauri 2 shell (Rust core + WKWebView) hosting a statically-exported Next.js frontend** — with hybrid storage (`.md` files on disk under `~/Notes/<folder>/`, indexed by SQLite/FTS5 in Rust), live markdown rendering via CodeMirror 6, global hotkey, ⌘K quick-switcher, and folder-based organization with accent customization.

**Success criteria (measurable):**
- **Warm open via global hotkey:** ≤80 ms from keypress to window visible & focused (app already running, panel pre-created/hidden).
- **Cold open via global hotkey:** ≤250 ms on M1+ (first launch in the session).
- **⌘K to first keystroke in switcher:** ≤50 ms; fuzzy results render ≤30 ms for a 1k-note corpus (matching done in Rust via `nucleo`).
- **Keystroke-to-render latency in editor:** ≤16 ms (one frame) for documents up to 50 KB.
- **Full-text search:** ≤100 ms p95 for a 1k-note / 5 MB corpus.
- **Disk format portability:** 100% of notes readable by any external markdown editor (valid `.md` files, no proprietary front-matter required for content).

---

## Implementation status (as of 2026-05-27)

**Slice 1 — Capture panel (done):**
- Tauri 2 shell with floating panel pre-created hidden at launch (`src-tauri/src/commands/capture.rs`, `lib.rs`).
- Global hotkey wired via `tauri-plugin-global-shortcut` (`src-tauri/src/hotkey.rs`).
- Capture-ready IPC ping for warm-hotkey timing (`captureReady` in `app/lib/ipc.ts`).
- Save flow: debounced (400 ms) auto-save to `.md` file under `~/Notes/Inbox/`; `Esc` flushes + hides; window blur also flushes (`app/capture/CaptureEditor.tsx`, `src-tauri/src/fs/save.rs`).
- CodeMirror 6 editor with Bear-style in-place markdown rendering: `# / ## / ###`, `**bold**`, `*italic*`, `` `code` `` are rendered visually; raw marks revealed (faint) when cursor enters the line, hidden otherwise (`app/lib/editor/markdown-decorations.ts`).
- Native NSWindow chrome + transparent webview shell, CSS `backdrop-filter` fallback for vibrancy (`vibrancy.rs`).

**Slice 2 — Visual parity with Raycast Notes (done):**
- Switched to **light glossy theme**. OKLCH tokens repainted; dark mode deferred to v1.1.
- Extended live markdown:
  - `- ` bullet → rendered as `•` widget (raw `-` revealed on cursor line).
  - `1. ` ordered list → marker painted in accent color (always visible).
  - GFM `- [ ]` / `- [x]` tasks → rendered as accent-stroked circle (empty / checkmark) via `WidgetType`. GFM extension enabled in `setup.ts`.
  - H1 lines get an accent left-border via `Decoration.line`.
- **Titlebar overlay** with three hover-revealed icons (`⌘` Shortcuts, document Notes, `+` New). Title is derived from the first heading/line of the doc, centered. Icons fade in on shell hover, full opacity on icon hover.
- **Footer redesigned**: `{N} characters` centered + italic `T` (Formatting placeholder) right; dropped the previous `Inbox`/`esc` hint row.
- `+` icon clears the editor (after flushing current doc) — placeholder for proper `new_note` command later.

**Slice 2.1 — Fixes after first review (done 2026-05-27):**
- **Window is draggable** via `data-tauri-drag-region` (was inert because `-webkit-app-region` isn't recognised by Tauri 2).
- **NSVisualEffectView material switched** from `HudWindow` (dark) to `Sidebar` (light/translucent); `force_dark_appearance` removed. CSS overlay lightened so the vibrancy reads through.
- **Active-line wash removed** — `highlightActiveLine` extension dropped + `.cm-activeLine` CSS deleted. Only the caret indicates position (matches Raycast Notes).
- **Lists auto-render as you type** — bullet (`- `), ordered (`1. `), and GFM task (`- [ ]`/`- [x]`) widgets render even on the active line. Inline marks (bold/italic/code) keep Bear-style cursor reveal.
- **Bold / italic / code keyboard shortcuts** — `⌘B`, `⌘I`, `⌘E` wrap selection (or insert empty markers and place the caret between).
- **⌘ icon** now uses the native Unicode glyph (U+2318) styled as `.cmd-glyph`, not the fake stroked SVG.
- **Shortcuts popover** — anchored to the ⌘ button. Click-outside + Esc dismiss.
- **Notes popover** — anchored to the document button. Lists last 20 notes from `~/Notes/Inbox/` via Rust `list_notes`. Click loads via `load_note` and routes subsequent saves back to that file (`save_note` now takes an optional `path`).
- **Path-aware save** — `+` clears the tracked path so the next save creates a new file; loading an existing note keeps edits in place.

**Not yet:**
- Main window (sidebar + notes list + editor pane).
- `⌘K` fuzzy switcher (`nucleo` Rust side).
- Slash commands (`/h1`, `/todo`, …) and inline picker.
- Folder CRUD + accent picker UI.
- FTS5 search wiring + ranking.
- Real NSVisualEffectView via `tauri-plugin-decorum` (CSS `backdrop-filter` is the current fallback).
- Dark mode + per-folder accent customization (v1.1).
- File watcher (`notify`) reconciliation.

---

## 2. User Experience & Functionality

### Persona
Single user: Henrique. Senior developer, keyboard-first, opinionated about feel and minimalism. Uses Raycast daily. Will reject anything that feels Electron-y.

### Core user flows

**Flow A — Quick capture (floating panel).**
1. Press global hotkey from anywhere (default `⌃⌥N`, configurable).
2. A centered floating panel (Tauri `WebviewWindow`, `alwaysOnTop: true`, no decorations, NSVisualEffectView background) appears, focused on a blank note.
3. Type. Markdown renders inline via CodeMirror 6 decorations. Slash menu available.
4. `Esc` dismisses; note is auto-saved to the currently-selected default folder (e.g., "Inbox" or last-used).

**Flow B — Browse & write (main window).**
1. Open app from Dock or press `⌘⇧N` (or click "Expand" from the floating panel).
2. Sidebar lists folders (Personal, Work, Finances, …) with accent colors, pinned notes section on top.
3. Center pane: note list for selected folder, sorted by updated-at, with title + preview snippet.
4. Right pane: live markdown editor.
5. `⌘K` opens fuzzy quick-switcher overlay; type to find any note across all folders.

### User stories & acceptance criteria

**S1 — Capture a note instantly.**
*As Henrique, I want to press a global hotkey and start typing a note within ~80 ms (warm), so I never lose a thought.*
- AC1: Global hotkey is registered system-wide via `tauri-plugin-global-shortcut` and works from any focused app.
- AC2: First keypress after hotkey is captured by the editor (no dropped keystrokes during window show).
- AC3: Floating panel is pre-created hidden at app launch; hotkey only flips `.show()` + `.set_focus()` → ≤80 ms warm budget.
- AC4: If the app is not running, hotkey launches it cold and still hits the 250 ms budget on M-series Macs.
- AC5: Closing the floating panel persists the note automatically — no save dialog.

**S2 — Organize by folder.**
*As Henrique, I want to create, rename, delete, and color-code folders so notes have a clear home.*
- AC1: Folders correspond 1:1 to real directories under `~/Notes/`.
- AC2: Renaming a folder renames the directory and updates the index without breaking links.
- AC3: Each folder has an accent color picker (8 preset OKLCH-tuned options + custom hex).
- AC4: Empty folders are allowed; deletion requires confirmation if non-empty.

**S3 — Find any note in <1 second.**
*As Henrique, I want ⌘K fuzzy search across titles and full content with highlighted matches.*
- AC1: ⌘K overlay opens from anywhere in the app, including the floating panel.
- AC2: Results rank by: title match > pinned > recency > content match.
- AC3: Matches in content show a one-line snippet with the match highlighted (FTS5 `snippet()` function).
- AC4: `↑/↓` to navigate, `↵` to open in main window, `⌘↵` to open in floating panel, `Esc` to dismiss.

**S4 — Live markdown without preview toggle.**
*As Henrique, I want headings, bold, italic, lists, code blocks, links, and inline code to render as I type — no split preview, no toggle.*
- AC1: Markdown tokens are rendered in-place via CodeMirror 6 decorations (heading shrinks to its rendered size; bold renders bold).
- AC2: Cursor placement reveals the raw markdown for the active line/block (Bear-style — implemented as a CM6 ViewPlugin that strips decorations around the selection range).
- AC3: Supported tokens v1: `#`/`##`/`###`, `**bold**`, `*italic*`, `` `code` ``, fenced ` ``` ` blocks, `- [ ]` checkboxes, `- ` bullets, `1.` numbered, `[text](url)` links, `> blockquote`, `---` rules.

**S5 — Slash commands.**
*As Henrique, I want to type `/` to insert markdown structures via a small picker.*
- AC1: `/` at the start of a line (or after whitespace) opens an inline picker rendered as a CM6 tooltip.
- AC2: Picker is keyboard-navigable, filter-as-you-type, `↵` to insert, `Esc` to cancel.
- AC3: v1 commands: `/h1`, `/h2`, `/h3`, `/todo`, `/code`, `/quote`, `/divider`, `/link`.

**S6 — Pinned notes.**
*As Henrique, I want to pin notes to the top of the sidebar for quick access.*
- AC1: Right-click a note or `⌘P` toggles pin.
- AC2: Pinned notes show in a dedicated "Pinned" section above folders.
- AC3: Pin state persists in SQLite metadata (`notes.pinned`).

### Non-goals (explicitly out of v1)
- Tags
- Wiki-links / backlinks
- Export (PDF/HTML/share sheet)
- Multi-device sync (designed-for-later; not implemented)
- Attachments / images embedded in notes
- Collaboration, sharing, publishing
- Plugins / themes marketplace
- iOS / iPad version
- AI features (summarize, autocomplete, etc.)
- Windows / Linux builds (Mac-only; Tauri makes them possible later but they are non-goals for v1)

---

## 3. Technical Specifications

### Stack

**Shell + native integration (Rust):**
- **Tauri 2.x** — single-binary app, WKWebView on macOS, native NSWindow chrome.
- **`tauri-plugin-global-shortcut`** — system-wide hotkey.
- **`tauri-plugin-fs`** — sandboxed file access scoped to the notes root.
- **`tauri-plugin-window-state`** — persist main window size/position.
- **`rusqlite`** with bundled SQLite (FTS5 feature enabled) — embedded DB, no separate process.
- **`notify`** — cross-platform file watcher for external `.md` edits.
- **`nucleo`** (from Helix) — fuzzy matcher, used for the ⌘K switcher.
- **`pulldown-cmark`** — markdown parsing where Rust needs to understand structure (e.g., extracting titles, computing snippets); not used for the live editor.

**Frontend (Next.js):**
- **Next.js 15 + App Router**, configured with `output: 'export'` — static export. No Node runtime ships with the app.
- **React 19**.
- **TypeScript** strict mode.
- **Tailwind CSS v4** with OKLCH-defined design tokens.
- **CodeMirror 6** + `@codemirror/lang-markdown` + custom `ViewPlugin` for Bear-style in-place rendering. (Picked over Tiptap/ProseMirror because CM6's `Decoration` API is the cleanest fit for "render tokens visually but keep raw markdown as the document model", and it hits 16 ms input latency easily.)
- **Motion** (Framer Motion's successor, `motion/react`) for component animations. GSAP not needed in v1.
- **`@tauri-apps/api`** — typed IPC to Rust commands.

**IPC contract.** Rust exposes typed commands (`#[tauri::command]`); frontend calls them via `invoke<T>(name, args)`. Long-running streams (file-watcher events, search progress) use Tauri events. All file/DB work happens in Rust — the webview never touches disk directly.

### Data model

```
~/Notes/
  Personal/
    grocery-list.md
    .meta.json            (folder accent color, sort prefs)
  Work/
  Finances/
  .index/
    notes.sqlite          (FTS5 + metadata)
```

**SQLite tables (managed by Rust via `rusqlite`):**
- `notes(id PK, path, folder, title, updated_at, created_at, pinned, body_size)`
- `notes_fts` — FTS5 virtual table on `(title, body)`, content-rowid linked to `notes`
- `folders(name PK, accent_hex, sort_order, default_for_capture)`
- `app_state(key PK, value)` — last-opened note, hotkey config, etc.

The `.md` files are the source of truth. SQLite is rebuildable from disk at any time. The Rust file-watcher (`notify`) reconciles external edits → updates FTS row.

### Repository layout

```
papering/
  src-tauri/              Rust crate (Tauri shell + core)
    src/
      main.rs
      commands/           IPC handlers (notes, folders, search, hotkey)
      db/                 rusqlite + migrations + FTS5 setup
      fs/                 file I/O + notify watcher
      search/             nucleo-based ranking
    tauri.conf.json       window config, permissions, bundle
    Cargo.toml
  app/                    Next.js App Router
    layout.tsx
    page.tsx              main window root
    capture/page.tsx      floating panel route
    components/
    lib/
      ipc.ts              typed wrappers around invoke()
      editor/             CodeMirror 6 setup + markdown decorations
  public/
  next.config.ts          output: 'export'
  tailwind.config.ts
  package.json
```

Old Xcode project (`papering/papering.xcodeproj`, `papering/papering/`) is to be deleted; preserved in git history if needed.

### Performance budgets
- App bundle: <30 MB (Tauri base ~10 MB + Next.js static export + assets).
- Resident memory at idle (10 notes loaded): <150 MB (WKWebView + Rust process combined).
- Warm hotkey-to-visible: 80 ms on M1+ (pre-created hidden panel).
- Cold launch hotkey-to-visible: 250 ms on M1+.
- Editor input latency: 16 ms keystroke-to-render p99 (CodeMirror 6 over typical 50 KB doc).

### Security & privacy
- Tauri's permission system locked to: filesystem scope = user-selected notes root only; global-shortcut; window management. No HTTP, no shell, no clipboard write without explicit user action.
- CSP locked down — no `unsafe-eval`, no remote origins.
- No network calls in v1. No telemetry. No analytics.
- All IPC commands validate paths server-side (Rust) — webview can't escape the notes root.

### Sync design-for-later
- File-based `.md` storage means dropping `~/Notes` inside iCloud Drive / Dropbox already gives crude sync. v1 doesn't depend on this.
- For real sync later: CloudKit on `.md` files via macOS APIs (called from Rust through `objc2` or a tiny Swift sidecar) + DB rebuild on conflict. Store paths relative to notes root so the DB is portable.

---

## 4. Design / Feel (the part that decides whether this is worth building)

This section is non-negotiable — the whole reason to do this is to nail the feel. **Tauri vs SwiftUI does not change the visual bar.** If the webview implementation can't match it, that's a v1 blocker, not a relaxation of the bar.

### Visual principles
- **Quiet by default.** Generous whitespace, no chrome until needed. The editor should look like a piece of paper, not a tool.
- **One accent color at a time.** The active folder's accent is the only colored element on screen (pins, selection, caret tint). Everything else is neutral.
- **OKLCH palette.** Light and dark themes tuned in OKLCH for perceptually-even contrast. No raw hex picks. Defined as Tailwind v4 `@theme` tokens.
- **Typography.** Inter or SF Pro for UI; JetBrains Mono or SF Mono for code blocks. Tabular numerals (`font-variant-numeric: tabular-nums`) in lists. Use `-webkit-font-smoothing: antialiased` and `text-rendering: optimizeLegibility`.
- **Native window chrome.** Real NSWindow titlebar (Tauri `titleBarStyle: "Overlay"` for main, `decorations: false` for floating). NSVisualEffectView background via `tauri-plugin-decorum` or a small native shim — webview's `backdrop-filter: blur()` is a fallback only.
- **Optical alignment, not pixel alignment.** Sidebar items, icons, and the caret are nudged for visual centering.

### Motion principles
- Springs everywhere via Motion. No `linear`, no `easeInOut` unless duration <100 ms.
- Floating panel open: 220 ms spring, slight scale-from-98% + opacity, blur ramps in (handled in CSS since the window itself is already shown).
- Sidebar selection: 120 ms underline-slide between items (Motion `layoutId`).
- Slash menu: 90 ms scale-in from `0.96 → 1.0`.
- Reduced Motion respected (`prefers-reduced-motion`): collapse springs to opacity-only.

### Micro-details v1 must get right
- Caret blinks with the system rate (CodeMirror default — do not override).
- Cursor changes to text-bar when hovering editor margins (not just text).
- Pin/unpin animates the note item to its new position (Motion `layout`).
- Markdown tokens fade rather than appear/disappear hard when cursor enters/leaves a styled block (CM6 decoration transition).
- Window has a subtle inner border in dark mode to avoid the "flat black hole" look.
- Slash menu closes with a 1-frame delay on selection so the chosen item visibly highlights.
- WebView background must be transparent at the root so NSVisualEffectView shows through — set `transparent: true` on the Tauri window and `background: transparent` on `html, body`.

### Accent system
8 preset accents (OKLCH-tuned for AA contrast in both themes) + custom picker. Accent affects: folder dot, selection, caret tint, pin star, focus ring. Implemented as a CSS custom property (`--accent`) swapped on the document root.

---

## 5. Phased Rollout

### MVP (v1) — what this PRD covers
Folders + notes + live markdown (subset in S4) + global hotkey + ⌘K switcher + slash commands + pinned + full-text search + light/dark/accent.

### v1.1 (post-feedback from real personal use)
- Reduced-motion polish, accent customization deepening.
- More markdown tokens (tables, footnotes, math via KaTeX).
- Export (PDF, HTML).
- Per-folder default capture target.

### v2.0 (when sync stops being optional)
- iCloud sync via CloudKit (called from Rust through a small Swift sidecar or `objc2`).
- Maybe tags or wiki-links — only if the lack of them is felt during daily use.
- Optional Linux/Windows builds — Tauri makes this nearly free if the design tokens hold up cross-platform.

---

## 6. Risks & Open Questions

### Technical risks
- **Live-markdown editor on CodeMirror 6.** Lower risk than the SwiftUI/TextKit 2 path, but the Bear-style "hide tokens unless cursor is on the line" behaviour still requires a custom `ViewPlugin` + `Decoration` set. Mitigation: scope S4 token set tightly; ship with minimum; reference Obsidian's open-source CM6 setup as a starting point.
- **WKWebView cold-start cost.** Tauri spawns the webview on app launch. Warm hotkey budget (80 ms) is realistic *only if* the floating panel webview is pre-created hidden at launch. Cold launch (250 ms) is achievable but tighter than the original 150 ms SwiftUI target — accept the trade.
- **NSVisualEffectView blur in a webview.** CSS `backdrop-filter: blur()` inside a webview is not the same as a real NSVisualEffectView. Mitigation: use `tauri-plugin-decorum` (or write a small native shim) to attach a real NSVisualEffectView behind a transparent webview. Validate during the first vertical-slice build.
- **Global hotkey reliability.** `tauri-plugin-global-shortcut` is maintained but newer than `KeyboardShortcuts.swift`. Test conflict handling and re-registration after sleep/wake.
- **File-watcher vs DB consistency.** External edits to `.md` files must reconcile cleanly. Mitigation: `notify` events → debounce 100 ms → diff mtime+size → rebuild FTS row. Periodic full reconcile on app launch.
- **Bundle size creep.** Next.js + React + CodeMirror can balloon. Mitigation: lazy-load CodeMirror on first editor mount; audit with `@next/bundle-analyzer`; cap at 30 MB total app bundle.

### Open questions to resolve during implementation
- Default global hotkey? (proposed `⌃⌥N`)
- Default capture folder name? ("Inbox"? Or last-used folder?)
- Should the floating panel and main window share state, or always be independent Tauri windows with their own IPC?
- NSVisualEffectView via `tauri-plugin-decorum` vs a hand-rolled Swift sidecar — decide after first build.
- Custom slash commands later — extensibility hooks worth designing for in v1?

---

## 7. Verification

How we know v1 is done and good:

- **Functional checks (manual):** Every AC in S1–S6 verified by hand on a fresh Mac.
- **Performance checks:**
  - Hotkey open timed from keypress (`tauri-plugin-global-shortcut` callback timestamp) to first `requestAnimationFrame` in the webview after `window.show()`. Both warm (80 ms) and cold (250 ms) budgets verified.
  - Editor latency measured with `performance.now()` in CodeMirror's update listener over a 50 KB document.
  - FTS search timed in Rust around the `rusqlite` query; budget 100 ms p95 on 1k-note corpus.
  - Bundle size: `tauri build` output ≤30 MB.
- **Storage portability:** Open a `.md` file in VS Code / Obsidian / TextEdit — should render correctly with no proprietary syntax in the body.
- **Reconciliation:** Edit a note in VS Code while app is running → change appears in the app within 1 s and search index updates.
- **Native-feel pass (subjective, but required):** Henrique uses the app exclusively for 1 week. If anything feels slower or less polished than Raycast Notes for the equivalent action — *especially* anything that exposes the webview underneath (scroll bounce mismatch, font-rendering smell, hover-cursor lag) — that's a v1 blocker, not a v1.1 item.

---

## Decisions locked in this PRD

- **Stack:** **Tauri 2 (Rust) + Next.js 15 (static export) + CodeMirror 6.** *Not* SwiftUI, *not* Electron, *not* a Node sidecar.
- **Storage:** Hybrid — `.md` files at `~/Notes/<folder>/` + SQLite/FTS5 index/metadata (via `rusqlite` in Rust).
- **Editor:** CodeMirror 6 with custom `ViewPlugin` for Bear-style in-place markdown rendering.
- **Sync:** Not in v1; storage choice keeps the door open.
- **Window model:** Tauri floating panel (pre-created hidden at launch) for capture + main Tauri window for browse/write.
- **Theme:** Light + Dark + accent customization, OKLCH tokens in Tailwind v4.
- **Non-goals:** Tags, wiki-links, export, sync, attachments, mobile, AI, cross-platform builds.

---

## Changelog

- **2026-05-26 (initial):** Approved as SwiftUI + GRDB + custom TextKit 2 editor.
- **2026-05-26 (pivot):** Restacked to **Tauri 2 + Next.js + CodeMirror 6**. User flows, design principles, and non-goals unchanged. Performance budgets relaxed where the webview makes the original SwiftUI numbers unrealistic (cold open 150→250 ms; idle memory 80→150 MB; bundle 20→30 MB). New risks added around webview cold-start, NSVisualEffectView integration, and bundle size. Old Xcode project to be removed from working tree.
- **2026-05-27 (slice 2):** Light-mode glossy theme replaces the placeholder dark tokens (dark deferred to v1.1). Live markdown expanded with bullet/ordered/GFM-task widgets and H1 accent-bar. Capture panel gets a hover-revealed titlebar (⌘ / notes / + icons + centered derived title) and a Raycast-style footer (`{N} characters` + `T`). See **Implementation status** section for the full delta.
- **2026-05-27 (slice 2.1):** First-review fixes. Window is now draggable (Tauri drag-region), vibrancy switched to light `Sidebar` material (was `HudWindow`+force-dark, hence the grey panel), active-line wash removed, lists auto-render as typed, `⌘B`/`⌘I`/`⌘E` formatting shortcuts, real ⌘ glyph icon, functional Shortcuts and Notes popovers (Rust `list_notes`/`load_note`), path-aware `save_note`.
