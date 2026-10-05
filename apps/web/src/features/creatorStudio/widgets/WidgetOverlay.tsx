"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState, type CSSProperties } from "react";
import { formatNumber } from "@/lib/format";
import { fillRank, fillTotal, rankAmountText } from "@/services/creator/widgetOverlayCore";
import { WALL_SIZE, type OverlayWidget, type WidgetFeedLine } from "@/services/creator/widgetOverlayTypes";
import { rankItems, votePercent } from "@/services/votes/voteTypes";
import { isBlankPrize, wheelGradient } from "@/services/donations/rouletteTypes";
import { RECENT_PLATFORMS } from "@/services/creator/widgetSettingsTypes";
import { PLATFORM_LABEL } from "@/types/platform";
import { useReloadSignal } from "../remote/useReloadSignal";
import styles from "./widgetOverlay.module.css";

const OUTLINE = "-2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000";
const QR_RADIUS = { BASIC: 0, ROUND: 16, CIRCLE: 999, SOFT: 32 } as const;
const SCROLL_SEC = { VERY_SLOW: 40, SLOW: 30, NORMAL: 20, FAST: 12, VERY_FAST: 7 } as const;
/** Somnation's own donations. */
const OWN_COLOR = "#a78bfa";

/** Full-size text style for an overlay (the popup preview scales the same settings down). */
const font = (f: { family: string; size: number; color?: string }, outline = false): CSSProperties => ({
  fontFamily: `"${f.family}", var(--font-sans)`,
  fontSize: f.size,
  color: f.color,
  textShadow: outline ? OUTLINE : undefined
});

const nickColor = (l: WidgetFeedLine) => RECENT_PLATFORMS.find((p) => p.key === l.platform)?.color ?? OWN_COLOR;

const tag = (l: WidgetFeedLine) => (l.kind === "TEST" ? "[테스트] " : l.platform ? `[${PLATFORM_LABEL[l.platform]}] ` : "");

/**
 * 후원 위젯 OBS overlay (code-first). Transparent page that re-reads its widget every 2 seconds; the
 * 리모컨 기능 제어 "후원 위젯" switch hides every widget and 새로고침 reloads it.
 */
export function WidgetOverlay({ data }: { data: OverlayWidget }) {
  const router = useRouter();
  useReloadSignal(data.reloadSeq);

  useEffect(() => {
    // OBS keys out transparent pixels, so both <html> and <body> must drop the page background.
    const root = document.documentElement;
    const prev = [root.style.background, document.body.style.background];
    root.style.background = "transparent";
    document.body.style.background = "transparent";
    const poll = setInterval(() => router.refresh(), 2000);
    return () => {
      clearInterval(poll);
      [root.style.background, document.body.style.background] = prev;
    };
  }, [router]);

  if (!data.on) return null;
  switch (data.widget) {
    case "goal":
      return <Goal data={data} />;
    case "total":
      return (
        <p className={styles.total}>
          <span style={font(data.settings.titleFont, data.settings.textOutline)}>{data.settings.title} :</span>{" "}
          <strong style={font(data.settings.contentFont, data.settings.textOutline)}>{fillTotal(data.settings.template, data.total)}</strong>
        </p>
      );
    case "ranking":
      return <Ranking data={data} />;
    case "recent":
      return <Recent data={data} />;
    case "event":
      return <EventList data={data} />;
    case "qr":
      return <Qr data={data} />;
    case "quest":
      return <Quests data={data} />;
    case "vote":
      return <Vote data={data} />;
    case "roulette":
      return <Roulette data={data} />;
    case "gacha":
      return <GachaDraw data={data} />;
    case "gacha-board":
      return <GachaBoard data={data} />;
    case "wallpaper":
      return <Wallpaper data={data} />;
  }
}

