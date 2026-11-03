/**
 * One call at a time per key (a member), on this server. FLEXTV checks and writes in separate steps on several of its
 * endpoints (streamer registration, starting a broadcast, 환전 신청), so two requests of one member — a double click,
 * two tabs — must not reach it together.
 */
export function createQueue(name: string) {
  const g = globalThis as typeof globalThis & Record<string, Map<string, Promise<unknown>> | undefined>;
  const queues = (g[`__ssumnationFlextvQueue_${name}`] ??= new Map());
  return function serialize<T>(key: string, task: () => Promise<T>): Promise<T> {
    const previous = queues.get(key) ?? Promise.resolve();
    const next = previous.then(task, task);
    const tail = next.catch(() => undefined);
    queues.set(key, tail);
    void tail.then(() => queues.get(key) === tail && queues.delete(key));
    return next;
  };
}
