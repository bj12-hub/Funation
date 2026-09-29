"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { formatCompactKo, formatNumber } from "@/lib/format";
import { CREATOR_CATEGORY_LABEL, type CreatorCategory } from "@/services/creators/creators";
import { crewRoleLabel, type CrewPublic } from "@/services/crew/crewTypes";
import type { Signature } from "@/services/donations/donationCatalog";
import { PLATFORM_LABEL, type Platform } from "@/types/platform";
import { CHANNEL_VIEWS, type ChannelView } from "./channelView";
import styles from "./channel.module.css";

/**
 * Creator channel tabs other than 홈 — structure follows the funnation channel page
 * (홈 · 크루 · 영상 · 커뮤니티 · 시그니처 · 소개). Code-first; visuals from existing tokens.
 */

export function ChannelTabs({ creatorId, active }: { creatorId: string; active: ChannelView }) {
  return (
    <nav className={styles.tabs} aria-label="채널 메뉴">
      {CHANNEL_VIEWS.map((v) => (
        <Link key={v.key} href={v.key === "home" ? `/creators/${creatorId}` : `/creators/${creatorId}?view=${v.key}`} className={styles.tab} aria-current={active === v.key ? "page" : undefined} scroll={false}>
          {v.label}
        </Link>
      ))}
    </nav>
  );
}

export function CrewView({ crew, name }: { crew: CrewPublic; name: string }) {
  if (crew.members.length === 0) return <p className={styles.empty}>{name} 채널에 등록된 크루 멤버가 없어요.</p>;
  return (
    <ul className={styles.crewGrid} aria-label="크루 멤버">
      {crew.members.map((m) => (
        <li key={m.id} className={styles.crewCard}>
          <span className={styles.crewDot} style={{ background: m.color }} aria-hidden="true">
            {m.name.slice(0, 1)}
          </span>
          <strong>{m.name}</strong>
          <span className={styles.muted}>{crewRoleLabel(m.role)}</span>
        </li>
      ))}
    </ul>
  );
}

/** 영상 — VOD needs the YouTube integration (TBD). */
export function VideosView({ name }: { name: string }) {
  return <p className={styles.empty}>{name} 님의 다시보기 · 쇼츠는 영상 연동 후 여기에 표시돼요.</p>;
}

const SIG_SORTS = [
  { key: "asc", label: "금액 낮은순" },
  { key: "desc", label: "금액 높은순" },
  { key: "name", label: "이름순" }
] as const;

/** 시그니처 — the channel's signature list (prices from the server catalog), sortable like funnation. */
export function SignaturesView({ signatures, donateHref }: { signatures: Signature[]; donateHref: string }) {
  const [sort, setSort] = useState<(typeof SIG_SORTS)[number]["key"]>("asc");
  const list = [...signatures].sort((a, b) => (sort === "name" ? a.name.localeCompare(b.name, "ko") : sort === "asc" ? a.price - b.price : b.price - a.price));
  if (signatures.length === 0) return <p className={styles.empty}>등록된 시그니처가 없어요.</p>;
  return (
    <>
      <div className={styles.sorts} role="group" aria-label="정렬">
        {SIG_SORTS.map((s) => (
          <button key={s.key} type="button" className={styles.sort} aria-pressed={sort === s.key} onClick={() => setSort(s.key)}>
            {s.label}
          </button>
        ))}
      </div>
      <ul className={styles.sigGrid}>
        {list.map((s) => (
          <li key={s.id}>
            <Link href={donateHref} className={styles.sigCard} title="후원 패널에서 시그니처를 골라 후원해요">
              <span className={styles.sigImage}>
                <Image src={s.imageUrl} alt="" fill sizes="160px" />
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
  return (
    <dl className={styles.about}>
      <div>
        <dt>소개</dt>
        <dd>{about.description}</dd>
      </div>
      <div>
        <dt>카테고리</dt>
        <dd>{about.categories.map((c) => CREATOR_CATEGORY_LABEL[c]).join(" · ") || "—"}</dd>
      </div>
      <div>
        <dt>방송 플랫폼</dt>
        <dd>{about.platforms.map((p) => PLATFORM_LABEL[p]).join(" · ") || "—"}</dd>
      </div>
      <div>
        <dt>구독자</dt>
        <dd>{formatCompactKo(about.subscriberCount)}명</dd>
      </div>
      <div>
        <dt>썸네이션 가입</dt>
        <dd>{about.joinedAt.replace(/-/g, ".")}</dd>
      </div>
    </dl>
  );
}
