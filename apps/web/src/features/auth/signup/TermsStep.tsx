"use client";

import Link from "next/link";
import { CheckboxCheckIcon, ChevronRightIcon } from "@/components/icons";
import { Button } from "@/components/ui/Button";
import { useI18n } from "@/lib/i18n/I18nProvider";
import shared from "../shared/form.module.css";
import styles from "./TermsStep.module.css";

/**
 * Figma: signup-step1 280:56. The consent lines follow FLEXTV's sign-up (2026-11-01 사용자 결정: 약관 · 동의 · 환불 정책은
 * 플렉스티비 조건이 기본안): 이용약관 · 개인정보 수집 및 이용 (필수), 마케팅 활용 및 정보 수신 (선택). The Figma frame's
 * 청소년 보호정책 확인 line is not one of them; the policy stays linked from the footer. The consent lines are legal text:
 * they stay Korean until an approved translation exists (TBD).
 */

export type Agreements = { service: boolean; privacy: boolean; marketing: boolean };

const TERMS: { key: keyof Agreements; label: string; required: boolean; href: string }[] = [
  { key: "service", label: "이용약관 동의", required: true, href: "/terms/service" },
  { key: "privacy", label: "개인정보 수집 및 이용 동의", required: true, href: "/terms/privacy" },
  { key: "marketing", label: "마케팅 활용 및 정보 수신 동의", required: false, href: "/terms/marketing" }
];

type TermsStepProps = {
  value: Agreements;
  onChange: (value: Agreements) => void;
  onNext: () => void;
};

function Checkbox({ checked, onChange, label, strong }: { checked: boolean; onChange: (v: boolean) => void; label: string; strong?: boolean }) {
  return (
    <label className={`${styles.check} ${strong ? styles.checkStrong : ""}`}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className={styles.box} aria-hidden="true">
        {checked && <CheckboxCheckIcon />}
      </span>
      <span className={styles.checkLabel}>{label}</span>
    </label>
  );
}

export function TermsStep({ value, onChange, onNext }: TermsStepProps) {
  const { t } = useI18n();
  const all = TERMS.every((t) => value[t.key]);
  const requiredDone = TERMS.filter((t) => t.required).every((t) => value[t.key]);

  return (
    <div className={shared.section}>
      <div className={styles.list}>
        <div className={shared.divider} />
        <Checkbox
          strong
          checked={all}
          label="전체 동의 (선택 정보 포함)"
          onChange={(checked) => onChange({ service: checked, privacy: checked, marketing: checked })}
        />
        <div className={shared.divider} />
        <ul className={styles.terms}>
          {TERMS.map((term) => (
            <li key={term.key} className={styles.termRow}>
              <Checkbox
                checked={value[term.key]}
                label={`(${term.required ? "필수" : "선택"}) ${term.label}`}
                onChange={(checked) => onChange({ ...value, [term.key]: checked })}
              />
              <Link href={term.href} target="_blank" className={styles.view} aria-label={t("auth.viewTerms", { label: term.label })}>
                <ChevronRightIcon />
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <Button block disabled={!requiredDone} onClick={onNext}>
        {t("auth.nextStep")}
      </Button>
    </div>
  );
}
