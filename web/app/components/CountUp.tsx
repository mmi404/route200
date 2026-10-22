"use client";

import { useEffect, useRef } from "react";
import { MOTION, prefersReducedMotion } from "@/lib/design-tokens";

export type NumberFormatOptions = {
  decimals?: number;
  /** Thousands separators. Turn off for years ("2004", not "2,004"). */
  grouping?: boolean;
  /** "bn" renders Bengali digits (৩৭), "en" Latin digits. */
  locale?: "en" | "bn";
};

export function formatStatNumber(
  value: number,
  { decimals = 0, grouping = true, locale = "en" }: NumberFormatOptions = {},
): string {
  return new Intl.NumberFormat(locale === "bn" ? "bn-BD" : "en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    useGrouping: grouping,
  }).format(value);
}

type CountUpProps = NumberFormatOptions & {
  value: number;
  /** Disable the count-up and always show the final value. */
  animate?: boolean;
};

/**
 * Renders the final number on the server (so no-JS readers, crawlers and
 * screen readers always get the real figure). On the client it counts up
 * once, and only when the number starts below the fold and scrolls into
 * view. Already-visible numbers and reduced-motion visitors never animate.
 *
 * The animation writes textContent directly through a ref: no re-renders,
 * and React's own text always remains the final value.
 */
export function CountUp({
  value,
  decimals = 0,
  grouping = true,
  locale = "en",
  animate = true,
}: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const finalText = formatStatNumber(value, { decimals, grouping, locale });

  useEffect(() => {
    const element = ref.current;
    if (!element || !animate || prefersReducedMotion()) return;

    const rect = element.getBoundingClientRect();
    const alreadyVisible = rect.top < window.innerHeight && rect.bottom > 0;
    if (alreadyVisible) return;

    const format = (n: number) =>
      formatStatNumber(n, { decimals, grouping, locale });
    const done = format(value);
    let frame = 0;

    // Hold the final width so the suffix does not shift while counting.
    element.style.minWidth = `${element.offsetWidth}px`;
    element.textContent = format(0);

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        const start = performance.now();
        const tick = (now: number) => {
          const t = Math.min(1, (now - start) / MOTION.countMs);
          element.textContent = t < 1 ? format(value * MOTION.ease(t)) : done;
          if (t < 1) frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
      },
      { threshold: 0.6 },
    );
    observer.observe(element);

    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      element.textContent = done;
      element.style.minWidth = "";
    };
  }, [value, decimals, grouping, locale, animate]);

  return (
    <>
      <span className="sr-only">{finalText}</span>
      <span
        ref={ref}
        aria-hidden="true"
        className="inline-block text-right tabular-nums"
      >
        {finalText}
      </span>
    </>
  );
}
