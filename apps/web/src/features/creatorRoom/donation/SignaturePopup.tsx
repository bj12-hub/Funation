"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { SearchLargeIcon } from "@/components/icons";
import { Modal } from "@/components/ui/Modal";
import { formatNumber } from "@/lib/format";
import type { Signature } from "@/services/donations/donationCatalog";
import styles from "./donation.module.css";

const FILTERS = [
  { key: "ALL", label: "전체", test: () => true },
  { key: "FAVORITE", label: "⭐ 즐겨찾기", test: (s: Signature) => s.favorite },
  { key: "UNDER_10K", label: "1만 FN 이하", test: (s: Signature) => s.price <= 10_000 },
  { key: "10K_20K", label: "1만–2만 FN", test: (s: Signature) => s.price > 10_000 && s.price <= 20_000 },
  { key: "20K_30K", label: "2만–3만 FN", test: (s: Signature) => s.price > 20_000 && s.price <= 30_000 },
  { key: "OVER_30K", label: "3만 FN 이상", test: (s: Signature) => s.price > 30_000 }
] as const;

const SORTS = {
  POPULAR: { label: "인기순", compare: (a: Signature, b: Signature) => a.rank - b.rank },
  PRICE_ASC: { label: "낮은 가격순", compare: (a: Signature, b: Signature) => a.price - b.price },
  PRICE_DESC: { label: "높은 가격순", compare: (a: Signature, b: Signature) => b.price - a.price }
} as const;

const PAGE_SIZE = 8;

/**
 * Figma 875:1815 시그니처 전체보기. Filtering happens over the server-provided catalog.
 * TODO: with a large catalog (the design says 127) search and paging should move to the server.
 */
export function SignaturePopup({
  open,
  signatures,
  initial,
  onClose,
  onSelect
}: {
  open: boolean;
  signatures: Signature[];
  initial: string | null;
  onClose: () => void;
  onSelect: (id: string) => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="시그니처 전체보기"
      width={1120}
      className={styles.signatureDialog}
      customHeader={
        <header className={styles.popupHeader}>
          <div>
            <h2>시그니처 전체보기</h2>
            <p>원하는 시그니처를 선택해 후원에 특별함을 더해보세요.</p>
          </div>
          <button type="button" className={styles.popupClose} aria-label="닫기" onClick={onClose}>
            ×
          </button>
        </header>
      }
    >
      {open && <Body signatures={signatures} initial={initial} onClose={onClose} onSelect={onSelect} />}
    </Modal>
  );
}

function Body({ signatures, initial, onClose, onSelect }: { signatures: Signature[]; initial: string | null; onClose: () => void; onSelect: (id: string) => void }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("ALL");
  const [sort, setSort] = useState<keyof typeof SORTS>("POPULAR");
  const [page, setPage] = useState(1);
  const [choice, setChoice] = useState<string | null>(initial);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const test = FILTERS.find((f) => f.key === filter)!.test;
    return signatures.filter((s) => test(s) && (!q || s.name.toLowerCase().includes(q))).sort(SORTS[sort].compare);
  }, [signatures, query, filter, sort]);

  const totalPages = Math.max(1, Math.ceil(results.length / PAGE_SIZE));
  const current = Math.min(page, totalPages);
  const items = results.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const reset = () => setPage(1);

  return (
    <div className={styles.popupBody}>
      <div className={styles.popupContent}>
        <label className={styles.search}>
          <SearchLargeIcon width={16} height={16} aria-hidden="true" />
          <input
            type="search"
            placeholder="시그니처 이름 검색"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              reset();
            }}
            aria-label="시그니처 이름 검색"
          />
        </label>

        <div className={styles.pills} role="radiogroup" aria-label="필터">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              role="radio"
              aria-checked={filter === f.key}
              className={`${styles.pill} ${filter === f.key ? styles.pillOn : ""}`}
              onClick={() => {
                setFilter(f.key);
                reset();
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className={styles.resultsRow}>
          <span>
            총 <strong>{results.length}</strong>개의 시그니처
          </span>
          <select className={styles.sort} value={sort} onChange={(e) => setSort(e.target.value as keyof typeof SORTS)} aria-label="정렬">
            {Object.entries(SORTS).map(([key, s]) => (
              <option key={key} value={key}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        {items.length === 0 ? (
          <p className={styles.popupEmpty}>조건에 맞는 시그니처가 없어요.</p>
        ) : (
          <div className={styles.popupGrid} role="radiogroup" aria-label="시그니처">
            {items.map((s) => {
              const on = s.id === choice;
              return (
                <button key={s.id} type="button" role="radio" aria-checked={on} className={`${styles.popupCard} ${on ? styles.popupCardOn : ""}`} onClick={() => setChoice(s.id)}>
                  <span className={styles.popupThumb}>
                    <Image src={s.imageUrl} alt="" fill sizes="246px" className={styles.popupImage} />
                    {on && <span className={styles.selectedBadge}>✓ 선택됨</span>}
                  </span>
                  <span className={styles.popupInfo}>
                    <span className={styles.popupName}>
                      {s.name}
                      <span className={s.favorite ? styles.starOn : styles.star} aria-label={s.favorite ? "즐겨찾기" : undefined}>
                        ★
                      </span>
                    </span>
                    <strong className={styles.popupPrice}>{formatNumber(s.price)} FN</strong>
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {totalPages > 1 && (
          <nav className={styles.popupPages} aria-label="페이지">
            <button type="button" disabled={current === 1} onClick={() => setPage(current - 1)} aria-label="이전 페이지">
              ‹
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button key={p} type="button" className={p === current ? styles.pageOn : ""} aria-current={p === current ? "page" : undefined} onClick={() => setPage(p)}>
                {p}
              </button>
            ))}
            <button type="button" disabled={current === totalPages} onClick={() => setPage(current + 1)} aria-label="다음 페이지">
              ›
            </button>
          </nav>
        )}
      </div>

      <footer className={styles.popupFooter}>
        <button type="button" className={styles.popupCancel} onClick={onClose}>
          취소
        </button>
        <button type="button" className={styles.popupConfirm} disabled={!choice} onClick={() => choice && onSelect(choice)}>
          선택 완료
        </button>
      </footer>
    </div>
  );
}
