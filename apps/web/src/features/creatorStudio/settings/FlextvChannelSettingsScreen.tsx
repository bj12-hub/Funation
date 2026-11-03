"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import { Toast } from "@/components/ui/Toast";
import { CHANNEL_BANNER_MAX_BYTES, CHANNEL_BANNER_TYPES, CHANNEL_DESCRIPTION_MAX, CHANNEL_NAME_MAX, CHANNEL_NAME_MIN, LINK_PLATFORMS, type LinkPlatform } from "@/lib/flextv/rules";
import { useI18n } from "@/lib/i18n/I18nProvider";
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

/** A call FLEXTV did not answer shows a message under its part instead of the error page. */
async function attempt<T>(call: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await call();
  } catch {
    return fallback;
  }
}
/** `message`: the "FLEXTV did not answer" line in the viewer's language. */
const failed = (message: string): ChannelSettingResult => ({ status: "INVALID", message });

/**
 * 채널 설정 with FLEXTV (phase 7; code-first, no Figma frame — FLEXTV's own channel-setting page is the reference).
 * Route `/creator/settings`. Each part is saved on its own, as on FLEXTV; every value is checked again on the server.
 */
export function FlextvChannelSettingsScreen({ view }: { view: FlextvChannelSettingsView }) {
  const { t } = useI18n();
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
    return result.status === "TAKEN" ? t("flextvChannelSettings.nameTaken") : result.message;
  };

  return (
    <div className={styles.content}>
      <h1 className={styles.pageTitle}>{t("flextvChannelSettings.title")}</h1>
      <p className={styles.help}>{t("flextvChannelSettings.intro")}</p>
      <NameCard current={view.name} settle={settle} />
      <DescriptionCard current={view.description} settle={settle} />
      <BannerCard current={view.bannerUrl} settle={settle} />
      <section className={styles.card} aria-labelledby="ch-avatar">
        <h2 id="ch-avatar" className={styles.cardTitle}>
          {t("flextvChannelSettings.avatar")}
        </h2>
        <div className={local.avatarRow}>
          {view.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- FLEXTV's CDN, not one of the image optimizer's hosts
            <img src={view.avatarUrl} alt="" width={64} height={64} className={local.avatar} />
          ) : (
            <span className={local.avatar} aria-hidden="true" />
          )}
          <p className={styles.help}>{t("flextvChannelSettings.avatarHelp")}</p>
          <Link href="/mypage" className={styles.secondaryButton}>
            {t("flextvChannelSettings.avatarChange")}
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
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [checked, setChecked] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [pending, start] = useTransition();
  const value = name.trim();

  const check = () =>
    start(async () => {
      const result = await attempt<ChannelNameCheck>(() => checkFlextvChannelName(value), { status: "INVALID", message: t("flextvChannelSettings.unreachable") });
      if (result.status === "UNAUTHORIZED") return void settle(result, "");
      if (result.status === "AVAILABLE") {
        setChecked(value);
        setMessage({ text: t("flextvChannelSettings.nameAvailable"), ok: true });
        return;
      }
      setMessage({ text: result.status === "TAKEN" ? t("flextvChannelSettings.nameTaken") : result.message, ok: false });
    });
  const save = () =>
    start(async () => {
      const error = settle(
        await attempt(() => saveFlextvChannelName(value), failed(t("flextvChannelSettings.unreachable"))),
        t("flextvChannelSettings.nameSaved")
      );
      setMessage(error ? { text: error, ok: false } : null);
      if (!error) {
        setName("");
        setChecked(null);
      }
    });

  return (
    <section className={styles.card} aria-labelledby="ch-name">
      <h2 id="ch-name" className={styles.cardTitle}>
        {t("flextvChannelSettings.name")}
      </h2>
      <p className={styles.help}>{t("flextvChannelSettings.nameCurrent", { name: current || t("flextvChannelSettings.nameDefault") })}</p>
      <div className={styles.inline}>
        <input
          className={`${styles.input} ${local.grow}`}
          aria-label={t("flextvChannelSettings.nameNewAria")}
          placeholder={t("flextvChannelSettings.namePlaceholder", { min: CHANNEL_NAME_MIN, max: CHANNEL_NAME_MAX })}
          maxLength={CHANNEL_NAME_MAX}
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setChecked(null);
            setMessage(null);
          }}
        />
        <button type="button" className={styles.secondaryButton} disabled={pending || value.length < CHANNEL_NAME_MIN} onClick={check}>
          {t("flextvChannelSettings.nameCheck")}
        </button>
        <button type="button" className={styles.secondaryButton} disabled={pending || checked !== value || !value} onClick={save}>
          {t("studioSettings.save")}
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
  const { t } = useI18n();
  const [text, setText] = useState(current);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const save = () =>
    start(async () =>
      setError(
        settle(
          await attempt(() => saveFlextvChannelDescription(text), failed(t("flextvChannelSettings.unreachable"))),
          t("flextvChannelSettings.descriptionSaved")
        )
      )
    );
  return (
    <section className={styles.card} aria-labelledby="ch-desc">
      <h2 id="ch-desc" className={styles.cardTitle}>
        {t("flextvChannelSettings.description")}
      </h2>
      <textarea
        className={`${styles.input} ${local.textarea}`}
        aria-labelledby="ch-desc"
        maxLength={CHANNEL_DESCRIPTION_MAX}
        rows={5}
        value={text}
        placeholder={t("flextvChannelSettings.descriptionPlaceholder", { max: CHANNEL_DESCRIPTION_MAX })}
        onChange={(e) => setText(e.target.value)}
      />
      <div className={styles.actions}>
        <span className={styles.hint}>
          {text.length} / {CHANNEL_DESCRIPTION_MAX}
        </span>
        <button type="button" className={styles.secondaryButton} disabled={pending || !text.trim() || text === current} onClick={save}>
          {t("studioSettings.save")}
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
  const { t } = useI18n();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const upload = (file: File | undefined) => {
    if (!file) return;
    if (!(CHANNEL_BANNER_TYPES as readonly string[]).includes(file.type)) return setError(t("flextvChannelSettings.bannerUnsupported"));
    if (file.size > CHANNEL_BANNER_MAX_BYTES) return setError(t("flextvChannelSettings.bannerTooLarge"));
    const form = new FormData();
    form.set("banner", file);
    start(async () =>
      setError(settle(await attempt(() => uploadFlextvChannelBanner(form), failed(t("flextvChannelSettings.unreachable"))), t("flextvChannelSettings.bannerSaved")))
    );
  };
  return (
    <section className={styles.card} aria-labelledby="ch-banner">
      <h2 id="ch-banner" className={styles.cardTitle}>
        {t("flextvChannelSettings.banner")}
      </h2>
      {current && (
        // eslint-disable-next-line @next/next/no-img-element -- FLEXTV's CDN, not one of the image optimizer's hosts
        <img src={current} alt={t("flextvChannelSettings.bannerCurrentAlt")} className={local.banner} />
      )}
      <p className={styles.hint}>{t("flextvChannelSettings.bannerSpec")}</p>
      <label className={`${styles.secondaryButton} ${local.fileButton}`} aria-disabled={pending || undefined}>
        {pending ? t("flextvChannelSettings.uploading") : t("flextvChannelSettings.upload")}
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
  const { t } = useI18n();
  const [links, setLinks] = useState(current);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const changed = LINK_PLATFORMS.some((k) => links[k] !== current[k]);
  const save = () =>
    start(async () =>
      setError(settle(await attempt(() => saveFlextvChannelLinks(links), failed(t("flextvChannelSettings.unreachable"))), t("flextvChannelSettings.linksSaved")))
    );
  return (
    <section className={styles.card} aria-labelledby="ch-links">
      <h2 id="ch-links" className={styles.cardTitle}>
        {t("flextvChannelSettings.links")}
      </h2>
      <p className={styles.help}>{t("flextvChannelSettings.linksHelp")}</p>
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
          {t("studioSettings.save")}
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
