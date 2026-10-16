import {
  type Editor,
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
import { Plugin, type Transaction } from "@tiptap/pm/state";
import { StarterKit } from "@tiptap/starter-kit";

import { getCurrentLocale } from "../i18n";
import { translate } from "../i18n/messages";
import { toggleLink } from "./commands";
import { SlashCommand } from "./slashCommand";
import { Caret } from "./extensions/caret";
import { MarkdownImage } from "./extensions/markdown-image";

export { setAttachmentsBase } from "./extensions/markdown-image";

const KEYMAPS = {
  highlight: "Mod-Shift-h",
  toggleTask: "Mod-Enter",
  toggleTaskTree: "Mod-Shift-Enter",
  link: "Mod-l",
} as const;

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

const renderParagraph = Paragraph.config.renderMarkdown;
const MarkdownParagraph = Paragraph.extend({
  renderMarkdown: (node, helpers, ctx) =>
    (renderParagraph?.(node, helpers, ctx) ?? "").replace(/^(\d+)\.(?=\s)/, "$1\\."),
});

const EscapeToken = Extension.create({
  name: "markdownEscape",
  markdownTokenName: "escape",
  parseMarkdown: (token: MarkdownToken) => ({ type: "text", text: token.text ?? "" }),
});

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
            if (blocks.some((b) => b.type !== "paragraph")) {
              return editor
                .chain()
                .command(({ tr }) => !!tr.setMeta("uiEvent", "paste"))
                .insertContent(blocks)
                .run();
            }
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

// A ⌘-click is followed by the checkbox's own write to the parent. History merges that write into
// the cascade only when it touches the range of the cascade's last step, so the parent goes last
// and uses setNodeMarkup (an attribute step carries no range).
function toggleTask(tr: Transaction, pos: number, withChildren: boolean) {
  const node = tr.doc.nodeAt(pos);
  if (node?.type.name !== "taskItem") return false;
  const checked = !node.attrs.checked;
  if (withChildren) {
    node.descendants((child, offset) => {
      if (child.type.name !== "taskItem") return;
      tr.setNodeMarkup(pos + 1 + offset, undefined, { ...child.attrs, checked });
    });
  }
  tr.setNodeMarkup(pos, undefined, { ...node.attrs, checked });
  return true;
}

function toggleTaskAtSelection(editor: Editor, withChildren: boolean) {
  const { $from } = editor.state.selection;
  for (let depth = $from.depth; depth > 0; depth--) {
    if ($from.node(depth).type.name !== "taskItem") continue;
    const pos = $from.before(depth);
    return editor.commands.command(({ tr }) => toggleTask(tr, pos, withChildren));
  }
  return false;
}

const NoteShortcuts = Extension.create({
  name: "noteShortcuts",
  priority: 1000,
  addKeyboardShortcuts() {
    return {
      [KEYMAPS.toggleTask]: ({ editor }) => toggleTaskAtSelection(editor, false),
      [KEYMAPS.toggleTaskTree]: ({ editor }) => toggleTaskAtSelection(editor, true),
      [KEYMAPS.link]: ({ editor }) => {
        toggleLink(editor);
        return true;
      },
    };
  },
  addProseMirrorPlugins() {
    return [
      new Plugin({
        props: {
          handleDOMEvents: {
            // Tiptap's change handler, which fires after this, then writes the same value to the
            // parent, so the box keeps its native toggle and the cascade lands in one undo step.
            click: (view, event) => {
              const target = event.target;
              if (!event.metaKey || !view.editable) return false;
              if (!(target instanceof HTMLInputElement) || target.type !== "checkbox") return false;
              const content = target.closest("li")?.querySelector(":scope > div");
              if (!content) return false;
              const tr = view.state.tr;
              if (!toggleTask(tr, view.posAtDOM(content, 0) - 1, true)) return false;
              view.dispatch(tr);
              return false;
            },
          },
        },
      }),
    ];
  },
});

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
  Table,
  TableRow,
  TableHeader,
  TableCell,
  SlashCommand,
];
