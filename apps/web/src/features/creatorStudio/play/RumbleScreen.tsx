"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { useServerClock } from "@/hooks/useServerClock";
import { formatKstTime } from "@/lib/format";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { platformLabel } from "@/lib/i18n/platformLabel";
import type { OverlayTarget } from "@/services/creator/alertTypes";
import type { PlaySource } from "@/services/play/playTypes";
import { addRumble, closeRumble, openRumble, removeRumble, saveRumble, startRumble } from "@/services/play/rumble";
import {
  RUMBLE_BATTLE_MAX_SEC,
  RUMBLE_BATTLE_MIN_SEC,
  RUMBLE_FILL_MAX,
  RUMBLE_KEYWORD_MAX,
  RUMBLE_NAME_MAX,
  RUMBLE_PLAYERS_MAX,
  RUMBLE_PLAYERS_MIN,
  RUMBLE_TITLE_DEFAULT,
  RUMBLE_TITLE_MAX,
  rumbleBots,
  rumbleStandings,
  type RumbleResult,
  type RumbleSettings,
  type RumbleView
} from "@/services/play/rumbleTypes";
import { shownOverlayAddress } from "../crew/overlayAddress";
import styles from "../crew/crew.module.css";
import prize from "../crew/prize.module.css";
import { OverlayOffNotice } from "../remote/OverlayOffNotice";
import { CopyButton } from "../settings/SettingsCards";
import { PlayTabs } from "./PlayTabs";
import play from "./play.module.css";

/** The form keeps numbers as typed. */
type Draft = Omit<RumbleSettings, "maxPlayers" | "fillTo" | "battleSec"> & { maxPlayers: string; fillTo: string; battleSec: string };
const toDraft = (s: RumbleSettings): Draft => ({ ...s, maxPlayers: String(s.maxPlayers), fillTo: String(s.fillTo), battleSec: String(s.battleSec) });
const fromDraft = (d: Draft): RumbleSettings => ({ ...d, title: d.title.trim(), keyword: d.keyword.trim(), maxPlayers: Number(d.maxPlayers), fillTo: Number(d.fillTo), battleSec: Number(d.battleSec) });
type T = ReturnType<typeof useI18n>["t"];
const sourceLabel = (s: PlaySource, t: T) => (s === "INVITE" ? t("studioPlay.sourceInvite") : s === "MANUAL" ? t("studioPlay.sourceManual") : platformLabel(s, t));

/**
 * 시청자 참여 게임 › 로얄 럼블 — code-first (no Figma frame; StreamDonate 로얄 럼블 참고, P2). Route
 * `/creator/widgets/play/rumble`: settings (명령어 · 최대 인원 · 봇 채우기 · 배틀 시간 · 링 축소 · 서든데스), the round (참가 모집 →
 * 배틀 → 결과: chat entries come in on the 3-second refresh, 직접 추가 · 빼기; the 순위 shows once the battle is over),
 * 회차별 결과 and the OBS address. Free: no FN or points.
 */
