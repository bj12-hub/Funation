import { randomBytes } from "node:crypto";
import type { Anniversary, CreatorLanguage, MainPlatform, SnsLink } from "./creatorSettingsTypes";

/**
 * Development-only creator channel data for the mock member. Server-side only; kept on `globalThis`
 * like services/account/mockStore.ts. Values follow Figma 315:405 / 326:496.
 */

type MockCreator = {
  channelName: string;
  handle: string;
  images: (string | null)[];
  debutDate: string;
  debutPublic: boolean;
  birthday: string;
  birthdayPublic: boolean;
  anniversaries: Anniversary[];
  categories: string[];
  liveProfileVisible: boolean;
  languages: CreatorLanguage[];
  mainPlatform: MainPlatform;
  sns: SnsLink[];
  integrationKey: string;
};

const globalForCreator = globalThis as typeof globalThis & { __funationMockCreator?: MockCreator };

export function newIntegrationKey() {
  const hex = randomBytes(8).toString("hex");
  return `${hex.slice(0, 4)}-${hex.slice(4, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}`;
}

export const mockCreator = (globalForCreator.__funationMockCreator ??= {
  channelName: "홍길동의 방송",
  handle: "honggildong",
  images: [null, null, null],
  debutDate: "2020-03-15",
  debutPublic: true,
  birthday: "1990-01-01",
  birthdayPublic: true,
  anniversaries: [],
  categories: ["게임", "토크", "음식/먹방"],
  liveProfileVisible: true,
  languages: ["ko"],
  mainPlatform: "FLEXTV",
  sns: [
    { kind: "INSTAGRAM", url: "" },
    { kind: "TIKTOK", url: "" },
    { kind: "X", url: "" },
    { kind: "ETC", url: "" }
  ],
  integrationKey: newIntegrationKey()
});
