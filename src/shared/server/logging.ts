import "server-only";
import { mask } from "@/lib/observability";

export function logApiFailure(
  operation: string,
  errorCode: string,
  requestId: string,
  elapsed: number,
) {
  // D078: route labels are code constants, but they still pass the shared redaction before reaching logs.
  const label = String(mask(operation)).slice(0, 120);
  const parts = label.split(".");
  const domain = label.startsWith("src/app/api/")
    ? label.split("/")[3]
    : parts[0];
  console.error("api_error", {
    timestamp: new Date().toISOString(),
    requestId,
    domain,
    operation: label,
    level: "error",
    duration: Math.round(elapsed),
    errorCode,
    retryable: errorCode === "SERVICE_UNAVAILABLE",
  });
}
