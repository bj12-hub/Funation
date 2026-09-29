import { beforeEach, describe, expect, it, vi } from "vitest";
import { key, mockSessionModule, resetMockStores, signIn } from "@/test/mockEnv";

vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
vi.mock("@/lib/session", () => mockSessionModule());

/** 후원 연동: platform donation events → EXTERNAL alerts, deduped by event id, never FN. */
async function load() {
  const link = await import("./donationLink");
  const yt = await import("./youtube");
  const { mockAlerts } = await import("./alertCore");
  const { mockAccount } = await import("@/services/account/mockStore");
  const { mockWallet } = await import("@/services/wallet/mockWalletStore");
  return { ...link, ...yt, alerts: mockAlerts, account: mockAccount, wallet: mockWallet };
}

const chat = (n: number, extra: Record<string, unknown> = {}) => ({ platform: "YOUTUBE", donor: "시청자", message: "화이팅", value: 5_000, currency: "KRW", requestId: key(n), ...extra });

describe("donation link", () => {
  beforeEach(() => resetMockStores());

  it("needs a connected, supported platform before it can be turned on", async () => {
    const m = await load();
    const view = (await m.getDonationLinks())!;
    expect(view.links.map((l) => [l.platform, l.supported, l.connected])).toEqual([
      ["YOUTUBE", true, false],
      ["FLEXTV", false, false],
      ["SOOP", false, false]
    ]);
    expect((await m.setDonationLink({ platform: "YOUTUBE", enabled: true })).status).toBe("INVALID");
    expect((await m.setDonationLink({ platform: "SOOP", enabled: true })).status).toBe("INVALID");
    expect((await m.simulateExternalDonation(chat(1))).status).toBe("INVALID");
  });

  it("queues one EXTERNAL alert per platform event, in its own currency, without touching FN", async () => {
    const m = await load();
    await m.connectYouTube({ handle: "linked", requestId: key(2) });
    const balance = m.account.fnBalance;
    m.alerts.controls.minFn = 1_000_000;

    // Off: the event is not shown, and switching on later does not replay it.
    await m.simulateExternalDonation(chat(3));
    expect(m.alerts.items).toHaveLength(0);
    expect(await m.setDonationLink({ platform: "YOUTUBE", enabled: true })).toEqual({ status: "OK" });
    expect(await m.pollDonationLinks()).toEqual({ status: "OK", ingested: 0, duplicates: 0 });

    expect(await m.simulateExternalDonation(chat(4, { redeliver: true, value: 12.5, currency: "USD" }))).toEqual({ status: "OK", ingested: 1, duplicates: 1 });
    expect(await m.simulateExternalDonation(chat(4, { redeliver: true }))).toEqual({ status: "OK", ingested: 0, duplicates: 0 });
    expect(m.alerts.items).toHaveLength(1);
    expect(m.alerts.items[0]).toMatchObject({ kind: "EXTERNAL", fnAmount: 0, amountLabel: "US$12.50", typeLabel: "YouTube 슈퍼챗", status: "SHOWING" });

    const view = (await m.getDonationLinks())!;
    expect(view.links[0]).toMatchObject({ enabled: true, received: 1, duplicates: 1 });
    expect(view.recent[0]).toMatchObject({ donor: "시청자", amountLabel: "US$12.50" });
    expect(m.account.fnBalance).toBe(balance);
    expect(m.wallet.donations).toHaveLength(0);
  });

  it("validates the simulator and requires the creator role", async () => {
    const m = await load();
    await m.connectYouTube({ handle: "linked", requestId: key(5) });
    expect((await m.simulateExternalDonation(chat(6, { value: -1 }))).status).toBe("INVALID");
    expect((await m.simulateExternalDonation(chat(7, { currency: "BTC" }))).status).toBe("INVALID");
    expect((await m.simulateExternalDonation(chat(8, { donor: "" }))).status).toBe("INVALID");
    expect((await m.simulateExternalDonation(chat(9, { platform: "SOOP" }))).status).toBe("INVALID");
    signIn(["SUPPORTER"]);
    expect(await m.getDonationLinks()).toBeNull();
    expect(await m.pollDonationLinks()).toEqual({ status: "UNAUTHORIZED" });
  });
});
