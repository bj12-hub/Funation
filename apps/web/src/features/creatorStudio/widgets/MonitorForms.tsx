"use client";

import { useEffect, useId, useState, useTransition } from "react";
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
  return (
    <div role="radiogroup" aria-label={label} className={a.layouts}>
      {options.map((o) => (
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
  const send = (input: { donor: string; amount: number } | null, ok: string) =>
    startTransition(async () => {
      const res = await setTopDonationOverride(input);
      if (res.status === "SAVED") {
        setTop(res.top);
        setNote({ ok: true, text: ok });
        setDonor("");
        setAmount("");
      } else setNote({ ok: false, text: res.status === "INVALID" ? res.message : "로그인이 필요해요." });
    });
  return (
    <Section title="현재 최고 후원">
      <p className={styles.hint}>{top ? `${top.donor} · ${top.amount}${top.manual ? " (직접 고친 값)" : ""}` : "이 기간에 아직 최고 후원이 없어요."}</p>
      <div className={styles.inline}>
        <input className={styles.input} aria-label="최고 후원 후원자" placeholder="후원자" maxLength={TOP_DONATION_DONOR_MAX} value={donor} onChange={(e) => setDonor(e.target.value)} />
        <input
          className={styles.input}
          type="number"
          inputMode="numeric"
          aria-label="최고 후원 금액(FN)"
          placeholder="금액 (FN)"
          min={1}
          max={TOP_DONATION_AMOUNT_MAX}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <button type="button" className={styles.purpleSmall} disabled={pending || !donor.trim() || !amount} onClick={() => send({ donor, amount: Number(amount) }, "최고 후원을 고쳤어요.")}>
          수정
        </button>
        {top?.manual && (
          <button type="button" className={styles.smallButton} disabled={pending} onClick={() => send(null, "직접 고친 값을 지웠어요.")}>
            고친 값 지우기
          </button>
        )}
      </div>
      {note && (
        <p className={note.ok ? styles.hint : a.invalid} role={note.ok ? "status" : "alert"}>
          {note.text}
        </p>
      )}
      <p className={styles.hint}>설정 저장과 따로 바로 반영돼요. 고친 뒤에 들어오는 후원과 다시 금액을 비교하고, 지금 기간(일간이면 오늘)에만 적용돼요.</p>
    </Section>
  );
}

export function TopDonationForm({ value: v, onChange, live }: FormProps<"TOP_DONATION">) {
  const set = <P extends keyof typeof v>(k: P, x: (typeof v)[P]) => onChange({ ...v, [k]: x });
  const id = useId();
  return (
    <>
      <Section title="미리보기">
        <PreviewStage width={560} minHeight={160} label="최고 후원 미리보기">
          <TopDonationView settings={v} top={SAMPLE_TOP} theme={resolveTheme(live.appearance, v.theme)} />
        </PreviewStage>
        <p className={styles.hint}>기간 안에서 가장 큰 썸네이션 후원(FN) 한 건을 걸어 둬요. 그 후원의 알림에 나온 이름 그대로예요(익명 포함). 아직 후원이 없으면 아무것도 안 보여요.</p>
      </Section>

      <Section title="테마">
        <ThemeChoiceField value={v.theme} onChange={(x) => set("theme", x)} appearance={live.appearance} />
      </Section>

      <Section title="문구">
        <div className={styles.rows}>
          <Row label="제목" htmlFor={`${id}-title`}>
            <input id={`${id}-title`} className={styles.input} value={v.title} maxLength={TOP_DONATION_TITLE_MAX} onChange={(e) => set("title", e.target.value)} />
          </Row>
          <Row label="상금 문구" htmlFor={`${id}-prize`}>
            <input
              id={`${id}-prize`}
              className={styles.input}
              value={v.prize}
              maxLength={TOP_DONATION_PRIZE_MAX}
              placeholder="예: 방송 끝까지 1위면 상금 10만원 (비우면 없음)"
              onChange={(e) => set("prize", e.target.value)}
            />
          </Row>
          <Row label="메시지">
            <SwitchText label="후원 메시지 표시" checked={v.showMessage} onChange={(x) => set("showMessage", x)} text="최고 후원의 메시지를 아래에 보여 줘요" />
          </Row>
        </div>
        <p className={styles.hint}>상금은 화면 문구일 뿐이에요. 지급은 직접 진행해 주세요.</p>
      </Section>

      <Section title="집계">
        <div className={styles.rows}>
          <Row label="기간">
            <Select label="기간" value={v.period} options={RANKING_WIDGET_PERIODS} onChange={(x) => set("period", x)} width={120} />
          </Row>
        </div>
        <p className={styles.hint}>바뀌는 시점</p>
        <Choice label="바뀌는 시점" options={TOP_DONATION_TIMINGS} value={v.timing} onChange={(x) => set("timing", x)} />
        <p className={styles.hint}>같은 금액일 때</p>
        <Choice label="같은 금액일 때" options={TOP_DONATION_TIES} value={v.tie} onChange={(x) => set("tie", x)} />
      </Section>

      <TopDonationNow initial={live.topNow} />
    </>
  );
}

export function DonationMonitorForm({ value: v, onChange, live }: FormProps<"DONATION_MONITOR">) {
  const set = <P extends keyof typeof v>(k: P, x: (typeof v)[P]) => onChange({ ...v, [k]: x });
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
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
      <Section title="미리보기">
        <PreviewStage width={600} minHeight={150} label="후원 모니터링 미리보기">
          <DonationMonitorView settings={v} line={sample} theme={resolveTheme(live.appearance, v.theme)} now={now} />
        </PreviewStage>
        <p className={styles.hint}>후원 알림이 화면에 나올 때마다 그 후원으로 바뀌고, 다음 알림이 나올 때까지 그대로 남아요. 테스트 알림도 보여요.</p>
      </Section>

      <Section title="테마">
        <ThemeChoiceField value={v.theme} onChange={(x) => set("theme", x)} appearance={live.appearance} />
      </Section>

      <Section title="표시">
        <Choice label="표시 모드" options={MONITOR_LAYOUTS} value={v.layout} onChange={(x) => set("layout", x)} />
        <div className={styles.rows}>
          <Row label="메시지">
            <SwitchText label="후원 메시지 표시" checked={v.showMessage} onChange={(x) => set("showMessage", x)} />
          </Row>
        </div>
      </Section>
    </>
  );
}

export function SigQueueForm({ value: v, onChange, live }: FormProps<"SIG_QUEUE">) {
  const set = <P extends keyof typeof v>(k: P, x: (typeof v)[P]) => onChange({ ...v, [k]: x });
  const cards = SAMPLE_SIGS.slice(0, 1 + v.next).map((c, i) => ({ ...c, order: i + 1, message: v.showMessage ? c.message : "" }));
  return (
    <>
      <Section title="미리보기">
        <PreviewStage width={v.layout === "HORIZONTAL" ? 1200 : 420} minHeight={200} label="시그 큐 모니터 미리보기">
          <SigQueueView settings={v} cards={cards} theme={resolveTheme(live.appearance, v.theme)} />
        </PreviewStage>
        <p className={styles.hint}>
          시그니처 이미지가 있는 후원 알림(시그니처 후원, 금액이 맞은 시그니처)만 보여요. 지금 나오는 시그니처가 맨 앞, 그다음은 대기열 순서예요. 대기열이 비면 아무것도 안 보여요.
        </p>
      </Section>

      <Section title="테마">
        <ThemeChoiceField value={v.theme} onChange={(x) => set("theme", x)} appearance={live.appearance} />
      </Section>

      <Section title="카드">
        <Choice label="카드 배치" options={SIG_QUEUE_LAYOUTS} value={v.layout} onChange={(x) => set("layout", x)} />
        <div className={styles.rows}>
          <Row label="다음 카드">
            <Select label="다음 카드 수" value={v.next} options={Array.from({ length: SIG_QUEUE_NEXT_MAX + 1 }, (_, i) => i)} onChange={(x) => set("next", x)} width={110} format={(x) => `${x}장`} />
          </Row>
          <Row label="순번">
            <SwitchText label="순번 표시" checked={v.showOrder} onChange={(x) => set("showOrder", x)} text="카드 왼쪽 위에 1 · 2 · 3 (1 = 재생 중)" />
          </Row>
          <Row label="컴팩트">
            <SwitchText label="컴팩트" checked={v.compact} onChange={(x) => set("compact", x)} text="금액 줄을 빼요" />
          </Row>
          <Row label="메시지">
            <SwitchText label="후원 메시지 표시" checked={v.showMessage} onChange={(x) => set("showMessage", x)} text="두 줄까지" />
          </Row>
        </div>
      </Section>
    </>
  );
}
