"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { Toast } from "@/components/ui/Toast";
import { formatNumber } from "@/lib/format";
import { checkIn, claimAttendanceReward } from "@/services/attendance/attendance";
import type { AttendanceReward, AttendanceSummary } from "@/services/attendance/attendanceTypes";
import styles from "./attendance.module.css";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

type Dialog =
  | { kind: "NONE" }
  | { kind: "CHECKED_IN"; reward: number; next: AttendanceReward | null; autoPaid: AttendanceReward[] }
  | { kind: "CLAIM"; reward: AttendanceReward };

/**
 * 출석체크. Figma 583:4 (before check-in) · 585:452 (after) · 585:66 (완료 popup) · 585:830 (보상 popup).
 * Every number comes from the server; after an action the page reloads the server summary.
 */
export function AttendanceScreen({ summary }: { summary: AttendanceSummary }) {
  const router = useRouter();
  const [dialog, setDialog] = useState<Dialog>({ kind: "NONE" });
  const [pending, startTransition] = useTransition();
  const [toast, setToast] = useState<string | null>(null);
  // Blocks a second click before the pending state renders (the server also rejects repeats).
  const busy = useRef(false);
  const run = (action: () => Promise<void>) => {
    if (busy.current) return;
    busy.current = true;
    startTransition(async () => {
      try {
        await action();
      } finally {
        busy.current = false;
      }
    });
  };

  const next = summary.rewards.find((r) => r.days > summary.total) ?? null;
  const progress = next ? Math.min(100, (summary.total / next.days) * 100) : 100;

  const stamp = () =>
    run(async () => {
      try {
        const result = await checkIn();
        if (result.status === "CHECKED_IN") setDialog({ kind: "CHECKED_IN", reward: result.reward, next: result.claimable, autoPaid: result.autoPaid });
        else if (result.status === "UNAUTHORIZED") router.push("/login?next=/attendance");
        router.refresh();
      } catch {
        setToast("출석 처리에 실패했습니다. 다시 시도해 주세요.");
      }
    });

  const claim = (reward: AttendanceReward) =>
    run(async () => {
      try {
        const result = await claimAttendanceReward(reward.days);
        setDialog({ kind: "NONE" });
        if (result.status === "CLAIMED") setToast(`${formatNumber(result.fnAmount)} FN을 수령했습니다.`);
        else if (result.status === "UNAUTHORIZED") router.push("/login?next=/attendance");
        else setToast("이미 수령했거나 수령할 수 없는 보상입니다.");
        router.refresh();
      } catch {
        setToast("보상 수령에 실패했습니다. 다시 시도해 주세요.");
      }
    });

  return (
    <div className={styles.content}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>매일매일 출석체크! 🎁</h1>
          <p className={styles.subtitle}>하루 한 번 출석하고 푸짐한 FN과 한정판 굿즈 혜택을 챙기세요.</p>
        </div>
        {summary.streak > 0 && (
          <span className={`${styles.streak} ${summary.checkedInToday ? styles.streakOn : ""}`}>🔥 {summary.streak}일 연속 출석 중</span>
        )}
      </header>

      <div className={styles.widgets}>
        <section className={`${styles.card} ${summary.checkedInToday ? styles.cardDone : ""}`} aria-labelledby="attendance-today">
          <h2 id="attendance-today" className={styles.cardTitle}>
            오늘의 출석현황
          </h2>
          <div className={styles.stampRow}>
            <span className={styles.stamp} aria-hidden="true">
              {summary.checkedInToday ? "👑" : "🎯"}
            </span>
            <div className={styles.stampText}>
              {summary.checkedInToday ? (
                <>
                  <strong className={styles.done}>오늘의 출석 완료!</strong>
                  <span>내일 오전 00:00에 다시 출석하실 수 있습니다.</span>
                </>
              ) : (
                <>
                  <strong>오늘 출석이 완료되지 않았습니다.</strong>
                  <span>버튼을 눌러 스탬프를 찍고 {formatNumber(summary.dailyReward)} FN을 받아 가세요!</span>
                </>
              )}
            </div>
          </div>
          {summary.checkedInToday ? (
            <button type="button" className={`${styles.stampButton} ${styles.stampButtonDone}`} disabled>
              출석 완료되었습니다 👍
            </button>
          ) : (
            <button type="button" className={styles.stampButton} onClick={stamp} disabled={pending}>
              {pending ? "출석 처리 중..." : "오늘의 출석 도장 찍기 ✍️"}
            </button>
          )}
        </section>

        <section className={styles.card} aria-labelledby="attendance-next">
          <div className={styles.cardHeader}>
            <h2 id="attendance-next" className={styles.cardTitle}>
              다음 스페셜 보상까지
            </h2>
            {next && <span className={styles.dday}>D-{next.days - summary.total}일</span>}
          </div>
          {next ? (
            <div className={styles.progress}>
              <div className={styles.progressLabels}>
                <span>누적 출석 {next.days}일 달성 시</span>
                <strong>{formatNumber(next.fnAmount)} FN 지급</strong>
              </div>
              <div
                className={styles.track}
                role="progressbar"
                aria-label="다음 보상 진행률"
                aria-valuemin={0}
                aria-valuemax={next.days}
                aria-valuenow={summary.total}
              >
                <div className={styles.fill} style={{ width: `${progress}%` }} />
              </div>
              <div className={styles.progressFoot}>
                <span>{summary.total}일 완료</span>
                <span>목표 {next.days}일</span>
              </div>
            </div>
          ) : (
            <p className={styles.allDone}>이번 달 누적 출석 보상을 모두 달성했어요!</p>
          )}
          <p className={styles.tip}>
            <span aria-hidden="true">💡</span> 하루라도 결석 시 연속 출석 일수가 초기화되니 주의하세요!
          </p>
        </section>
      </div>

      <section className={`${styles.card} ${styles.calendar}`} aria-labelledby="attendance-calendar">
        <div className={styles.cardHeader}>
          <h2 id="attendance-calendar" className={styles.calendarTitle}>
            📅 {summary.year}년 {summary.month}월 출석현황
          </h2>
          <ul className={styles.legend}>
            <li>
              <span className={`${styles.dot} ${styles.dotDone}`} aria-hidden="true" />
              출석 완료
            </li>
            <li>
              <span className={styles.dot} aria-hidden="true" />
              미출석/대기
            </li>
          </ul>
        </div>
        <Calendar summary={summary} />
      </section>

      <section className={styles.rewards} aria-labelledby="attendance-rewards">
        <h2 id="attendance-rewards" className={styles.rewardsTitle}>
          🎁 누적 출석 단계별 특별 보상
        </h2>
        <ul className={styles.rewardCards}>
          {summary.rewards.map((r) => (
            <li key={r.days}>
              <RewardCard reward={r} onClaim={() => setDialog({ kind: "CLAIM", reward: r })} />
            </li>
          ))}
        </ul>
      </section>

      <Modal
        open={dialog.kind === "CHECKED_IN"}
        onClose={() => setDialog(dialog.kind === "CHECKED_IN" && dialog.next ? { kind: "CLAIM", reward: dialog.next } : { kind: "NONE" })}
        title="오늘의 출석체크 완료!"
        width={480}
        className={styles.popup}
        customHeader={<PopupHeader icon="🎯" ring title="오늘의 출석체크 완료!" />}
      >
        <p className={styles.popupBody}>
          스탬프를 성공적으로 획득했습니다!
          <br />+{formatNumber(dialog.kind === "CHECKED_IN" ? dialog.reward : summary.dailyReward)} FN이 보관함으로 적립되었습니다.
          {/* Code-first (2026-10-08 결정): 15·30일 보상은 달성 즉시 자동 지급. */}
          {dialog.kind === "CHECKED_IN" &&
            dialog.autoPaid.map((r) => (
              <span key={r.days}>
                <br />
                {r.days}일 누적 보상 <strong className={styles.accent}>+{formatNumber(r.fnAmount)} FN</strong>도 자동으로 지급되었습니다.
              </span>
            ))}
        </p>
        <button
          type="button"
          className={styles.gradientButton}
          onClick={() => setDialog(dialog.kind === "CHECKED_IN" && dialog.next ? { kind: "CLAIM", reward: dialog.next } : { kind: "NONE" })}
        >
          확인
        </button>
      </Modal>

      <Modal
        open={dialog.kind === "CLAIM"}
        onClose={() => !pending && setDialog({ kind: "NONE" })}
        title="누적 특별 보상 획득"
        width={520}
        className={styles.popup}
        customHeader={<PopupHeader icon="🎁" title={`${dialog.kind === "CLAIM" ? dialog.reward.days : ""}일 누적 특별 보상 획득!`} />}
      >
        {dialog.kind === "CLAIM" && (
          <>
            <p className={styles.popupBody}>
              꾸준한 출석을 축하합니다!
              <br />
              <strong className={styles.accent}>{formatNumber(dialog.reward.fnAmount)} FN </strong>가 지급됩니다. 지금 수령하시겠습니까?
            </p>
            <div className={styles.popupActions}>
              <button type="button" className={styles.closeButton} onClick={() => setDialog({ kind: "NONE" })} disabled={pending}>
                닫기
              </button>
              <button type="button" className={styles.gradientButton} onClick={() => claim(dialog.reward)} disabled={pending}>
                {pending ? "수령 중..." : "보상 수령하기"}
              </button>
            </div>
          </>
        )}
      </Modal>

      <Toast message={toast} tone="neutral" onDone={() => setToast(null)} />
    </div>
  );
}

