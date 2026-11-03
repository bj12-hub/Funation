import { FLEXTV_WALLET } from "@/lib/flextv/mode";
import { fetchBalance } from "@/lib/flextv/wallet";
import { USE_MOCK } from "@/lib/mock";
import { getFlextvAccessToken, getSession } from "@/lib/session";
import { mockAccount } from "@/services/account/mockStore";

/**
 * The signed-in member's balance for the header and side menu (server-only read, display only — every spend is
 * checked by the server again). With the FLEXTV backend: the member's 렉스 at FLEXTV; null when it cannot be read, which
 * the header shows as "—".
 */
export async function getWalletBalance(): Promise<number | null> {
  if (FLEXTV_WALLET) {
    const token = await getFlextvAccessToken();
    return token ? fetchBalance(token).catch(() => null) : null;
  }
  if (!USE_MOCK || !(await getSession())) return null;
  return mockAccount.fnBalance;
}
