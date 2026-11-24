import "server-only";

export function logApiFailure(
  operation: string,
  errorCode: string,
  requestId: string,
  elapsed: number,
) {
  const parts = operation.split(".");
  const domain = operation.startsWith("src/app/api/")
    ? operation.split("/")[3]
    : parts[0];
  console.error("api_error", {
    timestamp: new Date().toISOString(),
    requestId,
    domain,
    operation,
    level: "error",
    duration: Math.round(elapsed),
    errorCode,
    retryable: errorCode === "SERVICE_UNAVAILABLE",
  });
}
