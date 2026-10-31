"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { formatNumber } from "@/lib/format";
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

const MATCH_LABEL: Record<SignatureMatch, string> = { SELECT: "선택 시에만", AMOUNT: "선택 + 금액 일치" };
/** 미디어 누락 on a row: what the alert does instead. */
const GAP_NOTE: Record<MediaGap, string> = {
  IMAGE_MISSING: "이미지가 지워졌어요 — 알림은 기본 이미지로 나가요",
  SOUND_MISSING: "소리가 지워졌어요 — 알림은 소리 없이 나가요",
  SOUND_NONE: "소리 없음"
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
        } else setNote({ tone: "error", text: res.status === "INVALID" ? res.message : "로그인이 필요합니다." });
      } catch {
        setNote({ tone: "error", text: "처리하지 못했어요. 잠시 후 다시 시도해 주세요." });
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
    run(() => saveSignature({ ...draft, requestId: requestId.current }), draft.id ? "시그니처를 수정했어요." : "시그니처를 만들었어요.", () => {
      requestId.current = null;
      setDraft(null);
    });
  };
  const toggle = (s: ManagedSignature) => run(() => saveSignature({ ...s, active: !s.active }), s.active ? `${s.name} 숨김` : `${s.name} 사용`);
  const remove = (s: ManagedSignature) => {
    if (window.confirm(`'${s.name}' 시그니처를 삭제할까요?`)) run(() => deleteSignature(s.id), "시그니처를 삭제했어요.");
  };
  const removeSelected = () => {
    const ids = selected;
    if (window.confirm(`선택한 시그니처 ${ids.length}개를 삭제할까요? 되돌릴 수 없어요.`)) run(() => deleteSignatures({ ids }), `시그니처 ${ids.length}개를 삭제했어요.`, () => setPicked([]));
  };

  const activeCount = items.filter((s) => s.active).length;

  return (
    <div className={styles.content}>
      <header className={styles.header}>
        <h1 className={styles.title}>시그니처 후원</h1>
        <p className={styles.subtitle}>방송 방의 시그니처 후원에 보일 시그니처를 만들고 가격과 매칭 규칙을 정해요. 가격은 채널에서 직접 정해요.</p>
        <p className={styles.note}>
          <Link href="/creator/widgets">← 위젯</Link> · 사용 중 {activeCount}개 / 전체 {items.length}개 (최대 {SIGNATURE_LIMITS.max}개)
        </p>
      </header>

      <section className={styles.card} aria-labelledby="sig-list">
        <div className={styles.cardHead}>
          <h2 className={styles.cardTitle} id="sig-list">
            ⭐ 시그니처 목록
          </h2>
          <div className={styles.rowActions}>
            <button type="button" className={styles.ghost} onClick={openBulk} disabled={pending || bulk}>
              📚 한 번에 만들기
            </button>
            <button type="button" className={styles.primary} onClick={openNew} disabled={pending || items.length >= SIGNATURE_LIMITS.max}>
              + 시그니처 추가
            </button>
          </div>
        </div>
        <p className={styles.note}>
          <strong>금액 일치</strong>로 두면 일반 후원 금액이 시그니처 가격과 같을 때(금액범위를 정하면 그 범위 안일 때)도 그 시그니처로 알림이 떠요. 위에서부터 방송 방에 보이는 순서예요.
        </p>
        {groups.length > 0 && (
          <div className={local.groups} role="group" aria-label="그룹">
            <span className={styles.segment}>
              <button type="button" aria-pressed={filter === null} onClick={() => setGroupFilter(null)}>
                전체 {items.length}
              </button>
              {groups.map((g) => (
                <button key={g} type="button" aria-pressed={filter === g} onClick={() => setGroupFilter(g)}>
                  {g} {items.filter((s) => s.group === g).length}
                </button>
              ))}
            </span>
            {filter !== null && (
              <span className={styles.rowActions}>
                <button type="button" className={styles.ghost} disabled={pending || inGroup.every((s) => s.active)} onClick={() => run(() => setSignatureGroupActive({ group: filter, active: true }), `'${filter}' 그룹을 모두 보이게 했어요.`)}>
                  그룹 모두 사용
                </button>
                <button type="button" className={styles.ghost} disabled={pending || inGroup.every((s) => !s.active)} onClick={() => run(() => setSignatureGroupActive({ group: filter, active: false }), `'${filter}' 그룹을 모두 숨겼어요.`)}>
                  그룹 모두 숨기기
                </button>
              </span>
            )}
          </div>
        )}
        {gaps.length > 0 && (
          <div className={local.groups} role="group" aria-label="미디어 누락">
            <span className={styles.segment}>
              <button type="button" aria-pressed={gap === null} onClick={() => setGapFilter(null)}>
                미디어 전체
              </button>
              {gaps.map((g) => (
                <button key={g.key} type="button" aria-pressed={gap === g.key} onClick={() => setGapFilter(g.key)}>
                  {g.label} {g.count}
                </button>
              ))}
            </span>
          </div>
        )}
        {items.length > 0 && (
          <div className={local.groups} role="group" aria-label="정렬 · 선택">
            <span className={styles.segment} role="group" aria-label="정렬">
              {SIGNATURE_SORTS.map((o) => (
                <button key={o.key} type="button" aria-pressed={sort === o.key} onClick={() => setSort(o.key)}>
                  {o.label}
                </button>
              ))}
            </span>
            <span className={styles.rowActions}>
              <button type="button" className={styles.ghost} disabled={pending || shown.length === 0} onClick={() => setPicked(allPicked ? [] : shown.map((s) => s.id))}>
                {allPicked ? "선택 해제" : "전체 선택"}
              </button>
              <button type="button" className={styles.danger} disabled={pending || selected.length === 0} onClick={removeSelected}>
                선택 삭제{selected.length ? ` (${selected.length})` : ""}
              </button>
            </span>
          </div>
        )}
        {sort !== "ORDER" && <p className={styles.note}>정렬해서 보는 중이에요. 방송 방 순서(↑ ↓)는 기본 순서에서 바꿀 수 있어요.</p>}
        {items.length === 0 ? (
          <p className={styles.empty}>아직 시그니처가 없어요. 첫 시그니처를 추가해 보세요.</p>
        ) : shown.length === 0 ? (
          <p className={styles.empty}>조건에 맞는 시그니처가 없어요.</p>
        ) : (
          <ul className={styles.list}>
            {listed.map((s) => {
              const i = items.indexOf(s);
              // Missing media: the row shows what the alert shows (the first preset), and says so in a warning line.
              const warnings = mediaGapsOf(s.media).filter((g) => g !== "SOUND_NONE");
              return (
              <li key={s.id} className={styles.row} data-inactive={s.active ? undefined : ""}>
                <input type="checkbox" className={local.pick} aria-label={`${s.name} 선택`} checked={selected.includes(s.id)} onChange={(e) => pick(s.id, e.target.checked)} />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className={local.thumb} src={s.media.image === "MISSING" ? SIGNATURE_IMAGE_PRESETS[0] : s.imageUrl} alt="" />
                <div className={styles.rowMain}>
                  <span className={styles.rowTitle}>{s.name}</span>
                  <span className={styles.muted}>
                    {s.match === "AMOUNT" ? spanText(s) : `${formatNumber(s.price)} FN`} · {MATCH_LABEL[s.match]}
                    {soundName(s.soundUrl) && ` · 🔊 ${soundName(s.soundUrl)}`}
                    {s.media.sound === "NONE" && ` · ${GAP_NOTE.SOUND_NONE}`}
                    {groups.length > 1 && ` · ${s.group}`}
                  </span>
                  {warnings.map((g) => (
                    <span key={g} className={local.gap}>
                      ⚠ {GAP_NOTE[g]}
                    </span>
                  ))}
                </div>
                <span className={s.active ? styles.chip : styles.chipOff}>{s.active ? "사용" : "숨김"}</span>
                <div className={styles.rowActions}>
                  <button type="button" className={styles.ghost} aria-label={`${s.name} 위로`} disabled={pending || sort !== "ORDER" || i === 0} onClick={() => run(() => moveSignature({ id: s.id, dir: "up" }), "순서를 바꿨어요.")}>
                    ↑
                  </button>
                  <button
                    type="button"
                    className={styles.ghost}
                    aria-label={`${s.name} 아래로`}
                    disabled={pending || sort !== "ORDER" || i === items.length - 1}
                    onClick={() => run(() => moveSignature({ id: s.id, dir: "down" }), "순서를 바꿨어요.")}
                  >
                    ↓
                  </button>
                  <button type="button" className={styles.ghost} disabled={pending} onClick={() => toggle(s)}>
                    {s.active ? "숨기기" : "사용"}
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
                    수정
                  </button>
                  <button type="button" className={styles.danger} disabled={pending} onClick={() => remove(s)}>
                    삭제
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
          matchLabels={MATCH_LABEL}
          onClose={() => setBulk(false)}
          onDone={(count) => {
            setBulk(false);
            setNote({ tone: "ok", text: `시그니처 ${count}개를 만들었어요. 목록 아래쪽에 추가됐어요.` });
            router.refresh();
          }}
        />
      )}

      {draft && (
        <section className={styles.card} aria-labelledby="sig-edit">
          <div className={styles.cardHead}>
            <h2 className={styles.cardTitle} id="sig-edit">
              {draft.id ? "시그니처 수정" : "새 시그니처"}
            </h2>
          </div>
          <div className={local.form}>
            <label className={local.field}>
              <span>이름</span>
              <input className={styles.input} maxLength={SIGNATURE_LIMITS.nameMax} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </label>
            <label className={local.field}>
              <span>가격 (FN)</span>
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
              <span>매칭 규칙</span>
              <select className={styles.select} value={draft.match} onChange={(e) => setDraft({ ...draft, match: e.target.value as SignatureMatch })}>
                {(Object.keys(MATCH_LABEL) as SignatureMatch[]).map((m) => (
                  <option key={m} value={m}>
                    {MATCH_LABEL[m]}
                  </option>
                ))}
              </select>
            </label>
            {draft.match === "AMOUNT" && (
              <label className={local.field}>
                <span>금액범위 시작 (선택)</span>
                <input
                  className={styles.input}
                  type="number"
                  min={SIGNATURE_LIMITS.priceMin}
                  max={Math.max(SIGNATURE_LIMITS.priceMin, draft.price - 1)}
                  placeholder="비우면 가격과 같은 금액만"
                  value={draft.rangeMin ?? ""}
                  onChange={(e) => setDraft({ ...draft, rangeMin: e.target.value === "" ? null : Math.floor(Number(e.target.value) || 0) })}
                />
              </label>
            )}
            <label className={local.field}>
              <span>그룹</span>
              <input className={styles.input} list="sig-groups" maxLength={SIGNATURE_LIMITS.groupMax} placeholder={DEFAULT_SIGNATURE_GROUP} value={draft.group} onChange={(e) => setDraft({ ...draft, group: e.target.value })} />
              <datalist id="sig-groups">
                {groups.map((g) => (
                  <option key={g} value={g} />
                ))}
              </datalist>
            </label>
            <label className={styles.checkRow}>
              <input type="checkbox" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} />
              방송 방에 표시
            </label>
          </div>
          {draft.match === "AMOUNT" && draft.rangeMin !== null && draft.rangeMin < draft.price && (
            <p className={styles.note}>
              {formatNumber(draft.rangeMin)} ~ {formatNumber(draft.price)} FN 일반 후원이 이 시그니처로 떠요. 가격과 정확히 같은 다른 시그니처가 있거나 범위가 겹치면 저장되지 않아요.
            </p>
          )}
          <div className={local.images} role="radiogroup" aria-label="이미지">
            {[...SIGNATURE_IMAGE_PRESETS, ...images.map((a) => a.url)].map((src, i) => (
              <button key={src} type="button" role="radio" aria-checked={draft.imageUrl === src} aria-label={`이미지 ${i + 1}`} className={local.image} onClick={() => pickImage(src)}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" />
              </button>
            ))}
          </div>
          <p className={styles.note}>
            기본 이미지 {SIGNATURE_IMAGE_PRESETS.length}장 뒤에 <Link href="/creator/widgets/assets">이미지·사운드</Link> 라이브러리의 이미지가 이어져요. 라이브러리
            이미지를 고르면 이름이 같은 사운드가 소리로 함께 붙어요.
          </p>
          <div className={local.sound}>
            <label className={local.field}>
              <span>소리 (알림과 함께 재생)</span>
              <select
                className={styles.select}
                value={draft.soundUrl ?? ""}
                onChange={(e) => {
                  setAutoSound(false);
                  setDraft({ ...draft, soundUrl: e.target.value || null });
                }}
              >
                <option value="">소리 없음</option>
                {sounds.map((a) => (
                  <option key={a.id} value={a.url}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
            {draft.soundUrl && <audio className={local.audio} src={draft.soundUrl} controls preload="none" aria-label="고른 소리 미리 듣기" />}
            {autoSound && draft.soundUrl && (
              <p className={styles.note} role="status">
                이름이 같은 사운드 &lsquo;{soundName(draft.soundUrl)}&rsquo;를 함께 골랐어요.
              </p>
            )}
            {sounds.length === 0 && <p className={styles.note}>라이브러리에 사운드를 올리면 고를 수 있어요.</p>}
          </div>
          <div className={styles.actions}>
            <button type="button" className={styles.ghost} disabled={pending} onClick={() => setDraft(null)}>
              취소
            </button>
            <button type="button" className={styles.primary} disabled={pending} onClick={submit}>
              {pending ? "저장 중…" : "저장"}
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
