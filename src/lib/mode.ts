export type ServiceMode = "free_beta" | "test_demo";
// Server-only env (never NEXT_PUBLIC_): a client-bundled flag must not decide data or billing access.
// Anything other than an explicit "test_demo" fails closed to the free real service.
export const serviceMode = (
  env: string | undefined = process.env.SERVICE_MODE,
): ServiceMode => (env === "test_demo" ? "test_demo" : "free_beta");
export const isDemoMode = () => serviceMode() === "test_demo";
