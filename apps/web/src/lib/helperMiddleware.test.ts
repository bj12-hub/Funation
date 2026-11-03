import { readFileSync, readdirSync } from "node:fs";
import { builtinModules } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { NextRequest } from "next/server";
import ts from "typescript";
import { afterEach, describe, expect, it, vi } from "vitest";
import { middleware } from "@/middleware";

/**
 * The middleware that serves the Ssumnation 도우미 on its own host (docs/development/helper-domain.md), run on real
 * requests: which surface a request gets, what a client can and cannot set, and where it is sent.
 */

const request = (url: string, headers: Record<string, string> = {}) => new NextRequest(url, { headers });
/** The request headers the middleware hands on to the page (Next's `x-middleware-request-*` response headers). */
const forwarded = (res: Response, name: string) => res.headers.get(`x-middleware-request-${name}`);
const overridden = (res: Response) => (res.headers.get("x-middleware-override-headers") ?? "").split(",");

afterEach(() => vi.unstubAllEnvs());

describe("middleware · surface header", () => {
  it("overwrites a client-sent surface and drops a client-sent helper path on the site", async () => {
    vi.stubEnv("HELPER_HOST", "");
    const res = await middleware(request("http://localhost:3000/login", { host: "localhost:3000", "x-ssumnation-surface": "helper", "x-ssumnation-helper-path": "//evil.com" }));
    expect(forwarded(res, "x-ssumnation-surface")).toBe("site");
    expect(forwarded(res, "x-ssumnation-helper-path")).toBeNull();
    // Dropped from the request the page sees, not merely left unset.
    expect(overridden(res)).not.toContain("x-ssumnation-helper-path");
  });

  it("marks helper requests and sets the helper path itself", async () => {
    vi.stubEnv("HELPER_HOST", "");
    const res = await middleware(request("http://localhost:3000/chat?tab=x", { host: "helper.localhost:3000", "x-ssumnation-surface": "site", "x-ssumnation-helper-path": "/evil" }));
    expect(res.headers.get("x-middleware-rewrite")).toBe("http://localhost:3000/helper/chat?tab=x");
    expect(forwarded(res, "x-ssumnation-surface")).toBe("helper");
    expect(forwarded(res, "x-ssumnation-helper-path")).toBe("/chat?tab=x");
  });
});

describe("middleware · the helper host keeps the site out", () => {
  it("answers the site's API with 404, also with a dot in the last segment", async () => {
    vi.stubEnv("HELPER_HOST", "helper.example.com");
    for (const path of ["/api/admin/members", "/api/admin/members/u.1", "/api/wallet/charges", "/api/admin/settlements/s.json"]) {
      const res = await middleware(request(`http://localhost:3000${path}`, { host: "helper.example.com" }));
      expect(res.status, path).toBe(404);
    }
  });

  it("keeps its 404 out of shared caches (a forged X-Forwarded-Host on the site gets it too)", async () => {
    vi.stubEnv("HELPER_HOST", "helper.example.com");
    const res = await middleware(request("http://localhost:3000/api/wallet/charges", { host: "example.com", "x-forwarded-host": "helper.example.com" }));
    expect(res.status).toBe(404);
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("is not talked out of the helper by an appended X-Forwarded-Host or a trailing dot", async () => {
    vi.stubEnv("HELPER_HOST", "helper.example.com");
    // Proxy that rewrites Host and appends to X-Forwarded-Host: the client's own value comes first.
    const appended = await middleware(request("http://localhost:3000/wallet", { host: "10.0.0.5:3000", "x-forwarded-host": "example.com, helper.example.com" }));
    expect(appended.headers.get("x-middleware-rewrite")).toBe("http://localhost:3000/helper/wallet");
    expect(forwarded(appended, "x-ssumnation-surface")).toBe("helper");
    // https://helper.example.com./api/admin/members
    const dotted = await middleware(request("http://localhost:3000/api/admin/members", { host: "helper.example.com." }));
    expect(dotted.status).toBe(404);
  });

  it("serves the webhook, overlays and the remote window as on the site", async () => {
    vi.stubEnv("HELPER_HOST", "helper.example.com");
    for (const path of ["/api/bank-sms/0b6f2d0e-1111-4c4c-9c9c-123456789abc", "/overlay/alert/k", "/popout/remote", "/images/social/kakao.png"]) {
      const res = await middleware(request(`http://localhost:3000${path}`, { host: "helper.example.com" }));
      expect(res.headers.get("x-middleware-next"), path).toBe("1");
      expect(forwarded(res, "x-ssumnation-surface")).toBe("helper");
    }
  });
});

describe("middleware · redirects", () => {
  it("sends studio links to the helper page on the same host", async () => {
    vi.stubEnv("HELPER_HOST", "");
    const res = await middleware(request("http://localhost:3000/creator/widgets?open=GOAL", { host: "helper.localhost:3000" }));
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get("location") ?? "").pathname).toBe("/goal");
  });

  it("answers an encoded /helper on the site with the site's 404, with or without HELPER_HOST", async () => {
    for (const helperHost of ["", "helper.example.com"]) {
      vi.stubEnv("HELPER_HOST", helperHost);
      for (const path of ["/%68elper/link", "/helper%2Flink"]) {
        const res = await middleware(request(`https://example.com${path}`, { host: "example.com" }));
        expect(res.headers.get("x-middleware-rewrite"), path).toBe("https://example.com/__helper-not-served");
        expect(res.headers.get("location"), path).toBeNull();
      }
    }
  });

  it("sends /helper/x on the site to the helper domain, never to another host", async () => {
    vi.stubEnv("HELPER_HOST", "helper.example.com");
    const res = await middleware(request("https://example.com/helper//evil.com", { host: "example.com" }));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("https://helper.example.com/evil.com");
  });
});

