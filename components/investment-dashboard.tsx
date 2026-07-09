"use client";

import { useMemo, useState } from "react";
import { defaultProfile, sampleResearchItems } from "@/lib/sample-data";
import type { Decision, EvidenceSource, InvestmentProfile, ResearchItem, ResearchStatus } from "@/lib/types";

const statusLabels: Record<ResearchStatus, string> = {
  inbox: "Research Inbox",
  watch: "Watchlist",
  memo: "Thesis Workbench",
  decided: "Decision Journal",
  rejected: "Rejected"
};

const decisionLabels: Record<Decision, string> = {
  watch: "Watch",
  research_deeper: "Research deeper",
  exploratory_allocation: "Exploratory allocation",
  avoid: "Avoid"
};

const sourceTypeLabels: Record<EvidenceSource["sourceType"], string> = {
  issuer: "Issuer",
  filing: "Filing",
  market_data: "Market data",
  news: "News",
  analysis: "Analysis",
  regulator: "Regulator",
  other: "Other"
};

function splitCsv(value: string) {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export default function InvestmentDashboard() {
  const [profile, setProfile] = useState<InvestmentProfile>(defaultProfile);
  const [items, setItems] = useState<ResearchItem[]>(sampleResearchItems);
  const [selectedId, setSelectedId] = useState(sampleResearchItems[0]?.id ?? "");
  const [draftTitle, setDraftTitle] = useState("");
  const [draftTheme, setDraftTheme] = useState("");
  const [draftAssetClass, setDraftAssetClass] = useState("ETF");
  const [draftWhyNow, setDraftWhyNow] = useState("");
  const [sourceTitle, setSourceTitle] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceClaim, setSourceClaim] = useState("");

  const selected = items.find((item) => item.id === selectedId) ?? items[0];

  const metrics = useMemo(() => {
    const byStatus = items.reduce<Record<ResearchStatus, number>>((acc, item) => {
      acc[item.status] += 1;
      return acc;
    }, { inbox: 0, watch: 0, memo: 0, decided: 0, rejected: 0 });
    const evidenceCount = items.reduce((count, item) => count + item.sources.length, 0);
    const riskCount = items.reduce((count, item) => count + item.risks.length, 0);
    return { byStatus, evidenceCount, riskCount };
  }, [items]);

  function addResearchItem() {
    if (!draftTitle.trim()) return;
    const next: ResearchItem = {
      id: uid("research"),
      title: draftTitle.trim(),
      assetClass: draftAssetClass.trim() || "Unknown",
      theme: draftTheme.trim() || "Unclassified",
      status: "inbox",
      whyNow: draftWhyNow.trim() || "Needs evidence and timing research.",
      thesis: "Draft thesis pending. Use the agent or add evidence before decision.",
      risks: ["Evidence incomplete", "Portfolio fit not yet verified"],
      fitNotes: "Pending profile-fit analysis.",
      decision: "watch",
      confidence: "low",
      createdAt: new Date().toISOString().slice(0, 10),
      sources: []
    };
    setItems((current) => [next, ...current]);
    setSelectedId(next.id);
    setDraftTitle("");
    setDraftTheme("");
    setDraftAssetClass("ETF");
    setDraftWhyNow("");
  }

  function updateSelected(patch: Partial<ResearchItem>) {
    if (!selected) return;
    setItems((current) => current.map((item) => item.id === selected.id ? { ...item, ...patch } : item));
  }

  function addEvidence() {
    if (!selected || !sourceTitle.trim()) return;
    const nextSource: EvidenceSource = {
      id: uid("source"),
      title: sourceTitle.trim(),
      url: sourceUrl.trim() || "https://example.com/replace-with-source",
      sourceType: "analysis",
      checkedAt: new Date().toISOString().slice(0, 10),
      quality: "medium",
      claim: sourceClaim.trim() || "Claim needs to be summarized from source."
    };
    updateSelected({ sources: [...selected.sources, nextSource] });
    setSourceTitle("");
    setSourceUrl("");
    setSourceClaim("");
  }

  return (
    <main className="min-h-screen px-5 py-6 md:px-10 lg:px-12">
      <section className="mx-auto max-w-7xl space-y-8">
        <header className="rounded-[2rem] border border-line bg-panel/85 p-7 shadow-soft backdrop-blur md:p-9">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="mb-3 inline-flex rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-accent">Hermes Investment Intelligence</p>
              <h1 className="text-4xl font-semibold tracking-tight text-ink md:text-6xl">Research OS for evidence, portfolio fit, memos, and decisions.</h1>
              <p className="mt-5 text-lg leading-8 text-muted">A personal investment command layer for Idris: capture opportunities, attach evidence, test fit, draft thesis memos, and record decisions. Research support only — no trade execution.</p>
            </div>
            <div className="grid min-w-[18rem] grid-cols-2 gap-3 rounded-3xl bg-slate-50 p-4">
              <Metric label="Inbox" value={metrics.byStatus.inbox} />
              <Metric label="Watch" value={metrics.byStatus.watch} />
              <Metric label="Evidence" value={metrics.evidenceCount} />
              <Metric label="Risk flags" value={metrics.riskCount} />
            </div>
          </div>
        </header>

        <section className="grid gap-5 lg:grid-cols-[0.95fr_1.45fr]">
          <ProfileCard profile={profile} onChange={setProfile} />
          <OperatingRules />
        </section>

        <section className="grid gap-5 xl:grid-cols-[0.85fr_1.45fr_0.9fr]">
          <div className="space-y-5">
            <Panel title="Capture opportunity" subtitle="Add a theme, ticker, asset, fund, or private opportunity for research.">
              <div className="space-y-3">
                <Input label="Title" value={draftTitle} onChange={setDraftTitle} placeholder="e.g. Singapore REIT recovery basket" />
                <Input label="Theme" value={draftTheme} onChange={setDraftTheme} placeholder="e.g. Rates / income" />
                <Input label="Asset class" value={draftAssetClass} onChange={setDraftAssetClass} placeholder="ETF, stock, gold, bond, crypto..." />
                <Textarea label="Why now?" value={draftWhyNow} onChange={setDraftWhyNow} placeholder="What signal made this worth attention?" />
                <button className="focus-ring w-full rounded-2xl bg-ink px-4 py-3 font-semibold text-white transition hover:bg-slate-700" onClick={addResearchItem}>Add to Research Inbox</button>
              </div>
            </Panel>

            <Panel title="Opportunity lifecycle" subtitle="Move ideas from inbox to memo to decision.">
              <div className="space-y-2">
                {items.map((item) => (
                  <button key={item.id} onClick={() => setSelectedId(item.id)} className={`focus-ring w-full rounded-2xl border p-4 text-left transition ${selected?.id === item.id ? "border-accent bg-blue-50" : "border-line bg-white hover:border-slate-300"}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-ink">{item.title}</p>
                        <p className="mt-1 text-sm text-muted">{item.assetClass} · {item.theme}</p>
                      </div>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">{statusLabels[item.status]}</span>
                    </div>
                  </button>
                ))}
              </div>
            </Panel>
          </div>

          <div className="space-y-5">
            {selected ? <ThesisWorkbench item={selected} update={updateSelected} /> : null}
            {selected ? (
              <Panel title="Evidence Library" subtitle="Every claim should have a source, date, and quality level.">
                <div className="space-y-3">
                  <Input label="Source title" value={sourceTitle} onChange={setSourceTitle} placeholder="Issuer factsheet, 10-K, fund page..." />
                  <Input label="Source URL" value={sourceUrl} onChange={setSourceUrl} placeholder="https://" />
                  <Textarea label="Claim supported" value={sourceClaim} onChange={setSourceClaim} placeholder="What does this source prove or challenge?" />
                  <button className="focus-ring rounded-2xl bg-accent px-4 py-3 font-semibold text-white transition hover:bg-blue-700" onClick={addEvidence}>Attach evidence</button>
                </div>
                <div className="mt-5 space-y-3">
                  {selected.sources.length === 0 ? <p className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">No evidence attached yet. Do not finalize a memo without sources.</p> : selected.sources.map((source) => (
                    <div key={source.id} className="rounded-2xl border border-line bg-slate-50 p-4">
                      <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-600">
                        <span>{sourceTypeLabels[source.sourceType]}</span><span>·</span><span>{source.quality} quality</span><span>·</span><span>checked {source.checkedAt}</span>
                      </div>
                      <p className="mt-2 font-semibold text-ink">{source.title}</p>
                      <p className="mt-2 text-sm leading-6 text-muted">{source.claim}</p>
                      <a className="mt-2 inline-block break-all text-sm font-semibold text-accent" href={source.url} target="_blank" rel="noreferrer">{source.url}</a>
                    </div>
                  ))}
                </div>
              </Panel>
            ) : null}
          </div>

          <div className="space-y-5">
            {selected ? <PortfolioFit item={selected} profile={profile} /> : null}
            <FrontierRadar items={items} />
          </div>
        </section>
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-2xl bg-white p-4"><p className="text-3xl font-semibold text-ink">{value}</p><p className="mt-1 text-sm font-medium text-muted">{label}</p></div>;
}

function Panel({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return <section className="rounded-[1.75rem] border border-line bg-panel p-5 shadow-soft"><div className="mb-5"><h2 className="text-xl font-semibold text-ink">{title}</h2>{subtitle ? <p className="mt-1 text-sm leading-6 text-muted">{subtitle}</p> : null}</div>{children}</section>;
}

function Input({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  return <label className="block"><span className="mb-1 block text-sm font-semibold text-slate-700">{label}</span><input className="focus-ring w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} /></label>;
}

function Textarea({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  return <label className="block"><span className="mb-1 block text-sm font-semibold text-slate-700">{label}</span><textarea className="focus-ring min-h-24 w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm leading-6" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} /></label>;
}

function Select<T extends string>({ label, value, onChange, options }: { label: string; value: T; onChange: (value: T) => void; options: { label: string; value: T }[] }) {
  return <label className="block"><span className="mb-1 block text-sm font-semibold text-slate-700">{label}</span><select className="focus-ring w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm" value={value} onChange={(event) => onChange(event.target.value as T)}>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>;
}

function ProfileCard({ profile, onChange }: { profile: InvestmentProfile; onChange: (profile: InvestmentProfile) => void }) {
  return <Panel title="Investment Profile" subtitle="Personal constraints the agent must respect before suggesting research directions.">
    <div className="grid gap-3 md:grid-cols-2">
      <Select label="Risk level" value={profile.riskLevel} onChange={(riskLevel) => onChange({ ...profile, riskLevel })} options={["low", "moderate", "balanced", "high", "barbell"].map((value) => ({ label: value, value: value as InvestmentProfile["riskLevel"] }))} />
      <Select label="Time horizon" value={profile.horizon} onChange={(horizon) => onChange({ ...profile, horizon })} options={["0-1y", "1-3y", "3-7y", "7y+"].map((value) => ({ label: value, value: value as InvestmentProfile["horizon"] }))} />
      <Input label="Geography" value={profile.geography} onChange={(geography) => onChange({ ...profile, geography })} />
      <Input label="Preferred assets" value={profile.preferredAssets.join(", ")} onChange={(value) => onChange({ ...profile, preferredAssets: splitCsv(value) })} />
    </div>
    <div className="mt-3 grid gap-3 md:grid-cols-2">
      <Textarea label="Liquidity needs" value={profile.liquidityNeed} onChange={(liquidityNeed) => onChange({ ...profile, liquidityNeed })} />
      <Textarea label="Exclusions / notes" value={profile.excludedAssets} onChange={(excludedAssets) => onChange({ ...profile, excludedAssets })} />
    </div>
  </Panel>;
}

function OperatingRules() {
  return <Panel title="Operating Rules" subtitle="Guardrails for a trusted investment research OS.">
    <div className="grid gap-3 md:grid-cols-2">
      {["Research support only — not licensed financial advice.", "No broker connection or trade execution in this MVP.", "Every memo must show facts, assumptions, risks, and sources.", "Investment decisions remain human-owned and approval-gated.", "Agent outputs start as drafts awaiting review.", "Never store credentials, account numbers, seed phrases, or private keys."].map((rule) => <div key={rule} className="rounded-2xl border border-line bg-slate-50 p-4 text-sm font-medium leading-6 text-slate-700">{rule}</div>)}
    </div>
  </Panel>;
}

function ThesisWorkbench({ item, update }: { item: ResearchItem; update: (patch: Partial<ResearchItem>) => void }) {
  return <Panel title="Thesis Workbench" subtitle="Structured memo draft for the selected opportunity.">
    <div className="grid gap-3 md:grid-cols-3">
      <Select label="Lifecycle" value={item.status} onChange={(status) => update({ status })} options={(Object.keys(statusLabels) as ResearchStatus[]).map((value) => ({ value, label: statusLabels[value] }))} />
      <Select label="Decision option" value={item.decision} onChange={(decision) => update({ decision })} options={(Object.keys(decisionLabels) as Decision[]).map((value) => ({ value, label: decisionLabels[value] }))} />
      <Select label="Confidence" value={item.confidence} onChange={(confidence) => update({ confidence })} options={["low", "medium", "high"].map((value) => ({ value: value as ResearchItem["confidence"], label: value }))} />
    </div>
    <div className="mt-4 space-y-3">
      <Input label="Title" value={item.title} onChange={(title) => update({ title })} />
      <Textarea label="Why this may matter now" value={item.whyNow} onChange={(whyNow) => update({ whyNow })} />
      <Textarea label="Thesis" value={item.thesis} onChange={(thesis) => update({ thesis })} />
      <Textarea label="Key risks" value={item.risks.join("\n")} onChange={(value) => update({ risks: value.split("\n").map((risk) => risk.trim()).filter(Boolean) })} />
      <Textarea label="Portfolio fit notes" value={item.fitNotes} onChange={(fitNotes) => update({ fitNotes })} />
    </div>
  </Panel>;
}

function PortfolioFit({ item, profile }: { item: ResearchItem; profile: InvestmentProfile }) {
  const riskMatch = profile.riskLevel === "low" && ["Crypto", "Private", "Crowdfunding"].some((term) => item.assetClass.toLowerCase().includes(term.toLowerCase())) ? "Weak" : "Needs review";
  return <Panel title="Portfolio Fit" subtitle="Early qualitative fit check before deeper analysis.">
    <div className="space-y-3 text-sm leading-6">
      <FitRow label="Risk profile" value={profile.riskLevel} />
      <FitRow label="Time horizon" value={profile.horizon} />
      <FitRow label="Asset class" value={item.assetClass} />
      <FitRow label="Initial fit" value={riskMatch} />
      <div className="rounded-2xl bg-blue-50 p-4 text-blue-950"><p className="font-semibold">Fit interpretation</p><p className="mt-1">{item.fitNotes}</p></div>
      <div className="rounded-2xl bg-amber-50 p-4 text-amber-950"><p className="font-semibold">Before action</p><p className="mt-1">Check concentration, liquidity, currency exposure, fees, and downside scenario. Do not execute trades from this app.</p></div>
    </div>
  </Panel>;
}

function FitRow({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between gap-4 rounded-2xl border border-line bg-white p-3"><span className="font-semibold text-slate-600">{label}</span><span className="text-right font-semibold text-ink">{value}</span></div>;
}

function FrontierRadar({ items }: { items: ResearchItem[] }) {
  const themes = Array.from(new Set(items.map((item) => item.theme))).slice(0, 6);
  return <Panel title="Frontier Radar" subtitle="Themes currently worth watching. Later this becomes an agent-generated scan.">
    <div className="space-y-3">
      {themes.map((theme) => <div key={theme} className="rounded-2xl border border-line bg-white p-4"><p className="font-semibold text-ink">{theme}</p><p className="mt-1 text-sm leading-6 text-muted">Track source density, valuation context, momentum, and relevance to Idris&apos; profile.</p></div>)}
    </div>
  </Panel>;
}
