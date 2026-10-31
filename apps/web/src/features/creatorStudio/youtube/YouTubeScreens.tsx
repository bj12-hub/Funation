"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { formatCompact, formatKst, formatNumber, kstIsoString } from "@/lib/format";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { MessageKey } from "@/lib/i18n/translate";
import { connectYouTube, disconnectYouTube, syncYouTubeVideos, updateVideo } from "@/services/creator/youtube";
import type { ManagedVideo, VideoFilter, YouTubeIntegration, YouTubeResult } from "@/services/creator/youtubeTypes";
import type { PlatformErrorCode } from "@/services/platforms/platformTypes";
import styles from "../crew/crew.module.css";
import local from "./youtube.module.css";

type Note = { tone: "ok" | "error"; text: string } | null;
type T = ReturnType<typeof useI18n>["t"];

/** PLATFORM_ERROR_LABEL in the viewer's language (2026-11-01). */
const PLATFORM_ERROR_KEYS: Record<PlatformErrorCode, MessageKey> = {
  TIMEOUT: "studioYoutube.errorTimeout",
  NOT_FOUND: "studioYoutube.errorNotFound",
  UNAUTHORIZED: "studioYoutube.errorUnauthorized",
  UNSUPPORTED: "studioYoutube.errorUnsupported",
  UNAVAILABLE: "studioYoutube.errorUnavailable"
};

