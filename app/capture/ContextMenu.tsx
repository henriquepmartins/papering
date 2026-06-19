"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { Editor } from "@tiptap/react";

import { useT } from "../lib/i18n";
import { BLOCK_COMMANDS, commandById } from "../lib/editor/commands";
import { usePopoverKeyboard } from "./usePopoverKeyboard";

const HOVER_EASE: [number, number, number, number] = [0.23, 1, 0.32, 1];

export type ContextAnchor = { x: number; y: number };

type Row =
  | { kind: "separator" }
  | { kind: "item"; label: string; shortcut?: string; run: () => void };

type ContextMenuProps = {
  editor: Editor | null;
  anchor: ContextAnchor;
  onClose: () => void;
  onNewNote: () => void;
  onOpenNotes: () => void;
  onSettings: () => void;
  onShortcuts: () => void;
};

// Reliable clipboard helpers for a WKWebView contenteditable. Copy/cut use
// execCommand (keeps rich content within the editor and works on the live DOM
// selection); paste uses the async Clipboard API (execCommand("paste") is
// blocked by WebKit).
function copySelection(editor: Editor) {
  editor.view.focus();
  document.execCommand("copy");
}
function cutSelection(editor: Editor) {
  editor.view.focus();
  document.execCommand("cut");
}
async function pasteClipboard(editor: Editor) {
  try {
    const text = await navigator.clipboard.readText();
    if (text) editor.chain().focus().insertContent(text).run();
  } catch {
    // Clipboard read may be denied — nothing to paste.
  }
}

export default function ContextMenu({
  editor,
  anchor,
  onClose,
  onNewNote,
  onOpenNotes,
  onSettings,
  onShortcuts,
}: ContextMenuProps) {
  const t = useT();
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<ContextAnchor>(anchor);
  const reduce = !!useReducedMotion();

  const hasSelection = !!editor && !editor.state.selection.empty;

  const act = (fn: () => void) => () => {
    fn();
    onClose();
  };

  const rows: Row[] = [];
  if (editor) {
    const ed = editor;
    // Render a registry command as a menu row, resolving its context-menu label
    // and shortcut.
    const cmdRow = (id: string): Row => {
      const cmd = commandById(id);
      const ctx = cmd.context;
      if (!ctx) throw new Error(`command ${id} has no context presentation`);
      return {
        kind: "item",
        label: t(ctx.label),
        shortcut: ctx.shortcut,
        run: act(() => cmd.run(ed)),
      };
    };

    if (hasSelection) {
      rows.push(
        { kind: "item", label: t("ctx.cut"), run: act(() => cutSelection(ed)) },
        { kind: "item", label: t("ctx.copy"), run: act(() => copySelection(ed)) },
        { kind: "item", label: t("ctx.paste"), run: act(() => void pasteClipboard(ed)) },
        { kind: "separator" },
        ...["bold", "italic", "code", "strike", "highlight", "link"].map(cmdRow),
        { kind: "separator" },
        cmdRow("clearFormat"),
      );
    } else {
      rows.push(
        { kind: "item", label: t("ctx.paste"), run: act(() => void pasteClipboard(ed)) },
        { kind: "separator" },
        ...BLOCK_COMMANDS.filter((c) => c.context).map((c) => cmdRow(c.id)),
        { kind: "separator" },
        { kind: "item", label: t("ctx.newNote"), shortcut: "⌘N", run: act(onNewNote) },
        { kind: "item", label: t("ctx.openNotes"), shortcut: "⌘O", run: act(onOpenNotes) },
        { kind: "item", label: t("ctx.settings"), shortcut: "⌘,", run: act(onSettings) },
        { kind: "item", label: t("ctx.shortcuts"), shortcut: "⌘K", run: act(onShortcuts) },
      );
    }
  }

  // Clamp into the viewport after the menu is measured.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pad = 8;
    const left = Math.min(anchor.x, window.innerWidth - rect.width - pad);
    const top = Math.min(anchor.y, window.innerHeight - rect.height - pad);
    setPos({ x: Math.max(pad, left), y: Math.max(pad, top) });
  }, [anchor]);

  // Focus the first item on mount; wrap focus with arrow keys.
  const onKeyDown = usePopoverKeyboard(ref, ".pap-context__item");

  // Escape / click-outside close.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        editor?.commands.focus();
      }
    };
    const onDown = (e: MouseEvent) => {
      if (!(e.target as HTMLElement | null)?.closest(".pap-context")) onClose();
    };
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("mousedown", onDown, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("mousedown", onDown, true);
    };
  }, [editor, onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      <motion.div
        ref={ref}
        className="pap-popover pap-context"
        role="menu"
        style={{ position: "fixed", top: pos.y, left: pos.x }}
        onKeyDown={onKeyDown}
        initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.97, y: -2 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.08 } }}
        transition={{ duration: 0.13, ease: HOVER_EASE }}
      >
        {rows.map((row, i) =>
          row.kind === "separator" ? (
            <div key={`sep-${i}`} className="pap-context__sep" role="separator" />
          ) : (
            <button
              type="button"
              key={`${row.label}-${i}`}
              role="menuitem"
              className="pap-popover__row pap-popover__row--button pap-context__item"
              onClick={row.run}
            >
              <span className="pap-popover__label">{row.label}</span>
              {row.shortcut && (
                <span className="pap-popover__meta">{row.shortcut}</span>
              )}
            </button>
          ),
        )}
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
}
