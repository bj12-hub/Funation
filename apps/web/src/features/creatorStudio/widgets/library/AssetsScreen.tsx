"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { MessageKey } from "@/lib/i18n/translate";
import { deleteAsset, renameAsset, uploadAsset } from "@/services/creator/assets";
import { ASSET_LIMITS, ASSET_SORTS, ASSET_TYPES, filterAssets, pairOf, type Asset, type AssetKind, type AssetResult, type AssetSort } from "@/services/creator/assetTypes";
import styles from "../../crew/crew.module.css";
import local from "./library.module.css";

const KIND_LABEL: Record<AssetKind, MessageKey> = { IMAGE: "studioToolsLibrary.kindImage", SOUND: "studioToolsLibrary.kindSound", VIDEO: "studioToolsLibrary.kindVideo" };
/** The empty lines per kind, whole sentences (Korean: 영상 takes 이 — it ends in a consonant). */
const KIND_EMPTY: Record<AssetKind, MessageKey> = { IMAGE: "studioToolsLibrary.emptyImage", SOUND: "studioToolsLibrary.emptySound", VIDEO: "studioToolsLibrary.emptyVideo" };
const KIND_NO_MATCH: Record<AssetKind, MessageKey> = { IMAGE: "studioToolsLibrary.noMatchImage", SOUND: "studioToolsLibrary.noMatchSound", VIDEO: "studioToolsLibrary.noMatchVideo" };
/** 정렬 labels by key (the service's ASSET_SORTS stay as written, 2026-11-01). */
const SORT_KEY: Record<AssetSort, MessageKey> = { NEW: "studioToolsLibrary.sortNew", OLD: "studioToolsLibrary.sortOld", NAME: "studioToolsLibrary.sortName", SIZE: "studioToolsLibrary.sortSize" };
const size = (bytes: number) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)}MB` : `${Math.max(1, Math.round(bytes / 1024))}KB`);

/**
 * 이미지·사운드 라이브러리 — code-first (no Figma frame). Route `/creator/widgets/assets`.
 * Files here are used by 배너 (slides) and 시그니처 후원 (images, and sounds — an image and a sound with the same
 * name pair up, 자동 매칭 2026-10-06). Name search, 정렬 and a 짝 filter (funnation "정렬·필터") work on the loaded
 * list. Upload policy and review are TBD.
 */
export function AssetsScreen({ items }: { items: Asset[] }) {
  const router = useRouter();
  const { t } = useI18n();
  const [tab, setTab] = useState<AssetKind>("IMAGE");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<AssetSort>("NEW");
  const [pairedOnly, setPairedOnly] = useState(false);
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const [note, setNote] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const run = (action: () => Promise<AssetResult>, okText: string, after?: () => void) => {
    setNote(null);
    startTransition(async () => {
      try {
        const res = await action();
        if (res.status === "SAVED" || res.status === "DELETED") {
          setNote({ tone: "ok", text: okText });
          after?.();
          router.refresh();
        } else setNote({ tone: "error", text: res.status === "INVALID" ? res.message : t("studioTools.loginRequired") });
      } catch {
        setNote({ tone: "error", text: t("studioToolsLibrary.processFailedSize") });
      }
    });
  };

  const upload = (files: FileList | null) => {
    const list = [...(files ?? [])];
    if (!list.length) return;
    setNote(null);
    startTransition(async () => {
      let ok = 0;
      let error: string | null = null;
      for (const file of list) {
        const fd = new FormData();
        fd.set("requestId", crypto.randomUUID());
        fd.set("file", file);
        try {
          const res = await uploadAsset(fd);
          if (res.status === "SAVED") ok++;
          else error = res.status === "INVALID" ? `${file.name}: ${res.message}` : t("studioTools.loginRequired");
        } catch {
          error = t("studioToolsLibrary.uploadFailed", { file: file.name });
        }
      }
      if (fileRef.current) fileRef.current.value = "";
      setNote(error ? { tone: "error", text: ok ? t("studioToolsLibrary.uploadedWithError", { count: ok, error }) : error } : { tone: "ok", text: t("studioToolsLibrary.uploaded", { count: ok }) });
      router.refresh();
    });
  };

  const ofKind = items.filter((a) => a.kind === tab).length;
  const shown = filterAssets(items, { kind: tab, query, sort, pairedOnly });
  const used = items.reduce((sum, a) => sum + a.size, 0);

  return (
    <div className={styles.content}>
      <header className={styles.header}>
        <h1 className={styles.title}>{t("studioToolsLibrary.title")}</h1>
        <p className={styles.subtitle}>{t("studioToolsLibrary.subtitle")}</p>
        <p className={styles.note}>
          <Link href="/creator/widgets">{t("studioTools.backWidgets")}</Link>
          {t("studioToolsLibrary.usage", { used: size(used), total: ASSET_LIMITS.totalBytes / 1024 / 1024, count: items.length, max: ASSET_LIMITS.max })}
        </p>
      </header>

      <section className={styles.card} aria-labelledby="asset-upload">
        <div className={styles.cardHead}>
          <h2 className={styles.cardTitle} id="asset-upload">
            {t("studioToolsLibrary.uploadTitle")}
          </h2>
          <button type="button" className={styles.primary} disabled={pending} onClick={() => fileRef.current?.click()}>
            {pending ? t("studioToolsLibrary.processing") : t("studioToolsLibrary.chooseFiles")}
          </button>
          <input
            ref={fileRef}
            className={local.hiddenInput}
            type="file"
            multiple
            accept={[...ASSET_TYPES.IMAGE, ...ASSET_TYPES.SOUND, ...ASSET_TYPES.VIDEO].join(",")}
            aria-label={t("studioToolsLibrary.filesAria")}
            onChange={(e) => upload(e.target.files)}
          />
        </div>
        <p className={styles.note}>
          {t("studioToolsLibrary.typesBefore", {
            image: ASSET_LIMITS.bytes.IMAGE / 1024 / 1024,
            sound: ASSET_LIMITS.bytes.SOUND / 1024 / 1024,
            video: ASSET_LIMITS.bytes.VIDEO / 1024 / 1024
          })}
          <Link href="/creator/widgets/effects">{t("studioToolsLibrary.typesLink")}</Link>
          {t("studioToolsLibrary.typesAfter")}
        </p>
        <p className={styles.note}>
          {t("studioToolsLibrary.pairBefore")}
          <Link href="/creator/widgets/signatures">{t("studioToolsLibrary.pairLink")}</Link>
          {t("studioToolsLibrary.pairAfter")}
        </p>
        <p className={styles.note}>
          {t("studioToolsLibrary.bulkBefore")}
          <Link href="/creator/widgets/signatures?bulk=1">{t("studioToolsLibrary.bulkLink")}</Link>
          {t("studioToolsLibrary.bulkAfter")}
        </p>
      </section>

      <section className={styles.card} aria-labelledby="asset-list">
        <div className={styles.cardHead}>
          <h2 className={styles.cardTitle} id="asset-list">
            {t("studioToolsLibrary.libraryTitle")}
          </h2>
          <div className={styles.tabs} role="tablist" aria-label={t("studioToolsLibrary.kindsAria")}>
            {(Object.keys(KIND_LABEL) as AssetKind[]).map((k) => (
              <button key={k} type="button" role="tab" aria-selected={tab === k} aria-current={tab === k ? "page" : undefined} className={styles.tab} onClick={() => setTab(k)}>
                {t(KIND_LABEL[k])} {items.filter((a) => a.kind === k).length}
              </button>
            ))}
          </div>
        </div>
        {ofKind > 0 && (
          <div className={local.filters}>
            <input
              className={styles.input}
              type="search"
              placeholder={t("studioToolsLibrary.search")}
              aria-label={t("studioToolsLibrary.search")}
              maxLength={ASSET_LIMITS.nameMax}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <select className={styles.select} aria-label={t("studioToolsLibrary.sort")} value={sort} onChange={(e) => setSort(e.target.value as AssetSort)}>
              {ASSET_SORTS.map((o) => (
                <option key={o.key} value={o.key}>
                  {t(SORT_KEY[o.key])}
                </option>
              ))}
            </select>
            {tab !== "VIDEO" && (
              <label className={styles.checkRow}>
                <input type="checkbox" checked={pairedOnly} onChange={(e) => setPairedOnly(e.target.checked)} />
                {t("studioToolsLibrary.pairedOnly")}
              </label>
            )}
            <span className={styles.muted} role="status">
              {shown.length === ofKind ? t("studioToolsLibrary.countAll", { count: ofKind }) : t("studioToolsLibrary.countFiltered", { total: ofKind, shown: shown.length })}
            </span>
          </div>
        )}
        {ofKind === 0 ? (
          <p className={styles.empty}>{t(KIND_EMPTY[tab])}</p>
        ) : shown.length === 0 ? (
          <p className={styles.empty}>{t(KIND_NO_MATCH[tab])}</p>
        ) : (
          <ul className={tab === "IMAGE" ? local.grid : styles.list}>
            {shown.map((a) => (
              <li key={a.id} className={tab === "IMAGE" ? local.tile : styles.row}>
                {a.kind === "IMAGE" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className={local.preview} src={a.url} alt={a.name} />
                ) : a.kind === "VIDEO" ? (
                  <video className={local.video} src={a.url} controls muted playsInline preload="metadata" aria-label={t("studioToolsLibrary.previewVideo", { name: a.name })} />
                ) : (
                  <audio className={local.audio} src={a.url} controls preload="none" aria-label={t("studioToolsLibrary.previewAudio", { name: a.name })} />
                )}
                <div className={styles.rowMain}>
                  {editing?.id === a.id ? (
                    <input
                      className={styles.input}
                      aria-label={t("studioToolsLibrary.newName")}
                      maxLength={ASSET_LIMITS.nameMax}
                      value={editing.name}
                      onChange={(e) => setEditing({ id: a.id, name: e.target.value })}
                      onKeyDown={(e) => e.key === "Enter" && run(() => renameAsset(editing), t("studioToolsLibrary.renamed"), () => setEditing(null))}
                    />
                  ) : (
                    <span className={styles.rowTitle}>{a.name}</span>
                  )}
                  <span className={styles.muted}>
                    {a.mime.split("/")[1].toUpperCase()} · {size(a.size)}
                    {pairOf(a, items) && t(a.kind === "IMAGE" ? "studioToolsLibrary.pairSound" : "studioToolsLibrary.pairImage")}
                  </span>
                </div>
                <div className={styles.rowActions}>
                  {editing?.id === a.id ? (
                    <button type="button" className={styles.ghost} disabled={pending} onClick={() => run(() => renameAsset(editing), t("studioToolsLibrary.renamed"), () => setEditing(null))}>
                      {t("studioTools.save")}
                    </button>
                  ) : (
                    <button type="button" className={styles.ghost} disabled={pending} onClick={() => setEditing({ id: a.id, name: a.name })}>
                      {t("studioToolsLibrary.rename")}
                    </button>
                  )}
                  <button
                    type="button"
                    className={styles.danger}
                    disabled={pending}
                    onClick={() => window.confirm(t("studioToolsLibrary.deleteConfirm", { name: a.name })) && run(() => deleteAsset(a.id), t("studioToolsLibrary.fileDeleted"))}
                  >
                    {t("studioTools.delete")}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {note && (
        <p className={note.tone === "error" ? styles.error : styles.ok} role={note.tone === "error" ? "alert" : "status"}>
          {note.text}
        </p>
      )}
    </div>
  );
}
