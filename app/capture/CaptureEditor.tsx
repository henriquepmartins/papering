"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { EditorContent } from "@tiptap/react";
import { AnimatePresence, motion } from "motion/react";

import { getCurrentWindow } from "@tauri-apps/api/window";

import { useCaptureEditor } from "../lib/editor/tiptap";

type ResizeDir =
  | "North"
  | "South"
  | "East"
  | "West"
  | "NorthEast"
  | "NorthWest"
  | "SouthEast"
  | "SouthWest";

const RESIZE_HANDLES: { dir: ResizeDir; className: string }[] = [
  { dir: "North", className: "capture-resize capture-resize--n" },
  { dir: "South", className: "capture-resize capture-resize--s" },
  { dir: "East", className: "capture-resize capture-resize--e" },
  { dir: "West", className: "capture-resize capture-resize--w" },
  { dir: "NorthEast", className: "capture-resize capture-resize--ne" },
  { dir: "NorthWest", className: "capture-resize capture-resize--nw" },
  { dir: "SouthEast", className: "capture-resize capture-resize--se" },
  { dir: "SouthWest", className: "capture-resize capture-resize--sw" },
];

function startResize(dir: ResizeDir) {
  return (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    console.log("[resize] start", dir);
    getCurrentWindow()
      .startResizeDragging(dir)
      .then(() => console.log("[resize] resolved", dir))
      .catch((err) => console.error("[resize] rejected", dir, err));
  };
}
import {
  captureReady,
  deleteNote,
  hideCapture,
  listNotes,
  loadNote,
  type NoteMeta,
  saveNote,
} from "../lib/ipc";

const SAVE_DEBOUNCE_MS = 400;
const TOOLTIP_DELAY_MS = 350;

const HOVER_EASE: [number, number, number, number] = [0.23, 1, 0.32, 1];
const HOVER_BG = "rgba(0, 0, 0, 0.06)";
const TRANSPARENT = "rgba(0, 0, 0, 0)";

