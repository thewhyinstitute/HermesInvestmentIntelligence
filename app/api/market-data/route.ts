import { NextResponse } from "next/server";
import { supportedSymbols, type MarketSymbol } from "@/lib/market-data";
import { loadMarketData } from "@/lib/market-provider";

export const maxDuration = 60;
export async function GET(request: Request) {
  const symbol = new URL(request.url).searchParams.get("symbol")?.toUpperCase();
  if (symbol && !supportedSymbols.includes(symbol as MarketSymbol)) return NextResponse.json({ error: "Unsupported instrument." }, { status: 400 });
  return NextResponse.json(await loadMarketData(symbol as MarketSymbol | undefined), { headers: { "Cache-Control": "private, no-store" } });
}
