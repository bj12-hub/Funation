import type { ReactElement, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { elementsOf, mount, textOf } from "@/test/hookHarness";

vi.mock("react", async (importOriginal) => ({ ...(await importOriginal<object>()), ...(await import("@/test/hookHarness")).harnessHooks }));
const route = vi.hoisted(() => ({ pathname: "/creator", tab: null as string | null }));
vi.mock("next/navigation", () => ({ usePathname: () => route.pathname, useSearchParams: () => ({ get: (k: string) => (k === "tab" ? route.tab : null) }) }));

type El = ReactElement<Record<string, unknown>>;
type Listener = (e: unknown) => void;

/**
 * The document the open menu listens on. The harness does not run effect cleanups, so each type keeps the latest
 * listener (the open menu's), and the tests fire events only while the menu is open, as the real cleanup would.
 */
function fakeDocument() {
  const listeners: Record<string, Listener> = {};
  return {
    addEventListener: (type: string, fn: Listener) => void (listeners[type] = fn),
    removeEventListener: (type: string, fn: Listener) => void (listeners[type] === fn && delete listeners[type]),
    fire: (type: string, event: unknown) => listeners[type]?.(event)
  };
}

/**
 * Studio side menu on phones (≤ 767px, 기본값 — 일반적인 기준): a bar naming the current page opens the grouped menu.
 * Wide screens hide the bar with CSS (studio.module.css), so these are the phone states; the markup is the same.
 */
describe("스튜디오 메뉴 · 휴대폰 메뉴 바", () => {
  let doc: ReturnType<typeof fakeDocument>;
  // Stand-ins for the bar, the dropdown and what lies outside them (the page under the dim, the header).
  const bar = { focus: vi.fn(), contains: (n: unknown) => n === bar };
  const linkNode = {};
  const panel = { contains: (n: unknown) => n === panel || n === linkNode };
  const outside = {};

  beforeEach(() => {
    route.pathname = "/creator";
    route.tab = null;
    bar.focus.mockClear();
    doc = fakeDocument();
    vi.stubGlobal("document", doc);
  });
  afterEach(() => vi.unstubAllGlobals());

  async function setup() {
    const { CreatorSideNav, STUDIO_MENU_ID } = await import("./CreatorSideNav");
    const view = mount(CreatorSideNav, {});
    const parts = (tree: ReactNode) => {
      const els = elementsOf(tree) as El[];
      return {
        nav: els.find((e) => e.type === "nav")!,
        button: els.find((e) => e.type === "button")!,
        panel: els.find((e) => e.props.id === STUDIO_MENU_ID)!,
        link: (href: string) => els.find((e) => e.props.href === href)!
      };
    };
    const first = parts(view.render());
    (first.button.props.ref as { current: unknown }).current = bar;
    (first.panel.props.ref as { current: unknown }).current = panel;
    const render = () => parts(view.render());
    const click = () => (render().button.props.onClick as () => void)();
    const isOpen = () => {
      const p = render();
      expect(p.nav.props["data-open"]).toBe(p.button.props["aria-expanded"] ? true : undefined);
      return p.button.props["aria-expanded"];
    };
    return { STUDIO_MENU_ID, render, click, isOpen };
  }

  it("starts closed, names the current page and controls the menu", async () => {
    const m = await setup();
    const p = m.render();
    expect(p.button.props).toMatchObject({ type: "button", "aria-expanded": false, "aria-controls": m.STUDIO_MENU_ID });
    expect(textOf(p.button)).toBe("📊대시보드 (현재 페이지)메뉴▾");
    // The grouped menu is all there (CSS hides it on phones until the bar opens it).
    expect(p.link("/creator/remote")).toBeDefined();
    expect(p.link("/creator/chat")).toBeDefined();

    route.pathname = "/creator/donations";
    route.tab = "list";
    expect(textOf(m.render().button)).toContain("받은 후원");
  }, 30_000);

  it("opens and closes with the bar", async () => {
    const m = await setup();
    m.click();
    expect(m.isOpen()).toBe(true);
    m.click();
    expect(m.isOpen()).toBe(false);
  }, 30_000);

  it("closes on Escape and puts focus back on the bar; other keys keep it open", async () => {
    const m = await setup();
    m.click();
    expect(m.isOpen()).toBe(true);
    doc.fire("keydown", { key: "Enter" });
    expect(m.isOpen()).toBe(true);
    doc.fire("keydown", { key: "Escape" });
    expect(m.isOpen()).toBe(false);
    expect(bar.focus).toHaveBeenCalledTimes(1);
  }, 30_000);

  it("closes on a tap outside without moving focus; taps on the bar or the menu keep it", async () => {
    const m = await setup();
    m.click();
    expect(m.isOpen()).toBe(true);
    doc.fire("pointerdown", { target: linkNode });
    doc.fire("pointerdown", { target: bar });
    expect(m.isOpen()).toBe(true);
    doc.fire("pointerdown", { target: outside });
    expect(m.isOpen()).toBe(false);
    expect(bar.focus).not.toHaveBeenCalled();
  }, 30_000);

  it("closes on navigation, also between 후원관리+ tabs", async () => {
    const m = await setup();
    m.click();
    expect(m.isOpen()).toBe(true);
    route.pathname = "/creator/remote";
    m.render(); // the effect closes it after the render that saw the new path
    expect(m.isOpen()).toBe(false);
    expect(textOf(m.render().button)).toContain("리모컨");

    route.pathname = "/creator/donations";
    route.tab = "settings";
    m.render();
    m.click();
    expect(m.isOpen()).toBe(true);
    route.tab = "ranking";
    m.render();
    expect(m.isOpen()).toBe(false);
  }, 30_000);

  it("choosing an item closes the menu and returns focus to the bar, even for the page already shown", async () => {
    const m = await setup();
    // Closed (wide screens): a link click leaves focus where it is.
    (m.render().link("/creator/chat").props.onClick as () => void)();
    expect(bar.focus).not.toHaveBeenCalled();

    m.click();
    expect(m.isOpen()).toBe(true);
    (m.render().link("/creator").props.onClick as () => void)();
    expect(m.isOpen()).toBe(false);
    expect(bar.focus).toHaveBeenCalledTimes(1);
  }, 30_000);

  it("closes when focus leaves the open menu, not when it moves inside it", async () => {
    const m = await setup();
    const navNode = { contains: (n: unknown) => n === bar || n === linkNode };
    const blur = (relatedTarget: unknown) => (m.render().nav.props.onBlur as (e: unknown) => void)({ relatedTarget, currentTarget: navNode });
    m.click();
    blur(linkNode);
    blur(null);
    expect(m.isOpen()).toBe(true);
    blur(outside);
    expect(m.isOpen()).toBe(false);
  }, 30_000);
});
