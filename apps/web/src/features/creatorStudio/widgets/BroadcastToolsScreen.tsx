"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { formatNumber } from "@/lib/format";
import { ThemeChoiceField } from "@/features/overlayTheme/ThemeChoiceField";
import { adjustTimer, configureTimer, controlCredits, controlTimer, saveCredits, saveMarquee, saveSubtitle, saveToolTheme, setTimerDonationLink } from "@/services/creator/broadcastTools";
import type { OverlayThemeChoice } from "@/services/creator/overlayThemeTypes";
import type { OverlayTarget } from "@/services/creator/alertTypes";
import {
  CREDITS_DURATION_MAX,
  CREDITS_DURATION_MIN,
  CREDITS_LINES_MAX,
  CREDITS_LIST_MAX,
  CREDITS_PERIODS,
  CREDITS_SECTIONS,
  CREDITS_SECTION_TITLE_MAX,
  CREDITS_STYLES,
  MARQUEE_LINES_MAX,
  SUBTITLE_MAX,
  TIMER_ADJUST_STEPS,
  TIMER_DONATION_SEC_MAX,
  TOOL_CARDS,
  type CreditsData,
  type CreditsState,
  type MarqueeState,
  type SubtitleState,
  type TimerAction,
  type ToolKey,
  type ToolResult,
  type ToolsView
} from "@/services/creator/broadcastToolTypes";
import styles from "../crew/crew.module.css";
import tools from "./broadcastTools.module.css";
import { OverlayOffNotice } from "../remote/OverlayOffNotice";
import { signedSec } from "../remote/ToolsRemote";
import { CopyButton } from "../settings/SettingsCards";
import { BingoTool } from "./BingoTool";
import { TextSlotsTool } from "./TextSlotsTool";
import { clock, timerSeconds } from "./timerMath";

const lines = (s: string) => s.split("\n").map((l) => l.trim()).filter(Boolean);