export function RumbleScreen({ view, switches }: { view: RumbleView; switches: Record<OverlayTarget, boolean> }) {
  const { t } = useI18n();
  const router = useRouter();
  const [message, setMessage] = useState<{ tone: "error" | "ok"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const now = useServerClock(view.serverNow);
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  const { settings, round } = view;

  // A newer saved value (another tab, a refresh) replaces the draft; edits stay until saved.
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

  // Entries and the battle move on their own while a round is on.
  const active = round && round.status !== "DONE";
  useEffect(() => {
    if (!active) return;
    const poll = setInterval(() => router.refresh(), 3000);
    return () => clearInterval(poll);
  }, [active, router]);

  const openId = useRef<string | null>(null);
  const startId = useRef<string | null>(null);
  const [name, setName] = useState("");

  const run = (action: () => Promise<RumbleResult>, ok?: string, after?: () => void) => {
    setMessage(null);
    startTransition(async () => {
      const res = await action();
      if (res.status === "SAVED") {
        after?.();
        if (ok) setMessage({ tone: "ok", text: ok });
        router.refresh();
      } else if (res.status === "UNAUTHORIZED") router.push("/login?role=creator&next=/creator/widgets/play/rumble");
      else setMessage({ tone: "error", text: res.message });
    });
  };
  const open = () => {
    openId.current ??= crypto.randomUUID();
    const requestId = openId.current;
    run(() => openRumble({ requestId }), t("studioPlay.recruitStarted"), () => (openId.current = null));
  };
  const start = () => {
    if (!round) return;
    startId.current ??= crypto.randomUUID();
    const requestId = startId.current;
    run(() => startRumble({ roundId: round.id, requestId }), t("studioPlay.battleStarted"), () => (startId.current = null));
  };

  const battle = round?.battle ?? null;
  const left = battle && now !== null ? Math.max(0, Math.ceil((Date.parse(battle.endAt) - now) / 1000)) : 0;
  const bots = battle ? battle.fighters.filter((f) => f.bot).length : round ? rumbleBots(round.entrants.length, round.fillTo) : 0;
  const fighterName = (id: string | null) => battle?.fighters.find((f) => f.id === id)?.name ?? "";

  return (
    <div className={styles.content}>
      <header className={styles.header}>
        <h1 className={styles.title}>{t("studioPlay.pageTitle")}</h1>
        <p className={styles.subtitle}>{t("studioPlay.pageSubtitle")}</p>
      </header>
      <OverlayOffNotice targets={["play"]} switches={switches} />
      <PlayTabs active="rumble" />

      {message && (
        <p className={message.tone === "error" ? styles.error : styles.ok} role={message.tone === "error" ? "alert" : "status"}>
          {message.text}
        </p>
      )}

      <section className={styles.card} aria-labelledby="rumble-title">
        <h2 id="rumble-title" className={styles.cardTitle}>
          {t("studioPlay.rumble")}
        </h2>
        <p className={styles.note}>{t("studioPlay.rumbleIntro")}</p>
        <form
          className={prize.form}
          onSubmit={(e) => {
            e.preventDefault();
            run(() => saveRumble(fromDraft(draft)), t("studioPlay.rumbleSaved"));
          }}
        >
          <div className={prize.field}>
            <span className={styles.muted}>{t("studioPlay.titleLabel")}</span>
            <input className={styles.input} aria-label={t("studioPlay.rumbleTitleAria")} placeholder={RUMBLE_TITLE_DEFAULT} maxLength={RUMBLE_TITLE_MAX} value={draft.title} onChange={(e) => edit({ title: e.target.value })} />
          </div>
          <div className={prize.field}>
            <span className={styles.muted}>{t("studioPlay.joinCommand")}</span>
            <span className={play.unit}>
              <input className={styles.inputSmall} aria-label={t("studioPlay.joinCommand")} maxLength={RUMBLE_KEYWORD_MAX} value={draft.keyword} onChange={(e) => edit({ keyword: e.target.value })} />
            </span>
            <span className={styles.note}>
              {t("studioPlay.chatNoteBefore")}
              <Link href="/creator/chat">{t("studioPlay.unifiedChat")}</Link>
              {t("studioPlay.chatNoteAfter")}
            </span>
          </div>
          <div className={play.row}>
            <label className={play.unit}>
              <span className={styles.muted}>{t("studioPlay.maxPlayers")}</span>
              <input
                className={styles.inputSmall}
                type="number"
                inputMode="numeric"
                aria-label={t("studioPlay.maxPlayers")}
                min={RUMBLE_PLAYERS_MIN}
                max={RUMBLE_PLAYERS_MAX}
                value={draft.maxPlayers}
                onChange={(e) => edit({ maxPlayers: e.target.value })}
              />
              <span className={styles.muted}>{t("studioPlay.peopleRange", { min: RUMBLE_PLAYERS_MIN, max: RUMBLE_PLAYERS_MAX })}</span>
            </label>
            <label className={play.unit}>
              <span className={styles.muted}>{t("studioPlay.battle")}</span>
              <input
                className={styles.inputSmall}
                type="number"
                inputMode="numeric"
                aria-label={t("studioPlay.battleTime")}
                min={RUMBLE_BATTLE_MIN_SEC}
                max={RUMBLE_BATTLE_MAX_SEC}
                value={draft.battleSec}
                onChange={(e) => edit({ battleSec: e.target.value })}
              />
              <span className={styles.muted}>{t("studioPlay.secRange", { min: RUMBLE_BATTLE_MIN_SEC, max: RUMBLE_BATTLE_MAX_SEC })}</span>
            </label>
          </div>
          <label className={play.unit}>
            <span className={styles.muted}>{t("studioPlay.botFill")}</span>
            <input
              className={styles.inputSmall}
              type="number"
              inputMode="numeric"
              aria-label={t("studioPlay.botFill")}
              min={0}
              max={RUMBLE_FILL_MAX}
              value={draft.fillTo}
              onChange={(e) => edit({ fillTo: e.target.value })}
            />
            <span className={styles.muted}>{t("studioPlay.botFillUnit")}</span>
          </label>
          <label className={styles.checkRow}>
            <input type="checkbox" checked={draft.ringShrink} onChange={(e) => edit({ ringShrink: e.target.checked })} />
            {t("studioPlay.ringShrink")}
          </label>
          <label className={styles.checkRow}>
            <input type="checkbox" checked={draft.suddenDeath} onChange={(e) => edit({ suddenDeath: e.target.checked })} />
            {t("studioPlay.suddenDeath")}
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

      <section className={styles.card} aria-labelledby="rumble-round-title">
        <h2 id="rumble-round-title" className={styles.cardTitle}>
          {t("studioPlay.progress")}
        </h2>
        {!round && (
          <div className={prize.window}>
            <span className={styles.muted}>{t("studioPlay.noRound")}</span>
            <button type="button" className={styles.primary} disabled={pending} onClick={open}>
              {t("studioPlay.startRecruit")}
            </button>
          </div>
        )}
        {round && (
          <>
            <div className={prize.window}>
              <span className={styles.muted}>
                {t("studioPlay.roundNo", { no: round.no })} ·{" "}
                {round.status === "OPEN" ? t("studioPlay.recruiting") : round.status === "FIGHTING" ? t("studioPlay.fighting", { left }) : t("studioPlay.result")} ·{" "}
                {t("studioPlay.players", { count: round.entrants.length, max: round.maxPlayers })}
                {bots > 0 && t("studioPlay.bots", { n: bots })}
              </span>
              {round.status === "OPEN" && (
                <button type="button" className={styles.primary} disabled={pending || round.entrants.length < RUMBLE_PLAYERS_MIN} onClick={start}>
                  {t("studioPlay.startBattle")}
                </button>
              )}
              {round.status === "DONE" && (
                <button type="button" className={styles.primary} disabled={pending} onClick={open}>
                  {t("studioPlay.nextRound")}
                </button>
              )}
              {round.status !== "FIGHTING" && (
                <button
                  type="button"
                  className={styles.ghost}
                  disabled={pending}
                  onClick={() => run(() => closeRumble({ roundId: round.id }), round.status === "OPEN" ? t("studioPlay.recruitCancelled") : t("studioPlay.roundClosed"))}
                >
                  {round.status === "OPEN" ? t("studioPlay.cancelRecruit") : t("studioPlay.closeRound")}
                </button>
              )}
            </div>
            {round.status === "OPEN" && (
              <>
                <p className={styles.note}>
                  {t("studioPlay.chatJoinBefore")}
                  <strong>{round.keyword}</strong>
                  {t("studioPlay.chatJoinAfter", { min: RUMBLE_PLAYERS_MIN })}
                </p>
                <form
                  className={styles.addRow}
                  onSubmit={(e) => {
                    e.preventDefault();
                    run(() => addRumble({ roundId: round.id, name }), undefined, () => setName(""));
                  }}
                >
                  <input
                    className={styles.input}
                    aria-label={t("studioPlay.addNameAria")}
                    placeholder={t("studioPlay.addNamePlaceholder")}
                    maxLength={RUMBLE_NAME_MAX}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                  <button type="submit" className={styles.ghost} disabled={pending || !name.trim()}>
                    {t("studioPlay.add")}
                  </button>
                </form>
              </>
            )}
            {round.status !== "DONE" || !battle ? (
              round.entrants.length > 0 ? (
                <ul className={play.entrants} aria-label={t("studioPlay.entrantsAria")}>
                  {round.entrants.map((e) => (
                    <li key={e.id}>
                      {e.name}
                      <span className={styles.muted}>{sourceLabel(e.source, t)}</span>
                      {round.status === "OPEN" && (
                        <button type="button" aria-label={t("studioPlay.removeAria", { name: e.name })} disabled={pending} onClick={() => run(() => removeRumble({ roundId: round.id, entrantId: e.id }))}>
                          ✕
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className={styles.empty}>{t("studioPlay.noEntrants")}</p>
              )
            ) : (
              <ol className={play.results} aria-label={t("studioPlay.standingsAria")}>
                {rumbleStandings(battle).map((s) => (
                  <li key={s.id} data-win={s.rank === 1 || undefined}>
                    <span className={styles.muted}>{t("studioPlay.rankN", { rank: s.rank })}</span>
                    <span className={play.who}>
                      <strong>{s.name}</strong>
                      <span className={styles.muted}>
                        {t("studioPlay.kills", { n: s.kills })}
                        {s.out && ` · ${s.out.killerId ? t("studioPlay.outBy", { name: fighterName(s.out.killerId) }) : t("studioPlay.outRing")}`}
                      </span>
                    </span>
                    {s.rank === 1 && <span className={play.badge}>{t("studioPlay.winner")}</span>}
                  </li>
                ))}
              </ol>
            )}
          </>
        )}
      </section>

      <section className={styles.card} aria-labelledby="rumble-history-title">
        <h2 id="rumble-history-title" className={styles.cardTitle}>
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
                <span>
                  {t("studioPlay.historyPlayers", { count: h.players })}
                  {h.bots > 0 && t("studioPlay.historyBots", { n: h.bots })}
                  {h.topKiller && t("studioPlay.topKiller", { name: h.topKiller.name, n: h.topKiller.kills })}
                </span>
                <strong>
                  🏆 {h.winner} <span className={styles.muted}>{t("studioPlay.kills", { n: h.kills })}</span>
                </strong>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className={styles.card} aria-labelledby="rumble-obs-title">
        <h2 id="rumble-obs-title" className={styles.cardTitle}>
          {t("studioPlay.obsAddress")}
        </h2>
        <p className={styles.note}>{t("studioPlay.rumbleObsNote")}</p>
        <div className={styles.addRow}>
          <input
            className={styles.input}
            value={shownOverlayAddress(origin, view.overlayPath, "?rumble")}
            readOnly
            aria-label={t("studioPlay.rumbleOverlayAria")}
            onFocus={(e) => e.target.select()}
          />
          <CopyButton value={`${origin}${view.overlayPath}?rumble`} className={styles.ghost} />
        </div>
      </section>
    </div>
  );
}
