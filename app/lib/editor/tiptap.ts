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
      // Editor props run before plugin props, so an open slash menu must get
      // Escape first or it would hide the window instead of closing the menu.
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
