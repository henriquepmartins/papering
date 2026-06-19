// Inline SVG glyphs for the capture chrome (titlebar, format bar, note rows).
// Pure presentational components — they inherit colour via `currentColor`.

export function NotesIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="2.5" width="9" height="11" rx="1.4" />
      <path d="M5 5.5h5M5 8h5M5 10.5h3.2" />
    </svg>
  );
}

export function PlusIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 3.5v9M3.5 8h9" />
    </svg>
  );
}

export function GearIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="8" r="2.1" />
      <path d="M8 1.6v1.5M8 12.9v1.5M3.4 3.4l1.1 1.1M11.5 11.5l1.1 1.1M1.6 8h1.5M12.9 8h1.5M3.4 12.6l1.1-1.1M11.5 4.5l1.1-1.1" />
    </svg>
  );
}

// Highlighter marker — used for the highlight/marca-texto format button.
export function MarkerIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.5 3.2l3.3 3.3-5 5-3.3-3.3 5-5z" />
      <path d="M4.5 8.2L2.8 12l3.8-1.7" />
      <path d="M2.8 13.8h6" strokeWidth="1.8" />
    </svg>
  );
}

export function LinkIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6.5 9.5l3-3" />
      <path d="M7.2 4.8l1-1a2.5 2.5 0 0 1 3.5 3.5l-1 1" />
      <path d="M8.8 11.2l-1 1a2.5 2.5 0 0 1-3.5-3.5l1-1" />
    </svg>
  );
}

// Eraser — clear-formatting button.
export function EraserIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 12.5l-2.6-2.6a1.2 1.2 0 0 1 0-1.7l4.4-4.4a1.2 1.2 0 0 1 1.7 0l2.2 2.2a1.2 1.2 0 0 1 0 1.7l-4.9 4.9H7z" />
      <path d="M3 13.5h9" />
    </svg>
  );
}

export function TrashIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5">
      <path d="M3 4.5h10M6.5 4V3.2c0-.5.4-.7.8-.7h1.4c.4 0 .8.2.8.7V4M5 4.5l.6 8c0 .5.4.8.9.8h3c.5 0 .9-.3.9-.8l.6-8" />
    </svg>
  );
}
