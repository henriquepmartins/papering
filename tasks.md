# Papering — Tasks

Living checklist of work in the repo. Sliced by what's done vs. what's queued.
Update inline as tasks complete or new ones are discovered.

---

## Slice 1 — Capture panel (done)

- [x] Tauri 2 shell with floating panel pre-created hidden at launch
- [x] Global hotkey via `tauri-plugin-global-shortcut`
- [x] CodeMirror 6 editor mounted in capture window
- [x] Bear-style live markdown: H1/H2/H3, bold, italic, inline code
- [x] Cursor-on-line reveals raw inline marks (faint), hidden otherwise
- [x] Auto-save debounced to `.md` file under `~/Notes/Inbox/`
- [x] `Esc` flushes + hides; blur also flushes
- [x] `captureReady` IPC ping for warm-hotkey timing

## Slice 2 — Raycast Notes visual parity (done 2026-05-27)

- [x] Light glossy theme (OKLCH tokens, gradient + backdrop-filter)
- [x] Editor theme flipped to light, repainted classes
- [x] H1 accent left-border via `Decoration.line`
- [x] Bullet list: `- ` → `•` widget
- [x] Ordered list: `1.` marker painted in accent
- [x] GFM tasks: `- [ ]` / `- [x]` → accent circle widget
- [x] Titlebar overlay with three hover-revealed icons (⌘ / Notes / +)
- [x] Centered title derived from first heading / first line
- [x] Footer: `{N} characters` centered + italic `T` right
- [x] `+` clears the editor

## Slice 2.3 — Drag, tooltips, delete, more markdown, toggle, selection (done 2026-05-27)

- [x] **Drag permission** — added `core:window:allow-start-dragging` (+ `allow-set-position`) so `data-tauri-drag-region` actually works
- [x] **Translucent bg** — kept `#F2F2F2` base, mid-opacity gradient (~32%/18%) + `backdrop-filter: blur(40px) saturate(1.8)` so both Tauri (over NSVisualEffectView) and browser dev preview feel translucent
- [x] **Tooltips on icon hover** — appear after 350 ms delay, show label + shortcut hint, dismissed on hover-out, scale-from-top animation via motion
- [x] **Delete notes** — Rust `delete_note(path)` with root-canonical check; per-row trash button in Notes popover (hover-revealed); two-click confirm (red bg on first click, deletes on second within 2.5 s)
- [x] **Strikethrough** (`~~text~~`) with `pap-strike` style + `⌘⇧X` shortcut
- [x] **Blockquote** (`> text`) with left accent-strong border + muted italic
- [x] **Fenced code** (` ``` … ``` `) with monospace + soft surface per line
- [x] **Toggle wrap** — `⌘B`/`⌘I`/`⌘E`/`⌘⇧X` now detect existing wrap (selection adjacent or already containing marker) and strip instead of double-wrapping
- [x] **Selection color** `#fbe4e3` at 0.85 alpha + 3 px border-radius on `.cm-selectionBackground` for a softer feel

## Slice 2.2 — Hover polish + translucency + dev defensive (done 2026-05-27)

