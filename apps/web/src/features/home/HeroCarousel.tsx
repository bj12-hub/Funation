"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { PlayIcon } from "@/components/icons";
import { Button } from "@/components/ui/Button";
import { formatCompact } from "@/lib/format";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { HeroSlide } from "@/services/home/homeFeed";
import styles from "./HeroCarousel.module.css";

/** Auto-advance interval. Not specified in Figma. */
const AUTOPLAY_MS = 6000;

/** True when the viewer asked the system for less motion (then the banner does not move on its own). */
function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const q = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(q.matches);
    const on = (e: MediaQueryListEvent) => setReduced(e.matches);
    q.addEventListener("change", on);
    return () => q.removeEventListener("change", on);
  }, []);
  return reduced;
}

/**
 * Figma 727:2743 — hero banner with carousel dots (727:2768). Auto-advance stops on hover / focus, with the
 * ⏸ button (touch screens have no hover; WCAG 2.2.2) and when the system asks for reduced motion. Screen readers
 * hear the slide text only when it changes because the viewer moved it, not every few seconds.
 */
export function HeroCarousel({ slides }: { slides: HeroSlide[] }) {
  const { t, locale } = useI18n();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [stopped, setStopped] = useState(false);
  const reducedMotion = useReducedMotion();
  const count = slides.length;
  const autoplay = count > 1 && !stopped && !reducedMotion;

  useEffect(() => {
    if (!autoplay || paused) return;
    const timer = setTimeout(() => setIndex((i) => (i + 1) % count), AUTOPLAY_MS);
    return () => clearTimeout(timer);
  }, [index, paused, count, autoplay]);

  if (count === 0) return null;
  const slide = slides[Math.min(index, count - 1)];

  return (
    <section
      className={styles.hero}
      aria-roledescription="carousel"
      aria-label={t("home.featured")}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      {slides.map((s, i) => (
        <Image
          key={s.id}
          src={s.imageUrl}
          alt=""
          fill
          priority={i === 0}
          sizes="100vw"
          className={`${styles.image} ${i === index ? styles.imageActive : ""}`}
        />
      ))}
      <span className={styles.dim} />
      <span className={styles.shade} />

      <div className={styles.inner}>
        <div className={styles.meta} aria-live={autoplay ? "off" : "polite"}>
          <div className={styles.labels}>
            <span className={styles.badge}>{slide.badge}</span>
            {slide.highlight && <span className={styles.highlight}>{slide.highlight}</span>}
          </div>
          <div className={styles.copy}>
            <h2 className={styles.title}>{slide.title}</h2>
            {slide.description && <p className={styles.description}>{slide.description}</p>}
          </div>
          <div className={styles.stats}>
            <span>{t("home.viewers", { count: formatCompact(slide.viewerCount, locale) })}</span>
            {slide.recommendCount !== undefined && (
              <>
                <span className={styles.statDot} aria-hidden="true" />
                <span>{t("home.recommends", { count: formatCompact(slide.recommendCount, locale) })}</span>
              </>
            )}
          </div>
          <div className={styles.actions}>
            <Button href={slide.href} variant="light" size="lg">
              <PlayIcon />
              {t("home.watchNow")}
            </Button>
          </div>
        </div>

        {count > 1 && (
          <div className={styles.dots} role="group" aria-label={t("home.slidePicker")}>
            {slides.map((s, i) => (
              <button
                key={s.id}
                type="button"
                className={`${styles.dot} ${i === index ? styles.dotActive : ""}`}
                aria-label={t("home.slideN", { n: i + 1 })}
                aria-current={i === index ? "true" : undefined}
                onClick={() => setIndex(i)}
              />
            ))}
            {!reducedMotion && (
              <button
                type="button"
                className={styles.playToggle}
                aria-label={stopped ? t("home.autoplayResume") : t("home.autoplayPause")}
                aria-pressed={stopped}
                onClick={() => setStopped((v) => !v)}
              >
                <span aria-hidden="true">{stopped ? "▶" : "⏸"}</span>
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
