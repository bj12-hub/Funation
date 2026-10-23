"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type CSSProperties } from "react";
import { formatNumber } from "@/lib/format";
import { CREDITS_SECTIONS, bingoLines, type CreditsData, type CreditsSectionKey, type CreditsState, type OverlayTool } from "@/services/creator/broadcastToolTypes";
import { OverlayThemeRoot, ov } from "@/features/overlayTheme/OverlayThemeRoot";
import styles from "./toolOverlay.module.css";
import { useReloadSignal } from "../remote/useReloadSignal";
import { clock, timerSeconds } from "./timerMath";

const SPEED_SEC = { SLOW: 30, NORMAL: 18, FAST: 10 } as const;
/** 텍스트 슬롯 테두리 (글자 외곽선) on the stream, like the 후원 위젯's. */
const OUTLINE = "-2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000";

/**
 * OBS overlay for 방송 도구 (code-first). Transparent page that re-reads the tool state every
 * 2 seconds; the timer ticks locally from the server's start time (corrected for clock skew).
 */
export function ToolOverlay({ data }: { data: OverlayTool }) {
  const router = useRouter();
  const [now, setNow] = useState<number | null>(null);
  const serverNow = data.tool === "timer" ? data.serverNow : null;
  const [skew, setSkew] = useState(0);
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

  useEffect(() => {
    if (!serverNow) return;
    setSkew(new Date(serverNow).getTime() - Date.now());
  }, [serverNow]);

  useEffect(() => {
    if (data.tool !== "timer") return;
    setNow(Date.now());
    const tick = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(tick);
  }, [data.tool]);

  // 리모컨 기능 제어 OFF: show nothing.
  if (!data.on) return null;
  return <ToolView data={data} now={now} skew={skew} />;
}

const sectionTitle = (s: CreditsState, key: CreditsSectionKey) => s.sections[key].title || CREDITS_SECTIONS.find((x) => x.key === key)!.title;

/**
 * The 엔딩 크레딧 in roll order (2026-10-23): title · period, 총 후원, MVP, 후원자 TOP 3, 후원 순위 (after the TOP 3 when both
 * are on), 멤버별, then the thanks. A section with nothing to show is skipped. The film roll draws lists in theme cards;
 * the 스타워즈 크롤 keeps plain lines (its own yellow text).
 */
