"use client";

import { useEffect, useId, useState, useTransition } from "react";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { setTopDonationOverride } from "@/services/creator/widgetSettings";
import { PreviewStage } from "@/features/overlayTheme/PreviewStage";
import { ThemeChoiceField } from "@/features/overlayTheme/ThemeChoiceField";
import { resolveTheme } from "@/services/creator/overlayThemeTypes";
import type { MonitorLine, SigCard, TopDonation } from "@/services/creator/widgetOverlayTypes";
import {
  MONITOR_LAYOUTS,
  RANKING_WIDGET_PERIODS,
  SIG_QUEUE_LAYOUTS,
  SIG_QUEUE_NEXT_MAX,
  TOP_DONATION_AMOUNT_MAX,
  TOP_DONATION_DONOR_MAX,
  TOP_DONATION_PRIZE_MAX,
  TOP_DONATION_TIES,
  TOP_DONATION_TIMINGS,
  TOP_DONATION_TITLE_MAX
} from "@/services/creator/widgetSettingsTypes";
import { Row, Section, Select, SwitchText } from "./fields";
import type { FormProps } from "./forms";
import { periodText, translatedOptions } from "./widgetFormLabels";
import { DonationMonitorView, SigQueueView, TopDonationView } from "./MonitorViews";
import a from "./alertForm.module.css";
import styles from "./widgets.module.css";

/**
 * 알림 모니터 위젯 설정 (code-first, 2026-10-23 — StreamDonate 최고 후원 · 후원 모니터링 · 시그 큐 모니터 참고). The previews
 * draw the overlays with sample donations (fictional names, never stored).
 */

const SAMPLE_TOP: TopDonation = { donor: "하루봄", amount: "500,000 FN", message: "오늘 방송 최고예요!", at: new Date(0).toISOString() };
const SAMPLE_SIGS: Omit<SigCard, "order">[] = [
  { id: "s1", playing: true, donor: "도도쭈", amount: "10,002 FN", message: "제로투 가자!", imageUrl: "/mock/room/signatures/sig-1.png" },
  { id: "s2", playing: false, donor: "새벽감성", amount: "24,444 FN", message: "앙카 부탁해요", imageUrl: "/mock/room/signatures/sig-2.png" },
  { id: "s3", playing: false, donor: "밤톨게임", amount: "10,101 FN", message: "", imageUrl: "/mock/room/signatures/sig-3.png" },
  { id: "s4", playing: false, donor: "먹깨비소이", amount: "13,600 FN", message: "킥드럼!", imageUrl: "/mock/room/signatures/sig-4.png" },
  { id: "s5", playing: false, donor: "하루봄", amount: "22,222 FN", message: "", imageUrl: "/mock/room/signatures/sig-5.png" }
];

/** Option cards like 시계 모양: a title and a hint each. */
function Choice<T extends string>({ label, options, value, onChange }: { label: string; options: readonly { key: T; label: string; hint: string }[]; value: T; onChange: (v: T) => void }) {
  const id = useId();
  const { t } = useI18n();
  return (
    <div role="radiogroup" aria-label={label} className={a.layouts}>
      {translatedOptions(options, t).map((o) => (
        <label key={o.key} className={a.layout} data-checked={value === o.key || undefined}>
          <input type="radio" name={id} className={styles.srOnly} checked={value === o.key} onChange={() => onChange(o.key)} />
          <strong>{o.label}</strong>
          <span>{o.hint}</span>
        </label>
      ))}
    </div>
  );
}

/**
 * 현재 최고 후원 (2026-10-28, StreamDonate "후원자명 · 금액을 직접 고칠 수 있습니다"): sent at once, not with 설정 저장. The
 * entry stands for every donation before it in the 기간; later ones still compete with it.
 */
