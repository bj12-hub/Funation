import { SAMPLE_MEMBER_ID, isMemberSuspended } from "@/services/admin/memberCore";
import { isWithdrawn } from "./withdrawalCore";

/**
 * False while the sample creator is suspended or has withdrawn. Access that acts for the creator without a
 * login (manager chat links, the bank-SMS webhook) stops with it, the same way `getSession()` signs them out.
 */
export const creatorAccessOpen = () => !isMemberSuspended(SAMPLE_MEMBER_ID) && !isWithdrawn();
