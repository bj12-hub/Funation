import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { AUDIT_ACTION_LABEL, type AdminDonationRow, type AdminEventRow, type DonationsView, type PendingDonationRow } from "@/types/adminApi";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh() {} }), usePathname: () => "/" }));
vi.mock("@/lib/actions", () => ({}));

/** 확인 중 후원 and 운영 › 이벤트 (2026-10-08 결정): what the console offers in each state. */
const render = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el);

const pd = (over: Partial<PendingDonationRow> = {}): PendingDonationRow => ({
  transactionId: "TXN-1",
  platform: "SOOP",
  platformLabel: "SOOP",
  creatorName: "김스트리머",
  productLabel: "별풍선 10개",
  fnAmount: 10_000,
  requestedAt: "2026-10-07T03:00:00.000Z",
  memberId: "u-hongGD123",
  memberName: "홍길동",
  memberWithdrawn: false,
  lastCheckAt: null,
  resolution: null,
  ...over
});

const ev = (over: Partial<AdminEventRow> = {}): AdminEventRow => ({
  id: "ev-attendance",
  title: "출석체크 챌린지",
  emoji: "📅",
  startsAt: "2026-08-29T15:00:00.000Z",
  endsAt: "2026-09-28T14:59:59.999Z",
  phase: "ended",
  participants: 2,
  sampleParticipants: 0,
  reward: null,
  result: null,
  ...over
});
const AT = { updatedAt: "2026-10-08T01:00:00.000Z", updatedBy: "운영자" };

describe("확인 중 후원", () => {
  it("lists a waiting donation with 다시 확인 and 성공 · 실패 that need a memo", async () => {
    const { PendingDonationsScreen } = await import("./payments/PendingDonationsScreen");
    const html = render(createElement(PendingDonationsScreen, { view: { waiting: [pd()], resolved: [], checking: 2 } }));
    expect(html).toContain("SOOP · 별풍선 10개 · 10,000 FN");
    expect(html).toContain("확인 필요</span>");
    expect(html).toContain("자동 확인 중 2건");
    expect(html).toContain("마지막 확인 없음");
    expect(html).toContain(">다시 확인</button>");
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>성공<\/button>/);
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>실패<\/button>/);
    expect(html).not.toContain("탈퇴한 회원의 후원이에요");
  });

  it("warns that 실패 returns nothing for a withdrawn member, and shows how each was settled", async () => {
    const { PendingDonationsScreen } = await import("./payments/PendingDonationsScreen");
    const settled = (outcome: "COMPLETED" | "FAILED", fnReturn: "RETURNED" | "FORFEITED" | null, by: "PLATFORM" | "OPERATOR" = "OPERATOR") => ({
      outcome,
      at: "2026-10-09T03:00:00.000Z",
      by,
      operator: by === "OPERATOR" ? "운영자" : null,
      note: by === "OPERATOR" ? "플랫폼 고객센터 확인" : null,
      fnReturn,
      externalTransactionId: by === "PLATFORM" ? "SP-LK-ABC123" : null
    });
    const html = render(
      createElement(PendingDonationsScreen, {
        view: {
          waiting: [pd({ transactionId: "TXN-W", memberWithdrawn: true, memberId: "u-hongGD123-w1" })],
          resolved: [
            pd({ transactionId: "TXN-A", resolution: settled("FAILED", "RETURNED") }),
            pd({ transactionId: "TXN-B", memberWithdrawn: true, resolution: settled("FAILED", "FORFEITED") }),
            pd({ transactionId: "TXN-C", resolution: settled("COMPLETED", null, "PLATFORM") })
          ],
          checking: 0
        }
      })
    );
    expect(html).toContain("탈퇴한 회원의 후원이에요. 실패로 정하면 FN을 돌려주지 않고 소멸돼요(탈퇴한 계정 규칙). 재가입한 새 계정에도 지급하지 않아요.");
    expect(html).toContain("처리 완료 3");
    expect(html).toContain("실패 · FN 반환</span>");
    expect(html).toContain("10,000 FN을 회원에게 돌려줬어요");
    expect(html).toContain("실패 · 반환 불가(탈퇴)</span>");
    expect(html).toContain("탈퇴한 회원이라 10,000 FN을 돌려주지 않았어요 (소멸)");
    expect(html).toContain("플랫폼 확인 (다시 확인) · 보관 FN 사용 처리 · SOOP 거래번호 SP-LK-ABC123");
    expect(html).toContain("처리 메모: 플랫폼 고객센터 확인");
    // Settled items offer nothing more: only the waiting one has the buttons.
    expect(html.match(/>다시 확인<\/button>/g)).toHaveLength(1);
  });

  it("shows the empty state", async () => {
    const { PendingDonationsScreen } = await import("./payments/PendingDonationsScreen");
    const html = render(createElement(PendingDonationsScreen, { view: { waiting: [], resolved: [], checking: 0 } }));
    expect(html).toContain("확인이 필요한 후원이 없어요.");
    expect(html).not.toContain("처리 완료");
  });

  it("says the re-check also runs when the member opens 회원 탈퇴", async () => {
    const { PendingDonationsScreen } = await import("./payments/PendingDonationsScreen");
    const html = render(createElement(PendingDonationsScreen, { view: { waiting: [], resolved: [], checking: 1 } }));
    expect(html).toContain("자동 확인 중 1건 · 요청 후 24시간 안에는 회원의 후원 내역 · 회원 탈퇴 화면과 이 화면을 열 때마다 플랫폼 결과를 다시 확인해요.");
  });
});

