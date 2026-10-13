"use client";

import { useState } from "react";
import { rankRecommendations, stanceLabels } from "@/lib/recommendations";
import type { InvestmentProfile, InvestmentRecommendation, InvestmentStance, ResearchItem } from "@/lib/types";

export function RecommendationsView({ items, profile, scanning, status, onRefresh, onOpen }: {
  items: ResearchItem[]; profile: InvestmentProfile; scanning: boolean; status: string;
  onRefresh: () => void; onOpen: (item: ResearchItem) => void;
}) {
  const [filter, setFilter] = useState("all");
  const ranked = rankRecommendations(items.filter(item => item.recommendation), profile);
  const actionable = ranked.filter(x => x.stance === "consider_buying" || x.stance === "accumulate");
  const visible = ranked.filter(x => filter === "all" || x.stance === filter);
  return <section className="recommendations-view">
    <div className="recommendations-heading"><div><p className="eyebrow">Your investment shortlist</p><h2>What to consider, and why</h2>
      <p>{actionable.length ? `${actionable.length} reviewed investment case(s) ready for your decision.` : "No buy-ready recommendation yet. The candidates below show the case and the checks still needed."}</p></div>
      <button className="primary-button" disabled={scanning} onClick={onRefresh}>{scanning ? "Refreshing evidence..." : "Refresh shortlist"}</button></div>
    <div className="recommendations-toolbar"><label className="field"><span>Stance</span><select value={filter} onChange={e => setFilter(e.target.value)}>
      <option value="all">All candidates</option>{Object.entries(stanceLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
      <p className="notice">{status}</p></div>
    <p className="shortlist-boundary">Ranked by evidence and profile fit, not predicted returns. Holdings review: {profile.holdingsReviewedAt || "not completed"}. Prices are sourced review inputs, not a live quote feed.</p>
    {visible.length === 0 ? <p className="empty-state">No candidates in this stance.</p> : visible.slice(0, 5).map((result, index) => {
      const item = result.item; const rec = item.recommendation;
      return <article className="recommendation-record" key={item.id}>
        <header><div><p className="eyebrow">#{index + 1} research priority · {item.assetClass}</p><h3>{rec?.symbol ? `${rec.symbol} — ` : ""}{item.title}</h3>
          <p>{rec ? `${rec.venue} · ${rec.currency}` : "Theme only; instrument not selected"}</p></div><span className={`recommendation-stance stance-${result.stance}`}>{result.label}</span></header>
        <div className="recommendation-reasons">
          <div><h4>Why this investment</h4><p>{rec?.rationale || item.thesis}</p></div>
          <div><h4>Why now / entry condition</h4><p>{rec?.entryCondition || item.whyNow}</p></div>
          <div><h4>Valuation and price</h4><p>{rec?.valuation || "Current valuation has not been established. A good theme is not proof of a good entry price."}</p>
            <p>{rec?.quote ? `${rec.quote.price} ${rec.currency} · as of ${rec.quote.asOf}${result.quoteReady ? "" : " · stale or unverified"}` : "No verified current price."}</p>
            {rec?.quote?.sourceUrl.startsWith("https://") ? <a href={rec.quote.sourceUrl} target="_blank" rel="noreferrer">Price source</a> : null}</div>
          <div><h4>Fit for you</h4><p>{item.fitNotes}</p><p>{profile.holdingsNotes || "Actual portfolio overlap, spending currency and liquidity are not yet reviewed."}</p></div>
          <div><h4>What could go wrong</h4><ul>{item.risks.map(risk => <li key={risk}>{risk}</li>)}</ul></div>
          <div><h4>What would change the view</h4><ul>{(rec?.thesisBreakers ?? item.openQuestions).map(reason => <li key={reason}>{reason}</li>)}</ul>
            {rec?.alternatives.length ? <p><strong>Compare with:</strong> {rec.alternatives.join("; ")}</p> : null}</div>
        </div>
        <details className="recommendation-evidence"><summary>{result.blockers.length} pending checks · {item.sources.length} source(s) · {item.confidence} confidence</summary>
          <ul>{result.blockers.map(blocker => <li key={blocker}>{blocker}</li>)}</ul>
          {item.sources.map(source => <p key={source.id}><a href={/^https:\/\//.test(source.url) ? source.url : undefined} target="_blank" rel="noreferrer">{source.title}</a> · {source.checkedAt}<br/>{source.claim}</p>)}</details>
        <button className="secondary-button" onClick={() => onOpen(item)}>Review investment case</button>
      </article>;
    })}
  </section>;
}

export function RecommendationEditor({ item, update }: { item: ResearchItem; update: (patch: Partial<ResearchItem>) => void }) {
  const rec: InvestmentRecommendation = item.recommendation ?? { symbol: "", venue: "", currency: "USD", stance: "watch", rationale: item.thesis,
    valuation: "", entryCondition: item.whyNow, thesisBreakers: [], alternatives: [] };
  const patch = (value: Partial<InvestmentRecommendation>) => update({ recommendation: { ...rec, ...value } });
  const lines = (value: string) => value.split("\n").map(x => x.trim()).filter(Boolean);
  return <div className="recommendation-editor"><h3>Investment recommendation</h3><div className="form-grid three">
    <label className="field"><span>Ticker / instrument</span><input value={rec.symbol} onChange={e => patch({ symbol: e.target.value.toUpperCase() })}/></label>
    <label className="field"><span>Exchange</span><input value={rec.venue} onChange={e => patch({ venue: e.target.value })}/></label>
    <label className="field"><span>Proposed stance</span><select value={rec.stance} onChange={e => patch({ stance: e.target.value as InvestmentStance })}>{Object.entries(stanceLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
  </div><div className="compact-form">
    <label className="field"><span>Quote currency</span><input value={rec.currency} onChange={e => patch({ currency: e.target.value.toUpperCase() })}/></label>
    <label className="field"><span>Why this instrument</span><textarea value={rec.rationale} onChange={e => patch({ rationale: e.target.value })}/></label>
    <label className="field"><span>Valuation / yield versus alternatives</span><textarea value={rec.valuation} onChange={e => patch({ valuation: e.target.value })}/></label>
    <label className="field"><span>Entry condition</span><textarea value={rec.entryCondition} onChange={e => patch({ entryCondition: e.target.value })}/></label>
    <label className="field"><span>Thesis breakers</span><textarea value={rec.thesisBreakers.join("\n")} onChange={e => patch({ thesisBreakers: lines(e.target.value) })}/></label>
    <label className="field"><span>Alternatives</span><textarea value={rec.alternatives.join("\n")} onChange={e => patch({ alternatives: lines(e.target.value) })}/></label>
  </div><div className="form-grid two">
    <label className="field"><span>Verified price ({rec.currency})</span><input type="number" min="0" step="any" value={rec.quote?.price ?? ""} onChange={e => patch({ quote: { price: Number(e.target.value), asOf: rec.quote?.asOf ?? "", sourceUrl: rec.quote?.sourceUrl ?? "" } })}/></label>
    <label className="field"><span>Price date</span><input type="date" value={rec.quote?.asOf ?? ""} onChange={e => patch({ quote: { price: rec.quote?.price ?? 0, sourceUrl: rec.quote?.sourceUrl ?? "", asOf: e.target.value } })}/></label>
    <label className="field"><span>Price source URL</span><input type="url" value={rec.quote?.sourceUrl ?? ""} onChange={e => patch({ quote: { price: rec.quote?.price ?? 0, asOf: rec.quote?.asOf ?? "", sourceUrl: e.target.value } })}/></label>
    <label className="field"><span>Recommendation reviewed on</span><input type="date" value={rec.reviewedAt ?? ""} onChange={e => patch({ reviewedAt: e.target.value })}/></label>
  </div></div>;
}
