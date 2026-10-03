"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { formatNumber } from "@/lib/format";
import {
  cancelAllAlerts,
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
import styles from "../crew/crew.module.css";
import { CopyButton } from "../settings/SettingsCards";
import remote from "./remote.module.css";
import { ToolsRemote } from "./ToolsRemote";

const STATUS_LABEL: Record<AlertStatus, string> = { QUEUED: "대기", SHOWING: "표시 중", DONE: "완료", SKIPPED: "건너뜀", FILTERED: "최소 금액 미만" };
const time = (iso: string) => new Date(iso).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

/**
 * 리모컨 — code-first (no Figma frame). Route `/creator/remote`. Controls the server-side alert
 * queue that the OBS alert overlay shows: pause, mute, skip, cancel, volumes, minimum amount and
 * 테스트 후원 (display only — no FN moves). Refreshes from the server every few seconds.
 */
export function RemoteScreen({ view, overlayPath, tools }: { view: RemoteView; overlayPath: string; tools: Pick<ToolStates, "timer" | "credits"> }) {
  const router = useRouter();
  const { controls } = view;
  const [amount, setAmount] = useState(10_000);
  const [donor, setDonor] = useState("");
  const [message, setMessageText] = useState("");
  const [minFn, setMinFn] = useState(String(controls.minFn));
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
        setNotice({ tone: "error", text: "요청하지 못했어요. 잠시 후 다시 시도해 주세요." });
      }
    });
  };

  const sendTest = () => {
    // One id per intended send: a double click or retry reuses it, so the alert is queued once.
    requestId.current ??= crypto.randomUUID();
    const id = requestId.current;
    run(() => sendTestAlert({ requestId: id, amount, donor, message }), "테스트 후원을 보냈어요.", () => {
      requestId.current = null;
      setMessageText("");
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
        aria-label={`${label} 볼륨`}
        onPointerUp={(e) => run(() => save(Number((e.target as HTMLInputElement).value)))}
        onKeyUp={(e) => run(() => save(Number((e.target as HTMLInputElement).value)))}
      />
      <strong>{value}%</strong>
    </label>
  );

  return (
    <div className={styles.content}>
      <header className={styles.header}>
        <h1 className={styles.title}>리모컨</h1>
        <p className={styles.subtitle}>방송 중 후원 알림을 한 화면에서 제어하세요. 알림 오버레이는 이 대기열을 그대로 보여 줘요.</p>
      </header>

      {offOverlays.length > 0 && (
        <div className={remote.offSummary} role="status">
          <span>
            꺼진 오버레이 {offOverlays.length}개 · {offOverlays.map((t) => t.label).join(", ")} — 방송 화면에 나오지 않아요. 아래 <a href="#switch-title">기능 제어</a>에서 하나씩 켤 수도 있어요.
          </span>
          <button type="button" className={styles.primary} disabled={pending} onClick={() => run(turnOnAllOverlays, "꺼진 오버레이를 모두 켰어요.")}>
            모두 켜기
          </button>
        </div>
      )}

      <section className={styles.card} aria-labelledby="overlay-title">
        <div className={styles.cardHead}>
          <h2 className={styles.cardTitle} id="overlay-title">
            🔔 후원 알림 오버레이
          </h2>
          <CopyButton value={`${origin}${overlayPath}`} label="오버레이 URL 복사" className={styles.ghost} />
        </div>
        <p className={styles.note}>OBS 브라우저 소스 권장 크기 800 × 600. 주소에는 연동 키가 들어 있으니 공유하지 마세요.</p>
      </section>

      {notice && (
        <p className={notice.tone === "error" ? styles.error : styles.ok} role={notice.tone === "error" ? "alert" : "status"}>
          {notice.text}
        </p>
      )}

      <section className={styles.card} aria-labelledby="all-title">
        <h2 className={styles.cardTitle} id="all-title">
          전체 제어
        </h2>
        <div className={remote.buttons}>
          <button
            type="button"
            className={controls.paused ? styles.primary : styles.ghost}
            aria-pressed={controls.paused}
            disabled={pending}
            onClick={() => run(() => setAlertControls({ paused: !controls.paused }))}
          >
            {controls.paused ? "▶ 알림 재개" : "⏸ 전체 일시정지"}
          </button>
          <button
            type="button"
            className={controls.muted ? styles.primary : styles.ghost}
            aria-pressed={controls.muted}
            disabled={pending}
            onClick={() => run(() => setAlertControls({ muted: !controls.muted }))}
          >
            {controls.muted ? "🔊 음소거 해제" : "🔇 전체 음소거"}
          </button>
          <button type="button" className={styles.ghost} disabled={pending || !view.showing} onClick={() => run(skipCurrentAlert, "현재 알림을 건너뛰었어요.")}>
            ⏭ 현재 알림 건너뛰기
          </button>
          <button
            type="button"
            className={styles.danger}
            disabled={pending || (!view.showing && !view.queued.length)}
            onClick={() => run(cancelAllAlerts, "모든 알림을 취소했어요.")}
          >
            ✕ 전체 알림 취소
          </button>
          <button type="button" className={styles.ghost} disabled={pending || !view.showing} onClick={() => run(skipTts, "TTS를 건너뛰었어요.")}>
            🔕 TTS 스킵
          </button>
          <button type="button" className={styles.ghost} disabled={pending} onClick={() => run(() => reloadOverlays(), "열려 있는 모든 오버레이를 새로고침해요.")}>
            ↻ 전체 오버레이 새로고침
          </button>
        </div>
        <div className={remote.status}>
          <span>
            {view.showing ? (
              <>
                <span className={styles.liveDot} aria-hidden="true" />
                표시 중: {view.showing.donor} · {alertAmount(view.showing)}
              </>
            ) : controls.paused ? (
              "일시정지됨 — 새 알림은 대기열에 쌓여요"
            ) : (
              "표시 중인 알림 없음"
            )}
          </span>
          <span>대기 {view.queued.length}건</span>
        </div>
      </section>

      <div className={remote.columns}>
        <section className={styles.card} aria-labelledby="switch-title">
          <h2 className={styles.cardTitle} id="switch-title">
            기능 제어
          </h2>
          <p className={styles.note}>
            OFF로 두면 그 오버레이는 화면 · 소리가 모두 꺼져요 (OBS 소스는 그대로). 끈 동안 지나간 알림은 다시 나오지 않으니, 잠깐 멈출 때는 &lsquo;전체 일시정지&rsquo;를 써요. ↻는 그 오버레이만 다시
            불러와요.
          </p>
          <ul className={remote.switches}>
            {OVERLAY_TARGETS.map((t) => {
              const on = view.overlays.on[t.key];
              return (
                <li key={t.key} data-off={on ? undefined : ""}>
                  <span className={remote.switchName}>{t.label}</span>
                  <span className={styles.segment} role="group" aria-label={`${t.label} 켜기 · 끄기`}>
                    {([true, false] as const).map((v) => (
                      <button
                        key={String(v)}
                        type="button"
                        aria-pressed={on === v}
                        disabled={pending}
                        onClick={() => on !== v && run(() => setOverlaySwitch({ target: t.key, on: v }), `${t.label} 오버레이를 ${v ? "켰어요" : "껐어요"}.`)}
                      >
                        {v ? "ON" : "OFF"}
                      </button>
                    ))}
                  </span>
                  <button
                    type="button"
                    className={styles.ghost}
                    disabled={pending}
                    aria-label={`${t.label} 새로고침`}
                    onClick={() => run(() => reloadOverlays({ target: t.key }), `${t.label} 오버레이를 새로고침해요.`)}
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
            볼륨 제어
          </h2>
          <p className={styles.note}>
            오버레이가 내는 소리의 크기예요. 한 번에 모두 끄려면 &lsquo;전체 음소거&rsquo;를 써요. OBS 오디오 믹서의 소스 볼륨과는 따로예요.
          </p>
          {slider("후원 알림음", controls.alertVolume, (v) => setAlertControls({ alertVolume: v }))}
          {slider("후원 TTS", controls.ttsVolume, (v) => setAlertControls({ ttsVolume: v }))}
          {slider("영상 후원", view.overlays.videoVolume, (v) => setVideoVolume({ volume: v }))}
          {controls.muted && <p className={styles.muted}>지금은 전체 음소거 중이라 후원 알림 소리가 나지 않아요.</p>}
        </section>
      </div>

      <ToolsRemote tools={tools} pending={pending} run={run} />

      <div className={remote.columns}>
        <section className={styles.card} aria-labelledby="test-title">
          <h2 className={styles.cardTitle} id="test-title">
            테스트 후원
          </h2>
          <p className={styles.note}>알림 화면만 확인하는 기능이에요. FN이 차감되거나 수익에 반영되지 않아요.</p>
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
            aria-label="테스트 금액(FN)"
            value={amount}
            onChange={(e) => setAmount(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
          />
          <input className={styles.input} aria-label="후원자명" placeholder="후원자명 (비우면 테스트 후원자)" maxLength={TEST_DONOR_MAX} value={donor} onChange={(e) => setDonor(e.target.value)} />
          <input className={styles.input} aria-label="메시지" placeholder="메시지" maxLength={TEST_MESSAGE_MAX} value={message} onChange={(e) => setMessageText(e.target.value)} />
          <div className={styles.actions}>
            <button type="button" className={styles.primary} disabled={pending || amount < 1} onClick={sendTest}>
              전송
            </button>
          </div>
        </section>

        <section className={styles.card} aria-labelledby="widget-title">
          <h2 className={styles.cardTitle} id="widget-title">
            알림 설정
          </h2>
          <form
            className={styles.addRow}
            onSubmit={(e) => {
              e.preventDefault();
              run(() => setAlertControls({ minFn: Math.floor(Number(minFn) || 0) }), "최소 금액을 적용했어요.");
            }}
          >
            <input className={styles.input} type="number" min={0} aria-label="최소 알림 금액(FN)" value={minFn} onChange={(e) => setMinFn(e.target.value)} />
            <span className={styles.muted}>FN 이상만 표시</span>
            <button type="submit" className={styles.ghost} disabled={pending}>
              적용
            </button>
          </form>
          <form
            className={styles.addRow}
            onSubmit={(e) => {
              e.preventDefault();
              run(() => setAlertControls({ displaySec: Math.floor(Number(displaySec) || 0) }), "표시 시간을 적용했어요.");
            }}
          >
            <input
              className={styles.input}
              type="number"
              min={ALERT_DISPLAY_SEC.min}
              max={ALERT_DISPLAY_SEC.max}
              aria-label="알림 표시 시간(초)"
              value={displaySec}
              onChange={(e) => setDisplaySec(e.target.value)}
            />
            <span className={styles.muted}>초 동안 표시</span>
            <button type="submit" className={styles.ghost} disabled={pending}>
              적용
            </button>
          </form>
          <p className={styles.note}>
            자막 · 전광판 · 타이머 · 엔딩 크레딧은 <Link href="/creator/widgets/tools">방송 도구</Link>에서 제어해요.
          </p>
        </section>
      </div>

      <section className={styles.card} aria-labelledby="queue-title">
        <h2 className={styles.cardTitle} id="queue-title">
          대기열 · 최근 알림
        </h2>
        {!view.showing && !view.queued.length && !view.recent.length ? (
          <p className={styles.empty}>아직 알림이 없어요. 테스트 후원으로 오버레이를 확인해 보세요.</p>
        ) : (
          <ul className={styles.list}>
            {[...(view.showing ? [view.showing] : []), ...view.queued, ...view.recent].map((a) => (
              <AlertRow key={a.id} alert={a} disabled={pending} onReplay={() => run(() => replayAlert(a.id), "알림을 다시 보냈어요.")} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function AlertRow({ alert, disabled, onReplay }: { alert: AlertItem; disabled: boolean; onReplay: () => void }) {
  const done = alert.status !== "QUEUED" && alert.status !== "SHOWING";
  return (
    <li className={styles.row}>
      <div className={styles.rowMain}>
        <span className={styles.rowTitle}>
          {alert.donor} · {alertAmount(alert)}
          {alert.kind === "TEST" && <span className={remote.testTag}>테스트</span>}
          {alert.kind === "EXTERNAL" && <span className={remote.testTag}>연동</span>}
        </span>
        <span className={styles.muted}>
          {time(alert.createdAt)} · {alert.typeLabel}
          {alert.message && ` · ${alert.message}`}
        </span>
      </div>
      <span className={remote.statusTag} data-status={alert.status}>
        {STATUS_LABEL[alert.status]}
      </span>
      {done && (
        <button type="button" className={styles.ghost} disabled={disabled} onClick={onReplay}>
          다시 보내기
        </button>
      )}
    </li>
  );
}
