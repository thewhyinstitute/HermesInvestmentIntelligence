"use client";
import { useState } from "react";
import { buildDecisionBrief, captureDecisionBrief, compareBriefs, defaultBriefAssumptions } from "@/lib/decision-brief";
import { isBriefAssumptions } from "@/lib/brief-validation";
import type { MarketResponse } from "@/lib/market-data";
import type { BriefAssumptions, InvestmentProfile, ResearchItem } from "@/lib/types";
import { AIReviewPanel } from "./ai-review";
import { supportedSymbols, type MarketSymbol } from "@/lib/market-data";

export function DecisionBrief({ item, profile, market, onSave }: { item: ResearchItem; profile: InvestmentProfile; market?: MarketResponse; onSave: (item: ResearchItem) => void }) {
  const [draft, setDraft] = useState({ base: item.briefAssumptions, value: item.briefAssumptions ?? defaultBriefAssumptions });
  const assumptions = draft.base === item.briefAssumptions ? draft.value : item.briefAssumptions ?? defaultBriefAssumptions;
  const [notice, setNotice] = useState("");
  const currency = item.recommendation?.currency || "USD";
  const history = item.briefHistory ?? [];
  const usingSaved = !market?.result && !!history[0]?.marketData?.result;
  const data = market?.result ? market : history[0]?.marketData ? { ...history[0].marketData, ...market, result: history[0].marketData.result } : market;
  const brief = buildDecisionBrief(item, profile, assumptions, data);
  const valid = isBriefAssumptions(assumptions);
  const changes = history[0] && item.recommendation && valid ? compareBriefs(history[0], captureDecisionBrief(item, profile, assumptions, data)) : [];
  function save() {
    if (!valid) return;
    const snapshot = captureDecisionBrief(item, profile, assumptions, data);
    onSave({ ...item, briefAssumptions: { ...assumptions }, briefHistory: [snapshot, ...history].slice(0, 30) });
    setNotice("Brief saved in this browser workspace and included in exports.");
  }
  const fields: { key: keyof BriefAssumptions; label: string; min: number; max?: number }[] = [
    { key: "entryPrice", label: `Assumed entry price (${currency}; blank uses dated quote)`, min: 0.01 },
    { key: "years", label: "Years held", min: 0.1 },
    { key: "bearPrice", label: `Bear ending price (${currency})`, min: 0 },
    { key: "basePrice", label: `Base ending price (${currency})`, min: 0 },
    { key: "bullPrice", label: `Bull ending price (${currency})`, min: 0 },
    { key: "annualCash", label: `Annual cash per share (${currency})`, min: 0 },
    { key: "requiredAnnualReturn", label: "Required annual return (%)", min: 0 },
    { key: "maxBearLoss", label: "Maximum bear-case loss (%)", min: 0, max: 100 },
  ];
  return <div className="decision-brief" aria-label={`${item.recommendation?.symbol} decision brief`}>
    <h4>Decision brief</h4><p><strong>{brief.conclusion}</strong></p>
    <p>Rule-based research assessment. No AI forecast, allocation recommendation or trade instruction.</p>
    <p><strong>Portfolio fit:</strong> {brief.portfolioFit}</p>
    {item.recommendation && supportedSymbols.includes(item.recommendation.symbol as MarketSymbol) && <AIReviewPanel input={{
      symbol: item.recommendation.symbol as MarketSymbol, thesis: item.recommendation.rationale || item.thesis,
      entryCondition: brief.conditions, facts: brief.facts, gaps: brief.gaps, risks: item.risks,
      scenarios: brief.scenarios.map(s => `${s.name}: assumed ending price ${s.terminal ?? "not set"}; total return ${s.returns?.total ?? "not calculated"}; annualized equivalent ${s.returns?.annualized ?? "not calculated"}. User assumptions, not forecasts.`),
      sources: item.sources.filter(source => source.url.startsWith("https://")).slice(0, 12).map(source => ({ id: source.id, title: source.title, url: source.url, claim: `${source.checkedAt}: ${source.claim}` })),
    }}/>}
    {usingSaved && <p className="notice">Using saved instrument inputs from {history[0].capturedAt.slice(0, 10)}; freshness is checked again today.</p>}
    <details><summary>Facts, scenarios and pending checks</summary>
      <h4>Why this view</h4><ul>{brief.reasons.map((reason, i) => <li key={i}>{reason}</li>)}</ul>
      <h4>Dated facts</h4>{brief.facts.length ? <ul>{brief.facts.map((fact, i) => <li key={i}>{fact}</li>)}</ul> : <p>No verified market facts available yet.</p>}
      {brief.quote?.sourceUrl.startsWith("https://") && <p><a href={brief.quote.sourceUrl} target="_blank" rel="noreferrer">Dated price source</a></p>}
      {data?.result?.fundamentals?.sourceUrl.startsWith("https://") && <p><a href={data.result.fundamentals.sourceUrl} target="_blank" rel="noreferrer">Fundamentals source</a></p>}
      <p><strong>Entry condition:</strong> {brief.conditions}</p>
      <h4>Your scenario assumptions</h4><div className="form-grid two">{fields.map(field => <label className="field" key={field.key}><span>{field.label}</span>
        <input type="number" min={field.min} max={field.max} step="any" value={assumptions[field.key] ?? ""} onChange={event => {
          const value = event.target.value === "" ? undefined : Number(event.target.value);
          setDraft({ base: item.briefAssumptions, value: { ...assumptions, [field.key]: value } }); setNotice("");
        }}/></label>)}</div>
      {!valid && <p className="notice">Enter valid positive duration, nonnegative cash and prices, and a loss limit between 0 and 100.</p>}
      <div className="scenario-results">{brief.scenarios.map(scenario => <div key={scenario.name}><h4>{scenario.name}</h4><p>{scenario.returns ? `${(scenario.returns.total * 100).toFixed(2)}% total · ${(scenario.returns.annualized * 100).toFixed(2)}% annualized equivalent` : "Incomplete scenario"}</p></div>)}</div>
      <p>User assumptions, not probabilities or forecasts. Cash is not reinvested; annualized equivalent is not IRR. Excludes tax, dealing costs and currency changes.</p>
      <h4>Pending checks</h4>{brief.gaps.length ? <ul>{brief.gaps.map(gap => <li key={gap}>{gap}</li>)}</ul> : <p>No listed checks outstanding. You still own the decision.</p>}
      <button className="secondary-button" disabled={!valid} onClick={save}>Save dated brief</button><p role="status">{notice}</p>
    </details>
    {history.length > 0 && <details><summary>{history.length} saved brief(s) · {changes.length} change(s) since latest</summary>
      <h4>Changes since latest saved brief</h4>{changes.length ? <ul>{changes.map(change => <li key={change}>{change}</li>)}</ul> : <p>No tracked changes detected.</p>}
      {history.map((snapshot, index) => <details key={snapshot.id}><summary>{snapshot.capturedAt} · {snapshot.conclusion}</summary>
        <p>Archived assessment; not a current recommendation.</p><ul>{snapshot.facts.map((fact, i) => <li key={i}>{fact}</li>)}</ul>
        <p><strong>Saved thesis:</strong> {snapshot.thesis}</p>
        <ul>{snapshot.reasons.map((reason, i) => <li key={i}>{reason}</li>)}</ul>
        <p><strong>Saved entry condition:</strong> {snapshot.recommendation.entryCondition}</p>
        <ul>{snapshot.risks.map((risk, i) => <li key={i}>{risk}</li>)}</ul>
        <p>Years: {snapshot.assumptions.years}; bear/base/bull ending prices: {snapshot.assumptions.bearPrice ?? "unset"} / {snapshot.assumptions.basePrice ?? "unset"} / {snapshot.assumptions.bullPrice ?? "unset"}.</p>
        {history[index + 1] && <ul>{compareBriefs(history[index + 1], snapshot).map(change => <li key={change}>{change}</li>)}</ul>}
        <ul>{snapshot.gaps.map(gap => <li key={gap}>{gap}</li>)}</ul>
        {snapshot.sources.map(source => <p key={source.id}><a href={source.url.startsWith("https://") ? source.url : undefined} target="_blank" rel="noreferrer">{source.title}</a> · {source.checkedAt}</p>)}
      </details>)}
    </details>}
  </div>;
}
