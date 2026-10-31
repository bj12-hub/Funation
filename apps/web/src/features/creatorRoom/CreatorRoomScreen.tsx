import Image from "next/image";
import type { CreatorRoom } from "@/services/creators/creatorRoom";
import Link from "next/link";
import { formatCompactKo } from "@/lib/format";
import type { CreatorCategory } from "@/services/creators/creators";
import type { CrewPublic, RoomFanNotes } from "@/services/crew/crewTypes";
import { PLATFORM_LABEL } from "@/types/platform";
import type { ChannelNews, ChannelPostsView, ChannelRanking } from "@/services/creators/channelTypes";
import type { PublicChannelVideos } from "@/services/creators/channelVideos";
import type { RoomVote } from "@/services/votes/voteTypes";
import { ChannelCommunity, ChannelHomeExtras } from "./ChannelHome";
import { AboutView, ChannelTabs, CrewView, NewsView, SignaturesView, VideosView } from "./ChannelViews";
import type { ChannelView } from "./channelView";
import channel from "./channel.module.css";
import { Player } from "./Player";
import { remote } from "@/lib/remoteImage";
import { RoomActions } from "./RoomActions";
import { RoomFanNotesCard } from "./RoomFanNotes";
import { LiveInfo, RoomLiveProvider } from "./RoomLive";
import { RoomVoteCard } from "./RoomVote";
import { SidePanel } from "./SidePanel";
import styles from "./room.module.css";

/** `fnBalance` null: the balance could not be read (the form leaves the check to the server). */
type Viewer = { nickname: string; fnBalance: number | null } | null;

/**
 * Creator channel — route `/creators/[id]`. Structure follows the funnation channel page: banner, profile
 * row with 후원하기, then tabs 홈 · 크루 · 영상 · 커뮤니티 · 시그니처 · 소개 (`?view=`). 홈 keeps the Figma room
 * (826:685 / 610:138 live · 710:195 offline): player + 후원/채팅 panel.
 */
export function CreatorRoomScreen({
  room,
  viewer,
  isFavorite,
  initialTab,
  view = "home",
  crew,
  about,
  ranking,
  posts,
  postsShow,
  videos,
  vote,
  fanNotes,
  news
}: {
  room: CreatorRoom;
  viewer: Viewer;
  isFavorite: boolean;
  initialTab?: "DONATION" | "CHAT";
  view?: ChannelView;
  crew: CrewPublic;
  about: { description: string; categories: CreatorCategory[]; subscriberCount: number; joinedAt: string };
  ranking: ChannelRanking;
  posts: ChannelPostsView;
  postsShow: number;
  videos: PublicChannelVideos | null;
  /** The channel's 투표 on screen (code-first), shown under the player. */
  vote: RoomVote | null;
  /** 팬 메시지 · 요청사항 while the channel's crew broadcast takes notes (code-first). */
  fanNotes: RoomFanNotes | null;
  /** A FLEXTV channel's 소식 (phase 9): its 커뮤니티 tab is "소식", FLEXTV's posts. */
  news?: ChannelNews;
}) {
  const donateHref = `/creators/${room.creatorId}?tab=donation`;
  // A FLEXTV channel (FLEXTV backend): only FLEXTV's channel, 소식 and donation options — no 구독자 · 크루 · 투표 …
  const flextv = room.source === "FLEXTV";
  const flextvViews: ChannelView[] = room.donation.signatures.length > 0 ? ["home", "community", "signatures"] : ["home", "community"];
  const live = flextv && room.stream.status === "LIVE" && room.stream.embed ? room.stream : null;
  const side = <SidePanel key={initialTab} room={room} signedIn={viewer !== null} fnBalance={viewer?.fnBalance ?? null} nickname={viewer?.nickname ?? null} initialTab={initialTab} />;
  return (
    <div className={styles.page}>
      {room.banner && (
        <section className={styles.banner} aria-labelledby="room-banner-title" data-theme="dark">
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
          <Image src={room.avatarUrl} alt="" width={54} height={54} className={styles.avatar} unoptimized={remote(room.avatarUrl)} />
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
            {/* A FLEXTV channel shows its 즐겨찾기 count (phase 7); FLEXTV's 구독 is its paid membership. */}
            <span className={channel.subscribers}>
              {flextv ? "즐겨찾기" : "구독자"} {formatCompactKo(about.subscriberCount)}명
            </span>
          </div>
        </div>
        <div className={styles.creatorActions}>
          {/* funnation: 후원하기 is the primary channel action; it opens the 후원 panel on 홈. */}
          <Link href={donateHref} className={channel.donateButton} scroll={false}>
            💝 후원하기
          </Link>
          <RoomActions creatorId={room.creatorId} name={room.name} initialFavorite={isFavorite} signedIn={viewer !== null} flextv={flextv} messageTo={room.ownerLoginId} />
        </div>
      </div>

      <ChannelTabs creatorId={room.creatorId} active={view} only={flextv ? flextvViews : undefined} labels={flextv ? { community: "소식" } : undefined} />

      {view !== "home" && (
        <section className={channel.panel} aria-label="채널">
          {view === "crew" && <CrewView crew={crew} name={room.name} />}
          {view === "videos" && videos && <VideosView name={room.name} data={videos} />}
          {view === "community" &&
            (flextv ? (
              news && <NewsView creatorId={room.creatorId} name={room.name} news={news} show={postsShow} />
            ) : (
              <ChannelCommunity creatorId={room.creatorId} name={room.name} view={posts} signedIn={viewer !== null} show={postsShow} />
            ))}
          {view === "signatures" && <SignaturesView signatures={room.donation.signatures} donateHref={donateHref} />}
          {view === "about" && (
            <AboutView about={{ name: room.name, description: about.description, categories: about.categories, subscriberCount: about.subscriberCount, joinedAt: about.joinedAt, platforms: room.channels.map((c) => c.platform) }} />
          )}
        </section>
      )}

      {view === "home" &&
        (live ? (
          // A FLEXTV stream played here (phase 10): its title, category, viewers and 방송 시간 under the player, and
          // 이번 방송 후원 랭킹 over the chat, from one poll.
          <RoomLiveProvider channelId={room.creatorId} initial={live.live ?? { viewers: live.viewerCount, donors: [] }}>
            <div className={styles.main}>
              <div className={styles.playerColumn}>
                <Player name={room.name} stream={room.stream} />
                <LiveInfo title={live.caption} category={live.category ?? null} startedAt={live.startedAt ?? null} />
              </div>
              {side}
            </div>
          </RoomLiveProvider>
        ) : (
          <div className={styles.main}>
            <div className={styles.playerColumn}>
              <Player name={room.name} stream={room.stream} />
              {room.stream.status === "LIVE" && <p className={styles.caption}>{room.stream.caption}</p>}
              {!flextv && <RoomVoteCard channelId={room.creatorId} signedIn={viewer !== null} initial={vote} />}
              {!flextv && <RoomFanNotesCard channelId={room.creatorId} signedIn={viewer !== null} initial={fanNotes} />}
            </div>
            {side}
          </div>
        ))}
      {view === "home" && (!flextv || news) && <ChannelHomeExtras creatorId={room.creatorId} ranking={ranking} posts={posts.items.slice(0, 3)} news={flextv ? news : undefined} />}
    </div>
  );
}
