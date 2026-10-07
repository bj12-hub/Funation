"use server";

import { USE_MOCK } from "@/lib/mock";
import { getCreatorSession } from "@/lib/session";
import { sameSecret } from "@/lib/secret";
import { parseYouTubeId } from "@/services/donations/donationTypes";
import { overlaySignal } from "./alertCore";
import { addDrawing, advanceVideos, currentDrawing, enqueueVideo, mockMedia, playingEndsAt, playingVideo, playSeconds, showDrawing, startVideo } from "./mediaCore";
import { mockCreator } from "./mockCreatorStore";
import { MEDIA_LIMITS, type DrawingView, type MediaResult, type OverlayDrawing, type OverlayVideo, type VideoQueueView } from "./mediaTypes";

/**
 * 영상 후원 · 그림후원 위젯 Server Actions — code-first. Routes `/creator/widgets/video`,
 * `/creator/widgets/drawing`, overlays `/overlay/video/[key]`, `/overlay/drawing/[key]`.
 * Creator actions need the creator role; overlays need the integration key.
 */

const assertMock = () => {
  if (!USE_MOCK) throw new Error("Media widget API is not connected yet.");
};
const unauthorized = { status: "UNAUTHORIZED" } as const;
const invalid = (message: string) => ({ status: "INVALID", message }) as const;
const ok = { status: "OK" } as const;
const obj = (input: unknown) => (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
const intIn = (v: unknown, min: number, max: number): v is number => Number.isInteger(v) && (v as number) >= min && (v as number) <= max;
const requestIdOk = (v: unknown): v is string => typeof v === "string" && /^[A-Za-z0-9-]{16,64}$/.test(v);

// ── 영상 ─────────────────────────────────────────────────────────────────────

export async function getVideoQueue(): Promise<VideoQueueView | null> {
  assertMock();
  if (!(await getCreatorSession())) return null;
  advanceVideos();
  const playing = playingVideo();
  return structuredClone({
    settings: mockMedia.videoSettings,
    playing: playing ? { ...playing, endsAt: playingEndsAt(playing) } : null,
    waiting: mockMedia.videos.filter((v) => v.status === "WAITING"),
    history: mockMedia.videos.filter((v) => v.status === "DONE" || v.status === "SKIPPED").reverse()
  });
}

export async function saveVideoSettings(input: unknown): Promise<MediaResult> {
  assertMock();
  if (!(await getCreatorSession())) return unauthorized;
  const v = obj(input);
  if (typeof v.autoPlay !== "boolean") return invalid("자동 재생 여부를 확인해 주세요.");
  if (!intIn(v.maxSec, MEDIA_LIMITS.maxSecMin, MEDIA_LIMITS.maxSecMax)) return invalid(`최대 재생 시간은 ${MEDIA_LIMITS.maxSecMin}~${MEDIA_LIMITS.maxSecMax}초예요.`);
  if (!intIn(v.volume, 0, 100)) return invalid("볼륨은 0~100이에요.");
  mockMedia.videoSettings = { autoPlay: v.autoPlay, maxSec: v.maxSec, volume: v.volume };
  advanceVideos();
  return ok;
}

/** 테스트 영상: queues a free request so the creator can try the overlay (no FN moves). */
export async function addTestVideo(input: unknown): Promise<MediaResult> {
  assertMock();
  if (!(await getCreatorSession())) return unauthorized;
  const v = obj(input);
  if (!requestIdOk(v.requestId)) return invalid("잘못된 요청입니다.");
  if (mockMedia.requests[v.requestId]) return ok;
  const videoId = typeof v.url === "string" ? parseYouTubeId(v.url) : null;
  if (!videoId) return invalid("유튜브 영상 주소를 입력해 주세요.");
  if (!intIn(v.startSec, 0, MEDIA_LIMITS.rangeSecMax) || !intIn(v.endSec, 1, MEDIA_LIMITS.rangeSecMax) || v.endSec <= v.startSec) return invalid("재생 구간을 확인해 주세요.");
  mockMedia.requests[v.requestId] = true;
  enqueueVideo({ kind: "TEST", donor: "테스트", fnAmount: 0, videoId, startSec: v.startSec, endSec: v.endSec });
  return ok;
}

/** 재생 / 건너뛰기 / 정지 / 다시 대기열로 — acts on one request id. */
export async function controlVideo(input: unknown): Promise<MediaResult> {
  assertMock();
  if (!(await getCreatorSession())) return unauthorized;
  const v = obj(input);
  advanceVideos();
  const item = mockMedia.videos.find((x) => x.id === v.id);
  if (!item) return invalid("요청을 찾을 수 없어요.");
  switch (v.action) {
    case "PLAY":
      if (item.status !== "WAITING") return invalid("대기 중인 요청만 재생할 수 있어요.");
      startVideo(item.id);
      return ok;
    case "SKIP":
      if (item.status !== "WAITING" && item.status !== "PLAYING") return invalid("이미 끝난 요청이에요.");
      if (item.status === "PLAYING") mockMedia.playingSince = null;
      item.status = "SKIPPED";
      advanceVideos();
      return ok;
    case "REQUEUE":
      if (item.status !== "DONE" && item.status !== "SKIPPED") return invalid("끝난 요청만 다시 대기열에 넣을 수 있어요.");
      mockMedia.videos = [...mockMedia.videos.filter((x) => x.id !== item.id), { ...item, status: "WAITING" }];
      advanceVideos();
      return ok;
    default:
      return invalid("알 수 없는 동작이에요.");
  }
}

/** OBS overlay read — no login; the integration key is the secret. */
export async function getOverlayVideo(key: unknown): Promise<OverlayVideo | "FORBIDDEN"> {
  assertMock();
  if (!sameSecret(key, mockCreator.integrationKey)) return "FORBIDDEN";
  advanceVideos();
  const p = playingVideo();
  return {
    playing: p ? { id: p.id, videoId: p.videoId, startSec: p.startSec, endSec: p.startSec + playSeconds(p), endsAt: playingEndsAt(p) } : null,
    volume: mockMedia.videoSettings.volume,
    ...overlaySignal("video")
  };
}

// ── 그림후원 ─────────────────────────────────────────────────────────────────

export async function getDrawings(): Promise<DrawingView | null> {
  assertMock();
  if (!(await getCreatorSession())) return null;
  const cur = currentDrawing();
  return structuredClone({ settings: mockMedia.drawingSettings, showing: cur ? { id: cur.drawing.id, until: cur.until } : null, drawings: mockMedia.drawings });
}

export async function saveDrawingSettings(input: unknown): Promise<MediaResult> {
  assertMock();
  if (!(await getCreatorSession())) return unauthorized;
  const v = obj(input);
  if (!intIn(v.displaySec, MEDIA_LIMITS.displaySecMin, MEDIA_LIMITS.displaySecMax)) return invalid(`전시 시간은 ${MEDIA_LIMITS.displaySecMin}~${MEDIA_LIMITS.displaySecMax}초예요.`);
  mockMedia.drawingSettings = { displaySec: v.displaySec };
  return ok;
}

const TEST_COLORS = ["#8b5cf6", "#ec4899", "#3b82f6", "#f59e0b", "#10b981"];

/** A generated doodle (SVG) so the overlay can be tried without a paid 그림 후원. */
function testDoodle(seed: number) {
  const c = (i: number) => TEST_COLORS[(seed + i) % TEST_COLORS.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="360" viewBox="0 0 480 360"><rect width="480" height="360" fill="#ffffff"/><circle cx="${140 + (seed % 5) * 20}" cy="160" r="70" fill="${c(0)}"/><rect x="250" y="${120 + (seed % 3) * 20}" width="140" height="120" rx="20" fill="${c(1)}"/><path d="M60 300 Q 240 ${220 + (seed % 4) * 20} 420 300" stroke="${c(2)}" stroke-width="14" fill="none" stroke-linecap="round"/></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

export async function addTestDrawing(input: unknown): Promise<MediaResult> {
  assertMock();
  if (!(await getCreatorSession())) return unauthorized;
  const v = obj(input);
  if (!requestIdOk(v.requestId)) return invalid("잘못된 요청입니다.");
  if (mockMedia.requests[v.requestId]) return ok;
  mockMedia.requests[v.requestId] = true;
  const n = mockMedia.drawings.length;
  addDrawing({ kind: "TEST", donor: "테스트", title: `테스트 그림 ${n + 1}`, fnAmount: 0, image: testDoodle(n) });
  return ok;
}

/** 전시 (show on the overlay again) or 내리기 (hide now). */
export async function setDrawingShowing(input: unknown): Promise<MediaResult> {
  assertMock();
  if (!(await getCreatorSession())) return unauthorized;
  const v = obj(input);
  if (v.id === null) {
    mockMedia.showing = null;
    return ok;
  }
  return typeof v.id === "string" && showDrawing(v.id) ? ok : invalid("그림을 찾을 수 없어요.");
}

export async function deleteDrawing(id: unknown): Promise<MediaResult> {
  assertMock();
  if (!(await getCreatorSession())) return unauthorized;
  mockMedia.drawings = mockMedia.drawings.filter((d) => d.id !== id);
  if (mockMedia.showing?.id === id) mockMedia.showing = null;
  return ok;
}

export async function getOverlayDrawing(key: unknown): Promise<OverlayDrawing | "FORBIDDEN"> {
  assertMock();
  if (!sameSecret(key, mockCreator.integrationKey)) return "FORBIDDEN";
  const cur = currentDrawing();
  return {
    drawing: cur ? { id: cur.drawing.id, donor: cur.drawing.donor, title: cur.drawing.title, fnAmount: cur.drawing.fnAmount, image: cur.drawing.image, until: cur.until } : null,
    ...overlaySignal("drawing")
  };
}