/**
 * The middleware runs on the Edge runtime, where Node built-ins do not exist: nothing it imports at run time (type-only
 * imports aside) may reach `node:*` or a server module ("use server" files read the session and the mock stores).
 */
describe("middleware · Edge bundle", () => {
  const SRC = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const resolveModule = (from: string, spec: string): string | null => {
    const base = spec.startsWith("@/") ? join(SRC, spec.slice(2)) : spec.startsWith(".") ? resolve(dirname(from), spec) : null;
    if (!base) return null;
    for (const candidate of [`${base}.ts`, `${base}.tsx`, join(base, "index.ts")]) {
      try {
        readFileSync(candidate);
        return candidate;
      } catch {
        // Next candidate.
      }
    }
    return null;
  };
  const runtimeImports = (file: string) => {
    const sf = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
    const specs: string[] = [];
    for (const s of sf.statements) {
      if (ts.isImportDeclaration(s) && !s.importClause?.isTypeOnly && ts.isStringLiteral(s.moduleSpecifier)) specs.push(s.moduleSpecifier.text);
      if (ts.isExportDeclaration(s) && !s.isTypeOnly && s.moduleSpecifier && ts.isStringLiteral(s.moduleSpecifier)) specs.push(s.moduleSpecifier.text);
    }
    return specs;
  };

  const isServerModule = (file: string) => /^\s*["']use server["']/.test(readFileSync(file, "utf8"));
  /** Every module `entries` load at run time; a "use server" module is not followed (the caller gets a reference). */
  const walk = (entries: string[], onServerModule: (file: string) => void) => {
    const builtins = new Set(builtinModules);
    const seen = new Set<string>();
    const nodeImports: string[] = [];
    const queue = [...entries];
    while (queue.length > 0) {
      const file = queue.pop()!;
      if (seen.has(file)) continue;
      seen.add(file);
      if (isServerModule(file)) {
        onServerModule(file);
        continue;
      }
      for (const spec of runtimeImports(file)) {
        if (spec.startsWith("node:") || builtins.has(spec)) nodeImports.push(`${file}: ${spec}`);
        const next = resolveModule(file, spec);
        if (next) queue.push(next);
      }
    }
    return { seen, nodeImports };
  };

  it("imports no Node built-in and no server module", () => {
    const serverModules: string[] = [];
    const { seen, nodeImports } = walk([join(SRC, "middleware.ts")], (f) => serverModules.push(f));
    expect(nodeImports).toEqual([]);
    expect(serverModules).toEqual([]);
    // The walk did follow the routing into the widget page list.
    expect([...seen].some((f) => f.endsWith("widgetPages.ts"))).toBe(true);
  });

  it("keeps Node built-ins out of the 도우미's client components (the browser loads what they import)", () => {
    const dir = join(SRC, "features", "helper");
    const clients = readdirSync(dir)
      .filter((f) => /\.tsx?$/.test(f) && !f.endsWith(".test.ts"))
      .map((f) => join(dir, f))
      .filter((f) => /^\s*["']use client["']/.test(readFileSync(f, "utf8")));
    expect(clients.length).toBeGreaterThan(0);
    const { seen, nodeImports } = walk(clients, () => {});
    expect(nodeImports).toEqual([]);
    // It followed the shared studio screens (the widget form) into their imports.
    expect([...seen].some((f) => f.endsWith("WidgetEditor.tsx"))).toBe(true);
  });
});
