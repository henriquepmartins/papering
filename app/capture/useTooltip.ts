"use client";

import { useEffect, useRef, useState } from "react";

const TOOLTIP_DELAY_MS = 350;
// After a tooltip closes, hovering another trigger within this window opens its
// tooltip instantly (no delay, no enter animation) — so moving across the
// toolbar feels immediate, while the first tooltip still waits the full delay.
const TOOLTIP_SKIP_WINDOW_MS = 300;
// Shared across every tooltip so gliding from one trigger to the next is instant.
let lastTooltipCloseAt = 0;

// Hover-tooltip lifecycle shared by the titlebar icons and the format buttons:
// a delayed open that becomes instant when gliding between triggers, with the
// per-trigger anchor computed by the caller (`compute`) since each surface
// positions its tooltip differently. Returns the state + hover handlers; the
// caller owns the portal/markup.
export function useTooltip<T>(compute: () => T | null) {
  const [anchor, setAnchor] = useState<T | null>(null);
  // Whether the tooltip should appear instantly (a hover within the skip
  // window) — no enter animation.
  const [instant, setInstant] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const start = () => {
    if (timer.current) clearTimeout(timer.current);
    const skip = Date.now() - lastTooltipCloseAt < TOOLTIP_SKIP_WINDOW_MS;
    const show = () => {
      const a = compute();
      if (a) {
        setInstant(skip);
        setAnchor(a);
      }
    };
    if (skip) show();
    else timer.current = setTimeout(show, TOOLTIP_DELAY_MS);
  };

  const end = () => {
    if (timer.current) clearTimeout(timer.current);
    // Only open the skip window if a tooltip was actually visible.
    if (anchor) lastTooltipCloseAt = Date.now();
    setAnchor(null);
  };

  return { anchor, setAnchor, instant, mounted, start, end };
}
