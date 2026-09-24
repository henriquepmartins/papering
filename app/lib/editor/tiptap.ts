import { type Editor, useEditor } from "@tiptap/react";
import { useRef } from "react";

import { editorExtensions } from "./extensions";
import { slashPluginKey } from "./slashCommand";

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
      handleKeyDown: (view, event) => {
        if (event.key === "Escape") {
          if (slashPluginKey.getState(view.state)?.active) return false;
          onEscapeRef.current?.();
          return true;
        }
        return false;
      },
    },
  });
}
