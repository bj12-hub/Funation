"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { Toast } from "@/components/ui/Toast";
import { Toggle } from "@/components/ui/Toggle";
import { updateMarketingConsent } from "@/services/account/myAccount";
import {
  reissueIntegrationKey,
  revealIntegrationKey,
  saveSnsLinks,
  setCreatorLanguages,
  setLiveProfileVisible,
  setMainPlatform
} from "@/services/creator/creatorSettings";
import { CREATOR_LANGUAGES, MAIN_PLATFORMS, SNS_KINDS, type CreatorLanguage, type MainPlatform, type SnsLink } from "@/services/creator/creatorSettingsTypes";
import styles from "./settings.module.css";

/** Small toast + login redirect shared by the settings cards. */
function useFeedback() {
  const router = useRouter();
  const [toast, setToast] = useState<string | null>(null);
  const clear = useCallback(() => setToast(null), []);
  const handle = (status: string, ok = "저장되었습니다.", message?: string) => {
    if (status === "UNAUTHORIZED") router.push("/login?role=creator&next=/creator/settings");
    else setToast(status === "SAVED" || status === "OK" ? ok : message ?? "저장하지 못했습니다. 다시 시도해 주세요.");
  };
  return { toast: <Toast message={toast} tone="neutral" onDone={clear} />, handle, setToast };
}

// ── Funation 설정 (315:490) ────────────────────────────────────────────────────

export function FunationSettingsCard({ live, marketing, languages }: { live: boolean; marketing: boolean; languages: CreatorLanguage[] }) {
  const [state, setState] = useState({ live, marketing, languages });
  const [pending, startTransition] = useTransition();
  const { toast, handle } = useFeedback();

  const run = (next: typeof state, action: () => Promise<{ status: string; message?: string }>) => {
    const previous = state;
    setState(next); // optimistic; reverted when the server refuses
    startTransition(async () => {
      try {
        const r = await action();
        if (r.status !== "SAVED") setState(previous);
        handle(r.status, "저장되었습니다.", r.message);
      } catch {
        setState(previous);
        handle("FAILED");
      }
    });
  };

  return (
    <section className={`${styles.card} ${styles.funation}`} aria-labelledby="set-funation">
      <h3 id="set-funation" className={styles.cardTitle}>
        썸네이션 설정
      </h3>
      <div className={styles.toggleRow}>
        <div>
          <strong>Live 프로필 노출</strong>
          <span>썸네이션에 방송을 공개합니다.</span>
        </div>
        <Toggle label="Live 프로필 노출" checked={state.live} busy={pending} onChange={(v) => run({ ...state, live: v }, () => setLiveProfileVisible(v))} />
      </div>
      <div className={styles.toggleRow}>
        <div>
          <strong>마케팅 활용 동의</strong>
          <span>이벤트 및 혜택 정보를 수신합니다.</span>
        </div>
        <Toggle
          label="마케팅 활용 동의"
          checked={state.marketing}
          busy={pending}
          onChange={(v) => run({ ...state, marketing: v }, async () => ((await updateMarketingConsent(v)).status === "SAVED" ? { status: "SAVED" } : { status: "FAILED" }))}
        />
      </div>
      <hr className={styles.divider} />
      <fieldset className={styles.languages}>
        <legend>언어 설정</legend>
        {CREATOR_LANGUAGES.map((l) => {
          const on = state.languages.includes(l.key);
          return (
            <label key={l.key} className={styles.check}>
              <input
                type="checkbox"
                checked={on}
                disabled={pending}
                onChange={() => {
                  const next = on ? state.languages.filter((x) => x !== l.key) : [...state.languages, l.key];
                  run({ ...state, languages: next }, () => setCreatorLanguages(next));
                }}
              />
              <span className={styles.box} aria-hidden="true">
                {on ? "✓" : ""}
              </span>
              {l.label}
            </label>
          );
        })}
      </fieldset>
      {toast}
    </section>
  );
}

// ── 복사 / 열기 ────────────────────────────────────────────────────────────────

export function CopyButton({ value, label = "복사", className }: { value: string | (() => Promise<string | null>); label?: string; className?: string }) {
  const { toast, setToast } = useFeedback();
  return (
    <>
      <button
        type="button"
        className={className ?? styles.secondaryButton}
        onClick={async () => {
          try {
            const text = typeof value === "string" ? value : await value();
            if (!text) return;
            await navigator.clipboard.writeText(text);
            setToast("복사했습니다.");
          } catch {
            setToast("복사하지 못했습니다. 직접 선택해 복사해 주세요.");
          }
        }}
      >
        {label}
      </button>
      {toast}
    </>
  );
}

// ── 메인 방송 플랫폼 (315:538) ─────────────────────────────────────────────────

