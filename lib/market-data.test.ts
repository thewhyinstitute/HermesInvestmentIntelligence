import { describe, expect, it } from "vitest";
import { finiteNumber, freshness, parseFundamentals, parseQuote, parseTreasury, priceEarnings, providerError, scenarioReturn, validDate } from "./market-data";

describe("direct market data", () => {
  it("distinguishes premium restrictions from daily quotas without leaking provider text", () => {
    expect(providerError({ Information: "This is a premium endpoint. apikey=secret" })).toContain("requires Alpha Vantage Premium");
    expect(providerError({ Information: "25 requests per day. Subscribe to premium. secret" })).toContain("daily quota");
    expect(providerError({ Note: "rate limit 5 requests per minute secret" })).toContain("request-rate");
    expect(providerError({ Information: "invalid API key secret" })).not.toContain("secret");
  });
  it("rejects missing, null, infinite and formatted numbers", () => {
    for (const value of [null, undefined, "", "None", "1,000", Infinity]) expect(finiteNumber(value)).toBeUndefined();
    expect(finiteNumber("0")).toBe(0);
  });
  it("validates calendar dates and flags stale, future and undated values", () => {
    expect(validDate("2026-02-30")).toBe(false);
    const now = new Date("2026-10-14T12:00:00Z");
    expect(freshness("2026-10-13", 4, now)).toBe("fresh");
    expect(freshness("2026-10-01", 4, now)).toBe("stale");
    expect(freshness("2026-10-15", 4, now)).toBe("stale");
    expect(freshness(undefined, 4, now)).toBe("undated");
  });
  it("requires a matching positive dated quote and excludes credentials from provenance", () => {
    const payload = { "Global Quote": { "01. symbol": "NVDA", "05. price": "120.5", "07. latest trading day": "2026-10-13" } };
    expect(parseQuote(payload, "NVDA")).toMatchObject({ price: 120.5, asOf: "2026-10-13" });
    expect(parseQuote(payload, "NVDA").sourceUrl).not.toContain("apikey");
    expect(() => parseQuote(payload, "GRID")).toThrow();
    expect(() => parseQuote({ Information: "premium" }, "NVDA")).toThrow(/Provider/);
    expect(() => parseQuote({}, "NVDA")).toThrow();
  });
  it("preserves unavailable fundamentals rather than converting them to zero", () => {
    const result = parseFundamentals({ Symbol: "NVDA", EPS: "None", PERatio: "None", LatestQuarter: "2026-07-31" }, "NVDA");
    expect(result.eps).toBeUndefined(); expect(result.providerPE).toBeUndefined();
    expect(result.periodEnd).toBe("2026-07-31");
    expect(priceEarnings(100, 0)).toBeUndefined();
    expect(priceEarnings(100, -2)).toBeUndefined();
    expect(priceEarnings(100, 5)).toBe(20);
  });
  it("accepts ETF decimal ratios and discards invalid holdings", () => {
    const result = parseFundamentals({ net_expense_ratio: "0.0015", holdings: [{ symbol: "NVDA", weight: "0.08" }, { symbol: "BAD", weight: "None" }] }, "QQQM");
    expect(result.expenseRatio).toBe(0.0015);
    expect(result.holdings).toEqual([{ symbol: "NVDA", weight: 0.08 }]);
    expect(() => parseFundamentals({}, "IAU")).toThrow();
  });
  it("parses namespaced Treasury XML, sorts dates and ignores nulls/future dates", () => {
    const xml = `<feed xmlns:d="x" xmlns:m="y"><entry><content><m:properties><d:NEW_DATE m:type="Edm.DateTime">2026-10-12T00:00:00</d:NEW_DATE><d:BC_3MONTH m:type="Edm.Double">4.2</d:BC_3MONTH></m:properties></content></entry><entry><content><m:properties><d:NEW_DATE>2026-10-13T00:00:00</d:NEW_DATE><d:BC_3MONTH m:null="true"/><d:BC_10YEAR>5.2</d:BC_10YEAR></m:properties></content></entry><entry><content><m:properties><d:NEW_DATE>2026-10-15T00:00:00</d:NEW_DATE><d:BC_10YEAR>8</d:BC_10YEAR></m:properties></content></entry></feed>`;
    expect(parseTreasury(xml, "https://home.treasury.gov", new Date("2026-10-14"))).toMatchObject({ asOf: "2026-10-13", threeMonth: undefined, tenYear: 5.2 });
    expect(() => parseTreasury("<html>unavailable</html>", "url")).toThrow();
  });
  it("calculates scenarios from explicit assumptions, including total loss", () => {
    expect(scenarioReturn(100, 110, 1, 2)).toEqual({ total: 0.1200000000000001, annualized: 0.1200000000000001 });
    expect(scenarioReturn(100, 0, 3, 0)).toEqual({ total: -1, annualized: -1 });
    expect(scenarioReturn(0, 100, 3, 0)).toBeUndefined();
    expect(scenarioReturn(100, 100, 0, 0)).toBeUndefined();
    expect(scenarioReturn(100, NaN, 3, 0)).toBeUndefined();
  });
});
