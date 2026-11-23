import { expect, it, vi } from "vitest";
import { emptyCreatorFilters } from "@/lib/creator-filters";
import { createLatestCreatorSearch } from "@/lib/creator-search-request";
const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};

it("aborts the previous request and discards a late response even when the adapter ignores abort", async () => {
  const gate = createLatestCreatorSearch<string>();
  const old = deferred<string>();
  let oldSignal!: AbortSignal;
  const first = gate.run(emptyCreatorFilters(), (_, signal) => {
    oldSignal = signal;
    return old.promise;
  });
  const second = gate.run(
    { ...emptyCreatorFilters(), query: "latest" },
    async () => "new-result",
  );
  expect(oldSignal.aborted).toBe(true);
  expect(await second).toEqual({ kind: "current", value: "new-result" });
  old.resolve("old-result");
  expect(await first).toEqual({ kind: "stale" });
});
it("suppresses an old rejection and preserves a current request failure for recovery UX", async () => {
  const gate = createLatestCreatorSearch<string>();
  const old = deferred<string>();
  const first = gate.run(emptyCreatorFilters(), () => old.promise);
  expect(
    await gate.run(emptyCreatorFilters(), async () => "new-result"),
  ).toEqual({ kind: "current", value: "new-result" });
  old.reject(new Error("old failure"));
  expect(await first).toEqual({ kind: "stale" });
  await expect(
    gate.run(emptyCreatorFilters(), async () => {
      throw new Error("current failure");
    }),
  ).rejects.toThrow("current failure");
});
it("cancel/dispose invalidate work and a disposed consumer never starts another request", async () => {
  const gate = createLatestCreatorSearch<string>();
  const old = deferred<string>();
  const pending = gate.run(emptyCreatorFilters(), () => old.promise);
  gate.cancel();
  old.resolve("ignored");
  expect(await pending).toEqual({ kind: "stale" });
  gate.dispose();
  const request = vi.fn().mockResolvedValue("not-called");
  expect(await gate.run(emptyCreatorFilters(), request)).toEqual({
    kind: "stale",
  });
  expect(request).not.toHaveBeenCalled();
});
it("snapshots the query so later UI mutations cannot alter an in-flight request", async () => {
  const filters = emptyCreatorFilters();
  filters.categories.push("뷰티");
  const gate = createLatestCreatorSearch<string[]>();
  const result = gate.run(filters, async (query) => {
    await Promise.resolve();
    return query.categories;
  });
  filters.categories.push("테크");
  expect(await result).toEqual({ kind: "current", value: ["뷰티"] });
});
