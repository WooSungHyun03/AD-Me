import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getConfig } from "@/lib/config";
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const config = getConfig().supabase;
  if (!config) return response;
  const db = createServerClient(config.url, config.key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(values) {
        values.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        values.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });
  await db.auth.getClaims();
  return response;
}
export const config = {
  matcher: [
    "/dashboard/:path*",
    "/settings/:path*",
    "/campaigns/:path*",
    "/api/:path*",
    "/admin/:path*",
  ],
};
