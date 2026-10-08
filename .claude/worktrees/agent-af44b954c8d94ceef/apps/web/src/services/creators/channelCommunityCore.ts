/** Server-only channel community store (not a "use server" module); shared with moderation (신고 · 차단). */
export type StoredChannelPost = { id: string; creatorId: string; authorId: string; authorName: string; body: string; createdAt: string; deleted: boolean };
type Store = { posts: StoredChannelPost[]; requests: Record<string, string>; seeded: Record<string, true> };
const g = globalThis as typeof globalThis & { __funationMockChannelHomeV1?: Store };
export const channelCommunityStore = (): Store => (g.__funationMockChannelHomeV1 ??= { posts: [], requests: {}, seeded: {} });