function stripMarkdownInline(line: string): string {
  return line
    .replace(/^#{1,6}\s+/, "")
    .replace(/^[-*+]\s+(\[[ xX]\]\s+)?/, "")
    .replace(/^\d+\.\s+/, "")
    .replace(/^>\s+/, "")
    .replace(/~~([^~]+)~~/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .trim();
}

function deriveTitle(doc: string): string {
  for (const raw of doc.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const cleaned = stripMarkdownInline(line);
    if (cleaned) return cleaned.slice(0, 80);
  }
  return "New note";
}

function formatRelative(unixSeconds: number): string {
  if (!unixSeconds) return "";
  const diff = Date.now() / 1000 - unixSeconds;
  if (diff < 60) return "now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d`;
  const d = new Date(unixSeconds * 1000);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

type Popover = null | "shortcuts" | "notes";

export default function CaptureEditor() {
  const docRef = useRef<string>("");
  const dirtyRef = useRef<boolean>(false);
  const currentPathRef = useRef<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [charCount, setCharCount] = useState(0);
  const [title, setTitle] = useState("New note");
  const [popover, setPopover] = useState<Popover>(null);
  const [notes, setNotes] = useState<NoteMeta[]>([]);

  const flushSave = useCallback(async () => {
    if (!dirtyRef.current) return;
    const content = docRef.current.trim();
    if (!content) return;
    try {
      const result = await saveNote(docRef.current, currentPathRef.current);
      currentPathRef.current = result.path;
      dirtyRef.current = false;
    } catch (err) {
      console.error("save_note failed", err);
    }
  }, []);

  const editor = useCaptureEditor({
    onChange: (doc) => {
      docRef.current = doc;
      dirtyRef.current = true;
      setCharCount(doc.length);
      setTitle(deriveTitle(doc));
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => void flushSave(), SAVE_DEBOUNCE_MS);
    },
    onEscape: () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      flushSave().finally(() => {
        hideCapture().catch((err) => console.error("hide_capture failed", err));
      });
    },
  });

  // Focus + announce ready as soon as the editor instance is available.
  useEffect(() => {
    if (!editor) return;
    editor.commands.focus();
    captureReady().catch(() => {});
  }, [editor]);

  // Flush on window blur and on unmount.
  useEffect(() => {
    const onWindowBlur = () => void flushSave();
    window.addEventListener("blur", onWindowBlur);
    return () => {
      window.removeEventListener("blur", onWindowBlur);
      if (saveTimer.current) clearTimeout(saveTimer.current);
      void flushSave();
    };
  }, [flushSave]);

  useEffect(() => {
    if (!popover) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setPopover(null);
        editor?.commands.focus();
      }
    };
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest(".pap-popover") || target?.closest(".capture-titlebar__icons")) return;
      setPopover(null);
    };
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("mousedown", onClick);
    };
  }, [popover]);

  const openShortcuts = () => {
    setPopover((p: Popover) => (p === "shortcuts" ? null : "shortcuts"));
  };

  // Always-fresh refs for the action handlers — the keybinding effect runs
  // once (no deps) so it captures these via the ref, not stale closures.
  const actionsRef = useRef({
    openNotes: () => {},
    handleNew: () => {},
    handleOpenLastOrNew: () => {},
    focusEditor: () => {},
  });

  const refreshNotes = useCallback(async () => {
    try {
      const list = await listNotes();
      setNotes(list);
    } catch (err) {
      console.error("list_notes failed", err);
      setNotes([]);
    }
  }, []);

  const openNotes = async () => {
    if (popover === "notes") {
      setPopover(null);
      return;
    }
    await refreshNotes();
    setPopover("notes");
  };

  const handleNew = async () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    await flushSave();
    if (!editor) return;
    editor.commands.clearContent(false);
    docRef.current = "";
    dirtyRef.current = false;
    currentPathRef.current = null;
    setCharCount(0);
    setTitle("New note");
    setPopover(null);
    editor.commands.focus();
  };

  const handleOpenNote = async (path: string) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    await flushSave();
    try {
      const content = await loadNote(path);
      if (!editor) return;
      editor.commands.setContent(content, {
        contentType: "markdown",
        emitUpdate: false,
      });
      docRef.current = content;
      dirtyRef.current = false;
      currentPathRef.current = path;
      setCharCount(content.length);
      setTitle(deriveTitle(content));
      setPopover(null);
      editor.commands.focus();
    } catch (err) {
      console.error("load_note failed", err);
    }
  };

  const handleOpenLastOrNew = useCallback(async () => {
    try {
      const list = await listNotes();
      if (list.length > 0) {
        await handleOpenNote(list[0].path);
        return;
      }
    } catch (err) {
      console.error("list_notes failed", err);
    }
    await handleNew();
  }, []);

  // Keep the keybinding effect's refs pointed at the latest handlers.
  actionsRef.current.openNotes = openNotes;
  actionsRef.current.handleNew = handleNew;
  actionsRef.current.handleOpenLastOrNew = handleOpenLastOrNew;
  actionsRef.current.focusEditor = () => editor?.commands.focus();

  // Backend → frontend: global hotkey (⌃⌥N) — resume most recent note or start fresh.
  useEffect(() => {
    const win = getCurrentWindow();
    const unlistenPromise = win.listen("pap://open-last-or-new", () => {
      void actionsRef.current.handleOpenLastOrNew();
    });
    return () => {
      unlistenPromise.then((u) => u()).catch(() => {});
    };
  }, []);

  // WebKit weakens `backdrop-filter` on unfocused windows (no CSS opt-out), so
  // the panel turns too transparent when it loses focus. Flag focus state on the
  // root element so CSS can raise the shell's background opacity to compensate,
  // keeping the frosted look roughly constant like Raycast.
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.winFocused = "true";
    const win = getCurrentWindow();
    const unlistenPromise = win.onFocusChanged(({ payload: focused }) => {
      root.dataset.winFocused = focused ? "true" : "false";
    });
    return () => {
      unlistenPromise.then((u) => u()).catch(() => {});
    };
  }, []);

  // Global shortcuts: ⌘K (shortcuts panel), ⌘O (notes list), ⌘N (new note).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.shiftKey || e.altKey) return;
      const key = e.key.toLowerCase();
      if (key === "k") {
        e.preventDefault();
        e.stopPropagation();
        setPopover((p) => {
          const next = p === "shortcuts" ? null : "shortcuts";
          if (next === null) actionsRef.current.focusEditor();
          return next;
        });
      } else if (key === "o") {
        e.preventDefault();
        e.stopPropagation();
        void actionsRef.current.openNotes();
      } else if (key === "n") {
        e.preventDefault();
        e.stopPropagation();
        void actionsRef.current.handleNew();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, []);

  const handleDeleteNote = async (path: string) => {
    try {
      await deleteNote(path);
      // If the deleted note is the currently open one, clear the editor too.
      if (currentPathRef.current === path) {
        editor?.commands.clearContent(false);
        docRef.current = "";
        dirtyRef.current = false;
        currentPathRef.current = null;
        setCharCount(0);
        setTitle("New note");
      }
      await refreshNotes();
    } catch (err) {
      console.error("delete_note failed", err);
    }
  };

  return (
    <div className="capture-window">
      {RESIZE_HANDLES.map((h) => (
        <div
          key={h.dir}
          className={h.className}
          onMouseDown={startResize(h.dir)}
        />
      ))}
      <div className="capture-shell">
        <header className="capture-titlebar" data-tauri-drag-region>
          <div className="capture-titlebar__title" data-tauri-drag-region>
            {title}
          </div>
          <div className="capture-titlebar__icons">
            <IconButton label="Shortcuts" shortcut="⌘K" onClick={openShortcuts}>
              <span className="cmd-glyph">⌘</span>
            </IconButton>
            <IconButton label="Notes" shortcut="⌘O" onClick={openNotes}>
              <NotesIcon />
            </IconButton>
            <IconButton label="New note" shortcut="⌘N" onClick={handleNew}>
              <PlusIcon />
            </IconButton>
          </div>
          <AnimatePresence>
            {popover === "shortcuts" && <ShortcutsPopover key="shortcuts" />}
            {popover === "notes" && (
              <NotesPopover
                key="notes"
                notes={notes}
                onPick={handleOpenNote}
                onDelete={handleDeleteNote}
              />
            )}
          </AnimatePresence>
        </header>
        <EditorContent editor={editor} className="editor-host" />
        <footer className="capture-hints" aria-hidden="true">
          <span className="capture-hints__count">{charCount} characters</span>
          <button type="button" className="capture-hints__format" title="Formatting">
            T
          </button>
        </footer>
      </div>
    </div>
  );
}

