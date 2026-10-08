"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { formatNumber } from "@/lib/format";
import { adjustTimer, configureTimer, controlCredits, controlTimer, saveCredits, saveMarquee, saveSubtitle } from "@/services/creator/broadcastTools";
import type { OverlayTarget } from "@/services/creator/alertTypes";
import {
  CREDITS_LINES_MAX,
  MARQUEE_LINES_MAX,
  SUBTITLE_MAX,
  TIMER_ADJUST_STEPS,
  TOOL_CARDS,
  type MarqueeState,
  type SubtitleState,
  type TimerAction,
  type ToolKey,
  type ToolResult,
  type ToolsView
} from "@/services/creator/broadcastToolTypes";
import styles from "../crew/crew.module.css";
import { OverlayOffNotice } from "../remote/OverlayOffNotice";
import { signedSec } from "../remote/ToolsRemote";
import { CopyButton } from "../settings/SettingsCards";
import { BingoTool } from "./BingoTool";
import { clock, timerSeconds } from "./timerMath";

const lines = (s: string) => s.split("\n").map((l) => l.trim()).filter(Boolean);

/**
 * 방송 도구 — code-first (no Figma frame). Route `/creator/widgets/tools`. The remote for 자막 ·
 * 전광판 · 타이머 · 엔딩 크레딧 · 빙고; each card shows its OBS overlay URL. The server owns every state
 * (the overlay polls it), so this screen only sends changes.
 */
