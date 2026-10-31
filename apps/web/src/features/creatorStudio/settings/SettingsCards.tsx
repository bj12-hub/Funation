"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { Toast } from "@/components/ui/Toast";
import { Toggle } from "@/components/ui/Toggle";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { MessageKey } from "@/lib/i18n/translate";
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

/** MAIN_PLATFORMS labels written in Korean, in the viewer's language (2026-11-01); the others show as written. */
const PLATFORM_KEYS: Partial<Record<MainPlatform, MessageKey>> = {
  SOOP: "studioSettings.platformSoop",
  FLEXTV: "studioSettings.platformFlextv",
  CHZZK: "studioSettings.platformChzzk",
  OTHER: "studioSettings.platformOther"
};

/** Small toast + login redirect shared by the settings cards. */
function useFeedback() {
  const router = useRouter();
  const { t } = useI18n();
  const [toast, setToast] = useState<string | null>(null);
  const clear = useCallback(() => setToast(null), []);
  const handle = (status: string, ok = t("studioSettings.saved"), message?: string) => {
    if (status === "UNAUTHORIZED") router.push("/login?role=creator&next=/creator/settings");
    else setToast(status === "SAVED" || status === "OK" ? ok : message ?? t("studioSettings.saveFailed"));
  };
  return { toast: <Toast message={toast} tone="neutral" onDone={clear} />, handle, setToast, t };
}

// ── Ssumnation 설정 (315:490) ────────────────────────────────────────────────────

export function SsumnationSettingsCard({ live, marketing, languages }: { live: boolean; marketing: boolean; languages: CreatorLanguage[] }) {
  const [state, setState] = useState({ live, marketing, languages });
  const [pending, startTransition] = useTransition();
  const { toast, handle, t } = useFeedback();

  const run = (next: typeof state, action: () => Promise<{ status: string; message?: string }>) => {
    const previous = state;
    setState(next); // optimistic; reverted when the server refuses
    startTransition(async () => {
      try {
        const r = await action();
        if (r.status !== "SAVED") setState(previous);
        handle(r.status, t("studioSettings.saved"), r.message);
      } catch {
        setState(previous);
        handle("FAILED");
      }
    });
  };

  return (
    <section className={`${styles.card} ${styles.ssumnation}`} aria-labelledby="set-ssumnation">
      <h3 id="set-ssumnation" className={styles.cardTitle}>
        {t("studioSettings.ssumnation")}
      </h3>
      <div className={styles.toggleRow}>
        <div>
          <strong>{t("studioSettings.liveProfile")}</strong>
          <span>{t("studioSettings.liveProfileHelp")}</span>
        </div>
        <Toggle label={t("studioSettings.liveProfile")} checked={state.live} busy={pending} onChange={(v) => run({ ...state, live: v }, () => setLiveProfileVisible(v))} />
      </div>
      {/* Consent wording stays Korean in every language until an approved translation exists (docs/development/i18n.md). */}
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
        <legend>{t("studioSettings.languages")}</legend>
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

export function CopyButton({ value, label, className }: { value: string | (() => Promise<string | null>); label?: string; className?: string }) {
  const { toast, setToast, t } = useFeedback();
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
            setToast(t("studioSettings.copyDone"));
          } catch {
            setToast(t("studioSettings.copyFailed"));
          }
        }}
      >
        {label ?? t("studioSettings.copy")}
      </button>
      {toast}
    </>
  );
}

// ── 메인 방송 플랫폼 (315:538) ─────────────────────────────────────────────────

export function MainPlatformCard({ initial }: { initial: MainPlatform }) {
  const [value, setValue] = useState(initial);
  const [pending, startTransition] = useTransition();
  const { toast, handle, t } = useFeedback();
  return (
    <section className={`${styles.card} ${styles.platformCard}`} aria-labelledby="set-platform">
      <h3 id="set-platform" className={styles.cardTitle}>
        {t("studioSettings.mainPlatform")}
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
            {PLATFORM_KEYS[p.key] ? t(PLATFORM_KEYS[p.key]!) : p.label}
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
  const { toast, handle, t } = useFeedback();
  return (
    <section className={`${styles.card} ${styles.snsCard}`} aria-labelledby="set-sns">
      <div className={styles.cardHead}>
        <h3 id="set-sns" className={styles.cardTitle}>
          {t("studioSettings.sns")}
        </h3>
        <button
          type="button"
          className={styles.primaryButton}
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              try {
                const r = await saveSnsLinks(links);
                handle(r.status, t("studioSettings.saved"), "message" in r ? r.message : undefined);
              } catch {
                handle("FAILED");
              }
            })
          }
        >
          {pending ? t("studioSettings.saving") : t("studioSettings.save")}
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
                aria-label={t("studioSettings.snsAddress", { name: kind.label })}
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
  const { toast, handle, t } = useFeedback();

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
          {t("studioSettings.reissue")}
        </button>
      </div>
      <p className={styles.warning}>
        <span aria-hidden="true">⚠️</span>
        {t("studioSettings.keyWarning")}
      </p>
      <Modal
        open={confirming}
        onClose={() => !pending && setConfirming(false)}
        title={t("studioSettings.reissueTitle")}
        description={t("studioSettings.reissueDesc")}
        footer={
          <>
            <button type="button" className={styles.secondaryButton} disabled={pending} onClick={() => setConfirming(false)}>
              {t("studioSettings.cancel")}
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
                    handle(r.status === "REISSUED" ? "SAVED" : r.status, t("studioSettings.reissued"));
                  } catch {
                    handle("FAILED");
                  }
                })
              }
            >
              {pending ? t("studioSettings.reissuing") : t("studioSettings.reissue")}
            </button>
          </>
        }
      />
      {toast}
    </>
  );
}
