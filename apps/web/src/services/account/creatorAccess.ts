import { sameSecret } from "@/lib/secret";
import { SAMPLE_MEMBER_ID, isMemberSuspended } from "@/services/admin/memberCore";
import { mockCreator } from "@/services/creator/mockCreatorStore";
import { isWithdrawn } from "./withdrawalCore";

/**
 * False while the sample creator is suspended or has withdrawn. Access that acts for the creator without a
 * login (manager chat links, the bank-SMS webhook, the OBS overlay key) stops with it, the same way `getSession()`
 * signs them out. Lifting the suspension opens it again with the same keys and links.
 */
export const creatorAccessOpen = () => !isMemberSuspended(SAMPLE_MEMBER_ID) && !isWithdrawn();

/**
 * The OBS overlay key (연동 키) in an `/overlay/*` address and the reads behind it: it must match, and the creator's
 * access must be open. Every overlay read checks the key with this, so a refused key looks like an unknown one.
 */
export const overlayKeyOpen = (key: unknown) => creatorAccessOpen() && sameSecret(key, mockCreator.integrationKey);
