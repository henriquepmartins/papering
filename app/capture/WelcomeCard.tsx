"use client";

import { motion, useReducedMotion } from "motion/react";

import { useT, type MessageKey } from "../lib/i18n";

const HOVER_EASE: [number, number, number, number] = [0.23, 1, 0.32, 1];

const TIPS: { badge: string; key: MessageKey }[] = [
  { badge: "⌘N", key: "welcome.tip.new" },
  { badge: "⌘O", key: "welcome.tip.notes" },
  { badge: "⌘K", key: "welcome.tip.shortcuts" },
  { badge: "⌘,", key: "welcome.tip.settings" },
  { badge: "/", key: "welcome.tip.slash" },
];

// One-time first-run card. Rendered as a soft overlay above the editor; it does
// not touch note content (so nothing accidental gets saved). Dismissing sets the
// `pap.onboarded` flag in CaptureEditor.
export default function WelcomeCard({ onDismiss }: { onDismiss: () => void }) {
  const t = useT();
  const reduce = !!useReducedMotion();

  return (
    <motion.div
      className="pap-welcome-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18, ease: HOVER_EASE }}
    >
      <motion.div
        className="pap-welcome"
        role="dialog"
        aria-modal="true"
        initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 6 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 6 }}
        transition={{ duration: 0.22, ease: HOVER_EASE }}
      >
        <h1 className="pap-welcome__title">{t("welcome.title")}</h1>
        <p className="pap-welcome__subtitle">{t("welcome.subtitle")}</p>

        <ul className="pap-welcome__tips">
          {TIPS.map((tip) => (
            <li key={tip.key} className="pap-welcome__tip">
              <kbd className="pap-welcome__kbd">{tip.badge}</kbd>
              <span>{t(tip.key)}</span>
            </li>
          ))}
          <li className="pap-welcome__tip pap-welcome__tip--wide">
            <span>{t("welcome.tip.rightClick")}</span>
          </li>
        </ul>

        <button
          type="button"
          className="pap-welcome__dismiss"
          onClick={onDismiss}
          autoFocus
        >
          {t("welcome.dismiss")}
        </button>
      </motion.div>
    </motion.div>
  );
}
