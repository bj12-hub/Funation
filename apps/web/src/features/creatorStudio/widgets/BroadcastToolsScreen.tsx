"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { formatNumber } from "@/lib/format";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { MessageKey } from "@/lib/i18n/translate";
import { ThemeChoiceField } from "@/features/overlayTheme/ThemeChoiceField";
import { adjustTimer, configureTimer, controlCredits, controlTimer, saveCredits, saveMarquee, saveSubtitle, saveToolTheme, setTimerDonationLink } from "@/services/creator/broadcastTools";
import type { OverlayThemeChoice } from "@/services/creator/overlayThemeTypes";
import type { OverlayTarget } from "@/services/creator/alertTypes";
import {
  CREDITS_DURATION_MAX,
  CREDITS_DURATION_MIN,
  CREDITS_LINES_MAX,
  CREDITS_LIST_MAX,
  CREDITS_MVP_BASES,
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
  type CreditsMvpBasis,
  type CreditsPeriod,
  type CreditsSectionKey,
  type CreditsState,
  type CreditsStyle,
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
import { WheelTool } from "./WheelTool";
import { clock, timerSeconds } from "./timerMath";

const lines = (s: string) => s.split("\n").map((l) => l.trim()).filter(Boolean);

type T = ReturnType<typeof useI18n>["t"];

/** Each tool card's title and description by tool key (the service's TOOL_CARDS stay as written, 2026-11-01). */
const TOOL_TEXT: Record<ToolKey, [MessageKey, MessageKey]> = {
  subtitle: ["studioTools.toolSubtitle", "studioTools.toolSubtitleDesc"],
  marquee: ["studioTools.toolMarquee", "studioTools.toolMarqueeDesc"],
  timer: ["studioTools.toolTimer", "studioTools.toolTimerDesc"],
  credits: ["studioTools.toolCredits", "studioTools.toolCreditsDesc"],
  bingo: ["studioTools.toolBingo", "studioTools.toolBingoDesc"],
  text: ["studioTools.toolText", "studioTools.toolTextDesc"],
  wheel: ["studioTools.toolWheel", "studioTools.toolWheelDesc"]
};
const STYLE_KEY: Record<CreditsStyle, MessageKey> = { FILM: "studioTools.styleFilm", CRAWL: "studioTools.styleCrawl" };
const PERIOD_KEY: Record<CreditsPeriod, MessageKey> = { TODAY: "studioTools.periodToday", CREW: "studioTools.periodCrew" };
const MVP_KEY: Record<CreditsMvpBasis, MessageKey> = { POINTS: "studioTools.mvpPoints", AMOUNT: "studioTools.mvpAmount" };
const SECTION_KEY: Record<CreditsSectionKey, MessageKey> = {
  total: "studioTools.sectionTotal",
  mvp: "studioTools.sectionMvp",
  top3: "studioTools.sectionTop3",
  donors: "studioTools.sectionDonors",
  hotSigs: "studioTools.sectionHotSigs",
  highSigs: "studioTools.sectionHighSigs",
  members: "studioTools.sectionMembers"
};

/** One line of what the saved credits would roll now (the server's numbers for the saved period and sections). */
function creditsPreview(d: CreditsData, s: CreditsState["sections"], t: T) {
  if (d.empty) return t("studioTools.previewEmpty");
  // The server labels the TODAY period "오늘" and a crew broadcast by its title; crew points come as "점".
  const parts = [t("studioTools.previewHead", { period: d.periodLabel === "오늘" ? t("studioTools.periodToday") : d.periodLabel })];
  if (s.total.on) parts.push(t("studioTools.previewTotal", { amount: formatNumber(d.total) }));
  if (s.mvp.on) parts.push(d.mvp ? t("studioTools.previewMvp", { name: d.mvp.name, score: formatNumber(d.mvp.score), unit: d.mvp.unit === "점" ? t("studioTools.unitPoints") : d.mvp.unit }) : t("studioTools.previewNoMvp"));
  if (s.top3.on || s.donors.on)
    parts.push(
      d.donors.length
        ? t("studioTools.previewDonors", {
            names: d.donors.slice(0, 3).map((r) => r.name).join(" · "),
            more: d.donors.length > 3 ? t("studioTools.previewDonorsMore", { count: d.donors.length - 3 }) : ""
          })
        : t("studioTools.previewNoDonors")
    );
  if (s.hotSigs.on) parts.push(d.hotSigs.length ? t("studioTools.previewHot", { name: d.hotSigs[0].name, count: d.hotSigs[0].count }) : t("studioTools.previewNoHot"));
  if (s.highSigs.on) parts.push(d.highSigs.length ? t("studioTools.previewHigh", { name: d.highSigs[0].name, amount: formatNumber(d.highSigs[0].fnAmount) }) : t("studioTools.previewNoHigh"));
  if (s.members.on) parts.push(t("studioTools.previewMembers", { count: d.members.length }));
  return t("studioTools.previewBasis", { parts: parts.join(" · ") });
}

/**
 * 방송 도구 — code-first (no Figma frame). Route `/creator/widgets/tools`. The remote for 자막 ·
 * 전광판 · 타이머 · 엔딩 크레딧 · 빙고; each card shows its OBS overlay URL. The server owns every state
 * (the overlay polls it), so this screen only sends changes.
 */
export function BroadcastToolsScreen({ view, overlayKey, switches }: { view: ToolsView; overlayKey: string; switches: Record<OverlayTarget, boolean> }) {
  const router = useRouter();
  const { t } = useI18n();
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
  const [mvpBasis, setMvpBasis] = useState(states.credits.mvpBasis);
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
        setMessage({ tool, tone: "error", text: t("studioTools.saveFailed") });
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
            {meta.emoji} {t(TOOL_TEXT[key][0])}
          </h2>
          <CopyButton value={url} label={t("studioTools.copyOverlayUrl")} className={styles.ghost} />
        </div>
        <p className={styles.muted}>{t(TOOL_TEXT[key][1])}</p>
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
        <h1 className={styles.title}>{t("studioTools.title")}</h1>
        <p className={styles.subtitle}>{t("studioTools.subtitle")}</p>
        <p className={styles.note}>
          <Link href="/creator/widgets">{t("studioTools.backWidgetAlerts")}</Link>
          {t("studioTools.keyNote")}
        </p>
      </header>
      <OverlayOffNotice targets={["subtitle", "marquee", "timer", "credits", "bingo"]} switches={switches} />

      <section className={styles.card} aria-label={t("studioTools.themeAria")}>
        <h2 className={styles.cardTitle}>{t("studioTools.themeTitle")}</h2>
        <p className={styles.note}>{t("studioTools.themeNote")}</p>
        <ThemeChoiceField
          value={toolTheme}
          appearance={view.appearance}
          onChange={(choice: OverlayThemeChoice) => {
            setToolTheme(choice);
            setThemeNote(null);
            startTransition(async () => {
              try {
                const res = await saveToolTheme(choice);
                if (res.status === "SAVED") {
                  setThemeNote({ tone: "ok", text: t("studioTools.themeSaved") });
                  router.refresh();
                } else if (res.status === "UNAUTHORIZED") router.push("/login?role=creator&next=/creator/widgets/tools");
                else setThemeNote({ tone: "error", text: res.message });
              } catch {
                setToolTheme(view.theme);
                setThemeNote({ tone: "error", text: t("studioTools.saveFailed") });
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
            run("subtitle", () => saveSubtitle(subtitle), subtitle.text.trim() ? t("studioTools.subtitleShown") : t("studioTools.subtitleHidden"));
          }}
        >
          <input
            className={styles.input}
            aria-label={t("studioTools.subtitleAria")}
            placeholder={t("studioTools.subtitlePlaceholder")}
            maxLength={SUBTITLE_MAX}
            value={subtitle.text}
            onChange={(e) => setSubtitle((s) => ({ ...s, text: e.target.value }))}
          />
          <div className={styles.cardHead}>
            <span className={styles.segment} role="group" aria-label={t("studioTools.subtitleSize")}>
              {(["S", "M", "L"] as const).map((sz) => (
                <button key={sz} type="button" aria-pressed={subtitle.size === sz} onClick={() => setSubtitle((s) => ({ ...s, size: sz }))}>
                  {t(({ S: "studioTools.sizeS", M: "studioTools.sizeM", L: "studioTools.sizeL" } as const)[sz])}
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
                  run("subtitle", () => saveSubtitle({ ...subtitle, text: "" }), t("studioTools.subtitleHidden"));
                }}
              >
                {t("studioTools.takeDown")}
              </button>
              <button type="submit" className={styles.primary} disabled={pending}>
                {t("studioTools.show")}
              </button>
            </span>
          </div>
          <p className={styles.note}>{t("studioTools.subtitleNow", { text: states.subtitle.text ? `“${states.subtitle.text}”` : t("studioTools.subtitleNone") })}</p>
        </form>
      )}

      {card(
        "marquee",
        <form
          className={styles.startForm}
          onSubmit={(e) => {
            e.preventDefault();
            run("marquee", () => saveMarquee({ lines: lines(marqueeText), speed }), t("studioTools.marqueeSaved"));
          }}
        >
          <textarea
            className={`${styles.input} ${styles.textarea}`}
            aria-label={t("studioTools.marqueeAria")}
            rows={3}
            placeholder={t("studioTools.marqueePlaceholder", { max: MARQUEE_LINES_MAX })}
            value={marqueeText}
            onChange={(e) => setMarqueeText(e.target.value)}
          />
          <div className={styles.cardHead}>
            <span className={styles.segment} role="group" aria-label={t("studioTools.speedAria")}>
              {(["SLOW", "NORMAL", "FAST"] as const).map((sp) => (
                <button key={sp} type="button" aria-pressed={speed === sp} onClick={() => setSpeed(sp)}>
                  {t(({ SLOW: "studioTools.speedSlow", NORMAL: "studioTools.speedNormal", FAST: "studioTools.speedFast" } as const)[sp])}
                </button>
              ))}
            </span>
            <button type="submit" className={styles.primary} disabled={pending}>
              {t("studioTools.save")}
            </button>
          </div>
          <p className={styles.note}>{t("studioTools.marqueeNote")}</p>
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
                  {t("studioTools.pause")}
                </button>
              ) : (
                <button type="button" className={styles.primary} disabled={pending || (mode === "COUNTDOWN" && shown === 0)} onClick={() => timerAction("START")}>
                  {states.timer.elapsedBeforeSec > 0 ? t("studioTools.resume") : t("studioTools.start")}
                </button>
              )}
              <button type="button" className={styles.ghost} disabled={pending} onClick={() => timerAction("RESET")}>
                {t("studioTools.reset")}
              </button>
            </span>
          </div>
          <div className={styles.actions} role="group" aria-label={t("studioTools.quickAdjust")}>
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
              run("timer", () => configureTimer({ mode, durationSec: Math.round(Number(minutes) * 60) }), t("studioTools.timerConfigured"));
            }}
          >
            <span className={styles.segment} role="group" aria-label={t("studioTools.timerMode")}>
              {(["COUNTDOWN", "STOPWATCH"] as const).map((m) => (
                <button key={m} type="button" aria-pressed={mode === m} onClick={() => setMode(m)}>
                  {m === "COUNTDOWN" ? t("studioTools.countdown") : t("studioTools.stopwatch")}
                </button>
              ))}
            </span>
            <input
              className={styles.input}
              type="number"
              min={1}
              max={1440}
              aria-label={mode === "COUNTDOWN" ? t("studioTools.countdownMinutes") : t("studioTools.stopwatchMinutes")}
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
            />
            <span className={styles.muted}>{t("studioTools.minutes")}</span>
            <button type="submit" className={styles.ghost} disabled={pending}>
              {t("studioTools.applySettings")}
            </button>
          </form>
          <form
            className={styles.addRow}
            onSubmit={(e) => {
              e.preventDefault();
              const sec = Math.floor(Number(donationSec) || 0);
              run("timer", () => setTimerDonationLink(sec), sec ? t("studioTools.donationLinkOn", { sec }) : t("studioTools.donationLinkOff"));
            }}
          >
            <span className={styles.muted}>{t("studioTools.donationLinkLabel")}</span>
            <input
              className={styles.inputSmall}
              type="number"
              min={0}
              max={TIMER_DONATION_SEC_MAX}
              aria-label={t("studioTools.donationSecAria")}
              value={donationSec}
              onChange={(e) => setDonationSec(e.target.value)}
            />
            <span className={styles.muted}>{t("studioTools.addSeconds")}</span>
            <button type="submit" className={styles.ghost} disabled={pending || Math.floor(Number(donationSec) || 0) === states.timer.donationSec}>
              {t("studioTools.save")}
            </button>
          </form>
          <p className={styles.note}>
            {states.timer.donationSec > 0
              ? t("studioTools.timerLinkedNote", { sec: states.timer.donationSec, example: states.timer.donationSec * 5 })
              : t("studioTools.timerUnlinkedNote")}
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
              () => saveCredits({ title: creditsTitle, thanks: lines(thanks), style: creditsStyle, durationSec: Number(creditsSec), period: creditsPeriod, mvpBasis, sections }),
              t("studioTools.creditsSaved")
            );
          }}
        >
          <input className={styles.input} aria-label={t("studioTools.creditsTitleAria")} value={creditsTitle} onChange={(e) => setCreditsTitle(e.target.value)} />
          <div className={styles.addRow}>
            <span className={styles.segment} role="group" aria-label={t("studioTools.creditsStyleAria")}>
              {CREDITS_STYLES.map((x) => (
                <button key={x.key} type="button" aria-pressed={creditsStyle === x.key} onClick={() => setCreditsStyle(x.key)}>
                  {t(STYLE_KEY[x.key])}
                </button>
              ))}
            </span>
            <input
              className={styles.inputSmall}
              type="number"
              min={CREDITS_DURATION_MIN}
              max={CREDITS_DURATION_MAX}
              aria-label={t("studioTools.scrollSecAria")}
              value={creditsSec}
              onChange={(e) => setCreditsSec(e.target.value)}
            />
            <span className={styles.muted}>{t("studioTools.scrollSecUnit")}</span>
          </div>
          <div className={styles.addRow}>
            <span className={styles.muted}>{t("studioTools.period")}</span>
            <span className={styles.segment} role="group" aria-label={t("studioTools.period")}>
              {CREDITS_PERIODS.map((x) => (
                <button key={x.key} type="button" aria-pressed={creditsPeriod === x.key} onClick={() => setCreditsPeriod(x.key)}>
                  {t(PERIOD_KEY[x.key])}
                </button>
              ))}
            </span>
            {creditsPeriod === "CREW" && (
              <>
                <span className={styles.muted}>{t("studioTools.mvpBasis")}</span>
                <span className={styles.segment} role="group" aria-label={t("studioTools.mvpBasis")}>
                  {CREDITS_MVP_BASES.map((x) => (
                    <button key={x.key} type="button" aria-pressed={mvpBasis === x.key} onClick={() => setMvpBasis(x.key)}>
                      {t(MVP_KEY[x.key])}
                    </button>
                  ))}
                </span>
              </>
            )}
          </div>
          <p className={styles.note}>
            {creditsPeriod === "TODAY"
              ? t("studioTools.periodTodayNote")
              : t("studioTools.periodCrewNote", { basis: mvpBasis === "AMOUNT" ? t("studioTools.mvpBasisAmountNote") : t("studioTools.mvpBasisPointsNote") })}{" "}
            {t("studioTools.donorNamesNote")}
          </p>
          <ul className={tools.sections} aria-label={t("studioTools.sectionsAria")}>
            {CREDITS_SECTIONS.map((meta) => {
              const x = sections[meta.key];
              const set = (patch: Partial<typeof x>) => setSections((prev) => ({ ...prev, [meta.key]: { ...prev[meta.key], ...patch } }));
              return (
                <li key={meta.key}>
                  <label className={styles.checkRow}>
                    <input type="checkbox" checked={x.on} onChange={(e) => set({ on: e.target.checked })} />
                    {t(SECTION_KEY[meta.key])}
                  </label>
                  <input
                    className={styles.input}
                    aria-label={t("studioTools.sectionTitleAria", { label: t(SECTION_KEY[meta.key]) })}
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
                        aria-label={t(meta.unit === "개" ? "studioTools.sectionItemsAria" : "studioTools.sectionPeopleAria", { label: t(SECTION_KEY[meta.key]) })}
                        value={x.max}
                        disabled={!x.on}
                        onChange={(e) => set({ max: Math.max(1, Math.min(CREDITS_LIST_MAX, Math.floor(Number(e.target.value) || 1))) })}
                      />
                      <span className={styles.muted}>{t(meta.unit === "개" ? "studioTools.unitItems" : "studioTools.unitPeople")}</span>
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
            aria-label={t("studioTools.thanksAria")}
            rows={3}
            placeholder={t("studioTools.thanksPlaceholder", { max: CREDITS_LINES_MAX })}
            value={thanks}
            onChange={(e) => setThanks(e.target.value)}
          />
          <p className={styles.note}>{creditsPreview(view.credits, states.credits.sections, t)}</p>
          <div className={styles.actions}>
            <span className={styles.muted}>{states.credits.rollingSince ? t("studioTools.rolling") : t("studioTools.idle")}</span>
            <button
              type="button"
              className={styles.ghost}
              disabled={pending}
              onClick={() => run("credits", () => controlCredits(states.credits.rollingSince ? "STOP" : "START"), states.credits.rollingSince ? t("studioTools.creditsStopped") : t("studioTools.creditsStarted"))}
            >
              {states.credits.rollingSince ? t("studioTools.stopCredits") : t("studioTools.startCredits")}
            </button>
            <button type="submit" className={styles.primary} disabled={pending}>
              {t("studioTools.save")}
            </button>
          </div>
        </form>
      )}

      {card("bingo", <BingoTool state={states.bingo} pending={pending} run={(action, ok) => run("bingo", action, ok)} />)}

      {card("wheel", <WheelTool state={states.wheel} signatures={view.signatures} pending={pending} run={(action, ok) => run("wheel", action, ok)} />)}

      {card(
        "text",
        <TextSlotsTool slots={states.text.slots} overlayUrl={(slot) => `${origin}${view.overlayBase}/text/${overlayKey}?slot=${slot}`} pending={pending} run={(action, ok) => run("text", action, ok)} />
      )}
    </div>
  );
}
