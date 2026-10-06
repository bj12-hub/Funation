"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { formatNumber } from "@/lib/format";
import { deleteSignature, moveSignature, saveSignature } from "@/services/donations/signatures";
import { pairOf, type Asset } from "@/services/creator/assetTypes";
import { SIGNATURE_IMAGE_PRESETS, SIGNATURE_LIMITS, type ManagedSignature, type SignatureMatch, type SignatureResult } from "@/services/donations/signatureTypes";
import styles from "../crew/crew.module.css";
import { BulkSignatures } from "./BulkSignatures";
import local from "./signatures.module.css";

type Draft = Omit<ManagedSignature, "id"> & { id: string | null };

const MATCH_LABEL: Record<SignatureMatch, string> = { SELECT: "선택 시에만", AMOUNT: "선택 + 금액 일치" };
const blank = (): Draft => ({ id: null, name: "", price: 10_000, imageUrl: SIGNATURE_IMAGE_PRESETS[0], soundUrl: null, match: "SELECT", active: true });

/**
 * 시그니처 후원 관리 — code-first (no Figma frame). Route `/creator/widgets/signatures`.
 * The list is what supporters see in the room's 시그니처 후원 panel, in this order. `library` is the creator's
 * 이미지·사운드: picking a library image also picks the sound with the same name (자동 매칭, 2026-10-06 결정), and
 * "한 번에 만들기" turns several library images into signatures at once (`?bulk=1` opens it, from the library page).
 */
export function SignaturesScreen({ items, library, startBulk = false }: { items: ManagedSignature[]; library: Asset[]; startBulk?: boolean }) {
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
    setDraft(blank());
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
          <strong>금액 일치</strong>로 두면 일반 후원 금액이 시그니처 가격과 같을 때도 그 시그니처로 알림이 떠요. 위에서부터 방송 방에 보이는 순서예요.
        </p>
        {items.length === 0 ? (
          <p className={styles.empty}>아직 시그니처가 없어요. 첫 시그니처를 추가해 보세요.</p>
        ) : (
          <ul className={styles.list}>
            {items.map((s, i) => (
              <li key={s.id} className={styles.row} data-inactive={s.active ? undefined : ""}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className={local.thumb} src={s.imageUrl} alt="" />
                <div className={styles.rowMain}>
                  <span className={styles.rowTitle}>{s.name}</span>
                  <span className={styles.muted}>
                    {formatNumber(s.price)} FN · {MATCH_LABEL[s.match]}
                    {soundName(s.soundUrl) && ` · 🔊 ${soundName(s.soundUrl)}`}
                  </span>
                </div>
                <span className={s.active ? styles.chip : styles.chipOff}>{s.active ? "사용" : "숨김"}</span>
                <div className={styles.rowActions}>
                  <button type="button" className={styles.ghost} aria-label={`${s.name} 위로`} disabled={pending || i === 0} onClick={() => run(() => moveSignature({ id: s.id, dir: "up" }), "순서를 바꿨어요.")}>
                    ↑
                  </button>
                  <button
                    type="button"
                    className={styles.ghost}
                    aria-label={`${s.name} 아래로`}
                    disabled={pending || i === items.length - 1}
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
                      setAutoSound(false);
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
            ))}
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
            <label className={styles.checkRow}>
              <input type="checkbox" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} />
              방송 방에 표시
            </label>
          </div>
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
    </div>
  );
}
