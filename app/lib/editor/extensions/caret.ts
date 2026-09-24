import { Extension } from "@tiptap/core";
import { Plugin, TextSelection } from "@tiptap/pm/state";

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
            const rect = view.coordsAtPos(selection.head, 1);
            const hostRect = host.getBoundingClientRect();
            caret.style.left = `${rect.left - hostRect.left + host.scrollLeft - 1}px`;
            caret.style.top = `${rect.top - hostRect.top + host.scrollTop}px`;
            caret.style.height = `${rect.bottom - rect.top}px`;
            if (restartBlink) for (const a of caret.getAnimations()) a.currentTime = 0;
          };

          const redraw = () => draw(true);
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
