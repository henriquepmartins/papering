import { Extension } from "@tiptap/core";
import { Plugin, TextSelection } from "@tiptap/pm/state";

// WebKit draws the caret on every soft-wrapped line after the first from the
// previous line's glyph bottom and a full line-height tall, so it looks too
// tall and shifted up. CSS can't change caret geometry without changing line
// spacing, so the native caret is hidden (editor-content.css) and this draws
// one sized to the glyph box that coordsAtPos reports.
//
// IME composition keeps the native caret: marked text is WebKit's to draw, so
// the overlay steps aside and `.pap-composing` restores caret-color.
export const Caret = Extension.create({
  name: "caret",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        view(view) {
          const host = view.dom.parentElement;
          if (!host) return {};
          const caret = document.createElement("div");
          caret.className = "pap-caret";
          host.appendChild(caret);

          const draw = (restartBlink = false) => {
            const { selection } = view.state;
            const composing = view.composing;
            view.dom.classList.toggle("pap-composing", composing);
            const show =
              !composing &&
              selection instanceof TextSelection &&
              selection.empty &&
              view.hasFocus() &&
              document.hasFocus();
            caret.style.display = show ? "" : "none";
            if (!show) return;
            // Side 1 places the caret where the next typed character lands:
            // at a soft wrap that is the start of the next line.
            const rect = view.coordsAtPos(selection.head, 1);
            const hostRect = host.getBoundingClientRect();
            caret.style.left = `${rect.left - hostRect.left + host.scrollLeft - 1}px`;
            caret.style.top = `${rect.top - hostRect.top + host.scrollTop}px`;
            caret.style.height = `${rect.bottom - rect.top}px`;
            // Solid while typing or moving: the blink restarts from "on".
            if (restartBlink) for (const a of caret.getAnimations()) a.currentTime = 0;
          };

          const redraw = () => draw(true);
          // Focus and composition flags settle after their events fire.
          const redrawNextFrame = () => requestAnimationFrame(redraw);
          const events = ["focus", "blur", "compositionstart", "compositionend"] as const;
          for (const type of events) view.dom.addEventListener(type, redrawNextFrame);
          window.addEventListener("focus", redrawNextFrame);
          window.addEventListener("blur", redrawNextFrame);
          const resize = new ResizeObserver(() => draw());
          resize.observe(view.dom);
          draw(true);

          return {
            update(view, prevState) {
              draw(prevState.doc !== view.state.doc || !prevState.selection.eq(view.state.selection));
            },
            destroy() {
              for (const type of events) view.dom.removeEventListener(type, redrawNextFrame);
              window.removeEventListener("focus", redrawNextFrame);
              window.removeEventListener("blur", redrawNextFrame);
              resize.disconnect();
              caret.remove();
            },
          };
        },
      }),
    ];
  },
});
