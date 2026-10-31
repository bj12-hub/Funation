"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { formatNumber } from "@/lib/format";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { MessageKey } from "@/lib/i18n/translate";
import { deleteSignature, deleteSignatures, moveSignature, saveSignature, setSignatureGroupActive } from "@/services/donations/signatures";
import { pairOf, type Asset } from "@/services/creator/assetTypes";
import {
  DEFAULT_SIGNATURE_GROUP,
  MEDIA_GAPS,
  SIGNATURE_IMAGE_PRESETS,
  SIGNATURE_LIMITS,
  SIGNATURE_SORTS,
  mediaGapsOf,
  sortSignatures,
  spanText,
  type ManagedSignature,
  type MediaGap,
  type SignatureMatch,
  type SignaturePageSettings,
  type SignatureResult,
  type SignatureRow,
  type SignatureSort
} from "@/services/donations/signatureTypes";
import styles from "../crew/crew.module.css";
import { BulkSignatures } from "./BulkSignatures";
import { SigPlayerCard } from "./SigPlayerCard";
import { SignatureShareCard } from "./SignatureShareCard";
import local from "./signatures.module.css";
import type { SigPlayerSettings } from "@/services/creator/sigPlayerTypes";

type Draft = Omit<ManagedSignature, "id"> & { id: string | null };

const MATCH_LABEL: Record<SignatureMatch, MessageKey> = { SELECT: "studioToolsSignatures.matchSelect", AMOUNT: "studioToolsSignatures.matchAmount" };
/** 미디어 누락 on a row: what the alert does instead. */
const GAP_NOTE: Record<MediaGap, MessageKey> = {
  IMAGE_MISSING: "studioToolsSignatures.gapImageMissing",
  SOUND_MISSING: "studioToolsSignatures.gapSoundMissing",
  SOUND_NONE: "studioToolsSignatures.soundNone"
};
/** The 미디어 누락 filter chips and 정렬 labels by key (the service's MEDIA_GAPS · SIGNATURE_SORTS stay as written, 2026-11-01). */
const GAP_CHIP: Record<MediaGap, MessageKey> = {
  IMAGE_MISSING: "studioToolsSignatures.chipImageMissing",
  SOUND_MISSING: "studioToolsSignatures.chipSoundMissing",
  SOUND_NONE: "studioToolsSignatures.soundNone"
};
const SORT_KEY: Record<SignatureSort, MessageKey> = {
  ORDER: "studioToolsSignatures.sortOrder",
  PRICE_ASC: "studioToolsSignatures.sortPriceAsc",
  PRICE_DESC: "studioToolsSignatures.sortPriceDesc",
  NEWEST: "studioToolsSignatures.sortNewest",
  OLDEST: "studioToolsSignatures.sortOldest"
};
const blank = (group: string): Draft => ({ id: null, name: "", price: 10_000, imageUrl: SIGNATURE_IMAGE_PRESETS[0], soundUrl: null, match: "SELECT", active: true, rangeMin: null, group });

/**
 * 시그니처 후원 관리 — code-first (no Figma frame). Route `/creator/widgets/signatures`.
 * The list is what supporters see in the room's 시그니처 후원 panel, in this order. `library` is the creator's
 * 이미지·사운드: picking a library image also picks the sound with the same name (자동 매칭, 2026-10-06 결정), and
 * "한 번에 만들기" turns several library images into signatures at once (`?bulk=1` opens it, from the library page).
 * 미디어 누락 (2026-10-25): each row says when its library image or sound was deleted (or it has no sound), and the
 * chips filter the list by it. 정렬 · 전체 선택 · 선택 삭제 (2026-10-28, StreamDonate 시그니처 관리).
 */