/** One line of what the saved credits would roll now (the server's numbers for the saved period and sections). */
function creditsPreview(d: CreditsData, s: CreditsState["sections"]) {
  if (d.empty) return "미리보기 · 크루 방송이 아직 없어요. 크루 방송을 시작하거나 집계 기간을 오늘로 바꿔 주세요.";
  const parts = [`미리보기 · ${d.periodLabel}`];
  if (s.total.on) parts.push(`총 ${formatNumber(d.total)} FN`);
  if (s.mvp.on) parts.push(d.mvp ? `MVP ${d.mvp.name} ${formatNumber(d.mvp.score)} ${d.memberUnit}` : "MVP 없음");
  if (s.top3.on || s.donors.on) parts.push(d.donors.length ? `후원자 ${d.donors.slice(0, 3).map((r) => r.name).join(" · ")}${d.donors.length > 3 ? ` 외 ${d.donors.length - 3}명` : ""}` : "후원자 없음");
  if (s.members.on) parts.push(`멤버 ${d.members.length}명`);
  return `${parts.join(" · ")} (저장한 설정 기준)`;
}

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
  const [donationSec, setDonationSec] = useState(String(states.timer.donationSec));
  const [creditsTitle, setCreditsTitle] = useState(states.credits.title);
  const [thanks, setThanks] = useState(states.credits.thanks.join("\n"));
  const [creditsStyle, setCreditsStyle] = useState(states.credits.style);
  const [creditsSec, setCreditsSec] = useState(String(states.credits.durationSec));
  const [creditsPeriod, setCreditsPeriod] = useState(states.credits.period);
  const [sections, setSections] = useState(states.credits.sections);
  const [message, setMessage] = useState<{ tool: ToolKey; tone: "error" | "ok"; text: string } | null>(null);
  const [toolTheme, setToolTheme] = useState<OverlayThemeChoice>(view.theme);
  const [themeNote, setThemeNote] = useState<{ tone: "error" | "ok"; text: string } | null>(null);
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

      <section className={styles.card} aria-label="방송 도구 테마">
        <h2 className={styles.cardTitle}>🎨 방송 도구 테마</h2>
        <p className={styles.note}>자막 · 전광판 · 타이머 · 엔딩 크레딧 · 빙고 · 텍스트 슬롯 오버레이가 이 테마로 보여요. 고르면 바로 저장돼요.</p>
        <ThemeChoiceField
          value={toolTheme}
          appearance={view.appearance}
          onChange={(t: OverlayThemeChoice) => {
            setToolTheme(t);
            setThemeNote(null);
            startTransition(async () => {
              try {
                const res = await saveToolTheme(t);
                if (res.status === "SAVED") {
                  setThemeNote({ tone: "ok", text: "방송 도구 테마를 바꿨어요." });
                  router.refresh();
                } else if (res.status === "UNAUTHORIZED") router.push("/login?role=creator&next=/creator/widgets/tools");
                else setThemeNote({ tone: "error", text: res.message });
              } catch {
                setToolTheme(view.theme);
                setThemeNote({ tone: "error", text: "저장하지 못했어요. 잠시 후 다시 시도해 주세요." });
              }
            });
          }}
        />
        {themeNote && (
          <p className={themeNote.tone === "error" ? styles.error : styles.ok} role={themeNote.tone === "error" ? "alert" : "status"}>
            {themeNote.text}
          </p>
        )}
      </section>

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
          <form
            className={styles.addRow}
            onSubmit={(e) => {
              e.preventDefault();
              const sec = Math.floor(Number(donationSec) || 0);
              run("timer", () => setTimerDonationLink(sec), sec ? `후원 1,000 FN마다 ${sec}초씩 더해요.` : "후원 연동을 껐어요.");
            }}
          >
            <span className={styles.muted}>후원 연동 · 1,000 FN마다</span>
            <input
              className={styles.inputSmall}
              type="number"
              min={0}
              max={TIMER_DONATION_SEC_MAX}
              aria-label="1,000 FN마다 더할 시간(초)"
              value={donationSec}
              onChange={(e) => setDonationSec(e.target.value)}
            />
            <span className={styles.muted}>초 더하기</span>
            <button type="submit" className={styles.ghost} disabled={pending || Math.floor(Number(donationSec) || 0) === states.timer.donationSec}>
              저장
            </button>
          </form>
          <p className={styles.note}>
            {states.timer.donationSec > 0
              ? `카운트다운 중에 썸네이션 후원이 들어오면 1,000 FN마다 ${states.timer.donationSec}초가 더해져요 (5,500 FN이면 ${states.timer.donationSec * 5}초). 스톱워치에는 더하지 않고, 퀘스트 후원은 빼요.`
              : "후원 연동이 꺼져 있어요. 초를 넣고 저장하면 카운트다운에 후원 금액만큼 시간이 더해져요 (0 = 끔)."}
          </p>
        </div>
      )}

      {card(
        "credits",
        <form
          className={styles.startForm}
          onSubmit={(e) => {
            e.preventDefault();
            run(
              "credits",
              () => saveCredits({ title: creditsTitle, thanks: lines(thanks), style: creditsStyle, durationSec: Number(creditsSec), period: creditsPeriod, sections }),
              "엔딩 크레딧을 저장했어요."
            );
          }}
        >
          <input className={styles.input} aria-label="크레딧 제목" value={creditsTitle} onChange={(e) => setCreditsTitle(e.target.value)} />
          <div className={styles.addRow}>
            <span className={styles.segment} role="group" aria-label="연출 방식">
              {CREDITS_STYLES.map((x) => (
                <button key={x.key} type="button" aria-pressed={creditsStyle === x.key} onClick={() => setCreditsStyle(x.key)}>
                  {x.label}
                </button>
              ))}
            </span>
            <input
              className={styles.inputSmall}
              type="number"
              min={CREDITS_DURATION_MIN}
              max={CREDITS_DURATION_MAX}
              aria-label="스크롤 시간(초)"
              value={creditsSec}
              onChange={(e) => setCreditsSec(e.target.value)}
            />
            <span className={styles.muted}>초 동안 한 번 흘러요</span>
          </div>
          <div className={styles.addRow}>
            <span className={styles.muted}>집계 기간</span>
            <span className={styles.segment} role="group" aria-label="집계 기간">
              {CREDITS_PERIODS.map((x) => (
                <button key={x.key} type="button" aria-pressed={creditsPeriod === x.key} onClick={() => setCreditsPeriod(x.key)}>
                  {x.label}
                </button>
              ))}
            </span>
          </div>
          <p className={styles.note}>
            {creditsPeriod === "TODAY"
              ? "오늘(한국 날짜) 받은 후원과, 오늘 멤버를 지정해 받은 후원(FN)으로 집계해요."
              : "진행 중인 크루 방송(없으면 마지막으로 끝난 방송) 동안의 후원과 크루 점수판 점수로 집계해요."}{" "}
            후원자 이름은 후원랭킹과 같아요 — 익명과 대체 문구로 바뀐 이름은 순위에 넣지 않고 총 후원에만 더해요.
          </p>
          <ul className={tools.sections} aria-label="크레딧 섹션">
            {CREDITS_SECTIONS.map((meta) => {
              const x = sections[meta.key];
              const set = (patch: Partial<typeof x>) => setSections((prev) => ({ ...prev, [meta.key]: { ...prev[meta.key], ...patch } }));
              return (
                <li key={meta.key}>
                  <label className={styles.checkRow}>
                    <input type="checkbox" checked={x.on} onChange={(e) => set({ on: e.target.checked })} />
                    {meta.label}
                  </label>
                  <input
                    className={styles.input}
                    aria-label={`${meta.label} 제목`}
                    placeholder={meta.title}
                    maxLength={CREDITS_SECTION_TITLE_MAX}
                    value={x.title}
                    disabled={!x.on}
                    onChange={(e) => set({ title: e.target.value })}
                  />
                  {meta.list ? (
                    <span className={tools.sectionMax}>
                      <input
                        className={styles.inputSmall}
                        type="number"
                        min={1}
                        max={CREDITS_LIST_MAX}
                        aria-label={`${meta.label} 표시 인원`}
                        value={x.max}
                        disabled={!x.on}
                        onChange={(e) => set({ max: Math.max(1, Math.min(CREDITS_LIST_MAX, Math.floor(Number(e.target.value) || 1))) })}
                      />
                      <span className={styles.muted}>명</span>
                    </span>
                  ) : (
                    <span />
                  )}
                </li>
              );
            })}
          </ul>
          <textarea
            className={`${styles.input} ${styles.textarea}`}
            aria-label="감사 문구"
            rows={3}
            placeholder={`마지막에 흐를 감사 문구 — 한 줄에 하나 (최대 ${CREDITS_LINES_MAX}줄)`}
            value={thanks}
            onChange={(e) => setThanks(e.target.value)}
          />
          <p className={styles.note}>{creditsPreview(view.credits, states.credits.sections)}</p>
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

      {card(
        "text",
        <TextSlotsTool slots={states.text.slots} overlayUrl={(slot) => `${origin}${view.overlayBase}/text/${overlayKey}?slot=${slot}`} pending={pending} run={(action, ok) => run("text", action, ok)} />
      )}
    </div>
  );
}