export function BroadcastToolsScreen({ view, overlayKey, switches }: { view: ToolsView; overlayKey: string; switches: Record<OverlayTarget, boolean> }) {
  const router = useRouter();
  const { states } = view;
  const [subtitle, setSubtitle] = useState<SubtitleState>(states.subtitle);
  const [marqueeText, setMarqueeText] = useState(states.marquee.lines.join("\n"));
  const [speed, setSpeed] = useState<MarqueeState["speed"]>(states.marquee.speed);
  const [mode, setMode] = useState(states.timer.mode);
  const [minutes, setMinutes] = useState(String(Math.round(states.timer.durationSec / 60)));
  const [creditsTitle, setCreditsTitle] = useState(states.credits.title);
  const [thanks, setThanks] = useState(states.credits.thanks.join("\n"));
  const [includeCrew, setIncludeCrew] = useState(states.credits.includeCrew);
  const [message, setMessage] = useState<{ tool: ToolKey; tone: "error" | "ok"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const [now, setNow] = useState(() => Date.now());
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);

  const running = Boolean(states.timer.startedAt);
  useEffect(() => {
    if (!running) return;
    const tick = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(tick);
  }, [running]);

  const run = (tool: ToolKey, action: () => Promise<ToolResult>, ok?: string) => {
    setMessage(null);
    startTransition(async () => {
      try {
        const res = await action();
        if (res.status === "SAVED") {
          if (ok) setMessage({ tool, tone: "ok", text: ok });
          router.refresh();
        } else if (res.status === "UNAUTHORIZED") router.push("/login?role=creator&next=/creator/widgets/tools");
        else setMessage({ tool, tone: "error", text: res.message });
      } catch {
        setMessage({ tool, tone: "error", text: "저장하지 못했어요. 잠시 후 다시 시도해 주세요." });
      }
    });
  };

  const timerAction = (a: TimerAction) => run("timer", () => controlTimer(a));
  const shown = timerSeconds(states.timer, now);

  const card = (key: ToolKey, body: React.ReactNode) => {
    const meta = TOOL_CARDS.find((c) => c.key === key)!;
    const url = `${origin}${view.overlayBase}/${key}/${overlayKey}`;
    return (
      <section className={styles.card} aria-labelledby={`tool-${key}`}>
        <div className={styles.cardHead}>
          <h2 className={styles.cardTitle} id={`tool-${key}`}>
            {meta.emoji} {meta.title}
          </h2>
          <CopyButton value={url} label="오버레이 URL 복사" className={styles.ghost} />
        </div>
        <p className={styles.muted}>{meta.description}</p>
        {body}
        {message?.tool === key && (
          <p className={message.tone === "error" ? styles.error : styles.ok} role={message.tone === "error" ? "alert" : "status"}>
            {message.text}
          </p>
        )}
      </section>
    );
  };

  return (
    <div className={styles.content}>
      <header className={styles.header}>
        <h1 className={styles.title}>방송 도구</h1>
        <p className={styles.subtitle}>
          OBS 브라우저 소스에 오버레이 URL을 추가하고, 이 화면을 리모컨처럼 사용하세요. 변경 사항은 몇 초 안에 방송 화면에 반영돼요.
        </p>
        <p className={styles.note}>
          <Link href="/creator/widgets">← 후원위젯/알림설정</Link> · 오버레이 URL에는 연동 키가 들어 있어요. 외부에 공유하지 마세요.
        </p>
      </header>
      <OverlayOffNotice targets={["subtitle", "marquee", "timer", "credits", "bingo"]} switches={switches} />

      {card(
        "subtitle",
        <form
          className={styles.startForm}
          onSubmit={(e) => {
            e.preventDefault();
            run("subtitle", () => saveSubtitle(subtitle), subtitle.text.trim() ? "자막을 띄웠어요." : "자막을 내렸어요.");
          }}
        >
          <input
            className={styles.input}
            aria-label="자막 문구"
            placeholder="방송 화면에 띄울 문구"
            maxLength={SUBTITLE_MAX}
            value={subtitle.text}
            onChange={(e) => setSubtitle((s) => ({ ...s, text: e.target.value }))}
          />
          <div className={styles.cardHead}>
            <span className={styles.segment} role="group" aria-label="자막 크기">
              {(["S", "M", "L"] as const).map((sz) => (
                <button key={sz} type="button" aria-pressed={subtitle.size === sz} onClick={() => setSubtitle((s) => ({ ...s, size: sz }))}>
                  {{ S: "작게", M: "보통", L: "크게" }[sz]}
                </button>
              ))}
            </span>
            <span className={styles.actions}>
              <button
                type="button"
                className={styles.ghost}
                disabled={pending}
                onClick={() => {
                  setSubtitle((s) => ({ ...s, text: "" }));
                  run("subtitle", () => saveSubtitle({ ...subtitle, text: "" }), "자막을 내렸어요.");
                }}
              >
                내리기
              </button>
              <button type="submit" className={styles.primary} disabled={pending}>
                띄우기
              </button>
            </span>
          </div>
          <p className={styles.note}>
            현재 방송 화면: {states.subtitle.text ? `“${states.subtitle.text}”` : "표시 중인 자막 없음"}
          </p>
        </form>
      )}

      {card(
        "marquee",
        <form
          className={styles.startForm}
          onSubmit={(e) => {
            e.preventDefault();
            run("marquee", () => saveMarquee({ lines: lines(marqueeText), speed }), "전광판을 저장했어요.");
          }}
        >
          <textarea
            className={`${styles.input} ${styles.textarea}`}
            aria-label="전광판 문구"
            rows={3}
            placeholder={`한 줄에 문구 하나 (최대 ${MARQUEE_LINES_MAX}줄)`}
            value={marqueeText}
            onChange={(e) => setMarqueeText(e.target.value)}
          />
          <div className={styles.cardHead}>
            <span className={styles.segment} role="group" aria-label="흐르는 속도">
              {(["SLOW", "NORMAL", "FAST"] as const).map((sp) => (
                <button key={sp} type="button" aria-pressed={speed === sp} onClick={() => setSpeed(sp)}>
                  {{ SLOW: "느리게", NORMAL: "보통", FAST: "빠르게" }[sp]}
                </button>
              ))}
            </span>
            <button type="submit" className={styles.primary} disabled={pending}>
              저장
            </button>
          </div>
          <p className={styles.note}>문구를 모두 지우고 저장하면 전광판이 숨겨져요.</p>
        </form>
      )}

      {card(
        "timer",
        <div className={styles.startForm}>
          <div className={styles.cardHead}>
            <span className={styles.clock} aria-live="off">
              {running && <span className={styles.liveDot} aria-hidden="true" />}
              {clock(shown)}
            </span>
            <span className={styles.actions}>
              {running ? (
                <button type="button" className={styles.ghost} disabled={pending} onClick={() => timerAction("PAUSE")}>
                  일시정지
                </button>
              ) : (
                <button type="button" className={styles.primary} disabled={pending || (mode === "COUNTDOWN" && shown === 0)} onClick={() => timerAction("START")}>
                  {states.timer.elapsedBeforeSec > 0 ? "이어서 시작" : "시작"}
                </button>
              )}
              <button type="button" className={styles.ghost} disabled={pending} onClick={() => timerAction("RESET")}>
                초기화
              </button>
            </span>
          </div>
          <div className={styles.actions} role="group" aria-label="타이머 퀵 조정">
            {TIMER_ADJUST_STEPS.map((s) => (
              <button key={s} type="button" className={styles.chipOff} disabled={pending} onClick={() => run("timer", () => adjustTimer(s))}>
                {signedSec(s)}
              </button>
            ))}
          </div>
          <form
            className={styles.addRow}
            onSubmit={(e) => {
              e.preventDefault();
              run("timer", () => configureTimer({ mode, durationSec: Math.round(Number(minutes) * 60) }), "타이머를 설정했어요. (초기화됨)");
            }}
          >
            <span className={styles.segment} role="group" aria-label="타이머 모드">
              {(["COUNTDOWN", "STOPWATCH"] as const).map((m) => (
                <button key={m} type="button" aria-pressed={mode === m} onClick={() => setMode(m)}>
                  {m === "COUNTDOWN" ? "카운트다운" : "스톱워치"}
                </button>
              ))}
            </span>
            <input
              className={styles.input}
              type="number"
              min={1}
              max={1440}
              aria-label={mode === "COUNTDOWN" ? "카운트다운 시간(분)" : "스톱워치 최대 시간(분)"}
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
            />
            <span className={styles.muted}>분</span>
            <button type="submit" className={styles.ghost} disabled={pending}>
              설정 적용
            </button>
          </form>
        </div>
      )}

      {card(
        "credits",
        <form
          className={styles.startForm}
          onSubmit={(e) => {
            e.preventDefault();
            run("credits", () => saveCredits({ title: creditsTitle, thanks: lines(thanks), includeCrew }), "엔딩 크레딧을 저장했어요.");
          }}
        >
          <input className={styles.input} aria-label="크레딧 제목" value={creditsTitle} onChange={(e) => setCreditsTitle(e.target.value)} />
          <textarea
            className={`${styles.input} ${styles.textarea}`}
            aria-label="감사 문구"
            rows={3}
            placeholder={`한 줄에 문구 하나 (최대 ${CREDITS_LINES_MAX}줄)`}
            value={thanks}
            onChange={(e) => setThanks(e.target.value)}
          />
          <label className={styles.checkRow}>
            <input type="checkbox" checked={includeCrew} onChange={(e) => setIncludeCrew(e.target.checked)} />
            크루 멤버 이번 달 후원 순위 포함
          </label>
          {includeCrew && (
            <p className={styles.note}>
              {view.crew.length
                ? view.crew.map((c) => `${c.name} ${formatNumber(c.score)} FN`).join(" · ")
                : "크루 멤버가 없어요. 크루 관리에서 멤버를 추가하세요."}
            </p>
          )}
          <div className={styles.actions}>
            <span className={styles.muted}>{states.credits.rollingSince ? "방송 화면에 흐르는 중" : "대기 중"}</span>
            <button
              type="button"
              className={styles.ghost}
              disabled={pending}
              onClick={() => run("credits", () => controlCredits(states.credits.rollingSince ? "STOP" : "START"), states.credits.rollingSince ? "크레딧을 멈췄어요." : "크레딧을 시작했어요.")}
            >
              {states.credits.rollingSince ? "크레딧 중지" : "🎬 크레딧 시작"}
            </button>
            <button type="submit" className={styles.primary} disabled={pending}>
              저장
            </button>
          </div>
        </form>
      )}

      {card("bingo", <BingoTool state={states.bingo} pending={pending} run={(action, ok) => run("bingo", action, ok)} />)}
    </div>
  );
}
