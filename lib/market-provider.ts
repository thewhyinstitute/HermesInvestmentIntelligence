import { unstable_cache } from "next/cache";
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
    try { result.quote = await quote(symbol); } catch (error) { result.messages.push(error instanceof Error && error.message.includes("Provider") ? error.message : "Dated price unavailable. Try later."); }
    try { const snapshot = await fundamentals(symbol); result.fundamentals = snapshot.data; result.fetchedAt = snapshot.fetchedAt; } catch (error) { result.messages.push(error instanceof Error && error.message.includes("Provider") ? error.message : "Fundamentals unavailable. Check the issuer directly."); }
  }
  output.result = result;
  return output;
}
