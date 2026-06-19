"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { EditorContent, useEditorState, type Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";

import { useCaptureEditor } from "../lib/editor/tiptap";
import { setAttachmentsBase } from "../lib/editor/extensions";
import { checkForUpdates } from "../lib/updater";
import { useLocale, useT, type MessageKey } from "../lib/i18n";
import { clearFormatting, toggleLink } from "../lib/editor/commands";
import { useTooltip } from "./useTooltip";
import { HOVER_EASE, HOVER_BG, TRANSPARENT } from "./ui-motion";
import { ShortcutsPopover, SettingsPopover, NotesPopover } from "./popovers";
import {
  EraserIcon,
  GearIcon,
  LinkIcon,
  MarkerIcon,
  NotesIcon,
  PlusIcon,
} from "./icons";
import ContextMenu, { type ContextAnchor } from "./ContextMenu";
import WelcomeCard from "./WelcomeCard";

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
    // tao's `startResizeDragging` is a no-op on macOS, so resizing goes through
    // a native AppKit drag loop in the Rust `start_resize` command instead.
    invoke("start_resize", { direction: dir }).catch((err) =>
      console.error("[resize] failed", dir, err),
    );
  };
}
import {
  attachmentsBase,
  captureReady,
  deleteNote,
  hideCapture,
  listNotes,
  loadNote,
  type NoteMeta,
  saveNote,
} from "../lib/ipc";

const SAVE_DEBOUNCE_MS = 400;

