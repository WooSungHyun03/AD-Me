import { expect, it, vi } from "vitest";
import { confirmTestPayment } from "@/lib/billing-confirmation";
const input = {
  orderId: "ad000000-0000-4000-8000-000000000301",
  paymentKey: "fictional-test-payment-key",
  amount: 4900,
};
it("never sends forged malformed callbacks or claims success from arbitrary HTTP200 bodies", async () => {
  const request = vi.fn<typeof fetch>();
  for (const patch of [
    { orderId: "bad" },
    { amount: NaN },
    { amount: -1 },
    { amount: 1.5 },
    { paymentKey: "" },
    { ownerId: "other" },
  ])
    expect(
      (await confirmTestPayment({ ...input, ...patch }, request)).state,
    ).toBe("rejected");
  expect(request).not.toHaveBeenCalled();
  for (const body of [
    {},
    { ok: true },
    { ok: false },
    { ok: true, entitlementId: "bad" },
  ]) {
    request.mockResolvedValue(Response.json(body));
    expect((await confirmTestPayment(input, request)).state).toBe("retry");
  }
});
it("manual recovery retains original order and accepts only server-confirmed duplicate or entitlement", async () => {
  const request = vi.fn<typeof fetch>();
  request.mockRejectedValueOnce(Error("interrupted"));
  expect((await confirmTestPayment(input, request)).state).toBe("retry");
  request.mockResolvedValueOnce(Response.json({ ok: true, duplicate: true }));
  expect((await confirmTestPayment(input, request)).state).toBe("confirmed");
  expect(JSON.parse(String(request.mock.calls[0][1]?.body))).toEqual(
    JSON.parse(String(request.mock.calls[1][1]?.body)),
  );
  request.mockResolvedValue(
    Response.json({ ok: true, entitlementId: input.orderId }),
  );
  expect((await confirmTestPayment(input, request)).state).toBe("confirmed");
});
it.each([400, 401, 403, 409, 429, 503])(
  "preserves denied versus retry states for status %i",
  async (status) => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        Response.json({ message: "untrusted success claim" }, { status }),
      );
    expect((await confirmTestPayment(input, request)).state).toBe(
      status === 429 || status >= 500 ? "retry" : "rejected",
    );
  },
);
