"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { formatCompact, formatNumber, kstIsoString } from "@/lib/format";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { platformLabel } from "@/lib/i18n/platformLabel";
import type { MessageKey } from "@/lib/i18n/translate";
import type { CreatorCategory } from "@/services/creators/creatorTypes";
import type { CrewPublic, CrewRole } from "@/services/crew/crewTypes";
import { CHANNEL_NEWS_MAX, CHANNEL_NEWS_PAGE, type ChannelNews } from "@/services/creators/channelTypes";
import type { PublicChannelVideos } from "@/services/creators/channelVideos";
import type { Signature } from "@/services/donations/donationCatalog";
import type { PlatformErrorCode, VideoKind } from "@/services/platforms/platformTypes";
import type { Platform } from "@/types/platform";
import { PledgeLine } from "./PledgeLine";
import { CHANNEL_VIEWS, type ChannelView } from "./channelView";
import styles from "./channel.module.css";
import { remote } from "@/lib/remoteImage";

/** Labels in the viewer's language for the tab, role, category and platform error codes. */
const VIEW_KEY: Record<ChannelView, MessageKey> = {
  home: "roomChannel.home",
  crew: "roomChannel.crew",
  videos: "roomChannel.videos",
  community: "roomChannel.community",
  signatures: "roomChannel.signatures",
  about: "roomChannel.about"
};
const ROLE_KEY: Record<CrewRole, MessageKey> = { LEADER: "roomChannel.roleLeader", MEMBER: "roomChannel.roleMember" };
const CATEGORY_KEY: Record<CreatorCategory, MessageKey> = {
  VARIETY: "roomChannel.catVariety",
  TRAVEL: "roomChannel.catTravel",
  DRAMA: "roomChannel.catDrama",
  SPORTS: "roomChannel.catSports",
  MUSIC: "roomChannel.catMusic",
  GAME: "roomChannel.catGame",
  MUKBANG: "roomChannel.catMukbang",
  DAILY: "roomChannel.catDaily"
};
const PLATFORM_ERROR_KEY: Record<PlatformErrorCode, MessageKey> = {
  TIMEOUT: "roomChannel.errTimeout",
  NOT_FOUND: "roomChannel.errNotFound",
  UNAUTHORIZED: "roomChannel.errUnauthorized",
  UNSUPPORTED: "roomChannel.errUnsupported",
  UNAVAILABLE: "roomChannel.errUnavailable"
};

/**
 * Creator channel tabs other than 홈 — structure follows the funnation channel page
 * (홈 · 크루 · 영상 · 커뮤니티 · 시그니처 · 소개). Code-first; visuals from existing tokens.
 */

/** `only`: the views this channel has (a FLEXTV channel's room: 홈 and, with signatures, 시그니처). */
export function ChannelTabs({ creatorId, active, only, labels }: { creatorId: string; active: ChannelView; only?: readonly ChannelView[]; labels?: Partial<Record<ChannelView, string>> }) {
  const { t } = useI18n();
  return (
    <nav className={styles.tabs} aria-label={t("roomChannel.tabs")}>
      {CHANNEL_VIEWS.filter((v) => !only || only.includes(v.key)).map((v) => (
        <Link key={v.key} href={v.key === "home" ? `/creators/${creatorId}` : `/creators/${creatorId}?view=${v.key}`} className={styles.tab} aria-current={active === v.key ? "page" : undefined} scroll={false}>
          {labels?.[v.key] ?? t(VIEW_KEY[v.key])}
        </Link>
      ))}
    </nav>
  );
}

export function CrewView({ crew, name }: { crew: CrewPublic; name: string }) {
  const { t } = useI18n();
  if (crew.members.length === 0) return <p className={styles.empty}>{t("roomChannel.noCrew", { name })}</p>;
  return (
    <ul className={styles.crewGrid} aria-label={t("roomChannel.crewMembers")}>
      {crew.members.map((m) => (
        <li key={m.id} className={styles.crewCard}>
          <span className={styles.crewDot} style={{ background: m.color }} aria-hidden="true">
            {m.name.slice(0, 1)}
          </span>
          <strong>{m.name}</strong>
          <span className={styles.muted}>{t(ROLE_KEY[m.role])}</span>
          <PledgeLine member={m} compact />
        </li>
      ))}
    </ul>
  );
}

/**
 * 소식 — a FLEXTV channel's 소식 (phase 9) as FLEXTV's channel page lists them: title, picture, 필독 · 19 marks. Each opens
 * on FLEXTV, which shows its text and comments (and keeps a 구독자 전용 one for subscribers).
 */
export function NewsView({ creatorId, name, news, show }: { creatorId: string; name: string; news: ChannelNews; show: number }) {
  const { t } = useI18n();
  if (news.unavailable) {
    return (
      <p className={styles.empty} role="status">
        {t("roomChannel.newsFailed")}
      </p>
    );
  }
  if (news.items.length === 0) return <p className={styles.empty}>{t("roomChannel.noNews", { name })}</p>;
  return (
    <>
      <ul className={styles.videoGrid}>
        {news.items.map((n) => (
          <li key={n.id}>
            <a href={n.href} target="_blank" rel="noopener noreferrer" className={styles.videoCard}>
              <span className={styles.videoThumb} aria-hidden="true">
                {n.imageUrl ? <Image src={n.imageUrl} alt="" fill sizes="(max-width: 720px) 100vw, 320px" className={styles.newsImage} unoptimized={remote(n.imageUrl)} /> : "📣"}
              </span>
              <strong className={styles.videoTitle}>
                {n.important && <span className={styles.newsBadge}>{t("roomChannel.newsImportant")}</span>}
                {n.adult && <span className={styles.newsBadge}>19</span>}
                {n.title || t("roomChannel.newsUntitled")}
              </strong>
              <span className={styles.muted}>
                {t("roomChannel.views", { count: formatNumber(n.views) })} · {kstIsoString(n.createdAt).slice(0, 10).replace(/-/g, ".")}
              </span>
            </a>
          </li>
        ))}
      </ul>
      {news.hasMore && show < CHANNEL_NEWS_MAX && (
        <Link href={`/creators/${creatorId}?view=community&show=${show + CHANNEL_NEWS_PAGE}`} className={styles.link} scroll={false}>
          {t("roomChannel.newsMore")}
        </Link>
      )}
      <p className={styles.muted}>{t("roomChannel.newsOnFlextv")}</p>
    </>
  );
}

