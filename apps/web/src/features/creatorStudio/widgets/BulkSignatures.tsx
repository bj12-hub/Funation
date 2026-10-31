"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { useI18n } from "@/lib/i18n/I18nProvider";
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
  const { t } = useI18n();
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
      setError({ id: missing.id, text: t("studioToolsSignatures.needPrice") });
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
        else setError({ text: t("studioTools.loginRequired") });
      } catch {
        setError({ text: t("studioToolsSignatures.createFailed") });
      }
    });
  };

  const unused = images.filter((a) => !usedBy(a));

  return (
    <section className={styles.card} aria-labelledby="sig-bulk">
      <div className={styles.cardHead}>
        <h2 className={styles.cardTitle} id="sig-bulk">
          {t("studioToolsSignatures.bulkTitle")}
        </h2>
        <button type="button" className={styles.ghost} disabled={pending} onClick={onClose}>
          {t("studioToolsSignatures.close")}
        </button>
      </div>
      <p className={styles.note}>{t("studioToolsSignatures.bulkNote")}</p>

      {images.length === 0 ? (
        <p className={styles.empty}>
          {t("studioToolsLibrary.noImagesBefore")}
          <Link href="/creator/widgets/assets">{t("studioTools.assetsLink")}</Link>
          {t("studioToolsLibrary.uploadFirstAfter")}
        </p>
      ) : room === 0 ? (
        <p className={styles.empty}>{t("studioToolsSignatures.full", { max: SIGNATURE_LIMITS.max })}</p>
      ) : (
        <>
          <div className={local.bulkBar}>
            <span className={styles.muted}>{t("studioToolsSignatures.pickedCount", { picked: picked.length, room })}</span>
            <div className={styles.rowActions}>
              <button type="button" className={styles.ghost} disabled={pending || unused.length === 0} onClick={() => pick(unused.slice(0, room).map((a) => a.id))}>
                {t("studioToolsSignatures.pickUnused")}
              </button>
              <button type="button" className={styles.ghost} disabled={pending || picked.length === 0} onClick={() => pick([])}>
                {t("studioToolsSignatures.unselect")}
              </button>
            </div>
          </div>
          <ul className={local.bulkGrid} aria-label={t("studioToolsSignatures.libraryImages")}>
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
                      {pairOf(a, library) && <span>{t("studioToolsSignatures.pairTag")}</span>}
                      {used && <span title={t("studioToolsSignatures.usedBy", { name: used })}>{t("studioToolsSignatures.inUse")}</span>}
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
                  <span>{t("studioToolsSignatures.matchAll")}</span>
                  <select className={styles.select} value={match} disabled={pending} onChange={(e) => setMatch(e.target.value as SignatureMatch)}>
                    {(Object.keys(matchLabels) as SignatureMatch[]).map((m) => (
                      <option key={m} value={m}>
                        {matchLabels[m]}
                      </option>
                    ))}
                  </select>
                </label>
                <div className={local.field}>
                  <span>{t("studioToolsSignatures.priceAll")}</span>
                  <div className={styles.addRow}>
                    <input
                      className={styles.input}
                      type="number"
                      inputMode="numeric"
                      min={SIGNATURE_LIMITS.priceMin}
                      max={SIGNATURE_LIMITS.priceMax}
                      placeholder="FN"
                      aria-label={t("studioToolsSignatures.priceAllAria")}
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
                      {t("studioToolsSignatures.applyAll")}
                    </button>
                  </div>
                </div>
                <label className={styles.checkRow}>
                  <input type="checkbox" checked={active} disabled={pending} onChange={(e) => setActive(e.target.checked)} />
                  {t("studioToolsSignatures.showNow")}
                </label>
              </div>

              <ol className={styles.list} aria-label={t("studioToolsSignatures.toCreateAria")}>
                {chosen.map((a, i) => {
                  const r = rowFor(a);
                  const bad = error?.id === a.id;
                  return (
                    <li key={a.id} className={`${styles.row} ${local.bulkRow}`} data-error={bad ? "" : undefined}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img className={local.thumb} src={a.url} alt="" />
                      <label className={local.field}>
                        <span>{t("studioToolsSignatures.name")}</span>
                        <input
                          className={styles.input}
                          maxLength={SIGNATURE_LIMITS.nameMax}
                          value={r.name}
                          aria-label={t("studioToolsSignatures.nthName", { n: i + 1 })}
                          aria-invalid={bad || undefined}
                          disabled={pending}
                          onChange={(e) => edit(a.id, { name: e.target.value })}
                        />
                      </label>
                      <label className={local.field}>
                        <span>{t("studioToolsSignatures.price")}</span>
                        <input
                          className={styles.input}
                          type="number"
                          inputMode="numeric"
                          min={SIGNATURE_LIMITS.priceMin}
                          max={SIGNATURE_LIMITS.priceMax}
                          value={r.price}
                          aria-label={t("studioToolsSignatures.nthPrice", { n: i + 1 })}
                          aria-invalid={bad || undefined}
                          disabled={pending}
                          onChange={(e) => edit(a.id, { price: e.target.value })}
                        />
                      </label>
                      <label className={local.field}>
                        <span>{t("studioToolsSignatures.sound")}</span>
                        <select
                          className={styles.select}
                          value={r.soundUrl ?? ""}
                          aria-label={t("studioToolsSignatures.nthSound", { n: i + 1 })}
                          disabled={pending}
                          onChange={(e) => edit(a.id, { soundUrl: e.target.value || null })}
                        >
                          <option value="">{t("studioToolsSignatures.soundNone")}</option>
                          {sounds.map((s) => (
                            <option key={s.id} value={s.url}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button type="button" className={styles.ghost} aria-label={t("studioToolsSignatures.removeAria", { name: r.name || a.name })} disabled={pending} onClick={() => toggle(a)}>
                        {t("studioTools.remove")}
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
              {t("studioTools.cancel")}
            </button>
            <button type="button" className={styles.primary} disabled={pending || chosen.length === 0} onClick={submit}>
              {pending ? t("studioToolsSignatures.creating") : chosen.length ? t("studioToolsSignatures.createCount", { count: chosen.length }) : t("studioToolsSignatures.pickImages")}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
