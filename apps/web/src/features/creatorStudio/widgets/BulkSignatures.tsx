"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { createSignatures } from "@/services/donations/signatures";
import { pairOf, type Asset } from "@/services/creator/assetTypes";
import { SIGNATURE_LIMITS, priceFromName, signatureNameFrom, type ManagedSignature, type SignatureMatch } from "@/services/donations/signatureTypes";
import styles from "../crew/crew.module.css";
import local from "./signatures.module.css";

type Row = { name: string; price: string; soundUrl: string | null };

/**
 * 시그니처 일괄 만들기 — code-first (funnation "시그니처 일괄 생성", 2026-10-06). One signature per picked library
 * image: the name comes from the file name, the sound from the 짝 (same-name sound), and a price only when the file
 * name has one ("1004 하트"). Every price is the creator's to check; all rows are saved together or none.
 */
export function BulkSignatures({
  items,
  library,
  matchLabels,
  onClose,
  onDone
}: {
  items: ManagedSignature[];
  library: Asset[];
  matchLabels: Record<SignatureMatch, string>;
  onClose: () => void;
  onDone: (count: number) => void;
}) {
  const images = library.filter((a) => a.kind === "IMAGE");
  const sounds = library.filter((a) => a.kind === "SOUND");
  const room = Math.max(0, SIGNATURE_LIMITS.max - items.length);
  const usedBy = (a: Asset) => items.find((s) => s.imageUrl === a.url)?.name ?? null;

  const [picked, setPicked] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, Row>>({});
  const [match, setMatch] = useState<SignatureMatch>("SELECT");
  const [active, setActive] = useState(true);
  const [allPrice, setAllPrice] = useState("");
  const [error, setError] = useState<{ id?: string; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const requestId = useRef<string | null>(null);

  const rowFor = (a: Asset): Row => rows[a.id] ?? { name: signatureNameFrom(a.name), price: String(priceFromName(a.name) ?? ""), soundUrl: pairOf(a, library)?.url ?? null };
  // Library order, whatever order the tiles were clicked in.
  const chosen = images.filter((a) => picked.includes(a.id));

  const pick = (ids: string[]) => {
    setError(null);
    setPicked(ids);
    setRows((prev) => Object.fromEntries(images.filter((a) => ids.includes(a.id)).map((a) => [a.id, prev[a.id] ?? rowFor(a)])));
  };
  const toggle = (a: Asset) => pick(picked.includes(a.id) ? picked.filter((id) => id !== a.id) : [...picked, a.id]);
  const edit = (id: string, patch: Partial<Row>) => {
    setError(null);
    setRows((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  };

  const submit = () => {
    const missing = chosen.find((a) => !rowFor(a).price.trim());
    if (missing) {
      setError({ id: missing.id, text: "가격을 입력해 주세요." });
      return;
    }
    setError(null);
    requestId.current ??= crypto.randomUUID();
    const payload = chosen.map((a) => {
      const r = rowFor(a);
      return { name: r.name, price: Number(r.price), imageUrl: a.url, soundUrl: r.soundUrl };
    });
    startTransition(async () => {
      try {
        const res = await createSignatures({ requestId: requestId.current, match, active, rows: payload });
        if (res.status === "SAVED") {
          requestId.current = null;
          onDone(res.ids.length);
        } else if (res.status === "INVALID") setError({ id: res.row === undefined ? undefined : chosen[res.row]?.id, text: res.message });
        else setError({ text: "로그인이 필요합니다." });
      } catch {
        setError({ text: "만들지 못했어요. 잠시 후 다시 시도해 주세요." });
      }
    });
  };

  const unused = images.filter((a) => !usedBy(a));

  return (
    <section className={styles.card} aria-labelledby="sig-bulk">
      <div className={styles.cardHead}>
        <h2 className={styles.cardTitle} id="sig-bulk">
          📚 라이브러리에서 한 번에 만들기
        </h2>
        <button type="button" className={styles.ghost} disabled={pending} onClick={onClose}>
          닫기
        </button>
      </div>
      <p className={styles.note}>
        고른 이미지마다 시그니처를 하나씩 만들어요. 이름은 파일 이름으로, 소리는 이름이 같은 사운드로 채워요. 파일 이름에 숫자가 있으면(예: 1004 하트) 가격으로 넣어
        두니, 가격은 모두 확인해 주세요.
      </p>

      {images.length === 0 ? (
        <p className={styles.empty}>
          라이브러리에 이미지가 없어요. <Link href="/creator/widgets/assets">이미지·사운드</Link>에서 먼저 올려 주세요.
        </p>
      ) : room === 0 ? (
        <p className={styles.empty}>시그니처가 {SIGNATURE_LIMITS.max}개로 가득 찼어요. 쓰지 않는 시그니처를 지우면 만들 수 있어요.</p>
      ) : (
        <>
          <div className={local.bulkBar}>
            <span className={styles.muted}>
              이미지 {picked.length}개 고름 · {room}개 더 만들 수 있어요
            </span>
            <div className={styles.rowActions}>
              <button type="button" className={styles.ghost} disabled={pending || unused.length === 0} onClick={() => pick(unused.slice(0, room).map((a) => a.id))}>
                안 쓴 이미지 모두 고르기
              </button>
              <button type="button" className={styles.ghost} disabled={pending || picked.length === 0} onClick={() => pick([])}>
                선택 해제
              </button>
            </div>
          </div>
          <ul className={local.bulkGrid} aria-label="라이브러리 이미지">
            {images.map((a) => {
              const on = picked.includes(a.id);
              const used = usedBy(a);
              return (
                <li key={a.id}>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    className={local.bulkTile}
                    disabled={pending || (!on && picked.length >= room)}
                    onClick={() => toggle(a)}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={a.url} alt="" />
                    <span className={local.bulkName}>{a.name}</span>
                    <span className={local.bulkTags}>
                      {pairOf(a, library) && <span>🔊 짝</span>}
                      {used && <span title={`'${used}' 시그니처에 쓰는 중`}>사용 중</span>}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          {chosen.length > 0 && (
            <>
              <div className={local.bulkCommon}>
                <label className={local.field}>
                  <span>매칭 규칙 (모두 같게)</span>
                  <select className={styles.select} value={match} disabled={pending} onChange={(e) => setMatch(e.target.value as SignatureMatch)}>
                    {(Object.keys(matchLabels) as SignatureMatch[]).map((m) => (
                      <option key={m} value={m}>
                        {matchLabels[m]}
                      </option>
                    ))}
                  </select>
                </label>
                <div className={local.field}>
                  <span>가격 한 번에 넣기</span>
                  <div className={styles.addRow}>
                    <input
                      className={styles.input}
                      type="number"
                      inputMode="numeric"
                      min={SIGNATURE_LIMITS.priceMin}
                      max={SIGNATURE_LIMITS.priceMax}
                      placeholder="FN"
                      aria-label="모든 시그니처 가격"
                      value={allPrice}
                      disabled={pending}
                      onChange={(e) => setAllPrice(e.target.value)}
                    />
                    <button
                      type="button"
                      className={styles.ghost}
                      disabled={pending || !allPrice.trim()}
                      onClick={() => {
                        setError(null);
                        setRows((prev) => Object.fromEntries(Object.entries(prev).map(([id, r]) => [id, { ...r, price: allPrice.trim() }])));
                      }}
                    >
                      모두 적용
                    </button>
                  </div>
                </div>
                <label className={styles.checkRow}>
                  <input type="checkbox" checked={active} disabled={pending} onChange={(e) => setActive(e.target.checked)} />
                  방송 방에 바로 표시
                </label>
              </div>

              <ol className={styles.list} aria-label="만들 시그니처">
                {chosen.map((a, i) => {
                  const r = rowFor(a);
                  const bad = error?.id === a.id;
                  return (
                    <li key={a.id} className={`${styles.row} ${local.bulkRow}`} data-error={bad ? "" : undefined}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img className={local.thumb} src={a.url} alt="" />
                      <label className={local.field}>
                        <span>이름</span>
                        <input
                          className={styles.input}
                          maxLength={SIGNATURE_LIMITS.nameMax}
                          value={r.name}
                          aria-label={`${i + 1}번째 이름`}
                          aria-invalid={bad || undefined}
                          disabled={pending}
                          onChange={(e) => edit(a.id, { name: e.target.value })}
                        />
                      </label>
                      <label className={local.field}>
                        <span>가격 (FN)</span>
                        <input
                          className={styles.input}
                          type="number"
                          inputMode="numeric"
                          min={SIGNATURE_LIMITS.priceMin}
                          max={SIGNATURE_LIMITS.priceMax}
                          value={r.price}
                          aria-label={`${i + 1}번째 가격`}
                          aria-invalid={bad || undefined}
                          disabled={pending}
                          onChange={(e) => edit(a.id, { price: e.target.value })}
                        />
                      </label>
                      <label className={local.field}>
                        <span>소리</span>
                        <select
                          className={styles.select}
                          value={r.soundUrl ?? ""}
                          aria-label={`${i + 1}번째 소리`}
                          disabled={pending}
                          onChange={(e) => edit(a.id, { soundUrl: e.target.value || null })}
                        >
                          <option value="">소리 없음</option>
                          {sounds.map((s) => (
                            <option key={s.id} value={s.url}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button type="button" className={styles.ghost} aria-label={`${r.name || a.name} 빼기`} disabled={pending} onClick={() => toggle(a)}>
                        빼기
                      </button>
                      {bad && (
                        <p className={`${styles.error} ${local.bulkError}`} role="alert">
                          {error?.text}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ol>
            </>
          )}

          {error && !error.id && (
            <p className={styles.error} role="alert">
              {error.text}
            </p>
          )}
          <div className={styles.actions}>
            <button type="button" className={styles.ghost} disabled={pending} onClick={onClose}>
              취소
            </button>
            <button type="button" className={styles.primary} disabled={pending || chosen.length === 0} onClick={submit}>
              {pending ? "만드는 중…" : chosen.length ? `시그니처 ${chosen.length}개 만들기` : "이미지를 골라 주세요"}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
