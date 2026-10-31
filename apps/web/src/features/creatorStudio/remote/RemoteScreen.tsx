"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { formatKstTime, formatNumber } from "@/lib/format";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { MessageKey } from "@/lib/i18n/translate";
import {
  cancelAllAlerts,
  playHeldAlert,
  reloadOverlays,
  replayAlert,
  sendTestAlert,
  setAlertControls,
  setOverlaySwitch,
  turnOnAllOverlays,
  setVideoVolume,
  skipCurrentAlert,
  skipTts
} from "@/services/creator/alertRemote";
import type { ToolStates } from "@/services/creator/broadcastToolTypes";
import {
  ALERT_DISPLAY_SEC,
  OVERLAY_TARGETS,
  alertAmount,
  offOverlayTargets,
  TEST_AMOUNT_PRESETS,
  TEST_DONOR_MAX,
  TEST_MESSAGE_MAX,
  type AlertItem,
  type AlertStatus,
  type RemoteResult,
  type RemoteView
} from "@/services/creator/alertTypes";
import type { GachaRemoteView } from "@/services/donations/gachaTypes";
import type { QuestRemoteView } from "@/services/donations/questTypes";
import type { RouletteRemoteView } from "@/services/donations/rouletteTypes";
import type { VoteRemoteView } from "@/services/votes/voteTypes";
import type { WallpaperRemoteView } from "@/services/creator/wallpaperRemote";
import styles from "../crew/crew.module.css";
import { CopyButton } from "../settings/SettingsCards";
import remote from "./remote.module.css";
import { GachaRemote } from "./GachaRemote";
import { QuestRemote } from "./QuestRemote";
import { RouletteRemote } from "./RouletteRemote";
import { BingoRemote } from "./BingoRemote";
import { ToolsRemote } from "./ToolsRemote";
import { VoteRemote } from "./VoteRemote";
import { WallpaperRemote } from "./WallpaperRemote";
import { overlayTargetLabel } from "./OverlayOffNotice";
import { openRemoteWindow } from "./remoteWindow";

const STATUS_KEY: Record<AlertStatus, MessageKey> = {
  QUEUED: "studioRemote.alertQueued",
  SHOWING: "studioRemote.alertShowing",
  DONE: "studioRemote.statusDone",
  SKIPPED: "studioRemote.alertSkipped",
  FILTERED: "studioRemote.alertFiltered"
};
const time = (iso: string) => formatKstTime(iso, { hour: "2-digit", minute: "2-digit", second: "2-digit" });

/**
 * 리모컨 — code-first (no Figma frame). Route `/creator/remote`. Controls the server-side alert
 * queue that the OBS alert overlay shows: pause (or 자동 일시정지 after a big alert), mute, skip, cancel, volumes, minimum amount and
 * 테스트 후원 (display only — no FN moves), plus 방송 도구, 퀘스트, 투표, 룰렛, 뽑기 and 벽지. Refreshes from the server every
 * few seconds.
 */
