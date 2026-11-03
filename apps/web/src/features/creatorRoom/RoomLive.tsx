"use client";

import Image from "next/image";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Elapsed } from "@/features/live/Elapsed";
import { formatNumber } from "@/lib/format";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { remote } from "@/lib/remoteImage";
import { getFlextvRoomLive } from "@/services/live/flextvRoomLive";
import { ROOM_LIVE_POLL_MS, type RoomDonor, type RoomLive } from "@/services/live/roomLiveTypes";
import styles from "./room.module.css";

/**
 * A FLEXTV stream's running figures in its room (phase 10, code-first after funnation's live room): the viewers and
 * 방송 시간 under the player, and 이번 방송 후원 랭킹 over the chat. One poll serves both while the page is visible.
 */
const RoomLiveContext = createContext<{ viewers: number | null; donors: RoomDonor[] } | null>(null);

export function RoomLiveProvider({ channelId, initial, children }: { channelId: string; initial: RoomLive; children: ReactNode }) {
  const [live, setLive] = useState({ viewers: initial.viewers, donors: initial.donors ?? [] });
  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      if (document.visibilityState === "visible") {
        const next = await getFlextvRoomLive(channelId).catch(() => null);
        // What FLEXTV did not say this time stays as it was.
        if (alive && next) setLive((prev) => ({ viewers: next.viewers ?? prev.viewers, donors: next.donors ?? prev.donors }));
      }
      if (alive) timer = setTimeout(tick, ROOM_LIVE_POLL_MS);
    };
    timer = setTimeout(tick, ROOM_LIVE_POLL_MS);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [channelId]);
  return <RoomLiveContext.Provider value={live}>{children}</RoomLiveContext.Provider>;
}

/** Under the player: the stream's title, 방송 카테고리, viewers now and 방송 시간 (funnation's live room). */
export function LiveInfo({ title, category, startedAt }: { title: string; category: string | null; startedAt: string | null }) {
  const live = useContext(RoomLiveContext);
  const { t } = useI18n();
  return (
    <div className={styles.liveInfo}>
      {title && <h2 className={styles.liveTitle}>{title}</h2>}
      <div className={styles.liveMeta}>
        {category && <span className={styles.liveCategory}>{category}</span>}
        {live?.viewers != null && <span className={styles.liveMetaItem}>{t("room.viewersNow", { count: formatNumber(live.viewers) })}</span>}
        {startedAt && <Elapsed since={startedAt} className={styles.liveMetaItem} suffix={t("room.elapsedSuffix")} />}
      </div>
    </div>
  );
}

const MEDALS = ["🥇", "🥈", "🥉"];

/** 이번 방송 후원 랭킹 over the chat: FLEXTV's top three of this stream, nickname and 렉스. */
export function StreamDonors() {
  const live = useContext(RoomLiveContext);
  const { t } = useI18n();
  if (!live) return null;
  return (
    <section className={styles.streamDonors} aria-labelledby="stream-donors">
      <h3 id="stream-donors" className={styles.streamDonorsTitle}>
        {t("room.streamDonors")}
      </h3>
      {live.donors.length === 0 ? (
        <p className={styles.streamDonorsEmpty}>{t("room.streamDonorsEmpty")}</p>
      ) : (
        <ol className={styles.streamDonorList}>
          {live.donors.map((d) => (
            <li key={d.rank} className={styles.streamDonor}>
              <span className={styles.streamDonorMedal} aria-label={t("room.rankN", { n: d.rank })}>
                {MEDALS[d.rank - 1] ?? d.rank}
              </span>
              {d.avatarUrl ? (
                <Image src={d.avatarUrl} alt="" width={24} height={24} className={styles.streamDonorAvatar} unoptimized={remote(d.avatarUrl)} />
              ) : (
                <span className={styles.streamDonorAvatar} aria-hidden="true" />
              )}
              <span className={styles.streamDonorName}>{d.nickname}</span>
              <span className={styles.streamDonorAmount}>{formatNumber(d.amount)} FN</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
