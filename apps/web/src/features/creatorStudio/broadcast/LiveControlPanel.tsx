"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";
import { Toast } from "@/components/ui/Toast";
import { Elapsed } from "@/features/live/Elapsed";
import { formatNumber } from "@/lib/format";
import { flextvLiveControl, getFlextvLiveControl } from "@/services/creator/flextvLiveControl";
import { LIVE_ROLE_LABEL, type LiveControlAction, type LiveControlView, type LiveViewer } from "@/services/creator/flextvLiveControlTypes";
import { ROOM_LIVE_POLL_MS } from "@/services/live/roomLiveTypes";
import styles from "./broadcast.module.css";

const LOGIN = "/login?role=creator&next=/creator/broadcast";
const MEDALS = ["🥇", "🥈", "🥉"];
const DONE: Record<LiveControlAction, (name: string) => string> = {
  MUTE: (n) => `${n}님의 채팅을 60초 동안 막았어요.`,
  UNMUTE: (n) => `${n}님의 채팅 금지를 풀었어요.`,
  KICK: (n) => `${n}님을 방송에서 내보냈어요.`,
  BLACKLIST: (n) => `${n}님을 블랙리스트에 올리고 내보냈어요. 채팅 관리에서 해제할 수 있어요.`,
  FREEZE: () => "채팅 얼리기를 바꿨어요."
};

/**
 * 지금 방송 (phase 10, code-first after funnation's 방송하기 and FLEXTV's own chat window): while the stream is on air,
 * its 방송 시간, viewers now and in all, 채팅 얼리기, a 미리보기 of the room's player, 이번 방송 후원 랭킹, and who is in the
 * room with FLEXTV's 채팅 금지 (60초) · 내보내기 · 블랙리스트. Asks again every 15 seconds while the page is visible.
 */
