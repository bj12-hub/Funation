"use client";

import Link from "next/link";
import { useCallback, useState, type ReactNode } from "react";
import { ChevronRightSmallIcon, FileTextIcon, GearIcon, UserIcon } from "@/components/icons";
import { Toast } from "@/components/ui/Toast";
import { SettlementNoticeModal } from "./SettlementNoticeModal";
import styles from "./settlement.module.css";

type CardKey = "register" | "apply" | "manage";
type Card = { key: CardKey; title: string; lead: string; icon: ReactNode; href: string; notes: string[] };

/**
 * Card notes are Figma copy (429:84 · 429:98 · 429:112). The settlement date, minimum amount and
 * payout schedule they mention are product policy that is not approved yet (TBD) — they are shown
 * as written and are not enforced from these strings.
 */
const CARDS: Card[] = [
  {
    key: "register",
    title: "정산 등록",
    lead: "어느 계좌로 입금 할까요?",
    icon: <UserIcon />,
    href: "/creator/settlement/register",
    notes: ["본인 명의의 계좌가 필요합니다.", "사업자인 경우 사업자 등록증 및 통장 사본이 필요합니다.", "외국인의 경우 추가 인증 서류가 필요합니다."]
  },
  {
    key: "apply",
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
    key: "manage",
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

/**
 * 429:73 cards. 정산 등록 opens 433:4 (not registered) or 462:2 (already registered); 신청/관리
 * need a registration first, so they open 433:4 until one exists. The server re-checks on each page.
 */
export function SettlementStartCards({ registered, justRegistered }: { registered: boolean; justRegistered: boolean }) {
  const [dialog, setDialog] = useState<"needRegistration" | "alreadyRegistered" | null>(null);
  const [toast, setToast] = useState<string | null>(justRegistered ? "정산 자료 등록 신청이 완료되었습니다." : null);
  const clearToast = useCallback(() => setToast(null), []);
  const close = () => setDialog(null);

  return (
    <>
      <ul className={styles.cards}>
        {CARDS.map((card) => {
          const body = (
            <>
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
            </>
          );
          const gate = card.key === "register" ? (registered ? "alreadyRegistered" : "needRegistration") : registered ? null : "needRegistration";
          return (
            <li key={card.key}>
              {gate ? (
                <button type="button" className={styles.card} onClick={() => setDialog(gate)} aria-haspopup="dialog">
                  {body}
                </button>
              ) : (
                <Link href={card.href} className={styles.card}>
                  {body}
                </Link>
              )}
            </li>
          );
        })}
      </ul>

      <SettlementNoticeModal
        open={dialog === "needRegistration"}
        onClose={close}
        title="정산 자료 등록이 필요합니다"
        lines={["정산 자료가 등록되어 있지 않습니다.", "정산을 받기 위해서는 먼저 정산 자료를 등록해야 합니다.", "최초 등록을 진행해 주세요."]}
        action={
          <Link href="/creator/settlement/register" className={styles.btnBlue}>
            정산등록
          </Link>
        }
      />
      <SettlementNoticeModal
        open={dialog === "alreadyRegistered"}
        onClose={close}
        title="이미 등록된 정산 내역이 있습니다."
        lines={["등록된 정보 변경을 위해 정산 관리 페이지로 이동합니다."]}
        action={
          <Link href="/creator/settlement/manage" className={styles.btnBlue}>
            정산 관리 이동
          </Link>
        }
      />
      <Toast message={toast} onDone={clearToast} tone="neutral" />
    </>
  );
}