/** 2026-10-09 결정: a failed 플랫폼 후원 whose held FN went back is FN 반환 in 후원 운영, never 환불완료 (real refunds keep it). */
describe("후원 운영 · FN 반환", () => {
  const empty = { count: 0, fn: 0 };
  const row = (over: Partial<AdminDonationRow>): AdminDonationRow => ({
    id: "dn-1",
    donatedAt: "2026-10-08 12:00:00",
    creatorName: "게임왕",
    fnAmount: 10_000,
    typeLabel: "SOOP 별풍선 10개",
    status: "REFUNDED",
    fnReturned: false,
    memberId: "u-hongGD123",
    memberName: "홍길동",
    memberWithdrawn: false,
    ...over
  });
  const returned = row({ id: "TXN-1", fnReturned: true });
  const refunded = row({ id: "dn9", creatorName: "하루봄", fnAmount: 5_000, typeLabel: "시그니처 후원" });
  const view = (rows: AdminDonationRow[]): DonationsView => ({
    rows,
    byStatus: { COMPLETED: empty, PROCESSING: empty, FAILED: empty, REFUNDING: empty, REFUNDED: { count: 1, fn: 5_000 }, FN_RETURNED: { count: 1, fn: 10_000 } },
    byType: []
  });

  it("labels the returned FN FN 반환 in the list and in its own tile, and keeps 환불완료 for a real refund", async () => {
    const { DonationsAdminScreen } = await import("./payments/PaymentScreens");
    const html = render(createElement(DonationsAdminScreen, { view: view([returned, refunded]), status: null }));
    expect(html).toMatch(/<td>SOOP 별풍선 10개<\/td><td>10,000<\/td><td>FN 반환<\/td>/);
    expect(html).toMatch(/<td>시그니처 후원<\/td><td>5,000<\/td><td>환불완료<\/td>/);
    expect(html.match(/<td>환불완료<\/td>/g)).toHaveLength(1);
    expect(html).toMatch(/href="\/donations\?status=FN_RETURNED"[^>]*><span[^>]*>FN 반환<\/span><strong[^>]*>1건<\/strong><span[^>]*>10,000 FN<\/span>/);
    expect(html).toMatch(/href="\/donations\?status=REFUNDED"[^>]*><span[^>]*>환불완료<\/span><strong[^>]*>1건<\/strong><span[^>]*>5,000 FN<\/span>/);

    const filtered = render(createElement(DonationsAdminScreen, { view: view([returned]), status: "FN_RETURNED" }));
    expect(filtered).toContain("후원 내역 · FN 반환 (1)");
    expect(filtered).not.toContain("<td>환불완료</td>");
  });
});

