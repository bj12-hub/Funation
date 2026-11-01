import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** Phase 9: writing a 1:1 문의 on FLEXTV, against a stubbed FLEXTV API. */

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined, set: () => undefined, delete: () => undefined }),
  headers: async () => new Headers({ "x-forwarded-for": "203.0.113.7", "user-agent": "Mozilla/5.0" })
}));
vi.mock("@/lib/flextv/mode", () => ({ FLEXTV_BACKEND: true, FLEXTV_AUTH: true, FLEXTV_SITE: true, FLEXTV_WEB_URL: "https://www.flextv.test" }));
const member = { signedIn: true };
vi.mock("@/lib/session", () => ({
  getSession: async () => (member.signedIn ? { userId: "601924", nickname: "시청자", ssumnationId: "viewer01", avatarUrl: null, roles: ["SUPPORTER"] } : null),
  getFlextvAccessToken: async () => (member.signedIn ? "member-token" : null)
}));

let posts: FormData[];
let answer: () => Response;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
// The smallest PNG: its signature and IHDR are what the content check reads.
const PNG = Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64"));

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("FLEXTV_API_URL", "https://api.flextv.test");
  delete (globalThis as Record<string, unknown>).__ssumnationFlextvInquiryRequests;
  member.signedIn = true;
  posts = [];
  answer = () => json({ result: true, data: { id: 300 + posts.length } });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit = {}) => {
      const u = new URL(url);
      if (u.pathname === "/api/guest/refcode/questionsCategory") return json([{ key: 1, value: "1", text: "계정" }, { key: 2, value: "5", text: "결제/환불" }]);
      if (u.pathname === "/api/cs/inquiry-post" && init.method === "POST") {
        posts.push(init.body as FormData);
        return answer();
      }
      throw new Error(`unexpected FLEXTV call ${init.method ?? "GET"} ${u.pathname}`);
    })
  );
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const form = (over: Record<string, string | File> = {}) => {
  const f = new FormData();
  const fields: Record<string, string | File> = { requestId: "request-0000000000000001", category: "5", title: " 충전이 안 돼요 ", content: "결제창이 닫혀요", ...over };
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
};
const submit = async (f: FormData) => (await import("./inquiry")).submitFlextvInquiry(f);

describe("writing a 1:1 문의", () => {
  it("sends FLEXTV's 유형, 제목, 내용 and picture, once per request id", async () => {
    const f = form({ image: new File([PNG], "screen.png", { type: "image/png" }) });
    const [first, second] = await Promise.all([submit(f), submit(f)]);
    expect(first).toEqual({ status: "SUBMITTED", id: "301" });
    expect(second).toEqual(first);
    expect(posts).toHaveLength(1);
    expect([posts[0].get("category"), posts[0].get("title"), posts[0].get("content")]).toEqual(["5", "충전이 안 돼요", "결제창이 닫혀요"]);
    expect(posts[0].get("image")).toBeInstanceOf(Blob);
  });

  it("checks FLEXTV's form rules before sending", async () => {
    expect(await submit(form({ category: "31" }))).toEqual({ status: "INVALID", message: "문의 유형을 골라 주세요." });
    expect(await submit(form({ requestId: "request-0000000000000002", title: "가".repeat(51) }))).toMatchObject({ status: "INVALID" });
    expect(await submit(form({ requestId: "request-0000000000000003", content: " " }))).toMatchObject({ status: "INVALID" });
    // A renamed file is not a picture.
    expect(await submit(form({ requestId: "request-0000000000000004", image: new File(["<script>"], "x.png", { type: "image/png" }) }))).toMatchObject({ status: "INVALID" });
    expect(await submit(form({ requestId: "short" }))).toMatchObject({ status: "INVALID" });
    expect(posts).toHaveLength(0);
  });

  it("shows FLEXTV's reason, and lets a refused 문의 be sent again", async () => {
    answer = () => json({ result: false, error: 400, data: "정지된 회원입니다." });
    expect(await submit(form())).toEqual({ status: "INVALID", message: "정지된 회원입니다." });
    answer = () => json({ result: true, data: { id: 400 } });
    expect(await submit(form())).toEqual({ status: "SUBMITTED", id: "400" });
  });

  it("asks a signed-out visitor to sign in", async () => {
    member.signedIn = false;
    expect(await submit(form())).toEqual({ status: "UNAUTHORIZED" });
  });
});
