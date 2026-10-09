import Link from "next/link";
import { formatCompactKo, formatNumber } from "@/lib/format";
import {
  ADMIN_QUERY_MAX,
  AUDIT_ACTION_LABEL,
  REFUND_TYPE_LABEL,
  type AuditEntry,
  type AdminCreatorRow,
  type AdminMember,
  type FnSettlementLine,
  type MemberFnSettlement,
  type MemberPage
} from "@/types/adminApi";
import { SITE_URL } from "@/lib/siteUrl";
import styles from "../admin.module.css";
import { FnSettlementAction } from "./FnSettlementAction";
import { MemberActions } from "./MemberActions";

const ROLE_LABEL = { SUPPORTER: "후원자", CREATOR: "크리에이터", ADMIN: "관리자" } as const;
const day = (iso: string) => iso.slice(0, 10).replace(/-/g, ".");
/** The Korean date of an ISO time ("2031.10.08"), whatever the server's zone: retention dates are Korean dates. */
const koreanDay = (iso: string) => day(new Date(Date.parse(iso) + 9 * 3_600_000).toISOString());

const STATUS_CHIP = {
  ACTIVE: { label: "정상", className: styles.chipOk },
  SUSPENDED: { label: "정지", className: styles.chipBad },
  WITHDRAWN: { label: "탈퇴", className: styles.chipNeutral }
} as const;

function StatusChip({ status }: { status: AdminMember["status"] }) {
  return <span className={STATUS_CHIP[status].className}>{STATUS_CHIP[status].label}</span>;
}

