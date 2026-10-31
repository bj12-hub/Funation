"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { Toast } from "@/components/ui/Toast";
import { formatNumber } from "@/lib/format";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { MessageKey } from "@/lib/i18n/translate";
import { checkIn, claimAttendanceReward } from "@/services/attendance/attendance";
import type { AttendanceReward, AttendanceSummary } from "@/services/attendance/attendanceTypes";
import styles from "./attendance.module.css";

const WEEKDAYS: MessageKey[] = ["myAttendance.sun", "myAttendance.mon", "myAttendance.tue", "myAttendance.wed", "myAttendance.thu", "myAttendance.fri", "myAttendance.sat"];

/** "October": the month name for the English titles (the Korean ones use the number). A calendar month, so UTC. */
const monthName = (year: number, month: number) =>
  new Intl.DateTimeFormat("en-US", { month: "long", timeZone: "UTC" }).format(Date.UTC(year, month - 1, 1));

type Dialog =
  | { kind: "NONE" }
  | { kind: "CHECKED_IN"; reward: number; next: AttendanceReward | null; autoPaid: AttendanceReward[] }
  | { kind: "CLAIM"; reward: AttendanceReward };

/**
 * 출석체크. Figma 583:4 (before check-in) · 585:452 (after) · 585:66 (완료 popup) · 585:830 (보상 popup).
 * Every number comes from the server; after an action the page reloads the server summary.
 */
