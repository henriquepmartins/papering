import { syntaxTree } from "@codemirror/language";
import { RangeSetBuilder } from "@codemirror/state";
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
  WidgetType,
} from "@codemirror/view";

const HEADING_CLASS: Record<string, string> = {
  ATXHeading1: "pap-h1",
  ATXHeading2: "pap-h2",
  ATXHeading3: "pap-h3",
};

const INLINE_CLASS: Record<string, string> = {
  StrongEmphasis: "pap-bold",
  Emphasis: "pap-italic",
  InlineCode: "pap-inline-code",
  Strikethrough: "pap-strike",
};

const BLOCKQUOTE_LINE_DECO = Decoration.line({ class: "pap-blockquote-line" });
const FENCED_CODE_LINE_DECO = Decoration.line({ class: "pap-fenced-line" });
const HIDE_DECO = Decoration.replace({});
const LIST_MARKER_DECO = Decoration.mark({ class: "pap-list-marker" });
const UNDERLINE_DECO = Decoration.mark({ class: "pap-underline" });
const HIGHLIGHT_DECO = Decoration.mark({ class: "pap-highlight" });

const UNDERLINE_RE = /<u>([\s\S]+?)<\/u>/g;
const HIGHLIGHT_RE = /==([^=\n]+?)==/g;

const MARK_NODES = new Set([
  "HeaderMark",
  "EmphasisMark",
  "CodeMark",
  "StrikethroughMark",
  "QuoteMark",
]);

class BulletWidget extends WidgetType {
  toDOM() {
    const span = document.createElement("span");
    span.className = "pap-bullet-widget";
    span.textContent = "•";
    return span;
  }
  eq() {
    return true;
  }
  ignoreEvent() {
    return false;
  }
}

class TodoWidget extends WidgetType {
  constructor(readonly checked: boolean) {
    super();
  }
  toDOM() {
    const span = document.createElement("span");
    span.className = "pap-todo-widget";
    span.setAttribute("aria-hidden", "true");
    span.innerHTML = this.checked
      ? '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="6.4"/><path d="M5 8.2l2.2 2.2L11 6.6"/></svg>'
      : '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="8" cy="8" r="6.4"/></svg>';
    return span;
  }
  eq(other: TodoWidget) {
    return other.checked === this.checked;
  }
  ignoreEvent() {
    return false;
  }
}

const BULLET_WIDGET = Decoration.replace({ widget: new BulletWidget() });
const TODO_UNCHECKED = Decoration.replace({ widget: new TodoWidget(false) });
const TODO_CHECKED = Decoration.replace({ widget: new TodoWidget(true) });

type Entry = { from: number; to: number; deco: Decoration };