export const duration = (sec: number) => {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = String(sec % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
};
const stamp = (iso: string | null) => (iso ? formatKst(iso, { dateStyle: "medium", timeStyle: "short" }) : "—");

function useRunner() {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [note, setNote] = useState<Note>(null);
  const [pending, startTransition] = useTransition();
  const run = (action: () => Promise<YouTubeResult>, ok: (r: Extract<YouTubeResult, { status: "OK" }>) => string, after?: () => void) => {
    setNote(null);
    startTransition(async () => {
      try {
        const res = await action();
        if (res.status === "OK") {
          setNote({ tone: "ok", text: ok(res) });
          after?.();
        } else
          setNote({
            tone: "error",
            text: res.status === "INVALID" ? res.message : res.status === "PLATFORM_ERROR" ? t(PLATFORM_ERROR_KEYS[res.code]) : t("studioYoutube.needLogin")
          });
        router.refresh();
      } catch {
        setNote({ tone: "error", text: t("studioYoutube.failed") });
      }
    });
  };
  return { note, pending, run, t, locale };
}

function NoteLine({ note }: { note: Note }) {
  if (!note) return null;
  return (
    <p className={note.tone === "error" ? styles.error : styles.ok} role={note.tone === "error" ? "alert" : "status"}>
      {note.text}
    </p>
  );
}

/**
 * 유튜브 연동 — code-first (no Figma frame). Route `/creator/youtube`.
 * Mock connects by channel handle; the real flow is Google OAuth (TBD) and never asks for a password here.
 */
export function YouTubeConnectScreen({ integration }: { integration: YouTubeIntegration }) {
  const [handle, setHandle] = useState("");
  const { note, pending, run, t, locale } = useRunner();
  const requestId = useRef<string | null>(null);
  const ch = integration.channel;

  const connect = () => {
    requestId.current ??= crypto.randomUUID();
    run(() => connectYouTube({ handle, requestId: requestId.current }), (r) => t("studioYoutube.connected", { count: r.added ?? 0 }), () => {
      requestId.current = null;
      setHandle("");
    });
  };

  return (
    <div className={styles.content}>
      <header className={styles.header}>
        <h1 className={styles.title}>{t("studioYoutube.title")}</h1>
        <p className={styles.subtitle}>{t("studioYoutube.subtitle")}</p>
      </header>

      <section className={styles.card} aria-labelledby="yt-status">
        <div className={styles.cardHead}>
          <h2 className={styles.cardTitle} id="yt-status">
            {t("studioYoutube.status")}
          </h2>
          <span className={integration.status === "CONNECTED" ? styles.chip : styles.chipOff}>
            {integration.status === "CONNECTED" ? t("studioYoutube.statusConnected") : integration.status === "ERROR" ? t("studioYoutube.statusError") : t("studioYoutube.statusOff")}
          </span>
        </div>
        {ch ? (
          <>
            <dl className={local.facts}>
              <div>
                <dt>{t("studioYoutube.channel")}</dt>
                <dd>
                  {ch.title} <span className={styles.muted}>{ch.handle}</span>
                </dd>
              </div>
              <div>
                <dt>{t("studioYoutube.subscribers")}</dt>
                <dd>{t("studioYoutube.subscriberCount", { count: formatCompact(ch.subscriberCount, locale) })}</dd>
              </div>
              <div>
                <dt>{t("studioYoutube.connectedAt")}</dt>
                <dd>{stamp(integration.connectedAt)}</dd>
              </div>
              <div>
                <dt>{t("studioYoutube.lastSync")}</dt>
                <dd>{stamp(integration.lastSyncedAt)}</dd>
              </div>
              <div>
                <dt>{t("studioYoutube.videos")}</dt>
                <dd>{t("studioYoutube.videoCount", { count: formatNumber(integration.videoCount) })}</dd>
              </div>
            </dl>
            {integration.lastError && (
              <p className={styles.error} role="alert">
                {t("studioYoutube.lastSyncFailed", { error: t(PLATFORM_ERROR_KEYS[integration.lastError]) })}
              </p>
            )}
            <div className={styles.addRow}>
              <button type="button" className={styles.primary} disabled={pending} onClick={() => run(syncYouTubeVideos, (r) => syncNote(r, t))}>
                {pending ? t("studioYoutube.working") : t("studioYoutube.syncNow")}
              </button>
              <Link href="/creator/videos" className={styles.ghost}>
                {t("studioYoutube.manageVideos")}
              </Link>
              <button
                type="button"
                className={styles.danger}
                disabled={pending}
                onClick={() => window.confirm(t("studioYoutube.disconnectConfirm")) && run(disconnectYouTube, () => t("studioYoutube.disconnected"))}
              >
                {t("studioYoutube.disconnect")}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className={styles.addRow}>
              <input className={styles.input} aria-label={t("studioYoutube.handleAria")} placeholder="@mychannel" value={handle} onChange={(e) => setHandle(e.target.value)} />
              <button type="button" className={styles.primary} disabled={pending || !handle.trim()} onClick={connect}>
                {pending ? t("studioYoutube.connecting") : t("studioYoutube.connect")}
              </button>
            </div>
            <p className={styles.note}>{t("studioYoutube.mockNote")}</p>
          </>
        )}
      </section>
      <NoteLine note={note} />
    </div>
  );
}

const FILTERS: { key: VideoFilter; label: MessageKey }[] = [
  { key: "ALL", label: "studioYoutube.filterAll" },
  { key: "VOD", label: "studioYoutube.filterVod" },
  { key: "SHORTS", label: "studioYoutube.filterShorts" },
  { key: "HIDDEN", label: "studioYoutube.filterHidden" }
];

/** Sync result line: new videos, and the ones YouTube no longer shows (deleted or private — 2026-10-08 결정). */
const syncNote = (r: Extract<YouTubeResult, { status: "OK" }>, t: T) =>
  [r.added ? t("studioYoutube.syncAdded", { count: r.added }) : t("studioYoutube.syncNone"), r.missing ? t("studioYoutube.syncMissing", { count: r.missing }) : ""]
    .filter(Boolean)
    .join(" ");

/** 영상 목록 — code-first. Route `/creator/videos`. Choose what the channel's 영상 탭 shows and pin up to 3. */
export function VideoListScreen({ integration, videos }: { integration: YouTubeIntegration; videos: ManagedVideo[] }) {
  const [filter, setFilter] = useState<VideoFilter>("ALL");
  const { note, pending, run, t, locale } = useRunner();
  const shown = videos.filter((v) => (filter === "ALL" ? true : filter === "HIDDEN" ? !v.visible : v.kind === filter));

  if (!integration.channel) {
    return (
      <div className={styles.content}>
        <header className={styles.header}>
          <h1 className={styles.title}>{t("studioYoutube.videosTitle")}</h1>
        </header>
        <p className={styles.empty}>
          {t("studioYoutube.notConnectedBefore")}
          <Link href="/creator/youtube">{t("studioYoutube.title")}</Link>
          {t("studioYoutube.notConnectedAfter")}
        </p>
      </div>
    );
  }

  return (
    <div className={styles.content}>
      <header className={styles.header}>
        <h1 className={styles.title}>{t("studioYoutube.videosTitle")}</h1>
        <p className={styles.subtitle}>{t("studioYoutube.videosSubtitle", { channel: integration.channel.title })}</p>
        <p className={styles.note}>
          {t("studioYoutube.lastSyncAt", { time: stamp(integration.lastSyncedAt) })} · <Link href="/creator/youtube">{t("studioYoutube.title")}</Link>
        </p>
      </header>

      <section className={styles.card} aria-labelledby="vl-list">
        <div className={styles.cardHead}>
          <h2 className={styles.cardTitle} id="vl-list">
            {t("studioYoutube.listTitle", { count: shown.length })}
          </h2>
          <div className={styles.tabs} role="tablist" aria-label={t("studioYoutube.filterAria")}>
            {FILTERS.map((f) => (
              <button key={f.key} type="button" role="tab" aria-selected={filter === f.key} aria-current={filter === f.key ? "page" : undefined} className={styles.tab} onClick={() => setFilter(f.key)}>
                {t(f.label)}
              </button>
            ))}
          </div>
        </div>
        {shown.length === 0 ? (
          <p className={styles.empty}>{t("studioYoutube.listEmpty")}</p>
        ) : (
          <ul className={styles.list}>
            {shown.map((v) => (
              <li key={v.externalId} className={styles.row} data-inactive={v.visible ? undefined : ""}>
                <span className={local.thumb} data-kind={v.kind} aria-hidden="true">
                  {v.kind === "SHORTS" ? "▮" : "▶"}
                  <span className={local.len}>{duration(v.durationSec)}</span>
                </span>
                <div className={styles.rowMain}>
                  <span className={styles.rowTitle}>
                    {v.pinned && "📌 "}
                    {v.title}
                    {v.missing && (
                      <>
                        {" "}
                        <span className={styles.chipOff}>{t("studioYoutube.missing")}</span>
                      </>
                    )}
                  </span>
                  <span className={styles.muted}>
                    {v.kind === "SHORTS" ? t("studioYoutube.filterShorts") : t("studioYoutube.filterVod")} · {t("studioYoutube.views", { count: formatCompact(v.viewCount, locale) })} ·{" "}
                    {kstIsoString(v.publishedAt).slice(0, 10).replace(/-/g, ".")}
                  </span>
                </div>
                <div className={styles.rowActions}>
                  <button type="button" className={styles.ghost} disabled={pending || !v.visible || (v.missing && !v.pinned)} onClick={() => run(() => updateVideo({ externalId: v.externalId, pinned: !v.pinned }), () => (v.pinned ? t("studioYoutube.unpinned") : t("studioYoutube.pinned")))}>
                    {v.pinned ? t("studioYoutube.unpin") : t("studioYoutube.pin")}
                  </button>
                  <button type="button" className={styles.ghost} disabled={pending} onClick={() => run(() => updateVideo({ externalId: v.externalId, visible: !v.visible }), () => (v.visible ? t("studioYoutube.hidden") : t("studioYoutube.shown")))}>
                    {v.visible ? t("studioYoutube.hide") : t("studioYoutube.show")}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      <NoteLine note={note} />
    </div>
  );
}
