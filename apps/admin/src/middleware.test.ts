import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "./middleware";

/** ADMIN_HOST: the console answers only on its own subdomain. */
const req = (host: string) => new NextRequest("http://placeholder/members", { headers: { host } });

describe("admin host check", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("serves every host when ADMIN_HOST is not set (local development)", () => {
    vi.stubEnv("ADMIN_HOST", "");
    expect(middleware(req("localhost:3200")).status).toBe(200);
  });

  it("serves only the configured admin host(s)", () => {
    vi.stubEnv("ADMIN_HOST", "admin.example.com, admin.localhost:3200");
    expect(middleware(req("admin.example.com")).status).toBe(200);
    expect(middleware(req("ADMIN.EXAMPLE.COM")).status).toBe(200);
    expect(middleware(req("admin.localhost:3200")).status).toBe(200);
    expect(middleware(req("example.com")).status).toBe(404);
    expect(middleware(req("203.0.113.7")).status).toBe(404);
  });
});
