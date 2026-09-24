import {
  type JSONContent,
  type MarkdownToken,
  mergeAttributes,
} from "@tiptap/core";
import { Image } from "@tiptap/extension-image";
import { Plugin } from "@tiptap/pm/state";
import { convertFileSrc } from "@tauri-apps/api/core";

import { isTauri, saveImage } from "../../ipc";

let attachmentsBaseDir: string | null = null;
export function setAttachmentsBase(dir: string): void {
  attachmentsBaseDir = dir;
}

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
