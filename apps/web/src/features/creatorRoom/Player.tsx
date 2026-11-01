import Image from "next/image";
import { CogIcon, MaximizeIcon, PlayerPlayIcon, VolumeIcon } from "@/components/icons";
import { formatNumber } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
import type { MessageKey } from "@/lib/i18n/translate";
import type { CreatorRoom } from "@/services/creators/creatorRoom";
import { remote } from "@/lib/remoteImage";
import styles from "./room.module.css";

/** Why a FLEXTV stream is watched on FLEXTV (code-first copy). */
const ON_FLEXTV_REASON: Record<NonNullable<Extract<CreatorRoom["stream"], { status: "LIVE" }>["onFlextv"]>["reason"], MessageKey> = {
  ADULT: "room.flextvAdult",
  LOCKED: "room.flextvLocked",
  FAN_ONLY: "room.flextvFanOnly",
  FULL: "room.flextvFull",
  BANNED: "room.flextvBanned"
};

/**
 * Stream area. Live: Figma 826:685 (portrait stream, goal card, controls).
 * Offline: 710:195. The embedded platform player is TBD, so controls are display-only.
 */
export async function Player({ name, stream }: { name: string; stream: CreatorRoom["stream"] }) {
  const t = await getT();
  if (stream.status === "OFFLINE") {
    return (
      <div className={styles.player}>
        <Image src={stream.imageUrl} alt="" fill sizes="(max-width: 1200px) 100vw, 836px" className={styles.offlineImage} unoptimized={remote(stream.imageUrl)} />
        <div className={styles.offlineNotice}>
          <span className={styles.offlineBadge}>{t("room.offline")}</span>
          <p className={styles.offlineText}>{t("room.offlineText", { name })}</p>
        </div>
        <div className={`${styles.controls} ${styles.controlsOffline}`}>
          <span className={styles.streamBrand}>Ssumnation STREAM</span>
        </div>
      </div>
    );
  }

  if (stream.embed) {
    // FLEXTV's own player (FLEXTV backend). Sandboxed: it plays and goes full screen, but cannot reach this page or
    // navigate it (its gated-stream fallback only moves the frame). A landscape stream gets a 16:9 frame instead of the
    // portrait design's fixed height, which would letterbox it.
    return (
      <div className={stream.embed.portrait ? styles.player : `${styles.player} ${styles.playerWide}`}>
        <iframe
          src={stream.embed.playerUrl}
          title={t("room.streamTitle", { name })}
          className={styles.embedFrame}
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          sandbox="allow-scripts allow-same-origin allow-presentation allow-popups allow-popups-to-escape-sandbox"
        />
      </div>
    );
  }

  if (stream.onFlextv) {
    return (
      <div className={styles.player}>
        <Image src={stream.thumbnailUrl} alt="" fill sizes="(max-width: 1200px) 100vw, 836px" className={styles.offlineImage} unoptimized={remote(stream.thumbnailUrl)} />
        <div className={styles.offlineNotice}>
          <span className={styles.offlineBadge}>LIVE</span>
          <p className={styles.offlineText}>{t(ON_FLEXTV_REASON[stream.onFlextv.reason])}</p>
          <a href={stream.onFlextv.url} target="_blank" rel="noopener noreferrer" className={styles.watchOnFlextv}>
            {t("room.watchOnFlextv")}
          </a>
        </div>
      </div>
    );
  }

  const percent = stream.goal ? Math.min(100, Math.floor((stream.goal.current / stream.goal.target) * 100)) : 0;

  return (
    <div className={styles.player}>
      <div className={styles.streamFrame}>
        <Image src={stream.thumbnailUrl} alt={t("room.streamAlt", { name })} fill sizes="436px" className={styles.streamImage} priority unoptimized={remote(stream.thumbnailUrl)} />
      </div>

      <div className={styles.topOverlay}>
        <span className={styles.pill}>
          <span className={styles.liveDot} aria-hidden="true">
            🔴
          </span>
          <span className={styles.liveText}>LIVE</span>
          <span className={styles.pillDivider} aria-hidden="true" />
          {stream.viewerCount !== null && <span className={styles.viewers}>{t("room.watching", { count: formatNumber(stream.viewerCount) })}</span>}
        </span>
        {stream.rankBadge && <span className={`${styles.pill} ${styles.rank}`}>⭐ {stream.rankBadge}</span>}
      </div>

      {stream.goal && (
        <div className={styles.goal} data-theme="dark">
          <div className={styles.goalHeader}>
            <span>{t("room.goal")}</span>
            <span className={styles.goalPercent}>{t("room.goalPercent", { percent })}</span>
          </div>
          <div
            className={styles.goalTrack}
            role="progressbar"
            aria-label={t("room.goalAria")}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
          >
            <div className={styles.goalFill} style={{ width: `${percent}%` }} />
          </div>
          <span className={styles.goalAmount}>
            {formatNumber(stream.goal.current)} / {formatNumber(stream.goal.target)} FN
          </span>
        </div>
      )}

      {/* TODO: controls wire up once the platform player embed is decided. */}
      <div className={styles.controls}>
        <div className={styles.controlGroup}>
          <span className={styles.controlButton} aria-hidden="true">
            <PlayerPlayIcon />
          </span>
          <span className={styles.controlButton} aria-hidden="true">
            <VolumeIcon />
          </span>
        </div>
        <div className={styles.controlGroup}>
          <span>{stream.qualityLabel}</span>
          <span className={styles.controlButton} aria-hidden="true">
            <CogIcon />
          </span>
          <span className={styles.controlButton} aria-hidden="true">
            <MaximizeIcon />
          </span>
        </div>
      </div>
    </div>
  );
}
