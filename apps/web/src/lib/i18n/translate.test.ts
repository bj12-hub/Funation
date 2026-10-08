import { describe, expect, it } from "vitest";
import { LANGUAGE_OPTIONS, LOCALES, isLocale } from "./config";
import { en } from "./messages/en";
import { ko } from "./messages/ko";
import { messagesFor, translate } from "./translate";

describe("i18n", () => {
  it("translates keys per locale and fills placeholders", () => {
    expect(translate(messagesFor("ko"), "nav.creators")).toBe("인기 크리에이터");
    expect(translate(messagesFor("en"), "nav.creators")).toBe("Top creators");
    expect(translate(messagesFor("en"), "profile.fun", { name: "홍길동" })).toBe("홍길동's Ssum!");
    expect(translate(messagesFor("ko"), "profile.fun", { name: "홍길동" })).toBe("홍길동의 Ssum!");
  });

  it("keeps every locale complete (no empty or missing strings)", () => {
    for (const [area, table] of Object.entries(ko)) {
      for (const key of Object.keys(table)) {
        const value = (en as Record<string, Record<string, string>>)[area][key];
        expect(value, `${area}.${key}`).toBeTruthy();
      }
    }
  });

  it("only accepts supported locales, and the menu marks the rest as not ready", () => {
    expect(isLocale("en")).toBe(true);
    expect(isLocale("zh")).toBe(false);
    expect(LANGUAGE_OPTIONS.filter((l) => l.ready).map((l) => l.code)).toEqual([...LOCALES]);
  });
});
