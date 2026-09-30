import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SiteApiError, siteGet, siteSend } from "./siteApi";

/** Server-side client for the site's admin API: secret + operator headers, clear errors, 404 → null. */
const OP = { id: "adm-operator", name: "운영자" };

describe("site admin api client", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("SITE_API_URL", "http://site.test/");
    vi.stubEnv("ADMIN_API_TOKEN", "secret-token");
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    fetchMock.mockReset();
  });

  it("sends the secret and the operator, and parses JSON", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ total: 3 }), { status: 200 }));
    expect(await siteGet(OP, "/members?q=a")).toEqual({ total: 3 });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://site.test/api/admin/members?q=a");
    expect(init.headers).toMatchObject({ authorization: "Bearer secret-token", "x-admin-operator-id": "adm-operator", "x-admin-operator-name": encodeURIComponent("운영자") });
    expect(init.cache).toBe("no-store");
  });

  it("maps 404, 401 and network failures", async () => {
    fetchMock.mockResolvedValueOnce(new Response("{}", { status: 404 }));
    expect(await siteGet(OP, "/members/x")).toBeNull();
    fetchMock.mockResolvedValueOnce(new Response("{}", { status: 404 }));
    expect(await siteSend(OP, "DELETE", "/content/notices/x")).toEqual({ status: "NOT_FOUND" });
    fetchMock.mockResolvedValueOnce(new Response("{}", { status: 401 }));
    await expect(siteGet(OP, "/dashboard")).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"));
    await expect(siteGet(OP, "/dashboard")).rejects.toBeInstanceOf(SiteApiError);
  });

  it("posts JSON bodies for writes", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ status: "OK" }), { status: 200 }));
    expect(await siteSend(OP, "POST", "/refunds/ch1", { decision: "REJECT", note: "메모" })).toEqual({ status: "OK" });
    const [, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ decision: "REJECT", note: "메모" });
    expect(init.headers["content-type"]).toBe("application/json");
  });
});
