import Image from "next/image";
import { CogIcon, MaximizeIcon, PlayerPlayIcon, VolumeIcon } from "@/components/icons";
import { formatNumber } from "@/lib/format";
import type { CreatorRoom } from "@/services/creators/creatorRoom";
import styles from "./room.module.css";

/**
 * Stream area. Live: Figma 826:685 (portrait stream, goal card, controls).
 * Offline: 710:195. The embedded platform player is TBD, so controls are display-only.
 */
export function Player({ name, stream }: { name: string; stream: CreatorRoom["stream"] }) {
  if (stream.status === "OFFLINE") {
    return (
      <div className={styles.player}>
        <Image src={stream.imageUrl} alt="" fill sizes="(max-width: 1200px) 100vw, 836px" className={styles.offlineImage} />
        <div className={styles.offlineNotice}>
          <span className={styles.offlineBadge}>오프라인</span>
          <p className={styles.offlineText}>{name} 님은 오프라인 상태입니다.</p>
        </div>
        <div className={`${styles.controls} ${styles.controlsOffline}`}>
          <span className={styles.streamBrand}>Ssumnation STREAM</span>
        </div>
      </div>
    );
  }

  const percent = stream.goal ? Math.min(100, Math.floor((stream.goal.current / stream.goal.target) * 100)) : 0;

  return (
    <div className={styles.player}>
      <div className={styles.streamFrame}>
        <Image src={stream.thumbnailUrl} alt={`${name} 라이브 방송 화면`} fill sizes="436px" className={styles.streamImage} priority />
      </div>

      <div className={styles.topOverlay}>
        <span className={styles.pill}>
          <span className={styles.liveDot} aria-hidden="true">
            🔴
          </span>
          <span className={styles.liveText}>LIVE</span>
          <span className={styles.pillDivider} aria-hidden="true" />
          <span className={styles.viewers}>{formatNumber(stream.viewerCount)} 시청 중</span>
        </span>
        {stream.rankBadge && <span className={`${styles.pill} ${styles.rank}`}>⭐ {stream.rankBadge}</span>}
      </div>

      {stream.goal && (
        <div className={styles.goal} data-theme="dark">
          <div className={styles.goalHeader}>
            <span>🏁 오늘 목표 후원 금액</span>
            <span className={styles.goalPercent}>{percent}% 달성</span>
          </div>
          <div
            className={styles.goalTrack}
            role="progressbar"
            aria-label="오늘 목표 후원 달성률"
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
