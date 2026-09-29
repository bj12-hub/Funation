"use client";

import { Modal } from "@/components/ui/Modal";
import styles from "./apply.module.css";

/**
 * Informational popups, Figma copy verbatim: 정산 관련 안내 (466:2) and 수수료 안내 (475:2).
 * The conditions, schedule and rates they describe are not approved policy (TBD) and nothing is
 * computed from this text — the server holds the numbers it actually uses. `minFn` comes from the
 * server so the displayed minimum matches the one it enforces.
 */

export function SettlementGuideModal({ open, onClose, minFn }: { open: boolean; onClose: () => void; minFn: number | null }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="정산 관련 안내"
      width={580}
      className={styles.popup}
      footer={
        <button type="button" className={styles.purpleButton} onClick={onClose}>
          확인
        </button>
      }
    >
      <div className={styles.guide}>
        <section>
          <h3 className={styles.guideHead}>
            <span className={styles.guideNum}>1</span>정산 신청 조건
          </h3>
          <p>아래 조건을 모두 충족한 경우 정산 신청이 가능합니다.</p>
          <ul className={styles.guideBox}>
            <li>정산 계약(정산 등록)이 완료된 경우</li>
            {minFn !== null && <li>정산 가능한 금액(후원금)이 {minFn.toLocaleString("ko-KR")}FN 이상인 경우</li>}
          </ul>
        </section>

        <section>
          <h3 className={styles.guideHead}>
            <span className={styles.guideNum}>2</span>정산 신청 일정 및 방법
          </h3>
          <h4 className={styles.guideSub}>수동 정산</h4>
          <p>
            정산 신청 조건을 충족한 경우 Funation 크리에이터로 로그인한 후<br />
            &apos;계정 관리 &gt; 정산 관리&apos;에서 직접 정산을 신청할 수 있습니다.
          </p>
          <ul className={styles.guideBox}>
            <li>신청 기간: 매월 1일 10:00 ~ 10일 23:50</li>
            <li>정산 대상: 정산 신청 전월 말일까지 이루어진 후원</li>
            <li>
              지급 일정: 정산 신청 당월 말일경
              <br />
              (말일이 공휴일일 경우, 그 전 영업일)
            </li>
          </ul>
          <div className={styles.guideExample}>
            <strong>예시)</strong>
            <p>
              5월에 정산을 신청하는 경우, 4월 30일까지 후원받은 FN이 정산 대상입니다. 5월 10일에 정산을 신청하더라도 5월 1일~5월 10일에 후원받은 FN은 해당 정산에 포함되지 않으며, 다음 달
              정산 대상에 포함됩니다.
            </p>
          </div>
          <h4 className={styles.guideSub}>자동 정산</h4>
          <p>자동 정산을 설정한 경우 매월 별도로 정산을 신청하지 않아도 자동으로 정산 신청이 진행됩니다.</p>
          <ul className={styles.guideBox}>
            <li>자동 신청 시점: 매월 10일에서 11일로 넘어가는 시점</li>
            <li>설정 적용 시점: 자동 정산 ON 설정 시 익월부터 적용</li>
            <li>정산 대상: 자동 정산 신청 전월 말일까지 이루어진 후원</li>
            <li>지급 일정: 자동 정산 신청 당월 말일경</li>
          </ul>
          <p className={styles.guideNote}>※ 자동 정산을 ON으로 설정한 당월에는 자동 정산이 적용되지 않으며, 익월부터 자동 정산 신청이 진행됩니다.</p>
          <p>자동 정산 설정 여부 및 관련 정보는 &apos;계정 관리 &gt; 정산 관리&apos;에서 확인하실 수 있습니다.</p>
        </section>

        <section>
          <h3 className={styles.guideHead}>
            <span className={styles.guideNum}>3</span>정산 지급 및 세금 신고 기준
          </h3>
          <p>정산금 지급 및 관련 세금 신고는 정산 신청이 이루어진 시점의 정산 정보를 기준으로 진행됩니다.</p>
          <p>따라서 정산 신청 이후 정산 유형, 명의, 사업자 정보 등 정산 정보를 변경하더라도 이미 신청된 정산 건에는 변경된 정보가 반영되지 않습니다.</p>
          <p>정산 정보를 변경하실 예정이라면 정산 신청 전에 등록된 정보를 반드시 확인해 주세요.</p>
          <p className={styles.guideBoxText}>
            다만, 정산 신청 이후 정산 정보를 재등록하여 변경된 정보로 당월 정산을 진행하고자 하는 경우, 매월 24일 이전까지 정산 정보 재등록을 완료한 후 고객센터로 문의해 주셔야 합니다.
          </p>
        </section>
      </div>
    </Modal>
  );
}

const FEE_GROUPS: { title: string; emoji: string; rows: [string, string][] }[] = [
  {
    title: "국내 카드 / 간편결제",
    emoji: "💳",
    rows: [
      ["신용카드", "3.11%"],
      ["토스페이", "3.31%"],
      ["삼성페이", "4.87%"],
      ["카카오/네이버/SSG페이", "4.35%"],
      ["PAYCO", "3.83%"]
    ]
  },
  {
    title: "계좌이체 / 가상계좌",
    emoji: "🏦",
    rows: [
      ["인터넷뱅킹 (실시간)", "2.07%"],
      ["Funation 간편결제", "2.07%"],
      ["인터넷뱅킹 (간편)", "3.83%"],
      ["가상계좌", "6.83%"]
    ]
  },
  { title: "휴대폰 결제", emoji: "📱", rows: [["휴대폰 소액/간편결제", "9.83%"]] },
  {
    title: "해외 결제",
    emoji: "🌐",
    rows: [
      ["페이팔 (PayPal)", "7.45%"],
      ["해외 VISA/MASTER", "8.80%"],
      ["해외 VISA/MASTER/JCB", "11.17%"],
      ["해외 UNIONPAY", "6.83%"]
    ]
  },
  {
    title: "상품권 / 문화권",
    emoji: "🎁",
    rows: [
      ["문화상품권 등", "9.83%"],
      ["기프티쇼 (기프티콘)", "17.27%"],
      ["Funation FN 교환권", "14.17%"]
    ]
  },
  {
    title: "FN / 포인트",
    emoji: "💰",
    rows: [
      ["티머니/캐시비", "10.97%"],
      ["모바일 팝", "10.97%"],
      ["통합포인트", "9%"],
      ["출석체크 보상", "12.10%"]
    ]
  }
];

export function FeeGuideModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const half = Math.ceil(FEE_GROUPS.length / 2);
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="수수료 안내"
      width={560}
      className={styles.popup}
      footer={
        <button type="button" className={styles.blueButton} onClick={onClose}>
          확인
        </button>
      }
    >
      <p className={styles.feeIntro}>실제 입금액은 후원받은 금액에서 PG사 수수료, 원천/소득세, Funation 이용 수수료가 공제된 금액이 입금됩니다.</p>
      <div className={styles.feeGrid}>
        {[FEE_GROUPS.slice(0, half), FEE_GROUPS.slice(half)].map((col, i) => (
          <div key={i} className={styles.feeCol}>
            {col.map((g) => (
              <table key={g.title} className={styles.feeTable}>
                <caption>
                  <span aria-hidden="true">{g.emoji}</span> {g.title}
                </caption>
                <tbody>
                  {g.rows.map(([name, rate]) => (
                    <tr key={name}>
                      <th scope="row">{name}</th>
                      <td>{rate}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ))}
          </div>
        ))}
      </div>
    </Modal>
  );
}
