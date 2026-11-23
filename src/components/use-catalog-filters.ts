"use client";
import { useSearchParams } from "next/navigation";
import { useSyncExternalStore } from "react";
import {
  emptyCreatorFilters,
  parseCreatorFilters,
  serializeCreatorFilters,
  type CreatorFilters,
} from "@/lib/creator-filters";

const filterUrlChanged = "adme:catalog-url-changed";
function subscribe(listener: () => void) {
  window.addEventListener("popstate", listener);
  window.addEventListener(filterUrlChanged, listener);
  return () => {
    window.removeEventListener("popstate", listener);
    window.removeEventListener(filterUrlChanged, listener);
  };
}
const browserQuery = () => window.location.search;

export function useCatalogFilters() {
  const searchParams = useSearchParams();
  // Router URL updates can be transition-priority. A synchronous URL store
  // prevents controlled checkboxes reverting before the router rerender.
  const query = useSyncExternalStore(
    subscribe,
    browserQuery,
    () => `?${searchParams.toString()}`,
  );
  const filters = parseCreatorFilters(new URLSearchParams(query));
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
    window.dispatchEvent(new Event(filterUrlChanged));
  }
  return { filters, update, reset: () => update(emptyCreatorFilters()) };
}