/** 영상 — videos from platforms whose adapter supports VIDEO_LIST (YouTube), newest first. */
export function VideosView({ name, data }: { name: string; data: PublicChannelVideos }) {
  const { t, locale } = useI18n();
  const [kind, setKind] = useState<"ALL" | VideoKind>("ALL");
  if (data.unsupported) return <p className={styles.empty}>{t("roomChannel.videosUnsupported", { name })}</p>;
  const list = data.videos.filter((v) => kind === "ALL" || v.kind === kind);
  return (
    <>
      <div className={styles.sorts} role="group" aria-label={t("roomChannel.videoKinds")}>
        {VIDEO_KINDS.map((k) => (
          <button key={k.key} type="button" className={styles.sort} aria-pressed={kind === k.key} onClick={() => setKind(k.key)}>
            {t(k.label)}
          </button>
        ))}
      </div>
      {data.error && (
        <p className={styles.muted} role="status">
          {t(PLATFORM_ERROR_KEY[data.error])}
        </p>
      )}
      {list.length === 0 ? (
        <p className={styles.empty}>{t("roomChannel.noVideos")}</p>
      ) : (
        <ul className={styles.videoGrid}>
          {list.map((v) => (
            <li key={v.externalId}>
              <a href={v.url} target="_blank" rel="noopener noreferrer" className={styles.videoCard}>
                <span className={styles.videoThumb} data-kind={v.kind} aria-hidden="true">
                  ▶<span className={styles.videoLen}>{videoLength(v.durationSec)}</span>
                </span>
                <strong className={styles.videoTitle}>{v.title}</strong>
                <span className={styles.muted}>
                  {platformLabel(v.platform, t)} · {t("roomChannel.views", { count: formatCompact(v.viewCount, locale) })} · {kstIsoString(v.publishedAt).slice(0, 10).replace(/-/g, ".")}
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

const VIDEO_KINDS = [
  { key: "ALL", label: "roomChannel.videoAll" },
  { key: "VOD", label: "roomChannel.videoVod" },
  { key: "SHORTS", label: "roomChannel.videoShorts" }
] as const;
const videoLength = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;

const SIG_SORTS = [
  { key: "asc", label: "roomChannel.sortPriceAsc" },
  { key: "desc", label: "roomChannel.sortPriceDesc" },
  { key: "name", label: "roomChannel.sortName" }
] as const;

/** 시그니처 — the channel's signature list (prices from the server catalog), sortable like funnation. */
export function SignaturesView({ signatures, donateHref }: { signatures: Signature[]; donateHref: string }) {
  const { t } = useI18n();
  const [sort, setSort] = useState<(typeof SIG_SORTS)[number]["key"]>("asc");
  const list = [...signatures].sort((a, b) => (sort === "name" ? a.name.localeCompare(b.name, "ko") : sort === "asc" ? a.price - b.price : b.price - a.price));
  if (signatures.length === 0) return <p className={styles.empty}>{t("roomChannel.noSignatures")}</p>;
  return (
    <>
      <div className={styles.sorts} role="group" aria-label={t("roomChannel.sort")}>
        {SIG_SORTS.map((s) => (
          <button key={s.key} type="button" className={styles.sort} aria-pressed={sort === s.key} onClick={() => setSort(s.key)}>
            {t(s.label)}
          </button>
        ))}
      </div>
      <ul className={styles.sigGrid}>
        {list.map((s) => (
          <li key={s.id}>
            <Link href={donateHref} className={styles.sigCard} title={t("roomChannel.signatureHint")}>
              <span className={styles.sigImage}>
                <Image src={s.imageUrl} alt="" fill sizes="160px" unoptimized={remote(s.imageUrl)} />
              </span>
              <strong className={styles.sigPrice}>{formatNumber(s.price)} FN</strong>
              <span className={styles.sigName}>{s.name}</span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

export function AboutView({
  about
}: {
  about: { name: string; description: string; categories: CreatorCategory[]; subscriberCount: number; joinedAt: string; platforms: Platform[] };
}) {
  const { t, locale } = useI18n();
  return (
    <dl className={styles.about}>
      <div>
        <dt>{t("roomChannel.aboutBio")}</dt>
        <dd>{about.description}</dd>
      </div>
      <div>
        <dt>{t("roomChannel.aboutCategories")}</dt>
        <dd>{about.categories.map((c) => t(CATEGORY_KEY[c])).join(" · ") || "—"}</dd>
      </div>
      <div>
        <dt>{t("roomChannel.aboutPlatforms")}</dt>
        <dd>{about.platforms.map((p) => platformLabel(p, t)).join(" · ") || "—"}</dd>
      </div>
      <div>
        <dt>{t("roomChannel.aboutSubscribers")}</dt>
        <dd>{t("roomChannel.subscriberCount", { count: formatCompact(about.subscriberCount, locale) })}</dd>
      </div>
      <div>
        <dt>{t("roomChannel.aboutJoined")}</dt>
        <dd>{about.joinedAt.replace(/-/g, ".")}</dd>
      </div>
    </dl>
  );
}
