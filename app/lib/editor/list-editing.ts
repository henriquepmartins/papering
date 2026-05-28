import { syntaxTree } from "@codemirror/language";
import {
  EditorSelection,
  EditorState,
  type ChangeSpec,
  type Extension,
  type StateCommand,
  Transaction,
} from "@codemirror/state";

const CHECKBOX_LINE_RE = /^(\s*)\[\]$/;

function isInsideCode(state: EditorState, pos: number): boolean {
  const node = syntaxTree(state).resolveInner(pos, -1);
  for (let n: typeof node | null = node; n; n = n.parent) {
    if (n.name === "FencedCode" || n.name === "CodeBlock" || n.name === "InlineCode") {
      return true;
    }
  }
  return false;
}

export const checkboxAutoexpand: Extension = EditorState.transactionFilter.of((tr) => {
  if (!tr.docChanged) return tr;
  const userEvent = tr.annotation(Transaction.userEvent);
  if (!userEvent || !userEvent.startsWith("input")) return tr;

  const newState = tr.state;
  const cursor = newState.selection.main.head;
  const line = newState.doc.lineAt(cursor);
  if (cursor !== line.to) return tr;

  const match = CHECKBOX_LINE_RE.exec(line.text);
  if (!match) return tr;

  if (isInsideCode(newState, line.from)) return tr;

  const indent = match[1];
  const replacement = `${indent}- [ ] `;
  const change: ChangeSpec = { from: line.from, to: line.to, insert: replacement };
  const newCursor = line.from + replacement.length;
  return [
    tr,
    {
      changes: change,
      selection: EditorSelection.cursor(newCursor),
      sequential: true,
    },
  ];
});

function lineIsListItem(state: EditorState, pos: number): boolean {
  const node = syntaxTree(state).resolveInner(pos, 1);
  for (let n: typeof node | null = node; n; n = n.parent) {
    if (n.name === "ListItem") return true;
  }
  return false;
}

function collectLines(state: EditorState): { lines: ReturnType<EditorState["doc"]["lineAt"]>[]; allListItems: boolean } {
  const seen = new Set<number>();
  const lines: ReturnType<EditorState["doc"]["lineAt"]>[] = [];
  let allListItems = true;
  for (const range of state.selection.ranges) {
    const startLine = state.doc.lineAt(range.from);
    const endLine = state.doc.lineAt(range.to);
    for (let n = startLine.number; n <= endLine.number; n++) {
      if (seen.has(n)) continue;
      seen.add(n);
      const line = state.doc.line(n);
      lines.push(line);
      if (!lineIsListItem(state, line.from)) allListItems = false;
    }
  }
  return { lines, allListItems };
}

export const indentListItem: StateCommand = ({ state, dispatch }) => {
  const { lines, allListItems } = collectLines(state);
  if (!allListItems || lines.length === 0) return false;
  const changes: ChangeSpec[] = lines.map((line) => ({
    from: line.from,
    insert: "  ",
  }));
  dispatch(
    state.update({
      changes,
      selection: state.selection,
      userEvent: "input.indent",
    }),
  );
  return true;
};

export const outdentListItem: StateCommand = ({ state, dispatch }) => {
  const { lines, allListItems } = collectLines(state);
  if (!allListItems || lines.length === 0) return false;
  const changes: ChangeSpec[] = [];
  for (const line of lines) {
    if (line.text.startsWith("  ")) {
      changes.push({ from: line.from, to: line.from + 2, insert: "" });
    } else if (line.text.startsWith("\t")) {
      changes.push({ from: line.from, to: line.from + 1, insert: "" });
    }
  }
  if (changes.length === 0) return false;
  dispatch(
    state.update({
      changes,
      selection: state.selection,
      userEvent: "delete.outdent",
    }),
  );
  return true;
};
