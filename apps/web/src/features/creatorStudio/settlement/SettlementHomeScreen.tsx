import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronRightSmallIcon, FileTextIcon, GearIcon, UserIcon } from "@/components/icons";
import { SettlementStepper } from "./SettlementStepper";
import styles from "./settlement.module.css";

type Card = { title: string; lead: string; icon: ReactNode; href: string; notes: string[] };

/**
 * Card notes are Figma copy (429:84 · 429:98 · 429:112). The settlement date, minimum amount and
 * payout schedule they mention are product policy that is not approved yet (TBD) — they are shown
 * as written and are not enforced from these strings.
 */
const CARDS: Card[] = [
  {
    title: "정산 등록",
    lead: "어느 계좌로 입금 할까요?",
    icon: <UserIcon />,
    href: "/creator/settlement/register",
    notes: ["본인 명의의 계좌가 필요합니다.", "사업자인 경우 사업자 등록증 및 통장 사본이 필요합니다.", "외국인의 경우 추가 인증 서류가 필요합니다."]
  },
  {
    title: "정산 신청",
    lead: "정산 신청을 할 수 있어요",
    icon: <FileTextIcon />,
    href: "/creator/settlement/apply",
    notes: [
      "정산가능금액은 매 달 1일 정산되며, 바로 신청 가능합니다.",
      "최소 정산 신청 가능 금액은 10,000원 이상입니다.",
      "정산 신청은 매월 지정된 정산일(평일 기준)에 일괄 지급됩니다."
    ]
  },
  {
    title: "정산 관리",
    lead: "내 정산 정보를 확인 할 수 있어요",
    icon: <GearIcon />,
    href: "/creator/settlement/manage",
    notes: [
      "등록한 계좌 및 정산 정보를 언제든 수정할 수 있습니다.",
      "월별 정산 내역 및 누적 수수료를 한눈에 볼 수 있습니다.",
      "정산 증빙 자료(세금계산서 발행 등)를 다운로드합니다."
    ]
  }
];

/** Figma 429:4 settlement-management — 정산설정 home (route `/creator/settlement`). */
export function SettlementHomeScreen({ currentStep }: { currentStep: number }) {
  return (
    <div className={styles.content}>
      <h1 className={styles.pageTitle}>Funation 정산 현황</h1>
      <SettlementStepper current={currentStep} />

      <section className={styles.startSection} aria-labelledby="settle-start">
        <h2 id="settle-start" className={styles.startTitle}>
          정산을 시작할까요?
        </h2>
        <ul className={styles.cards}>
          {CARDS.map((card) => (
            <li key={card.title}>
              <Link href={card.href} className={styles.card}>
                <span className={styles.cardHead}>
                  <span className={styles.cardIcon} aria-hidden="true">
                    {card.icon}
                  </span>
                  <span className={styles.cardText}>
                    <span className={styles.cardTitle}>{card.title}</span>
                    <span className={styles.cardLead}>{card.lead}</span>
                  </span>
                  <ChevronRightSmallIcon className={styles.cardChevron} />
                </span>
                <ol className={styles.cardNotes}>
                  {card.notes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ol>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
