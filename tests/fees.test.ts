import { describe, it, expect } from "vitest";
import { estimateFee } from "@/lib/fees";
describe("D072 fee simulator", () => {
  it("computes fee and net, rounded to won", () => {
    expect(estimateFee(1_000_000, 10)).toEqual({ fee: 100_000, net: 900_000 });
    expect(estimateFee(9_999, 3.3)).toEqual({ fee: 330, net: 9_669 });
    expect(estimateFee(0, 0)).toEqual({ fee: 0, net: 0 });
    expect(estimateFee(100_000_000, 30)).toEqual({
      fee: 30_000_000,
      net: 70_000_000,
    });
  });
  it("rejects out-of-range or non-numeric input", () => {
    for (const [p, r] of [
      [-1, 10],
      [100_000_001, 10],
      [1.5, 10],
      [NaN, 10],
      [1000, -0.1],
      [1000, 30.1],
      [1000, NaN],
    ])
      expect(estimateFee(p, r)).toHaveProperty("error");
  });
});