function stripMarkdownInline(line: string): string {
  return line
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
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

function deriveTitle(doc: string, fallback: string): string {
  for (const raw of doc.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const cleaned = stripMarkdownInline(line);
    if (cleaned) return cleaned.slice(0, 80);
  }
  return fallback;
}

type Popover = null | "shortcuts" | "notes" | "settings";

export default function CaptureEditor() {
  const t = useT();
  const { locale } = useLocale();

  const docRef = useRef<string>("");
  const dirtyRef = useRef<boolean>(false);
  const currentPathRef = useRef<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [charCount, setCharCount] = useState(0);
  const [title, setTitle] = useState(() => t("note.new"));
  const [popover, setPopover] = useState<Popover>(null);
  const [ctxMenu, setCtxMenu] = useState<ContextAnchor | null>(null);
  const [formatOpen, setFormatOpen] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  // Whether the open popover should appear instantly (no enter animation).
  // True when opened via keyboard (⌘K/⌘O) — frequent keyboard actions should
  // never animate (Raycast's launcher has no open animation) — or under
  // Reduce Motion. Mouse-opened popovers keep the subtle scale/slide.
  const [popoverInstant, setPopoverInstant] = useState(false);
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
      setTitle(deriveTitle(doc, t("note.new")));
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

  // Check for app updates once on startup (no-op outside Tauri).
  useEffect(() => {
    void checkForUpdates();
  }, []);

  // Focus + announce ready as soon as the editor instance is available.
  useEffect(() => {
    if (!editor) return;
    editor.commands.focus();
    captureReady().catch(() => {});
    // Cache the attachments base dir so pasted/loaded images resolve to an
    // `asset:` URL before any note with images is opened.
    attachmentsBase()
      .then((dir) => dir && setAttachmentsBase(dir))
      .catch(() => {});
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
    setPopoverInstant(false);
    setPopover((p: Popover) => (p === "shortcuts" ? null : "shortcuts"));
  };

  const openSettings = () => {
    setPopoverInstant(false);
    setPopover((p: Popover) => (p === "settings" ? null : "settings"));
  };

  // Always-fresh refs for the action handlers — the keybinding effect runs
  // once (no deps) so it captures these via the ref, not stale closures.
  const actionsRef = useRef({
    openNotes: (_instant?: boolean) => {},
    handleNew: () => {},
    handleOpenLastOrNew: () => {},
    focusEditor: () => {},
    openSettings: () => {},
    openShortcuts: () => {},
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

  const openNotes = async (instant = false) => {
    if (popover === "notes") {
      setPopover(null);
      return;
    }
    setPopoverInstant(instant);
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
    setTitle(t("note.new"));
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
      setTitle(deriveTitle(content, t("note.new")));
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
  actionsRef.current.openSettings = openSettings;
  actionsRef.current.openShortcuts = openShortcuts;

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

  // Right-click opens our own command menu everywhere (never the WebKit menu,
  // which is an instant "this is a website" tell). The menu is context-aware:
  // formatting/clipboard actions when text is selected, insert + app commands
  // otherwise. Resize bands keep the native cursor but no menu.
  useEffect(() => {
    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      const target = e.target as HTMLElement | null;
      if (target?.closest(".capture-resize")) return;
      setPopover(null);
      setFormatOpen(false);
      setCtxMenu({ x: e.clientX, y: e.clientY });
    };
    document.addEventListener("contextmenu", onContextMenu);
    return () => document.removeEventListener("contextmenu", onContextMenu);
  }, []);

  // Re-render the editor's placeholder decoration and the default title when the
  // language changes (the placeholder reads the locale lazily; an empty
  // transaction forces ProseMirror to recompute the decoration).
  useEffect(() => {
    if (!editor) return;
    editor.view.dispatch(editor.state.tr);
    if (!docRef.current.trim()) setTitle(t("note.new"));
  }, [locale, editor, t]);

  // First-run welcome card (once per install).
  useEffect(() => {
    try {
      if (!window.localStorage.getItem("pap.onboarded")) setShowWelcome(true);
    } catch {
      // Storage unavailable — skip onboarding rather than block the app.
    }
  }, []);

  const dismissWelcome = useCallback(() => {
    setShowWelcome(false);
    try {
      window.localStorage.setItem("pap.onboarded", "1");
    } catch {
      // Ignore — the card simply won't be suppressed next launch.
    }
    editor?.commands.focus();
  }, [editor]);

  // Global shortcuts: ⌘K (shortcuts panel), ⌘O (notes list), ⌘N (new note).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.shiftKey || e.altKey) return;
      const key = e.key.toLowerCase();
      if (key === "k") {
        e.preventDefault();
        e.stopPropagation();
        setPopoverInstant(true); // keyboard-triggered → no enter animation
        setPopover((p) => {
          const next = p === "shortcuts" ? null : "shortcuts";
          if (next === null) actionsRef.current.focusEditor();
          return next;
        });
      } else if (key === "o") {
        e.preventDefault();
        e.stopPropagation();
        void actionsRef.current.openNotes(true); // keyboard → instant
      } else if (key === "n") {
        e.preventDefault();
        e.stopPropagation();
        void actionsRef.current.handleNew();
      } else if (key === ",") {
        // ⌘, → settings (standard macOS Preferences shortcut).
        e.preventDefault();
        e.stopPropagation();
        setPopoverInstant(true);
        setPopover((p) => {
          const next = p === "settings" ? null : "settings";
          if (next === null) actionsRef.current.focusEditor();
          return next;
        });
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
        setTitle(t("note.new"));
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
            <IconButton label={t("btn.shortcuts")} shortcut="⌘K" onClick={openShortcuts}>
              <span className="cmd-glyph">⌘</span>
            </IconButton>
            <IconButton label={t("btn.notes")} shortcut="⌘O" onClick={openNotes}>
              <NotesIcon />
            </IconButton>
            <IconButton label={t("btn.newNote")} shortcut="⌘N" onClick={handleNew}>
              <PlusIcon />
            </IconButton>
            <IconButton label={t("btn.settings")} shortcut="⌘," onClick={openSettings}>
              <GearIcon />
            </IconButton>
          </div>
          <AnimatePresence>
            {popover === "shortcuts" && (
              <ShortcutsPopover key="shortcuts" instant={popoverInstant} />
            )}
            {popover === "notes" && (
              <NotesPopover
                key="notes"
                notes={notes}
                onPick={handleOpenNote}
                onDelete={handleDeleteNote}
                instant={popoverInstant}
              />
            )}
            {popover === "settings" && (
              <SettingsPopover key="settings" instant={popoverInstant} />
            )}
          </AnimatePresence>
        </header>
        <EditorContent editor={editor} className="editor-host" />
        {editor && (
          <BubbleMenu
            editor={editor}
            className="pap-bubble"
            options={{ placement: "top", offset: 8 }}
          >
            <FormatBar editor={editor} />
          </BubbleMenu>
        )}
        <footer className="capture-hints">
          <span className="capture-hints__count" aria-hidden="true">
            {t("hints.characters", { n: charCount })}
          </span>
          <div className="capture-hints__format-wrap">
            <button
              type="button"
              className="capture-hints__format"
              title={t("btn.formatting")}
              aria-label={t("btn.formatting")}
              onClick={() => {
                setPopover(null);
                setCtxMenu(null);
                setFormatOpen((v) => !v);
                editor?.commands.focus();
              }}
            >
              T
            </button>
            <AnimatePresence>
              {formatOpen && editor && (
                <FormatPopover editor={editor} onClose={() => setFormatOpen(false)} />
              )}
            </AnimatePresence>
          </div>
        </footer>
      </div>
      {ctxMenu && (
        <ContextMenu
          editor={editor}
          anchor={ctxMenu}
          onClose={() => setCtxMenu(null)}
          onNewNote={() => void handleNew()}
          onOpenNotes={() => void openNotes()}
          onSettings={openSettings}
          onShortcuts={openShortcuts}
        />
      )}
      <AnimatePresence>
        {showWelcome && <WelcomeCard onDismiss={dismissWelcome} />}
      </AnimatePresence>
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
  const reduce = !!useReducedMotion();
  const {
    anchor: tipAnchor,
    setAnchor: setTipAnchor,
    instant: tipInstant,
    mounted,
    start: onHoverStart,
    end: onHoverEnd,
  } = useTooltip(() => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return { top: rect.top - 6, left: rect.left + rect.width / 2 };
  });

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
  }, [tipAnchor, setTipAnchor]);

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
        whileTap={reduce ? undefined : { scale: 0.94 }}
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
                  initial={
                    tipInstant
                      ? false
                      : { opacity: 0, ...(reduce ? {} : { y: 4, scale: 0.97 }) }
                  }
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{
                    opacity: 0,
                    ...(reduce ? {} : { y: 4, scale: 0.97 }),
                    transition: { duration: tipInstant ? 0 : 0.1 },
                  }}
                  transition={{ duration: tipInstant ? 0 : 0.15, ease: HOVER_EASE }}
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

// Shared formatting controls used by both the selection bubble menu and the
// footer "T" popover. Active states are read reactively via useEditorState so
// the buttons highlight as the cursor moves.
const FORMAT_BUTTONS: {
  key: string;
  glyph: React.ReactNode;
  name: MessageKey;
  mark: string;
  run: (editor: Editor) => void;
}[] = [
  { key: "bold", glyph: "B", name: "ctx.bold", mark: "bold", run: (e) => e.chain().focus().toggleBold().run() },
  { key: "italic", glyph: "I", name: "ctx.italic", mark: "italic", run: (e) => e.chain().focus().toggleItalic().run() },
  { key: "strike", glyph: "S", name: "ctx.strike", mark: "strike", run: (e) => e.chain().focus().toggleStrike().run() },
  { key: "code", glyph: "</>", name: "ctx.code", mark: "code", run: (e) => e.chain().focus().toggleCode().run() },
  { key: "highlight", glyph: <MarkerIcon />, name: "ctx.highlight", mark: "highlight", run: (e) => e.chain().focus().toggleHighlight().run() },
  { key: "h1", glyph: "H1", name: "slash.heading1", mark: "heading-1", run: (e) => e.chain().focus().toggleHeading({ level: 1 }).run() },
  { key: "h2", glyph: "H2", name: "slash.heading2", mark: "heading-2", run: (e) => e.chain().focus().toggleHeading({ level: 2 }).run() },
  { key: "h3", glyph: "H3", name: "slash.heading3", mark: "heading-3", run: (e) => e.chain().focus().toggleHeading({ level: 3 }).run() },
  { key: "bullet", glyph: "•", name: "slash.bulletList", mark: "bulletList", run: (e) => e.chain().focus().toggleBulletList().run() },
  { key: "task", glyph: "☑", name: "slash.taskList", mark: "taskList", run: (e) => e.chain().focus().toggleTaskList().run() },
  { key: "link", glyph: <LinkIcon />, name: "ctx.link", mark: "link", run: (e) => toggleLink(e) },
  { key: "clear", glyph: <EraserIcon />, name: "ctx.clearFormat", mark: "__clear", run: (e) => clearFormatting(e) },
];

function FormatBar({ editor }: { editor: Editor }) {
  const t = useT();
  const active = useEditorState({
    editor,
    selector: ({ editor: ed }) => ({
      bold: ed.isActive("bold"),
      italic: ed.isActive("italic"),
      code: ed.isActive("code"),
      strike: ed.isActive("strike"),
      highlight: ed.isActive("highlight"),
      "heading-1": ed.isActive("heading", { level: 1 }),
      "heading-2": ed.isActive("heading", { level: 2 }),
      "heading-3": ed.isActive("heading", { level: 3 }),
      bulletList: ed.isActive("bulletList"),
      taskList: ed.isActive("taskList"),
      link: ed.isActive("link"),
    }),
  });

  return (
    <div className="pap-format">
      {FORMAT_BUTTONS.map((b) => (
        <FormatTipButton
          key={b.key}
          label={t(b.name)}
          active={!!active[b.mark as keyof typeof active]}
          italic={b.key === "italic"}
          onRun={() => b.run(editor)}
        >
          {b.glyph}
        </FormatTipButton>
      ))}
    </div>
  );
}

// A format button that shows a hover tooltip naming what the glyph does (e.g.
// "H2" → "Heading 2"), since the icons alone aren't obvious to everyone. Mirrors
// the titlebar IconButton tooltip: portal to <body>, short delay, instant when
// gliding across the bar, and flips below the button when there's no room above.
function FormatTipButton({
  label,
  active,
  italic,
  onRun,
  children,
}: {
  label: string;
  active: boolean;
  italic?: boolean;
  onRun: () => void;
  children: React.ReactNode;
}) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const reduce = !!useReducedMotion();
  const {
    anchor: tip,
    instant,
    mounted,
    start,
    end,
  } = useTooltip(() => {
    const rect = btnRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const pad = 8;
    const below = rect.top < 44; // not enough room above → drop below
    const left = Math.max(
      pad + 40,
      Math.min(rect.left + rect.width / 2, window.innerWidth - pad - 40),
    );
    return { top: below ? rect.bottom + 6 : rect.top - 6, left, below };
  });

  const off = tip?.below ? -4 : 4;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        aria-label={label}
        aria-pressed={active}
        className={`pap-format__btn${active ? " is-active" : ""}${
          italic ? " pap-format__btn--i" : ""
        }`}
        onMouseEnter={start}
        onMouseLeave={end}
        onMouseDown={(e) => {
          e.preventDefault();
          end();
          onRun();
        }}
      >
        {children}
      </button>
      {mounted &&
        createPortal(
          <AnimatePresence>
            {tip && (
              <div
                className={`pap-tooltip-portal${tip.below ? " pap-tooltip-portal--below" : ""}`}
                style={{ top: tip.top, left: tip.left }}
              >
                <motion.div
                  className="pap-tooltip"
                  initial={instant ? false : { opacity: 0, ...(reduce ? {} : { y: off, scale: 0.97 }) }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{
                    opacity: 0,
                    ...(reduce ? {} : { y: off, scale: 0.97 }),
                    transition: { duration: instant ? 0 : 0.1 },
                  }}
                  transition={{ duration: instant ? 0 : 0.15, ease: HOVER_EASE }}
                  style={{ transformOrigin: tip.below ? "top center" : "bottom center" }}
                >
                  {label}
                </motion.div>
              </div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </>
  );
}

// Footer "T" popover — same formatting controls, anchored above the button.
function FormatPopover({
  editor,
  onClose,
}: {
  editor: Editor;
  onClose: () => void;
}) {
  const reduce = !!useReducedMotion();

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest(".pap-format-pop") || target?.closest(".capture-hints__format")) {
        return;
      }
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onDown, true);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("mousedown", onDown, true);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [onClose]);

  return (
    <motion.div
      className="pap-format-pop"
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 4, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 4, scale: 0.97, transition: { duration: 0.1 } }}
      transition={{ duration: 0.15, ease: HOVER_EASE }}
      style={{ transformOrigin: "bottom right" }}
    >
      <FormatBar editor={editor} />
    </motion.div>
  );
}

