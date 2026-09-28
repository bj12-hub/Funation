import Image from "next/image";
import type { CreatorRoom } from "@/services/creators/creatorRoom";
import { PLATFORM_LABEL } from "@/types/platform";
import { Player } from "./Player";
import { RoomActions } from "./RoomActions";
import { SidePanel } from "./SidePanel";
import styles from "./room.module.css";

type Viewer = { nickname: string; fnBalance: number } | null;

/** Figma 826:685 / 610:138 (live) · 710:195 (offline) — route `/creators/[id]`. */
export function CreatorRoomScreen({ room, viewer, isFavorite }: { room: CreatorRoom; viewer: Viewer; isFavorite: boolean }) {
  return (
    <div className={styles.page}>
      {room.banner && (
        <section className={styles.banner} aria-labelledby="room-banner-title">
          <Image src={room.banner.imageUrl} alt="" fill sizes="(max-width: 1440px) 100vw, 1280px" className={styles.bannerImage} />
          <span className={styles.bannerShade} aria-hidden="true" />
          <div className={styles.bannerText}>
            <span className={styles.bannerLabel}>{room.banner.label}</span>
            <h2 id="room-banner-title" className={styles.bannerTitle}>
              {room.banner.title}
            </h2>
            <p className={styles.bannerDescription}>{room.banner.description}</p>
          </div>
          {room.banner.href ? (
            <a href={room.banner.href} className={styles.bannerCta}>
              {room.banner.ctaLabel}
            </a>
          ) : (
            // TODO: promotion destination is TBD.
            <span className={styles.bannerCta} aria-disabled="true" title="준비 중인 기능입니다">
              {room.banner.ctaLabel}
            </span>
          )}
        </section>
      )}

      <div className={styles.creatorRow}>
        <div className={styles.creator}>
          <Image src={room.avatarUrl} alt="" width={54} height={54} className={styles.avatar} />
          <div className={styles.creatorText}>
            <div className={styles.nameRow}>
              <h1 className={styles.name}>{room.name}</h1>
              <ul className={styles.channels} aria-label="방송 채널">
                {room.channels.map((c) => (
                  <li key={c.platform} className={styles.channel}>
                    <Image src={c.logoUrl} alt={PLATFORM_LABEL[c.platform]} width={20} height={20} className={styles.channelLogo} />
                  </li>
                ))}
              </ul>
            </div>
            <span className={styles.tagline}>{room.tagline}</span>
          </div>
        </div>
        <RoomActions creatorId={room.creatorId} name={room.name} initialFavorite={isFavorite} signedIn={viewer !== null} />
      </div>

      <div className={styles.main}>
        <div className={styles.playerColumn}>
          <Player name={room.name} stream={room.stream} />
          {room.stream.status === "LIVE" && <p className={styles.caption}>{room.stream.caption}</p>}
        </div>
        <SidePanel room={room} signedIn={viewer !== null} fnBalance={viewer?.fnBalance ?? null} nickname={viewer?.nickname ?? null} />
      </div>
    </div>
  );
}
