"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type CSSProperties } from "react";
import { useServerClock } from "@/hooks/useServerClock";
import { formatKstTime } from "@/lib/format";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { OverlayTarget } from "@/services/creator/alertTypes";
import { closeLiveRound, kickLivePlayer, openLive, saveLive, startLiveBattle } from "@/services/play/rumbleLive";
import {
  LIVE_BATTLE_MAX_SEC,
  LIVE_BATTLE_MIN_SEC,
  LIVE_PLAYERS_MAX,
  LIVE_PLAYERS_MIN,
  LIVE_TITLE_DEFAULT,
  LIVE_TITLE_MAX,
  type LiveResult,
  type LiveSettings,
  type LiveView
} from "@/services/play/rumbleLiveTypes";
import { shownOverlayAddress } from "../crew/overlayAddress";
import styles from "../crew/crew.module.css";
import prize from "../crew/prize.module.css";
import { OverlayOffNotice } from "../remote/OverlayOffNotice";
import { CopyButton } from "../settings/SettingsCards";
import { LIVE_COLORS } from "./playOverlayClock";
import { PlayTabs } from "./PlayTabs";
import play from "./play.module.css";

/** The form keeps numbers as typed. */
type Draft = Omit<LiveSettings, "maxPlayers" | "battleSec"> & { maxPlayers: string; battleSec: string };
const toDraft = (s: LiveSettings): Draft => ({ ...s, maxPlayers: String(s.maxPlayers), battleSec: String(s.battleSec) });
const fromDraft = (d: Draft): LiveSettings => ({ ...d, title: d.title.trim(), maxPlayers: Number(d.maxPlayers), battleSec: Number(d.battleSec) });

/**
 * 시청자 참여 게임 › 로얄 럼블 (조작형) — code-first (no Figma frame; StreamDonate 참고, P2). Route `/creator/widgets/play/live`.
 * Settings (제목 · 최대 인원 · 배틀 시간 · 링 축소), the round (참가 모집: the link to share + who joined (빼기) → 배틀 시작 →
 * 배틀 중 → 결과 순위), 회차별 결과 and the OBS address. Free: no FN or points.
 */
