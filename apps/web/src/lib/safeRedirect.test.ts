import { describe, expect, it } from "vitest";
import { safeRedirectPath } from "./safeRedirect";

describe("safeRedirectPath (?next=)", () => {
  it("keeps same-site paths with their query and hash", () => {
    expect(safeRedirectPath("/mypage")).toBe("/mypage");
    expect(safeRedirectPath("/creator/settlement/register?type=PERSONAL#form")).toBe("/creator/settlement/register?type=PERSONAL#form");
    expect(safeRedirectPath("/login?role=creator&next=/creator/chat")).toBe("/login?role=creator&next=/creator/chat");
  });

  it("falls back for anything that would leave the site", () => {
    for (const bad of [
      "https://evil.com",
      "//evil.com",
      "/\\evil.com",
      "\\\\evil.com",
      // Browsers drop tabs and newlines, so these become "//evil.com".
      "/\t/evil.com",
      "/\n/evil.com",
      "/\r\n/evil.com",
      "/\\\t\\evil.com",
      // Dot segments collapse into "//evil.com".
      "/.//evil.com",
      "/..//evil.com",
      "/a/..//evil.com",
      "javascript:alert(1)",
      "mypage",
      "",
      undefined,
      ["/mypage", "/wallet"]
    ]) {
      expect(safeRedirectPath(bad)).toBe("/");
    }
    expect(safeRedirectPath("//evil.com", "/wallet")).toBe("/wallet");
  });

  it("never returns a path a browser would read as another host", () => {
    for (const input of ["/%09/evil.com", "/ /evil.com", "/.//evil.com", "/..//evil.com"]) {
      const out = safeRedirectPath(input);
      expect(new URL(out, "https://somnation.example/").host).toBe("somnation.example");
    }
  });
});
