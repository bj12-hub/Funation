"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { SearchLargeIcon } from "@/components/icons";
import { Modal } from "@/components/ui/Modal";
import { formatNumber } from "@/lib/format";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { Signature } from "@/services/donations/donationCatalog";
import styles from "./donation.module.css";
import { remote } from "@/lib/remoteImage";

const FILTERS = [
  { key: "ALL", label: "roomDonate.filterAll", test: () => true },
  { key: "FAVORITE", label: "roomDonate.filterFavorite", test: (s: Signature) => s.favorite },
  { key: "UNDER_10K", label: "roomDonate.filterUnder10k", test: (s: Signature) => s.price <= 10_000 },
  { key: "10K_20K", label: "roomDonate.filter10kTo20k", test: (s: Signature) => s.price > 10_000 && s.price <= 20_000 },
  { key: "20K_30K", label: "roomDonate.filter20kTo30k", test: (s: Signature) => s.price > 20_000 && s.price <= 30_000 },
  { key: "OVER_30K", label: "roomDonate.filterOver30k", test: (s: Signature) => s.price > 30_000 }
] as const;

const SORTS = {
  POPULAR: { label: "roomDonate.sortPopular", compare: (a: Signature, b: Signature) => a.rank - b.rank },
  PRICE_ASC: { label: "roomDonate.sortPriceAsc", compare: (a: Signature, b: Signature) => a.price - b.price },
  PRICE_DESC: { label: "roomDonate.sortPriceDesc", compare: (a: Signature, b: Signature) => b.price - a.price }
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
  const { t } = useI18n();
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("roomDonate.popupTitle")}
      width={1120}
      className={styles.signatureDialog}
      customHeader={
        <header className={styles.popupHeader}>
          <div>
            <h2>{t("roomDonate.popupTitle")}</h2>
            <p>{t("roomDonate.popupLead")}</p>
          </div>
          <button type="button" className={styles.popupClose} aria-label={t("roomDonate.close")} onClick={onClose}>
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
  const { t } = useI18n();
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
            placeholder={t("roomDonate.search")}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              reset();
            }}
            aria-label={t("roomDonate.search")}
          />
        </label>

        <div className={styles.pills} role="radiogroup" aria-label={t("roomDonate.filter")}>
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
              {t(f.label)}
            </button>
          ))}
        </div>

        <div className={styles.resultsRow}>
          <span>
            {t("roomDonate.totalBefore")}
            <strong>{results.length}</strong>
            {t("roomDonate.totalAfter")}
          </span>
          <select className={styles.sort} value={sort} onChange={(e) => setSort(e.target.value as keyof typeof SORTS)} aria-label={t("roomDonate.sort")}>
            {Object.entries(SORTS).map(([key, s]) => (
              <option key={key} value={key}>
                {t(s.label)}
              </option>
            ))}
          </select>
        </div>

        {items.length === 0 ? (
          <p className={styles.popupEmpty}>{t("roomDonate.noMatch")}</p>
        ) : (
          <div className={styles.popupGrid} role="radiogroup" aria-label={t("roomDonate.signatures")}>
            {items.map((s) => {
              const on = s.id === choice;
              return (
                <button key={s.id} type="button" role="radio" aria-checked={on} className={`${styles.popupCard} ${on ? styles.popupCardOn : ""}`} onClick={() => setChoice(s.id)}>
                  <span className={styles.popupThumb}>
                    <Image src={s.imageUrl} alt="" fill sizes="246px" className={styles.popupImage} unoptimized={remote(s.imageUrl)} />
                    {on && <span className={styles.selectedBadge}>{t("roomDonate.selectedBadge")}</span>}
                  </span>
                  <span className={styles.popupInfo}>
                    <span className={styles.popupName}>
                      {s.name}
                      <span className={s.favorite ? styles.starOn : styles.star} aria-label={s.favorite ? t("roomDonate.favorite") : undefined}>
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
          <nav className={styles.popupPages} aria-label={t("roomDonate.pages")}>
            <button type="button" disabled={current === 1} onClick={() => setPage(current - 1)} aria-label={t("roomDonate.prevPage")}>
              ‹
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button key={p} type="button" className={p === current ? styles.pageOn : ""} aria-current={p === current ? "page" : undefined} onClick={() => setPage(p)}>
                {p}
              </button>
            ))}
            <button type="button" disabled={current === totalPages} onClick={() => setPage(current + 1)} aria-label={t("roomDonate.nextPage")}>
              ›
            </button>
          </nav>
        )}
      </div>

      <footer className={styles.popupFooter}>
        <button type="button" className={styles.popupCancel} onClick={onClose}>
          {t("roomDonate.cancel")}
        </button>
        <button type="button" className={styles.popupConfirm} disabled={!choice} onClick={() => choice && onSelect(choice)}>
          {t("roomDonate.selectDone")}
        </button>
      </footer>
    </div>
  );
}
