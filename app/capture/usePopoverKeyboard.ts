"use client";

import {
  useEffect,
  type DependencyList,
  type KeyboardEvent,
  type MouseEvent,
  type RefObject,
} from "react";

// Roving focus for a vertical popover menu. Focus is the only highlight: arrows
// wrap it, and the pointer moves it to the row under the cursor, so hover and
// keyboard can never mark two rows at once. `autoFocus` picks what gets focus on
// mount (the first row, or the menu itself so no row starts highlighted);
// `focusDeps` re-runs that (e.g. when a list's length changes after a delete).
export function usePopoverKeyboard(
  containerRef: RefObject<HTMLElement | null>,
  itemSelector: string,
  {
    autoFocus = "first",
    focusDeps = [],
  }: { autoFocus?: "first" | "container"; focusDeps?: DependencyList } = {},
) {
  useEffect(() => {
    const container = containerRef.current;
    if (autoFocus === "container") container?.focus();
    else container?.querySelector<HTMLElement>(itemSelector)?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, focusDeps);

  const onKeyDown = (e: KeyboardEvent) => {
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

  const onMouseMove = (e: MouseEvent) => {
    const target = e.target as Element;
    const item =
      target.closest<HTMLElement>(itemSelector) ??
      target.closest(".pap-popover__row")?.querySelector<HTMLElement>(itemSelector);
    if (item && item !== document.activeElement) item.focus({ preventScroll: true });
  };

  return { onKeyDown, onMouseMove };
}
