"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { formatNumber } from "@/lib/format";
import type { PublicSignaturePage } from "@/services/donations/signatureTypes";
import channel from "../creatorRoom/channel.module.css";
import styles from "./signaturePage.module.css";

const SORTS = [
  { key: "order", label: "기본 순서" },
  { key: "asc", label: "낮은 가격순" },
  { key: "desc", label: "높은 가격순" },
  { key: "name", label: "이름순" }
] as const;
type Sort = (typeof SORTS)[number]["key"];

/**
 * 공개 시그니처 페이지 — code-first (no Figma frame; StreamDonate 공개 시그니처 페이지 참고, 2026-10-25). Route
 * `/signatures/[key]`, no login. The channel's active signatures (image · name · price), filtered by group and sorted,
 * each with ▶ to hear its sound — one at a time, stopped when another starts or the same is pressed again.
 */
export function PublicSignaturesView({ page }: { page: PublicSignaturePage }) {
  const [group, setGroup] = useState<string | null>(null);
  const [sort, setSort] = useState<Sort>("order");
  const [playing, setPlaying] = useState<string | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  useEffect(() => () => audio.current?.pause(), []);

  const play = (id: string, url: string) => {
    audio.current?.pause();
    if (playing === id) {
      setPlaying(null);
      return;
    }
    const a = new Audio(url);
    audio.current = a;
    a.onended = () => setPlaying((p) => (p === id ? null : p));
    a.onerror = () => setPlaying((p) => (p === id ? null : p));
    setPlaying(id);
    void a.play().catch(() => setPlaying((p) => (p === id ? null : p)));
  };

  const shown = page.signatures
    .filter((s) => group === null || s.group === group)
    .map((s, i) => ({ s, i }))
    .sort((a, b) => (sort === "asc" ? a.s.price - b.s.price : sort === "desc" ? b.s.price - a.s.price : sort === "name" ? a.s.name.localeCompare(b.s.name, "ko") : a.i - b.i))
    .map(({ s }) => s);

  return (
    <main className={styles.page}>
      <header className={styles.head}>
        <h1>{page.channelName} 시그니처</h1>
        <p>
          시그니처 {page.signatures.length}개 · 소리가 있는 시그니처는 ▶를 눌러 들어 보세요. 시그니처 후원은 채널의 후원하기에서 할 수 있어요.
        </p>
      </header>

      {page.signatures.length === 0 ? (
        <p className={channel.empty}>공개된 시그니처가 없어요.</p>
      ) : (
        <>
          <div className={styles.tools}>
            {page.groups.length > 1 && (
              <div className={channel.sorts} role="group" aria-label="그룹">
                {[null, ...page.groups].map((g) => (
                  <button key={g ?? "all"} type="button" className={channel.sort} aria-pressed={group === g} onClick={() => setGroup(g)}>
                    {g ?? "전체"}
                  </button>
                ))}
              </div>
            )}
            <div className={channel.sorts} role="group" aria-label="정렬">
              {SORTS.map((x) => (
                <button key={x.key} type="button" className={channel.sort} aria-pressed={sort === x.key} onClick={() => setSort(x.key)}>
                  {x.label}
                </button>
              ))}
            </div>
          </div>
          <ul className={channel.sigGrid}>
            {shown.map((s) => (
              <li key={s.id} className={`${channel.sigCard} ${styles.card}`}>
                <span className={channel.sigImage}>
                  <Image src={s.imageUrl} alt="" fill sizes="160px" unoptimized={s.imageUrl.startsWith("/api/")} />
                </span>
                <strong className={channel.sigPrice}>{formatNumber(s.price)} FN</strong>
                <span className={channel.sigName}>{s.name}</span>
                {s.soundUrl && (
                  <button
                    type="button"
                    className={styles.play}
                    aria-pressed={playing === s.id}
                    aria-label={`${s.name} 소리 ${playing === s.id ? "정지" : "재생"}`}
                    onClick={() => play(s.id, s.soundUrl!)}
                  >
                    {playing === s.id ? "■ 정지" : "▶ 재생"}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}
