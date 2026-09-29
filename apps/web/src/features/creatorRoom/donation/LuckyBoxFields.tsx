"use client";

import { useCallback, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Toast } from "@/components/ui/Toast";
import { formatNumber } from "@/lib/format";
import { luckyTierFor, type DonationCatalog } from "@/services/donations/donationCatalog";
import type { LuckyState } from "./drafts";
import { SwitchRow } from "./Fields";
import room from "../room.module.css";
import styles from "./luckybox.module.css";

/** Only emerald and royal change the look (875:7420 · 875:7559); silver and gold use the base style. */
const TONE: Record<string, string> = { silver: "", gold: "", emerald: styles.emerald, royal: styles.royal };

/**
 * 럭키박스 후원. Figma 851:5231 (base) · 875:6948 추가 · 875:7093 삭제 · 875:7228 당첨 2개 · 875:7368 10,000 ·
 * 875:7507 50,000 · 875:7646 등급 안내 · 875:7814 약관 · 875:7976 금액 오류 · 875:8116 당첨 미선택 · 875:8255 최대 5개.
 * Box count, winners and amount are only choices; tiers, odds and the draw belong to the server.
 */
export function LuckyBoxFields({ value, onChange, catalog }: { value: LuckyState; onChange: (next: LuckyState) => void; catalog: DonationCatalog }) {
  const lucky = catalog.luckyBox;
  const [guideOpen, setGuideOpen] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const clearToast = useCallback(() => setToast(null), []);

  const amount = value.amount ? Number(value.amount) : null;
  const tier = luckyTierFor(lucky, amount ?? 0);
  const winners = value.boxes.filter((b) => b.winner).length;
  const amountError =
    amount === null || amount < lucky.minAmount
      ? `후원 금액은 ${formatNumber(lucky.minAmount)} FN 이상 입력해주세요.`
      : amount > lucky.maxAmount
        ? `후원 금액은 ${formatNumber(lucky.maxAmount)} FN 이하로 입력해주세요.`
        : null;
  const atMax = value.boxes.length >= lucky.maxBoxes;
  const canDelete = value.selected !== null && value.boxes.length > lucky.minBoxes;

  const add = () => {
    if (atMax) {
      setToast(`박스는 최대 ${lucky.maxBoxes}개까지 추가할 수 있습니다.`);
      return;
    }
    const id = Math.max(0, ...value.boxes.map((b) => b.id)) + 1;
    onChange({ ...value, boxes: [...value.boxes, { id, winner: false }] });
  };

  const remove = () => {
    if (!canDelete) return;
    onChange({ ...value, boxes: value.boxes.filter((b) => b.id !== value.selected), selected: null });
  };

  return (
    <>
      <div className={styles.boxArea}>
        <div className={styles.boxRow}>
          {value.boxes.map((b, i) => (
            <div key={b.id} className={styles.boxCol}>
              <button
                type="button"
                className={`${styles.box} ${TONE[tier.tone]} ${value.selected === b.id ? styles.boxSelected : ""}`}
                aria-pressed={value.selected === b.id}
                aria-label={`${i + 1}번 박스${b.winner ? ", 당첨" : ""}`}
                onClick={() => onChange({ ...value, selected: value.selected === b.id ? null : b.id })}
              >
                <span aria-hidden="true">{tier.boxEmoji}</span>
              </button>
              <label className={styles.winner}>
                <input
                  type="checkbox"
                  checked={b.winner}
                  onChange={(e) => onChange({ ...value, boxes: value.boxes.map((x) => (x.id === b.id ? { ...x, winner: e.target.checked } : x)) })}
                />
                <span className={styles.check} aria-hidden="true">
                  {b.winner ? "✓" : ""}
                </span>
                당첨
              </label>
            </div>
          ))}
          <div className={styles.boxActions}>
            <button type="button" className={styles.trash} onClick={remove} disabled={!canDelete} aria-label="선택한 박스 삭제" title={`박스는 최소 ${lucky.minBoxes}개예요`}>
              🗑
            </button>
            <button type="button" className={styles.add} onClick={add} aria-disabled={atMax} aria-label="박스 추가">
              +
            </button>
          </div>
        </div>
        {winners === 0 ? (
          <p className={styles.fieldError} role="alert">
            당첨될 박스를 1개 이상 선택해주세요.
          </p>
        ) : winners >= 2 ? (
          <p className={styles.winnerCount}>당첨 박스 {winners}개</p>
        ) : (
          <p className={styles.hint}>박스를 눌러 선택 후 🗑로 삭제 · + 버튼으로 박스 추가 · 체크박스로 당첨 수 선택</p>
        )}
      </div>

      <div className={`${styles.grade} ${tier.headline ? TONE[tier.tone] : ""}`}>
        <strong>{tier.headline ?? "💡 후원 금액에 따라 박스 등급과 외형이 달라져요"}</strong>
        <span>{tier.description ?? lucky.tiers.map((t) => `${t.label} ${formatNumber(t.min)} FN`).join(" · ")}</span>
      </div>

      <div className={room.field}>
        <label className={`${styles.amountBox} ${amountError ? styles.amountError : ""}`}>
          <input
            inputMode="numeric"
            aria-label="럭키박스 후원 금액"
            aria-invalid={!!amountError}
            value={value.amount ? `${formatNumber(Number(value.amount))}` : ""}
            placeholder="0"
            onChange={(e) => onChange({ ...value, amount: e.target.value.replace(/[^\d]/g, "").replace(/^0+/, "").slice(0, 9) })}
          />
          <span className={styles.amountUnit}>FN</span>
          <span className={styles.amountHint}>금액 입력</span>
        </label>
        {amountError && value.amount !== "" && (
          <p className={styles.fieldError} role="alert">
            {amountError}
          </p>
        )}
      </div>

      <div className={styles.presets} role="group" aria-label="빠른 금액 선택">
        {lucky.presets.map((p) => (
          <button key={p} type="button" aria-pressed={amount === p} className={`${styles.preset} ${amount === p ? styles.presetOn : ""}`} onClick={() => onChange({ ...value, amount: String(p) })}>
            {formatNumber(p)}
          </button>
        ))}
      </div>

      <button type="button" className={styles.guideButton} onClick={() => setGuideOpen(true)} aria-haspopup="dialog">
        🎲 등급별 박스 안내
      </button>

      <div className={styles.odds}>
        <strong>추첨 범위 / 확률 안내</strong>
        <span>{lucky.odds.map((o) => `${o.range} ${o.percent}%`).join(" · ")}</span>
      </div>

      <div className={styles.termsRow}>
        <SwitchRow label="럭키박스 이용약관 및 확률 안내 동의 (필수)" checked={value.terms} onChange={(terms) => onChange({ ...value, terms })} />
        <button type="button" className={styles.termsLink} onClick={() => setTermsOpen(true)} aria-haspopup="dialog">
          약관 보기
        </button>
      </div>

      <Modal open={guideOpen} onClose={() => setGuideOpen(false)} title="등급별 박스 안내" width={680} className={styles.dialog}>
        <ul className={styles.guideGrid}>
          {lucky.tiers.map((t, i) => {
            const next = lucky.tiers[i + 1];
            const range = next ? `${formatNumber(t.min)}-${formatNumber(next.min - 1)} FN` : `${formatNumber(t.min)}-${formatNumber(lucky.maxAmount)} FN`;
            return (
              <li key={t.key} className={styles.guideTile}>
                <span className={styles.guideEmoji} aria-hidden="true">
                  {t.emoji}
                </span>
                <strong>{range}</strong>
                <span>{t.label}</span>
              </li>
            );
          })}
        </ul>
        <button type="button" className={styles.dialogButton} onClick={() => setGuideOpen(false)}>
          확인
        </button>
      </Modal>

      <Modal open={termsOpen} onClose={() => setTermsOpen(false)} title="럭키박스 후원 이용약관" width={700} className={styles.dialog}>
        <div className={styles.terms}>
          {lucky.terms.map((s) => (
            <section key={s.title}>
              <h3>{s.title}</h3>
              <p>{s.body}</p>
            </section>
          ))}
        </div>
        <button
          type="button"
          className={styles.dialogButton}
          onClick={() => {
            onChange({ ...value, terms: true });
            setTermsOpen(false);
          }}
        >
          확인하고 필수 동의하기
        </button>
      </Modal>

      <Toast message={toast} tone="neutral" onDone={clearToast} />
    </>
  );
}