export function RemoteScreen({
  view,
  overlayPath,
  tools,
  quest,
  vote,
  roulette,
  gacha,
  wallpaper,
  variant = "page"
}: {
  view: RemoteView;
  overlayPath: string;
  tools: Pick<ToolStates, "timer" | "credits" | "bingo">;
  quest: QuestRemoteView;
  vote: VoteRemoteView;
  roulette: RouletteRemoteView;
  gacha: GachaRemoteView;
  wallpaper: WallpaperRemoteView;
  /** "window": the 리모컨 on its own (`/popout/remote`), without the button that opens that window. */
  variant?: "page" | "window";
}) {
  const { t } = useI18n();
  const router = useRouter();
  const { controls } = view;
  const [amount, setAmount] = useState(10_000);
  const [donor, setDonor] = useState("");
  const [message, setMessageText] = useState("");
  /** 테스트 후원 as a signature (2026-10-25): its image · sound, and the member for the 시그니처 플레이어. "" = none. */
  const [testSig, setTestSig] = useState("");
  const [testMember, setTestMember] = useState("");
  const [minFn, setMinFn] = useState(String(controls.minFn));
  const [autoPauseFn, setAutoPauseFn] = useState(String(controls.autoPauseFn));
  const [displaySec, setDisplaySec] = useState(String(controls.displaySec));
  const [notice, setNotice] = useState<{ tone: "error" | "ok"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const requestId = useRef<string | null>(null);
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);

  useEffect(() => {
    const poll = setInterval(() => router.refresh(), 2000);
    return () => clearInterval(poll);
  }, [router]);

  const run = (action: () => Promise<RemoteResult>, ok?: string, after?: () => void) => {
    setNotice(null);
    startTransition(async () => {
      try {
        const res = await action();
        if (res.status === "SAVED") {
          after?.();
          if (ok) setNotice({ tone: "ok", text: ok });
          router.refresh();
        } else if (res.status === "UNAUTHORIZED") router.push("/login?role=creator&next=/creator/remote");
        else setNotice({ tone: "error", text: res.message });
      } catch {
        setNotice({ tone: "error", text: t("studioRemote.requestFailed") });
      }
    });
  };

  const sendTest = () => {
    // One id per intended send: a double click or retry reuses it, so the alert is queued once.
    requestId.current ??= crypto.randomUUID();
    const id = requestId.current;
    const sig = view.testOptions.signatures.some((s) => s.id === testSig) ? testSig : null;
    const member = view.testOptions.members.some((m) => m.id === testMember) ? testMember : null;
    run(() => sendTestAlert({ requestId: id, amount, donor, message, signatureId: sig, memberId: member }), t("studioRemote.testSent"), () => {
      requestId.current = null;
      setMessageText("");
    });
  };

  // One id per intended 다시 보내기 of an alert: a double click or retry queues one copy.
  const replayIds = useRef<Record<string, string>>({});
  const replay = (alertId: string) => {
    const id = (replayIds.current[alertId] ??= crypto.randomUUID());
    run(() => replayAlert({ id: alertId, requestId: id }), t("studioRemote.replayed"), () => {
      delete replayIds.current[alertId];
    });
  };

  // A slider sends its value when released (pointer or keyboard); the label shows the server's value.
  const offOverlays = offOverlayTargets(view.overlays.on);

  const slider = (label: string, value: number, save: (v: number) => Promise<RemoteResult>) => (
    <label className={remote.slider}>
      <span>{label}</span>
      <input
        key={value}
        type="range"
        min={0}
        max={100}
        step={5}
        defaultValue={value}
        aria-label={t("studioRemote.volumeAria", { label })}
        onPointerUp={(e) => run(() => save(Number((e.target as HTMLInputElement).value)))}
        onKeyUp={(e) => run(() => save(Number((e.target as HTMLInputElement).value)))}
      />
      <strong>{value}%</strong>
    </label>
  );

  return (
    <div className={styles.content}>
      <header className={remote.head}>
        <div className={styles.header}>
          <h1 className={styles.title}>{t("studioRemote.title")}</h1>
          <p className={styles.subtitle}>{t("studioRemote.subtitle")}</p>
        </div>
        {variant === "page" && (
          <button
            type="button"
            className={styles.ghost}
            title={t("studioRemote.openWindowTitle")}
            onClick={() => {
              if (!openRemoteWindow()) setNotice({ tone: "error", text: t("studioRemote.popupBlocked") });
            }}
          >
            {t("studioRemote.openWindow")}
          </button>
        )}
      </header>

      {offOverlays.length > 0 && (
        <div className={remote.offSummary} role="status">
          <span>
            {t("studioRemote.offSummaryBefore", { count: offOverlays.length, labels: offOverlays.map((o) => overlayTargetLabel(o.key, t)).join(", ") })}
            <a href="#switch-title">{t("studioRemote.offSummaryLink")}</a>
            {t("studioRemote.offSummaryAfter")}
          </span>
          <button type="button" className={styles.primary} disabled={pending} onClick={() => run(turnOnAllOverlays, t("studioRemote.allOn"))}>
            {t("studioRemote.turnAllOn")}
          </button>
        </div>
      )}

      <section className={styles.card} aria-labelledby="overlay-title">
        <div className={styles.cardHead}>
          <h2 className={styles.cardTitle} id="overlay-title">
            {t("studioRemote.overlayTitle")}
          </h2>
          <CopyButton value={`${origin}${overlayPath}`} label={t("studioRemote.copyOverlayUrl")} className={styles.ghost} />
        </div>
        <p className={styles.note}>{t("studioRemote.overlayNote")}</p>
      </section>

      {notice && (
        <p className={notice.tone === "error" ? styles.error : styles.ok} role={notice.tone === "error" ? "alert" : "status"}>
          {notice.text}
        </p>
      )}

      <section className={styles.card} aria-labelledby="all-title">
        <h2 className={styles.cardTitle} id="all-title">
          {t("studioRemote.allTitle")}
        </h2>
        <div className={remote.buttons}>
          <button
            type="button"
            className={controls.paused ? styles.primary : styles.ghost}
            aria-pressed={controls.paused}
            disabled={pending}
            onClick={() => run(() => setAlertControls({ paused: !controls.paused }))}
          >
            {controls.paused ? t("studioRemote.resume") : t("studioRemote.pauseAll")}
          </button>
          <button
            type="button"
            className={controls.muted ? styles.primary : styles.ghost}
            aria-pressed={controls.muted}
            disabled={pending}
            onClick={() => run(() => setAlertControls({ muted: !controls.muted }))}
          >
            {controls.muted ? t("studioRemote.unmute") : t("studioRemote.muteAll")}
          </button>
          {/* Skip / cancel name what this screen shows: an alert that ended or arrived since is left alone. */}
          <button
            type="button"
            className={styles.ghost}
            disabled={pending || !view.showing}
            onClick={() => view.showing && run(() => skipCurrentAlert({ alertId: view.showing!.id }), t("studioRemote.skippedOk"))}
          >
            {t("studioRemote.skipCurrent")}
          </button>
          <button
            type="button"
            className={styles.danger}
            disabled={pending || (!view.showing && !view.queued.length)}
            onClick={() => {
              const upToId = view.queued.at(-1)?.id ?? view.showing?.id;
              if (upToId) run(() => cancelAllAlerts({ upToId }), t("studioRemote.cancelledOk"));
            }}
          >
            {t("studioRemote.cancelAll")}
          </button>
          <button type="button" className={styles.ghost} disabled={pending || !view.showing} onClick={() => run(skipTts, t("studioRemote.ttsSkippedOk"))}>
            {t("studioRemote.skipTts")}
          </button>
          <button type="button" className={styles.ghost} disabled={pending} onClick={() => run(() => reloadOverlays(), t("studioRemote.reloadingAll"))}>
            {t("studioRemote.reloadAll")}
          </button>
        </div>
        <div className={remote.status}>
          <span>
            {view.showing ? (
              <>
                <span className={styles.liveDot} aria-hidden="true" />
                {t("studioRemote.showing", { donor: view.showing.donor, amount: alertAmount(view.showing) })}
                {view.autoPausedBy?.id === view.showing.id && t("studioRemote.showingAutoPause")}
              </>
            ) : view.autoPausedBy ? (
              t("studioRemote.autoPaused", { donor: view.autoPausedBy.donor, amount: alertAmount(view.autoPausedBy) })
            ) : controls.paused ? (
              t("studioRemote.paused")
            ) : view.queued[0]?.held ? (
              t("studioRemote.heldStop")
            ) : (
              t("studioRemote.nothingShowing")
            )}
          </span>
          <span>{t("studioRemote.queued", { count: view.queued.length })}</span>
        </div>
      </section>

      <div className={remote.columns}>
        <section className={styles.card} aria-labelledby="switch-title">
          <h2 className={styles.cardTitle} id="switch-title">
            {t("studioRemote.switchTitle")}
          </h2>
          <p className={styles.note}>{t("studioRemote.switchNote")}</p>
          <ul className={remote.switches}>
            {OVERLAY_TARGETS.map((target) => {
              const on = view.overlays.on[target.key];
              const label = overlayTargetLabel(target.key, t);
              return (
                <li key={target.key} data-off={on ? undefined : ""}>
                  <span className={remote.switchName}>{label}</span>
                  <span className={styles.segment} role="group" aria-label={t("studioRemote.switchAria", { label })}>
                    {([true, false] as const).map((v) => (
                      <button
                        key={String(v)}
                        type="button"
                        aria-pressed={on === v}
                        disabled={pending}
                        onClick={() => on !== v && run(() => setOverlaySwitch({ target: target.key, on: v }), t(v ? "studioRemote.overlayOn" : "studioRemote.overlayOff", { label }))}
                      >
                        {v ? "ON" : "OFF"}
                      </button>
                    ))}
                  </span>
                  <button
                    type="button"
                    className={styles.ghost}
                    disabled={pending}
                    aria-label={t("studioRemote.reloadAria", { label })}
                    onClick={() => run(() => reloadOverlays({ target: target.key }), t("studioRemote.reloadingOne", { label }))}
                  >
                    ↻
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        <section className={styles.card} aria-labelledby="volume-title">
          <h2 className={styles.cardTitle} id="volume-title">
            {t("studioRemote.volumeTitle")}
          </h2>
          <p className={styles.note}>{t("studioRemote.volumeNote")}</p>
          {slider(t("studioRemote.volumeAlert"), controls.alertVolume, (v) => setAlertControls({ alertVolume: v }))}
          {slider(t("studioRemote.volumeTts"), controls.ttsVolume, (v) => setAlertControls({ ttsVolume: v }))}
          {slider(t("studioRemote.volumeSignature"), controls.signatureVolume, (v) => setAlertControls({ signatureVolume: v }))}
          {slider(t("studioRemote.volumeVideo"), view.overlays.videoVolume, (v) => setVideoVolume({ volume: v }))}
          {controls.muted && <p className={styles.muted}>{t("studioRemote.mutedNote")}</p>}
        </section>
      </div>

      <ToolsRemote tools={tools} pending={pending} run={run} />

      <BingoRemote bingo={tools.bingo} pending={pending} run={run} />

      {/* Its own notices next to the quests: a decision is final and may refund, so the answer shows by the row. */}
      <QuestRemote view={quest} />

      <VoteRemote view={vote} pending={pending} run={run} />

      <RouletteRemote view={roulette} pending={pending} run={run} />

      <GachaRemote view={gacha} pending={pending} run={run} />

      <WallpaperRemote view={wallpaper} pending={pending} run={run} />

      <div className={remote.columns}>
        <section className={styles.card} aria-labelledby="test-title">
          <h2 className={styles.cardTitle} id="test-title">
            {t("studioRemote.testTitle")}
          </h2>
          <p className={styles.note}>{t("studioRemote.testNote")}</p>
          <div className={remote.buttons}>
            {TEST_AMOUNT_PRESETS.map((p) => (
              <button key={p} type="button" className={amount === p ? styles.chip : styles.chipOff} aria-pressed={amount === p} onClick={() => setAmount(p)}>
                {formatNumber(p)}
              </button>
            ))}
          </div>
          <input
            className={styles.input}
            type="number"
            min={1}
            aria-label={t("studioRemote.testAmount")}
            value={amount}
            onChange={(e) => setAmount(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
          />
          <input className={styles.input} aria-label={t("studioRemote.testDonor")} placeholder={t("studioRemote.testDonorPlaceholder")} maxLength={TEST_DONOR_MAX} value={donor} onChange={(e) => setDonor(e.target.value)} />
          <input className={styles.input} aria-label={t("studioRemote.testMessage")} placeholder={t("studioRemote.testMessage")} maxLength={TEST_MESSAGE_MAX} value={message} onChange={(e) => setMessageText(e.target.value)} />
          <div className={styles.addRow}>
            <select className={styles.select} aria-label={t("studioRemote.testSignature")} value={testSig} onChange={(e) => setTestSig(e.target.value)}>
              <option value="">{t("studioRemote.testNoSignature")}</option>
              {view.testOptions.signatures.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} · {formatNumber(s.price)} FN
                </option>
              ))}
            </select>
            <select className={styles.select} aria-label={t("studioRemote.testMember")} value={testMember} onChange={(e) => setTestMember(e.target.value)}>
              <option value="">{t("studioRemote.testNoMember")}</option>
              {view.testOptions.members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.actions}>
            <button type="button" className={styles.primary} disabled={pending || amount < 1} onClick={sendTest}>
              {t("studioRemote.testSend")}
            </button>
          </div>
        </section>

        <section className={styles.card} aria-labelledby="widget-title">
          <h2 className={styles.cardTitle} id="widget-title">
            {t("studioRemote.settingsTitle")}
          </h2>
          <form
            className={styles.addRow}
            onSubmit={(e) => {
              e.preventDefault();
              run(() => setAlertControls({ minFn: Math.floor(Number(minFn) || 0) }), t("studioRemote.minApplied"));
            }}
          >
            <input className={styles.input} type="number" min={0} aria-label={t("studioRemote.minAria")} value={minFn} onChange={(e) => setMinFn(e.target.value)} />
            <span className={styles.muted}>{t("studioRemote.minSuffix")}</span>
            <button type="submit" className={styles.ghost} disabled={pending}>
              {t("studioRemote.apply")}
            </button>
          </form>
          <form
            className={styles.addRow}
            onSubmit={(e) => {
              e.preventDefault();
              const v = Math.floor(Number(autoPauseFn) || 0);
              run(() => setAlertControls({ autoPauseFn: v }), v ? t("studioRemote.autoPauseSet", { amount: formatNumber(v) }) : t("studioRemote.autoPauseOff"));
            }}
          >
            <input className={styles.input} type="number" min={0} aria-label={t("studioRemote.autoPauseAria")} value={autoPauseFn} onChange={(e) => setAutoPauseFn(e.target.value)} />
            <span className={styles.muted}>{t("studioRemote.autoPauseSuffix")}</span>
            <button type="submit" className={styles.ghost} disabled={pending}>
              {t("studioRemote.apply")}
            </button>
          </form>
          <p className={styles.note}>{t("studioRemote.autoPauseNote")}</p>
          <form
            className={styles.addRow}
            onSubmit={(e) => {
              e.preventDefault();
              run(() => setAlertControls({ displaySec: Math.floor(Number(displaySec) || 0) }), t("studioRemote.displayApplied"));
            }}
          >
            <input
              className={styles.input}
              type="number"
              min={ALERT_DISPLAY_SEC.min}
              max={ALERT_DISPLAY_SEC.max}
              aria-label={t("studioRemote.displayAria")}
              value={displaySec}
              onChange={(e) => setDisplaySec(e.target.value)}
            />
            <span className={styles.muted}>{t("studioRemote.displaySuffix")}</span>
            <button type="submit" className={styles.ghost} disabled={pending}>
              {t("studioRemote.apply")}
            </button>
          </form>
          <p className={styles.note}>
            {t("studioRemote.toolsNoteBefore")}
            <Link href="/creator/widgets/tools">{t("studioRemote.toolsNoteLink")}</Link>
            {t("studioRemote.toolsNoteAfter")}
          </p>
        </section>
      </div>

      <section className={styles.card} aria-labelledby="queue-title">
        <h2 className={styles.cardTitle} id="queue-title">
          {t("studioRemote.queueTitle")}
        </h2>
        {!view.showing && !view.queued.length && !view.recent.length ? (
          <p className={styles.empty}>{t("studioRemote.queueEmpty")}</p>
        ) : (
          <ul className={styles.list}>
            {[...(view.showing ? [view.showing] : []), ...view.queued, ...view.recent].map((a) => (
              <AlertRow key={a.id} alert={a} disabled={pending} onReplay={() => replay(a.id)} onPlayHeld={() => run(() => playHeldAlert({ alertId: a.id }), t("studioRemote.playHeldOk"))} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function AlertRow({ alert, disabled, onReplay, onPlayHeld }: { alert: AlertItem; disabled: boolean; onReplay: () => void; onPlayHeld: () => void }) {
  const { t } = useI18n();
  const done = alert.status !== "QUEUED" && alert.status !== "SHOWING";
  // 미지정 일시정지 (방송 운영 후원 리스트): the queue waits at this alert until its donation is assigned.
  const held = alert.status === "QUEUED" && alert.held;
  return (
    <li className={styles.row}>
      <div className={styles.rowMain}>
        <span className={styles.rowTitle}>
          {alert.donor} · {alertAmount(alert)}
          {alert.kind === "TEST" && <span className={remote.testTag}>{t("studioRemote.tagTest")}</span>}
          {alert.kind === "EXTERNAL" && <span className={remote.testTag}>{t("studioRemote.tagExternal")}</span>}
        </span>
        <span className={styles.muted}>
          {time(alert.createdAt)} · {alert.typeLabel}
          {alert.message && ` · ${alert.message}`}
        </span>
      </div>
      <span className={remote.statusTag} data-status={held ? "HELD" : alert.status}>
        {held ? t("studioRemote.heldTag") : t(STATUS_KEY[alert.status])}
      </span>
      {held && (
        <button type="button" className={styles.ghost} disabled={disabled} onClick={onPlayHeld}>
          {t("studioRemote.playHeld")}
        </button>
      )}
      {done && (
        <button type="button" className={styles.ghost} disabled={disabled} onClick={onReplay}>
          {t("studioRemote.replay")}
        </button>
      )}
    </li>
  );
}
