"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { PlayIcon, PlusIcon } from "@/components/icons";
import { Button } from "@/components/ui/Button";
import { formatCompactKo } from "@/lib/format";
import type { HeroSlide } from "@/services/home/homeFeed";
import styles from "./HeroCarousel.module.css";

/** Auto-advance interval. Not specified in Figma. */
const AUTOPLAY_MS = 6000;

/** Figma 727:2743 — hero banner with carousel dots (727:2768) */
export function HeroCarousel({ slides }: { slides: HeroSlide[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = slides.length;

  useEffect(() => {
    if (paused || count < 2) return;
    const timer = setTimeout(() => setIndex((i) => (i + 1) % count), AUTOPLAY_MS);
    return () => clearTimeout(timer);
  }, [index, paused, count]);

  if (count === 0) return null;
  const slide = slides[Math.min(index, count - 1)];

  return (
    <section
      className={styles.hero}
      aria-roledescription="carousel"
      aria-label="추천 방송"
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
        <div className={styles.meta} aria-live="polite">
          <div className={styles.labels}>
            <span className={styles.badge}>{slide.badge}</span>
            {slide.highlight && <span className={styles.highlight}>{slide.highlight}</span>}
          </div>
          <div className={styles.copy}>
            <h2 className={styles.title}>{slide.title}</h2>
            {slide.description && <p className={styles.description}>{slide.description}</p>}
          </div>
          <div className={styles.stats}>
            <span>실시간 시청자 {formatCompactKo(slide.viewerCount)}명</span>
            {slide.recommendCount !== undefined && (
              <>
                <span className={styles.statDot} aria-hidden="true" />
                <span>추천수 {formatCompactKo(slide.recommendCount)}</span>
              </>
            )}
          </div>
          <div className={styles.actions}>
            <Button href={slide.href} variant="light" size="lg">
              <PlayIcon />
              바로 시청하기
            </Button>
            {/* TODO: 보관함 (library) is not specified yet. */}
            <Button variant="surface" size="lg" aria-disabled="true" title="준비 중인 기능입니다">
              <PlusIcon />
              보관함에 저장
            </Button>
          </div>
        </div>

        {count > 1 && (
          <div className={styles.dots} role="group" aria-label="슬라이드 선택">
            {slides.map((s, i) => (
              <button
                key={s.id}
                type="button"
                className={`${styles.dot} ${i === index ? styles.dotActive : ""}`}
                aria-label={`${i + 1}번째 슬라이드`}
                aria-current={i === index ? "true" : undefined}
                onClick={() => setIndex(i)}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
