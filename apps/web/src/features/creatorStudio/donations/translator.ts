import { DEFAULT_LOCALE } from "@/lib/i18n/config";
import { messagesFor, translate, type MessageKey } from "@/lib/i18n/translate";

/**
 * The page's translator for the 후원관리+ server components (`getT` in `app/creator/donations/page.tsx`, passed as `t`).
 * Rendered on their own (tests, the 도우미 filtering page) they use Korean, like `features/wallet/DonationTable`.
 */
export type T = (key: MessageKey, vars?: Record<string, string | number>) => string;
export const koT: T = (key, vars) => translate(messagesFor(DEFAULT_LOCALE), key, vars);
