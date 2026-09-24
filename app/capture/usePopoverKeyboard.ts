"use client";

import {
  useEffect,
  type DependencyList,
  type KeyboardEvent,
  type MouseEvent,
  type RefObject,
} from "react";

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
