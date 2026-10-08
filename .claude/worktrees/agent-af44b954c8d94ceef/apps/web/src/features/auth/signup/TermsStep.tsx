"use client";

import Link from "next/link";
import { CheckboxCheckIcon, ChevronRightIcon } from "@/components/icons";
import { Button } from "@/components/ui/Button";
import shared from "../shared/form.module.css";
import styles from "./TermsStep.module.css";

/** Figma: signup-step1 280:56 */

export type Agreements = { youth: boolean; service: boolean; privacy: boolean; marketing: boolean };

const TERMS: { key: keyof Agreements; label: string; required: boolean; href: string }[] = [
  { key: "youth", label: "청소년 보호정책을 확인하였습니다.", required: true, href: "/terms/youth" },
  { key: "service", label: "서비스 이용약관(도네이터/크리에이터)", required: true, href: "/terms/service" },
  { key: "privacy", label: "개인정보 처리 방침", required: true, href: "/terms/privacy" },
  { key: "marketing", label: "광고성 정보 수신 및 마케팅 활용 동의", required: false, href: "/terms/marketing" }
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
          onChange={(checked) => onChange({ youth: checked, service: checked, privacy: checked, marketing: checked })}
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
              <Link href={term.href} target="_blank" className={styles.view} aria-label={`${term.label} 전문 보기`}>
                <ChevronRightIcon />
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <Button block disabled={!requiredDone} onClick={onNext}>
        다음 단계
      </Button>
    </div>
  );
}