function TopDonationNow({ initial }: { initial: TopDonation | null }) {
  const [top, setTop] = useState(initial);
  const [donor, setDonor] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const { t } = useI18n();
  const send = (input: { donor: string; amount: number } | null, ok: string) =>
    startTransition(async () => {
      const res = await setTopDonationOverride(input);
      if (res.status === "SAVED") {
        setTop(res.top);
        setNote({ ok: true, text: ok });
        setDonor("");
        setAmount("");
      } else setNote({ ok: false, text: res.status === "INVALID" ? res.message : t("widgetFormMonitor.loginRequired") });
    });
  return (
    <Section title={t("widgetFormMonitor.topNow")}>
      <p className={styles.hint}>{top ? `${top.donor} · ${top.amount}${top.manual ? t("widgetFormMonitor.manualSuffix") : ""}` : t("widgetFormMonitor.noTop")}</p>
      <div className={styles.inline}>
        <input
          className={styles.input}
          aria-label={t("widgetFormMonitor.donorAria")}
          placeholder={t("widgetFormMonitor.donorPlaceholder")}
          maxLength={TOP_DONATION_DONOR_MAX}
          value={donor}
          onChange={(e) => setDonor(e.target.value)}
        />
        <input
          className={styles.input}
          type="number"
          inputMode="numeric"
          aria-label={t("widgetFormMonitor.amountAria")}
          placeholder={t("widgetFormMonitor.amountPlaceholder")}
          min={1}
          max={TOP_DONATION_AMOUNT_MAX}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <button
          type="button"
          className={styles.purpleSmall}
          disabled={pending || !donor.trim() || !amount}
          onClick={() => send({ donor, amount: Number(amount) }, t("widgetFormMonitor.fixed"))}
        >
          {t("widgetFormMonitor.edit")}
        </button>
        {top?.manual && (
          <button type="button" className={styles.smallButton} disabled={pending} onClick={() => send(null, t("widgetFormMonitor.cleared"))}>
            {t("widgetFormMonitor.clear")}
          </button>
        )}
      </div>
      {note && (
        <p className={note.ok ? styles.hint : a.invalid} role={note.ok ? "status" : "alert"}>
          {note.text}
        </p>
      )}
      <p className={styles.hint}>{t("widgetFormMonitor.nowHint")}</p>
    </Section>
  );
}

export function TopDonationForm({ value: v, onChange, live }: FormProps<"TOP_DONATION">) {
  const set = <P extends keyof typeof v>(k: P, x: (typeof v)[P]) => onChange({ ...v, [k]: x });
  const id = useId();
  const { t } = useI18n();
  return (
    <>
      <Section title={t("widgetForm.preview")}>
        <PreviewStage width={560} minHeight={160} label={t("widgetFormMonitor.topPreview")}>
          <TopDonationView settings={v} top={SAMPLE_TOP} theme={resolveTheme(live.appearance, v.theme)} />
        </PreviewStage>
        <p className={styles.hint}>{t("widgetFormMonitor.topHint")}</p>
      </Section>

      <Section title={t("widgetForm.theme")}>
        <ThemeChoiceField value={v.theme} onChange={(x) => set("theme", x)} appearance={live.appearance} />
      </Section>

      <Section title={t("widgetForm.textSection")}>
        <div className={styles.rows}>
          <Row label={t("widgetForm.titleLabel")} htmlFor={`${id}-title`}>
            <input id={`${id}-title`} className={styles.input} value={v.title} maxLength={TOP_DONATION_TITLE_MAX} onChange={(e) => set("title", e.target.value)} />
          </Row>
          <Row label={t("widgetFormMonitor.prizeLine")} htmlFor={`${id}-prize`}>
            <input
              id={`${id}-prize`}
              className={styles.input}
              value={v.prize}
              maxLength={TOP_DONATION_PRIZE_MAX}
              placeholder={t("widgetFormMonitor.prizePlaceholder")}
              onChange={(e) => set("prize", e.target.value)}
            />
          </Row>
          <Row label={t("widgetFormMonitor.message")}>
            <SwitchText label={t("widgetForm.showMessage")} checked={v.showMessage} onChange={(x) => set("showMessage", x)} text={t("widgetFormMonitor.topMessageHint")} />
          </Row>
        </div>
        <p className={styles.hint}>{t("widgetFormMonitor.prizeNote")}</p>
      </Section>

      <Section title={t("widgetFormMonitor.tally")}>
        <div className={styles.rows}>
          <Row label={t("widgetFormMonitor.period")}>
            <Select
              label={t("widgetFormMonitor.period")}
              value={v.period}
              options={RANKING_WIDGET_PERIODS}
              format={(x) => periodText(x, t)}
              onChange={(x) => set("period", x)}
              width={120}
            />
          </Row>
        </div>
        <p className={styles.hint}>{t("widgetFormMonitor.timing")}</p>
        <Choice label={t("widgetFormMonitor.timing")} options={TOP_DONATION_TIMINGS} value={v.timing} onChange={(x) => set("timing", x)} />
        <p className={styles.hint}>{t("widgetFormMonitor.tie")}</p>
        <Choice label={t("widgetFormMonitor.tie")} options={TOP_DONATION_TIES} value={v.tie} onChange={(x) => set("tie", x)} />
      </Section>

      <TopDonationNow initial={live.topNow} />
    </>
  );
}