export function AttendanceScreen({ summary }: { summary: AttendanceSummary }) {
  const { t } = useI18n();
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
        setToast(t("myAttendance.stampFailed"));
      }
    });

  const claim = (reward: AttendanceReward) =>
    run(async () => {
      try {
        const result = await claimAttendanceReward(reward.days);
        setDialog({ kind: "NONE" });
        if (result.status === "CLAIMED") setToast(t("myAttendance.claimed", { amount: formatNumber(result.fnAmount) }));
        else if (result.status === "UNAUTHORIZED") router.push("/login?next=/attendance");
        else setToast(t("myAttendance.claimUnavailable"));
        router.refresh();
      } catch {
        setToast(t("myAttendance.claimFailed"));
      }
    });

  return (
    <div className={styles.content}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>{t("myAttendance.title")} 🎁</h1>
          <p className={styles.subtitle}>{t("myAttendance.subtitle")}</p>
        </div>
        {summary.streak > 0 && (
          <span className={`${styles.streak} ${summary.checkedInToday ? styles.streakOn : ""}`}>🔥 {t("myAttendance.streak", { days: summary.streak })}</span>
        )}
      </header>

      <div className={styles.widgets}>
        <section className={`${styles.card} ${summary.checkedInToday ? styles.cardDone : ""}`} aria-labelledby="attendance-today">
          <h2 id="attendance-today" className={styles.cardTitle}>
            {t("myAttendance.today")}
          </h2>
          <div className={styles.stampRow}>
            <span className={styles.stamp} aria-hidden="true">
              {summary.checkedInToday ? "👑" : "🎯"}
            </span>
            <div className={styles.stampText}>
              {summary.checkedInToday ? (
                <>
                  <strong className={styles.done}>{t("myAttendance.doneToday")}</strong>
                  <span>{t("myAttendance.comeBack")}</span>
                </>
              ) : (
                <>
                  <strong>{t("myAttendance.notYet")}</strong>
                  <span>{t("myAttendance.stampHint", { amount: formatNumber(summary.dailyReward) })}</span>
                </>
              )}
            </div>
          </div>
          {summary.checkedInToday ? (
            <button type="button" className={`${styles.stampButton} ${styles.stampButtonDone}`} disabled>
              {t("myAttendance.doneButton")} 👍
            </button>
          ) : (
            <button type="button" className={styles.stampButton} onClick={stamp} disabled={pending}>
              {pending ? t("myAttendance.stamping") : `${t("myAttendance.stamp")} ✍️`}
            </button>
          )}
        </section>

        <section className={styles.card} aria-labelledby="attendance-next">
          <div className={styles.cardHeader}>
            <h2 id="attendance-next" className={styles.cardTitle}>
              {t("myAttendance.nextReward")}
            </h2>
            {next && <span className={styles.dday}>{t("myAttendance.dday", { days: next.days - summary.total })}</span>}
          </div>
          {next ? (
            <div className={styles.progress}>
              <div className={styles.progressLabels}>
                <span>{t("myAttendance.reach", { days: next.days })}</span>
                <strong>{t("myAttendance.pays", { amount: formatNumber(next.fnAmount) })}</strong>
              </div>
              <div
                className={styles.track}
                role="progressbar"
                aria-label={t("myAttendance.progress")}
                aria-valuemin={0}
                aria-valuemax={next.days}
                aria-valuenow={summary.total}
              >
                <div className={styles.fill} style={{ width: `${progress}%` }} />
              </div>
              <div className={styles.progressFoot}>
                <span>{t("myAttendance.daysDone", { days: summary.total })}</span>
                <span>{t("myAttendance.goal", { days: next.days })}</span>
              </div>
            </div>
          ) : (
            <p className={styles.allDone}>{t("myAttendance.allDone")}</p>
          )}
          <p className={styles.tip}>
            <span aria-hidden="true">💡</span> {t("myAttendance.tip")}
          </p>
        </section>
      </div>

      <section className={`${styles.card} ${styles.calendar}`} aria-labelledby="attendance-calendar">
        <div className={styles.cardHeader}>
          <h2 id="attendance-calendar" className={styles.calendarTitle}>
            📅 {t("myAttendance.calendarTitle", { year: summary.year, month: summary.month, monthName: monthName(summary.year, summary.month) })}
          </h2>
          <ul className={styles.legend}>
            <li>
              <span className={`${styles.dot} ${styles.dotDone}`} aria-hidden="true" />
              {t("myAttendance.legendDone")}
            </li>
            <li>
              <span className={styles.dot} aria-hidden="true" />
              {t("myAttendance.legendPending")}
            </li>
          </ul>
        </div>
        <Calendar summary={summary} />
      </section>

      <section className={styles.rewards} aria-labelledby="attendance-rewards">
        <h2 id="attendance-rewards" className={styles.rewardsTitle}>
          🎁 {t("myAttendance.rewardsTitle")}
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
        title={t("myAttendance.checkedInTitle")}
        width={480}
        className={styles.popup}
        customHeader={<PopupHeader icon="🎯" ring title={t("myAttendance.checkedInTitle")} />}
      >
        <p className={styles.popupBody}>
          {t("myAttendance.stampEarned")}
          <br />
          {t("myAttendance.credited", { amount: formatNumber(dialog.kind === "CHECKED_IN" ? dialog.reward : summary.dailyReward) })}
          {/* Code-first (2026-10-08 결정): 15·30일 보상은 달성 즉시 자동 지급. */}
          {dialog.kind === "CHECKED_IN" &&
            dialog.autoPaid.map((r) => (
              <span key={r.days}>
                <br />
                {t("myAttendance.autoPaidBefore", { days: r.days })}
                <strong className={styles.accent}>+{formatNumber(r.fnAmount)} FN</strong>
                {t("myAttendance.autoPaidAfter")}
              </span>
            ))}
        </p>
        <button
          type="button"
          className={styles.gradientButton}
          onClick={() => setDialog(dialog.kind === "CHECKED_IN" && dialog.next ? { kind: "CLAIM", reward: dialog.next } : { kind: "NONE" })}
        >
          {t("my.ok")}
        </button>
      </Modal>

      <Modal
        open={dialog.kind === "CLAIM"}
        onClose={() => !pending && setDialog({ kind: "NONE" })}
        title={t("myAttendance.claimTitle")}
        width={520}
        className={styles.popup}
        customHeader={<PopupHeader icon="🎁" title={t("myAttendance.claimHeader", { days: dialog.kind === "CLAIM" ? dialog.reward.days : "" })} />}
      >
        {dialog.kind === "CLAIM" && (
          <>
            <p className={styles.popupBody}>
              {t("myAttendance.congrats")}
              <br />
              <strong className={styles.accent}>{formatNumber(dialog.reward.fnAmount)} FN </strong>
              {t("myAttendance.claimAfter")}
            </p>
            <div className={styles.popupActions}>
              <button type="button" className={styles.closeButton} onClick={() => setDialog({ kind: "NONE" })} disabled={pending}>
                {t("my.close")}
              </button>
              <button type="button" className={styles.gradientButton} onClick={() => claim(dialog.reward)} disabled={pending}>
                {pending ? t("myAttendance.claiming") : t("myAttendance.claim")}
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
  const { t } = useI18n();
  const month = { year: summary.year, month: summary.month, monthName: monthName(summary.year, summary.month) };
  const checked = new Set(summary.checkedDays);
  const cells: (number | null)[] = [...Array(summary.firstWeekday).fill(null), ...Array.from({ length: summary.daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);

  return (
    <div className={styles.grid} role="grid" aria-label={t("myAttendance.calendar", month)}>
      <div className={styles.weekRow} role="row">
        {WEEKDAYS.map((d, i) => (
          <span key={d} role="columnheader" className={`${styles.weekday} ${i === 0 ? styles.sun : i === 6 ? styles.sat : ""}`}>
            {t(d)}
          </span>
        ))}
      </div>
      {Array.from({ length: cells.length / 7 }, (_, w) => (
        <div key={w} className={styles.weekRow} role="row">
          {cells.slice(w * 7, w * 7 + 7).map((day, i) => {
            if (day === null) return <span key={`blank-${w}-${i}`} role="gridcell" className={styles.blank} />;
            // Today is done once this person checked in today, even on an account they withdrew (once a day per person).
            const isChecked = checked.has(day) || (day === summary.today && summary.checkedInToday);
            const isToday = day === summary.today && !isChecked;
            return (
              <span
                key={day}
                role="gridcell"
                className={`${styles.cell} ${isToday ? styles.today : ""}`}
                aria-label={t("myAttendance.day", { ...month, day, status: t(isChecked ? "myAttendance.dayChecked" : isToday ? "myAttendance.dayToday" : "myAttendance.dayMissed") })}
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
  const { t } = useI18n();
  const achieved = reward.status !== "LOCKED";
  const body = (
    <>
      <span className={styles.rewardHeader}>
        <strong>{t("myAttendance.rewardDays", { days: reward.days })}</strong>
        {reward.status === "CLAIMED" && <span className={`${styles.chip} ${styles.chipClaimed}`}>{reward.auto ? t("myAttendance.paid") : t("myAttendance.claimedChip")}</span>}
        {reward.status === "CLAIMABLE" && <span className={`${styles.chip} ${styles.chipClaimable}`}>{t("myAttendance.claimable")}</span>}
        {/* Code-first (2026-10-08 결정): paid the moment it is reached, so there is nothing to claim. */}
        {reward.status === "LOCKED" && reward.auto && <span className={`${styles.chip} ${styles.chipClaimable}`}>{t("myAttendance.autoPay")}</span>}
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
