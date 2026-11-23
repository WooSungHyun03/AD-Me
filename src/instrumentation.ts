import type { Instrumentation } from "next";
// D086: every server error captured by Next (render, route handler, server action, proxy) is logged without PII
// and alerted through the configured webhook.
export const onRequestError: Instrumentation.onRequestError = async (
  err,
  request,
  context,
) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { reportError, requestId } = await import("./lib/observability");
  await reportError(err, {
    route: context.routePath,
    kind: context.routeType,
    method: request.method,
    path: request.path.split("?")[0],
    request_id: requestId(request.headers),
  });
};