export function DonationMonitorForm({ value: v, onChange, live }: FormProps<"DONATION_MONITOR">) {
  const set = <P extends keyof typeof v>(k: P, x: (typeof v)[P]) => onChange({ ...v, [k]: x });
  const [now, setNow] = useState<number | null>(null);
  const { t } = useI18n();
  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  // The sample was sent 12 seconds before this popup opened, so its "N초 전" counts on like the overlay.
  const [sentAt] = useState(() => new Date(Date.now() - 12_000).toISOString());
  const sample: MonitorLine = {
    id: "monitor-sample",
    donor: "도도쭈",
    amount: "10,000 FN",
    message: v.showMessage ? "오늘 노래 너무 좋아요!" : "",
    typeLabel: "텍스트 후원",
    platform: null,
    at: sentAt,
    playing: true,
    test: false
  };
  return (
    <>
      <Section title={t("widgetForm.preview")}>
        <PreviewStage width={600} minHeight={150} label={t("widgetFormMonitor.monitorPreview")}>
          <DonationMonitorView settings={v} line={sample} theme={resolveTheme(live.appearance, v.theme)} now={now} />
        </PreviewStage>
        <p className={styles.hint}>{t("widgetFormMonitor.monitorHint")}</p>
      </Section>

      <Section title={t("widgetForm.theme")}>
        <ThemeChoiceField value={v.theme} onChange={(x) => set("theme", x)} appearance={live.appearance} />
      </Section>

      <Section title={t("widgetForm.display")}>
        <Choice label={t("widgetFormMonitor.mode")} options={MONITOR_LAYOUTS} value={v.layout} onChange={(x) => set("layout", x)} />
        <div className={styles.rows}>
          <Row label={t("widgetFormMonitor.message")}>
            <SwitchText label={t("widgetForm.showMessage")} checked={v.showMessage} onChange={(x) => set("showMessage", x)} />
          </Row>
        </div>
      </Section>
    </>
  );
}

export function SigQueueForm({ value: v, onChange, live }: FormProps<"SIG_QUEUE">) {
  const set = <P extends keyof typeof v>(k: P, x: (typeof v)[P]) => onChange({ ...v, [k]: x });
  const cards = SAMPLE_SIGS.slice(0, 1 + v.next).map((c, i) => ({ ...c, order: i + 1, message: v.showMessage ? c.message : "" }));
  const { t } = useI18n();
  return (
    <>
      <Section title={t("widgetForm.preview")}>
        <PreviewStage width={v.layout === "HORIZONTAL" ? 1200 : 420} minHeight={200} label={t("widgetFormMonitor.sigPreview")}>
          <SigQueueView settings={v} cards={cards} theme={resolveTheme(live.appearance, v.theme)} />
        </PreviewStage>
        <p className={styles.hint}>{t("widgetFormMonitor.sigHint")}</p>
      </Section>

      <Section title={t("widgetForm.theme")}>
        <ThemeChoiceField value={v.theme} onChange={(x) => set("theme", x)} appearance={live.appearance} />
      </Section>

      <Section title={t("widgetFormMonitor.cards")}>
        <Choice label={t("widgetFormMonitor.cardLayout")} options={SIG_QUEUE_LAYOUTS} value={v.layout} onChange={(x) => set("layout", x)} />
        <div className={styles.rows}>
          <Row label={t("widgetFormMonitor.next")}>
            <Select
              label={t("widgetFormMonitor.nextCount")}
              value={v.next}
              options={Array.from({ length: SIG_QUEUE_NEXT_MAX + 1 }, (_, i) => i)}
              onChange={(x) => set("next", x)}
              width={110}
              format={(x) => t("widgetFormMonitor.nextFormat", { n: x })}
            />
          </Row>
          <Row label={t("widgetFormMonitor.order")}>
            <SwitchText label={t("widgetFormMonitor.showOrder")} checked={v.showOrder} onChange={(x) => set("showOrder", x)} text={t("widgetFormMonitor.orderHint")} />
          </Row>
          <Row label={t("widgetFormMonitor.compact")}>
            <SwitchText label={t("widgetFormMonitor.compact")} checked={v.compact} onChange={(x) => set("compact", x)} text={t("widgetFormMonitor.compactHint")} />
          </Row>
          <Row label={t("widgetFormMonitor.message")}>
            <SwitchText label={t("widgetForm.showMessage")} checked={v.showMessage} onChange={(x) => set("showMessage", x)} text={t("widgetFormMonitor.twoLines")} />
          </Row>
        </div>
      </Section>
    </>
  );
}
