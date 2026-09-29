/**
 * Member roles (CLAUDE.md §6). How a member becomes a Creator (application, approval, platform
 * verification) and how Admin is granted are not decided yet (TBD). The backend must enforce
 * roles on every request; frontend checks are for UX only.
 */
export type Role = "SUPPORTER" | "CREATOR" | "ADMIN";

export const ROLES: readonly Role[] = ["SUPPORTER", "CREATOR", "ADMIN"];
