"use client";

import { OverlayLookPicker } from "@/features/overlayTheme/OverlayLookPicker";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { formatNumber } from "@/lib/format";
import { addTestVideo, controlVideo, saveVideoSettings } from "@/services/creator/media";
import { videoThumbUrl } from "@/services/creator/videoThumb";
import { MEDIA_LIMITS, type MediaResult, type VideoQueueView, type VideoRequest, type VideoSettings } from "@/services/creator/mediaTypes";
import type { OverlayTarget } from "@/services/creator/alertTypes";
import styles from "../../crew/crew.module.css";
import { OverlayOffNotice } from "../../remote/OverlayOffNotice";
import { CopyButton } from "../../settings/SettingsCards";
import local from "./media.module.css";

const clock = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
const STATUS_LABEL = { DONE: "재생 완료", SKIPPED: "건너뜀" } as const;

/**
 * 영상 후원 위젯 — code-first (no Figma frame). Route `/creator/widgets/video`.
 * 영상 후원 requests wait in a server queue; the OBS video overlay plays whatever the server says is on.
 */
export function VideoScreen({ view, overlayPath, switches }: { view: VideoQueueView; overlayPath: string; switches: Record<OverlayTarget, boolean> }) {
  const router = useRouter();
  const [settings, setSettings] = useState<VideoSettings>(view.settings);
  const [test, setTest] = useState({ url: "", startSec: 0, endSec: 30 });
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
        } else setNote({ tone: "error", text: res.status === "INVALID" ? res.message : "로그인이 필요합니다." });
      } catch {
        setNote({ tone: "error", text: "처리하지 못했어요. 잠시 후 다시 시도해 주세요." });
      }
    });
  };
  const control = (id: string, action: "PLAY" | "SKIP" | "REQUEUE", okText: string) => run(() => controlVideo({ id, action }), okText);
  const sendTest = () => {
    requestId.current ??= crypto.randomUUID();
    run(() => addTestVideo({ ...test, requestId: requestId.current }), "테스트 영상을 대기열에 넣었어요.", () => (requestId.current = null));
  };

  const p = view.playing;
  const left = p && now !== null ? Math.max(0, Math.round((new Date(p.endsAt).getTime() - now) / 1000)) : null;

  return (
    <div className={styles.content}>
      <header className={styles.header}>
        <h1 className={styles.title}>영상 후원</h1>
        <p className={styles.subtitle}>시청자가 보낸 영상 후원 요청을 대기열에서 재생하거나 건너뛰어요. 재생 시간과 자동 재생은 채널에서 정해요.</p>
        <p className={styles.note}>
          <Link href="/creator/widgets">← 위젯</Link>
        </p>
      </header>
      <OverlayOffNotice targets={["video"]} switches={switches} />

      <section className={styles.card} aria-labelledby="vid-overlay">
        <div className={styles.cardHead}>
          <h2 className={styles.cardTitle} id="vid-overlay">
            📹 영상 오버레이
          </h2>
          <CopyButton value={`${origin}${overlayPath}`} label="오버레이 URL 복사" className={styles.ghost} />
        </div>
        <p className={styles.note}>OBS 브라우저 소스 권장 크기 1280 × 720. 소리를 내려면 OBS에서 &ldquo;브라우저 소스 오디오 제어&rdquo;를 켜 주세요. 주소에는 연동 키가 들어 있으니 공유하지 마세요.</p>
        <OverlayLookPicker target="video" />
      </section>

      <section className={styles.card} aria-labelledby="vid-now">
        <div className={styles.cardHead}>
          <h2 className={styles.cardTitle} id="vid-now">
            ▶ 재생 중
          </h2>
          {p && (
            <button type="button" className={styles.ghost} disabled={pending} onClick={() => control(p.id, "SKIP", "건너뛰었어요.")}>
              건너뛰기
            </button>
          )}
        </div>
        {p ? (
          <div className={local.now}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className={local.videoThumb} src={videoThumbUrl(p.videoId)} alt="" />
            <div className={styles.rowMain}>
              <span className={styles.rowTitle}>youtu.be/{p.videoId}</span>
              <span className={styles.muted}>
                {p.kind === "TEST" ? "테스트 요청" : `${p.donor} · ${formatNumber(p.fnAmount)} FN`} · 구간 {clock(p.startSec)}–{clock(p.endSec)}
              </span>
              {left !== null && <span className={styles.muted}> · 남은 시간 {clock(left)}</span>}
            </div>
          </div>
        ) : (
          <p className={styles.empty}>재생 중인 영상이 없어요.</p>
        )}
      </section>

      <section className={styles.card} aria-labelledby="vid-queue">
        <div className={styles.cardHead}>
          <h2 className={styles.cardTitle} id="vid-queue">
            ⏳ 대기열 {view.waiting.length}
          </h2>
        </div>
        {view.waiting.length === 0 ? (
          <p className={styles.empty}>대기 중인 영상 후원이 없어요.</p>
        ) : (
          <ul className={styles.list}>
            {view.waiting.map((v) => (
              <VideoRow key={v.id} v={v}>
                <button type="button" className={styles.ghost} disabled={pending} onClick={() => control(v.id, "PLAY", "재생을 시작했어요.")}>
                  지금 재생
                </button>
                <button type="button" className={styles.danger} disabled={pending} onClick={() => control(v.id, "SKIP", "건너뛰었어요.")}>
                  건너뛰기
                </button>
              </VideoRow>
            ))}
          </ul>
        )}
      </section>

      <section className={styles.card} aria-labelledby="vid-settings">
        <div className={styles.cardHead}>
          <h2 className={styles.cardTitle} id="vid-settings">
            ⚙️ 설정
          </h2>
          <label className={styles.checkRow}>
            <input type="checkbox" checked={settings.autoPlay} onChange={(e) => setSettings({ ...settings, autoPlay: e.target.checked })} />
            자동 재생
          </label>
        </div>
        <div className={styles.addRow}>
          <span className={styles.muted}>최대 재생</span>
          <input
            className={styles.inputSmall}
            type="number"
            aria-label="최대 재생 시간(초)"
            min={MEDIA_LIMITS.maxSecMin}
            max={MEDIA_LIMITS.maxSecMax}
            value={settings.maxSec}
            onChange={(e) => setSettings({ ...settings, maxSec: Math.floor(Number(e.target.value) || 0) })}
          />
          <span className={styles.muted}>초 · 볼륨</span>
          <input
            className={styles.inputSmall}
            type="number"
            aria-label="볼륨"
            min={0}
            max={100}
            value={settings.volume}
            onChange={(e) => setSettings({ ...settings, volume: Math.floor(Number(e.target.value) || 0) })}
          />
          <button type="button" className={styles.primary} disabled={pending} onClick={() => run(() => saveVideoSettings(settings), "설정을 저장했어요.")}>
            저장
          </button>
        </div>
        <p className={styles.note}>자동 재생을 끄면 요청은 대기열에 쌓이고, &ldquo;지금 재생&rdquo;을 눌러야 재생돼요. 요청 구간이 최대 재생 시간보다 길면 거기서 끊어요.</p>
      </section>

      <section className={styles.card} aria-labelledby="vid-test">
        <div className={styles.cardHead}>
          <h2 className={styles.cardTitle} id="vid-test">
            🧪 테스트 영상
          </h2>
        </div>
        <div className={styles.addRow}>
          <input className={styles.input} aria-label="유튜브 주소" placeholder="https://youtu.be/…" value={test.url} onChange={(e) => setTest({ ...test, url: e.target.value })} />
          <input className={styles.inputSmall} type="number" min={0} aria-label="시작(초)" value={test.startSec} onChange={(e) => setTest({ ...test, startSec: Math.floor(Number(e.target.value) || 0) })} />
          <span className={styles.muted}>~</span>
          <input className={styles.inputSmall} type="number" min={1} aria-label="끝(초)" value={test.endSec} onChange={(e) => setTest({ ...test, endSec: Math.floor(Number(e.target.value) || 0) })} />
          <span className={styles.muted}>초</span>
          <button type="button" className={styles.primary} disabled={pending || !test.url.trim()} onClick={sendTest}>
            대기열에 넣기
          </button>
        </div>
        <p className={styles.note}>FN이 이동하지 않는 테스트 요청이에요.</p>
      </section>

      <section className={styles.card} aria-labelledby="vid-history">
        <div className={styles.cardHead}>
          <h2 className={styles.cardTitle} id="vid-history">
            🕘 지난 요청
          </h2>
        </div>
        {view.history.length === 0 ? (
          <p className={styles.empty}>아직 재생한 영상이 없어요.</p>
        ) : (
          <ul className={styles.list}>
            {view.history.map((v) => (
              <VideoRow key={v.id} v={v} status={STATUS_LABEL[v.status as keyof typeof STATUS_LABEL]}>
                <button type="button" className={styles.ghost} disabled={pending} onClick={() => control(v.id, "REQUEUE", "다시 대기열에 넣었어요.")}>
                  다시 대기열로
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
  return (
    <li className={styles.row}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className={local.rowThumb} src={videoThumbUrl(v.videoId, "default")} alt="" />
      <div className={styles.rowMain}>
        <span className={styles.rowTitle}>youtu.be/{v.videoId}</span>
        <span className={styles.muted}>
          {v.kind === "TEST" ? "테스트 요청" : `${v.donor} · ${formatNumber(v.fnAmount)} FN`} · {clock(v.startSec)}–{clock(v.endSec)}
          {status ? ` · ${status}` : ""}
        </span>
      </div>
      <div className={styles.rowActions}>{children}</div>
    </li>
  );
}
