import {
  type JSONContent,
  type MarkdownParseHelpers,
  type MarkdownRendererHelpers,
  type MarkdownToken,
  mergeAttributes,
} from "@tiptap/core";
import { Heading } from "@tiptap/extension-heading";
import { Highlight } from "@tiptap/extension-highlight";
import { Image } from "@tiptap/extension-image";
import { Link } from "@tiptap/extension-link";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { Strike } from "@tiptap/extension-strike";
import { Typography } from "@tiptap/extension-typography";
import { Placeholder } from "@tiptap/extensions";
import { Markdown } from "@tiptap/markdown";
import { Plugin } from "@tiptap/pm/state";
import { StarterKit } from "@tiptap/starter-kit";
import { convertFileSrc } from "@tauri-apps/api/core";

import { isTauri, saveImage } from "../ipc";

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
      "Mod-Shift-x": () => this.editor.commands.toggleStrike(),
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
      "Mod-Shift-h": () => this.editor.commands.toggleHighlight(),
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

// Absolute path of the capture folder (`~/Notes/Inbox`), fetched once at app
// start (see CaptureEditor mount). Markdown stores image paths *relative* to
// this folder (`attachments/foo.png`); to display them in the webview we join
// them onto this base and run it through Tauri's `asset:` protocol.
let attachmentsBaseDir: string | null = null;
export function setAttachmentsBase(dir: string): void {
  attachmentsBaseDir = dir;
}

// Turn a stored `src` into something the webview can load. Relative attachment
// paths are resolved against the capture folder and converted to an `asset:`
// URL; absolute/`data:`/`http(s):` sources are left untouched (covers dev in a
// plain browser and any inline/remote images).
function toDisplaySrc(src: string): string {
  if (!src) return src;
  if (/^(data:|https?:|asset:|blob:|file:)/.test(src)) return src;
  if (!isTauri() || !attachmentsBaseDir) return src;
  const abs = src.startsWith("/") ? src : `${attachmentsBaseDir}/${src}`;
  return convertFileSrc(abs);
}

const IMAGE_EXT_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
};

// Image node with: (1) markdown round-trip (`@tiptap/markdown` has no built-in
// image handler, so we map the marked `image` token ↔ `![alt](src)`), (2) a
// display-time `src` rewrite to the `asset:` protocol, and (3) clipboard paste
// handling that writes the bytes to disk via the `save_image` command and
// inserts a node referencing the relative path.
const MarkdownImage = Image.extend({
  renderHTML({ HTMLAttributes }) {
    const attrs = mergeAttributes(this.options.HTMLAttributes, HTMLAttributes);
    if (typeof attrs.src === "string") attrs.src = toDisplaySrc(attrs.src);
    return ["img", attrs];
  },

  markdownTokenName: "image",
  parseMarkdown: (token: MarkdownToken) => ({
    type: "image",
    attrs: {
      src: token.href ?? "",
      alt: token.text ?? null,
      title: token.title ?? null,
    },
  }),
  renderMarkdown: (node: JSONContent) =>
    `![${node.attrs?.alt ?? ""}](${node.attrs?.src ?? ""})`,

  addProseMirrorPlugins() {
    const editor = this.editor;
    return [
      new Plugin({
        props: {
          handlePaste: (_view, event) => {
            const items = Array.from(event.clipboardData?.items ?? []);
            const imageItems = items.filter(
              (it) => it.kind === "file" && it.type.startsWith("image/"),
            );
            if (imageItems.length === 0) return false;

            event.preventDefault();
            void (async () => {
              for (const item of imageItems) {
                const file = item.getAsFile();
                if (!file) continue;
                try {
                  const bytes = new Uint8Array(await file.arrayBuffer());
                  const ext = IMAGE_EXT_BY_MIME[file.type] ?? "png";
                  const { relative } = await saveImage(bytes, ext);
                  if (!relative) continue;
                  editor
                    .chain()
                    .focus()
                    .insertContent({ type: "image", attrs: { src: relative } })
                    .run();
                } catch (err) {
                  console.error("[paste-image] failed", err);
                }
              }
            })();
            return true;
          },
        },
      }),
    ];
  },
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
  Placeholder.configure({ placeholder: "Start writing…" }),
  MinimalTypography,
  Markdown.configure({
    markedOptions: { gfm: true, breaks: false },
  }),
  MarkdownHighlight,
  MarkdownLink,
  MarkdownImage,
];
