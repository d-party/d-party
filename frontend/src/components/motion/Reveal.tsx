"use client";

import { motion, useReducedMotion } from "framer-motion";

type RevealProps = {
  children: React.ReactNode;
  className?: string;
  /** Stagger offset in seconds when several Reveals appear together. */
  delay?: number;
};

/**
 * Fades + lifts its children into view the first time they scroll on screen.
 * Honours `prefers-reduced-motion`: when set, content simply appears with no
 * transform — keeping the page comfortable rather than busy.
 */
export function Reveal({
  children,
  className,
  delay = 0,
}: RevealProps): React.JSX.Element {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 24 }}
      whileInView={reduce ? { opacity: 1 } : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.5, ease: "easeOut", delay }}
    >
      {children}
    </motion.div>
  );
}
