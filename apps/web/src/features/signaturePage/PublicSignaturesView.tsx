"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { formatNumber } from "@/lib/format";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { PublicSignaturePage } from "@/services/donations/signatureTypes";
import channel from "../creatorRoom/channel.module.css";
import styles from "./signaturePage.module.css";

const SORTS = [
  { key: "order", label: "signaturePage.sortOrder" },
  { key: "asc", label: "signaturePage.sortAsc" },
  { key: "desc", label: "signaturePage.sortDesc" },
  { key: "name", label: "signaturePage.sortName" }
] as const;
type Sort = (typeof SORTS)[number]["key"];

/**
 * 공개 시그니처 페이지 — code-first (no Figma frame; StreamDonate 공개 시그니처 페이지 참고, 2026-10-25). Route
 * `/signatures/[key]`, no login. The channel's active signatures (image · name · price), filtered by group and sorted,
 * each with ▶ to hear its sound — one at a time, stopped when another starts or the same is pressed again.
 */
export function PublicSignaturesView({ page }: { page: PublicSignaturePage }) {
  const { t } = useI18n();
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
        <h1>{t("signaturePage.title", { channel: page.channelName })}</h1>
        <p>
          {t("signaturePage.lead", { count: page.signatures.length })}
        </p>
      </header>

      {page.signatures.length === 0 ? (
        <p className={channel.empty}>{t("signaturePage.empty")}</p>
      ) : (
        <>
          <div className={styles.tools}>
            {page.groups.length > 1 && (
              <div className={channel.sorts} role="group" aria-label={t("signaturePage.group")}>
                {[null, ...page.groups].map((g) => (
                  <button key={g ?? "all"} type="button" className={channel.sort} aria-pressed={group === g} onClick={() => setGroup(g)}>
                    {g ?? t("signaturePage.all")}
                  </button>
                ))}
              </div>
            )}
            <div className={channel.sorts} role="group" aria-label={t("signaturePage.sort")}>
              {SORTS.map((x) => (
                <button key={x.key} type="button" className={channel.sort} aria-pressed={sort === x.key} onClick={() => setSort(x.key)}>
                  {t(x.label)}
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
                    aria-label={t(playing === s.id ? "signaturePage.soundStop" : "signaturePage.soundPlay", { name: s.name })}
                    onClick={() => play(s.id, s.soundUrl!)}
                  >
                    {playing === s.id ? t("signaturePage.stop") : t("signaturePage.play")}
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
