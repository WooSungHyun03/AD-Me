import { resolveServiceMode } from "./config-schema";
export type { ServiceMode } from "./config-schema";
// Server-only env (never NEXT_PUBLIC_): a client-bundled flag must not decide data or billing access.
// Anything other than an explicit "test_demo" fails closed to the free real service.
export function serviceMode(...input: [] | [string | undefined]) {
  return resolveServiceMode(
    input.length ? { SERVICE_MODE: input[0] } : process.env,
  ).value;
}
export const isDemoMode = () => serviceMode() === "test_demo";
