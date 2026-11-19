import { getConfig } from "@/lib/config";

export function GET() {
  // Old email callback URLs direct users to request a fresh token-hash link.
  const origin = getConfig().appOrigin;
  return new Response(null, {
    status: 303,
    headers: {
      Location: origin ? new URL("/auth/error", origin).href : "/auth/error",
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
    },
  });
}
