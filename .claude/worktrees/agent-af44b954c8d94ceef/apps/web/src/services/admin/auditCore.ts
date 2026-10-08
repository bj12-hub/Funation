import type { AdminActor, AuditAction, AuditEntry } from "./adminTypes";

/**
 * Server-only audit log (not a "use server" module). Append-only: entries are never edited or removed
 * here; the real backend must store them durably with the request id and client info (TBD).
 */

type Store = { entries: AuditEntry[] };
const g = globalThis as typeof globalThis & { __funationMockAuditV1?: Store };
export const auditStore = (): Store => (g.__funationMockAuditV1 ??= { entries: [] });

export function recordAudit(actor: AdminActor, action: AuditAction, target: string | null = null, reason: string | null = null, now = Date.now()) {
  const s = auditStore();
  const entry: AuditEntry = { id: `au-${now.toString(36)}-${s.entries.length}`, at: new Date(now).toISOString(), actorId: actor.userId, actorName: actor.nickname, action, target, reason };
  s.entries.push(entry);
  return entry;
}

/** Newest first. */
export const auditEntries = () => [...auditStore().entries].reverse();
