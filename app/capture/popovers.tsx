"use client";

import { useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";

import { useLocale, useT, type MessageKey } from "../lib/i18n";
import { LOCALES } from "../lib/i18n/messages";
import type { NoteMeta } from "../lib/ipc";
import { usePopoverKeyboard } from "./usePopoverKeyboard";
import { HOVER_EASE } from "./ui-motion";
import { TrashIcon } from "./icons";

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

// Motion props for the title-bar popovers. `instant` (keyboard-triggered) skips
// the enter animation entirely; Reduce Motion keeps the opacity fade but drops
// the position/scale movement. Origin is the top-right trigger icons, so it
// scales out from the button rather than from its own center.
function usePopoverMotion(instant: boolean) {
  const reduce = !!useReducedMotion();
  const offset = reduce ? {} : { y: -4, scale: 0.97 };
  return {
    initial: instant ? false : { opacity: 0, ...offset },
    animate: { opacity: 1, y: 0, scale: 1 },
    exit: { opacity: 0, ...offset, transition: { duration: instant ? 0.08 : 0.1 } },
    transition: { duration: instant ? 0 : 0.16, ease: HOVER_EASE },
    style: { transformOrigin: "top right" as const },
  };
}

const SHORTCUT_ROWS: Array<[MessageKey, string]> = [
  ["sc.capture", "⌃⌥N"],
  ["sc.newNote", "⌘N"],
  ["sc.openNotes", "⌘O"],
  ["sc.settings", "⌘,"],
  ["sc.saveClose", "Esc"],
  ["sc.bold", "⌘B"],
  ["sc.italic", "⌘I"],
  ["sc.code", "⌘E"],
  ["sc.strike", "⌘⇧X"],
];

export function ShortcutsPopover({ instant }: { instant: boolean }) {
  const t = useT();
  const containerRef = useRef<HTMLDivElement>(null);
  const motionProps = usePopoverMotion(instant);
  const onKeyDown = usePopoverKeyboard(containerRef, ".pap-popover__row");

  return (
    <motion.div
      ref={containerRef}
      className="pap-popover"
      role="menu"
      onKeyDown={onKeyDown}
      {...motionProps}
    >
      {SHORTCUT_ROWS.map(([key, keys]) => (
        <div
          className="pap-popover__row"
          role="menuitem"
          tabIndex={0}
          key={key}
        >
          <span className="pap-popover__label">{t(key)}</span>
          <span className="pap-popover__meta">{keys}</span>
        </div>
      ))}
    </motion.div>
  );
}

// Settings popover — currently the language picker; room for more preferences.
export function SettingsPopover({ instant }: { instant: boolean }) {
  const t = useT();
  const { locale, setLocale } = useLocale();
  const containerRef = useRef<HTMLDivElement>(null);
  const motionProps = usePopoverMotion(instant);
  const onKeyDown = usePopoverKeyboard(containerRef, ".pap-popover__row--button");

  return (
    <motion.div
      ref={containerRef}
      className="pap-popover"
      role="menu"
      onKeyDown={onKeyDown}
      {...motionProps}
    >
      <div className="pap-popover__section">{t("settings.language")}</div>
      {LOCALES.map((loc) => (
        <button
          type="button"
          key={loc}
          role="menuitemradio"
          aria-checked={locale === loc}
          className="pap-popover__row pap-popover__row--button"
          onClick={() => setLocale(loc)}
        >
          <span className="pap-popover__label">
            {loc === "pt" ? t("settings.lang.pt") : t("settings.lang.en")}
          </span>
          <span className="pap-popover__check">{locale === loc ? "✓" : ""}</span>
        </button>
      ))}
    </motion.div>
  );
}

export function NotesPopover({
  notes,
  onPick,
  onDelete,
  instant,
}: {
  notes: NoteMeta[];
  onPick: (path: string) => void;
  onDelete: (path: string) => void;
  instant: boolean;
}) {
  const t = useT();
  const containerRef = useRef<HTMLDivElement>(null);
  const motionProps = usePopoverMotion(instant);
  const onArrowKey = usePopoverKeyboard(containerRef, ".pap-popover__pick", [
    notes.length,
  ]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    onArrowKey(e);
    // Control + Delete (or Control + Backspace, which is the main delete key on
    // Mac) on the focused row → trigger the existing two-step delete flow.
    if (e.ctrlKey && (e.key === "Backspace" || e.key === "Delete")) {
      e.preventDefault();
      const active = document.activeElement as HTMLElement | null;
      const row = active?.closest<HTMLElement>(".pap-popover__row");
      row?.querySelector<HTMLButtonElement>(".pap-popover__delete")?.click();
    }
  };

  return (
    <motion.div
      ref={containerRef}
      className="pap-popover"
      role="menu"
      onKeyDown={onKeyDown}
      {...motionProps}
    >
      {notes.length === 0 ? (
        <div className="pap-popover__empty">{t("notes.empty")}</div>
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
  const t = useT();
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="pap-popover__row pap-popover__row--note">
      <button
        type="button"
        className="pap-popover__pick"
        onClick={() => onPick(note.path)}
      >
        <span className="pap-popover__label">{note.title || t("note.untitled")}</span>
        <span className="pap-popover__meta">{formatRelative(note.updated_at)}</span>
      </button>
      <motion.button
        type="button"
        aria-label={confirm ? t("notes.confirmDelete") : t("notes.delete")}
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
        whileTap={{ scale: 0.93 }}
        transition={{ duration: 0.12, ease: HOVER_EASE }}
      >
        <TrashIcon />
      </motion.button>
    </div>
  );
}
