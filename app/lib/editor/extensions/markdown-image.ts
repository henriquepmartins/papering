import {
  type JSONContent,
  type MarkdownToken,
  mergeAttributes,
} from "@tiptap/core";
import { Image } from "@tiptap/extension-image";
import { Plugin } from "@tiptap/pm/state";
import { convertFileSrc } from "@tauri-apps/api/core";

import { isTauri, saveImage } from "../../ipc";

// Absolute path of the capture folder (`~/Notes/Inbox`), fetched once at app
// start (see CaptureEditor mount). Markdown stores image paths *relative* to
// this folder (`attachments/foo.png`); to display them in the webview we join
// them onto this base and run it through Tauri's `asset:` protocol.
//
// It's module state rather than React context because the rewrite runs inside
// Tiptap's `renderHTML` (below), which has no access to the component tree. Set
// it once before the editor mounts.
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
export const MarkdownImage = Image.extend({
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
