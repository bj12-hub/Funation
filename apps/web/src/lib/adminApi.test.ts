import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { key, mockSessionModule, resetMockStores } from "@/test/mockEnv";

vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
vi.mock("@/lib/session", () => mockSessionModule());

/** Admin API (`/api/admin/*`): shared-secret + operator headers; no cookie can reach it. */
const TOKEN = "test-admin-api-token-00000000000000";
const headers = (extra: Record<string, string> = {}) => ({
  authorization: `Bearer ${TOKEN}`,
  "x-admin-operator-id": "adm-1",
  "x-admin-operator-name": encodeURIComponent("테스트 운영자"),
  "content-type": "application/json",
  ...extra
});
const ctx = <P,>(params: P) => ({ params: Promise.resolve(params) });

describe("admin api", () => {
  beforeEach(() => {
    resetMockStores();
    vi.stubEnv("ADMIN_API_TOKEN", TOKEN);
  });
  afterEach(() => vi.unstubAllEnvs());

  it("authorises only the shared secret with a valid operator", async () => {
    const { authorizeAdminRequest } = await import("./adminApi");
    const req = (h: Record<string, string>) => new Request("http://x/api/admin/dashboard", { headers: h });
    expect(authorizeAdminRequest(req(headers()))).toEqual({ ok: true, admin: { userId: "adm-1", nickname: "테스트 운영자" } });
    expect(authorizeAdminRequest(req(headers({ authorization: "Bearer wrong" })))).toEqual({ ok: false, status: 401 });
    expect(authorizeAdminRequest(req({ ...headers(), authorization: "" }))).toEqual({ ok: false, status: 401 });
    expect(authorizeAdminRequest(req(headers({ "x-admin-operator-id": "bad id!" })))).toEqual({ ok: false, status: 401 });
    expect(authorizeAdminRequest(req(headers({ "x-admin-operator-name": "" })))).toEqual({ ok: false, status: 401 });
    // A member's session cookie is irrelevant: without the secret the API refuses.
    expect(authorizeAdminRequest(req({ cookie: "ssumnation_session=mock-session-hongGD123" }))).toEqual({ ok: false, status: 401 });
  });

  it("refuses to run in production without a configured token", async () => {
    vi.stubEnv("ADMIN_API_TOKEN", "");
    vi.stubEnv("NODE_ENV", "production");
    const { authorizeAdminRequest } = await import("./adminApi");
    expect(authorizeAdminRequest(new Request("http://x", { headers: headers() }))).toEqual({ ok: false, status: 503 });
  });

  it("treats the .env.example placeholder or a short token as not configured", async () => {
    const { authorizeAdminRequest } = await import("./adminApi");
    for (const weak of ["replace-with-a-long-random-secret", "short-secret"]) {
      vi.stubEnv("ADMIN_API_TOKEN", weak);
      const req = new Request("http://x", { headers: headers({ authorization: `Bearer ${weak}` }) });
      expect(authorizeAdminRequest(req)).toEqual({ ok: false, status: 503 });
    }
  });

  it("serves routes as JSON, audits with the operator and returns 404 for unknown ids", async () => {
    const dashboard = await import("@/app/api/admin/dashboard/route");
    const res = await dashboard.GET(new Request("http://x/api/admin/dashboard", { headers: headers() }), ctx({}));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect((await res.json()).creators.total).toBeGreaterThan(0);
    expect((await dashboard.GET(new Request("http://x", { headers: { authorization: "Bearer nope" } }), ctx({}))).status).toBe(401);

    const suspend = await import("@/app/api/admin/members/[id]/suspend/route");
    const body = JSON.stringify({ days: 1, reason: "API 경유 테스트 정지", requestId: key(1) });
    const r = await suspend.POST(new Request("http://x", { method: "POST", headers: headers(), body }), ctx({ id: "u-s001" }));
    expect(await r.json()).toEqual({ status: "OK" });
    const { auditEntries } = await import("@/services/admin/auditCore");
    expect(auditEntries()[0]).toMatchObject({ action: "MEMBER_SUSPEND", actorId: "adm-1", actorName: "테스트 운영자", target: "member:u-s001" });

    const detail = await import("@/app/api/admin/members/[id]/route");
    expect((await detail.GET(new Request("http://x", { headers: headers() }), ctx({ id: "nope" }))).status).toBe(404);
  });

  it("records 지급 완료 through the pay route with the operator, and refuses it without the secret", async () => {
    const pay = await import("@/app/api/admin/settlements/[id]/pay/route");
    const body = JSON.stringify({ reference: "TRF-0001", requestId: key(7) });
    const post = (h: Record<string, string>) => pay.POST(new Request("http://x", { method: "POST", headers: h, body }), ctx({ id: "st-seed-1" }));
    expect((await post(headers({ authorization: "Bearer nope" }))).status).toBe(401);
    expect(await (await post(headers())).json()).toEqual({ status: "OK" });
    const { auditEntries } = await import("@/services/admin/auditCore");
    expect(auditEntries()[0]).toMatchObject({ action: "SETTLEMENT_PAY", actorId: "adm-1", target: "settlement:st-seed-1" });
  });

  it("puts a settlement and a refund request on 보류 and back through the hold routes (2026-10-08 결정)", async () => {
    const settlement = await import("@/app/api/admin/settlements/[id]/hold/route");
    const refund = await import("@/app/api/admin/refunds/[chargeId]/hold/route");
    const { mockRefunds } = await import("@/services/wallet/mockRefundStore");
    mockRefunds.requests.push({ chargeId: "ch-x", memberId: "u-test", accountSince: null, requestedAt: "2026-10-01T00:00:00.000Z", reason: "", status: "REQUESTED", quote: { type: "FULL_CANCEL", grossFn: 10_000, feeFn: 0, netFn: 10_000 } });
    const post = <P,>(route: { POST: (r: Request, c: { params: Promise<P> }) => Promise<Response> }, params: P, body: unknown, h = headers()) =>
      route.POST(new Request("http://x", { method: "POST", headers: h, body: JSON.stringify(body) }), ctx(params));

    const hold = { action: "HOLD", note: "확인 필요", requestId: key(1) };
    expect((await post(settlement, { id: "st-seed-1" }, hold, headers({ authorization: "Bearer nope" }))).status).toBe(401);
    expect(await (await post(settlement, { id: "st-seed-1" }, hold)).json()).toEqual({ status: "OK" });
    expect(await (await post(settlement, { id: "st-seed-1" }, { ...hold, action: "RELEASE", requestId: key(2) })).json()).toEqual({ status: "OK" });
    expect(await (await post(refund, { chargeId: "ch-x" }, { ...hold, requestId: key(3) })).json()).toEqual({ status: "OK" });
    expect(await (await post(refund, { chargeId: "nope" }, { ...hold, requestId: key(4) })).json()).toEqual({ status: "NOT_FOUND" });
    const { auditEntries } = await import("@/services/admin/auditCore");
    expect(auditEntries().map((e) => [e.action, e.actorId, e.target])).toEqual([
      ["REFUND_HOLD", "adm-1", "refund:ch-x"],
      ["SETTLEMENT_RELEASE", "adm-1", "settlement:st-seed-1"],
      ["SETTLEMENT_HOLD", "adm-1", "settlement:st-seed-1"]
    ]);
  });
});
