import { redirect } from "next/navigation";
import { currentUser } from "@/lib/supabase";
import { SavedSearches } from "@/components/saved-searches";
import { parseCreatorFilters } from "@/lib/creator-filters";
export default async function SavedSearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (!(await currentUser())) redirect("/login");
  const input = await searchParams,
    params = new URLSearchParams();
  for (const [key, raw] of Object.entries(input))
    for (const value of Array.isArray(raw) ? raw : raw ? [raw] : [])
      params.append(key, value);
  return (
    <section className="wrap">
      <h1 className="page-title">내 저장 검색</h1>
      <SavedSearches filters={parseCreatorFilters(params)} />
    </section>
  );
}
