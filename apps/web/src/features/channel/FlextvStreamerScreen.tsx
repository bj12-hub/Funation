"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { FLEXTV_WEB_URL } from "@/lib/flextv/mode";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { MessageKey } from "@/lib/i18n/translate";
import { becomeStreamer } from "@/services/channel/flextvStreamer";
import { STREAM_POLICY, type StreamerGate } from "@/services/channel/streamerTypes";
import styles from "./channel.module.css";

const BENEFITS: { title: MessageKey; text: MessageKey }[] = [
  { title: "flextvStreamer.benefitStream", text: "flextvStreamer.benefitStreamText" },
  { title: "channel.benefitDonations", text: "flextvStreamer.benefitDonationsText" },
  { title: "flextvStreamer.benefitRevenue", text: "flextvStreamer.benefitRevenueText" },
  { title: "channel.benefitSettlement", text: "flextvStreamer.benefitSettlementText" }
];

type T = ReturnType<typeof useI18n>["t"];

/** The 만 14세 lines stay Korean in both languages (age wording, docs/development/i18n.md). */
function gateCopy(gate: Exclude<StreamerGate, "ELIGIBLE">, t: T): { title: string; text: string; href?: string; action?: string } {
  switch (gate) {
    case "IDENTITY_REQUIRED":
      return {
        title: t("flextvStreamer.identityTitle"),
        text: t("flextvStreamer.identityText"),
        href: `${FLEXTV_WEB_URL}/my/personal-auth`,
        action: t("flextvStreamer.identityAction")
      };
    case "FOREIGNER":
      return {
        title: t("flextvStreamer.foreignerTitle"),
        text: t("flextvStreamer.foreignerText"),
        href: `${FLEXTV_WEB_URL}/cs/inquiry`,
        action: t("flextvStreamer.foreignerAction")
      };
    case "UNDER_AGE":
      return { title: "만 14세부터 방송할 수 있어요", text: "본인인증 정보 기준으로 만 14세 이상 회원만 방송인으로 등록할 수 있어요." };
  }
}

/**
 * 내 채널 만들기 with FLEXTV (phase 5; code-first, no Figma frame). Route `/channel/new`. A FLEXTV member's channel
 * already exists: becoming a streamer is FLEXTV's 방송인 등록, after its 방송 준수사항. The server checks everything again.
 */
export function FlextvStreamerScreen({ gate: initialGate }: { gate: StreamerGate }) {
  const { t } = useI18n();
  const router = useRouter();
  const [gate, setGate] = useState(initialGate);
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const res = await becomeStreamer({ agreed });
      if (res.status === "REGISTERED" || res.status === "ALREADY_CREATOR") {
        router.push("/creator/broadcast");
        router.refresh();
      } else if (res.status === "INVALID") setError(res.message);
      else if (res.status === "PENDING") setError(t("flextvStreamer.pendingError"));
      else if (res.status === "UNKNOWN") setError(t("flextvStreamer.unknownError"));
      else if (res.status === "UNAUTHORIZED") router.push("/login?next=/channel/new");
      else setGate(res.status);
    });
  };

  const blocked = gate === "ELIGIBLE" ? null : gateCopy(gate, t);

  return (
    <div className={styles.content}>
      <header className={styles.header}>
        <h1 className={styles.title}>{t("flextvStreamer.title")}</h1>
        <p className={styles.subtitle}>{t("flextvStreamer.subtitle")}</p>
      </header>

      {blocked ? (
        <section className={styles.card} aria-labelledby="streamer-gate">
          <h2 id="streamer-gate" className={styles.subTitle}>
            {blocked.title}
          </h2>
          <p className={styles.note}>{blocked.text}</p>
          {blocked.href && (
            <a className={styles.submit} href={blocked.href} target="_blank" rel="noopener noreferrer">
              {blocked.action}
            </a>
          )}
        </section>
      ) : (
        <form
          className={styles.card}
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <section aria-labelledby="stream-policy">
            <h2 id="stream-policy" className={styles.subTitle}>
              {t("flextvStreamer.policyTitle")}
            </h2>
            <ul className={styles.benefits}>
              {STREAM_POLICY.map((line) => (
                <li key={line}>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </section>

          <label className={styles.agree}>
            <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
            <span>{t("flextvStreamer.policyAgree")}</span>
          </label>

          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}

          <button type="submit" className={styles.submit} disabled={pending || !agreed} aria-busy={pending || undefined}>
            {pending ? t("flextvStreamer.registering") : t("flextvStreamer.register")}
          </button>
          <p className={styles.note}>{t("flextvStreamer.channelNote")}</p>
        </form>
      )}

      <section aria-labelledby="ch-benefits">
        <h2 id="ch-benefits" className={styles.subTitle}>
          {t("flextvStreamer.benefits")}
        </h2>
        <ul className={styles.benefits}>
          {BENEFITS.map((b) => (
            <li key={b.title}>
              <strong>{t(b.title)}</strong>
              <span>{t(b.text)}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
