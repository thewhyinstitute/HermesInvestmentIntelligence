import type { BriefAssumptions } from "./types";
import { supportedSymbols } from "./market-data";

type Row = Record<string, unknown>;
const record = (v: unknown): v is Row => !!v && typeof v === "object" && !Array.isArray(v);
const number = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const text = (v: unknown): v is string => typeof v === "string";
const optional = (v: unknown, predicate: (v: unknown) => boolean) => v === undefined || predicate(v);
const nonnegative = (v: unknown) => number(v) && v >= 0;
const quote = (v: unknown) => record(v) && number(v.price) && v.price > 0 && text(v.asOf) && text(v.sourceUrl) && v.sourceUrl.startsWith("https://");

export function isBriefAssumptions(v: unknown): v is BriefAssumptions {
  return record(v) && number(v.years) && v.years > 0 && nonnegative(v.annualCash)
    && optional(v.entryPrice, value => number(value) && value > 0)
    && ["bearPrice", "basePrice", "bullPrice", "requiredAnnualReturn"].every(key => optional(v[key], nonnegative))
    && optional(v.maxBearLoss, value => nonnegative(value) && (value as number) <= 100);
}
export function isBriefMarketData(v: unknown): boolean {
  if (!record(v) || typeof v.configured !== "boolean" || !optional(v.treasuryError, text)) return false;
  if (v.treasury !== undefined && (!record(v.treasury) || !text(v.treasury.asOf) || !text(v.treasury.sourceUrl)
    || !["threeMonth", "twoYear", "tenYear"].every(key => optional((v.treasury as Row)[key], number)))) return false;
  if (v.result === undefined) return true;
  const result = v.result;
  if (!record(result) || !supportedSymbols.includes(result.symbol as typeof supportedSymbols[number]) || !text(result.fetchedAt)
    || !Array.isArray(result.messages) || !result.messages.every(text) || !optional(result.quote, quote)) return false;
  const fund = result.fundamentals;
  return fund === undefined || (record(fund) && ["company", "etf"].includes(String(fund.kind)) && text(fund.sourceUrl)
    && optional(fund.periodEnd, text) && ["eps", "providerPE", "expenseRatio"].every(key => optional(fund[key], number))
    && Array.isArray(fund.holdings) && fund.holdings.every(h => record(h) && text(h.symbol) && number(h.weight) && h.weight >= 0 && h.weight <= 1));
}
