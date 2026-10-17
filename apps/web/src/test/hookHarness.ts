import type { ReactElement, ReactNode } from "react";

/**
 * A minimal hook runtime for pressing buttons in client components under the node test environment (no DOM). A test
 * mounts the component function, calls an element's handler (onClick, onChange …) from the returned tree, waits for
 * what it started and renders again to see the next state. Child components are not rendered: their elements stay in
 * the tree with their props, so a test can still find a Link's href or a TextField's onChange.
 *
 * The component's module must see these hooks instead of React's, with this line in the test file (hoisted by vitest):
 *   vi.mock("react", async (importOriginal) => ({ ...(await importOriginal<object>()), ...(await import("@/test/hookHarness")).harnessHooks }));
 * Effects run after the render whose dependencies changed; a transition's action is kept until `settle()`, which
 * throws what the action threw (React shows that on the nearest error boundary).
 */

type Store = { slots: unknown[]; cursor: number; effects: (() => void)[]; pending: Promise<unknown>[] };
const store: Store = { slots: [], cursor: 0, effects: [], pending: [] };

const sameDeps = (a: unknown[] | undefined, b: unknown[] | undefined) => !!a && !!b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));

/** The slot of this hook call: `init` on the first render, the kept value afterwards. */
function slot<T>(init: () => T): { i: number; value: T } {
  const i = store.cursor++;
  if (!(i in store.slots)) store.slots[i] = init();
  return { i, value: store.slots[i] as T };
}

export const harnessHooks = {
  useState<T>(initial: T | (() => T)) {
    const { i, value } = slot(() => (typeof initial === "function" ? (initial as () => T)() : initial));
    const set = (next: T | ((prev: T) => T)) => {
      store.slots[i] = typeof next === "function" ? (next as (prev: T) => T)(store.slots[i] as T) : next;
    };
    return [value, set] as const;
  },
  useRef<T>(initial: T) {
    return slot(() => ({ current: initial })).value;
  },
  useMemo<T>(make: () => T, deps?: unknown[]) {
    const { i, value } = slot(() => ({ value: make(), deps }));
    if (sameDeps(value.deps, deps)) return value.value;
    store.slots[i] = { value: make(), deps };
    return (store.slots[i] as { value: T }).value;
  },
  useCallback<T>(fn: T, deps?: unknown[]) {
    return harnessHooks.useMemo(() => fn, deps);
  },
  useEffect(effect: () => void | (() => void), deps?: unknown[]) {
    const { i, value } = slot<{ deps: unknown[] | undefined; ran: boolean }>(() => ({ deps, ran: false }));
    if (value.ran && sameDeps(value.deps, deps)) return;
    store.slots[i] = { deps, ran: true };
    store.effects.push(() => void effect());
  },
  useTransition() {
    // Like React, the action runs at once up to its first await.
    const start = (action: () => unknown) => {
      store.pending.push((async () => action())());
    };
    return [false, start] as const;
  },
  useId: () => "harness-id",
  /** Mounted outside any provider: the context's default value. */
  useContext: <T>(context: { _currentValue: T }) => context._currentValue
};

/**
 * Mounts `component` with `props` (fresh hook state). `render()` calls it again and runs the effects that are due;
 * `settle()` waits for the started transitions and the promises they and the effects started, and throws what failed.
 */
export function mount<P>(component: (props: P) => ReactNode, props: P) {
  store.slots = [];
  store.effects = [];
  store.pending = [];
  const render = () => {
    store.cursor = 0;
    const tree = component(props);
    for (const run of store.effects.splice(0)) run();
    return tree;
  };
  const settle = async () => {
    // Mocked services answer at once; a few macrotask turns let the awaits after them run.
    for (let turn = 0; turn < 5; turn++) {
      await Promise.all(store.pending.splice(0));
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  };
  return { render, settle };
}

const isElement = (node: unknown): node is ReactElement<Record<string, unknown>> =>
  typeof node === "object" && node !== null && "$$typeof" in node && "props" in node;

/** Every element in a rendered tree, including the elements held in other props (a Modal's footer, a field's action). */
export function elementsOf(node: ReactNode): ReactElement<Record<string, unknown>>[] {
  const found: ReactElement<Record<string, unknown>>[] = [];
  const walk = (value: unknown) => {
    if (Array.isArray(value)) return value.forEach(walk);
    if (!isElement(value)) return;
    found.push(value);
    Object.values(value.props).forEach(walk);
  };
  walk(node);
  return found;
}

/** The text of a tree's children, as React puts it on the page (adjacent strings joined without a space). */
export function textOf(node: ReactNode): string {
  const parts: string[] = [];
  const walk = (value: unknown) => {
    if (typeof value === "string" || typeof value === "number") parts.push(String(value));
    else if (Array.isArray(value)) value.forEach(walk);
    else if (isElement(value)) walk(value.props.children);
  };
  walk(node);
  return parts.join("");
}

/** The first element whose own text contains `text` (e.g. a button by its label). */
export const byText = (tree: ReactNode, text: string, type?: unknown) =>
  elementsOf(tree).find((el) => (type === undefined || el.type === type) && textOf(el).includes(text)) ?? null;