function CreditsBody({ state: s, data: d, crawl }: { state: CreditsState; data: CreditsData; crawl: boolean }) {
  const top3 = s.sections.top3.on ? d.donors.slice(0, 3) : [];
  const rest = s.sections.donors.on ? d.donors.slice(top3.length ? 3 : 0) : [];
  const list = crawl ? styles.crawlList : `${ov.card} ${styles.creditsCrew}`;
  const rank = (i: number) => (crawl ? <span>{i}.</span> : <span className={`${ov.chip} ${i === 1 ? ov.chipAccent : ""}`}>{i}</span>);
  return (
    <>
      <h1 className={crawl ? undefined : ov.display}>{s.title}</h1>
      <p className={styles.creditsPeriod}>{d.periodLabel}</p>
      {s.sections.total.on && !d.empty && (
        <section className={styles.creditsSection}>
          <h2>{sectionTitle(s, "total")}</h2>
          <p className={`${crawl ? "" : ov.display} ${styles.creditsBig}`}>{formatNumber(d.total)} FN</p>
        </section>
      )}
      {s.sections.mvp.on && d.mvp && (
        <section className={styles.creditsSection}>
          <h2>{sectionTitle(s, "mvp")}</h2>
          <p className={`${crawl ? "" : ov.display} ${styles.creditsBig}`}>{d.mvp.name}</p>
          <p>
            {formatNumber(d.mvp.score)} {d.memberUnit}
          </p>
        </section>
      )}
      {top3.length > 0 && (
        <section className={styles.creditsSection}>
          <h2>{sectionTitle(s, "top3")}</h2>
          <ol className={crawl ? styles.crawlList : styles.podium}>
            {top3.map((r) => (
              <li key={r.rank} className={crawl ? undefined : ov.card} data-rank={r.rank}>
                {rank(r.rank)}
                <strong className={crawl ? undefined : ov.label}>{r.name}</strong>
                <span>{formatNumber(r.fnAmount)} FN</span>
              </li>
            ))}
          </ol>
        </section>
      )}
      {rest.length > 0 && (
        <section className={styles.creditsSection}>
          <h2>{sectionTitle(s, "donors")}</h2>
          <ol className={list}>
            {rest.map((r) => (
              <li key={r.rank}>
                {rank(r.rank)}
                <span className={crawl ? undefined : ov.label}>{r.name}</span>
                <span className={crawl ? undefined : ov.display}>{formatNumber(r.fnAmount)} FN</span>
              </li>
            ))}
          </ol>
        </section>
      )}
      {s.sections.members.on && d.members.length > 0 && (
        <section className={styles.creditsSection}>
          <h2>{sectionTitle(s, "members")}</h2>
          <ol className={list}>
            {d.members.map((m) => (
              <li key={m.rank}>
                {rank(m.rank)}
                <span className={crawl ? undefined : ov.label}>{m.name}</span>
                <span className={crawl ? undefined : ov.display}>
                  {formatNumber(m.score)} {d.memberUnit}
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}
      {s.thanks.map((t) => (
        <p key={t}>{t}</p>
      ))}
    </>
  );
}

/**
 * The 방송 도구 overlays in the 방송 도구 테마 (2026-10-08 오버레이 테마): 자막 · 전광판 as theme pills, 타이머 in display
 * numbers, 엔딩 크레딧 rolling on the stream with the crew ranking in a card, 빙고 cards with stamped marks.
 */
function ToolView({ data, now, skew }: { data: OverlayTool; now: number | null; skew: number }) {
  switch (data.tool) {
    case "subtitle":
      if (!data.state.text) return null;
      return (
        <OverlayThemeRoot theme={data.theme} className={styles.pad}>
          <p key={data.state.text} className={`${ov.enter} ${data.theme.theme === "BOLD" ? ov.accentCard : ov.card} ${styles.subtitle}`} data-motion="SLIDE_UP" data-size={data.state.size}>
            {data.state.text}
          </p>
        </OverlayThemeRoot>
      );
    case "marquee": {
      if (!data.state.lines.length) return null;
      const text = data.state.lines.join("   ✦   ");
      return (
        <OverlayThemeRoot theme={data.theme} className={styles.pad}>
          <div className={`${data.theme.theme === "BOLD" ? ov.accentCard : ov.card} ${ov.pill} ${styles.marquee}`}>
            <span className={`${ov.chip} ${ov.chipAccent} ${styles.marqueeTag}`}>공지</span>
            <div className={styles.marqueeTrack}>
              <span key={text} style={{ animationDuration: `${SPEED_SEC[data.state.speed]}s` }}>
                {text}
              </span>
            </div>
          </div>
        </OverlayThemeRoot>
      );
    }
    case "timer":
      // Rendered only after mount so the server and client markup match.
      if (now === null) return null;
      return (
        <OverlayThemeRoot theme={data.theme} className={styles.pad}>
          <p className={`${data.theme.theme === "BOLD" ? ov.accentCard : ov.card} ${ov.display} ${styles.timer}`}>{clock(timerSeconds(data.state, now, skew))}</p>
        </OverlayThemeRoot>
      );
    case "credits": {
      // Shown only while rolling (리모컨 / 방송 도구 "시작"); a new start restarts from the top.
      if (!data.state.rollingSince) return null;
      const crawl = data.state.style === "CRAWL";
      return (
        <OverlayThemeRoot theme={data.theme} className={crawl ? styles.crawl : styles.credits}>
          {crawl ? (
            <div className={styles.crawlTilt}>
              <div key={data.state.rollingSince} className={styles.crawlText} style={{ animationDuration: `${data.state.durationSec}s` }}>
                <CreditsBody state={data.state} data={data.data} crawl />
              </div>
            </div>
          ) : (
            <div key={data.state.rollingSince} className={`${ov.onStream} ${styles.creditsRoll}`} style={{ animationDuration: `${data.state.durationSec}s` }}>
              <CreditsBody state={data.state} data={data.data} crawl={false} />
            </div>
          )}
        </OverlayThemeRoot>
      );
    }
    case "text": {
      // 텍스트 슬롯 (2026-10-23): an empty slot shows nothing; a new text restarts the scroll.
      const t = data.state;
      if (!t.text) return null;
      const look: CSSProperties = {
        fontSize: t.size,
        fontWeight: t.bold ? 800 : 500,
        textAlign: t.align === "LEFT" ? "left" : t.align === "RIGHT" ? "right" : "center",
        color: t.background === "CARD" ? undefined : t.color,
        textShadow: t.outline && t.background !== "CARD" ? OUTLINE : undefined
      };
      const body = (
        <p className={`${t.background === "CARD" ? ov.card : ov.onStream} ${styles.textSlot}`} style={look}>
          {t.text}
        </p>
      );
      return (
        <OverlayThemeRoot theme={data.theme} className={t.scroll ? styles.textScroll : styles.pad}>
          {t.scroll ? (
            <div key={t.text} className={styles.textScrollTrack} style={{ animationDuration: `${t.scrollSec}s` }}>
              {body}
            </div>
          ) : (
            body
          )}
        </OverlayThemeRoot>
      );
    }
    case "bingo": {
      // Shown only while 화면에 보이기 is on (방송 도구 빙고 card).
      if (!data.state.shown) return null;
      const { title, size, cells, marked, goal } = data.state;
      const lines = bingoLines(size, marked);
      const done = lines >= goal;
      return (
        <OverlayThemeRoot theme={data.theme} className={styles.pad}>
          <div className={`${ov.card} ${styles.bingo}`}>
            {title && <h1 className={ov.label}>{title}</h1>}
            <div className={styles.bingoBoard} style={{ gridTemplateColumns: `repeat(${size}, 1fr)` }}>
              {cells.map((c, i) => (
                <span key={i} data-marked={marked[i] || undefined}>
                  {c}
                </span>
              ))}
            </div>
            <p key={String(done)} className={`${ov.enter} ${done ? `${ov.chip} ${ov.chipAccent}` : ov.chip} ${styles.bingoStatus}`} data-motion={done ? "ZOOM" : "NONE"} data-done={done || undefined}>
              {done ? `빙고! ${lines}줄 완성` : `${lines}줄 완성 · 목표 ${goal}줄`}
            </p>
          </div>
        </OverlayThemeRoot>
      );
    }
  }
}
