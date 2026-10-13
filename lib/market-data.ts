import { XMLParser } from "fast-xml-parser";

export const supportedSymbols = ["QQQM", "GRID", "IAU", "SGOV", "NVDA"] as const;
export type MarketSymbol = typeof supportedSymbols[number];
export interface DatedQuote { price: number; asOf: string; sourceUrl: string }
export interface Fundamentals {
  kind: "company" | "etf";
  periodEnd?: string;
  eps?: number;
  providerPE?: number;
  expenseRatio?: number;
  holdings: { symbol: string; weight: number }[];
  sourceUrl: string;
}
export interface MarketResult {
  symbol: MarketSymbol;
  fetchedAt: string;
  quote?: DatedQuote;
  fundamentals?: Fundamentals;
  messages: string[];
}
export interface TreasuryRates {
  asOf: string; threeMonth?: number; twoYear?: number; tenYear?: number; sourceUrl: string;
}
export interface MarketResponse {
  configured: boolean; result?: MarketResult; treasury?: TreasuryRates; treasuryError?: string;
}

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
export function finiteNumber(value: unknown): number | undefined {
  if (typeof value !== "number" && typeof value !== "string") return undefined;
  if (typeof value === "string" && (!value.trim() || !/^-?\d+(\.\d+)?$/.test(value.trim()))) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}
export function validDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
export function freshness(asOf: string | undefined, days: number, now = new Date()): "fresh" | "stale" | "undated" {
  if (!validDate(asOf)) return "undated";
  const age = now.getTime() - Date.parse(asOf);
  return age >= 0 && age <= days * 86400000 ? "fresh" : "stale";
}
export function providerError(payload: unknown): string | undefined {
  const data = object(payload);
  if (data.Note || data.Information) return "Provider limit or subscription restriction. Try later or check your data plan.";
  if (data["Error Message"]) return "Provider could not return this instrument.";
}
export function parseQuote(payload: unknown, symbol: MarketSymbol): DatedQuote {
  const error = providerError(payload);
  if (error) throw new Error(error);
  const quote = object(object(payload)["Global Quote"]);
  const price = finiteNumber(quote["05. price"]);
  const date = quote["07. latest trading day"];
  if (quote["01. symbol"] !== symbol || price === undefined || price <= 0 || !validDate(date)) throw new Error("No valid dated quote returned.");
  return { price, asOf: date, sourceUrl: `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}` };
}
export function parseFundamentals(payload: unknown, symbol: MarketSymbol): Fundamentals {
  const error = providerError(payload);
  if (error) throw new Error(error);
  const data = object(payload);
  if (symbol === "NVDA") {
    if (data.Symbol !== symbol) throw new Error("Company fundamentals unavailable.");
    return { kind: "company", eps: finiteNumber(data.EPS), providerPE: finiteNumber(data.PERatio),
      periodEnd: validDate(data.LatestQuarter) ? data.LatestQuarter : undefined, holdings: [],
      sourceUrl: `https://www.alphavantage.co/query?function=OVERVIEW&symbol=${symbol}` };
  }
  const ratio = finiteNumber(data.net_expense_ratio);
  if (ratio === undefined || ratio < 0 || ratio > 1) throw new Error("ETF profile unavailable.");
  const holdings = (Array.isArray(data.holdings) ? data.holdings : []).flatMap(raw => {
    const row = object(raw); const weight = finiteNumber(row.weight);
    return typeof row.symbol === "string" && weight !== undefined && weight >= 0 && weight <= 1
      ? [{ symbol: row.symbol, weight }] : [];
  }).slice(0, 10);
  return { kind: "etf", expenseRatio: ratio, holdings,
    sourceUrl: `https://www.alphavantage.co/query?function=ETF_PROFILE&symbol=${symbol}` };
}
export function parseTreasury(xml: string, sourceUrl: string, now = new Date()): TreasuryRates {
  const parsed = new XMLParser({ removeNSPrefix: true, ignoreAttributes: true }).parse(xml);
  const entries = parsed?.feed?.entry;
  const rows = (Array.isArray(entries) ? entries : entries ? [entries] : []).flatMap(entry => {
    const row = entry?.content?.properties;
    const date = typeof row?.NEW_DATE === "string" ? row.NEW_DATE.slice(0, 10) : "";
    if (!validDate(date) || Date.parse(date) > now.getTime()) return [];
    return [{ asOf: date, threeMonth: finiteNumber(row.BC_3MONTH), twoYear: finiteNumber(row.BC_2YEAR),
      tenYear: finiteNumber(row.BC_10YEAR), sourceUrl }];
  }).filter(row => row.threeMonth !== undefined || row.twoYear !== undefined || row.tenYear !== undefined)
    .sort((a, b) => b.asOf.localeCompare(a.asOf));
  if (!rows.length) throw new Error("No dated Treasury rates returned.");
  return rows[0];
}
export function priceEarnings(price: number | undefined, eps: number | undefined): number | undefined {
  const ratio = price !== undefined && price > 0 && eps !== undefined && eps > 0 ? price / eps : NaN;
  return Number.isFinite(ratio) ? ratio : undefined;
}
export function scenarioReturn(price: number, terminalPrice: number, years: number, annualCash: number) {
  if (![price, terminalPrice, years, annualCash].every(Number.isFinite) || price <= 0 || terminalPrice < 0 || years <= 0 || annualCash < 0) return undefined;
  const finalValue = terminalPrice + annualCash * years;
  if (!Number.isFinite(finalValue)) return undefined;
  const total = finalValue / price - 1;
  const annualized = Math.pow(finalValue / price, 1 / years) - 1;
  return Number.isFinite(total) && Number.isFinite(annualized) ? { total, annualized } : undefined;
}