function Goal({ data }: { data: Extract<OverlayWidget, { widget: "goal" }> }) {
  const s = data.settings;
  const text = font({ ...s.font, color: "#FFFFFF" }, s.textOutline);
  const amount = (
    <strong style={{ ...text, color: s.barColor }}>
      {formatNumber(data.current)} FN{s.showPercent && ` (${data.percent.toFixed(1)}%)`}
    </strong>
  );
  return (
    <div className={styles.goal} data-style={s.style}>
      <div className={styles.goalHead}>
        <span style={text}>{s.title}</span>
        {s.style !== "ONE_LINE" && amount}
      </div>
      <div
        className={styles.goalBar}
        style={{ height: s.barHeight, background: s.barBackground }}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(data.percent)}
        aria-label="목표 달성률"
      >
        <span style={{ width: `${data.percent}%`, background: s.barColor }} />
      </div>
      {s.style === "ONE_LINE" && amount}
      {s.style === "BASIC" && (
        <div className={styles.goalFoot} style={{ ...text, fontSize: Math.max(12, Math.round(s.font.size * 0.85)) }}>
          <span>목표: {formatNumber(s.goalAmount)} FN</span>
          {data.daysLeft !== null && <span>남은 기간: {data.daysLeft}일</span>}
        </div>
      )}
    </div>
  );
}

function Ranking({ data }: { data: Extract<OverlayWidget, { widget: "ranking" }> }) {
  const s = data.settings;
  const scroll = s.style === "SCROLL_TEXT";
  const row = (r: (typeof data.rows)[number], copy = "") => {
    const tier = r.rank === 1 ? s.first : s.others;
    return (
      <li key={copy + r.name} style={font(tier.font)} aria-hidden={copy ? true : undefined}>
        <span>{fillRank(s.format.rank, r.rank, r.name, r.fnAmount)}</span>
        <span style={{ color: tier.accentColor }}>{fillRank(s.format.name, r.rank, r.name, r.fnAmount)}</span>
        {s.showAmount && <span style={{ color: tier.accentColor }}>{rankAmountText(s.format.amount, r)}</span>}
      </li>
    );
  };
  return (
    <div className={styles.ranking} data-style={s.style}>
      <strong style={font(s.titleFont)}>{s.title}</strong>
      {data.rows.length > 0 &&
        (scroll ? (
          <div className={styles.rankScroll}>
            {/* Two copies keep the line moving without a gap. */}
            <ol style={{ gap: s.scrollGap, animationDuration: `${SCROLL_SEC[s.scrollSpeed]}s` }}>
              {data.rows.map((r) => row(r))}
              {data.rows.map((r) => row(r, "again-"))}
            </ol>
          </div>
        ) : (
          <ol>{data.rows.map((r) => row(r))}</ol>
        ))}
    </div>
  );
}

function Line({ l, outline, colored, background, effect, durationSec }: { l: WidgetFeedLine; outline?: boolean; colored: boolean; background?: boolean; effect: string; durationSec: number }) {
  return (
    <li className={styles.line} data-effect={effect} style={{ animationDuration: `${durationSec}s`, textShadow: outline ? OUTLINE : undefined }}>
      {tag(l)}
      {l.before}
      <b className={background ? styles.nickBg : undefined} style={{ color: colored ? nickColor(l) : undefined }}>
        {l.nickname}
      </b>
      {l.after}
    </li>
  );
}

function Recent({ data }: { data: Extract<OverlayWidget, { widget: "recent" }> }) {
  const s = data.settings;
  return (
    <ul className={styles.feed} style={{ ...font(s.font), gap: s.lineGap }}>
      {data.lines.map((l) => (
        <Line key={l.id} l={l} outline={s.textOutline} colored={s.nicknameColor} effect={s.effect} durationSec={s.scrollSpeedSec} />
      ))}
    </ul>
  );
}

