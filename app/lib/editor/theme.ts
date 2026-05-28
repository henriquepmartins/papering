import { EditorView } from "@codemirror/view";

export const captureTheme = EditorView.theme(
  {
    "&": {
      color: "var(--color-text)",
      backgroundColor: "transparent",
      fontFamily: "var(--font-sans)",
      fontSize: "15px",
      height: "100%",
    },
    "&.cm-focused": {
      outline: "none",
    },
    ".cm-scroller": {
      fontFamily: "var(--font-sans)",
      lineHeight: "1.55",
      padding: "8px 24px 24px",
      overflowY: "auto",
    },
    ".cm-content": {
      caretColor: "var(--color-caret)",
      padding: "0",
    },
    ".cm-line": {
      padding: "2px 0",
    },
    "&.cm-editor .cm-cursor": {
      borderLeftColor: "var(--color-caret)",
      borderLeftWidth: "2px",
    },
    "&.cm-editor.cm-focused .cm-selectionBackground, ::selection": {
      background: "var(--color-selection)",
      borderRadius: "3px",
    },
    ".cm-selectionBackground": {
      background: "var(--color-selection)",
      borderRadius: "3px",
    },
    /* Headings */
    ".pap-h1": {
      fontSize: "22px",
      fontWeight: "700",
      letterSpacing: "-0.012em",
      lineHeight: "1.25",
    },
    ".pap-h2": {
      fontSize: "18px",
      fontWeight: "700",
      letterSpacing: "-0.006em",
      lineHeight: "1.3",
    },
    ".pap-h3": {
      fontSize: "16px",
      fontWeight: "600",
      lineHeight: "1.35",
    },

    /* Inline */
    ".pap-bold": {
      fontWeight: "600",
      color: "var(--color-text)",
    },
    ".pap-italic": {
      fontStyle: "italic",
    },
    ".pap-strike": {
      textDecoration: "line-through",
      textDecorationColor: "var(--color-text-faint)",
      color: "var(--color-text-muted)",
    },
    ".pap-inline-code": {
      fontFamily: "var(--font-mono)",
      fontSize: "13px",
      padding: "1px 5px",
      borderRadius: "4px",
      background: "oklch(0 0 0 / 0.05)",
      border: "1px solid var(--color-border)",
    },

    /* Lists */
    ".pap-list-marker": {
      color: "var(--color-accent)",
      fontWeight: "500",
      fontVariantNumeric: "tabular-nums",
    },

    /* Blockquote — left border + muted text. */
    ".pap-blockquote-line": {
      borderLeft: "3px solid var(--color-border-strong)",
      paddingLeft: "10px",
      marginLeft: "-13px",
      color: "var(--color-text-muted)",
      fontStyle: "italic",
    },

    /* Fenced code block — monospace + soft surface. */
    ".pap-fenced-line": {
      fontFamily: "var(--font-mono)",
      fontSize: "13px",
      background: "oklch(0 0 0 / 0.04)",
      paddingLeft: "10px",
      paddingRight: "10px",
    },

    /* Underline + highlight (custom inline syntax) */
    ".pap-underline": {
      textDecoration: "underline",
      textUnderlineOffset: "3px",
      textDecorationThickness: "1px",
      textDecorationColor: "var(--color-text-muted)",
    },
    ".pap-highlight": {
      background: "#eceefe",
      padding: "1px 3px",
      borderRadius: "3px",
      boxDecorationBreak: "clone",
      WebkitBoxDecorationBreak: "clone",
    },

  },
  { dark: false },
);