function IconButton({
  label,
  shortcut,
  onClick,
  children,
}: {
  label: string;
  shortcut?: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const portalRef = useRef<HTMLDivElement>(null);
  const [tipAnchor, setTipAnchor] = useState<{ top: number; left: number } | null>(null);
  const tipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // Clamp the tooltip into the viewport after first paint so right-edge icons
  // don't push it past the OS window bounds.
  useLayoutEffect(() => {
    if (!tipAnchor || !portalRef.current) return;
    const tipRect = portalRef.current.getBoundingClientRect();
    const halfWidth = tipRect.width / 2;
    const pad = 8;
    const minLeft = pad + halfWidth;
    const maxLeft = window.innerWidth - pad - halfWidth;
    if (tipAnchor.left < minLeft - 0.5 || tipAnchor.left > maxLeft + 0.5) {
      const clamped = Math.max(minLeft, Math.min(tipAnchor.left, maxLeft));
      setTipAnchor({ top: tipAnchor.top, left: clamped });
    }
  }, [tipAnchor]);

  const computeAnchor = () => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return { top: rect.top - 6, left: rect.left + rect.width / 2 };
  };

  const onHoverStart = () => {
    if (tipTimer.current) clearTimeout(tipTimer.current);
    tipTimer.current = setTimeout(() => {
      const anchor = computeAnchor();
      if (anchor) setTipAnchor(anchor);
    }, TOOLTIP_DELAY_MS);
  };
  const onHoverEnd = () => {
    if (tipTimer.current) clearTimeout(tipTimer.current);
    setTipAnchor(null);
  };

  return (
    <div className="capture-titlebar__icon-wrap">
      <motion.button
        ref={buttonRef}
        type="button"
        aria-label={label}
        onClick={() => {
          onHoverEnd();
          onClick();
        }}
        onHoverStart={onHoverStart}
        onHoverEnd={onHoverEnd}
        className="capture-titlebar__icon"
        initial={{ backgroundColor: TRANSPARENT }}
        whileHover={{ backgroundColor: HOVER_BG }}
        whileTap={{ scale: 0.94 }}
        transition={{ duration: 0.08, ease: HOVER_EASE }}
      >
        {children}
      </motion.button>
      {mounted &&
        createPortal(
          <AnimatePresence>
            {tipAnchor && (
              <div
                ref={portalRef}
                className="pap-tooltip-portal"
                style={{ top: tipAnchor.top, left: tipAnchor.left }}
              >
                <motion.div
                  className="pap-tooltip"
                  initial={{ opacity: 0, y: 4, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 4, scale: 0.97, transition: { duration: 0.1 } }}
                  transition={{ duration: 0.15, ease: HOVER_EASE }}
                  style={{ transformOrigin: "bottom center" }}
                >
                  <span>{label}</span>
                  {shortcut &&
                    Array.from(shortcut).map((key, i) => (
                      <kbd key={i} className="pap-tooltip__kbd">
                        {key}
                      </kbd>
                    ))}
                </motion.div>
              </div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </div>
  );
}

const SHORTCUT_ROWS: Array<[string, string]> = [
  ["Capture", "⌃⌥N"],
  ["Save & close", "Esc"],
  ["Bold", "⌘B"],
  ["Italic", "⌘I"],
  ["Inline code", "⌘E"],
  ["Strikethrough", "⌘⇧X"],
  ["New note", "＋"],
];

function ShortcutsPopover() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const first = containerRef.current?.querySelector<HTMLElement>(
      ".pap-popover__row",
    );
    first?.focus();
  }, []);

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const items = Array.from(
      containerRef.current?.querySelectorAll<HTMLElement>(".pap-popover__row") ??
        [],
    );
    if (items.length === 0) return;
    const active = document.activeElement as HTMLElement | null;
    const idx = active ? items.indexOf(active) : -1;
    const next =
      e.key === "ArrowDown"
        ? items[(idx + 1 + items.length) % items.length]
        : items[(idx - 1 + items.length) % items.length];
    next?.focus();
  };

  return (
    <motion.div
      ref={containerRef}
      className="pap-popover"
      role="menu"
      onKeyDown={onKeyDown}
      initial={{ opacity: 0, y: -4, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -4, scale: 0.97, transition: { duration: 0.1 } }}
      transition={{ duration: 0.16, ease: HOVER_EASE }}
    >
      {SHORTCUT_ROWS.map(([label, keys]) => (
        <div
          className="pap-popover__row"
          role="menuitem"
          tabIndex={0}
          key={label}
        >
          <span className="pap-popover__label">{label}</span>
          <span className="pap-popover__meta">{keys}</span>
        </div>
      ))}
    </motion.div>
  );
}