export function LiveControlPanel({ initial }: { initial: LiveControlView }) {
  const router = useRouter();
  const [view, setView] = useState(initial);
  const [preview, setPreview] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const clear = useCallback(() => setToast(null), []);

  const reload = useCallback(async () => {
    const next = await getFlextvLiveControl().catch(() => null);
    // Off air now: the page shows the 방송 전 state.
    if (!next) return router.refresh();
    setView((prev) => ({ ...next, people: next.people ?? prev.people, frozen: next.frozen ?? prev.frozen }));
  }, [router]);

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      if (document.visibilityState === "visible") await reload();
      if (alive) timer = setTimeout(tick, ROOM_LIVE_POLL_MS);
    };
    timer = setTimeout(tick, ROOM_LIVE_POLL_MS);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [reload]);

  const act = (action: LiveControlAction, viewer?: LiveViewer) => {
    if (action === "BLACKLIST" && viewer && !window.confirm(`${viewer.nickname}(${viewer.loginId})님을 블랙리스트에 올릴까요? 이 채널의 채팅을 쓸 수 없게 되고, 방송에서 바로 내보내져요.`)) return;
    if (action === "KICK" && viewer && !window.confirm(`${viewer.nickname}님을 방송에서 내보낼까요? 다시 들어올 수는 있어요.`)) return;
    setError(null);
    start(async () => {
      const result = await flextvLiveControl({ action, loginId: viewer?.loginId }).catch(() => null);
      if (!result) return setError("요청하지 못했어요. 잠시 후 다시 시도해 주세요.");
      if (result.status === "UNAUTHORIZED") return router.push(LOGIN);
      if (result.status === "INVALID") setError(result.message);
      else setToast(DONE[action](viewer?.nickname ?? ""));
      await reload();
    });
  };

  return (
    <section className={styles.card} aria-labelledby="bc-live">
      <div className={styles.statusRow}>
        <h2 id="bc-live" className={styles.cardTitle}>
          지금 방송
        </h2>
        <div className={styles.actions}>
          <button type="button" className={styles.secondaryButton} aria-pressed={preview} onClick={() => setPreview((p) => !p)}>
            {preview ? "미리보기 닫기" : "미리보기"}
          </button>
          <button type="button" className={styles.secondaryButton} aria-pressed={view.frozen === true} disabled={pending || view.frozen === null} onClick={() => act("FREEZE")}>
            {view.frozen ? "🧊 채팅 얼리기 풀기" : "🧊 채팅 얼리기"}
          </button>
        </div>
      </div>
      <dl className={styles.liveStats}>
        <div>
          <dt>방송 시간</dt>
          <dd>{view.startedAt ? <Elapsed since={view.startedAt} suffix="" /> : "-"}</dd>
        </div>
        <div>
          <dt>지금 시청자</dt>
          <dd>{view.viewers === null ? "-" : `${formatNumber(view.viewers)}명`}</dd>
        </div>
        <div>
          <dt>누적 시청자</dt>
          <dd>{view.totalViewers === null ? "-" : `${formatNumber(view.totalViewers)}명`}</dd>
        </div>
        <div>
          <dt>채팅</dt>
          <dd title={view.frozen ? "방송인과 매니저만 채팅할 수 있어요" : undefined}>{view.frozen === null ? "-" : view.frozen ? "얼림" : "모두 가능"}</dd>
        </div>
      </dl>
      {preview && (
        <div className={styles.livePreview}>
          <iframe
            src={view.playerUrl}
            title="내 방송 미리보기"
            allow="autoplay; fullscreen"
            referrerPolicy="strict-origin-when-cross-origin"
            sandbox="allow-scripts allow-same-origin allow-presentation"
          />
        </div>
      )}

      <h3 className={styles.liveSubTitle}>🏆 이번 방송 후원 랭킹</h3>
      {view.donors.length === 0 ? (
        <p className={styles.help}>아직 이번 방송 후원이 없어요.</p>
      ) : (
        <ol className={styles.liveDonors}>
          {view.donors.map((d) => (
            <li key={d.rank}>
              <span aria-label={`${d.rank}위`}>{MEDALS[d.rank - 1] ?? d.rank}</span>
              <span className={styles.liveName}>{d.nickname}</span>
              <span className={styles.liveAmount}>{formatNumber(d.amount)} FN</span>
            </li>
          ))}
        </ol>
      )}

      <h3 className={styles.liveSubTitle}>시청자 {view.people ? `(${formatNumber(view.people.length)}${view.people.length >= 50 ? "+" : ""})` : ""}</h3>
      <p className={styles.hint}>채팅 금지는 FLEXTV가 60초 뒤에 풀어요. 내보낸 시청자는 다시 들어올 수 있고, 블랙리스트는 채팅 관리에서 해제해요.</p>
      {view.people === null ? (
        <p className={styles.help}>시청자 목록을 불러오지 못했어요. 잠시 후 다시 불러와요.</p>
      ) : view.people.length === 0 ? (
        <p className={styles.help}>아직 들어온 시청자가 없어요.</p>
      ) : (
        <ul className={styles.liveViewers}>
          {view.people.map((v) => (
            <li key={v.loginId}>
              <span className={styles.liveRole} data-role={v.role}>
                {LIVE_ROLE_LABEL[v.role]}
                {v.role === "FAN" && v.fanLevel > 0 ? ` ${v.fanLevel}` : ""}
              </span>
              <span className={styles.liveName}>
                {v.nickname} <span className={styles.hint}>({v.loginId})</span>
                {v.muted && <span className={styles.liveMuted}> · 채팅 금지 중</span>}
              </span>
              {v.role !== "OWNER" && (
                <span className={styles.liveButtons}>
                  <button type="button" className={styles.secondaryButton} disabled={pending} onClick={() => act(v.muted ? "UNMUTE" : "MUTE", v)}>
                    {v.muted ? "금지 풀기" : "채팅 금지"}
                  </button>
                  <button type="button" className={styles.secondaryButton} disabled={pending} onClick={() => act("KICK", v)}>
                    내보내기
                  </button>
                  <button type="button" className={styles.dangerButton} disabled={pending} onClick={() => act("BLACKLIST", v)}>
                    블랙리스트
                  </button>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      <Toast message={toast} tone="neutral" onDone={clear} />
    </section>
  );
}
