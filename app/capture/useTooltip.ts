"use client";

import { useEffect, useRef, useState } from "react";

const TOOLTIP_DELAY_MS = 350;
const TOOLTIP_SKIP_WINDOW_MS = 300;
let lastTooltipCloseAt = 0;

export function useTooltip<T>(compute: () => T | null) {
  const [anchor, setAnchor] = useState<T | null>(null);
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
    if (anchor) lastTooltipCloseAt = Date.now();
    setAnchor(null);
  };

  return { anchor, setAnchor, instant, mounted, start, end };
}
