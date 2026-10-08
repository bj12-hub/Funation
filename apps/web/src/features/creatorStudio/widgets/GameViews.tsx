"use client";

import type { CSSProperties } from "react";
import { OverlayThemeRoot, ov } from "@/features/overlayTheme/OverlayThemeRoot";
import { formatNumber } from "@/lib/format";
import type { GachaBoardView as GachaBoardData, GachaStage } from "@/services/donations/gachaTypes";
import { isBlankPrize, wheelGradient, type RouletteStage } from "@/services/donations/rouletteTypes";
import { readableInk, type ResolvedTheme } from "@/services/creator/overlayThemeTypes";
import { WALL_SIZE, type WallSticker, type WidgetQuest } from "@/services/creator/widgetOverlayTypes";
import type { ColorFont, QuestWidgetSettings, VoteSettings, WallpaperSettings } from "@/services/creator/widgetSettingsTypes";
import { rankItems, votePercent, type VoteBoard } from "@/services/votes/voteTypes";
import g from "./gameViews.module.css";

/**
 * 게임 · 이벤트 위젯 views (code-first, 2026-10-08 오버레이 테마) — 퀘스트 · 투표 · 룰렛 · 뽑기 · 뽑기 당첨 리스트 · 벽지.
 * Drawn by the OBS overlays and the settings previews. The theme draws cards and text colors; widget font settings keep
 * their typeface (and their colors where text sits straight on the stream: 퀘스트 심플한 · 벽지).
 */

const face = (f: { family: string }, size?: number): CSSProperties => ({ fontFamily: `"${f.family}", var(--ov-body-font)`, fontSize: size });
const colored = (f: ColorFont, size: number): CSSProperties => ({ ...face(f, size), color: f.color });
/** A widget's own color (뽑기 포인트 색상 · 투표 프리셋 색) as the accent inside its card. */
const accent = (hex: string): CSSProperties => ({ "--ov-accent": hex, "--ov-accent-ink": readableInk(hex) }) as CSSProperties;

// ── 퀘스트 ───────────────────────────────────────────────────────────────────