export function RumbleLiveScreen({ view, switches }: { view: LiveView; switches: Record<OverlayTarget, boolean> }) {
  const { t } = useI18n();
  const router = useRouter();
  const [message, setMessage] = useState<{ tone: "error" | "ok"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const now = useServerClock(view.serverNow);
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  const { settings, round } = view;

  const [draft, setDraft] = useState(() => toDraft(settings));
  const synced = useRef(JSON.stringify(settings));
  useEffect(() => {
    const next = JSON.stringify(settings);
    if (next !== synced.current) {
      synced.current = next;
      setDraft(toDraft(settings));
    }
  }, [settings]);
  const edit = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));
  const dirty = JSON.stringify(fromDraft(draft)) !== synced.current;

  // Joins and the battle move on their own while a round is on.
  const active = round && round.phase !== "DONE";
  useEffect(() => {
    if (!active) return;
    const poll = setInterval(() => router.refresh(), round?.phase === "OPEN" ? 3000 : 1000);
    return () => clearInterval(poll);
  }, [active, round?.phase, router]);

  const openId = useRef<string | null>(null);
  const startId = useRef<string | null>(null);
  const run = (action: () => Promise<LiveResult>, ok?: string, after?: () => void) => {
    setMessage(null);
    startTransition(async () => {
      const res = await action();
      if (res.status === "SAVED") {
        after?.();
        if (ok) setMessage({ tone: "ok", text: ok });
        router.refresh();
      } else if (res.status === "UNAUTHORIZED") router.push("/login?role=creator&next=/creator/widgets/play/live");
      else setMessage({ tone: "error", text: res.message });
    });
  };
  const open = () => {
    openId.current ??= crypto.randomUUID();
    const requestId = openId.current;
    run(() => openLive({ requestId }), t("studioPlay.liveRecruitStarted"), () => (openId.current = null));
  };
  const start = () => {
    if (!round) return;
    startId.current ??= crypto.randomUUID();
    const requestId = startId.current;
    run(() => startLiveBattle({ roundId: round.id, requestId }), t("studioPlay.liveBattleStarted"), () => (startId.current = null));
  };

  const left = round?.startAt && now !== null ? Math.max(0, Math.ceil((Date.parse(round.startAt) + round.battleSec * 1000 - now) / 1000)) : 0;
  const link = round ? `${origin}${round.invitePath}` : "";
  const color = (c: number) => LIVE_COLORS[c % LIVE_COLORS.length];
  const phaseText = !round
    ? ""
    : round.phase === "OPEN"
      ? t("studioPlay.recruiting")
      : round.phase === "COUNTDOWN"
        ? t("studioPlay.countdown")
        : round.phase === "FIGHTING"
          ? t("studioPlay.liveFighting", { alive: round.alive, left })
          : t("studioPlay.result");

  return (
    <div className={styles.content}>
      <header className={styles.header}>
        <h1 className={styles.title}>{t("studioPlay.pageTitle")}</h1>
        <p className={styles.subtitle}>{t("studioPlay.pageSubtitle")}</p>
      </header>
      <OverlayOffNotice targets={["play"]} switches={switches} />
      <PlayTabs active="live" />

      {message && (
        <p className={message.tone === "error" ? styles.error : styles.ok} role={message.tone === "error" ? "alert" : "status"}>
          {message.text}
        </p>
      )}

      <section className={styles.card} aria-labelledby="live-title">
        <h2 id="live-title" className={styles.cardTitle}>
          {t("studioPlay.liveTitle")}
        </h2>
        <p className={styles.note}>{t("studioPlay.liveIntro")}</p>
        <form
          className={prize.form}
          onSubmit={(e) => {
            e.preventDefault();
            run(() => saveLive(fromDraft(draft)), t("studioPlay.liveSaved"));
          }}
        >
          <div className={prize.field}>
            <span className={styles.muted}>{t("studioPlay.titleLabel")}</span>
            <input className={styles.input} aria-label={t("studioPlay.liveTitleAria")} placeholder={LIVE_TITLE_DEFAULT} maxLength={LIVE_TITLE_MAX} value={draft.title} onChange={(e) => edit({ title: e.target.value })} />
          </div>
          <div className={play.row}>
            <label className={play.unit}>
              <span className={styles.muted}>{t("studioPlay.maxPlayers")}</span>
              <input
                className={styles.inputSmall}
                type="number"
                inputMode="numeric"
                aria-label={t("studioPlay.maxPlayers")}
                min={LIVE_PLAYERS_MIN}
                max={LIVE_PLAYERS_MAX}
                value={draft.maxPlayers}
                onChange={(e) => edit({ maxPlayers: e.target.value })}
              />
              <span className={styles.muted}>{t("studioPlay.peopleRange", { min: LIVE_PLAYERS_MIN, max: LIVE_PLAYERS_MAX })}</span>
            </label>
            <label className={play.unit}>
              <span className={styles.muted}>{t("studioPlay.battle")}</span>
              <input
                className={styles.inputSmall}
                type="number"
                inputMode="numeric"
                aria-label={t("studioPlay.battleTime")}
                min={LIVE_BATTLE_MIN_SEC}
                max={LIVE_BATTLE_MAX_SEC}
                value={draft.battleSec}
                onChange={(e) => edit({ battleSec: e.target.value })}
              />
              <span className={styles.muted}>{t("studioPlay.secRange", { min: LIVE_BATTLE_MIN_SEC, max: LIVE_BATTLE_MAX_SEC })}</span>
            </label>
          </div>
          <label className={styles.checkRow}>
            <input type="checkbox" checked={draft.ringShrink} onChange={(e) => edit({ ringShrink: e.target.checked })} />
            {t("studioPlay.liveRingShrink")}
          </label>
          <p className={styles.note}>{t("studioPlay.appliesNext")}</p>
          <div className={styles.actions}>
            <button type="button" className={styles.ghost} disabled={pending || !dirty} onClick={() => setDraft(toDraft(settings))}>
              {t("studioPlay.revert")}
            </button>
            <button type="submit" className={styles.primary} disabled={pending || !dirty}>
              {t("studioPlay.saveSettings")}
            </button>
          </div>
        </form>
      </section>

      <section className={styles.card} aria-labelledby="live-round-title">
        <h2 id="live-round-title" className={styles.cardTitle}>
          {t("studioPlay.progress")}
        </h2>
        {!round && (
          <div className={prize.window}>
            <span className={styles.muted}>{t("studioPlay.liveNoRound")}</span>
            <button type="button" className={styles.primary} disabled={pending} onClick={open}>
              {t("studioPlay.startRecruit")}
            </button>
          </div>
        )}
        {round && (
          <>
            <div className={prize.window}>
              <span className={styles.muted}>
                {t("studioPlay.roundNo", { no: round.no })} · {phaseText} · {t("studioPlay.players", { count: round.players.length, max: round.maxPlayers })}
              </span>
              {round.phase === "OPEN" && (
                <button type="button" className={styles.primary} disabled={pending || round.players.length < LIVE_PLAYERS_MIN} onClick={start}>
                  {t("studioPlay.startBattle")}
                </button>
              )}
              {round.phase === "DONE" && (
                <button type="button" className={styles.primary} disabled={pending} onClick={open}>
                  {t("studioPlay.nextRound")}
                </button>
              )}
              {(round.phase === "OPEN" || round.phase === "DONE") && (
                <button
                  type="button"
                  className={styles.ghost}
                  disabled={pending}
                  onClick={() => run(() => closeLiveRound({ roundId: round.id }), round.phase === "OPEN" ? t("studioPlay.recruitCancelled") : t("studioPlay.roundClosed"))}
                >
                  {round.phase === "OPEN" ? t("studioPlay.cancelRecruit") : t("studioPlay.closeRound")}
                </button>
              )}
            </div>
            {round.phase !== "DONE" && (
              <>
                <div className={styles.addRow}>
                  <input className={styles.input} value={link} readOnly aria-label={t("studioPlay.joinLinkAria")} onFocus={(e) => e.target.select()} />
                  <CopyButton value={link} className={styles.ghost} />
                </div>
                <p className={styles.note}>{t("studioPlay.liveJoinNote", { min: LIVE_PLAYERS_MIN })}</p>
              </>
            )}
            {round.phase === "DONE" && round.standings ? (
              <ol className={play.results} aria-label={t("studioPlay.standingsAria")}>
                {round.standings.map((s) => (
                  <li key={s.id} data-win={s.rank === 1 || undefined}>
                    <span className={styles.muted}>{t("studioPlay.rankN", { rank: s.rank })}</span>
                    <span className={play.who}>
                      <strong style={{ color: color(s.color) } as CSSProperties}>{s.name}</strong>
                      <span className={styles.muted}>
                        {t("studioPlay.kills", { n: s.kills })} ·{" "}
                        {/* "링 밖" is how the server names a ring-out (rumbleLiveCore). */}
                        {s.outBy ? (s.outBy === "링 밖" ? t("studioPlay.outRing") : t("studioPlay.outBy", { name: s.outBy })) : t("studioPlay.hp", { hp: s.hp })}
                      </span>
                    </span>
                    {s.rank === 1 && <span className={play.badge}>{t("studioPlay.winner")}</span>}
                  </li>
                ))}
              </ol>
            ) : round.players.length > 0 ? (
              <ul className={play.entrants} aria-label={t("studioPlay.entrantsAria")}>
                {round.players.map((p) => (
                  <li key={p.id} style={{ borderColor: color(p.color) } as CSSProperties}>
                    {p.name}
                    {round.phase === "OPEN" && (
                      <button type="button" aria-label={t("studioPlay.removeAria", { name: p.name })} disabled={pending} onClick={() => run(() => kickLivePlayer({ roundId: round.id, playerId: p.id }))}>
                        ✕
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.empty}>{t("studioPlay.noEntrants")}</p>
            )}
          </>
        )}
      </section>

      <section className={styles.card} aria-labelledby="live-history-title">
        <h2 id="live-history-title" className={styles.cardTitle}>
          {t("studioPlay.history")}
        </h2>
        {view.history.length === 0 ? (
          <p className={styles.empty}>{t("studioPlay.noHistory")}</p>
        ) : (
          <ol className={play.history}>
            {view.history.map((h) => (
              <li key={h.no}>
                <span className={styles.muted}>{t("studioPlay.roundNo", { no: h.no })}</span>
                <span className={styles.muted}>{formatKstTime(h.at, { hour: "2-digit", minute: "2-digit" })}</span>
                <span>{t("studioPlay.historyPlayers", { count: h.players })}</span>
                <strong>
                  🏆 {h.winner} <span className={styles.muted}>{t("studioPlay.kills", { n: h.kills })}</span>
                </strong>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className={styles.card} aria-labelledby="live-obs-title">
        <h2 id="live-obs-title" className={styles.cardTitle}>
          {t("studioPlay.obsAddress")}
        </h2>
        <p className={styles.note}>{t("studioPlay.liveObsNote")}</p>
        <div className={styles.addRow}>
          <input
            className={styles.input}
            value={shownOverlayAddress(origin, view.overlayPath, "?rumblelive")}
            readOnly
            aria-label={t("studioPlay.liveOverlayAria")}
            onFocus={(e) => e.target.select()}
          />
          <CopyButton value={`${origin}${view.overlayPath}?rumblelive`} className={styles.ghost} />
        </div>
      </section>
    </div>
  );
}
