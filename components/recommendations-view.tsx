"use client";

import { useState } from "react";
import { ArrowRight, RefreshCw } from "lucide-react";
import { profileFitReason, profileIsComplete } from "@/lib/profile-guidance";
import { rankRecommendations, stanceLabels } from "@/lib/recommendations";
import type { InvestmentProfile, InvestmentRecommendation, InvestmentStance, ResearchItem } from "@/lib/types";

export function RecommendationsView({ items, profile, scanning, status, onRefresh, onOpen, onProfile }: {
  items: ResearchItem[]; profile: InvestmentProfile; scanning: boolean; status: string;
  onRefresh: () => void; onOpen: (item: ResearchItem) => void; onProfile: () => void;
}) {
  const [filter, setFilter] = useState("all");
  const ranked = rankRecommendations(items.filter(item => item.recommendation), profile);
  const actionable = ranked.filter(x => x.stance === "consider_buying" || x.stance === "accumulate");
  const visible = ranked.filter(x => filter === "all" || x.stance === filter);
  return <section className="recommendations-view">
    <div className="recommendations-heading"><div><h2>Investments to consider</h2>
      <p>{actionable.length ? "Reviewed cases for your consideration. The final decision is yours." : "A starting shortlist, not a buy instruction. Each investment needs price and evidence checks."}</p></div>
      <button className="secondary-button" disabled={scanning} onClick={onRefresh}><RefreshCw size={16}/>{scanning ? "Refreshing..." : "Refresh research"}</button></div>
    {!profileIsComplete(profile) ? <div className="profile-prompt"><div><strong>First, tell me about your goals</strong><p>Complete your profile before treating these candidates as personal recommendations.</p></div><button className="primary-button" onClick={onProfile}>Complete my profile <ArrowRight size={16}/></button></div> : <p className="profile-context">{profile.goal?.replaceAll("_", " ")} · {profile.horizon} horizon · {profile.riskLevel} risk · {profile.baseCurrency} spending currency <button className="text-button" onClick={onProfile}>Edit profile</button></p>}
    <div className="recommendations-toolbar"><label className="field"><span>Stance</span><select value={filter} onChange={e => setFilter(e.target.value)}>
      <option value="all">All candidates</option>{Object.entries(stanceLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
      </div>
    {!scanning && /Saved radar run|failed/i.test(status) ? <p role="status" className="notice">{/failed/i.test(status) ? "Research refresh failed. Try again later; your saved investments are unchanged." : "Research updated. Open an investment to review the latest evidence."}</p> : null}
    {visible.length === 0 ? <p className="empty-state">No candidates in this stance.</p> : visible.slice(0, 5).map((result) => {
      const item = result.item; const rec = item.recommendation;
      return <article className="recommendation-record" key={item.id}>
        <header><div><p className="eyebrow">{item.assetClass}</p><h3>{rec?.symbol ? `${rec.symbol} · ` : ""}{item.title}</h3>
          <p>{rec ? `${rec.venue} · ${rec.currency}` : "Theme only; instrument not selected"}</p></div><span className={`recommendation-stance stance-${result.stance}`}>{result.label}</span></header>
        <p className="investment-rationale">{rec?.rationale || item.thesis}</p>
        <div className="shortlist-facts"><div><h4>Fit for you</h4><p>{profileFitReason(item, profile)}</p></div><div><h4>Main risk</h4><p>{item.risks[0] || "Risk assessment still needed."}</p></div></div>
        <footer><span>{rec?.quote ? `${rec.quote.price} ${rec.currency} · ${rec.quote.asOf}${result.quoteReady ? "" : " · needs refresh"}` : "Price not checked"}</span><button className="secondary-button" onClick={() => onOpen(item)}>View investment <ArrowRight size={16}/></button></footer>
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
