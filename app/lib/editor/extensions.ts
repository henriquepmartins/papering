import {
  type JSONContent,
  type MarkdownParseHelpers,
  type MarkdownRendererHelpers,
  type MarkdownToken,
} from "@tiptap/core";
import { Heading } from "@tiptap/extension-heading";
import { Highlight } from "@tiptap/extension-highlight";
import { Link } from "@tiptap/extension-link";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { Strike } from "@tiptap/extension-strike";
import { Table, TableCell, TableHeader, TableRow } from "@tiptap/extension-table";
import { Typography } from "@tiptap/extension-typography";
import { Placeholder } from "@tiptap/extensions";
import { Markdown } from "@tiptap/markdown";
import { StarterKit } from "@tiptap/starter-kit";

import { getCurrentLocale } from "../i18n";
import { translate } from "../i18n/messages";
import { SlashCommand } from "./slashCommand";
import { MarkdownImage } from "./extensions/markdown-image";

export { setAttachmentsBase } from "./extensions/markdown-image";

// Custom editor keymaps kept in one place so they're discoverable (and could
// drive a future "shortcuts" display).
const KEYMAPS = {
  strike: "Mod-Shift-x",
  highlight: "Mod-Shift-h",
} as const;

// Extension stack for the Papering capture editor.
//
// StarterKit (v3) already includes: Document, Paragraph, Text, Bold, Italic,
// Strike, Code, CodeBlock, Heading, BulletList, OrderedList, ListItem,
// Blockquote, HardBreak, HorizontalRule, History, Dropcursor, Gapcursor,
// Link, ListKeymap, Underline, TrailingNode.
//
// Strike and Heading are disabled here and re-imported standalone so we can
// override their keymaps (Strike: ⌘⇧X like the old CodeMirror editor;
// Heading: Backspace at parentOffset 0 → setParagraph, Notion-style revert).
//
// Input rules (`# `, `## `, `### `, `- `, `1. `, `> `, ```` ``` ````, `**`,
// `*`, `~~`, `` ` ``) are built into StarterKit and **consume** the
// trigger characters — true Notion-style WYSIWYG.
//
// Markdown parsing/serialization is the official `@tiptap/markdown` extension
// (marked-based). Content loads via `setContent(md, { contentType: "markdown" })`
// and serializes via `editor.getMarkdown()`. `==text==` highlight is non-standard
// markdown, so we register a custom tokenizer + parse/render spec on Highlight.

const CustomStrike = Strike.extend({
  addKeyboardShortcuts() {
    return {
      [KEYMAPS.strike]: () => this.editor.commands.toggleStrike(),
    };
  },
});

const CustomHeading = Heading.extend({
  addKeyboardShortcuts() {
    const parent = this.parent?.() ?? {};
    return {
      ...parent,
      Backspace: ({ editor }) => {
        const { selection } = editor.state;
        const { $from, empty } = selection;
        if (!empty) return false;
        if ($from.parent.type.name !== "heading") return false;
        if ($from.parentOffset !== 0) return false;
        return editor.commands.setParagraph();
      },
    };
  },
});

// Highlight mark with `==text==` markdown support. The custom tokenizer teaches
// marked to recognise `==…==` (it has no built-in rule), and parse/render map it
// to/from the highlight mark so it round-trips through save/load.
const MarkdownHighlight = Highlight.configure({ multicolor: false }).extend({
  addKeyboardShortcuts() {
    return {
      [KEYMAPS.highlight]: () => this.editor.commands.toggleHighlight(),
    };
  },
  markdownTokenizer: {
    name: "highlight",
    level: "inline",
    start: (src) => src.indexOf("=="),
    tokenize: (src, _tokens, lexer) => {
      const match = /^==(?!=)([\s\S]+?)==/.exec(src);
      if (!match) return undefined;
      return {
        type: "highlight",
        raw: match[0],
        text: match[1],
        tokens: lexer.inlineTokens(match[1]),
      };
    },
  },
  parseMarkdown: (token: MarkdownToken, helpers: MarkdownParseHelpers) =>
    helpers.applyMark("highlight", helpers.parseInline(token.tokens ?? [])),
  renderMarkdown: (node: JSONContent, helpers: MarkdownRendererHelpers) =>
    `==${helpers.renderChildren(node.content ?? [])}==`,
});

// Auto-detected links with markdown round-trip. `autolink` linkifies bare
// domains (e.g. `motion.dev`) as you type; `defaultProtocol` makes their href
// `https://`. `openOnClick: false` keeps clicks from navigating the webview
// (the panel is a notes surface, not a browser). The markdown spec serialises
// to `[text](href)` and parses standard markdown links back.
const MarkdownLink = Link.configure({
  autolink: true,
  openOnClick: false,
  linkOnPaste: true,
  defaultProtocol: "https",
}).extend({
  parseMarkdown: (token: MarkdownToken, helpers: MarkdownParseHelpers) =>
    helpers.applyMark("link", helpers.parseInline(token.tokens ?? []), {
      href: token.href,
      title: token.title ?? null,
    }),
  renderMarkdown: (node: JSONContent, helpers: MarkdownRendererHelpers) =>
    `[${helpers.renderChildren(node.content ?? [])}](${node.attrs?.href ?? ""})`,
});

// Smart typography — only the continuous glyphs the user asked for: arrows
// (`->` → →, `<-` → ←) and em dash (`--` → —). Every other rule (ellipsis,
// smart quotes, ©/™, fractions, ×, etc.) is disabled so markdown/code stay
// untouched.
const MinimalTypography = Typography.configure({
  ellipsis: false,
  openDoubleQuote: false,
  closeDoubleQuote: false,
  openSingleQuote: false,
  closeSingleQuote: false,
  copyright: false,
  registeredTrademark: false,
  trademark: false,
  servicemark: false,
  oneHalf: false,
  oneQuarter: false,
  threeQuarters: false,
  plusMinus: false,
  notEqual: false,
  laquo: false,
  raquo: false,
  multiplication: false,
  superscriptTwo: false,
  superscriptThree: false,
});

export const editorExtensions = [
  StarterKit.configure({
    heading: false,
    strike: false,
    link: false,
  }),
  CustomHeading.configure({ levels: [1, 2, 3] }),
  CustomStrike,
  TaskList,
  TaskItem.configure({ nested: true }),
  // Placeholder text is resolved per-render from the active locale, so it
  // follows a language switch (CaptureEditor dispatches an empty transaction to
  // force the decoration to re-render when the locale changes).
  Placeholder.configure({
    placeholder: () => translate(getCurrentLocale(), "editor.placeholder"),
  }),
  MinimalTypography,
  Markdown.configure({
    markedOptions: { gfm: true, breaks: false },
  }),
  MarkdownHighlight,
  MarkdownLink,
  MarkdownImage,
  // Tables (GFM). v3's @tiptap/extension-table ships parseMarkdown/renderMarkdown,
  // so they round-trip through @tiptap/markdown with no custom spec.
  Table,
  TableRow,
  TableHeader,
  TableCell,
  SlashCommand,
];
