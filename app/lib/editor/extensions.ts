import {
  Extension,
  type JSONContent,
  type MarkdownParseHelpers,
  type MarkdownRendererHelpers,
  type MarkdownToken,
} from "@tiptap/core";
import { Heading } from "@tiptap/extension-heading";
import { Highlight } from "@tiptap/extension-highlight";
import { Link } from "@tiptap/extension-link";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { Paragraph } from "@tiptap/extension-paragraph";
import { Table, TableCell, TableHeader, TableRow } from "@tiptap/extension-table";
import { Typography } from "@tiptap/extension-typography";
import { Placeholder } from "@tiptap/extensions";
import { Markdown } from "@tiptap/markdown";
import { Fragment, Slice } from "@tiptap/pm/model";
import { Plugin } from "@tiptap/pm/state";
import { StarterKit } from "@tiptap/starter-kit";

import { getCurrentLocale } from "../i18n";
import { translate } from "../i18n/messages";
import { toggleLink } from "./commands";
import { SlashCommand } from "./slashCommand";
import { Caret } from "./extensions/caret";
import { MarkdownImage } from "./extensions/markdown-image";

export { setAttachmentsBase } from "./extensions/markdown-image";

// Custom editor keymaps kept in one place so they're discoverable (and could
// drive a future "shortcuts" display).
const KEYMAPS = {
  highlight: "Mod-Shift-h",
  toggleTask: "Mod-Enter",
  link: "Mod-l",
} as const;

// Extension stack for the Papering capture editor.
//
// StarterKit (v3) already includes: Document, Paragraph, Text, Bold, Italic,
// Strike, Code, CodeBlock, Heading, BulletList, OrderedList, ListItem,
// Blockquote, HardBreak, HorizontalRule, History, Dropcursor, Gapcursor,
// Link, ListKeymap, Underline, TrailingNode.
//
// Heading is disabled here and re-imported standalone so we can override its
// keymap (Backspace at parentOffset 0 → setParagraph, Notion-style revert).
// Strike keeps StarterKit's ⇧⌘S, which is also Raycast Notes' shortcut.
//
// Input rules (`# `, `## `, `### `, `- `, `1. `, `> `, ```` ``` ````, `**`,
// `*`, `~~`, `` ` ``) are built into StarterKit and **consume** the
// trigger characters — true Notion-style WYSIWYG.
//
// Markdown parsing/serialization is the official `@tiptap/markdown` extension
// (marked-based). Content loads via `setContent(md, { contentType: "markdown" })`
// and serializes via `editor.getMarkdown()`. `==text==` highlight is non-standard
// markdown, so we register a custom tokenizer + parse/render spec on Highlight.

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

// A paragraph whose text starts with `1. ` would reload as an ordered list, so
// the marker's dot is escaped on save. `EscapeToken` reads it back.
const renderParagraph = Paragraph.config.renderMarkdown;
const MarkdownParagraph = Paragraph.extend({
  renderMarkdown: (node, helpers, ctx) =>
    (renderParagraph?.(node, helpers, ctx) ?? "").replace(/^(\d+)\.(?=\s)/, "$1\\."),
});

// @tiptap/markdown has no handler for marked's `escape` token, so `1\. a`
// loaded as "1 a". Map it back to its literal character.
const EscapeToken = Extension.create({
  name: "markdownEscape",
  markdownTokenName: "escape",
  parseMarkdown: (token: MarkdownToken) => ({ type: "text", text: token.text ?? "" }),
});

// Markdown joins consecutive lines into one paragraph, but a pasted line break
// should stay a line break, as it does when typed. Split paragraphs at "\n".
function splitSoftBreaks(nodes: JSONContent[]): JSONContent[] {
  return nodes.flatMap((node) => {
    if (node.type !== "paragraph") {
      return node.content ? [{ ...node, content: splitSoftBreaks(node.content) }] : [node];
    }
    const lines: JSONContent[][] = [[]];
    for (const child of node.content ?? []) {
      const parts = child.type === "text" ? (child.text ?? "").split("\n") : [null];
      parts.forEach((part, i) => {
        if (i > 0) lines.push([]);
        if (part === null) lines[lines.length - 1].push(child);
        else if (part) lines[lines.length - 1].push({ ...child, text: part });
      });
    }
    return lines.map((content) => ({ ...node, content }));
  });
}

// ProseMirror inserts plain-text paste verbatim, so pasted markdown (`1. foo`,
// `- [ ] task`) never became structure. Parse it as markdown instead, except
// inside code blocks and when the clipboard carries HTML or files.
const MarkdownPaste = Extension.create({
  name: "markdownPaste",
  addProseMirrorPlugins() {
    const editor = this.editor;
    return [
      new Plugin({
        props: {
          handlePaste: (view, event) => {
            const data = event.clipboardData;
            if (!data || data.files.length > 0 || data.getData("text/html")) return false;
            const text = data.getData("text/plain");
            if (!text || !editor.markdown) return false;
            if (view.state.selection.$from.parent.type.spec.code) return false;
            const blocks = splitSoftBreaks(editor.markdown.parse(text).content ?? []);
            // The uiEvent meta keeps paste rules (link detection) running.
            if (blocks.some((b) => b.type !== "paragraph")) {
              return editor
                .chain()
                .command(({ tr }) => !!tr.setMeta("uiEvent", "paste"))
                .insertContent(blocks)
                .run();
            }
            // Plain lines paste as an open slice, like ProseMirror's own text
            // paste, so the first and last lines merge into the current one.
            const { schema, tr } = view.state;
            const nodes = blocks.map((b) => schema.nodeFromJSON(b));
            tr.replaceSelection(Slice.maxOpen(Fragment.fromArray(nodes)));
            view.dispatch(tr.setMeta("uiEvent", "paste").scrollIntoView());
            return true;
          },
        },
      }),
    ];
  },
});

// Raycast Notes shortcuts. The high priority puts ⌘Enter ahead of HardBreak,
// which also binds it; outside a task item it falls through to a line break.
const NoteShortcuts = Extension.create({
  name: "noteShortcuts",
  priority: 1000,
  addKeyboardShortcuts() {
    return {
      [KEYMAPS.toggleTask]: ({ editor }) => {
        const { $from } = editor.state.selection;
        for (let depth = $from.depth; depth > 0; depth--) {
          const node = $from.node(depth);
          if (node.type.name !== "taskItem") continue;
          const pos = $from.before(depth);
          return editor.commands.command(({ tr }) => {
            tr.setNodeAttribute(pos, "checked", !node.attrs.checked);
            return true;
          });
        }
        return false;
      },
      [KEYMAPS.link]: ({ editor }) => {
        toggleLink(editor);
        return true;
      },
    };
  },
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
    paragraph: false,
    link: false,
  }),
  MarkdownParagraph,
  CustomHeading.configure({ levels: [1, 2, 3] }),
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
  EscapeToken,
  MarkdownPaste,
  NoteShortcuts,
  Caret,
  // Tables (GFM). v3's @tiptap/extension-table ships parseMarkdown/renderMarkdown,
  // so they round-trip through @tiptap/markdown with no custom spec.
  Table,
  TableRow,
  TableHeader,
  TableCell,
  SlashCommand,
];
