"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { useServerClock } from "@/hooks/useServerClock";
import { formatKstTime } from "@/lib/format";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { platformLabel } from "@/lib/i18n/platformLabel";
import type { MessageKey } from "@/lib/i18n/translate";
import type { OverlayTarget } from "@/services/creator/alertTypes";
import { addMarble, closeMarble, openMarble, removeMarble, saveMarble, startMarble } from "@/services/play/marble";
import {
  MARBLE_KEYWORD_MAX,
  MARBLE_MAPS,
  MARBLE_MODES,
  MARBLE_NAME_MAX,
  MARBLE_PLAYERS_MAX,
  MARBLE_PLAYERS_MIN,
  MARBLE_RACE_MAX_SEC,
  MARBLE_RACE_MIN_SEC,
  MARBLE_TITLE_DEFAULT,
  MARBLE_TITLE_MAX,
  MARBLE_WIN_RULES,
  type MarbleMap,
  type MarbleMode,
  type MarbleResult,
  type MarbleSettings,
  type MarbleSource,
  type MarbleView,
  type MarbleWinRule
} from "@/services/play/marbleTypes";
import { shownOverlayAddress } from "../crew/overlayAddress";
import styles from "../crew/crew.module.css";
import prize from "../crew/prize.module.css";
import { OverlayOffNotice } from "../remote/OverlayOffNotice";
import { CopyButton } from "../settings/SettingsCards";
import { PlayTabs } from "./PlayTabs";
import play from "./play.module.css";

/** The form keeps numbers as typed. */
type Draft = Omit<MarbleSettings, "maxPlayers" | "winRank" | "raceSec"> & { maxPlayers: string; winRank: string; raceSec: string };
const toDraft = (s: MarbleSettings): Draft => ({ ...s, maxPlayers: String(s.maxPlayers), winRank: String(s.winRank), raceSec: String(s.raceSec) });
const fromDraft = (d: Draft): MarbleSettings => ({ ...d, title: d.title.trim(), keyword: d.keyword.trim(), maxPlayers: Number(d.maxPlayers), winRank: Number(d.winRank), raceSec: Number(d.raceSec) });
type T = ReturnType<typeof useI18n>["t"];
const sourceLabel = (s: MarbleSource, t: T) => (s === "INVITE" ? t("studioPlay.sourceInvite") : s === "MANUAL" ? t("studioPlay.sourceManual") : platformLabel(s, t));
/** MARBLE_MODES · MARBLE_MAPS · MARBLE_WIN_RULES labels in the viewer's language (2026-11-01). */
const MODE_KEYS: Record<MarbleMode, MessageKey> = { CHAT: "studioPlay.modeChat", INVITE: "studioPlay.modeInvite" };
const MAP_KEYS: Record<MarbleMap, MessageKey> = { PINS: "studioPlay.mapPins", ZIGZAG: "studioPlay.mapZigzag", SPIRAL: "studioPlay.mapSpiral", STAIRS: "studioPlay.mapStairs" };
const WIN_KEYS: Record<MarbleWinRule, MessageKey> = { FIRST: "studioPlay.winFirst", LAST: "studioPlay.winLast", RANK: "studioPlay.winRank" };
/** The 당첨 rule as the server writes it (marbleRuleLabel: "1등" · "꼴등" · "3등"), in the viewer's language; anything else shows as written. */
const ruleText = (rule: string, t: T) =>
  rule === "1등" ? t("studioPlay.winFirst") : rule === "꼴등" ? t("studioPlay.winLast") : /^\d+등$/.test(rule) ? t("studioPlay.rankN", { rank: parseInt(rule, 10) }) : rule;

/**
 * 시청자 참여 게임 — code-first (no Figma frame; StreamDonate 마블 룰렛 참고, P2). Route `/creator/widgets/play`. 마블 룰렛:
 * settings (참가 방식 · 명령어 · 최대 인원 · 맵 · 당첨 · 레이스 시간 · 스킬), the round (참가 모집 → 레이스 → 결과: chat and
 * 초대 링크 entries come in on the 3-second refresh, 직접 추가 · 빼기), 회차별 결과 and the OBS address. Free: no FN or points.
 */
