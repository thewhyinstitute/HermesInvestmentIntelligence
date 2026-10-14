import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }));
import { loadMarketData } from "./market-provider";
import { GET } from "../app/api/market-data/route";

const xml = `<feed><entry><content><properties><NEW_DATE>2026-01-02T00:00:00</NEW_DATE><BC_3MONTH>4.2</BC_3MONTH></properties></content></entry></feed>`;
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
describe("market data boundary", () => {
  it("fetches only keyless Treasury data when no price key is configured", async () => {
    vi.stubEnv("ALPHA_VANTAGE_API_KEY", "");
    const fetchMock = vi.fn().mockResolvedValue(new Response(xml)); vi.stubGlobal("fetch", fetchMock);
    const result = await loadMarketData("NVDA");
    expect(result.configured).toBe(false); expect(result.result?.quote).toBeUndefined();
    expect(result.treasury?.threeMonth).toBe(4.2); expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("reports partial provider failures without exposing raw errors or a key", async () => {
    vi.stubEnv("ALPHA_VANTAGE_API_KEY", "secret-key-test");
    vi.stubGlobal("fetch", vi.fn(async (url: string | URL) => String(url).includes("treasury.gov")
      ? new Response(xml) : Response.json({ Information: "Limit reached secret-key-test" })));
    const result = await loadMarketData("NVDA");
    expect(result.result?.messages).toHaveLength(2);
    expect(JSON.stringify(result)).not.toContain("secret-key-test");
    expect(result.result?.quote).toBeUndefined();
  });
  it("rejects unsupported symbols before contacting providers", async () => {
    const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    const response = await GET(new Request("http://localhost/api/market-data?symbol=BAD"));
    expect(response.status).toBe(400); expect(fetchMock).not.toHaveBeenCalled();
  });
  it("does not spend free-key requests on premium company overview", async () => {
    vi.stubEnv("ALPHA_VANTAGE_API_KEY", "free-test-key");
    vi.stubEnv("ALPHA_VANTAGE_PREMIUM_ENABLED", "false");
    const fetchMock = vi.fn(async (url: string | URL) => String(url).includes("treasury.gov") ? new Response(xml)
      : Response.json({ "Global Quote": { "01. symbol": "NVDA", "05. price": "100", "07. latest trading day": "2026-10-13" } }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await loadMarketData("NVDA");
    expect(result.result?.quote?.price).toBe(100);
    expect(result.result?.messages.join(" ")).toContain("requires Premium");
    expect(fetchMock.mock.calls.some(call => String(call[0]).includes("OVERVIEW"))).toBe(false);
  });
  it("allows company fundamentals only with an explicit premium opt-in", async () => {
    vi.stubEnv("ALPHA_VANTAGE_API_KEY", "paid-test-key"); vi.stubEnv("ALPHA_VANTAGE_PREMIUM_ENABLED", "true");
    vi.stubGlobal("fetch", vi.fn(async (url: string | URL) => String(url).includes("treasury.gov") ? new Response(xml)
      : String(url).includes("OVERVIEW") ? Response.json({ Symbol: "NVDA", EPS: "5", LatestQuarter: "2026-07-31" })
      : Response.json({ "Global Quote": { "01. symbol": "NVDA", "05. price": "100", "07. latest trading day": "2026-10-13" } })));
    expect((await loadMarketData("NVDA")).result?.fundamentals?.eps).toBe(5);
  });
  it("shows Treasury outages rather than substitute yields", async () => {
    vi.stubEnv("ALPHA_VANTAGE_API_KEY", "");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));
    const result = await loadMarketData();
    expect(result.treasury).toBeUndefined(); expect(result.treasuryError).toContain("unavailable");
  });
});
