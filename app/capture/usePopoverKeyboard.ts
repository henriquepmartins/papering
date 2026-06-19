"use client";

import {
  useEffect,
  type DependencyList,
  type KeyboardEvent,
  type RefObject,
} from "react";

// Roving focus for a vertical popover menu: focuses the first matching item on
// mount and wraps focus with Up/Down arrows. Returns the keydown handler to
// spread onto the container. `focusDeps` re-runs the initial focus (e.g. when a
// list's length changes after a delete).
export function usePopoverKeyboard(
  containerRef: RefObject<HTMLElement | null>,
  itemSelector: string,
  focusDeps: DependencyList = [],
) {
  useEffect(() => {
    containerRef.current?.querySelector<HTMLElement>(itemSelector)?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, focusDeps);

  return (e: KeyboardEvent) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const items = Array.from(
      containerRef.current?.querySelectorAll<HTMLElement>(itemSelector) ?? [],
    );
    if (items.length === 0) return;
    const active = document.activeElement as HTMLElement | null;
    const current = active?.closest<HTMLElement>(itemSelector) ?? active;
    const idx = current ? items.indexOf(current) : -1;
    const delta = e.key === "ArrowDown" ? 1 : -1;
    items[(idx + delta + items.length) % items.length]?.focus();
  };
}
