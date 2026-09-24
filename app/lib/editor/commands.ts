import type { ChainedCommands, Editor, Range } from "@tiptap/core";

import { getCurrentLocale } from "../i18n";
import type { MessageKey } from "../i18n/messages";

export type EditorCommand = {
  id: string;
  run: (editor: Editor, range?: Range) => void;
  slash?: { title: MessageKey; hint: MessageKey; glyph: string };
  context?: { label: MessageKey; shortcut?: string };
};

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

function formatToday(): string {
  const locale = getCurrentLocale() === "pt" ? "pt-BR" : "en-US";
  return new Date().toLocaleDateString(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

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

export const MARK_COMMANDS: EditorCommand[] = [
  chainCommand({ id: "bold", context: { label: "ctx.bold", shortcut: "⌘B" } }, (c) => c.toggleBold()),
  chainCommand({ id: "italic", context: { label: "ctx.italic", shortcut: "⌘I" } }, (c) => c.toggleItalic()),
  chainCommand({ id: "code", context: { label: "ctx.code", shortcut: "⌘E" } }, (c) => c.toggleCode()),
  chainCommand({ id: "strike", context: { label: "ctx.strike", shortcut: "⇧⌘S" } }, (c) => c.toggleStrike()),
  chainCommand({ id: "highlight", context: { label: "ctx.highlight" } }, (c) => c.toggleHighlight()),
  { id: "link", context: { label: "ctx.link", shortcut: "⌘L" }, run: (editor) => toggleLink(editor) },
  { id: "clearFormat", context: { label: "ctx.clearFormat" }, run: (editor) => clearFormatting(editor) },
];

const COMMANDS_BY_ID = new Map<string, EditorCommand>(
  [...BLOCK_COMMANDS, ...MARK_COMMANDS].map((cmd) => [cmd.id, cmd]),
);

export function commandById(id: string): EditorCommand {
  const cmd = COMMANDS_BY_ID.get(id);
  if (!cmd) throw new Error(`unknown editor command: ${id}`);
  return cmd;
}