export function MainPlatformCard({ initial }: { initial: MainPlatform }) {
  const [value, setValue] = useState(initial);
  const [pending, startTransition] = useTransition();
  const { toast, handle } = useFeedback();
  return (
    <section className={`${styles.card} ${styles.platformCard}`} aria-labelledby="set-platform">
      <h3 id="set-platform" className={styles.cardTitle}>
        메인 방송 플랫폼
      </h3>
      <div className={styles.radioGrid} role="radiogroup" aria-labelledby="set-platform">
        {MAIN_PLATFORMS.map((p) => (
          <label key={p.key} className={`${styles.radio} ${value === p.key ? styles.radioOn : ""}`}>
            <input
              type="radio"
              name="main-platform"
              checked={value === p.key}
              disabled={pending}
              onChange={() => {
                const previous = value;
                setValue(p.key);
                startTransition(async () => {
                  try {
                    const r = await setMainPlatform(p.key);
                    if (r.status !== "SAVED") setValue(previous);
                    handle(r.status);
                  } catch {
                    setValue(previous);
                    handle("FAILED");
                  }
                });
              }}
            />
            <span className={styles.platformDot} style={{ background: p.color }} aria-hidden="true" />
            {p.label}
          </label>
        ))}
      </div>
      {toast}
    </section>
  );
}

// ── SNS 연동 설정 (315:566) ────────────────────────────────────────────────────

const SNS_ICON: Record<SnsLink["kind"], string> = { INSTAGRAM: "◎", TIKTOK: "♪", X: "𝕏", ETC: "🔗" };

export function SnsCard({ initial }: { initial: SnsLink[] }) {
  const [links, setLinks] = useState(initial);
  const [pending, startTransition] = useTransition();
  const { toast, handle } = useFeedback();
  return (
    <section className={`${styles.card} ${styles.snsCard}`} aria-labelledby="set-sns">
      <div className={styles.cardHead}>
        <h3 id="set-sns" className={styles.cardTitle}>
          SNS 연동 설정
        </h3>
        <button
          type="button"
          className={styles.primaryButton}
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              try {
                const r = await saveSnsLinks(links);
                handle(r.status, "저장되었습니다.", "message" in r ? r.message : undefined);
              } catch {
                handle("FAILED");
              }
            })
          }
        >
          {pending ? "저장 중..." : "저장"}
        </button>
      </div>
      <div className={styles.snsGrid}>
        {links.map((l, i) => {
          const kind = SNS_KINDS.find((k) => k.key === l.kind)!;
          return (
            <label key={l.kind} className={styles.snsRow}>
              <span className={`${styles.snsIcon} ${styles[`sns${l.kind}`]}`} aria-hidden="true">
                {SNS_ICON[l.kind]}
              </span>
              <span className={styles.snsLabel}>{kind.label}</span>
              <input
                type="url"
                inputMode="url"
                placeholder={kind.placeholder}
                value={l.url}
                maxLength={200}
                aria-label={`${kind.label} 주소`}
                onChange={(e) => setLinks((list) => list.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))}
              />
            </label>
          );
        })}
      </div>
      {toast}
    </section>
  );
}

// ── 연동키 발급 (315:634) ──────────────────────────────────────────────────────

export function IntegrationKey({ masked }: { masked: string }) {
  const [value, setValue] = useState(masked);
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const { toast, handle } = useFeedback();

  return (
    <>
      <div className={styles.fieldRow}>
        <span className={`${styles.input} ${styles.keyInput}`}>
          <span aria-hidden="true">🔒</span>
          <span className={styles.keyText}>{value}</span>
        </span>
        <CopyButton
          value={async () => {
            const r = await revealIntegrationKey();
            if (r.status !== "OK") {
              handle(r.status);
              return null;
            }
            return r.key;
          }}
        />
        <button type="button" className={styles.reissueButton} onClick={() => setConfirming(true)}>
          재발급
        </button>
      </div>
      <p className={styles.warning}>
        <span aria-hidden="true">⚠️</span>
        연동키는 외부에 공개하지 마세요. 재발급 시 기존 키는 즉시 무효화되며 연동된 서비스가 중단될 수 있습니다.
      </p>
      <Modal
        open={confirming}
        onClose={() => !pending && setConfirming(false)}
        title="연동키를 재발급할까요?"
        description="기존 키는 즉시 무효화되며, 기존 키로 연동된 서비스가 중단될 수 있습니다."
        footer={
          <>
            <button type="button" className={styles.secondaryButton} disabled={pending} onClick={() => setConfirming(false)}>
              취소
            </button>
            <button
              type="button"
              className={styles.primaryButton}
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  try {
                    const r = await reissueIntegrationKey();
                    if (r.status === "REISSUED") setValue(r.masked);
                    setConfirming(false);
                    handle(r.status === "REISSUED" ? "SAVED" : r.status, "새 연동키를 발급했습니다.");
                  } catch {
                    handle("FAILED");
                  }
                })
              }
            >
              {pending ? "재발급 중..." : "재발급"}
            </button>
          </>
        }
      />
      {toast}
    </>
  );
}
