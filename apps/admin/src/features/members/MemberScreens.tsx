import Link from "next/link";
import { formatCompactKo, formatNumber } from "@/lib/format";
import { ADMIN_QUERY_MAX, AUDIT_ACTION_LABEL, type AuditEntry, type AdminCreatorRow, type AdminMember, type MemberPage } from "@/types/adminApi";
import { SITE_URL } from "@/lib/siteUrl";
import styles from "../admin.module.css";
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

/** 회원 상세 — code-first. Route `/members/[id]`. */
export function MemberDetailScreen({ member, audit }: { member: AdminMember; audit: AuditEntry[] }) {
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
            <p className={styles.muted}>
              {member.suspension.until ? `${day(member.suspension.until)}까지` : "무기한"} 정지 · 사유: {member.suspension.reason} · 처리: {member.suspension.by}
            </p>
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
      {member.withdrawal && <RetentionCard withdrawal={member.withdrawal} />}
    </div>
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
