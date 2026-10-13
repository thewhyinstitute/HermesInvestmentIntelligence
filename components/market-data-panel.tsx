"use client";

import { useEffect, useState } from "react";
import { freshness, priceEarnings, scenarioReturn, supportedSymbols, type MarketResponse, type MarketResult, type MarketSymbol } from "@/lib/market-data";
import type { ResearchItem } from "@/lib/types";

const pct = (value: number) => `${(value * 100).toFixed(2)}%`;
export function MarketDataPanel({ items, onOpen }: { items: ResearchItem[]; onOpen: (item: ResearchItem) => void }) {
  const [symbol, setSymbol] = useState<MarketSymbol>("NVDA");
  const [data, setData] = useState<MarketResponse>();
  const [records, setRecords] = useState<Partial<Record<MarketSymbol, MarketResult>>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/market-data", { signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error();
      setData(await response.json());
    }).catch(() => { if (!controller.signal.aborted) setError("Market data connection unavailable."); });
    return () => controller.abort();
  }, []);
  async function refresh() {
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/market-data?symbol=${symbol}`);
      if (!response.ok) throw new Error();
      const next: MarketResponse = await response.json();
      setData(next);
      if (next.result) { const result = next.result; setRecords(current => ({ ...current, [result.symbol]: result })); }
    } catch { setError("Refresh failed. Previously fetched values remain dated below."); }
    finally { setBusy(false); }
  }
  const result = records[symbol];
  const fund = result?.fundamentals;
  const pe = priceEarnings(result?.quote?.price, fund?.eps);
  const candidate = items.find(item => item.recommendation?.symbol === symbol);
  function useQuote() {
    if (!candidate?.recommendation || !result?.quote) return;
    const source = { id: `quote-${symbol}-${result.quote.asOf}`, title: `${symbol} end-of-day price`, url: result.quote.sourceUrl,
      sourceType: "market_data" as const, quality: "high" as const, checkedAt: result.quote.asOf, claim: `USD ${result.quote.price} on ${result.quote.asOf}. End-of-day quote, not a real-time execution price.` };
    onOpen({ ...candidate, recommendation: { ...candidate.recommendation, quote: result.quote, reviewedAt: undefined },
      sources: [...candidate.sources.filter(item => item.id !== source.id), source] });
  }
  return <section className="market-data-section" aria-label="Market data">
    <details><summary className="market-panel-summary">Market facts and return scenarios</summary>
    <div className="market-controls"><label className="field"><span>Instrument</span><select value={symbol} onChange={event => setSymbol(event.target.value as MarketSymbol)}>{supportedSymbols.map(value => <option key={value}>{value}</option>)}</select></label>
      <button className="secondary-button" onClick={refresh} disabled={busy}>{busy ? "Fetching..." : "Fetch market data"}</button></div>
    <div aria-live="polite">{error && <p className="notice">{error}</p>}
      {data?.configured === false && <p className="notice">Prices and fundamentals are not connected. Add ALPHA_VANTAGE_API_KEY to the Vercel project; no AI key is needed.</p>}
      {data?.configured !== false && result?.messages.map(message => <p className="notice" key={message}>{message}</p>)}</div>
    {result && <div className="market-facts-grid">
      <div><h4>{symbol} end-of-day price</h4><p>{result.quote ? `$${result.quote.price.toFixed(2)} · ${result.quote.asOf} · ${freshness(result.quote.asOf, 4)}` : "Unavailable"}</p>
        {result.quote && <a href="https://www.alphavantage.co/documentation/#latestprice" target="_blank" rel="noreferrer">Alpha Vantage quote feed</a>}
        {candidate && result.quote && <button className="secondary-button" disabled={freshness(result.quote.asOf, 4) !== "fresh"} onClick={useQuote}>Use price in investment case</button>}</div>
      <div><h4>{symbol === "NVDA" ? "Company valuation inputs" : "ETF structure"}</h4>
        {!fund ? <p>Unavailable</p> : fund.kind === "company" ? <>
          <p>Provider EPS: {fund.eps === undefined ? "unavailable" : `$${fund.eps.toFixed(2)}`} · latest reported quarter: {fund.periodEnd ?? "undated"}</p>
          <p>Price / provider EPS: {pe === undefined ? "not meaningful or unavailable" : `${pe.toFixed(1)}×`}</p>
          <p>Provider P/E: {fund.providerPE === undefined ? "unavailable" : `${fund.providerPE.toFixed(1)}×`}</p>
          <p>Overview snapshot fetched {result.fetchedAt.slice(0, 10)}. Earnings and multiples are not independently verified; period freshness: {freshness(fund.periodEnd, 135)}.</p>
        </> : <><p>Net expense ratio: {fund.expenseRatio === undefined ? "unavailable" : pct(fund.expenseRatio)}</p>
          <p>Holdings snapshot is undated; verify with the issuer before relying on weights.</p>
          {fund.holdings.length ? <ul>{fund.holdings.map((holding, i) => <li key={`${holding.symbol}-${i}`}>{holding.symbol} · {pct(holding.weight)}</li>)}</ul> : <p>Holdings unavailable.</p>}</>}
        {fund && <a href="https://www.alphavantage.co/documentation/#fundamentals" target="_blank" rel="noreferrer">Provider documentation</a>}</div>
    </div>}
    <div className="treasury-rates"><h4>US Treasury benchmark yields</h4>
      {data?.treasury ? <><p>{data.treasury.asOf} · {freshness(data.treasury.asOf, 7)} · annual percentage yields</p>
        <dl>{[["3 month", data.treasury.threeMonth], ["2 year", data.treasury.twoYear], ["10 year", data.treasury.tenYear]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{typeof value === "number" ? `${value.toFixed(2)}%` : "Unavailable"}</dd></div>)}</dl>
        <a href={data.treasury.sourceUrl} target="_blank" rel="noreferrer">US Treasury source</a><p>Par yield curve benchmarks, not SGOV&apos;s distribution yield or a guaranteed return.</p></> : <p>{data?.treasuryError ?? "Loading Treasury rates..."}</p>}
    </div>
    <ScenarioCalculator key={symbol} symbol={symbol} price={result?.quote?.price}/>
    </details>
  </section>;
}

function ScenarioCalculator({ symbol, price }: { symbol: string; price?: number }) {
  const [entry, setEntry] = useState(""); const [terminal, setTerminal] = useState("");
  const [years, setYears] = useState("3"); const [cash, setCash] = useState("0");
  const effectivePrice = entry === "" ? price : Number(entry);
  const result = terminal.trim() && effectivePrice !== undefined ? scenarioReturn(effectivePrice, Number(terminal), Number(years), Number(cash)) : undefined;
  return <details className="scenario-calculator"><summary>{symbol} return scenario</summary>
    <div className="form-grid two">
      <label className="field"><span>Entry price (USD)</span><input type="number" min="0.01" step="any" placeholder={price?.toFixed(2) ?? ""} value={entry} onChange={event => setEntry(event.target.value)}/></label>
      <label className="field"><span>Assumed ending price (USD)</span><input type="number" min="0" step="any" value={terminal} onChange={event => setTerminal(event.target.value)}/></label>
      <label className="field"><span>Years held</span><input type="number" min="0.1" step="0.1" value={years} onChange={event => setYears(event.target.value)}/></label>
      <label className="field"><span>Assumed annual cash per share (USD)</span><input type="number" min="0" step="any" value={cash} onChange={event => setCash(event.target.value)}/></label>
    </div><p>{result ? `Scenario total return: ${pct(result.total)} · annualized equivalent: ${pct(result.annualized)}` : "No valid scenario calculated."}</p>
    <p>Your assumptions, not a forecast. Cash is accumulated without reinvestment; annualized equivalent is not IRR. Excludes tax, dealing costs and currency changes.</p>
  </details>;
}