export function questTimeLeft(endsAt: string, now: number | null) {
  if (now === null) return "";
  const sec = Math.floor((new Date(endsAt).getTime() - now) / 1000);
  return sec <= 0 ? "시간 초과 · 결과 대기" : `남은시간 ${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;
}

/** 퀘스트: 화려한 = themed cards with a QUEST chip; 심플한 = text on the stream in the widget's font colors. */
export function QuestView({ settings: s, quests, theme, now }: { settings: QuestWidgetSettings; quests: WidgetQuest[]; theme: ResolvedTheme; now: number | null }) {
  if (!s.enabled || quests.length === 0) return null;
  const fancy = s.style === "FANCY";
  return (
    <OverlayThemeRoot theme={theme} as="ul" className={g.quests}>
      {quests.map((q) => (
        <li key={q.id} className={`${ov.enter} ${g.quest} ${fancy ? (theme.theme === "BOLD" ? ov.accentCard : ov.card) : ov.onStream}`} data-motion="POP" data-style={s.style}>
          {fancy && <span className={`${ov.chip} ${g.questChip}`}>QUEST</span>}
          <strong className={ov.label} style={fancy ? face(s.titleFont, 26) : colored(s.titleFont, 26)}>
            {q.title}
          </strong>
          <span className={g.questMeta}>
            <span className={fancy ? `${ov.chip} ${g.metaChip}` : undefined} style={fancy ? face(s.timeFont, 16) : colored(s.timeFont, 18)}>
              {questTimeLeft(q.endsAt, now)}
            </span>
            <span className={ov.display} style={fancy ? face(s.prizeFont, 22) : colored(s.prizeFont, 20)}>
              상금 {formatNumber(q.amount)} FN
            </span>
          </span>
        </li>
      ))}
    </OverlayThemeRoot>
  );
}

// ── 투표 ─────────────────────────────────────────────────────────────────────

const hms = (sec: number) => [Math.floor(sec / 3600), Math.floor((sec % 3600) / 60), sec % 60].map((n) => String(n).padStart(2, "0")).join(":");

/** 투표: items ranked by votes with a bar in the preset color (the vote's accent). */
export function VoteView({ settings: s, vote: v, theme, now }: { settings: VoteSettings; vote: VoteBoard | null; theme: ResolvedTheme; now: number | null }) {
  if (!s.enabled || !v) return null;
  const left = now === null ? null : Math.max(0, Math.floor((new Date(v.endsAt).getTime() - now) / 1000));
  const ended = v.ended || left === 0;
  return (
    <OverlayThemeRoot theme={theme} className={g.pad}>
      <div className={`${ov.card} ${g.vote}`} style={accent(v.color)}>
        <strong className={`${ov.label} ${g.voteTitle}`} style={face(s.titleFont, s.titleFont.size)}>
          <i className={g.dot} aria-hidden="true" />
          {v.name}
        </strong>
        <div className={`${ov.muted} ${g.voteInfo}`} style={face(s.infoFont, Math.round(s.infoFont.size * 0.8))}>
          <span>1인 1표 · 총 {formatNumber(v.total)}표</span>
          <span className={ended ? `${ov.chip} ${ov.chipAccent}` : ov.chip}>{ended ? "투표 종료" : left === null ? "진행 중" : `종료까지 ${hms(left)}`}</span>
        </div>
        <ol className={g.voteList}>
          {rankItems(v).map((it) => (
            <li key={it.index} className={g.voteRow} style={face(s.itemFont, Math.round(s.itemFont.size * 0.85))}>
              <span className={`${ov.track} ${g.voteTrack}`} aria-hidden="true">
                <span className={ov.fill} style={{ width: `${votePercent(it.count, v.total)}%` }} />
              </span>
              <span className={`${ov.display} ${g.voteRank}`}>{it.rank}</span>
              <span className={ov.label}>{it.label}</span>
              <span className={ov.display}>{formatNumber(it.count)}</span>
            </li>
          ))}
        </ol>
      </div>
    </OverlayThemeRoot>
  );
}

// ── 룰렛 ─────────────────────────────────────────────────────────────────────

const ROULETTE_STATUS = { SPINNING: "돌아가는 중", WAITING: "결과 공개 대기", RESULT: "결과" } as const;

/**
 * 룰렛 (펀페이 1009:199 SPINNING · 1009:181 RESULT): the wheel turns until the server reveals the result, which stays
 * for a few seconds; with 결과 자동 노출 off it stops (WAITING) until ✓ 결과 공개. Prizes are the creator's (no FN).
 */
export function RouletteView({ stage: s, theme }: { stage: RouletteStage | null; theme: ResolvedTheme }) {
  if (!s) return null;
  const count = s.limit > 0 ? `참여 ${s.nth} / ${s.limit}` : `오늘 ${s.nth}번째 참여`;
  const result = s.status === "RESULT" && s.result !== null;
  const blank = result && isBlankPrize(s.result!);
  return (
    <OverlayThemeRoot theme={theme} className={g.pad}>
      <div className={`${ov.enter} ${ov.card} ${g.game}`} data-motion="POP" data-status={s.status}>
        <div className={g.head}>
          <span className={`${ov.chip} ${ov.chipAccent}`}>룰렛</span>
          <span className={ov.chip}>{result ? (blank ? "꽝" : "당첨") : ROULETTE_STATUS[s.status]}</span>
        </div>
        {!result ? (
          <div className={g.rouletteBody}>
            <span className={g.wheelBox} aria-hidden="true">
              <span className={g.wheel} data-stopped={s.status === "WAITING" || undefined} style={{ background: wheelGradient(s.items) }} />
              <span className={g.pointer} />
            </span>
            <div className={g.rouletteText}>
              <span className={`${ov.muted} ${g.items}`}>{s.items.map((it) => it.name).join(" · ")}</span>
              <strong className={ov.label}>{s.status === "WAITING" ? "룰렛이 멈췄어요!" : "룰렛이 돌아가고 있어요!"}</strong>
              <span>
                {s.donor} · <b className={ov.display}>{formatNumber(s.amount)} FN</b>
              </span>
              <span className={`${ov.muted} ${g.meta}`}>
                {count} · {s.status === "WAITING" ? "결과 공개 대기" : "결과 계산 중"}
              </span>
            </div>
          </div>
        ) : (
          <div key="result" className={`${ov.enter} ${g.result}`} data-motion="ZOOM">
            <strong className={`${ov.display} ${g.prize} ${blank ? g.prizeBlank : ""}`}>{s.result}</strong>
            <span className={ov.label}>{blank ? `${s.donor} 님 아쉽게도 꽝!` : `${s.donor} 님 당첨!`}</span>
            <span className={`${ov.muted} ${g.meta}`}>
              {formatNumber(s.amount)} FN · {s.no}
            </span>
          </div>
        )}
      </div>
    </OverlayThemeRoot>
  );
}

// ── 뽑기 ─────────────────────────────────────────────────────────────────────

/**
 * 뽑기: the machine (캡슐 · 박스) turns for 기계 회전 시간, then the prize shows for 화면 노출 시간; the 크레딧 style lists
 * the latest prizes instead of a machine. The gacha's 포인트 색상 is the accent. Prizes are the creator's (no FN).
 */
export function GachaView({ stage: s, history, theme }: { stage: GachaStage | null; history: { donor: string; prize: string }[]; theme: ResolvedTheme }) {
  if (!s) return null;
  const spinning = s.status === "SPINNING" || s.prize === null;
  return (
    <OverlayThemeRoot theme={theme} className={g.pad}>
      <div className={`${ov.enter} ${ov.card} ${g.game} ${g.gacha}`} data-motion="POP" style={accent(s.pointColor)}>
        <div className={g.head}>
          <span className={`${ov.chip} ${ov.chipAccent}`}>{s.gachaName}</span>
          <span className={ov.chip}>{spinning ? "뽑는 중" : s.blank ? "꽝" : "당첨"}</span>
        </div>
        {s.style === "CREDIT" ? (
          <ol className={g.credit}>
            {history.map((h, i) => (
              <li key={i}>
                <b className={ov.label}>{h.donor}</b> · {h.prize}
              </li>
            ))}
          </ol>
        ) : (
          <span className={g.machine} data-spin={spinning || undefined} aria-hidden="true">
            {s.style === "BOX" ? "🎁" : "🔵"}
          </span>
        )}
        <p className={g.message}>{s.message}</p>
        {spinning ? (
          <span className={`${ov.muted} ${g.meta}`}>뽑는 중… · {s.no}</span>
        ) : (
          <strong key="prize" className={`${ov.enter} ${ov.display} ${g.gachaPrize} ${s.blank ? g.prizeBlank : ""}`} data-motion="ZOOM">
            {s.blank ? `${s.donor} 님 아쉽게도 꽝!` : `${s.prize} 당첨!`}
          </strong>
        )}
      </div>
    </OverlayThemeRoot>
  );
}

const BOARD_SEC = { NORMAL: 25, FAST: 12, FIXED: 0 } as const;

/** 뽑기 당첨 리스트 (전광판): prizes in the 산정 기간, scrolling unless 고정. */
export function GachaBoardView({ board: b, theme }: { board: GachaBoardData; theme: ResolvedTheme }) {
  const sec = BOARD_SEC[b.speed];
  const item = (r: GachaBoardData["rows"][number], copy = "") => (
    <li key={copy + r.id} aria-hidden={copy ? true : undefined}>
      <b className={ov.label}>{r.donor}</b> {r.prize}
      {r.claimed && <span className={`${ov.chip} ${g.claimed}`}>수령</span>}
    </li>
  );
  return (
    <OverlayThemeRoot theme={theme} className={g.pad}>
      <div className={`${ov.card} ${ov.pill} ${g.board}`}>
        <strong className={`${ov.chip} ${ov.chipAccent} ${g.boardTitle}`}>{b.title}</strong>
        {b.rows.length === 0 ? (
          <span className={ov.muted}>아직 당첨된 상품이 없어요</span>
        ) : (
          <div className={g.scroll}>
            <ol style={sec ? { animationDuration: `${sec}s` } : { animation: "none" }}>
              {b.rows.map((r) => item(r))}
              {sec > 0 && b.rows.map((r) => item(r, "again-"))}
            </ol>
          </div>
        )}
      </div>
    </OverlayThemeRoot>
  );
}

// ── 벽지 ─────────────────────────────────────────────────────────────────────

/**
 * 벽지 (2026-10-04 결정: 자동 배치 스티커 벽): one sticker per donation where the server placed it on the 1920 × 1080
 * screen, in the 벽지 레이아웃 (기본형 · 말풍선형 · 박스형). The theme frames the image and draws the amount; the
 * nickname box and the amount keep the widget's colors. Stickers stay until 리모컨 벽지 비우기; a new one pops in.
 */
export function WallpaperView({ settings: s, images, stickers, theme, width = WALL_SIZE.w, height = WALL_SIZE.h }: { settings: Omit<WallpaperSettings, "images">; images: string[]; stickers: WallSticker[]; theme: ResolvedTheme; width?: number; height?: number }) {
  const fn: CSSProperties = { color: s.fnFont.color, WebkitTextStroke: `2px ${s.fnOutline}`, paintOrder: "stroke fill" };
  const nick: CSSProperties = { ...face(s.nicknameFont), color: s.nicknameFont.color, background: s.textBoxColor };
  return (
    <OverlayThemeRoot theme={theme} className={g.wall} style={{ width, height }}>
      {stickers.map((t) => {
        const url = t.imageUrl ?? (t.image === null ? null : images[t.image]);
        return (
          <div key={t.id} className={g.sticker} data-layout={s.layout} style={{ left: t.x, top: t.y, rotate: `${t.rotate}deg` }}>
            {s.layout === "BUBBLE" && <span className={`${ov.chip} ${ov.chipAccent} ${g.stickerBubble}`}>{t.amount}</span>}
            <span className={g.stickerFrame}>
              {url ? (
                // eslint-disable-next-line @next/next/no-img-element -- uploaded images are data URLs in the mock
                <img src={url} alt="" className={g.stickerImage} />
              ) : (
                <span className={g.stickerImage} aria-hidden="true" />
              )}
              {t.test && <span className={`${ov.chip} ${g.stickerTest}`}>테스트</span>}
            </span>
            {s.layout === "BASIC" && (
              <strong className={`${ov.display} ${g.stickerAmount}`} style={fn}>
                {t.amount}
              </strong>
            )}
            <span className={g.stickerNick} style={nick}>
              <b style={{ color: s.nicknameColor }}>{t.nickname}</b> 님
            </span>
            {s.layout === "BOX" && (
              <strong className={`${ov.display} ${g.stickerBoxAmount}`} style={fn}>
                {t.amount}
              </strong>
            )}
          </div>
        );
      })}
    </OverlayThemeRoot>
  );
}
