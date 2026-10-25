import { describe, it, expect } from "vitest";
import { swr } from "../src/lib/admin-cache";
import { rateLimit, RateLimitError } from "../src/lib/rate-limit";

describe("admin perf", () => {
  it("single-flight: 50 parallel calls -> 1 loader run", async () => {
    let n = 0;
    const load = async () => { n++; await new Promise(r => setTimeout(r, 20)); return 1; };
    await Promise.all(Array.from({ length: 50 }, () => swr("k", 1000, 1000, load)));
    expect(n).toBe(1);
  });
  it("rate limit blocks after capacity", () => {
    for (let i = 0; i < 3; i++) rateLimit("t", 3, 0.001);
    expect(() => rateLimit("t", 3, 0.001)).toThrow(RateLimitError);
  });
});
