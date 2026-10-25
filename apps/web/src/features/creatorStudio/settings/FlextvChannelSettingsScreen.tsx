"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import { Toast } from "@/components/ui/Toast";
import { CHANNEL_BANNER_MAX_BYTES, CHANNEL_BANNER_TYPES, CHANNEL_DESCRIPTION_MAX, CHANNEL_NAME_MAX, CHANNEL_NAME_MIN, LINK_PLATFORMS, type LinkPlatform } from "@/lib/flextv/rules";
import {
  checkFlextvChannelName,
  saveFlextvChannelDescription,
  saveFlextvChannelLinks,
  saveFlextvChannelName,
  uploadFlextvChannelBanner
} from "@/services/creator/flextvChannelSettings";
import { LINK_LABEL, LINK_MAX, type ChannelNameCheck, type ChannelSettingResult, type FlextvChannelSettingsView } from "@/services/creator/flextvChannelSettingsTypes";
import styles from "../broadcast/broadcast.module.css";
import local from "./flextvChannelSettings.module.css";

const LOGIN = "/login?role=creator&next=/creator/settings";
const UNREACHABLE = "FLEXTV가 응답하지 않았어요. 잠시 후 다시 시도해 주세요.";

/** A call FLEXTV did not answer shows a message under its part instead of the error page. */
async function attempt<T>(call: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await call();
  } catch {
    return fallback;
  }
}
const failed = (): ChannelSettingResult => ({ status: "INVALID", message: UNREACHABLE });

/**
 * 채널 설정 with FLEXTV (phase 7; code-first, no Figma frame — FLEXTV's own channel-setting page is the reference).
 * Route `/creator/settings`. Each part is saved on its own, as on FLEXTV; every value is checked again on the server.
 */
export function FlextvChannelSettingsScreen({ view }: { view: FlextvChannelSettingsView }) {
  const router = useRouter();
  const [toast, setToast] = useState<string | null>(null);
  const clear = useCallback(() => setToast(null), []);

  /** The message to show under the part, or null when it was saved (the page reloads with the new value). */
  const settle = (result: ChannelSettingResult, ok: string): string | null => {
    if (result.status === "UNAUTHORIZED") {
      router.push(LOGIN);
      return null;
    }
    if (result.status === "SAVED") {
      setToast(ok);
      router.refresh();
      return null;
    }
    return result.status === "TAKEN" ? "이미 있는 방송국 이름이에요." : result.message;
  };

  return (
    <div className={styles.content}>
      <h1 className={styles.pageTitle}>채널 설정</h1>
      <p className={styles.help}>FLEXTV 방송국 정보예요. 여기서 바꾸면 FLEXTV에도 그대로 반영돼요.</p>
      <NameCard current={view.name} settle={settle} />
      {/* Keyed by the kept text: after a save the box shows what FLEXTV kept (it filters forbidden words out). */}
      <DescriptionCard key={view.description} current={view.description} settle={settle} />
      <BannerCard current={view.bannerUrl} settle={settle} />
      <section className={styles.card} aria-labelledby="ch-avatar">
        <h2 id="ch-avatar" className={styles.cardTitle}>
          프로필 사진
        </h2>
        <div className={local.avatarRow}>
          {view.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- FLEXTV's CDN, not one of the image optimizer's hosts
            <img src={view.avatarUrl} alt="" width={64} height={64} className={local.avatar} />
          ) : (
            <span className={local.avatar} aria-hidden="true" />
          )}
          <p className={styles.help}>채널 프로필 사진은 내 FLEXTV 프로필 사진이에요.</p>
          <Link href="/mypage" className={styles.secondaryButton}>
            마이페이지에서 바꾸기
          </Link>
        </div>
      </section>
      <LinksCard current={view.links} settle={settle} />
      <Toast message={toast} tone="neutral" onDone={clear} />
    </div>
  );
}

type Settle = (result: ChannelSettingResult, ok: string) => string | null;

function NameCard({ current, settle }: { current: string; settle: Settle }) {
  const [name, setName] = useState("");
  const [checked, setChecked] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [pending, start] = useTransition();
  const value = name.trim();

  const check = () =>
    start(async () => {
      const result = await attempt<ChannelNameCheck>(() => checkFlextvChannelName(value), { status: "INVALID", message: UNREACHABLE });
      if (result.status === "UNAUTHORIZED") return void settle(result, "");
      if (result.status === "AVAILABLE") {
        setChecked(value);
        setMessage({ text: "사용할 수 있는 방송국 이름이에요.", ok: true });
        return;
      }
      setMessage({ text: result.status === "TAKEN" ? "이미 있는 방송국 이름이에요." : result.message, ok: false });
    });
  const save = () =>
    start(async () => {
      const error = settle(await attempt(() => saveFlextvChannelName(value), failed()), "방송국 이름을 바꿨어요.");
      setMessage(error ? { text: error, ok: false } : null);
      if (!error) {
        setName("");
        setChecked(null);
      }
    });

  return (
    <section className={styles.card} aria-labelledby="ch-name">
      <h2 id="ch-name" className={styles.cardTitle}>
        방송국 이름
      </h2>
      <p className={styles.help}>지금 이름: {current || "(기본 이름)"}</p>
      <div className={styles.inline}>
        <input
          className={`${styles.input} ${local.grow}`}
          aria-label="새 방송국 이름"
          placeholder={`${CHANNEL_NAME_MIN}~${CHANNEL_NAME_MAX}자`}
          maxLength={CHANNEL_NAME_MAX}
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setChecked(null);
            setMessage(null);
          }}
        />
        <button type="button" className={styles.secondaryButton} disabled={pending || value.length < CHANNEL_NAME_MIN} onClick={check}>
          중복 확인
        </button>
        <button type="button" className={styles.secondaryButton} disabled={pending || checked !== value || !value} onClick={save}>
          저장
        </button>
      </div>
      {message && (
        <p className={message.ok ? styles.hint : styles.error} role={message.ok ? "status" : "alert"}>
          {message.text}
        </p>
      )}
    </section>
  );
}

