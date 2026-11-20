"use client";
import { useSearchParams } from "next/navigation";
import {
  emptyCreatorFilters,
  parseCreatorFilters,
  serializeCreatorFilters,
  type CreatorFilters,
} from "@/lib/creator-filters";

export function useCatalogFilters() {
  const searchParams = useSearchParams();
  const filters = parseCreatorFilters(
    new URLSearchParams(searchParams.toString()),
  );
  function update(
    patch:
      | Partial<CreatorFilters>
      | ((current: CreatorFilters) => Partial<CreatorFilters>),
    replace = false,
  ) {
    // Read the URL inside the event so consecutive events cannot use stale render state.
    const current = new URLSearchParams(window.location.search);
    const state = parseCreatorFilters(current);
    const next = serializeCreatorFilters(
      { ...state, ...(typeof patch === "function" ? patch(state) : patch) },
      current,
    ).toString();
    const url = `${window.location.pathname}${next ? `?${next}` : ""}${window.location.hash}`;
    if (
      url ===
      `${window.location.pathname}${window.location.search}${window.location.hash}`
    )
      return;
    if (replace) window.history.replaceState(null, "", url);
    else window.history.pushState(null, "", url);
  }
  return { filters, update, reset: () => update(emptyCreatorFilters()) };
}
