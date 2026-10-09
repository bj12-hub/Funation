import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Client components must not import ./services/creators/creators.ts: it imports server-only mock stores (member
 * status, account data), which would then ship in the browser bundle. Labels and types live in creatorTypes.ts.
 */
describe("client imports", () => {
  it("keeps the channel views off the server creator module", () => {
    const src = readFileSync(join(__dirname, "ChannelViews.tsx"), "utf8");
    expect(src.startsWith('"use client"')).toBe(true);
    expect(src).not.toMatch(/from "@\/services\/creators\/creators"/);
  });
});
