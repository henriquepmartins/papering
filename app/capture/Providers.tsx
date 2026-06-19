"use client";

import type { ReactNode } from "react";

import { LocaleProvider } from "../lib/i18n";

// Client-side providers for the capture window. Kept separate from the server
// `layout.tsx` so the locale context (which touches localStorage) stays on the
// client.
export default function Providers({ children }: { children: ReactNode }) {
  return <LocaleProvider>{children}</LocaleProvider>;
}
