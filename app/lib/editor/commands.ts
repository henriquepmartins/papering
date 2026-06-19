import type { ChainedCommands, Editor, Range } from "@tiptap/core";

import { getCurrentLocale } from "../i18n";
import type { MessageKey } from "../i18n/messages";

// One canonical description of every editor action that more than one surface
// invokes — the slash menu and the right-click menu. Each surface differs only
// in presentation (labels, glyphs, shortcuts) and in whether the slash query
// range must be deleted first; the *behaviour* lives here once. The format bar
// is intentionally NOT modelled here: its heading buttons toggle (rather than
// set) and it tracks active state, so it keeps its own list and only reuses the
// shared `toggleLink` / `clearFormatting` helpers below.

export type EditorCommand = {
  id: string;
  /** Run the action. The slash menu passes its suggestion `range`. */
  run: (editor: Editor, range?: Range) => void;
  /** Slash-menu presentation. Omitted for commands the slash menu doesn't show. */
  slash?: { title: MessageKey; hint: MessageKey; glyph: string };
  /** Context-menu presentation. Omitted for commands the menu doesn't show. */
  context?: { label: MessageKey; shortcut?: string };
};

// Build a command whose effect is a chain transform. The slash menu passes the
// suggestion `range` so the "/query" text is removed first; the context menu
// doesn't — the same transform serves both.
function chainCommand(
  spec: Omit<EditorCommand, "run">,
  apply: (chain: ChainedCommands) => ChainedCommands,
): EditorCommand {
  return {
    ...spec,
    run: (editor, range) => {
      const chain = editor.chain().focus();
      if (range) chain.deleteRange(range);
      apply(chain).run();
    },
  };
}

// ── Link & clear: shared helpers ─────────────────────────────────────────────
// These need full editor control (a prompt / multiple chains), so they're plain
// functions reused by both the registry below and the format bar.

export function toggleLink(editor: Editor): void {
  if (editor.isActive("link")) {
    editor.chain().focus().unsetLink().run();
    return;
  }
  const url = typeof window !== "undefined" ? window.prompt("URL") : null;
  if (url) editor.chain().focus().setLink({ href: url }).run();
}

export function clearFormatting(editor: Editor): void {
  editor.chain().focus().unsetAllMarks().clearNodes().run();
}

// Today's date, written out in the active locale (e.g. "19 de junho de 2026" /
// "June 19, 2026").
function formatToday(): string {
  const locale = getCurrentLocale() === "pt" ? "pt-BR" : "en-US";
  return new Date().toLocaleDateString(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// ── Block-level commands ─────────────────────────────────────────────────────
// Shown in the slash menu; the subset with a `context` entry also appears in the
// right-click "Insert" group (in this order).

export const BLOCK_COMMANDS: EditorCommand[] = [
  chainCommand(
    {
      id: "h1",
      slash: { title: "slash.heading1", hint: "slash.heading1.hint", glyph: "H1" },
      context: { label: "ctx.insertHeading" },
    },
    (c) => c.setNode("heading", { level: 1 }),
  ),
  chainCommand(
    { id: "h2", slash: { title: "slash.heading2", hint: "slash.heading2.hint", glyph: "H2" } },
    (c) => c.setNode("heading", { level: 2 }),
  ),
  chainCommand(
    { id: "h3", slash: { title: "slash.heading3", hint: "slash.heading3.hint", glyph: "H3" } },
    (c) => c.setNode("heading", { level: 3 }),
  ),
  chainCommand(
    {
      id: "bullet",
      slash: { title: "slash.bulletList", hint: "slash.bulletList.hint", glyph: "•" },
      context: { label: "ctx.insertBulletList" },
    },
    (c) => c.toggleBulletList(),
  ),
  chainCommand(
    { id: "ordered", slash: { title: "slash.orderedList", hint: "slash.orderedList.hint", glyph: "1." } },
    (c) => c.toggleOrderedList(),
  ),
  chainCommand(
    {
      id: "task",
      slash: { title: "slash.taskList", hint: "slash.taskList.hint", glyph: "☑" },
      context: { label: "ctx.insertTaskList" },
    },
    (c) => c.toggleTaskList(),
  ),
  chainCommand(
    {
      id: "quote",
      slash: { title: "slash.quote", hint: "slash.quote.hint", glyph: "❝" },
      context: { label: "ctx.insertQuote" },
    },
    (c) => c.toggleBlockquote(),
  ),
  chainCommand(
    { id: "codeBlock", slash: { title: "slash.codeBlock", hint: "slash.codeBlock.hint", glyph: "</>" } },
    (c) => c.toggleCodeBlock(),
  ),
  chainCommand(
    { id: "divider", slash: { title: "slash.divider", hint: "slash.divider.hint", glyph: "—" } },
    (c) => c.setHorizontalRule(),
  ),
  chainCommand(
    { id: "table", slash: { title: "slash.table", hint: "slash.table.hint", glyph: "▦" } },
    (c) => c.insertTable({ rows: 3, cols: 3, withHeaderRow: true }),
  ),
  chainCommand(
    {
      id: "date",
      slash: { title: "slash.date", hint: "slash.date.hint", glyph: "📅" },
      context: { label: "ctx.insertDate" },
    },
    (c) => c.insertContent(formatToday()),
  ),
];

// ── Mark / inline commands ───────────────────────────────────────────────────
// Shown in the right-click menu when there's a selection.

export const MARK_COMMANDS: EditorCommand[] = [
  chainCommand({ id: "bold", context: { label: "ctx.bold", shortcut: "⌘B" } }, (c) => c.toggleBold()),
  chainCommand({ id: "italic", context: { label: "ctx.italic", shortcut: "⌘I" } }, (c) => c.toggleItalic()),
  chainCommand({ id: "code", context: { label: "ctx.code", shortcut: "⌘E" } }, (c) => c.toggleCode()),
  chainCommand({ id: "strike", context: { label: "ctx.strike", shortcut: "⌘⇧X" } }, (c) => c.toggleStrike()),
  chainCommand({ id: "highlight", context: { label: "ctx.highlight" } }, (c) => c.toggleHighlight()),
  { id: "link", context: { label: "ctx.link" }, run: (editor) => toggleLink(editor) },
  { id: "clearFormat", context: { label: "ctx.clearFormat" }, run: (editor) => clearFormatting(editor) },
];

const COMMANDS_BY_ID = new Map<string, EditorCommand>(
  [...BLOCK_COMMANDS, ...MARK_COMMANDS].map((cmd) => [cmd.id, cmd]),
);

/** Look up a command by id. Throws on an unknown id so typos fail loudly. */
export function commandById(id: string): EditorCommand {
  const cmd = COMMANDS_BY_ID.get(id);
  if (!cmd) throw new Error(`unknown editor command: ${id}`);
  return cmd;
}
