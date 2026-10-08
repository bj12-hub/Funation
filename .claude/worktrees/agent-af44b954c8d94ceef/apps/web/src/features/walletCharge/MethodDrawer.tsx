"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { PAYMENT_METHODS, type PaymentMethodId } from "@/services/wallet/chargeTypes";
import styles from "./charge.module.css";

/**
 * Figma 601:839 결제수단변경 (light sheet stacked on the charge modal).
 * The design's "투네간편" tile is another service's brand and is left out.
 */
export function MethodDrawer({
  open,
  methods,
  initial,
  onClose,
  onSelect
}: {
  open: boolean;
  methods: PaymentMethodId[];
  initial: PaymentMethodId | null;
  onClose: () => void;
  onSelect: (id: PaymentMethodId) => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="결제수단변경"
      width={520}
      className={styles.drawer}
      customHeader={
        <header className={styles.drawerHeader}>
          <h2>결제수단변경</h2>
          <button type="button" className={styles.drawerClose} aria-label="닫기" onClick={onClose}>
            ×
          </button>
        </header>
      }
    >
      {/* Remount per opening so the choice starts from the current method. */}
      {open && <DrawerBody methods={methods} initial={initial} onSelect={onSelect} />}
    </Modal>
  );
}

function DrawerBody({ methods, initial, onSelect }: { methods: PaymentMethodId[]; initial: PaymentMethodId | null; onSelect: (id: PaymentMethodId) => void }) {
  const [choice, setChoice] = useState<PaymentMethodId | null>(initial);
  const [featured, ...rest] = methods.includes("FUNATION_PAY") ? ["FUNATION_PAY" as const, ...methods.filter((m) => m !== "FUNATION_PAY")] : [null, ...methods];

  const tile = (id: PaymentMethodId, wide = false) => {
    const info = PAYMENT_METHODS[id];
    return (
      <button
        key={id}
        type="button"
        role="radio"
        aria-checked={choice === id}
        className={`${styles.tile} ${wide ? styles.tileWide : ""} ${choice === id ? styles.tileOn : ""}`}
        onClick={() => setChoice(id)}
      >
        <span className={wide ? styles.tileBrand : styles.tileTitle}>
          {info.glyph && <span className={styles.tileGlyph}>{info.glyph}</span>}
          {info.name}
        </span>
        <span className={styles.tileSubtitle}>{info.subtitle}</span>
      </button>
    );
  };

  return (
    <div className={styles.drawerBody}>
      <div role="radiogroup" aria-label="결제수단" className={styles.tiles}>
        {featured && tile(featured, true)}
        {rest.map((id) => id && tile(id))}
      </div>
      <button type="button" className={styles.drawerSubmit} disabled={!choice} onClick={() => choice && onSelect(choice)}>
        선택 완료
      </button>
    </div>
  );
}