/** 이벤트: lines older than 자동 숨김 seconds disappear (server clock, corrected for skew). */
function EventList({ data }: { data: Extract<OverlayWidget, { widget: "event" }> }) {
  const s = data.settings;
  const [skew, setSkew] = useState(0);
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => setSkew(new Date(data.serverNow).getTime() - Date.now()), [data.serverNow]);
  useEffect(() => {
    if (!s.autoHide) return;
    setNow(Date.now());
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, [s.autoHide]);
  const visible = s.autoHide && now !== null ? data.lines.filter((l) => now + skew - new Date(l.at).getTime() < s.hideAfterSec * 1000) : data.lines;
  if (visible.length === 0) return null;
  return (
    <ul className={styles.feed} data-event={s.style} style={font(s.font)}>
      {visible.map((l) => (
        <Line key={l.id} l={l} colored={s.nicknameColor} background={s.nicknameBackground} effect={s.effect} durationSec={0.5} />
      ))}
    </ul>
  );
}

/** Server time each second (corrected for clock skew); null until mounted. */
function useServerClock(serverNow: string) {
  const [skew, setSkew] = useState(0);
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => setSkew(new Date(serverNow).getTime() - Date.now()), [serverNow]);
  useEffect(() => {
    setNow(Date.now());
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, []);
  return now === null ? null : now + skew;
}