export function SignaturesScreen({
  items,
  library,
  startBulk = false,
  publicPage = null,
  sigPlayer = null
}: {
  items: SignatureRow[];
  library: Asset[];
  startBulk?: boolean;
  /** 공개 시그니처 페이지 (2026-10-25); null hides the card. */
  publicPage?: SignaturePageSettings | null;
  /** 시그니처 플레이어 (2026-10-25); null hides the card. */
  sigPlayer?: { settings: SigPlayerSettings; overlayPath: string } | null;
}) {
  const router = useRouter();
  const { t } = useI18n();
  const images = library.filter((a) => a.kind === "IMAGE");
  const sounds = library.filter((a) => a.kind === "SOUND");
  const soundName = (url: string | null) => sounds.find((a) => a.url === url)?.name ?? null;
  const [draft, setDraft] = useState<Draft | null>(null);
  const [bulk, setBulk] = useState(startBulk);
  /** The sound was picked by 자동 매칭 (a hand-picked sound is never replaced). */
  const [autoSound, setAutoSound] = useState(false);
  const [note, setNote] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const requestId = useRef<string | null>(null);
  /** 그룹 필터 (2026-10-23): null = 전체. */
  const [groupFilter, setGroupFilter] = useState<string | null>(null);
  const groups = [...new Set(items.map((s) => s.group))];
  const filter = groupFilter !== null && groups.includes(groupFilter) ? groupFilter : null;
  /** 미디어 누락 필터: null = 전체; a kind no signature has any more falls back to 전체. */
  const [gapFilter, setGapFilter] = useState<MediaGap | null>(null);
  const gaps = MEDIA_GAPS.map((g) => ({ ...g, count: items.filter((s) => mediaGapsOf(s.media).includes(g.key)).length })).filter((g) => g.count > 0);
  const gap = gaps.some((g) => g.key === gapFilter) ? gapFilter : null;
  const inGroup = filter === null ? items : items.filter((s) => s.group === filter);
  const shown = gap === null ? inGroup : inGroup.filter((s) => mediaGapsOf(s.media).includes(gap));
  /** 정렬 (2026-10-28): a view only — ↑ ↓ move the room's order, so they work on 기본 순서. */
  const [sort, setSort] = useState<SignatureSort>("ORDER");
  const listed = sortSignatures(shown, sort);
  /** 선택 삭제 (2026-10-28): the picked ones still listed under the filters. */
  const [picked, setPicked] = useState<string[]>([]);
  const selected = picked.filter((id) => shown.some((s) => s.id === id));
  const allPicked = shown.length > 0 && shown.every((s) => selected.includes(s.id));
  const pick = (id: string, on: boolean) => setPicked((p) => (on ? [...p.filter((x) => x !== id), id] : p.filter((x) => x !== id)));

  const run = (action: () => Promise<SignatureResult>, ok: string, after?: () => void) => {
    setNote(null);
    startTransition(async () => {
      try {
        const res = await action();
        if (res.status === "SAVED") {
          setNote({ tone: "ok", text: ok });
          after?.();
          router.refresh();
        } else setNote({ tone: "error", text: res.status === "INVALID" ? res.message : t("studioTools.loginRequired") });
      } catch {
        setNote({ tone: "error", text: t("studioTools.processFailed") });
      }
    });
  };

  const openNew = () => {
    requestId.current = null;
    setAutoSound(false);
    setBulk(false);
    setDraft(blank(filter ?? DEFAULT_SIGNATURE_GROUP));
  };
  const openBulk = () => {
    setDraft(null);
    setNote(null);
    setBulk(true);
  };
  const pickImage = (src: string) => {
    if (!draft) return;
    const image = images.find((a) => a.url === src);
    const match = image ? pairOf(image, library) : null;
    if (draft.soundUrl === null || autoSound) {
      setDraft({ ...draft, imageUrl: src, soundUrl: match?.url ?? null });
      setAutoSound(!!match);
    } else setDraft({ ...draft, imageUrl: src });
  };
  const submit = () => {
    if (!draft) return;
    if (!draft.id) requestId.current ??= crypto.randomUUID();
    run(() => saveSignature({ ...draft, requestId: requestId.current }), draft.id ? t("studioToolsSignatures.updated") : t("studioToolsSignatures.created"), () => {
      requestId.current = null;
      setDraft(null);
    });
  };
  const toggle = (s: ManagedSignature) =>
    run(() => saveSignature({ ...s, active: !s.active }), s.active ? t("studioToolsSignatures.hiddenToast", { name: s.name }) : t("studioToolsSignatures.shownToast", { name: s.name }));
  const remove = (s: ManagedSignature) => {
    if (window.confirm(t("studioToolsSignatures.confirmDelete", { name: s.name }))) run(() => deleteSignature(s.id), t("studioToolsSignatures.deleted"));
  };
  const removeSelected = () => {
    const ids = selected;
    if (window.confirm(t("studioToolsSignatures.confirmDeleteSelected", { count: ids.length })))
      run(() => deleteSignatures({ ids }), t("studioToolsSignatures.deletedCount", { count: ids.length }), () => setPicked([]));
  };
  const matchLabels = { SELECT: t(MATCH_LABEL.SELECT), AMOUNT: t(MATCH_LABEL.AMOUNT) };

  const activeCount = items.filter((s) => s.active).length;

  return (
    <div className={styles.content}>
      <header className={styles.header}>
        <h1 className={styles.title}>{t("studioToolsSignatures.title")}</h1>
        <p className={styles.subtitle}>{t("studioToolsSignatures.subtitle")}</p>
        <p className={styles.note}>
          <Link href="/creator/widgets">{t("studioTools.backWidgets")}</Link>
          {t("studioToolsSignatures.counts", { active: activeCount, total: items.length, max: SIGNATURE_LIMITS.max })}
        </p>
      </header>

      <section className={styles.card} aria-labelledby="sig-list">
        <div className={styles.cardHead}>
          <h2 className={styles.cardTitle} id="sig-list">
            {t("studioToolsSignatures.listTitle")}
          </h2>
          <div className={styles.rowActions}>
            <button type="button" className={styles.ghost} onClick={openBulk} disabled={pending || bulk}>
              {t("studioToolsSignatures.bulk")}
            </button>
            <button type="button" className={styles.primary} onClick={openNew} disabled={pending || items.length >= SIGNATURE_LIMITS.max}>
              {t("studioToolsSignatures.add")}
            </button>
          </div>
        </div>
        <p className={styles.note}>
          <strong>{t("studioToolsSignatures.matchNoteStrong")}</strong>
          {t("studioToolsSignatures.matchNoteRest")}
        </p>
        {groups.length > 0 && (
          <div className={local.groups} role="group" aria-label={t("studioToolsSignatures.group")}>
            <span className={styles.segment}>
              <button type="button" aria-pressed={filter === null} onClick={() => setGroupFilter(null)}>
                {t("studioToolsSignatures.all", { count: items.length })}
              </button>
              {groups.map((g) => (
                <button key={g} type="button" aria-pressed={filter === g} onClick={() => setGroupFilter(g)}>
                  {g} {items.filter((s) => s.group === g).length}
                </button>
              ))}
            </span>
            {filter !== null && (
              <span className={styles.rowActions}>
                <button
                  type="button"
                  className={styles.ghost}
                  disabled={pending || inGroup.every((s) => s.active)}
                  onClick={() => run(() => setSignatureGroupActive({ group: filter, active: true }), t("studioToolsSignatures.groupShown", { group: filter }))}
                >
                  {t("studioToolsSignatures.groupShowAll")}
                </button>
                <button
                  type="button"
                  className={styles.ghost}
                  disabled={pending || inGroup.every((s) => !s.active)}
                  onClick={() => run(() => setSignatureGroupActive({ group: filter, active: false }), t("studioToolsSignatures.groupHidden", { group: filter }))}
                >
                  {t("studioToolsSignatures.groupHideAll")}
                </button>
              </span>
            )}
          </div>
        )}
        {gaps.length > 0 && (
          <div className={local.groups} role="group" aria-label={t("studioToolsSignatures.mediaAria")}>
            <span className={styles.segment}>
              <button type="button" aria-pressed={gap === null} onClick={() => setGapFilter(null)}>
                {t("studioToolsSignatures.mediaAll")}
              </button>
              {gaps.map((g) => (
                <button key={g.key} type="button" aria-pressed={gap === g.key} onClick={() => setGapFilter(g.key)}>
                  {t(GAP_CHIP[g.key])} {g.count}
                </button>
              ))}
            </span>
          </div>
        )}
        {items.length > 0 && (
          <div className={local.groups} role="group" aria-label={t("studioToolsSignatures.sortPickAria")}>
            <span className={styles.segment} role="group" aria-label={t("studioToolsSignatures.sort")}>
              {SIGNATURE_SORTS.map((o) => (
                <button key={o.key} type="button" aria-pressed={sort === o.key} onClick={() => setSort(o.key)}>
                  {t(SORT_KEY[o.key])}
                </button>
              ))}
            </span>
            <span className={styles.rowActions}>
              <button type="button" className={styles.ghost} disabled={pending || shown.length === 0} onClick={() => setPicked(allPicked ? [] : shown.map((s) => s.id))}>
                {allPicked ? t("studioToolsSignatures.unselect") : t("studioToolsSignatures.selectAll")}
              </button>
              <button type="button" className={styles.danger} disabled={pending || selected.length === 0} onClick={removeSelected}>
                {t("studioToolsSignatures.deleteSelected")}
                {selected.length ? ` (${selected.length})` : ""}
              </button>
            </span>
          </div>
        )}
        {sort !== "ORDER" && <p className={styles.note}>{t("studioToolsSignatures.sortedNote")}</p>}
        {items.length === 0 ? (
          <p className={styles.empty}>{t("studioToolsSignatures.empty")}</p>
        ) : shown.length === 0 ? (
          <p className={styles.empty}>{t("studioToolsSignatures.noMatch")}</p>
        ) : (
          <ul className={styles.list}>
            {listed.map((s) => {
              const i = items.indexOf(s);
              // Missing media: the row shows what the alert shows (the first preset), and says so in a warning line.
              const warnings = mediaGapsOf(s.media).filter((g) => g !== "SOUND_NONE");
              return (
              <li key={s.id} className={styles.row} data-inactive={s.active ? undefined : ""}>
                <input
                  type="checkbox"
                  className={local.pick}
                  aria-label={t("studioToolsSignatures.pickAria", { name: s.name })}
                  checked={selected.includes(s.id)}
                  onChange={(e) => pick(s.id, e.target.checked)}
                />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className={local.thumb} src={s.media.image === "MISSING" ? SIGNATURE_IMAGE_PRESETS[0] : s.imageUrl} alt="" />
                <div className={styles.rowMain}>
                  <span className={styles.rowTitle}>{s.name}</span>
                  <span className={styles.muted}>
                    {s.match === "AMOUNT" ? spanText(s) : `${formatNumber(s.price)} FN`} · {t(MATCH_LABEL[s.match])}
                    {soundName(s.soundUrl) && ` · 🔊 ${soundName(s.soundUrl)}`}
                    {s.media.sound === "NONE" && ` · ${t(GAP_NOTE.SOUND_NONE)}`}
                    {groups.length > 1 && ` · ${s.group}`}
                  </span>
                  {warnings.map((g) => (
                    <span key={g} className={local.gap}>
                      ⚠ {t(GAP_NOTE[g])}
                    </span>
                  ))}
                </div>
                <span className={s.active ? styles.chip : styles.chipOff}>{s.active ? t("studioToolsSignatures.chipOn") : t("studioToolsSignatures.chipHidden")}</span>
                <div className={styles.rowActions}>
                  <button
                    type="button"
                    className={styles.ghost}
                    aria-label={t("studioToolsSignatures.upAria", { name: s.name })}
                    disabled={pending || sort !== "ORDER" || i === 0}
                    onClick={() => run(() => moveSignature({ id: s.id, dir: "up" }), t("studioToolsSignatures.moved"))}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className={styles.ghost}
                    aria-label={t("studioToolsSignatures.downAria", { name: s.name })}
                    disabled={pending || sort !== "ORDER" || i === items.length - 1}
                    onClick={() => run(() => moveSignature({ id: s.id, dir: "down" }), t("studioToolsSignatures.moved"))}
                  >
                    ↓
                  </button>
                  <button type="button" className={styles.ghost} disabled={pending} onClick={() => toggle(s)}>
                    {s.active ? t("studioToolsSignatures.hide") : t("studioToolsSignatures.show")}
                  </button>
                  <button
                    type="button"
                    className={styles.ghost}
                    disabled={pending}
                    onClick={() => {
                      // A sound that is still the image's 짝 keeps following the image (자동 매칭) while editing.
                      const image = images.find((a) => a.url === s.imageUrl);
                      setAutoSound(!!s.soundUrl && !!image && pairOf(image, library)?.url === s.soundUrl);
                      setBulk(false);
                      setDraft({ ...s, soundUrl: soundName(s.soundUrl) ? s.soundUrl : null });
                    }}
                  >
                    {t("studioToolsSignatures.edit")}
                  </button>
                  <button type="button" className={styles.danger} disabled={pending} onClick={() => remove(s)}>
                    {t("studioTools.delete")}
                  </button>
                </div>
              </li>
              );
            })}
          </ul>
        )}
      </section>

      {bulk && (
        <BulkSignatures
          items={items}
          library={library}
          matchLabels={matchLabels}
          onClose={() => setBulk(false)}
          onDone={(count) => {
            setBulk(false);
            setNote({ tone: "ok", text: t("studioToolsSignatures.bulkDone", { count }) });
            router.refresh();
          }}
        />
      )}

      {draft && (
        <section className={styles.card} aria-labelledby="sig-edit">
          <div className={styles.cardHead}>
            <h2 className={styles.cardTitle} id="sig-edit">
              {draft.id ? t("studioToolsSignatures.editTitle") : t("studioToolsSignatures.newTitle")}
            </h2>
          </div>
          <div className={local.form}>
            <label className={local.field}>
              <span>{t("studioToolsSignatures.name")}</span>
              <input className={styles.input} maxLength={SIGNATURE_LIMITS.nameMax} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </label>
            <label className={local.field}>
              <span>{t("studioToolsSignatures.price")}</span>
              <input
                className={styles.input}
                type="number"
                min={SIGNATURE_LIMITS.priceMin}
                max={SIGNATURE_LIMITS.priceMax}
                value={draft.price}
                onChange={(e) => setDraft({ ...draft, price: Math.floor(Number(e.target.value) || 0) })}
              />
            </label>
            <label className={local.field}>
              <span>{t("studioToolsSignatures.matchRule")}</span>
              <select className={styles.select} value={draft.match} onChange={(e) => setDraft({ ...draft, match: e.target.value as SignatureMatch })}>
                {(Object.keys(MATCH_LABEL) as SignatureMatch[]).map((m) => (
                  <option key={m} value={m}>
                    {t(MATCH_LABEL[m])}
                  </option>
                ))}
              </select>
            </label>
            {draft.match === "AMOUNT" && (
              <label className={local.field}>
                <span>{t("studioToolsSignatures.rangeStart")}</span>
                <input
                  className={styles.input}
                  type="number"
                  min={SIGNATURE_LIMITS.priceMin}
                  max={Math.max(SIGNATURE_LIMITS.priceMin, draft.price - 1)}
                  placeholder={t("studioToolsSignatures.rangePlaceholder")}
                  value={draft.rangeMin ?? ""}
                  onChange={(e) => setDraft({ ...draft, rangeMin: e.target.value === "" ? null : Math.floor(Number(e.target.value) || 0) })}
                />
              </label>
            )}
            <label className={local.field}>
              <span>{t("studioToolsSignatures.group")}</span>
              <input className={styles.input} list="sig-groups" maxLength={SIGNATURE_LIMITS.groupMax} placeholder={DEFAULT_SIGNATURE_GROUP} value={draft.group} onChange={(e) => setDraft({ ...draft, group: e.target.value })} />
              <datalist id="sig-groups">
                {groups.map((g) => (
                  <option key={g} value={g} />
                ))}
              </datalist>
            </label>
            <label className={styles.checkRow}>
              <input type="checkbox" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} />
              {t("studioToolsSignatures.showInRoom")}
            </label>
          </div>
          {draft.match === "AMOUNT" && draft.rangeMin !== null && draft.rangeMin < draft.price && (
            <p className={styles.note}>{t("studioToolsSignatures.rangeNote", { from: formatNumber(draft.rangeMin), to: formatNumber(draft.price) })}</p>
          )}
          <div className={local.images} role="radiogroup" aria-label={t("studioToolsSignatures.imagesAria")}>
            {[...SIGNATURE_IMAGE_PRESETS, ...images.map((a) => a.url)].map((src, i) => (
              <button
                key={src}
                type="button"
                role="radio"
                aria-checked={draft.imageUrl === src}
                aria-label={t("studioToolsSignatures.imageN", { n: i + 1 })}
                className={local.image}
                onClick={() => pickImage(src)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" />
              </button>
            ))}
          </div>
          <p className={styles.note}>
            {t("studioToolsSignatures.libraryBefore", { count: SIGNATURE_IMAGE_PRESETS.length })}
            <Link href="/creator/widgets/assets">{t("studioTools.assetsLink")}</Link>
            {t("studioToolsSignatures.libraryAfter")}
          </p>
          <div className={local.sound}>
            <label className={local.field}>
              <span>{t("studioToolsSignatures.soundLabel")}</span>
              <select
                className={styles.select}
                value={draft.soundUrl ?? ""}
                onChange={(e) => {
                  setAutoSound(false);
                  setDraft({ ...draft, soundUrl: e.target.value || null });
                }}
              >
                <option value="">{t("studioToolsSignatures.soundNone")}</option>
                {sounds.map((a) => (
                  <option key={a.id} value={a.url}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
            {draft.soundUrl && <audio className={local.audio} src={draft.soundUrl} controls preload="none" aria-label={t("studioToolsSignatures.previewSound")} />}
            {autoSound && draft.soundUrl && (
              <p className={styles.note} role="status">
                {t("studioToolsSignatures.autoSound", { name: soundName(draft.soundUrl) ?? "" })}
              </p>
            )}
            {sounds.length === 0 && <p className={styles.note}>{t("studioToolsSignatures.noSounds")}</p>}
          </div>
          <div className={styles.actions}>
            <button type="button" className={styles.ghost} disabled={pending} onClick={() => setDraft(null)}>
              {t("studioTools.cancel")}
            </button>
            <button type="button" className={styles.primary} disabled={pending} onClick={submit}>
              {pending ? t("studioTools.saving") : t("studioTools.save")}
            </button>
          </div>
        </section>
      )}

      {note && (
        <p className={note.tone === "error" ? styles.error : styles.ok} role={note.tone === "error" ? "alert" : "status"}>
          {note.text}
        </p>
      )}

      {sigPlayer && <SigPlayerCard initial={sigPlayer.settings} overlayPath={sigPlayer.overlayPath} />}
      {publicPage && <SignatureShareCard page={publicPage} />}
    </div>
  );
}
