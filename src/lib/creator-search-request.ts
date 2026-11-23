import type { CreatorFilters } from "./creator-filters";

// D033 handoff contract only. The current catalog filters its supplied snapshot
// synchronously; no fictional endpoint or provider response is introduced here.
export function createLatestCreatorSearch<T>() {
  let sequence = 0;
  let active: AbortController | undefined;
  let disposed = false;
  const cancel = () => {
    sequence++;
    active?.abort();
    active = undefined;
  };
  return {
    cancel,
    dispose() {
      disposed = true;
      cancel();
    },
    async run(
      filters: CreatorFilters,
      request: (query: CreatorFilters, signal: AbortSignal) => Promise<T>,
    ): Promise<{ kind: "current"; value: T } | { kind: "stale" }> {
      if (disposed) return { kind: "stale" };
      cancel();
      const current = sequence;
      const controller = new AbortController();
      active = controller;
      try {
        const value = await request(
          structuredClone(filters),
          controller.signal,
        );
        return current === sequence && !controller.signal.aborted && !disposed
          ? { kind: "current", value }
          : { kind: "stale" };
      } catch (error) {
        if (current !== sequence || controller.signal.aborted || disposed)
          return { kind: "stale" };
        throw error;
      } finally {
        if (current === sequence) active = undefined;
      }
    },
  };
}
