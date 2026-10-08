"use client";

import { useRef } from "react";
import { CheckboxCheckIcon } from "@/components/icons";
import { PAYMENT_METHODS, type PaymentMethodId } from "@/services/wallet/chargeTypes";
import styles from "./charge.module.css";

/** Brand cards drawn in Figma 593:558; other methods use the neutral card. */
const BRAND: Partial<Record<PaymentMethodId, { title: string; subtitle: string; className: string }>> = {
  KAKAO_PAY: { title: "kakao pay", subtitle: "카카오페이 간편결제", className: styles.cardKakao },
  NAVER_PAY: { title: "N pay", subtitle: "네이버페이", className: styles.cardNaver }
};

/**
 * Figma 593:558 / 595:1818 — carousel of registered methods (200×90) + "결제수단 추가".
 * A method picked in 결제수단변경 that is not registered is shown first.
 */
export function MethodCards({
  saved,
  selected,
  onSelect,
  onAdd
}: {
  saved: PaymentMethodId[];
  selected: PaymentMethodId | null;
  onSelect: (id: PaymentMethodId) => void;
  onAdd: () => void;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const ids = selected && !saved.includes(selected) ? [selected, ...saved] : saved;

  return (
    <div className={styles.carousel}>
      <div ref={listRef} className={styles.cards} role="radiogroup" aria-label="결제수단">
        {ids.map((id) => {
          const on = id === selected;
          const brand = BRAND[id];
          const info = PAYMENT_METHODS[id];
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={info.name}
              className={`${styles.card} ${brand?.className ?? styles.cardNeutral} ${on ? styles.cardOn : ""}`}
              onClick={() => onSelect(id)}
            >
              <span className={styles.cardTitle}>{brand?.title ?? `${info.glyph} ${info.name}`.trim()}</span>
              <span className={styles.cardCheck} aria-hidden="true">
                {on && <CheckboxCheckIcon width={14} height={14} />}
              </span>
              <span className={styles.cardSubtitle}>{brand?.subtitle ?? info.subtitle}</span>
            </button>
          );
        })}
        <button type="button" className={`${styles.card} ${styles.cardAdd}`} onClick={onAdd}>
          <span className={styles.addIcon} aria-hidden="true">
            +
          </span>
          결제수단 추가
        </button>
      </div>
      <button
        type="button"
        className={styles.carouselNext}
        aria-label="다음 결제수단"
        onClick={() => listRef.current?.scrollBy({ left: 212, behavior: "smooth" })}
      >
        ›
      </button>
    </div>
  );
}
