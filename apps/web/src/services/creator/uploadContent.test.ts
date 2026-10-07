import { beforeEach, describe, expect, it, vi } from "vitest";
import { key, mockSessionModule, resetMockStores } from "@/test/mockEnv";

vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
vi.mock("@/lib/session", () => mockSessionModule());

/** Uploads are checked by their bytes, not the declared type (tiny synthetic files only). */
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const png = (name = "a.png") => new File([PNG], name, { type: "image/png" });
const renamed = (name = "a.png") => new File(["<html>not an image</html>"], name, { type: "image/png" });

describe("upload content checks", () => {
  beforeEach(() => resetMockStores());

  it("refuses a renamed file as a channel profile image", async () => {
    const { uploadCreatorImage } = await import("./creatorSettings");
    const form = (file: File) => {
      const fd = new FormData();
      fd.set("slot", "0");
      fd.set("image", file);
      return fd;
    };
    expect(await uploadCreatorImage(form(renamed()))).toEqual({ status: "UNSUPPORTED" });
    const ok = await uploadCreatorImage(form(png()));
    expect(ok.status === "UPLOADED" && ok.url.startsWith("data:image/png;base64,")).toBe(true);
  });

  it("refuses a renamed file as a 칭호 icon", async () => {
    const { saveTitleTier } = await import("./donationManagement");
    const { TITLE_TIERS } = await import("./donationManagementTypes");
    const form = (icon: File) => {
      const fd = new FormData();
      fd.set("threshold", String(TITLE_TIERS[0]));
      fd.set("name", "VIP");
      fd.set("description", "");
      fd.set("color", "#FFFFFF");
      fd.set("icon", icon);
      return fd;
    };
    expect(await saveTitleTier(form(renamed()))).toEqual({ status: "INVALID", message: "JPG, PNG, WEBP 이미지만 등록할 수 있어요." });
    const ok = await saveTitleTier(form(png()));
    expect(ok.status === "SAVED" && ok.tier.iconUrl?.startsWith("data:image/png;base64,")).toBe(true);
  });

  it("refuses a 그림후원 drawing whose bytes are not a PNG", async () => {
    const { mockAccount } = await import("@/services/account/mockStore");
    mockAccount.fnBalance = 50_000;
    const { requestDonation } = await import("@/services/donations/donate");
    const drawing = (n: number, image: string) => ({
      creatorId: "c1",
      hideProfile: false,
      type: "DRAWING",
      amount: 1_000,
      title: "고양이",
      image,
      showProcess: false,
      canvasMode: false,
      termsAgreed: true,
      idempotencyKey: key(n)
    });
    const b64 = (bytes: Uint8Array | string) => Buffer.from(bytes).toString("base64");
    expect(await requestDonation(drawing(1, `data:image/png;base64,${b64("<svg onload=alert(1)>")}`))).toEqual({ status: "INVALID" });
    expect(await requestDonation(drawing(2, "data:image/png;base64,AAAA"))).toEqual({ status: "INVALID" });
    expect(await requestDonation(drawing(3, `data:image/png;base64,${b64(PNG)}"><b>`))).toEqual({ status: "INVALID" });
    expect(mockAccount.fnBalance).toBe(50_000);
    expect((await requestDonation(drawing(4, `data:image/png;base64,${b64(PNG)}`))).status).toBe("COMPLETED");
  });
});