- [x] **Icon hover via motion.dev** — `motion.button` with `whileHover` (subtle dark bg appears) + `whileTap` scale(0.94), 140ms `cubic-bezier(0.23, 1, 0.32, 1)` ease-out (Emil's curve). Color shift kept in CSS.
- [x] **Background `#F2F2F2`** at ~18%/6% opacity gradient — Sidebar vibrancy reads through stronger, panel feels more translucent + blurry.
- [x] **Defensive IPC** — `isTauri()` helper short-circuits all invoke calls when running in a browser (`next dev`). Killed the spurious "1 Issue" badge caused by rejected `save_note`/`list_notes` promises.
- [x] **Title stripped of markdown** — `deriveTitle` removes `# `, `**`, `*`, `` ` ``, `- [ ]`, ordered list prefixes so the titlebar shows clean text instead of raw markup.

## Slice 2.1 — Fixes after first review (done 2026-05-27)

- [x] **Window drag** — `data-tauri-drag-region` on titlebar (was `-webkit-app-region`, which Tauri ignores)
- [x] **Vibrancy material** — `Sidebar` (light) instead of `HudWindow` + dropped `force_dark_appearance` (was making the panel grey)
- [x] **Lighter CSS overlay** so Sidebar vibrancy reads through
- [x] **Active-line wash removed** — `highlightActiveLine` extension dropped + `.cm-activeLine` CSS deleted; only the caret indicates position
- [x] **List markers always render** — bullet/ordered/task widgets no longer hide on the active line, so `- ` and `1. ` convert as you type
- [x] **Bold / italic / code shortcuts** — `⌘B`, `⌘I`, `⌘E` wrap selection in `**`/`*`/`` ` ``. Manual typing still works.
- [x] **⌘ icon** is now the native Unicode glyph (U+2318) via `.cmd-glyph`, not the fake SVG
- [x] **Shortcuts popover** anchored to the ⌘ button (capture / save / formatting / new) with click-outside + Esc dismissal
- [x] **Notes popover** anchored to the document button — lists last 20 notes from `~/Notes/Inbox/` (Rust `list_notes`), click loads via `load_note`
- [x] **Path-aware save** — `save_note` accepts optional path; loading a note keeps subsequent edits in that file; `+` clears the path so the next save spawns a fresh file
- [x] PRD + tasks.md updated, changelog entry added

## Slice 3 — Capture polish (queued)

- [ ] Real `new_capture` command in Rust (today: frontend clears + null path)
- [ ] Notes popover: keyboard navigation (`↑/↓ ↵ Esc`)
- [ ] Notes popover: search/filter input
- [ ] Slash commands: inline picker (`/h1`, `/h2`, `/h3`, `/todo`, `/code`, `/quote`, `/divider`, `/link`)
- [ ] Formatting menu wired to the `T` button (bold/italic/code/heading toggles, mirror of ⌘ shortcuts)
- [ ] Reduce-motion variant for hover/fade transitions
- [ ] Decide if vibrancy material should follow system light/dark

## Slice 4 — Main window (queued)

- [ ] Tauri main window route (`app/page.tsx` stops being a redirect)
- [ ] Sidebar: folders list + pinned section + accent dots
- [ ] Notes list pane: title + preview, sorted by updated_at
- [ ] Editor pane shared with capture (refactor `CaptureEditor` into reusable `<NoteEditor />`)
- [ ] Folder CRUD (create/rename/delete with confirmation)
- [ ] Accent picker (8 presets + custom)

## Slice 5 — Search & switcher (queued)

- [ ] FTS5 schema + indexer in Rust (`db/`, `commands/search.rs`)
- [ ] `nucleo` fuzzy ranking layered over FTS results
- [ ] `⌘K` overlay (works from main window + capture panel)
- [ ] Result rendering with snippet highlights
- [ ] Keyboard navigation `↑/↓ ↵ ⌘↵ Esc`

## Slice 6 — File watcher & reconciliation (queued)

- [ ] `notify` watcher on notes root
- [ ] Debounced (100 ms) diff vs DB; rebuild FTS row on change
- [ ] Full reconcile on app launch

## v1.1+ (deferred)

- [ ] Dark mode + per-folder accent theming
- [ ] Tables, footnotes, math (KaTeX) markdown tokens
- [ ] Export (PDF / HTML)
- [ ] iCloud sync via CloudKit + Swift sidecar
- [ ] Tags or wiki-links (only if missed during daily use)

---

## Open questions

- Default global hotkey? (proposed `⌃⌥N`)
- Default capture folder? ("Inbox" hard-coded today; should it follow last-used?)
- Should capture panel and main window share editor state, or always be independent windows?
- Slash-command extensibility hooks in v1, or rigid set?
- Vibrancy material when dark mode lands — `HudWindow` again, or `UnderWindowBackground`?