/** 회원 관리 — code-first. Route `/members` (`?q=&role=&status=&page=`). */
export function MembersScreen({ page }: { page: MemberPage }) {
  const f = page.filter;
  const href = (p: number) => `/members?${new URLSearchParams({ ...(f.q ? { q: f.q } : {}), role: f.role, status: f.status, page: String(p) })}`;
  return (
    <div className={styles.content}>
      <header className={styles.pageHead}>
        <h1 className={styles.title}>회원 관리</h1>
        <p className={styles.muted}>닉네임 · 썸네이션 ID · 회원 번호로 찾을 수 있어요. 개인정보(이메일 · 연락처)는 표시하지 않아요 (열람 권한 TBD).</p>
      </header>
      <form className={styles.filters} action="/members">
        <input className={styles.input} name="q" defaultValue={f.q} placeholder="닉네임 · ID 검색" aria-label="검색어" maxLength={ADMIN_QUERY_MAX} />
        <select className={styles.input} name="role" defaultValue={f.role} aria-label="역할">
          <option value="ALL">전체 역할</option>
          <option value="SUPPORTER">후원자</option>
          <option value="CREATOR">크리에이터</option>
        </select>
        <select className={styles.input} name="status" defaultValue={f.status} aria-label="상태">
          <option value="ALL">전체 상태</option>
          <option value="ACTIVE">정상</option>
          <option value="SUSPENDED">정지</option>
          <option value="WITHDRAWN">탈퇴</option>
        </select>
        <button type="submit" className={styles.button}>
          검색
        </button>
      </form>
      <section className={styles.card}>
        <p className={styles.muted}>총 {formatNumber(page.total)}명</p>
        {page.items.length === 0 ? (
          <p className={styles.empty}>조건에 맞는 회원이 없어요.</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">회원</th>
                <th scope="col">역할</th>
                <th scope="col">가입일</th>
                <th scope="col">누적 후원</th>
                <th scope="col">상태</th>
              </tr>
            </thead>
            <tbody>
              {page.items.map((m) => (
                <tr key={m.id}>
                  <td>
                    <Link href={`/members/${m.id}`} className={styles.rowLink}>
                      {m.nickname}
                    </Link>
                    <span className={styles.muted}> @{m.ssumnationId}</span>
                  </td>
                  <td>{m.roles.map((r) => ROLE_LABEL[r]).join(" · ")}</td>
                  <td>{day(m.joinedAt)}</td>
                  <td>{formatNumber(m.donationTotalFn)} FN</td>
                  <td>
                    <StatusChip status={m.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {page.totalPages > 1 && (
          <nav className={styles.pager} aria-label="페이지">
            {Array.from({ length: page.totalPages }, (_, i) => i + 1).map((p) => (
              <Link key={p} href={href(p)} aria-current={p === page.page ? "page" : undefined} className={styles.pageLink}>
                {p}
              </Link>
            ))}
          </nav>
        )}
      </section>
    </div>
  );
}

/** 회원 상세 — code-first. Route `/members/[id]`. `fnSettlement`: 남은 FN 정리 of a 영구 정지 member (null otherwise). */
export function MemberDetailScreen({ member, audit, fnSettlement = null }: { member: AdminMember; audit: AuditEntry[]; fnSettlement?: MemberFnSettlement | null }) {
  const facts = [
    ["회원 번호", member.id],
    ["썸네이션 ID", `@${member.ssumnationId}`],
    ["역할", member.roles.map((r) => ROLE_LABEL[r]).join(" · ")],
    ["가입일", day(member.joinedAt)],
    ["최근 활동", day(member.lastActiveAt)],
    ["보유 FN", `${formatNumber(member.fnBalance)} FN`],
    ["누적 후원", `${formatNumber(member.donationTotalFn)} FN`]
  ];
  return (
    <div className={styles.content}>
      <header className={styles.pageHead}>
        <Link href="/members" className={styles.link}>
          ← 회원 관리
        </Link>
        <h1 className={styles.title}>
          {member.nickname} <StatusChip status={member.status} />
        </h1>
      </header>
      <div className={styles.split}>
        <section className={styles.card} aria-labelledby="mem-info">
          <h2 id="mem-info" className={styles.cardTitle}>
            기본 정보
          </h2>
          <dl className={styles.facts}>
            {facts.map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
          {member.creatorId && (
            <p className={styles.muted}>
              크리에이터 채널: <a href={`${SITE_URL}/creators/${member.creatorId}`} className={styles.link} target="_blank" rel="noreferrer">/creators/{member.creatorId}</a>
            </p>
          )}
        </section>
        <section className={styles.card} aria-labelledby="mem-mod">
          <h2 id="mem-mod" className={styles.cardTitle}>
            이용 제한
          </h2>
          {member.suspension && (
            <>
              <p className={styles.muted}>
                {member.suspension.until ? `${day(member.suspension.until)}까지 정지` : "영구 정지"} · 사유: {member.suspension.reason} · 처리: {member.suspension.by}
              </p>
              <p className={styles.muted}>
                {member.suspension.until
                  ? "정지 중에도 보유 FN은 그대로 남아요. 정지 중에는 쓸 수 없고, 정지가 풀리면 다시 쓸 수 있어요."
                  : "영구 정지된 회원은 로그인할 수 없어요. 회원이 요청하면 아래 '남은 FN 정리'에서 남은 FN을 처리해요."}
              </p>
            </>
          )}
          {member.withdrawal ? (
            <p className={styles.muted}>
              {new Date(member.withdrawal.at).toLocaleString("ko-KR")} 회원 탈퇴 · 소멸 FN {formatNumber(member.withdrawal.forfeitedFn)} FN
              {member.withdrawal.forfeitedEarningsFn > 0 && ` · 소멸 정산 대기 수익 ${formatNumber(member.withdrawal.forfeitedEarningsFn)} FN`} (회원 동의) · 탈퇴한 회원은 이용 제한을 바꿀 수 없어요.
            </p>
          ) : (
            <MemberActions id={member.id} suspended={member.status === "SUSPENDED"} />
          )}
          <h3 className={styles.subTitle}>처리 이력</h3>
          {audit.length === 0 ? (
            <p className={styles.muted}>처리 이력이 없어요.</p>
          ) : (
            <ul className={styles.history}>
              {audit.map((e) => (
                <li key={e.id}>
                  <strong>{AUDIT_ACTION_LABEL[e.action]}</strong> · {e.reason ?? "—"} · {e.actorName} · {new Date(e.at).toLocaleString("ko-KR")}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      {fnSettlement && <FnSettlementCard id={member.id} plan={fnSettlement} />}
      {member.withdrawal && <RetentionCard withdrawal={member.withdrawal} />}
    </div>
  );
}

const fn = (n: number) => `${formatNumber(n)} FN`;
const won = (n: number) => `${formatNumber(n)}원`;
const when = (s: string) => s.slice(0, 16).replace("T", " ");
/** "환불 2건 · 12,500 FN 회수 · 11,750 FN 환불 · 12,925원 · 무상 FN 소멸 300 FN" */
const settledText = (lines: FnSettlementLine[], forfeitFn: number) => {
  const t = lines.reduce((s, l) => ({ grossFn: s.grossFn + l.grossFn, netFn: s.netFn + l.netFn, refundKrw: s.refundKrw + l.refundKrw }), { grossFn: 0, netFn: 0, refundKrw: 0 });
  const refund = lines.length > 0 ? `환불 ${lines.length}건 · ${fn(t.grossFn)} 회수 · ${fn(t.netFn)} 환불 · ${won(t.refundKrw)}` : "환불한 유상 FN 없음";
  return `${refund} · 무상 FN 소멸 ${fn(forfeitFn)}`;
};

/**
 * 남은 FN 정리 — code-first (2026-10-08 결정). On a 영구 정지 member's detail: the paid FN still unused per charge and
 * what each refunds under the site's refund policy (type · 회수 · 수수료 · 환불 FN · 환불 금액), the free FN that would be
 * forfeited, and one action. States: READY (form), EMPTY ("정리할 FN이 없어요."), BLOCKED (the site's reason, form
 * DISABLED), NO_LEDGER (mock: no wallet ledger for this member). Earlier 정리 of the member are listed under 정리 이력.
 */
function FnSettlementCard({ id, plan }: { id: string; plan: MemberFnSettlement }) {
  return (
    <section className={styles.card} aria-labelledby="mem-fn-settle">
      <h2 id="mem-fn-settle" className={styles.cardTitle}>
        남은 FN 정리
      </h2>
      <p className={styles.muted}>
        영구 정지된 회원은 로그인할 수 없어, 회원이 요청하면 운영자가 남은 FN을 정리해요. 유상 FN은 충전 건별로 환불 정책 기본값대로 환불하고(청약철회 기간 안의 미사용 충전은 전액 취소, 그 밖에는 수수료 공제 후 환불), 무상 FN은 소멸돼요. 처리하면 보유 FN이 0이 되고 되돌릴 수 없어요.
      </p>
      {plan.status === "NO_LEDGER" ? (
        <p className={styles.empty}>이 회원의 지갑 기록이 없어 남은 FN을 계산할 수 없어요. (목업은 샘플 회원만 지갑 기록이 있어요 — 회원별 지갑 원장은 백엔드 연동 후.)</p>
      ) : plan.status === "EMPTY" ? (
        <p className={styles.empty}>정리할 FN이 없어요.</p>
      ) : (
        <>
          <p className={styles.muted}>보유 FN: {fn(plan.balanceFn)}</p>
          {plan.lines.length === 0 ? (
            <p className={styles.muted}>환불할 유상 FN이 없어요.</p>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">충전</th>
                  <th scope="col">충전 FN · 결제 금액</th>
                  <th scope="col">유형</th>
                  <th scope="col">회수 FN</th>
                  <th scope="col">수수료</th>
                  <th scope="col">환불 FN</th>
                  <th scope="col">환불 금액</th>
                </tr>
              </thead>
              <tbody>
                {plan.lines.map((l) => (
                  <tr key={l.chargeId}>
                    <td>
                      {when(l.chargedAt)} · {l.methodLabel}
                    </td>
                    <td>
                      {fn(l.chargeFn)} · {won(l.paidKrw)}
                    </td>
                    <td>{REFUND_TYPE_LABEL[l.type]}</td>
                    <td>{fn(l.grossFn)}</td>
                    <td>{fn(l.feeFn)}</td>
                    <td>{fn(l.netFn)}</td>
                    <td>{won(l.refundKrw)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row" colSpan={3}>
                    합계
                  </th>
                  <td>{fn(plan.total.grossFn)}</td>
                  <td>{fn(plan.total.feeFn)}</td>
                  <td>{fn(plan.total.netFn)}</td>
                  <td>{won(plan.total.refundKrw)}</td>
                </tr>
              </tfoot>
            </table>
          )}
          <p className={styles.muted}>소멸되는 무상 FN: {fn(plan.forfeitFn)}</p>
          <p className={styles.muted}>원화 환불 금액은 전액 취소면 결제 금액 전액, 그 밖에는 환불 FN ÷ 충전 FN × 결제 금액(원 미만 버림)이에요. 결제 수단별 환불 방식은 결제 대행사 연동 후 확정이라 실제 결제 취소 · 송금은 아직 하지 않아요 (TBD).</p>
          {plan.blocked && (
            <p className={styles.warn} role="status">
              {plan.blocked}
            </p>
          )}
          <FnSettlementAction id={id} plan={plan} />
        </>
      )}
      {plan.history.length > 0 && (
        <>
          <h3 className={styles.subTitle}>정리 이력</h3>
          <ul className={styles.history}>
            {plan.history.map((h) => (
              <li key={h.at}>
                <strong>{settledText(h.lines, h.forfeitFn)}</strong> · {h.note} · {h.by} · {new Date(h.at).toLocaleString("ko-KR")}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

/**
 * 탈퇴 회원 정보 보관 — code-first. Until when each kind of a withdrawn member's data is kept, from the site's shared
 * list (기본값, 법무 검토 전); a date that has come shows as 파기됨. Records needed for audit stay until their date.
 */
function RetentionCard({ withdrawal }: { withdrawal: NonNullable<AdminMember["withdrawal"]> }) {
  return (
    <section className={styles.card} aria-labelledby="mem-retention">
      <h2 id="mem-retention" className={styles.cardTitle}>
        탈퇴 회원 정보 보관
      </h2>
      <p className={styles.muted}>
        보관 기간: {withdrawal.retentionNote}. 탈퇴 시각부터 세고, 기한이 되면 파기하거나 알아볼 수 없게 바꿔요. 표에 없는 개인정보는 탈퇴할 때 삭제됐어요.
      </p>
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col">분류</th>
            <th scope="col">보관 기한</th>
            <th scope="col">기간</th>
            <th scope="col">근거</th>
            <th scope="col">포함되는 것</th>
          </tr>
        </thead>
        <tbody>
          {withdrawal.retention.map((r) => (
            <tr key={r.category}>
              <td>{r.label}</td>
              <td>{r.until === null ? "삭제하지 않음" : r.purged ? `파기됨 (${koreanDay(r.until)})` : `${koreanDay(r.until)}까지`}</td>
              <td>{r.period}</td>
              <td>{r.basis}</td>
              <td>{r.covers}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

/** 크리에이터 관리 — code-first. Route `/creators`. */
export function CreatorsAdminScreen({ rows, q }: { rows: AdminCreatorRow[]; q: string }) {
  return (
    <div className={styles.content}>
      <header className={styles.pageHead}>
        <h1 className={styles.title}>크리에이터 관리</h1>
        <p className={styles.muted}>정지된 크리에이터의 채널은 공개 화면(크리에이터 찾기 · 채널)에서 숨겨져요. 채널 심사 · 플랫폼 인증은 TBD예요.</p>
      </header>
      <form className={styles.filters} action="/creators">
        <input className={styles.input} name="q" defaultValue={q} placeholder="채널 이름 검색" aria-label="검색어" maxLength={ADMIN_QUERY_MAX} />
        <button type="submit" className={styles.button}>
          검색
        </button>
      </form>
      <section className={styles.card}>
        {rows.length === 0 ? (
          <p className={styles.empty}>조건에 맞는 크리에이터가 없어요.</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">채널</th>
                <th scope="col">방송</th>
                <th scope="col">구독자</th>
                <th scope="col">가입일</th>
                <th scope="col">상태</th>
                <th scope="col">관리</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.creatorId}>
                  <td>{c.name}</td>
                  <td>{c.isLive ? "방송 중" : "—"}</td>
                  <td>{formatCompactKo(c.subscriberCount)}</td>
                  <td>{day(c.joinedAt)}</td>
                  <td>
                    <StatusChip status={c.status} />
                  </td>
                  <td>
                    <Link href={`/members/${c.memberId}`} className={styles.link}>
                      회원 상세 ›
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