/** 퀘스트: running quests with a live countdown; 시간 초과 · 결과 대기 when it ends. */
function Quests({ data }: { data: Extract<OverlayWidget, { widget: "quest" }> }) {
  const s = data.settings;
  const now = useServerClock(data.serverNow);
  if (!s.enabled || data.quests.length === 0) return null;
  const left = (endsAt: string) => {
    if (now === null) return "";
    const sec = Math.floor((new Date(endsAt).getTime() - now) / 1000);
    return sec <= 0 ? "시간 초과 · 결과 대기" : `남은시간 ${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;
  };
  return (
    <ul className={styles.quests}>
      {data.quests.map((q) => (
        <li key={q.id} className={styles.quest} data-style={s.style}>
          {s.style === "FANCY" && <span className={styles.questBadge}>QUEST</span>}
          <strong style={font({ ...s.titleFont, size: 26 })}>{q.title}</strong>
          <span className={styles.questMeta}>
            <span style={font({ ...s.timeFont, size: 18 })}>{left(q.endsAt)}</span>
            <span style={font({ ...s.prizeFont, size: 18 })}>상금 {formatNumber(q.amount)}FN</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

const hms = (sec: number) => [Math.floor(sec / 3600), Math.floor((sec % 3600) / 60), sec % 60].map((n) => String(n).padStart(2, "0")).join(":");

/** 투표: the 리모컨's vote, items ranked by votes (ties share a rank) with a bar in the preset color. */
function Vote({ data }: { data: Extract<OverlayWidget, { widget: "vote" }> }) {
  const s = data.settings;
  const now = useServerClock(data.serverNow);
  const v = data.vote;
  if (!s.enabled || !v) return null;
  const left = now === null ? null : Math.max(0, Math.floor((new Date(v.endsAt).getTime() - now) / 1000));
  const ended = v.ended || left === 0;
  return (
    <div className={styles.vote} style={{ borderColor: v.color }}>
      <strong style={font(s.titleFont)}>{v.name}</strong>
      <div className={styles.voteInfo} style={font(s.infoFont)}>
        <span>1인 1표 · 총 {formatNumber(v.total)}표</span>
        <span>{ended ? "투표 종료" : left === null ? "" : `투표 종료까지 ${hms(left)}`}</span>
      </div>
      <ol>
        {rankItems(v).map((it) => (
          <li key={it.index} style={font(s.itemFont)}>
            <span className={styles.voteBar} style={{ width: `${votePercent(it.count, v.total)}%`, background: v.color }} aria-hidden="true" />
            <span>{it.rank}등</span>
            <span>{it.label}</span>
            <span>{formatNumber(it.count)}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/**
 * 룰렛 (펀페이 1009:199 SPINNING · 1009:181 RESULT): the wheel turns until the server reveals the result,
 * which stays for a few seconds. With 결과 자동 노출 off the wheel stops (WAITING) until ✓ 결과 공개.
 * Prizes are the creator's (no FN).
 */
function Roulette({ data }: { data: Extract<OverlayWidget, { widget: "roulette" }> }) {
  const s = data.stage;
  if (!s) return null;
  const count = s.limit > 0 ? `참여 횟수 ${s.nth} / ${s.limit}` : `오늘 ${s.nth}번째 참여`;
  return (
    <div className={styles.roulette} data-status={s.status}>
      <div className={styles.rouletteHead}>
        <span>룰렛</span>
        <b>{s.status}</b>
      </div>
      {s.status !== "RESULT" || s.result === null ? (
        <div className={styles.rouletteBody}>
          <span className={styles.rouletteWheel} data-stopped={s.status === "WAITING" || undefined} style={{ background: wheelGradient(s.items) }} aria-hidden="true" />
          <div className={styles.rouletteText}>
            <span className={styles.rouletteItems}>{s.items.map((it) => it.name).join(" · ")}</span>
            <strong>{s.status === "WAITING" ? "룰렛이 멈췄어요!" : "룰렛이 돌아가고 있어요!"}</strong>
            <span>
              {s.donor} · {formatNumber(s.amount)} FN
            </span>
            <span className={styles.rouletteMeta}>
              {count} · {s.status === "WAITING" ? "결과 공개 대기" : "결과 계산 중"}
            </span>
          </div>
        </div>
      ) : (
        <div className={styles.rouletteResult}>
          <strong className={styles.roulettePrize}>{s.result}</strong>
          <b>{isBlankPrize(s.result) ? "BLANK" : "WINNER"}</b>
          <span>{isBlankPrize(s.result) ? `${s.donor} 님 아쉽게도 꽝!` : `${s.donor} 님 당첨!`}</span>
          <span className={styles.rouletteMeta}>
            {formatNumber(s.amount)} FN · {s.no}
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * 뽑기: the machine (캡슐 · 박스) turns for 기계 회전 시간, then the prize shows for 화면 노출 시간; the 크레딧
 * style lists the latest prizes instead of a machine. Prizes are the creator's (no FN).
 */
function GachaDraw({ data }: { data: Extract<OverlayWidget, { widget: "gacha" }> }) {
  const s = data.stage;
  if (!s) return null;
  const spinning = s.status === "SPINNING" || s.prize === null;
  return (
    <div className={styles.gacha} data-status={s.status} style={{ borderColor: s.pointColor }}>
      <div className={styles.rouletteHead}>
        <span>{s.gachaName}</span>
        <b>{spinning ? "DRAWING" : s.blank ? "BLANK" : "WINNER"}</b>
      </div>
      {s.style === "CREDIT" ? (
        <ol className={styles.gachaCredit}>
          {data.history.map((h, i) => (
            <li key={i}>
              {h.donor} · {h.prize}
            </li>
          ))}
        </ol>
      ) : (
        <span className={styles.gachaMachine} data-style={s.style} data-spin={spinning || undefined} aria-hidden="true">
          {s.style === "BOX" ? "🎁" : "🔵"}
        </span>
      )}
      <p className={styles.gachaMessage}>{s.message}</p>
      {spinning ? (
        <span className={styles.rouletteMeta}>뽑는 중… · {s.no}</span>
      ) : (
        <strong className={styles.gachaPrize} style={{ color: s.blank ? undefined : s.pointColor }}>
          {s.blank ? `${s.donor} 님 아쉽게도 꽝!` : `🎉 ${s.prize} 당첨!`}
        </strong>
      )}
    </div>
  );
}

const BOARD_SEC = { NORMAL: 25, FAST: 12, FIXED: 0 } as const;

/** 뽑기 당첨 리스트 (전광판): prizes in the 산정 기간, scrolling unless 고정. */
function GachaBoard({ data }: { data: Extract<OverlayWidget, { widget: "gacha-board" }> }) {
  const b = data.board;
  const sec = BOARD_SEC[b.speed];
  const item = (r: (typeof b.rows)[number], copy = "") => (
    <li key={copy + r.id} aria-hidden={copy ? true : undefined}>
      <b>{r.donor}</b> {r.prize}
      {r.claimed && <span className={styles.gachaClaimed}>수령</span>}
    </li>
  );
  return (
    <div className={styles.gachaBoard}>
      <strong>{b.title}</strong>
      {b.rows.length === 0 ? (
        <span className={styles.rouletteMeta}>아직 당첨된 상품이 없어요</span>
      ) : (
        <div className={styles.rankScroll}>
          <ol style={sec ? { animationDuration: `${sec}s` } : { animation: "none" }}>
            {b.rows.map((r) => item(r))}
            {sec > 0 && b.rows.map((r) => item(r, "again-"))}
          </ol>
        </div>
      )}
    </div>
  );
}

/**
 * 벽지 (2026-10-04 결정: 자동 배치 스티커 벽): one sticker per donation where the server placed it on the
 * 1920 × 1080 screen, in the 벽지 레이아웃 of the settings preview (기본형 · 말풍선형 · 박스형). Stickers stay
 * until 리모컨 벽지 비우기; a new one pops in.
 */
function Wallpaper({ data }: { data: Extract<OverlayWidget, { widget: "wallpaper" }> }) {
  const s = data.settings;
  const fn: CSSProperties = { fontFamily: `"${s.fnFont.family}", var(--font-sans)`, color: s.fnFont.color, WebkitTextStroke: `2px ${s.fnOutline}`, paintOrder: "stroke fill" };
  const nick: CSSProperties = { fontFamily: `"${s.nicknameFont.family}", var(--font-sans)`, color: s.nicknameFont.color, background: s.textBoxColor };
  return (
    <div className={styles.wall} style={{ width: WALL_SIZE.w, height: WALL_SIZE.h }}>
      {data.stickers.map((t) => {
        const url = t.imageUrl ?? (t.image === null ? null : data.images[t.image]);
        return (
          <div key={t.id} className={styles.sticker} data-layout={s.layout} style={{ left: t.x, top: t.y, rotate: `${t.rotate}deg` }}>
            {s.layout === "BUBBLE" && <span className={styles.stickerBubble}>{t.amount}</span>}
            <span className={styles.stickerFrame}>
              {url ? (
                // eslint-disable-next-line @next/next/no-img-element -- uploaded images are data URLs in the mock
                <img src={url} alt="" className={styles.stickerImage} />
              ) : (
                <span className={styles.stickerImage} aria-hidden="true" />
              )}
              {t.test && <span className={styles.stickerTest}>테스트</span>}
            </span>
            {s.layout === "BASIC" && (
              <strong className={styles.stickerAmount} style={fn}>
                {t.amount}
              </strong>
            )}
            <span className={styles.stickerNick} style={nick}>
              <b style={{ color: s.nicknameColor }}>{t.nickname}</b>{" "}
              님
            </span>
            {s.layout === "BOX" && (
              <strong className={styles.stickerBoxAmount} style={fn}>
                {t.amount}
              </strong>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Qr({ data }: { data: Extract<OverlayWidget, { widget: "qr" }> }) {
  const s = data.settings;
  const caption = s.captionEnabled && s.caption.trim() && (
    <span className={styles.qrCaption} style={{ ...font(s.captionFont), color: s.borderColor }}>
      {s.caption}
    </span>
  );
  return (
    <div className={styles.qr}>
      {s.captionPosition === "TOP" && caption}
      <span className={styles.qrTile} style={{ borderColor: s.borderColor, borderRadius: QR_RADIUS[s.codeStyle] }}>
        <Image src={data.imageUrl} alt="후원 QR코드" width={200} height={200} priority />
        {s.centerLogo && (
          <span className={styles.qrLogo} aria-hidden="true" style={{ background: s.borderColor }}>
            S
          </span>
        )}
      </span>
      {s.captionPosition === "BOTTOM" && caption}
    </div>
  );
}
