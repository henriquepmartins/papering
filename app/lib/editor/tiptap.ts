import { type Editor, useEditor } from "@tiptap/react";
import { useRef } from "react";

import { editorExtensions } from "./extensions";

export type CaptureEditorParams = {
  onChange?: (markdown: string) => void;
  onEscape?: () => void;
};

export function getMarkdown(editor: Editor | null): string {
  if (!editor) return "";
  return editor.getMarkdown();
}

export function useCaptureEditor({
  onChange,
  onEscape,
}: CaptureEditorParams): Editor | null {
  // Refs so the editor is created once but always calls the latest callback.
  // Without this, useEditor's onUpdate / handleKeyDown would close over the
  // first render's props and never see updates from the parent.
  const onChangeRef = useRef(onChange);
  const onEscapeRef = useRef(onEscape);
  onChangeRef.current = onChange;
  onEscapeRef.current = onEscape;

  return useEditor({
    extensions: editorExtensions,
    content: "",
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      onChangeRef.current?.(editor.getMarkdown());
    },
    editorProps: {
      attributes: {
        class: "tiptap",
      },
      handleKeyDown: (_view, event) => {
        if (event.key === "Escape") {
          onEscapeRef.current?.();
          return true;
        }
        return false;
      },
    },
  });
}
