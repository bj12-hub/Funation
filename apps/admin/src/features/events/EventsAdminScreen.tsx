import Link from "next/link";
import { formatNumber } from "@/lib/format";
import { EVENT_PHASE_LABEL, type AdminEventPerson, type AdminEventResult, type AdminEventRow, type AdminEventsView, type EventReward } from "@/types/adminApi";
import styles from "../admin.module.css";
import { WithdrawnBadge } from "../WithdrawnBadge";
import { EventRewardForm, EventSettleButton } from "./EventRewardForm";

const when = (iso: string) => new Date(iso).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", dateStyle: "short", timeStyle: "short" });
const day = (iso: string) => new Date(iso).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" });

/** "참여자 전원 무상 FN · 1인 1,000 FN" / "추첨 3명 경품 · 굿즈 세트". */
const rewardText = (r: EventReward) => (r.kind === "FREE_FN" ? `참여자 전원 무상 FN · 1인 ${formatNumber(r.amountFn)} FN` : `추첨 ${formatNumber(r.winners)}명 경품 · ${r.prize}`);

function Person({ p }: { p: AdminEventPerson }) {
  return (
    <>
      {p.memberId ? (
        <Link href={`/members/${encodeURIComponent(p.memberId)}`} className={styles.rowLink}>
          {p.name}
        </Link>
      ) : (
        p.name
      )}
      <WithdrawnBadge withdrawn={p.withdrawn && p.memberId !== null} />
    </>
  );
}

/** 지급 불가: participants with no account now (withdrawn, no new account) — skipped, never paid or drawn. */
function Unpaid({ people, draw }: { people: AdminEventPerson[]; draw: boolean }) {
  if (people.length === 0) return null;
  return (
    <>
      <p className={styles.subTitle}>지급 불가 {formatNumber(people.length)}명</p>
      <p className={styles.muted}>{draw ? "지금 계정이 없는 참여자(탈퇴 후 새 계정 없음)라 추첨에서 뺐어요." : "지금 계정이 없는 참여자(탈퇴 후 새 계정 없음)라 지급하지 않았어요."}</p>
      <ul className={styles.history}>
        {people.map((p, i) => (
          <li key={`${p.memberId ?? "unknown"}-${i}`}>
            <Person p={p} />
          </li>
        ))}
      </ul>
    </>
  );
}

function Result({ r }: { r: AdminEventResult }) {
  if (r.kind === "FREE_FN") {
    return (
      <div className={styles.form}>
        <p className={styles.ok}>
          보상 지급 완료 · {when(r.at)} · {r.by}
        </p>
        <p className={styles.muted}>
          지급 {formatNumber(r.paid.length)}명 · 1인 {formatNumber(r.amountFn)} FN · 합계 {formatNumber(r.totalFn)} FN (무상 FN, 각자 지금 계정에 한 번)
        </p>
        {r.paid.length > 0 && (
          <ul className={styles.history}>
            {r.paid.map((p, i) => (
              <li key={`${p.memberId}-${i}`}>
                <Person p={p} /> · {formatNumber(r.amountFn)} FN
              </li>
            ))}
          </ul>
        )}
        <Unpaid people={r.unpaid} draw={false} />
      </div>
    );
  }
  return (
    <div className={styles.form}>
      <p className={styles.ok}>
        당첨자 추첨 완료 · {when(r.at)} · {r.by}
      </p>
      <p className={styles.muted}>
        추첨 대상 {formatNumber(r.pool)}명 중 {formatNumber(r.winners.length)}명 당첨 (추첨 인원 {formatNumber(r.winnersWanted)}명) · 경품: {r.prize} · 경품 전달 방법 TBD
      </p>
      {r.winners.length === 0 ? (
        <p className={styles.empty}>당첨자가 없어요.</p>
      ) : (
        <ul className={styles.history}>
          {r.winners.map((w, i) => (
            <li key={`${w.memberId}-${i}`}>
              <Person p={w} /> · 사이트 표시 {w.masked}
            </li>
          ))}
        </ul>
      )}
      <Unpaid people={r.unpaid} draw />
    </div>
  );
}

const PHASE_CHIP = { ongoing: styles.chipOk, upcoming: styles.chipInfo, ended: styles.chipNeutral } as const;

function EventCard({ e }: { e: AdminEventRow }) {
  return (
    <li className={styles.refundItem}>
      <div className={styles.refundHead}>
        <strong>
          {e.emoji} {e.title}
        </strong>
        <span className={PHASE_CHIP[e.phase]}>{EVENT_PHASE_LABEL[e.phase]}</span>
      </div>
      <p className={styles.muted}>
        {day(e.startsAt)} ~ {day(e.endsAt)} · 참여 기록 {formatNumber(e.participants)}명 (본인 기준)
        {e.sampleParticipants > 0 && ` · 사이트의 샘플 참여 수 ${formatNumber(e.sampleParticipants)}명은 목업 표시용이라 지급 · 추첨에 들어가지 않아요`}
      </p>
      <dl className={styles.facts}>
        <div>
          <dt>보상</dt>
          <dd>{e.reward ? rewardText(e.reward) : <span className={styles.warn}>설정 전 · 사이트에는 “보상 내용과 지급 방식은 정책이 확정되면 안내돼요 (TBD).”</span>}</dd>
        </div>
        {e.reward && (
          <div>
            <dt>마지막 변경</dt>
            <dd>
              {when(e.reward.updatedAt)} · {e.reward.updatedBy}
            </dd>
          </div>
        )}
      </dl>
      {e.result ? (
        <Result r={e.result} />
      ) : (
        <>
          <EventRewardForm eventId={e.id} reward={e.reward} />
          {e.reward && <EventSettleButton eventId={e.id} reward={e.reward} participants={e.participants} ended={e.phase === "ended"} />}
        </>
      )}
    </li>
  );
}

/** 운영 › 이벤트 — code-first (2026-10-08 결정). Route `/events`. */
export function EventsAdminScreen({ view }: { view: AdminEventsView }) {
  return (
    <div className={styles.content}>
      <header className={styles.pageHead}>
        <h1 className={styles.title}>이벤트</h1>
        <p className={styles.muted}>
          이벤트마다 보상을 정하고, 이벤트가 끝나면 한 번 지급하거나 추첨해요. 참여자는 본인 기준으로 세고, 지급은 그 사람의 지금 계정으로 가요. 경품 고시 · 제세공과금 · 경품 전달 방법은 TBD예요.
        </p>
      </header>
      <section className={styles.card}>
        {view.events.length === 0 ? (
          <p className={styles.empty}>이벤트가 없어요.</p>
        ) : (
          <ul className={styles.refundList}>
            {view.events.map((e) => (
              <EventCard key={e.id} e={e} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
