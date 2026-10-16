import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const surface = { value: "site" as "site" | "helper" };
vi.mock("@/lib/surface", () => ({ getSurface: async () => surface.value }));
vi.mock("@/lib/session", () => ({ getSession: async () => null }));
vi.mock("@/services/auth/login", () => ({ login: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
  useRouter: () => ({ refresh() {}, push() {}, replace() {} }),
  usePathname: () => "/login"
}));

/**
 * 고객센터 is a site page (`/support`), which the 도우미 domain does not serve (docs/development/helper-domain.md). The
 * sign-in page there names the site's 고객센터 in plain text instead of linking to a 404.
 */
async function loginPageProps() {
  const { default: LoginPage } = await import("@/app/(auth)/login/page");
  const el = (await LoginPage({ searchParams: Promise.resolve({}) })) as ReactElement<{ supportLink?: boolean }>;
  return el.props;
}

async function renderLocked(supportLink: boolean | undefined) {
  const { LoginLocked } = await import("./LoginLocked");
  return renderToStaticMarkup(createElement(LoginLocked, supportLink === undefined ? {} : { supportLink }));
}

describe("로그인 제한 안내 · 고객센터 on the 도우미 domain", () => {
  beforeEach(() => {
    surface.value = "site";
  });

  it("links 고객센터 on the site", async () => {
    expect((await loginPageProps()).supportLink).toBe(true);
    const html = await renderLocked(true);
    expect(html).toContain('<a href="/support">고객센터에 문의해 주세요</a>');
    expect(await renderLocked(undefined)).toBe(html);
  });

  it("names the site's 고객센터 in plain text on the 도우미, with no /support link", async () => {
    surface.value = "helper";
    const props = await loginPageProps();
    expect(props.supportLink).toBe(false);
    const html = await renderLocked(props.supportLink);
    expect(html).not.toContain("/support");
    expect(html).toContain("도움이 필요하신가요? 썸네이션 사이트의 고객센터에 문의해 주세요");
    // The rest of the screen is the same: 비밀번호 재설정 is served on the 도우미 too.
    expect(html).toContain('href="/password-reset"');
  });
});
