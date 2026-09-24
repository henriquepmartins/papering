"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { Extension, type Editor, type Range } from "@tiptap/core";
import { PluginKey } from "@tiptap/pm/state";
import { ReactRenderer } from "@tiptap/react";
import Suggestion, {
  type SuggestionKeyDownProps,
  type SuggestionProps,
} from "@tiptap/suggestion";
import { computePosition, flip, offset, shift } from "@floating-ui/dom";

import { getCurrentLocale } from "../i18n";
import { translate, type MessageKey } from "../i18n/messages";
import { BLOCK_COMMANDS } from "./commands";

type SlashItem = {
  key: string;
  title: string;
  hint: string;
  glyph: string;
  run: (editor: Editor, range: Range) => void;
};

function allItems(): SlashItem[] {
  const t = (key: MessageKey) => translate(getCurrentLocale(), key);
  return BLOCK_COMMANDS.flatMap((cmd) =>
    cmd.slash
      ? [
          {
            key: cmd.id,
            title: t(cmd.slash.title),
            hint: t(cmd.slash.hint),
            glyph: cmd.slash.glyph,
            run: cmd.run,
          },
        ]
      : [],
  );
}

type SlashMenuHandle = { onKeyDown: (props: SuggestionKeyDownProps) => boolean };

type SlashMenuProps = {
  items: SlashItem[];
  command: (item: SlashItem) => void;
};

const SlashMenu = forwardRef<SlashMenuHandle, SlashMenuProps>(
  function SlashMenu({ items, command }, ref) {
    const [selected, setSelected] = useState(0);
    const listRef = useRef<HTMLDivElement>(null);

    useEffect(() => setSelected(0), [items]);

    useLayoutEffect(() => {
      const el = listRef.current?.children[selected] as HTMLElement | undefined;
      el?.scrollIntoView({ block: "nearest" });
    }, [selected]);

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }) => {
        if (event.key === "ArrowDown") {
          setSelected((s) => (items.length ? (s + 1) % items.length : 0));
          return true;
        }
        if (event.key === "ArrowUp") {
          setSelected((s) =>
            items.length ? (s - 1 + items.length) % items.length : 0,
          );
          return true;
        }
        if (event.key === "Enter") {
          const item = items[selected];
          if (item) command(item);
          return true;
        }
        return false;
      },
    }));

    if (items.length === 0) {
      return (
        <div className="pap-popover pap-slash" role="menu">
          <div className="pap-popover__empty">
            {translate(getCurrentLocale(), "slash.empty")}
          </div>
        </div>
      );
    }

    return (
      <div className="pap-popover pap-slash" role="menu" ref={listRef}>
        {items.map((item, i) => (
          <button
            type="button"
            key={item.key}
            role="menuitem"
            className={`pap-popover__row pap-popover__row--button pap-slash__item${
              i === selected ? " is-active" : ""
            }`}
            onMouseEnter={() => setSelected(i)}
            onMouseDown={(e) => {
              e.preventDefault();
              command(item);
            }}
          >
            <span className="pap-slash__icon">{item.glyph}</span>
            <span className="pap-slash__text">
              <span className="pap-popover__label">{item.title}</span>
              <span className="pap-slash__hint">{item.hint}</span>
            </span>
          </button>
        ))}
      </div>
    );
  },
);

export const slashPluginKey = new PluginKey("slashCommand");

export const SlashCommand = Extension.create({
  name: "slashCommand",

  addProseMirrorPlugins() {
    return [
      Suggestion<SlashItem>({
        pluginKey: slashPluginKey,
        editor: this.editor,
        char: "/",
        allow: ({ state, range }) => {
          const $from = state.doc.resolve(range.from);
          const isStart = $from.parentOffset <= 1;
          const inText = $from.parent.type.spec.code !== true;
          return isStart && inText;
        },
        command: ({ editor, range, props }) => {
          props.run(editor, range);
        },
        items: ({ query }) => {
          const q = query.toLowerCase();
          return allItems().filter(
            (item) =>
              !q ||
              item.title.toLowerCase().includes(q) ||
              item.key.toLowerCase().includes(q),
          );
        },
        render: () => {
          let component: ReactRenderer<SlashMenuHandle, SlashMenuProps> | null =
            null;

          const reposition = (props: SuggestionProps<SlashItem>) => {
            const rect = props.clientRect?.();
            if (!rect || !component) return;
            const el = component.element as HTMLElement;
            const virtual = { getBoundingClientRect: () => rect };
            void computePosition(virtual, el, {
              placement: "bottom-start",
              middleware: [offset(6), flip(), shift({ padding: 8 })],
            }).then(({ x, y }) => {
              Object.assign(el.style, {
                position: "fixed",
                left: `${x}px`,
                top: `${y}px`,
                zIndex: "70",
                margin: "0",
              });
            });
          };

          return {
            onStart: (props) => {
              component = new ReactRenderer(SlashMenu, {
                props: { items: props.items, command: props.command },
                editor: props.editor,
              });
              document.body.appendChild(component.element);
              reposition(props);
            },
            onUpdate: (props) => {
              component?.updateProps({
                items: props.items,
                command: props.command,
              });
              reposition(props);
            },
            onKeyDown: (props) => component?.ref?.onKeyDown(props) ?? false,
            onExit: () => {
              component?.element.remove();
              component?.destroy();
              component = null;
            },
          };
        },
      }),
    ];
  },
});
