"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { saveEventReward, settleEventReward } from "@/lib/actions";
import { formatNumber } from "@/lib/format";
import { runAction } from "@/lib/runAction";
import { EVENT_REWARD_LIMITS, type ActionResult, type EventReward } from "@/types/adminApi";
import styles from "../admin.module.css";

const failText = (res: Exclude<ActionResult, { status: "OK" }>) =>
  res.status === "INVALID" ? res.message : res.status === "NOT_FOUND" ? "이벤트를 찾을 수 없어요." : res.status === "UNAUTHORIZED" ? "관리자 로그인이 필요합니다." : "사이트에 연결할 수 없어요. 잠시 후 다시 시도해 주세요.";

/** A whole number typed in a field, or null (the site validates the bounds again). */
const whole = (s: string) => (/^\d{1,9}$/.test(s.trim()) ? Number(s.trim()) : null);

const KINDS = [
  { key: "FREE_FN", label: "참여자 전원 무상 FN" },
  { key: "DRAW", label: "추첨 N명 경품" }
] as const;

/**
 * 보상 설정 (2026-10-08 결정): 참여자 전원 무상 FN (the amount — no default) or 추첨 N명 경품 (winner count + prize text).
 * The fields start empty for a new reward; the site validates and audits the change.
 */
export function EventRewardForm({ eventId, reward }: { eventId: string; reward: EventReward | null }) {
  const router = useRouter();
  const [kind, setKind] = useState<EventReward["kind"]>(reward?.kind ?? "FREE_FN");
  const [amount, setAmount] = useState(reward?.kind === "FREE_FN" ? String(reward.amountFn) : "");
  const [winners, setWinners] = useState(reward?.kind === "DRAW" ? String(reward.winners) : "");
  const [prize, setPrize] = useState(reward?.kind === "DRAW" ? reward.prize : "");
  const [msg, setMsg] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const ready = !pending && (kind === "FREE_FN" ? whole(amount) !== null : whole(winners) !== null && prize.trim().length >= EVENT_REWARD_LIMITS.prizeMin);

  const save = () => {
    const input = kind === "FREE_FN" ? { id: eventId, kind, amountFn: whole(amount) } : { id: eventId, kind, winners: whole(winners), prize: prize.trim() };
    setMsg(null);
    startTransition(async () => {
      const res = await runAction(() => saveEventReward(input));
      if (res.status === "OK") {
        setMsg({ tone: "ok", text: "보상을 저장했어요." });
        router.refresh();
      } else setMsg({ tone: "error", text: failText(res) });
    });
  };

  return (
    <div className={styles.form}>
      <div className={styles.segment} role="radiogroup" aria-label="보상 종류">
        {KINDS.map((k) => (
          <button key={k.key} type="button" role="radio" aria-checked={kind === k.key} className={styles.segmentItem} onClick={() => setKind(k.key)}>
            {k.label}
          </button>
        ))}
      </div>
      {kind === "FREE_FN" ? (
        <div className={styles.filters}>
          <input
            className={styles.input}
            inputMode="numeric"
            aria-label="1인 지급 FN"
            placeholder="1인 지급 FN (기본값 없음)"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <span className={styles.muted}>무상 FN · 환불 대상 아님 · 최대 {formatNumber(EVENT_REWARD_LIMITS.amountMaxFn)} FN</span>
        </div>
      ) : (
        <div className={styles.filters}>
          <input className={styles.input} inputMode="numeric" aria-label="당첨 인원" placeholder="당첨 인원" value={winners} onChange={(e) => setWinners(e.target.value)} />
          <input
            className={styles.input}
            aria-label="경품 내용"
            placeholder="경품 내용 (사이트에 보여요)"
            maxLength={EVENT_REWARD_LIMITS.prizeMax}
            value={prize}
            onChange={(e) => setPrize(e.target.value)}
          />
          <span className={styles.muted}>경품 고시 · 제세공과금 · 전달 방법은 TBD</span>
        </div>
      )}
      <button type="button" className={styles.button} disabled={!ready} onClick={save}>
        보상 저장
      </button>
      {pending && (
        <p className={styles.muted} role="status">
          저장 중…
        </p>
      )}
      {msg && (
        <p className={msg.tone === "error" ? styles.error : styles.ok} role={msg.tone === "error" ? "alert" : "status"}>
          {msg.text}
        </p>
      )}
    </div>
  );
}

/**
 * 보상 지급 / 당첨자 추첨 — once per event, only after it ended (the site refuses earlier). One request id per intended
 * action, so a retry after a lost response pays or draws once.
 */
export function EventSettleButton({ eventId, reward, participants, ended }: { eventId: string; reward: EventReward; participants: number; ended: boolean }) {
  const router = useRouter();
  const [msg, setMsg] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const requestId = useRef<string | null>(null);
  const draw = reward.kind === "DRAW";
  const label = draw ? "당첨자 추첨" : "보상 지급";

  const run = () => {
    const question = draw
      ? `참여자 ${formatNumber(participants)}명 중 ${formatNumber(reward.winners)}명을 추첨할까요? 한 번만 추첨할 수 있고 되돌릴 수 없어요.`
      : `참여자 ${formatNumber(participants)}명의 지금 계정에 무상 FN ${formatNumber(reward.amountFn)} FN씩 지급할까요? 한 번만 지급되고 되돌릴 수 없어요.`;
    if (!window.confirm(question)) return;
    requestId.current ??= crypto.randomUUID();
    const input = { id: eventId, kind: reward.kind, requestId: requestId.current };
    setMsg(null);
    startTransition(async () => {
      const res = await runAction(() => settleEventReward(input));
      if (res.status === "OK") {
        setMsg({ tone: "ok", text: draw ? "당첨자를 추첨했어요." : "보상을 지급했어요." });
        router.refresh();
      } else {
        setMsg({ tone: "error", text: failText(res) });
        if (res.status === "INVALID") router.refresh();
      }
    });
  };

  return (
    <div className={styles.form}>
      <button type="button" className={styles.primary} disabled={pending || !ended} onClick={run}>
        {label}
      </button>
      {!ended && <p className={styles.muted}>{draw ? "이벤트가 끝난 뒤에 당첨자를 추첨할 수 있어요." : "이벤트가 끝난 뒤에 보상을 지급할 수 있어요."}</p>}
      {pending && (
        <p className={styles.muted} role="status">
          처리 중…
        </p>
      )}
      {msg && (
        <p className={msg.tone === "error" ? styles.error : styles.ok} role={msg.tone === "error" ? "alert" : "status"}>
          {msg.text}
        </p>
      )}
    </div>
  );
}
