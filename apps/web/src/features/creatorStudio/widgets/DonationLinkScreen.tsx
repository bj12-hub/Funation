"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { formatKst } from "@/lib/format";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { platformLabel } from "@/lib/i18n/platformLabel";
import type { MessageKey } from "@/lib/i18n/translate";
import { pollDonationLinks, setDonationLink, simulateExternalDonation } from "@/services/creator/donationLink";
import { SIM_CURRENCIES, type DonationLinkResult, type DonationLinkView, type SimCurrency } from "@/services/creator/donationLinkTypes";
import type { BankSmsView } from "@/services/bankSms/bankSmsTypes";
import type { PlatformErrorCode } from "@/services/platforms/platformTypes";
import type { Platform } from "@/types/platform";
import styles from "../crew/crew.module.css";
import { BankSmsCard } from "./BankSmsCard";

/** Platform-native units for the simulator (YouTube picks a currency). FlexTV's unit is TBD. */
const UNIT: Record<Exclude<Platform, "YOUTUBE">, MessageKey> = { CHZZK: "studioToolsLink.unitChzzk", SOOP: "studioToolsLink.unitSoop", FLEXTV: "studioToolsLink.unitFlextv" };
/** The platform error labels by code (the service's PLATFORM_ERROR_LABEL stays as written, 2026-11-01). */
const ERROR_KEY: Record<PlatformErrorCode, MessageKey> = {
  TIMEOUT: "studioToolsLink.errorTimeout",
  NOT_FOUND: "studioToolsLink.errorNotFound",
  UNAUTHORIZED: "studioToolsLink.errorUnauthorized",
  UNSUPPORTED: "studioToolsLink.errorUnsupported",
  UNAVAILABLE: "studioToolsLink.errorUnavailable"
};

const when = (iso: string | null) => (iso ? formatKst(iso, { dateStyle: "short", timeStyle: "short" }) : "—");

/**
 * 후원 연동 — code-first (no Figma frame). Route `/creator/widgets/link`.
 * Broadcast-platform donations appear in 후원 알림 in their own currency; they are not Ssumnation payments.
 * Every platform feeds the same single queue (통합 후원 알림), so simulcast alerts never play on top of each other.
 * SMS 계좌후원 (mock, 2026-10-06) feeds the same queue in 원.
 */
