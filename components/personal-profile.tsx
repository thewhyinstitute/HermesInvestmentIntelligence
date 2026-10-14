"use client";
import { useState } from "react";
import type { InvestmentProfile } from "@/lib/types";

export function PersonalProfile({ profile, onSave }: { profile: InvestmentProfile; onSave: (profile: InvestmentProfile) => void }) {
  const [draft, setDraft] = useState({ base: profile, value: profile });
  const value = draft.base === profile ? draft.value : profile;
  const [message, setMessage] = useState("");
  const patch = (changes: Partial<InvestmentProfile>) => { setDraft({ base: profile, value: { ...value, ...changes } }); setMessage(""); };
  function save(event: React.FormEvent) {
    event.preventDefault();
    onSave({ ...value, profileCompletedAt: new Date().toISOString().slice(0, 10) });
    setMessage("Profile saved.");
  }
  return <section className="personal-profile"><header className="page-heading"><h2>My investment profile</h2><p>Your goals and constraints. Holdings can be added later.</p></header>
    <form onSubmit={save}>
      <div className="profile-form-grid">
        <label className="field"><span>What are you investing for?</span><select required value={value.goal ?? ""} onChange={e => patch({ goal: e.target.value as InvestmentProfile["goal"] })}><option value="" disabled>Choose a goal</option><option value="growth">Long-term growth</option><option value="income">Regular income</option><option value="preserve_capital">Preserve capital</option><option value="diversification">Diversify my investments</option></select></label>
        <label className="field"><span>When might you need this money?</span><select value={value.horizon} onChange={e => patch({ horizon: e.target.value as InvestmentProfile["horizon"] })}><option value="0-1y">Within a year</option><option value="1-3y">1 to 3 years</option><option value="3-7y">3 to 7 years</option><option value="7y+">More than 7 years</option></select></label>
        <label className="field"><span>Amount you are considering investing</span><input required type="number" min="1" step="any" value={value.investmentBudget ?? ""} onChange={e => patch({ investmentBudget: e.target.value ? Number(e.target.value) : undefined })}/></label>
        <label className="field"><span>Your spending currency</span><select required value={value.baseCurrency ?? ""} onChange={e => patch({ baseCurrency: e.target.value })}><option value="" disabled>Choose a currency</option>{["SGD", "USD", "EUR", "GBP", "TRY", "AUD", "CAD", "JPY", "CHF"].map(currency => <option key={currency}>{currency}</option>)}</select></label>
        <label className="field"><span>How much investment risk are you comfortable with?</span><select value={value.riskLevel} onChange={e => patch({ riskLevel: e.target.value as InvestmentProfile["riskLevel"] })}><option value="low">Low: prioritize stability</option><option value="moderate">Moderate: some fluctuations</option><option value="balanced">Balanced: accept meaningful fluctuations</option><option value="high">High: accept large drawdowns</option><option value="barbell">Mixed: stable core and higher-risk positions</option></select></label>
        <label className="field"><span>Your investing experience</span><select required value={value.experience ?? ""} onChange={e => patch({ experience: e.target.value as InvestmentProfile["experience"] })}><option value="" disabled>Choose your experience</option><option value="beginner">New to investing</option><option value="some">Some experience</option><option value="experienced">Experienced</option></select></label>
        <label className="field profile-wide"><span>Cash you need to keep available, and upcoming expenses</span><textarea required value={value.liquidityNeed} onChange={e => patch({ liquidityNeed: e.target.value })} rows={3}/></label>
        <label className="field"><span>Markets or regions you can invest in</span><input value={value.geography} onChange={e => patch({ geography: e.target.value })}/></label>
        <label className="field"><span>Investments you want to exclude</span><input value={value.excludedAssets} onChange={e => patch({ excludedAssets: e.target.value })}/></label>
      </div>
      <details className="profile-extras"><summary>Preferences and existing holdings (optional)</summary>
        <label className="field"><span>Preferred types of investment, separated by commas</span><input value={value.preferredAssets.join(", ")} onChange={e => patch({ preferredAssets: e.target.value.split(",").map(x => x.trim()).filter(Boolean) })}/></label>
        <label className="field"><span>Existing holdings and concentration notes</span><textarea rows={3} value={value.holdingsNotes ?? ""} onChange={e => patch({ holdingsNotes: e.target.value })}/></label>
        <label className="field"><span>Holdings last reviewed</span><input type="date" value={value.holdingsReviewedAt ?? ""} onChange={e => patch({ holdingsReviewedAt: e.target.value })}/></label>
      </details><div className="button-row"><button className="primary-button" type="submit">Save my profile</button><span role="status">{message}</span></div>
    </form>
  </section>;
}
