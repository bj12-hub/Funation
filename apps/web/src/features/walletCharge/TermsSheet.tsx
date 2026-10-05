"use client";

import Link from "next/link";
import { useState } from "react";
import { CheckboxCheckIcon } from "@/components/icons";
import { CHARGE_CONSENTS, type ChargeConsentKey } from "@/services/wallet/chargeTypes";
import styles from "./charge.module.css";

type Consents = Record<ChargeConsentKey, boolean>;

const NONE: Consents = { guardian: false, privacy: false, payment: false, marketing: false };

/** Figma 595:5475 — 서비스 이용약관 동의 sheet shown on the first charge. */
export function TermsSheet({ onCancel, onAgree }: { onCancel: () => void; onAgree: (consents: Consents) => Promise<boolean> }) {
  const [consents, setConsents] = useState<Consents>(NONE);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  const all = CHARGE_CONSENTS.every((c) => consents[c.key]);
  const requiredDone = CHARGE_CONSENTS.every((c) => !c.required || consents[c.key]);

  const toggleAll = () => {
    const next = !all;
    setConsents({ guardian: next, privacy: next, payment: next, marketing: next });
  };

  return (
    <section className={styles.sheet} role="region" aria-labelledby="charge-terms-title">
      <span className={styles.grabber} aria-hidden="true" />
      <h3 id="charge-terms-title" className={styles.sheetTitle}>
        서비스 이용약관 동의
      </h3>
      <p className={styles.sheetText}>안전한 결제 및 서비스 이용을 위해 약관 동의가 필요합니다.</p>

      <label className={`${styles.consentAll} ${all ? styles.consentAllOn : ""}`}>
        <input type="checkbox" className={styles.srOnly} checked={all} onChange={toggleAll} />
        <Box checked={all} />
        <span>
          <strong>약관 전체 동의 (선택 약관 포함)</strong>
          <span className={styles.consentAllSub}>이용약관, 개인정보 수집 및 마케팅 활용에 모두 동의합니다.</span>
        </span>
      </label>

      <ul className={styles.consents}>
        {CHARGE_CONSENTS.map((c) => (
          <li key={c.key} className={styles.consent}>
            <label>
              <input
                type="checkbox"
                className={styles.srOnly}
                checked={consents[c.key]}
                onChange={(e) => setConsents((prev) => ({ ...prev, [c.key]: e.target.checked }))}
              />
              <Box checked={consents[c.key]} />
              <span className={c.required ? styles.required : styles.optional}>[{c.required ? "필수" : "선택"}]</span>
              {c.label}
            </label>
            {/* Opens in a new tab so the charge in progress is kept. */}
            {c.href ? (
              <Link href={c.href} target="_blank" className={styles.viewTerms} aria-label={`${c.label} 보기 (새 탭)`}>
                보기 ›
              </Link>
            ) : (
              <span className={`${styles.viewTerms} ${styles.viewTermsOff}`} aria-disabled="true" title="약관 문서 준비 중">
                보기 ›
              </span>
            )}
          </li>
        ))}
      </ul>

      {failed && (
        <p className={styles.error} role="alert">
          약관 동의를 저장하지 못했습니다. 다시 시도해 주세요.
        </p>
      )}

      <div className={styles.actions}>
        <button type="button" className={styles.secondaryButton} onClick={onCancel}>
          닫기
        </button>
        <button
          type="button"
          className={styles.primaryButton}
          disabled={!requiredDone || pending}
          onClick={async () => {
            setPending(true);
            setFailed(false);
            try {
              if (!(await onAgree(consents))) setFailed(true);
            } catch {
              setFailed(true);
            } finally {
              setPending(false);
            }
          }}
        >
          다음
        </button>
      </div>
    </section>
  );
}

function Box({ checked }: { checked: boolean }) {
  return (
    <span className={`${styles.box} ${checked ? styles.boxOn : ""}`} aria-hidden="true">
      {checked && <CheckboxCheckIcon width={12} height={12} />}
    </span>
  );
}
