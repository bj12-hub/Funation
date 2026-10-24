import Image from "next/image";
import { CogIcon, MaximizeIcon, PlayerPlayIcon, VolumeIcon } from "@/components/icons";
import { formatNumber } from "@/lib/format";
import type { CreatorRoom } from "@/services/creators/creatorRoom";
import { remote } from "@/lib/remoteImage";
import styles from "./room.module.css";

/** Why a FLEXTV stream is watched on FLEXTV (code-first copy). */
const ON_FLEXTV_REASON: Record<NonNullable<Extract<CreatorRoom["stream"], { status: "LIVE" }>["onFlextv"]>["reason"], string> = {
  ADULT: "19세 이상만 볼 수 있는 방송이에요.",
  LOCKED: "비밀번호가 걸린 방송이에요.",
  FAN_ONLY: "팬 등급 회원만 볼 수 있는 방송이에요.",
  FULL: "시청 인원이 가득 찬 방송이에요.",
  BANNED: "이 방송은 지금 볼 수 없어요."
};

/**
 * Stream area. Live: Figma 826:685 (portrait stream, goal card, controls).
 * Offline: 710:195. The embedded platform player is TBD, so controls are display-only.
 */
export function Player({ name, stream }: { name: string; stream: CreatorRoom["stream"] }) {
  if (stream.status === "OFFLINE") {
    return (
      <div className={styles.player}>
        <Image src={stream.imageUrl} alt="" fill sizes="(max-width: 1200px) 100vw, 836px" className={styles.offlineImage} unoptimized={remote(stream.imageUrl)} />
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

  if (stream.embed) {
    // FLEXTV's own player (FLEXTV backend). Sandboxed: it plays and goes full screen, but cannot reach this page or
    // navigate it (its gated-stream fallback only moves the frame).
    return (
      <div className={styles.player}>
        <iframe
          src={stream.embed.playerUrl}
          title={`${name} 라이브 방송`}
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
          <p className={styles.offlineText}>{ON_FLEXTV_REASON[stream.onFlextv.reason]}</p>
          <a href={stream.onFlextv.url} target="_blank" rel="noopener noreferrer" className={styles.watchOnFlextv}>
            FLEXTV에서 보기
          </a>
        </div>
      </div>
    );
  }

  const percent = stream.goal ? Math.min(100, Math.floor((stream.goal.current / stream.goal.target) * 100)) : 0;

  return (
    <div className={styles.player}>
      <div className={styles.streamFrame}>
        <Image src={stream.thumbnailUrl} alt={`${name} 라이브 방송 화면`} fill sizes="436px" className={styles.streamImage} priority unoptimized={remote(stream.thumbnailUrl)} />
      </div>

      <div className={styles.topOverlay}>
        <span className={styles.pill}>
          <span className={styles.liveDot} aria-hidden="true">
            🔴
          </span>
          <span className={styles.liveText}>LIVE</span>
          <span className={styles.pillDivider} aria-hidden="true" />
          {stream.viewerCount !== null && <span className={styles.viewers}>{formatNumber(stream.viewerCount)} 시청 중</span>}
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