function DescriptionCard({ current, settle }: { current: string; settle: Settle }) {
  const [text, setText] = useState(current);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const save = () => start(async () => setError(settle(await attempt(() => saveFlextvChannelDescription(text), failed()), "방송국 소개를 바꿨어요.")));
  return (
    <section className={styles.card} aria-labelledby="ch-desc">
      <h2 id="ch-desc" className={styles.cardTitle}>
        방송국 소개
      </h2>
      <textarea
        className={`${styles.input} ${local.textarea}`}
        aria-labelledby="ch-desc"
        maxLength={CHANNEL_DESCRIPTION_MAX}
        rows={5}
        value={text}
        placeholder={`방송국 소개를 작성해 주세요. 최대 ${CHANNEL_DESCRIPTION_MAX}자`}
        onChange={(e) => setText(e.target.value)}
      />
      <div className={styles.actions}>
        <span className={styles.hint}>
          {text.length} / {CHANNEL_DESCRIPTION_MAX}
        </span>
        <button type="button" className={styles.secondaryButton} disabled={pending || !text.trim() || text === current} onClick={save}>
          저장
        </button>
      </div>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </section>
  );
}

const BANNER_ACCEPT = CHANNEL_BANNER_TYPES.join(",");

function BannerCard({ current, settle }: { current: string | null; settle: Settle }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const upload = (file: File | undefined) => {
    if (!file) return;
    if (!(CHANNEL_BANNER_TYPES as readonly string[]).includes(file.type)) return setError("JPG, PNG 이미지만 올릴 수 있어요.");
    if (file.size > CHANNEL_BANNER_MAX_BYTES) return setError("20MB 미만의 이미지만 올릴 수 있어요.");
    const form = new FormData();
    form.set("banner", file);
    start(async () => setError(settle(await attempt(() => uploadFlextvChannelBanner(form), failed()), "배너를 바꿨어요.")));
  };
  return (
    <section className={styles.card} aria-labelledby="ch-banner">
      <h2 id="ch-banner" className={styles.cardTitle}>
        배너 이미지
      </h2>
      {current && (
        // eslint-disable-next-line @next/next/no-img-element -- FLEXTV's CDN, not one of the image optimizer's hosts
        <img src={current} alt="지금 배너" className={local.banner} />
      )}
      <p className={styles.hint}>1080 × 140px 권장 · JPG, PNG · 20MB 미만</p>
      <label className={`${styles.secondaryButton} ${local.fileButton}`} aria-disabled={pending || undefined}>
        {pending ? "올리는 중…" : "이미지 올리기"}
        <input
          type="file"
          accept={BANNER_ACCEPT}
          className={local.fileInput}
          disabled={pending}
          onChange={(e) => {
            upload(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </label>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </section>
  );
}

function LinksCard({ current, settle }: { current: Record<LinkPlatform, string>; settle: Settle }) {
  const [links, setLinks] = useState(current);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const changed = LINK_PLATFORMS.some((k) => links[k] !== current[k]);
  const save = () => start(async () => setError(settle(await attempt(() => saveFlextvChannelLinks(links), failed()), "링크를 저장했어요.")));
  return (
    <section className={styles.card} aria-labelledby="ch-links">
      <h2 id="ch-links" className={styles.cardTitle}>
        방송국 링크
      </h2>
      <p className={styles.help}>채널에 보여 줄 SNS 주소예요. 비워 두면 보이지 않아요.</p>
      {LINK_PLATFORMS.map((key) => (
        <label key={key} className={styles.field}>
          <span className={styles.fieldLabel}>{LINK_LABEL[key]}</span>
          <input
            className={styles.input}
            type="url"
            inputMode="url"
            maxLength={LINK_MAX}
            placeholder="https://"
            value={links[key]}
            onChange={(e) => setLinks((l) => ({ ...l, [key]: e.target.value }))}
          />
        </label>
      ))}
      <div className={styles.actions}>
        <button type="button" className={styles.secondaryButton} disabled={pending || !changed} onClick={save}>
          저장
        </button>
      </div>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