export function DonationLinkScreen({ view, bank }: { view: DonationLinkView; bank: BankSmsView }) {
  const router = useRouter();
  const { t } = useI18n();
  const [sim, setSim] = useState({ platform: "YOUTUBE" as Platform, donor: "시청자", message: "응원해요!", value: 5_000, currency: "KRW" as SimCurrency, redeliver: false });
  const [note, setNote] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const requestId = useRef<string | null>(null);

  const run = (action: () => Promise<DonationLinkResult>, ok: (r: Extract<DonationLinkResult, { status: "OK" }>) => string, after?: () => void) => {
    setNote(null);
    startTransition(async () => {
      try {
        const res = await action();
        if (res.status === "OK") {
          setNote({ tone: "ok", text: ok(res) });
          after?.();
        } else setNote({ tone: "error", text: res.status === "INVALID" ? res.message : t("studioTools.loginRequired") });
        router.refresh();
      } catch {
        setNote({ tone: "error", text: t("studioTools.processFailed") });
      }
    });
  };
  const counts = (r: { ingested?: number; duplicates?: number }) =>
    `${t("studioToolsLink.countsAlerts", { count: r.ingested ?? 0 })}${r.duplicates ? t("studioToolsLink.countsDuplicates", { count: r.duplicates }) : ""}`;
  const send = () => {
    requestId.current ??= crypto.randomUUID();
    run(
      () => simulateExternalDonation({ ...sim, platform: simPlatform, requestId: requestId.current }),
      (r) => t("studioToolsLink.testSent", { platform: platformLabel(simPlatform, t), counts: counts(r) }),
      () => (requestId.current = null)
    );
  };
  const unit = (p: Platform) => (p === "YOUTUBE" ? "" : t(UNIT[p]));
  const ready = view.links.filter((l) => l.supported && l.connected).map((l) => l.platform);
  const simPlatform = ready.includes(sim.platform) ? sim.platform : (ready[0] ?? sim.platform);

  return (
    <div className={styles.content}>
      <header className={styles.header}>
        <h1 className={styles.title}>{t("studioToolsLink.title")}</h1>
        <p className={styles.subtitle}>{t("studioToolsLink.subtitle")}</p>
        <p className={styles.note}>
          <Link href="/creator/widgets">{t("studioTools.backWidgets")}</Link>
          {t("studioToolsLink.headNote")}
        </p>
      </header>

      <section className={styles.card} aria-labelledby="ln-platforms">
        <div className={styles.cardHead}>
          <h2 className={styles.cardTitle} id="ln-platforms">
            {t("studioToolsLink.platforms")}
          </h2>
          <button type="button" className={styles.ghost} disabled={pending} onClick={() => run(pollDonationLinks, (r) => t("studioToolsLink.fetched", { counts: counts(r) }))}>
            {t("studioToolsLink.fetchNow")}
          </button>
        </div>
        <ul className={styles.list}>
          {view.links.map((l) => (
            <li key={l.platform} className={styles.row} data-inactive={l.supported ? undefined : ""}>
              <div className={styles.rowMain}>
                <span className={styles.rowTitle}>
                  {platformLabel(l.platform, t)} {l.supported && l.unverified && <span className={styles.chipOff}>{t("studioToolsLink.apiChecking")}</span>}
                </span>
                <span className={styles.muted}>
                  {!l.supported
                    ? t("studioToolsLink.unsupported")
                    : !l.connected
                      ? t("studioToolsLink.needConnect")
                      : t("studioToolsLink.stats", {
                          received: l.received,
                          duplicates: l.duplicates,
                          skipped: l.skipped ? t("studioToolsLink.statsSkipped", { count: l.skipped }) : "",
                          last: when(l.lastEventAt)
                        })}
                </span>
                {l.enabled && l.lastError && <span className={styles.muted}>⚠ {t(ERROR_KEY[l.lastError])}</span>}
              </div>
              {l.supported && !l.connected && (
                <Link href={l.platform === "YOUTUBE" ? "/creator/youtube" : "/creator/chat"} className={styles.ghost}>
                  {l.platform === "YOUTUBE" ? t("studioToolsLink.connectYoutube") : t("studioToolsLink.connectChannel")}
                </Link>
              )}
              <label className={styles.checkRow}>
                <input
                  type="checkbox"
                  checked={l.enabled}
                  disabled={pending || !l.supported || !l.connected}
                  onChange={(e) =>
                    run(
                      () => setDonationLink({ platform: l.platform, enabled: e.target.checked }),
                      () => (e.target.checked ? t("studioToolsLink.enabledOn", { platform: platformLabel(l.platform, t) }) : t("studioToolsLink.enabledOff"))
                    )
                  }
                />
                {t("studioToolsLink.showInAlerts")}
              </label>
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.card} aria-labelledby="ln-sim">
        <div className={styles.cardHead}>
          <h2 className={styles.cardTitle} id="ln-sim">
            {t("studioToolsLink.simTitle")}
          </h2>
        </div>
        <div className={styles.addRow}>
          <select className={styles.select} aria-label={t("studioToolsLink.platform")} value={simPlatform} onChange={(e) => setSim({ ...sim, platform: e.target.value as Platform })}>
            {ready.map((p) => (
              <option key={p} value={p}>
                {platformLabel(p, t)}
              </option>
            ))}
          </select>
          <input className={styles.input} aria-label={t("studioToolsLink.sender")} maxLength={40} value={sim.donor} onChange={(e) => setSim({ ...sim, donor: e.target.value })} />
          <input className={styles.input} aria-label={t("studioToolsLink.message")} maxLength={200} value={sim.message} onChange={(e) => setSim({ ...sim, message: e.target.value })} />
          <input
            className={styles.inputSmall}
            type="number"
            min={1}
            step={simPlatform === "YOUTUBE" ? "any" : 1}
            aria-label={simPlatform === "YOUTUBE" ? t("studioToolsLink.amount") : unit(simPlatform)}
            value={sim.value}
            onChange={(e) => setSim({ ...sim, value: Number(e.target.value) || 0 })}
          />
          {simPlatform === "YOUTUBE" ? (
            <select className={styles.select} aria-label={t("studioToolsLink.currency")} value={sim.currency} onChange={(e) => setSim({ ...sim, currency: e.target.value as SimCurrency })}>
              {SIM_CURRENCIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          ) : (
            <span className={styles.muted}>{unit(simPlatform)}</span>
          )}
        </div>
        <div className={styles.addRow}>
          <label className={styles.checkRow}>
            <input type="checkbox" checked={sim.redeliver} onChange={(e) => setSim({ ...sim, redeliver: e.target.checked })} />
            {t("studioToolsLink.redeliver")}
          </label>
          <button type="button" className={styles.primary} disabled={pending || ready.length === 0} onClick={send}>
            {t("studioToolsLink.send")}
          </button>
        </div>
        <p className={styles.note}>{t("studioToolsLink.simNote")}</p>
      </section>

      <BankSmsCard view={bank} />

      <section className={styles.card} aria-labelledby="ln-recent">
        <div className={styles.cardHead}>
          <h2 className={styles.cardTitle} id="ln-recent">
            {t("studioToolsLink.recentTitle")}
          </h2>
          <Link href="/creator/remote" className={styles.ghost}>
            {t("studioTools.remote")}
          </Link>
        </div>
        {view.recent.length === 0 ? (
          <p className={styles.empty}>{t("studioToolsLink.recentEmpty")}</p>
        ) : (
          <ul className={styles.list}>
            {view.recent.map((d) => (
              <li key={d.key} className={styles.row}>
                <div className={styles.rowMain}>
                  <span className={styles.rowTitle}>
                    {d.donor} · {d.amountLabel}
                  </span>
                  <span className={styles.muted}>
                    {d.kindLabel} · {when(d.receivedAt)}
                    {d.message ? ` · ${d.message}` : ""}
                  </span>
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