export function MarbleScreen({ view, switches }: { view: MarbleView; switches: Record<OverlayTarget, boolean> }) {
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

  // Entries and the race move on their own while a round is on.
  const active = round && round.status !== "DONE";
  useEffect(() => {
    if (!active) return;
    const poll = setInterval(() => router.refresh(), 3000);
    return () => clearInterval(poll);
  }, [active, router]);

  const openId = useRef<string | null>(null);
  const startId = useRef<string | null>(null);
  const [name, setName] = useState("");

  const run = (action: () => Promise<MarbleResult>, ok?: string, after?: () => void) => {
    setMessage(null);
    startTransition(async () => {
      const res = await action();
      if (res.status === "SAVED") {
        after?.();
        if (ok) setMessage({ tone: "ok", text: ok });
        router.refresh();
      } else if (res.status === "UNAUTHORIZED") router.push("/login?role=creator&next=/creator/widgets/play");
      else setMessage({ tone: "error", text: res.message });
    });
  };
  const open = () => {
    openId.current ??= crypto.randomUUID();
    const requestId = openId.current;
    run(() => openMarble({ requestId }), t("studioPlay.recruitStarted"), () => (openId.current = null));
  };
  const start = () => {
    if (!round) return;
    startId.current ??= crypto.randomUUID();
    const requestId = startId.current;
    run(() => startMarble({ roundId: round.id, requestId }), t("studioPlay.raceStarted"), () => (startId.current = null));
  };

  const race = round?.race ?? null;
  const left = race && now !== null ? Math.max(0, Math.ceil((Date.parse(race.finishAt) - now) / 1000)) : 0;
  const name0 = (id: string) => round?.entrants.find((e) => e.id === id)?.name ?? "";

  return (
    <div className={styles.content}>
      <header className={styles.header}>
        <h1 className={styles.title}>{t("studioPlay.pageTitle")}</h1>
        <p className={styles.subtitle}>{t("studioPlay.pageSubtitle")}</p>
      </header>
      <OverlayOffNotice targets={["play"]} switches={switches} />
      <PlayTabs active="marble" />

      {message && (
        <p className={message.tone === "error" ? styles.error : styles.ok} role={message.tone === "error" ? "alert" : "status"}>
          {message.text}
        </p>
      )}

      <section className={styles.card} aria-labelledby="marble-title">
        <h2 id="marble-title" className={styles.cardTitle}>
          {t("studioPlay.marble")}
        </h2>
        <p className={styles.note}>{t("studioPlay.marbleIntro")}</p>
        <form
          className={prize.form}
          onSubmit={(e) => {
            e.preventDefault();
            run(() => saveMarble(fromDraft(draft)), t("studioPlay.marbleSaved"));
          }}
        >
          <div className={prize.field}>
            <span className={styles.muted}>{t("studioPlay.titleLabel")}</span>
            <input className={styles.input} aria-label={t("studioPlay.marbleTitleAria")} placeholder={MARBLE_TITLE_DEFAULT} maxLength={MARBLE_TITLE_MAX} value={draft.title} onChange={(e) => edit({ title: e.target.value })} />
          </div>
          <div className={prize.field} role="group" aria-label={t("studioPlay.joinMode")}>
            <span className={styles.muted}>{t("studioPlay.joinMode")}</span>
            <span className={prize.inline}>
              <span className={styles.segment}>
                {MARBLE_MODES.map((m) => (
                  <button key={m.key} type="button" aria-pressed={draft.mode === m.key} onClick={() => edit({ mode: m.key })}>
                    {t(MODE_KEYS[m.key])}
                  </button>
                ))}
              </span>
              {draft.mode === "CHAT" && (
                <span className={play.unit}>
                  <span className={styles.muted}>{t("studioPlay.command")}</span>
                  <input className={styles.inputSmall} aria-label={t("studioPlay.joinCommand")} maxLength={MARBLE_KEYWORD_MAX} value={draft.keyword} onChange={(e) => edit({ keyword: e.target.value })} />
                </span>
              )}
            </span>
            <span className={styles.note}>
              {draft.mode === "CHAT" ? (
                <>
                  {t("studioPlay.chatNoteBefore")}
                  <Link href="/creator/chat">{t("studioPlay.unifiedChat")}</Link>
                  {t("studioPlay.chatNoteAfter")}
                </>
              ) : (
                t("studioPlay.inviteNote")
              )}
            </span>
          </div>
          <div className={prize.field} role="group" aria-label={t("studioPlay.map")}>
            <span className={styles.muted}>{t("studioPlay.map")}</span>
            <span className={styles.segment}>
              {MARBLE_MAPS.map((m) => (
                <button key={m.key} type="button" aria-pressed={draft.map === m.key} onClick={() => edit({ map: m.key })}>
                  {t(MAP_KEYS[m.key])}
                </button>
              ))}
            </span>
          </div>
          <div className={prize.field} role="group" aria-label={t("studioPlay.win")}>
            <span className={styles.muted}>{t("studioPlay.win")}</span>
            <span className={prize.inline}>
              <span className={styles.segment}>
                {MARBLE_WIN_RULES.map((r) => (
                  <button key={r.key} type="button" aria-pressed={draft.winRule === r.key} onClick={() => edit({ winRule: r.key })}>
                    {t(WIN_KEYS[r.key])}
                  </button>
                ))}
              </span>
              {draft.winRule === "RANK" && (
                <span className={play.unit}>
                  <input
                    className={styles.inputSmall}
                    type="number"
                    inputMode="numeric"
                    aria-label={t("studioPlay.winRankAria")}
                    min={1}
                    max={MARBLE_PLAYERS_MAX}
                    value={draft.winRank}
                    onChange={(e) => edit({ winRank: e.target.value })}
                  />
                  <span className={styles.muted}>{t("studioPlay.winRankUnit")}</span>
                </span>
              )}
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
                min={MARBLE_PLAYERS_MIN}
                max={MARBLE_PLAYERS_MAX}
                value={draft.maxPlayers}
                onChange={(e) => edit({ maxPlayers: e.target.value })}
              />
              <span className={styles.muted}>{t("studioPlay.peopleRange", { min: MARBLE_PLAYERS_MIN, max: MARBLE_PLAYERS_MAX })}</span>
            </label>
            <label className={play.unit}>
              <span className={styles.muted}>{t("studioPlay.race")}</span>
              <input
                className={styles.inputSmall}
                type="number"
                inputMode="numeric"
                aria-label={t("studioPlay.raceTime")}
                min={MARBLE_RACE_MIN_SEC}
                max={MARBLE_RACE_MAX_SEC}
                value={draft.raceSec}
                onChange={(e) => edit({ raceSec: e.target.value })}
              />
              <span className={styles.muted}>{t("studioPlay.secUnit")}</span>
            </label>
          </div>
          <label className={styles.checkRow}>
            <input type="checkbox" checked={draft.skills} onChange={(e) => edit({ skills: e.target.checked })} />
            {t("studioPlay.skills")}
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

      <section className={styles.card} aria-labelledby="marble-round-title">
        <h2 id="marble-round-title" className={styles.cardTitle}>
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
                {round.status === "OPEN" ? t("studioPlay.recruiting") : round.status === "RACING" ? t("studioPlay.racing", { left }) : t("studioPlay.result")} ·{" "}
                {t("studioPlay.players", { count: round.entrants.length, max: round.maxPlayers })} · {t("studioPlay.winRule", { rule: ruleText(round.rule, t) })}
              </span>
              {round.status === "OPEN" && (
                <button type="button" className={styles.primary} disabled={pending || round.entrants.length < MARBLE_PLAYERS_MIN} onClick={start}>
                  {t("studioPlay.startRace")}
                </button>
              )}
              {round.status === "DONE" && (
                <button type="button" className={styles.primary} disabled={pending} onClick={open}>
                  {t("studioPlay.nextRound")}
                </button>
              )}
              {round.status !== "RACING" && (
                <button
                  type="button"
                  className={styles.ghost}
                  disabled={pending}
                  onClick={() => run(() => closeMarble({ roundId: round.id }), round.status === "OPEN" ? t("studioPlay.recruitCancelled") : t("studioPlay.roundClosed"))}
                >
                  {round.status === "OPEN" ? t("studioPlay.cancelRecruit") : t("studioPlay.closeRound")}
                </button>
              )}
            </div>
            {round.status === "OPEN" && (
              <>
                {round.mode === "CHAT" ? (
                  <p className={styles.note}>
                    {t("studioPlay.chatJoinBefore")}
                    <strong>{round.keyword}</strong>
                    {t("studioPlay.chatJoinAfter", { min: MARBLE_PLAYERS_MIN })}
                  </p>
                ) : (
                  view.invitePath && (
                    <div className={styles.addRow}>
                      <input className={styles.input} value={`${origin}${view.invitePath}`} readOnly aria-label={t("studioPlay.inviteLinkAria")} onFocus={(e) => e.target.select()} />
                      <CopyButton value={`${origin}${view.invitePath}`} className={styles.ghost} />
                    </div>
                  )
                )}
                <form
                  className={styles.addRow}
                  onSubmit={(e) => {
                    e.preventDefault();
                    run(() => addMarble({ roundId: round.id, name }), undefined, () => setName(""));
                  }}
                >
                  <input
                    className={styles.input}
                    aria-label={t("studioPlay.addNameAria")}
                    placeholder={t("studioPlay.addNamePlaceholder")}
                    maxLength={MARBLE_NAME_MAX}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                  <button type="submit" className={styles.ghost} disabled={pending || !name.trim()}>
                    {t("studioPlay.add")}
                  </button>
                </form>
              </>
            )}
            {round.status !== "DONE" ? (
              round.entrants.length > 0 ? (
                <ul className={play.entrants} aria-label={t("studioPlay.entrantsAria")}>
                  {round.entrants.map((e) => (
                    <li key={e.id}>
                      {e.name}
                      <span className={styles.muted}>{sourceLabel(e.source, t)}</span>
                      {round.status === "OPEN" && (
                        <button type="button" aria-label={t("studioPlay.removeAria", { name: e.name })} disabled={pending} onClick={() => run(() => removeMarble({ roundId: round.id, entrantId: e.id }))}>
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
              race && (
                <ol className={play.results} aria-label={t("studioPlay.result")}>
                  {race.order.map((id, i) => (
                    <li key={id} data-win={id === race.winnerId || undefined}>
                      <span className={styles.muted}>{t("studioPlay.rankN", { rank: i + 1 })}</span>
                      <strong>{name0(id)}</strong>
                      {id === race.winnerId && <span className={play.badge}>{t("studioPlay.win")}</span>}
                    </li>
                  ))}
                </ol>
              )
            )}
          </>
        )}
      </section>

      <section className={styles.card} aria-labelledby="marble-history-title">
        <h2 id="marble-history-title" className={styles.cardTitle}>
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
                <span>{t("studioPlay.marbleHistory", { players: h.players, map: t(MAP_KEYS[h.map]), rule: ruleText(h.rule, t) })}</span>
                <strong>{h.winner}</strong>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className={styles.card} aria-labelledby="marble-obs-title">
        <h2 id="marble-obs-title" className={styles.cardTitle}>
          {t("studioPlay.obsAddress")}
        </h2>
        <p className={styles.note}>{t("studioPlay.marbleObsNote")}</p>
        <div className={styles.addRow}>
          <input
            className={styles.input}
            value={shownOverlayAddress(origin, view.overlayPath, "?marble")}
            readOnly
            aria-label={t("studioPlay.marbleOverlayAria")}
            onFocus={(e) => e.target.select()}
          />
          <CopyButton value={`${origin}${view.overlayPath}?marble`} className={styles.ghost} />
        </div>
      </section>
    </div>
  );
}