function buildDecorations(view: EditorView): {
  decorations: DecorationSet;
  atomic: DecorationSet;
} {
  const entries: Entry[] = [];
  const atomicEntries: Entry[] = [];
  const doc = view.state.doc;
  const selection = view.state.selection.main;
  const activeLineFrom = doc.lineAt(selection.from).from;
  const activeLineTo = doc.lineAt(selection.to).to;
  const cursorOnLine = (from: number, to: number) =>
    to >= activeLineFrom && from <= activeLineTo;

  for (const { from, to } of view.visibleRanges) {
    syntaxTree(view.state).iterate({
      from,
      to,
      enter: (node) => {
        // Headings: style the whole node.
        const headingClass = HEADING_CLASS[node.name];
        if (headingClass) {
          entries.push({
            from: node.from,
            to: node.to,
            deco: Decoration.mark({ class: headingClass }),
          });
          return;
        }

        // Inline styling marks (bold, italic, inline code).
        const inlineClass = INLINE_CLASS[node.name];
        if (inlineClass) {
          entries.push({
            from: node.from,
            to: node.to,
            deco: Decoration.mark({ class: inlineClass }),
          });
          return;
        }

        // Inline/block markdown marks (#, *, **, ~~, `, >).
        // Shown at full opacity when the cursor is within the wrapped span
        // (block-level for headers/quotes, parent inline node for emphasis/
        // code/strike); fully hidden otherwise.
        if (MARK_NODES.has(node.name)) {
          // Fenced-code backticks are left alone (FencedCode block paints them).
          if (node.name === "CodeMark") {
            const parentName = node.node.parent?.name;
            if (parentName === "FencedCode") {
              if (!cursorOnLine(node.from, node.to)) {
                entries.push({ from: node.from, to: node.to, deco: HIDE_DECO });
              }
              return;
            }
          }

          const blockLevel = node.name === "HeaderMark" || node.name === "QuoteMark";
          let visible: boolean;
          if (blockLevel) {
            visible = cursorOnLine(node.from, node.to);
          } else {
            const parent = node.node.parent;
            const parentFrom = parent?.from ?? node.from;
            const parentTo = parent?.to ?? node.to;
            visible = selection.to >= parentFrom && selection.from <= parentTo;
          }
          if (!visible) {
            let to = node.to;
            if (blockLevel && doc.sliceString(to, to + 1) === " ") to += 1;
            entries.push({ from: node.from, to, deco: HIDE_DECO });
          }
          return;
        }

        // Blockquote: paint each line with a left border + muted color.
        if (node.name === "Blockquote") {
          const startLine = doc.lineAt(node.from).number;
          const endLine = doc.lineAt(node.to).number;
          for (let n = startLine; n <= endLine; n++) {
            const line = doc.line(n);
            entries.push({ from: line.from, to: line.from, deco: BLOCKQUOTE_LINE_DECO });
          }
          return;
        }

        // Fenced code block: paint each line with monospace + bg.
        if (node.name === "FencedCode") {
          const startLine = doc.lineAt(node.from).number;
          const endLine = doc.lineAt(node.to).number;
          for (let n = startLine; n <= endLine; n++) {
            const line = doc.line(n);
            entries.push({ from: line.from, to: line.from, deco: FENCED_CODE_LINE_DECO });
          }
          return;
        }

        // Bullet / ordered list markers — children of ListItem.
        // Always render the widget (even on the active line) so typing `- ` or
        // `1. ` shows the bullet/number immediately, matching Raycast Notes.
        if (node.name === "ListMark") {
          const parent = node.node.parent;
          const grand = parent?.parent;
          if (grand?.name === "BulletList") {
            let to = node.to;
            if (doc.sliceString(to, to + 1) === " ") to += 1;
            // If this ListItem is a GFM task, hide the bullet entirely so the
            // TaskMarker circle stands alone (Raycast Notes style).
            let isTask = false;
            for (let c = parent?.firstChild; c; c = c.nextSibling) {
              if (c.name === "TaskMarker") {
                isTask = true;
                break;
              }
            }
            if (isTask) {
              entries.push({ from: node.from, to, deco: HIDE_DECO });
            } else {
              const entry = { from: node.from, to, deco: BULLET_WIDGET };
              entries.push(entry);
              atomicEntries.push(entry);
            }
          } else if (grand?.name === "OrderedList") {
            entries.push({ from: node.from, to: node.to, deco: LIST_MARKER_DECO });
          }
          return;
        }

        // GFM task marker `[ ]` / `[x]` — always render circle widget.
        if (node.name === "TaskMarker") {
          const raw = doc.sliceString(node.from, node.to);
          const checked = /\[[xX]\]/.test(raw);
          let to = node.to;
          if (doc.sliceString(to, to + 1) === " ") to += 1;
          const entry = {
            from: node.from,
            to,
            deco: checked ? TODO_CHECKED : TODO_UNCHECKED,
          };
          entries.push(entry);
          atomicEntries.push(entry);
          return;
        }
      },
    });

    // Regex-based inline decorations for syntax the lezer markdown parser
    // doesn't recognize: <u>…</u> (underline) and ==…== (highlight).
    const slice = doc.sliceString(from, to);
    const scan = (re: RegExp, openLen: number, closeLen: number, deco: Decoration) => {
      re.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = re.exec(slice))) {
        const matchFrom = from + m.index;
        const matchTo = matchFrom + m[0].length;
        const openFrom = matchFrom;
        const openTo = matchFrom + openLen;
        const closeFrom = matchTo - closeLen;
        const closeTo = matchTo;
        entries.push({ from: openTo, to: closeFrom, deco });
        const inRange = selection.to >= openFrom && selection.from <= closeTo;
        if (!inRange) {
          entries.push({ from: openFrom, to: openTo, deco: HIDE_DECO });
          entries.push({ from: closeFrom, to: closeTo, deco: HIDE_DECO });
        }
      }
    };
    scan(UNDERLINE_RE, 3, 4, UNDERLINE_DECO);
    scan(HIGHLIGHT_RE, 2, 2, HIGHLIGHT_DECO);
  }

  const sortEntries = (arr: Entry[]) =>
    arr.sort((a, b) => {
      if (a.from !== b.from) return a.from - b.from;
      return a.to - b.to;
    });
  sortEntries(entries);
  sortEntries(atomicEntries);

  const build = (arr: Entry[]) => {
    const builder = new RangeSetBuilder<Decoration>();
    for (const entry of arr) builder.add(entry.from, entry.to, entry.deco);
    return builder.finish();
  };
  return { decorations: build(entries), atomic: build(atomicEntries) };
}

export const liveMarkdown = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    atomic: DecorationSet;
    constructor(view: EditorView) {
      const built = buildDecorations(view);
      this.decorations = built.decorations;
      this.atomic = built.atomic;
    }
    update(update: ViewUpdate) {
      if (
        update.docChanged ||
        update.viewportChanged ||
        update.selectionSet ||
        syntaxTree(update.startState) !== syntaxTree(update.state)
      ) {
        const built = buildDecorations(update.view);
        this.decorations = built.decorations;
        this.atomic = built.atomic;
      }
    }
  },
  {
    decorations: (plugin) => plugin.decorations,
    provide: (plugin) =>
      EditorView.atomicRanges.of(
        (view) => view.plugin(plugin)?.atomic ?? Decoration.none,
      ),
  },
);