describe("운영 › 이벤트", () => {
  it("offers the reward form with empty fields (no default amount) and nothing to pay before a reward is set", async () => {
    const { EventsAdminScreen } = await import("./events/EventsAdminScreen");
    const html = render(createElement(EventsAdminScreen, { view: { events: [ev({ sampleParticipants: 1_024 })] } }));
    expect(html).toContain("참여 기록 2명 (본인 기준)");
    expect(html).toContain("샘플 참여 수 1,024명은 목업 표시용이라 지급 · 추첨에 들어가지 않아요");
    expect(html).toContain("설정 전");
    expect(html).toContain(">참여자 전원 무상 FN</button>");
    expect(html).toContain(">추첨 N명 경품</button>");
    expect(html).toMatch(/<input[^>]*aria-label="1인 지급 FN"[^>]*value=""/);
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>보상 저장<\/button>/);
    expect(html).not.toContain("보상 지급</button>");
  });

  it("disables 보상 지급 / 당첨자 추첨 until the event ends", async () => {
    const { EventsAdminScreen } = await import("./events/EventsAdminScreen");
    const running = render(createElement(EventsAdminScreen, { view: { events: [ev({ phase: "ongoing", reward: { kind: "FREE_FN", amountFn: 500, ...AT } })] } }));
    expect(running).toContain("참여자 전원 무상 FN · 1인 500 FN");
    expect(running).toMatch(/<button[^>]*disabled=""[^>]*>보상 지급<\/button>/);
    expect(running).toContain("이벤트가 끝난 뒤에 보상을 지급할 수 있어요.");
    const ended = render(createElement(EventsAdminScreen, { view: { events: [ev({ reward: { kind: "DRAW", winners: 3, prize: "굿즈 세트", ...AT } })] } }));
    expect(ended).toContain("추첨 3명 경품 · 굿즈 세트");
    expect(ended).toMatch(/<button(?![^>]*disabled)[^>]*>당첨자 추첨<\/button>/);
    expect(ended).toMatch(/<input[^>]*aria-label="경품 내용"[^>]*value="굿즈 세트"/);
  });

  it("shows the payout with 지급 불가 people, and the draw with masked names, without the form", async () => {
    const { EventsAdminScreen } = await import("./events/EventsAdminScreen");
    const paid = render(
      createElement(EventsAdminScreen, {
        view: {
          events: [
            ev({
              reward: { kind: "FREE_FN", amountFn: 700, ...AT },
              result: {
                kind: "FREE_FN",
                at: "2026-10-09T03:00:00.000Z",
                by: "운영자",
                amountFn: 700,
                totalFn: 700,
                paid: [{ memberId: "u-hongGD123", name: "다시왔어요", withdrawn: false }],
                unpaid: [
                  { memberId: "u-hongGD123-w1", name: "홍길동", withdrawn: true },
                  { memberId: null, name: "확인할 수 없는 참여자", withdrawn: true }
                ]
              }
            })
          ]
        }
      })
    );
    expect(paid).toContain("보상 지급 완료");
    expect(paid).toContain("지급 1명 · 1인 700 FN · 합계 700 FN");
    expect(paid).toContain("지급 불가 2명");
    expect(paid).toContain("지금 계정이 없는 참여자(탈퇴 후 새 계정 없음)라 지급하지 않았어요.");
    expect(paid.match(/chipNeutral[^"]*">탈퇴<\/span>/g)).toHaveLength(1); // no badge for someone who cannot be found
    expect(paid).not.toContain("보상 저장");
    expect(paid).not.toContain("보상 지급</button>");

    const drawn = render(
      createElement(EventsAdminScreen, {
        view: {
          events: [
            ev({
              reward: { kind: "DRAW", winners: 3, prize: "굿즈 세트", ...AT },
              result: { kind: "DRAW", at: "2026-10-09T03:00:00.000Z", by: "운영자", winnersWanted: 3, prize: "굿즈 세트", pool: 1, winners: [{ memberId: "u-hongGD123", name: "홍길동", withdrawn: false, masked: "홍*동" }], unpaid: [] }
            })
          ]
        }
      })
    );
    expect(drawn).toContain("당첨자 추첨 완료");
    expect(drawn).toContain("추첨 대상 1명 중 1명 당첨 (추첨 인원 3명) · 경품: 굿즈 세트");
    expect(drawn).toContain("사이트 표시 홍*동");
    expect(drawn).not.toContain("당첨자 추첨</button>");
  });

  it("adds both screens to the sidebar and labels their audit entries", async () => {
    const { ADMIN_GROUPS, adminBreadcrumb } = await import("./AdminChrome");
    expect(ADMIN_GROUPS.find((g) => g.title === "거래")!.items.map((i) => i.label)).toContain("확인 중 후원");
    expect(ADMIN_GROUPS.find((g) => g.title === "운영")!.items.map((i) => i.label)).toContain("이벤트");
    expect(adminBreadcrumb("/donations/pending")).toBe("거래 / 확인 중 후원");
    expect(adminBreadcrumb("/donations")).toBe("거래 / 후원 운영");
    expect(adminBreadcrumb("/events")).toBe("운영 / 이벤트");
    expect([AUDIT_ACTION_LABEL.PLATFORM_DONATION_CHECK, AUDIT_ACTION_LABEL.PLATFORM_DONATION_RESOLVE, AUDIT_ACTION_LABEL.EVENT_REWARD_SET, AUDIT_ACTION_LABEL.EVENT_REWARD_PAY, AUDIT_ACTION_LABEL.EVENT_DRAW]).toEqual([
      "확인 중 후원 다시 확인",
      "확인 중 후원 결과 결정",
      "이벤트 보상 설정",
      "이벤트 보상 지급",
      "이벤트 당첨자 추첨"
    ]);
  });

  it("counts 확인 중 후원 in the dashboard's 처리 대기", async () => {
    const { AdminDashboardScreen } = await import("./AdminScreens");
    const html = render(
      createElement(AdminDashboardScreen, {
        data: {
          creators: { total: 1, live: 0 },
          charges: { monthCount: 0, monthFn: 0, monthPaidKrw: 0, processing: 0 },
          donations: { monthCount: 0, monthFn: 0 },
          pending: { refunds: 0, refundsBlocked: 0, refundsHeld: 0, settlements: 0, settlementsHeld: 0, reports: 0, platformDonations: 2 },
          recentAudit: []
        }
      })
    );
    expect(html).toMatch(/<span>확인 중 후원<\/span><strong[^>]*>2건<\/strong>/);
  });
});
