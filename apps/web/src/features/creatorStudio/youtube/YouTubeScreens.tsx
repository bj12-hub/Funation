"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { formatCompactKo, formatNumber } from "@/lib/format";
import { connectYouTube, disconnectYouTube, syncYouTubeVideos, updateVideo } from "@/services/creator/youtube";
import type { ManagedVideo, VideoFilter, YouTubeIntegration, YouTubeResult } from "@/services/creator/youtubeTypes";
import { PLATFORM_ERROR_LABEL } from "@/services/platforms/platformTypes";
import styles from "../crew/crew.module.css";
import local from "./youtube.module.css";

type Note = { tone: "ok" | "error"; text: string } | null;

export const duration = (sec: number) => {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = String(sec % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
};
const stamp = (iso: string | null) => (iso ? new Date(iso).toLocaleString("ko-KR", { dateStyle: "medium", timeStyle: "short" }) : "—");

function useRunner() {
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
            text: res.status === "INVALID" ? res.message : res.status === "PLATFORM_ERROR" ? PLATFORM_ERROR_LABEL[res.code] : "로그인이 필요합니다."
          });
        router.refresh();
      } catch {
        setNote({ tone: "error", text: "처리하지 못했어요. 잠시 후 다시 시도해 주세요." });
      }
    });
  };
  return { note, pending, run };
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
  const { note, pending, run } = useRunner();
  const requestId = useRef<string | null>(null);
  const ch = integration.channel;

  const connect = () => {
    requestId.current ??= crypto.randomUUID();
    run(() => connectYouTube({ handle, requestId: requestId.current }), (r) => `채널을 연결하고 영상 ${r.added ?? 0}개를 가져왔어요.`, () => {
      requestId.current = null;
      setHandle("");
    });
  };

  return (
    <div className={styles.content}>
      <header className={styles.header}>
        <h1 className={styles.title}>유튜브 연동</h1>
        <p className={styles.subtitle}>유튜브 채널을 연결하면 영상 목록을 가져와 채널의 영상 탭에 보여 줄 수 있어요.</p>
      </header>

      <section className={styles.card} aria-labelledby="yt-status">
        <div className={styles.cardHead}>
          <h2 className={styles.cardTitle} id="yt-status">
            ▶️ 연결 상태
          </h2>
          <span className={integration.status === "CONNECTED" ? styles.chip : styles.chipOff}>
            {integration.status === "CONNECTED" ? "연결됨" : integration.status === "ERROR" ? "오류" : "연결 안 됨"}
          </span>
        </div>
        {ch ? (
          <>
            <dl className={local.facts}>
              <div>
                <dt>채널</dt>
                <dd>
                  {ch.title} <span className={styles.muted}>{ch.handle}</span>
                </dd>
              </div>
              <div>
                <dt>구독자</dt>
                <dd>{formatCompactKo(ch.subscriberCount)}명</dd>
              </div>
              <div>
                <dt>연결일</dt>
                <dd>{stamp(integration.connectedAt)}</dd>
              </div>
              <div>
                <dt>마지막 동기화</dt>
                <dd>{stamp(integration.lastSyncedAt)}</dd>
              </div>
              <div>
                <dt>영상</dt>
                <dd>{formatNumber(integration.videoCount)}개</dd>
              </div>
            </dl>
            {integration.lastError && (
              <p className={styles.error} role="alert">
                마지막 동기화 실패: {PLATFORM_ERROR_LABEL[integration.lastError]} (이전 목록은 그대로 보여요)
              </p>
            )}
            <div className={styles.addRow}>
              <button type="button" className={styles.primary} disabled={pending} onClick={() => run(syncYouTubeVideos, (r) => (r.added ? `새 영상 ${r.added}개를 가져왔어요.` : "새 영상이 없어요."))}>
                {pending ? "처리 중…" : "지금 동기화"}
              </button>
              <Link href="/creator/videos" className={styles.ghost}>
                영상 목록 관리
              </Link>
              <button
                type="button"
                className={styles.danger}
                disabled={pending}
                onClick={() => window.confirm("유튜브 연결을 해제할까요? 가져온 영상 목록과 표시 설정이 지워져요.") && run(disconnectYouTube, () => "연결을 해제했어요.")}
              >
                연결 해제
              </button>
            </div>
          </>
        ) : (
          <>
            <div className={styles.addRow}>
              <input className={styles.input} aria-label="유튜브 채널 핸들" placeholder="@mychannel" value={handle} onChange={(e) => setHandle(e.target.value)} />
              <button type="button" className={styles.primary} disabled={pending || !handle.trim()} onClick={connect}>
                {pending ? "연결 중…" : "채널 연결"}
              </button>
            </div>
            <p className={styles.note}>
              개발용 mock 연결이에요: 핸들만 입력하면 연결돼요. 실제 서비스는 Google 로그인 동의 화면으로 연결해요 (OAuth · 권한 범위 TBD). 이 화면에서 비밀번호를 입력하지 마세요.
            </p>
          </>
        )}
      </section>
      <NoteLine note={note} />
    </div>
  );
}

