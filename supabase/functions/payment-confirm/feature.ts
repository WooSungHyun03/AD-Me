export function allowsTestPayment(
  mode: string | undefined,
  flag: string | undefined,
) {
  return mode === "test_demo" && flag === "on";
}
