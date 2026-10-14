import { unstable_cache } from "next/cache";
import { createHash } from "node:crypto";
import { parseQuote, parseFundamentals, parseTreasury, type MarketSymbol, type MarketResponse } from "./market-data";

async function alpha(symbol: MarketSymbol, fn: string) {
  const url = new URL("https://www.alphavantage.co/query");
  url.search = new URLSearchParams({ function: fn, symbol, apikey: process.env.ALPHA_VANTAGE_API_KEY ?? "" }).toString();
  const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(12000) });
  if (!response.ok) throw new Error("Market provider temporarily unavailable.");
  return response.json() as Promise<unknown>;
}

// Cache only successfully parsed data, not provider error responses.
const quote = unstable_cache(async (symbol: MarketSymbol) => parseQuote(await alpha(symbol, "GLOBAL_QUOTE"), symbol), ["market-quotes-v1"], { revalidate: 21600 });
const fundamentals = unstable_cache(async (symbol: MarketSymbol) => ({ data: parseFundamentals(await alpha(symbol, symbol === "NVDA" ? "OVERVIEW" : "ETF_PROFILE"), symbol), fetchedAt: new Date().toISOString() }), ["market-fundamentals-v1"], { revalidate: 86400 });
function safeError(error: unknown, fallback: string) {
  return error instanceof Error && error.message.startsWith("Provider ") ? error.message : fallback;
}
// Briefly retain failures so repeated refreshes do not burn the free request quota.
const quoteAttempt = unstable_cache(async (symbol: MarketSymbol, keyIdentity: string) => {
  void keyIdentity;
  try { return { data: await quote(symbol), error: undefined }; }
  catch (error) { return { data: undefined, error: safeError(error, "Dated price unavailable. Try later.") }; }
}, ["market-quote-attempt-v1"], { revalidate: 900 });
const fundamentalsAttempt = unstable_cache(async (symbol: MarketSymbol, keyIdentity: string) => {
  void keyIdentity;
  try { return { data: await fundamentals(symbol), error: undefined }; }
  catch (error) { return { data: undefined, error: safeError(error, "Fundamentals unavailable. Check the issuer directly.") }; }
}, ["market-fundamentals-attempt-v1"], { revalidate: 900 });
const treasury = unstable_cache(async (year: number) => {
  const url = `https://home.treasury.gov/resource-center/data-chart-center/interest-rates/pages/xml?data=daily_treasury_yield_curve&field_tdr_date_value=${year}`;
  const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error("Treasury feed temporarily unavailable.");
  return parseTreasury(await response.text(), url);
}, ["treasury-rates-v1"], { revalidate: 21600 });

export async function loadMarketData(symbol?: MarketSymbol): Promise<MarketResponse> {
  const configured = Boolean(process.env.ALPHA_VANTAGE_API_KEY?.trim());
  const output: MarketResponse = { configured };
  try { output.treasury = await treasury(new Date().getUTCFullYear()); }
  catch { output.treasuryError = "Treasury feed unavailable. No replacement yield has been estimated."; }
  if (!symbol) return output;
  const result = { symbol, fetchedAt: new Date().toISOString(), messages: [] as string[], quote: undefined as Awaited<ReturnType<typeof quote>> | undefined,
    fundamentals: undefined as Awaited<ReturnType<typeof fundamentals>>["data"] | undefined };
  if (!configured) result.messages.push("Price and fundamentals need ALPHA_VANTAGE_API_KEY in Vercel. Treasury rates do not need a key.");
  else {
    const identity = createHash("sha256").update(process.env.ALPHA_VANTAGE_API_KEY ?? "").digest("hex");
    const price = await quoteAttempt(symbol, identity);
    result.quote = price.data;
    if (price.error) result.messages.push(`Price: ${price.error} Failed attempts are cached for 15 minutes.`);
    if (symbol === "NVDA" && process.env.ALPHA_VANTAGE_PREMIUM_ENABLED !== "true") {
      result.messages.push("NVDA company fundamentals: Alpha Vantage Company Overview requires Premium. This request is skipped on free keys; price quotes remain available.");
    } else {
      const snapshot = await fundamentalsAttempt(symbol, identity);
      if (snapshot.data) { result.fundamentals = snapshot.data.data; result.fetchedAt = snapshot.data.fetchedAt; }
      if (snapshot.error) result.messages.push(`Fundamentals: ${snapshot.error} Failed attempts are cached for 15 minutes.`);
    }
  }
  output.result = result;
  return output;
}