function Calendar({ summary }: { summary: AttendanceSummary }) {
  const checked = new Set(summary.checkedDays);
  const cells: (number | null)[] = [...Array(summary.firstWeekday).fill(null), ...Array.from({ length: summary.daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);

  return (
    <div className={styles.grid} role="grid" aria-label={`${summary.year}년 ${summary.month}월 출석 달력`}>
      <div className={styles.weekRow} role="row">
        {WEEKDAYS.map((d, i) => (
          <span key={d} role="columnheader" className={`${styles.weekday} ${i === 0 ? styles.sun : i === 6 ? styles.sat : ""}`}>
            {d}
          </span>
        ))}
      </div>
      {Array.from({ length: cells.length / 7 }, (_, w) => (
        <div key={w} className={styles.weekRow} role="row">
          {cells.slice(w * 7, w * 7 + 7).map((day, i) => {
            if (day === null) return <span key={`blank-${w}-${i}`} role="gridcell" className={styles.blank} />;
            const isChecked = checked.has(day);
            const isToday = day === summary.today && !isChecked;
            return (
              <span
                key={day}
                role="gridcell"
                className={`${styles.cell} ${isToday ? styles.today : ""}`}
                aria-label={`${summary.month}월 ${day}일 ${isChecked ? "출석 완료" : isToday ? "오늘, 미출석" : "미출석"}`}
              >
                {isChecked ? (
                  <>
                    <span className={styles.dayChecked}>{day}</span>
                    <span className={styles.check} aria-hidden="true">
                      ✓
                    </span>
                  </>
                ) : isToday ? (
                  <>
                    <span className={styles.dayToday}>{day}</span>
                    <span className={styles.todayLabel}>TODAY</span>
                  </>
                ) : (
                  <>
                    <span className={styles.dayPending}>{day}</span>
                    <span className={styles.dot} aria-hidden="true" />
                  </>
                )}
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function RewardCard({ reward, onClaim }: { reward: AttendanceReward; onClaim: () => void }) {
  const achieved = reward.status !== "LOCKED";
  const body = (
    <>
      <span className={styles.rewardHeader}>
        <strong>{reward.days}일 출석 보상</strong>
        {reward.status === "CLAIMED" && <span className={`${styles.chip} ${styles.chipClaimed}`}>{reward.auto ? "지급 완료" : "수령 완료"}</span>}
        {reward.status === "CLAIMABLE" && <span className={`${styles.chip} ${styles.chipClaimable}`}>수령 대기</span>}
        {/* Code-first (2026-10-08 결정): paid the moment it is reached, so there is nothing to claim. */}
        {reward.status === "LOCKED" && reward.auto && <span className={`${styles.chip} ${styles.chipClaimable}`}>달성 시 자동 지급</span>}
      </span>
      <span className={styles.rewardBody}>
        <span className={styles.rewardEmoji} aria-hidden="true">
          {reward.emoji}
        </span>
        <span className={styles.rewardText}>
          <strong>{formatNumber(reward.fnAmount)} FN</strong>
          <span>{reward.description}</span>
        </span>
      </span>
    </>
  );
  // Only a claimable reward is actionable (opens 585:830).
  return reward.status === "CLAIMABLE" ? (
    <button type="button" className={`${styles.rewardCard} ${styles.rewardAchieved} ${styles.rewardClickable}`} onClick={onClaim}>
      {body}
    </button>
  ) : (
    <div className={`${styles.rewardCard} ${achieved ? styles.rewardAchieved : ""}`}>{body}</div>
  );
}

function PopupHeader({ icon, title, ring = false }: { icon: string; title: string; ring?: boolean }) {
  return (
    <header className={styles.popupHeader}>
      <span className={ring ? styles.popupIconRing : styles.popupIcon} aria-hidden="true">
        {icon}
      </span>
      <h2 className={styles.popupTitle}>{title}</h2>
    </header>
  );
}