function NotesPopover({
  notes,
  onPick,
  onDelete,
}: {
  notes: NoteMeta[];
  onPick: (path: string) => void;
  onDelete: (path: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const first = containerRef.current?.querySelector<HTMLElement>(
      ".pap-popover__pick",
    );
    first?.focus();
  }, [notes.length]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const picks = Array.from(
      containerRef.current?.querySelectorAll<HTMLElement>(".pap-popover__pick") ??
        [],
    );
    if (picks.length === 0) return;

    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const active = document.activeElement as HTMLElement | null;
      const activePick = active?.closest<HTMLElement>(".pap-popover__pick") ??
        active;
      const idx = activePick ? picks.indexOf(activePick) : -1;
      const next =
        e.key === "ArrowDown"
          ? picks[(idx + 1 + picks.length) % picks.length]
          : picks[(idx - 1 + picks.length) % picks.length];
      next?.focus();
      return;
    }

    // Control + Delete (or Control + Backspace, which is the main delete key on
    // Mac) on the focused row → trigger the existing two-step delete flow.
    if (e.ctrlKey && (e.key === "Backspace" || e.key === "Delete")) {
      e.preventDefault();
      const active = document.activeElement as HTMLElement | null;
      const row = active?.closest<HTMLElement>(".pap-popover__row");
      const deleteBtn = row?.querySelector<HTMLButtonElement>(
        ".pap-popover__delete",
      );
      deleteBtn?.click();
    }
  };

  return (
    <motion.div
      ref={containerRef}
      className="pap-popover"
      role="menu"
      onKeyDown={onKeyDown}
      initial={{ opacity: 0, y: -4, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -4, scale: 0.97, transition: { duration: 0.1 } }}
      transition={{ duration: 0.16, ease: HOVER_EASE }}
    >
      {notes.length === 0 ? (
        <div className="pap-popover__empty">No notes yet</div>
      ) : (
        notes.map((n) => (
          <NoteRow key={n.path} note={n} onPick={onPick} onDelete={onDelete} />
        ))
      )}
    </motion.div>
  );
}

function NoteRow({
  note,
  onPick,
  onDelete,
}: {
  note: NoteMeta;
  onPick: (path: string) => void;
  onDelete: (path: string) => void;
}) {
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="pap-popover__row pap-popover__row--note">
      <button
        type="button"
        className="pap-popover__pick"
        onClick={() => onPick(note.path)}
      >
        <span className="pap-popover__label">{note.title || "Untitled"}</span>
        <span className="pap-popover__meta">{formatRelative(note.updated_at)}</span>
      </button>
      <motion.button
        type="button"
        aria-label={confirm ? "Confirm delete" : "Delete note"}
        className={`pap-popover__delete${confirm ? " is-confirm" : ""}`}
        onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
          e.stopPropagation();
          if (confirm) {
            onDelete(note.path);
            setConfirm(false);
          } else {
            setConfirm(true);
            setTimeout(() => setConfirm(false), 2500);
          }
        }}
        whileTap={{ scale: 0.9 }}
        transition={{ duration: 0.12, ease: HOVER_EASE }}
      >
        <TrashIcon />
      </motion.button>
    </div>
  );
}

function NotesIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="2.5" width="9" height="11" rx="1.4" />
      <path d="M5 5.5h5M5 8h5M5 10.5h3.2" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 3.5v9M3.5 8h9" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5">
      <path d="M3 4.5h10M6.5 4V3.2c0-.5.4-.7.8-.7h1.4c.4 0 .8.2.8.7V4M5 4.5l.6 8c0 .5.4.8.9.8h3c.5 0 .9-.3.9-.8l.6-8" />
    </svg>
  );
}
