import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { insertNewlineContinueMarkup, markdown } from "@codemirror/lang-markdown";
import { EditorSelection, EditorState, type Extension } from "@codemirror/state";
import {
  EditorView,
  drawSelection,
  keymap,
  lineNumbers,
} from "@codemirror/view";
import { GFM } from "@lezer/markdown";

import {
  checkboxAutoexpand,
  indentListItem,
  outdentListItem,
} from "./list-editing";
import { liveMarkdown } from "./markdown-decorations";
import { captureTheme } from "./theme";

void lineNumbers;

export type CreateEditorParams = {
  parent: HTMLElement;
  initialDoc?: string;
  onChange?: (doc: string) => void;
  onEscape?: () => void;
};

function toggleWrap(marker: string, closeMarker?: string) {
  const open = marker;
  const close = closeMarker ?? marker;
  const openLen = open.length;
  const closeLen = close.length;
  return (view: EditorView): boolean => {
    const { state } = view;
    const tr = state.changeByRange((range) => {
      const from = range.from;
      const to = range.to;
      const before = state.sliceDoc(Math.max(0, from - openLen), from);
      const after = state.sliceDoc(to, Math.min(state.doc.length, to + closeLen));
      const selected = state.sliceDoc(from, to);

      // Case A: selection is immediately wrapped by markers → unwrap.
      if (before === open && after === close) {
        return {
          changes: [
            { from: from - openLen, to: from, insert: "" },
            { from: to, to: to + closeLen, insert: "" },
          ],
          range: EditorSelection.range(from - openLen, to - openLen),
        };
      }

      // Case B: selection itself starts/ends with markers → strip.
      if (
        selected.length >= openLen + closeLen &&
        selected.startsWith(open) &&
        selected.endsWith(close)
      ) {
        const stripped = selected.slice(openLen, selected.length - closeLen);
        return {
          changes: { from, to, insert: stripped },
          range: EditorSelection.range(from, from + stripped.length),
        };
      }

      // Case C: wrap.
      const insert = `${open}${selected}${close}`;
      const anchor = from + openLen;
      const head = anchor + selected.length;
      return {
        changes: { from, to, insert },
        range: EditorSelection.range(anchor, head),
      };
    });
    view.dispatch(tr);
    return true;
  };
}

export function createCaptureEditor({
  parent,
  initialDoc = "",
  onChange,
  onEscape,
}: CreateEditorParams): EditorView {
  const extensions: Extension[] = [
    history(),
    drawSelection(),
    markdown({ extensions: GFM }),
    liveMarkdown,
    captureTheme,
    checkboxAutoexpand,
    keymap.of([
      { key: "Mod-b", run: toggleWrap("**") },
      { key: "Mod-i", run: toggleWrap("*") },
      { key: "Mod-u", run: toggleWrap("<u>", "</u>") },
      { key: "Mod-e", run: toggleWrap("`") },
      { key: "Mod-Shift-h", run: toggleWrap("==") },
      { key: "Mod-Shift-x", run: toggleWrap("~~") },
      { key: "Enter", run: insertNewlineContinueMarkup },
      { key: "Tab", run: indentListItem },
      { key: "Shift-Tab", run: outdentListItem },
      ...defaultKeymap,
      ...historyKeymap,
      indentWithTab,
      {
        key: "Escape",
        run: () => {
          onEscape?.();
          return true;
        },
      },
    ]),
    EditorView.lineWrapping,
    EditorView.updateListener.of((update) => {
      if (update.docChanged) onChange?.(update.state.doc.toString());
    }),
  ];

  return new EditorView({
    state: EditorState.create({ doc: initialDoc, extensions }),
    parent,
  });
}
