"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";
import { Toast } from "@/components/ui/Toast";
import { Elapsed } from "@/features/live/Elapsed";
import { formatNumber } from "@/lib/format";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { MessageKey } from "@/lib/i18n/translate";
import { flextvLiveControl, getFlextvLiveControl } from "@/services/creator/flextvLiveControl";
import type { LiveControlAction, LiveControlView, LiveViewer, LiveViewerRole } from "@/services/creator/flextvLiveControlTypes";
import { ROOM_LIVE_POLL_MS } from "@/services/live/roomLiveTypes";
import styles from "./broadcast.module.css";

const LOGIN = "/login?role=creator&next=/creator/broadcast";
const MEDALS = ["🥇", "🥈", "🥉"];
const DONE: Record<LiveControlAction, MessageKey> = {
  MUTE: "flextvLiveControl.doneMute",
  UNMUTE: "flextvLiveControl.doneUnmute",
  KICK: "flextvLiveControl.doneKick",
  BLACKLIST: "flextvLiveControl.doneBlacklist",
  FREEZE: "flextvLiveControl.doneFreeze"
};
const ROLE_LABEL: Record<LiveViewerRole, MessageKey> = {
  OWNER: "flextvLiveControl.roleOwner",
  MANAGER: "flextvLiveControl.roleManager",
  HOT_FAN: "flextvLiveControl.roleHotFan",
  FAN: "flextvLiveControl.roleFan",
  VIEWER: "flextvLiveControl.roleViewer"
};

/**
 * 지금 방송 (phase 10, code-first after funnation's 방송하기 and FLEXTV's own chat window): while the stream is on air,
 * its 방송 시간, viewers now and in all, 채팅 얼리기, a 미리보기 of the room's player, 이번 방송 후원 랭킹, and who is in the
 * room with FLEXTV's 채팅 금지 (60초) · 내보내기 · 블랙리스트. Asks again every 15 seconds while the page is visible.
 */
export function LiveControlPanel({ initial }: { initial: LiveControlView }) {
  const router = useRouter();
  const { t } = useI18n();
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
    if (action === "BLACKLIST" && viewer && !window.confirm(t("flextvLiveControl.blacklistConfirm", { name: viewer.nickname, loginId: viewer.loginId }))) return;
    if (action === "KICK" && viewer && !window.confirm(t("flextvLiveControl.kickConfirm", { name: viewer.nickname }))) return;
    setError(null);
    start(async () => {
      const result = await flextvLiveControl({ action, loginId: viewer?.loginId }).catch(() => null);
      if (!result) return setError(t("flextvLiveControl.requestFailed"));
      if (result.status === "UNAUTHORIZED") return router.push(LOGIN);
      if (result.status === "INVALID") setError(result.message);
      else setToast(t(DONE[action], { name: viewer?.nickname ?? "" }));
      await reload();
    });
  };

  return (
    <section className={styles.card} aria-labelledby="bc-live">
      <div className={styles.statusRow}>
        <h2 id="bc-live" className={styles.cardTitle}>
          {t("flextvLiveControl.title")}
        </h2>
        <div className={styles.actions}>
          <button type="button" className={styles.secondaryButton} aria-pressed={preview} onClick={() => setPreview((p) => !p)}>
            {preview ? t("flextvLiveControl.closePreview") : t("flextvLiveControl.preview")}
          </button>
          <button type="button" className={styles.secondaryButton} aria-pressed={view.frozen === true} disabled={pending || view.frozen === null} onClick={() => act("FREEZE")}>
            {view.frozen ? t("flextvLiveControl.unfreeze") : t("flextvLiveControl.freeze")}
          </button>
        </div>
      </div>
      <dl className={styles.liveStats}>
        <div>
          <dt>{t("flextvLiveControl.streamTime")}</dt>
          <dd>{view.startedAt ? <Elapsed since={view.startedAt} suffix="" /> : "-"}</dd>
        </div>
        <div>
          <dt>{t("flextvLiveControl.viewersNow")}</dt>
          <dd>{view.viewers === null ? "-" : t("flextvLiveControl.people", { count: formatNumber(view.viewers) })}</dd>
        </div>
        <div>
          <dt>{t("flextvLiveControl.totalViewers")}</dt>
          <dd>{view.totalViewers === null ? "-" : t("flextvLiveControl.people", { count: formatNumber(view.totalViewers) })}</dd>
        </div>
        <div>
          <dt>{t("flextvLiveControl.chat")}</dt>
          <dd title={view.frozen ? t("flextvLiveControl.frozenHint") : undefined}>
            {view.frozen === null ? "-" : view.frozen ? t("flextvLiveControl.frozen") : t("flextvLiveControl.chatOpen")}
          </dd>
        </div>
      </dl>
      {preview && (
        <div className={styles.livePreview}>
          <iframe
            src={view.playerUrl}
            title={t("flextvLiveControl.previewTitle")}
            allow="autoplay; fullscreen"
            referrerPolicy="strict-origin-when-cross-origin"
            sandbox="allow-scripts allow-same-origin allow-presentation"
          />
        </div>
      )}

      <h3 className={styles.liveSubTitle}>{t("flextvLiveControl.rankingTitle")}</h3>
      {view.donors.length === 0 ? (
        <p className={styles.help}>{t("flextvLiveControl.noDonors")}</p>
      ) : (
        <ol className={styles.liveDonors}>
          {view.donors.map((d) => (
            <li key={d.rank}>
              <span aria-label={t("flextvLiveControl.rankAria", { rank: d.rank })}>{MEDALS[d.rank - 1] ?? d.rank}</span>
              <span className={styles.liveName}>{d.nickname}</span>
              <span className={styles.liveAmount}>{formatNumber(d.amount)} FN</span>
            </li>
          ))}
        </ol>
      )}

      <h3 className={styles.liveSubTitle}>
        {t("flextvLiveControl.viewersTitle")} {view.people ? `(${formatNumber(view.people.length)}${view.people.length >= 50 ? "+" : ""})` : ""}
      </h3>
      <p className={styles.hint}>{t("flextvLiveControl.viewersHint")}</p>
      {view.people === null ? (
        <p className={styles.help}>{t("flextvLiveControl.viewersFailed")}</p>
      ) : view.people.length === 0 ? (
        <p className={styles.help}>{t("flextvLiveControl.viewersEmpty")}</p>
      ) : (
        <ul className={styles.liveViewers}>
          {view.people.map((v) => (
            <li key={v.loginId}>
              <span className={styles.liveRole} data-role={v.role}>
                {t(ROLE_LABEL[v.role])}
                {v.role === "FAN" && v.fanLevel > 0 ? ` ${v.fanLevel}` : ""}
              </span>
              <span className={styles.liveName}>
                {v.nickname} <span className={styles.hint}>({v.loginId})</span>
                {v.muted && <span className={styles.liveMuted}> · {t("flextvLiveControl.mutedTag")}</span>}
              </span>
              {v.role !== "OWNER" && (
                <span className={styles.liveButtons}>
                  <button type="button" className={styles.secondaryButton} disabled={pending} onClick={() => act(v.muted ? "UNMUTE" : "MUTE", v)}>
                    {v.muted ? t("flextvLiveControl.unmute") : t("flextvLiveControl.mute")}
                  </button>
                  <button type="button" className={styles.secondaryButton} disabled={pending} onClick={() => act("KICK", v)}>
                    {t("flextvLiveControl.kick")}
                  </button>
                  <button type="button" className={styles.dangerButton} disabled={pending} onClick={() => act("BLACKLIST", v)}>
                    {t("flextvLiveControl.blacklist")}
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