const FILTERS: { key: VideoFilter; label: string }[] = [
  { key: "ALL", label: "전체" },
  { key: "VOD", label: "다시보기" },
  { key: "SHORTS", label: "쇼츠" },
  { key: "HIDDEN", label: "숨김" }
];

/** 영상 목록 — code-first. Route `/creator/videos`. Choose what the channel's 영상 탭 shows and pin up to 3. */
export function VideoListScreen({ integration, videos }: { integration: YouTubeIntegration; videos: ManagedVideo[] }) {
  const [filter, setFilter] = useState<VideoFilter>("ALL");
  const { note, pending, run } = useRunner();
  const shown = videos.filter((v) => (filter === "ALL" ? true : filter === "HIDDEN" ? !v.visible : v.kind === filter));

  if (!integration.channel) {
    return (
      <div className={styles.content}>
        <header className={styles.header}>
          <h1 className={styles.title}>영상 목록</h1>
        </header>
        <p className={styles.empty}>
          유튜브 채널이 연결되지 않았어요. <Link href="/creator/youtube">유튜브 연동</Link>에서 먼저 연결해 주세요.
        </p>
      </div>
    );
  }

  return (
    <div className={styles.content}>
      <header className={styles.header}>
        <h1 className={styles.title}>영상 목록</h1>
        <p className={styles.subtitle}>
          {integration.channel.title}에서 가져온 영상이에요. 채널 영상 탭에 보일 영상을 고르고, 3개까지 맨 위에 고정할 수 있어요.
        </p>
        <p className={styles.note}>
          마지막 동기화 {stamp(integration.lastSyncedAt)} · <Link href="/creator/youtube">유튜브 연동</Link>
        </p>
      </header>

      <section className={styles.card} aria-labelledby="vl-list">
        <div className={styles.cardHead}>
          <h2 className={styles.cardTitle} id="vl-list">
            🎞️ 영상 {shown.length}
          </h2>
          <div className={styles.tabs} role="tablist" aria-label="영상 필터">
            {FILTERS.map((f) => (
              <button key={f.key} type="button" role="tab" aria-selected={filter === f.key} aria-current={filter === f.key ? "page" : undefined} className={styles.tab} onClick={() => setFilter(f.key)}>
                {f.label}
              </button>
            ))}
          </div>
        </div>
        {shown.length === 0 ? (
          <p className={styles.empty}>해당하는 영상이 없어요.</p>
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
                  </span>
                  <span className={styles.muted}>
                    {v.kind === "SHORTS" ? "쇼츠" : "다시보기"} · 조회 {formatCompactKo(v.viewCount)} · {v.publishedAt.slice(0, 10).replace(/-/g, ".")}
                  </span>
                </div>
                <div className={styles.rowActions}>
                  <button type="button" className={styles.ghost} disabled={pending || !v.visible} onClick={() => run(() => updateVideo({ externalId: v.externalId, pinned: !v.pinned }), () => (v.pinned ? "고정을 풀었어요." : "맨 위에 고정했어요."))}>
                    {v.pinned ? "고정 해제" : "고정"}
                  </button>
                  <button type="button" className={styles.ghost} disabled={pending} onClick={() => run(() => updateVideo({ externalId: v.externalId, visible: !v.visible }), () => (v.visible ? "채널에서 숨겼어요." : "채널에 표시해요."))}>
                    {v.visible ? "숨기기" : "표시"}
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
