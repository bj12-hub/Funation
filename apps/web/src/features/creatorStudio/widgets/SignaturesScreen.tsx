"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { formatNumber } from "@/lib/format";
import { deleteSignature, moveSignature, saveSignature } from "@/services/donations/signatures";
import type { Asset } from "@/services/creator/assetTypes";
import { SIGNATURE_IMAGE_PRESETS, SIGNATURE_LIMITS, type ManagedSignature, type SignatureMatch, type SignatureResult } from "@/services/donations/signatureTypes";
import styles from "../crew/crew.module.css";
import local from "./signatures.module.css";

type Draft = Omit<ManagedSignature, "id"> & { id: string | null };

const MATCH_LABEL: Record<SignatureMatch, string> = { SELECT: "선택 시에만", AMOUNT: "선택 + 금액 일치" };
const blank = (): Draft => ({ id: null, name: "", price: 10_000, imageUrl: SIGNATURE_IMAGE_PRESETS[0], match: "SELECT", active: true });

/**
 * 시그니처 후원 관리 — code-first (no Figma frame). Route `/creator/widgets/signatures`.
 * The list is what supporters see in the room's 시그니처 후원 panel, in this order.
 */
export function SignaturesScreen({ items, library }: { items: ManagedSignature[]; library: Asset[] }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null>(null);
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
    setDraft(blank());
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
          <button type="button" className={styles.primary} onClick={openNew} disabled={pending || items.length >= SIGNATURE_LIMITS.max}>
            + 시그니처 추가
          </button>
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
                  <button type="button" className={styles.ghost} disabled={pending} onClick={() => setDraft({ ...s })}>
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
            {[...SIGNATURE_IMAGE_PRESETS, ...library.map((a) => a.url)].map((src, i) => (
              <button key={src} type="button" role="radio" aria-checked={draft.imageUrl === src} aria-label={`이미지 ${i + 1}`} className={local.image} onClick={() => setDraft({ ...draft, imageUrl: src })}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" />
              </button>
            ))}
          </div>
          <p className={styles.note}>
            기본 이미지 {SIGNATURE_IMAGE_PRESETS.length}장 뒤에 <Link href="/creator/widgets/assets">이미지·사운드</Link> 라이브러리의 이미지가 이어져요.
          </p>
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
