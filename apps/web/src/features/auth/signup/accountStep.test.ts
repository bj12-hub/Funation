import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { elementsOf, mount } from "@/test/hookHarness";

vi.mock("react", async (importOriginal) => ({ ...(await importOriginal<object>()), ...(await import("@/test/hookHarness")).harnessHooks }));
vi.mock("@/services/auth/signup", () => ({ checkEmailAvailability: vi.fn(), checkNicknameAvailability: vi.fn() }));

/**
 * 회원가입 계정 설정 (Figma 45:39) — 중복 확인. An answer counts only for the value it was asked about: when the field
 * changed while the check ran, the answer is dropped (the new value still needs its own check). A failed check ends
 * the checking state with an error, so 중복 확인 can be pressed again.
 */
type Props = { submitting: boolean; submitError: string | null; onBack: () => void; onSubmit: (v: unknown) => void };
type Field = ReactElement<{ name?: string; value?: string; hint?: string; error?: string | null; onChange?: (e: { target: { value: string } }) => void; action?: ReactElement<{ onClick: () => Promise<void>; disabled?: boolean }> }>;

const deferred = <T>() => {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

async function setup() {
  const { AccountStep } = await import("./AccountStep");
  const signup = await import("@/services/auth/signup");
  const view = mount(AccountStep as (p: Props) => ReactElement, { submitting: false, submitError: null, onBack() {}, onSubmit() {} });
  const field = (name: string) => elementsOf(view.render()).find((el) => (el as Field).props.name === name) as Field;
  const type = (name: string, value: string) => field(name).props.onChange!({ target: { value } });
  return { view, field, type, signup: vi.mocked(signup) };
}

describe("회원가입 계정 설정 · 중복 확인", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("drops an e-mail answer when the field changed while it was checked", async () => {
    const { field, type, signup } = await setup();
    const answer = deferred<{ available: boolean }>();
    signup.checkEmailAvailability.mockReturnValueOnce(answer.promise);
    type("email", "first@example.test");
    const checking = field("email").props.action!.props.onClick();
    type("email", "second@example.test");
    answer.resolve({ available: true });
    await checking;
    expect(signup.checkEmailAvailability).toHaveBeenCalledWith("first@example.test");
    // The available answer was for first@…: second@… is not shown as checked.
    expect(field("email").props.value).toBe("second@example.test");
    expect(field("email").props.hint).toBeUndefined();
    expect(field("email").props.error).toBeUndefined();
  }, 30_000);

  it("drops a nickname answer when the field changed while it was checked", async () => {
    const { field, type, signup } = await setup();
    const answer = deferred<{ available: boolean; reason?: "DUPLICATE" }>();
    signup.checkNicknameAvailability.mockReturnValueOnce(answer.promise);
    type("nickname", "홍길동");
    const checking = field("nickname").props.action!.props.onClick();
    type("nickname", "새닉네임");
    answer.resolve({ available: false, reason: "DUPLICATE" });
    await checking;
    expect(field("nickname").props.error).toBeUndefined();
    expect(field("nickname").props.hint).toBeUndefined();

    // The same value as asked: the answer shows.
    signup.checkNicknameAvailability.mockResolvedValueOnce({ available: true });
    await field("nickname").props.action!.props.onClick();
    expect(field("nickname").props.hint).toBe("사용 가능한 닉네임입니다.");
  }, 30_000);

  it("ends a failed check with an error and lets 중복 확인 be pressed again", async () => {
    const { field, type, signup } = await setup();
    signup.checkEmailAvailability.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    signup.checkNicknameAvailability.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    type("email", "qa@example.test");
    type("nickname", "새닉네임");
    await expect(field("email").props.action!.props.onClick()).resolves.toBeUndefined();
    await expect(field("nickname").props.action!.props.onClick()).resolves.toBeUndefined();
    for (const name of ["email", "nickname"]) {
      expect(field(name).props.action!.props.disabled).toBe(false);
      expect(field(name).props.error).toBe("일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요");
    }
  }, 30_000);
});
