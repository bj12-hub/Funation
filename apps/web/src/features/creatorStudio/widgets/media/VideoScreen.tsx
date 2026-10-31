"use client";

import { OverlayLookPicker } from "@/features/overlayTheme/OverlayLookPicker";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { formatNumber } from "@/lib/format";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { MessageKey } from "@/lib/i18n/translate";
import { addTestVideo, controlVideo, saveVideoSettings } from "@/services/creator/media";
import { videoThumbUrl } from "@/services/creator/videoThumb";
import { MEDIA_LIMITS, type MediaResult, type VideoQueueView, type VideoRequest, type VideoSettings } from "@/services/creator/mediaTypes";
import type { OverlayTarget } from "@/services/creator/alertTypes";
import styles from "../../crew/crew.module.css";
import { OverlayOffNotice } from "../../remote/OverlayOffNotice";
import { CopyButton } from "../../settings/SettingsCards";
import local from "./media.module.css";

const clock = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
const STATUS_LABEL: Record<"DONE" | "SKIPPED", MessageKey> = { DONE: "studioToolsMedia.statusDone", SKIPPED: "studioToolsMedia.statusSkipped" };

/**
 * 영상 후원 위젯 — code-first (no Figma frame). Route `/creator/widgets/video`.
 * 영상 후원 requests wait in a server queue; the OBS video overlay plays whatever the server says is on.
 */
