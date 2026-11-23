import { expect, it } from "vitest";
import { requestBudgetSubjects } from "@/lib/request-budget-subjects";
it("ignores spoofable headers and uses no account identifier without a server secret", () => {
  const h = new Headers({
    "x-forwarded-for": "1.2.3.4",
    "x-real-ip": "1.2.3.4",
    "x-vercel-forwarded-for": "1.2.3.4",
  });
  expect(
    requestBudgetSubjects(h, false, "local-fixture", "Person@Example.test").ip,
  ).toBeNull();
  expect(
    requestBudgetSubjects(h, true, undefined, "Person@Example.test"),
  ).toEqual({ ip: null, account: null });
});
it("hashes canonical account values and trusts only one valid Vercel IP", () => {
  const h = new Headers({ "x-vercel-forwarded-for": "2001:db8::1" }),
    a = requestBudgetSubjects(h, true, "fixture-A", " Person@Example.test "),
    b = requestBudgetSubjects(h, true, "fixture-A", "person@example.test");
  expect(a).toEqual(b);
  expect(a.ip).toMatch(/^[a-f0-9]{64}$/);
  expect(a.account).not.toContain("person");
  expect(
    requestBudgetSubjects(h, true, "fixture-B", "person@example.test"),
  ).not.toEqual(a);
  for (const value of ["1.2.3.4, 5.6.7.8", "invalid", "https://1.2.3.4"])
    expect(
      requestBudgetSubjects(
        new Headers({ "x-vercel-forwarded-for": value }),
        true,
        "fixture-A",
      ).ip,
    ).toBeNull();
});
