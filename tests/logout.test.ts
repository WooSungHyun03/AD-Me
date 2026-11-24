import { beforeEach, expect, it, vi } from "vitest";
const auth = vi.hoisted(() => ({ signOut: vi.fn() }));
vi.mock("@/lib/supabase", () => ({ supabase: async () => ({ auth }) }));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw Error("REDIRECT:" + path);
  },
}));
import { logout } from "@/app/actions";
beforeEach(() => vi.resetAllMocks());
it("does not report a completed logout when the provider refuses revocation", async () => {
  auth.signOut.mockResolvedValue({
    error: { message: "private provider detail" },
  });
  await expect(logout()).rejects.toThrow("REDIRECT:/login?error=logout");
});
it("requests global revocation before successful navigation", async () => {
  auth.signOut.mockResolvedValue({ error: null });
  await expect(logout()).rejects.toThrow("REDIRECT:/");
  expect(auth.signOut).toHaveBeenCalledExactlyOnceWith({ scope: "global" });
});
it("handles a failed revocation transport without claiming success", async () => {
  auth.signOut.mockRejectedValue(Error("network offline"));
  await expect(logout()).rejects.toThrow("REDIRECT:/login?error=logout");
});