export function VideoScreen({ view, overlayPath, switches }: { view: VideoQueueView; overlayPath: string; switches: Record<OverlayTarget, boolean> }) {
  const router = useRouter();
  const { t } = useI18n();
  const [settings, setSettings] = useState<VideoSettings>(view.settings);
  const [test, setTest] = useState<{ url: string; startSec: number; endSec: number; mode: "VIDEO" | "AUDIO" }>({ url: "", startSec: 0, endSec: 30, mode: "VIDEO" });
  const [note, setNote] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const [origin, setOrigin] = useState("");
  const [now, setNow] = useState<number | null>(null);
  const requestId = useRef<string | null>(null);

  useEffect(() => {
    setOrigin(window.location.origin);
    setNow(Date.now());
    const tick = setInterval(() => setNow(Date.now()), 1000);
    const poll = setInterval(() => router.refresh(), 3000);
    return () => {
      clearInterval(tick);
      clearInterval(poll);
    };
  }, [router]);

  const run = (action: () => Promise<MediaResult>, okText: string, after?: () => void) => {
    setNote(null);
    startTransition(async () => {
      try {
        const res = await action();
        if (res.status === "OK") {
          setNote({ tone: "ok", text: okText });
          after?.();
          router.refresh();
        } else setNote({ tone: "error", text: res.status === "INVALID" ? res.message : t("studioTools.loginRequired") });
      } catch {
        setNote({ tone: "error", text: t("studioTools.processFailed") });
      }
    });
  };
  const control = (id: string, action: "PLAY" | "SKIP" | "REQUEUE", okText: string) => run(() => controlVideo({ id, action }), okText);
  const sendTest = () => {
    requestId.current ??= crypto.randomUUID();
    run(
      () => addTestVideo({ ...test, requestId: requestId.current }),
      test.mode === "AUDIO" ? t("studioToolsMedia.testAudioQueued") : t("studioToolsMedia.testVideoQueued"),
      () => (requestId.current = null)
    );
  };

  const p = view.playing;
  const left = p && now !== null ? Math.max(0, Math.round((new Date(p.endsAt).getTime() - now) / 1000)) : null;

  return (
    <div className={styles.content}>
      <header className={styles.header}>
        <h1 className={styles.title}>{t("studioToolsMedia.videoTitle")}</h1>
        <p className={styles.subtitle}>{t("studioToolsMedia.videoSubtitle")}</p>
        <p className={styles.note}>
          <Link href="/creator/widgets">{t("studioTools.backWidgets")}</Link>
        </p>
      </header>
      <OverlayOffNotice targets={["video"]} switches={switches} />

      <section className={styles.card} aria-labelledby="vid-overlay">
        <div className={styles.cardHead}>
          <h2 className={styles.cardTitle} id="vid-overlay">
            {t("studioToolsMedia.videoOverlayTitle")}
          </h2>
          <CopyButton value={`${origin}${overlayPath}`} label={t("studioTools.copyOverlayUrl")} className={styles.ghost} />
        </div>
        <p className={styles.note}>{t("studioToolsMedia.videoOverlayNote")}</p>
        <OverlayLookPicker target="video" />
      </section>

      <section className={styles.card} aria-labelledby="vid-now">
        <div className={styles.cardHead}>
          <h2 className={styles.cardTitle} id="vid-now">
            {t("studioToolsMedia.nowTitle")}
          </h2>
          {p && (
            <button type="button" className={styles.ghost} disabled={pending} onClick={() => control(p.id, "SKIP", t("studioToolsMedia.skipped"))}>
              {t("studioToolsMedia.skip")}
            </button>
          )}
        </div>
        {p ? (
          <div className={local.now}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className={local.videoThumb} src={videoThumbUrl(p.videoId)} alt="" />
            <div className={styles.rowMain}>
              <span className={styles.rowTitle}>
                {p.mode === "AUDIO" && <span className={local.audioTag}>{t("studioToolsMedia.audioTag")}</span>}youtu.be/{p.videoId}
              </span>
              <span className={styles.muted}>
                {p.kind === "TEST" ? t("studioToolsMedia.testRequest") : `${p.donor} · ${formatNumber(p.fnAmount)} FN`} ·{" "}
                {t("studioToolsMedia.segment", { from: clock(p.startSec), to: clock(p.endSec) })}
              </span>
              {left !== null && <span className={styles.muted}>{t("studioToolsMedia.timeLeft", { time: clock(left) })}</span>}
            </div>
          </div>
        ) : (
          <p className={styles.empty}>{t("studioToolsMedia.nowEmpty")}</p>
        )}
      </section>

      <section className={styles.card} aria-labelledby="vid-queue">
        <div className={styles.cardHead}>
          <h2 className={styles.cardTitle} id="vid-queue">
            {t("studioToolsMedia.queueTitle", { count: view.waiting.length })}
          </h2>
        </div>
        {view.waiting.length === 0 ? (
          <p className={styles.empty}>{t("studioToolsMedia.queueEmpty")}</p>
        ) : (
          <ul className={styles.list}>
            {view.waiting.map((v) => (
              <VideoRow key={v.id} v={v}>
                <button type="button" className={styles.ghost} disabled={pending} onClick={() => control(v.id, "PLAY", t("studioToolsMedia.playStarted"))}>
                  {t("studioToolsMedia.playNow")}
                </button>
                <button type="button" className={styles.danger} disabled={pending} onClick={() => control(v.id, "SKIP", t("studioToolsMedia.skipped"))}>
                  {t("studioToolsMedia.skip")}
                </button>
              </VideoRow>
            ))}
          </ul>
        )}
      </section>

      <section className={styles.card} aria-labelledby="vid-settings">
        <div className={styles.cardHead}>
          <h2 className={styles.cardTitle} id="vid-settings">
            {t("studioToolsMedia.settingsTitle")}
          </h2>
          <label className={styles.checkRow}>
            <input type="checkbox" checked={settings.autoPlay} onChange={(e) => setSettings({ ...settings, autoPlay: e.target.checked })} />
            {t("studioToolsMedia.autoplay")}
          </label>
        </div>
        <div className={styles.addRow}>
          <span className={styles.muted}>{t("studioToolsMedia.maxPlay")}</span>
          <input
            className={styles.inputSmall}
            type="number"
            aria-label={t("studioToolsMedia.maxPlayAria")}
            min={MEDIA_LIMITS.maxSecMin}
            max={MEDIA_LIMITS.maxSecMax}
            value={settings.maxSec}
            onChange={(e) => setSettings({ ...settings, maxSec: Math.floor(Number(e.target.value) || 0) })}
          />
          <span className={styles.muted}>{t("studioToolsMedia.secVolume")}</span>
          <input
            className={styles.inputSmall}
            type="number"
            aria-label={t("studioToolsMedia.volume")}
            min={0}
            max={100}
            value={settings.volume}
            onChange={(e) => setSettings({ ...settings, volume: Math.floor(Number(e.target.value) || 0) })}
          />
          <button type="button" className={styles.primary} disabled={pending} onClick={() => run(() => saveVideoSettings(settings), t("studioToolsMedia.settingsSaved"))}>
            {t("studioTools.save")}
          </button>
        </div>
        <p className={styles.note}>{t("studioToolsMedia.settingsNote")}</p>
      </section>

      <section className={styles.card} aria-labelledby="vid-test">
        <div className={styles.cardHead}>
          <h2 className={styles.cardTitle} id="vid-test">
            {t("studioToolsMedia.testTitle")}
          </h2>
        </div>
        <div className={styles.addRow}>
          <input className={styles.input} aria-label={t("studioToolsMedia.youtubeAria")} placeholder="https://youtu.be/…" value={test.url} onChange={(e) => setTest({ ...test, url: e.target.value })} />
          <input
            className={styles.inputSmall}
            type="number"
            min={0}
            aria-label={t("studioToolsMedia.startAria")}
            value={test.startSec}
            onChange={(e) => setTest({ ...test, startSec: Math.floor(Number(e.target.value) || 0) })}
          />
          <span className={styles.muted}>~</span>
          <input
            className={styles.inputSmall}
            type="number"
            min={1}
            aria-label={t("studioToolsMedia.endAria")}
            value={test.endSec}
            onChange={(e) => setTest({ ...test, endSec: Math.floor(Number(e.target.value) || 0) })}
          />
          <span className={styles.muted}>{t("studioTools.sec")}</span>
          <label className={styles.muted}>
            <input type="checkbox" checked={test.mode === "AUDIO"} onChange={(e) => setTest({ ...test, mode: e.target.checked ? "AUDIO" : "VIDEO" })} />
            {t("studioToolsMedia.asAudio")}
          </label>
          <button type="button" className={styles.primary} disabled={pending || !test.url.trim()} onClick={sendTest}>
            {t("studioToolsMedia.enqueue")}
          </button>
        </div>
        <p className={styles.note}>{t("studioToolsMedia.testNote")}</p>
      </section>

      <section className={styles.card} aria-labelledby="vid-history">
        <div className={styles.cardHead}>
          <h2 className={styles.cardTitle} id="vid-history">
            {t("studioToolsMedia.historyTitle")}
          </h2>
        </div>
        {view.history.length === 0 ? (
          <p className={styles.empty}>{t("studioToolsMedia.historyEmpty")}</p>
        ) : (
          <ul className={styles.list}>
            {view.history.map((v) => (
              <VideoRow key={v.id} v={v} status={v.status in STATUS_LABEL ? t(STATUS_LABEL[v.status as keyof typeof STATUS_LABEL]) : undefined}>
                <button type="button" className={styles.ghost} disabled={pending} onClick={() => control(v.id, "REQUEUE", t("studioToolsMedia.requeued"))}>
                  {t("studioToolsMedia.requeue")}
                </button>
              </VideoRow>
            ))}
          </ul>
        )}
      </section>

      {note && (
        <p className={note.tone === "error" ? styles.error : styles.ok} role={note.tone === "error" ? "alert" : "status"}>
          {note.text}
        </p>
      )}
    </div>
  );
}

function VideoRow({ v, status, children }: { v: VideoRequest; status?: string; children: React.ReactNode }) {
  const { t } = useI18n();
  return (
    <li className={styles.row}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className={local.rowThumb} src={videoThumbUrl(v.videoId, "default")} alt="" />
      <div className={styles.rowMain}>
        <span className={styles.rowTitle}>
          {v.mode === "AUDIO" && <span className={local.audioTag}>{t("studioToolsMedia.audioTag")}</span>}youtu.be/{v.videoId}
        </span>
        <span className={styles.muted}>
          {v.kind === "TEST" ? t("studioToolsMedia.testRequest") : `${v.donor} · ${formatNumber(v.fnAmount)} FN`} · {clock(v.startSec)}–{clock(v.endSec)}
          {status ? ` · ${status}` : ""}
        </span>
      </div>
      <div className={styles.rowActions}>{children}</div>
    </li>
  );
}
