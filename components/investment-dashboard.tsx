"use client";

import { useEffect, useMemo, useState } from "react";
import { defaultProfile, sampleResearchItems } from "@/lib/sample-data";
import {
  createInitialInvestmentState,
  deserializeInvestmentState,
  INVESTMENT_STORAGE_KEY,
  LEGACY_INVESTMENT_STORAGE_KEY,
  serializeInvestmentState,
  updateStateMetadata,
} from "@/lib/storage";
import {
  createAgentDraftFromRequest,
  createDecisionSnapshot,
  createRadarSignal,
  createResearchRequest,
  scorePortfolioFit,
} from "@/lib/workflows";
import type { AgentResearchRequest, Decision, EvidenceSource, FrontierRadarSignal, InvestmentAppState, InvestmentProfile, ResearchItem, ResearchStatus } from "@/lib/types";

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

function splitLines(value: string) {
  return value.split("\n").map((item) => item.trim()).filter(Boolean);
}

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default function InvestmentDashboard() {
  const initialState = useMemo(() => createInitialInvestmentState(defaultProfile, sampleResearchItems), []);
  const [profile, setProfile] = useState<InvestmentProfile>(initialState.profile);
  const [items, setItems] = useState<ResearchItem[]>(initialState.researchItems);
  const [selectedId, setSelectedId] = useState(initialState.selectedResearchId);
  const [agentInbox, setAgentInbox] = useState<AgentResearchRequest[]>(initialState.agentInbox);
  const [radarSignals, setRadarSignals] = useState<FrontierRadarSignal[]>(initialState.radarSignals);
  const [sync, setSync] = useState(initialState.sync);
  const [lastSavedAt, setLastSavedAt] = useState(initialState.lastSavedAt);
  const [isHydrated, setIsHydrated] = useState(false);
  const [saveStatus, setSaveStatus] = useState("Loading local workspace…");
  const [importDraft, setImportDraft] = useState("");
  const [importMessage, setImportMessage] = useState("");
  const [draftTitle, setDraftTitle] = useState("");
  const [draftTheme, setDraftTheme] = useState("");
  const [draftAssetClass, setDraftAssetClass] = useState("ETF");
  const [draftWhyNow, setDraftWhyNow] = useState("");
  const [sourceTitle, setSourceTitle] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceClaim, setSourceClaim] = useState("");
  const [agentRequestDraft, setAgentRequestDraft] = useState("");
  const [decisionRationale, setDecisionRationale] = useState("");
  const [radarTheme, setRadarTheme] = useState("");
  const [radarSignal, setRadarSignal] = useState("");

  useEffect(() => {
    const stored = deserializeInvestmentState(window.localStorage.getItem(INVESTMENT_STORAGE_KEY))
      ?? deserializeInvestmentState(window.localStorage.getItem(LEGACY_INVESTMENT_STORAGE_KEY));
    if (stored) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Hydrates browser workspace after mount.
      setProfile(stored.profile);
      setItems(stored.researchItems);
      setSelectedId(stored.selectedResearchId || stored.researchItems[0]?.id || "");
      setAgentInbox(stored.agentInbox);
      setRadarSignals(stored.radarSignals);
      setSync(stored.sync);
      setLastSavedAt(stored.lastSavedAt);
      setSaveStatus(stored.schemaVersion === 2 ? "Loaded saved Phase 3 workspace from this browser." : "Migrated saved Phase 2 workspace into Phase 3 schema.");
    } else {
      setSaveStatus("Started from seed data. Changes now autosave locally.");
    }
    setIsHydrated(true);
  }, []);

  const selected = items.find((item) => item.id === selectedId) ?? items[0];

  const currentState = useMemo<InvestmentAppState>(() => ({
    schemaVersion: 2,
    profile,
    researchItems: items,
    selectedResearchId: selected?.id ?? selectedId,
    agentInbox,
    radarSignals,
    sync,
    lastSavedAt,
  }), [agentInbox, items, lastSavedAt, profile, radarSignals, selected?.id, selectedId, sync]);

  useEffect(() => {
    if (!isHydrated) return;
    const savedAt = new Date().toISOString();
    const state = updateStateMetadata(currentState, savedAt);
    window.localStorage.setItem(INVESTMENT_STORAGE_KEY, serializeInvestmentState(state));
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Reflects visible autosave timestamp after local write.
    setLastSavedAt(savedAt);
    setSaveStatus("Autosaved to this browser. Cloud-ready schema export is current.");
  }, [currentState, isHydrated]);

  const metrics = useMemo(() => {
    const byStatus = items.reduce<Record<ResearchStatus, number>>((acc, item) => {
      acc[item.status] += 1;
      return acc;
    }, { inbox: 0, watch: 0, memo: 0, decided: 0, rejected: 0 });
    const evidenceCount = items.reduce((count, item) => count + item.sources.length, 0);
    const draftCount = items.reduce((count, item) => count + item.agentDrafts.length, 0);
    const snapshotCount = items.reduce((count, item) => count + item.decisionSnapshots.length, 0);
    return { byStatus, evidenceCount, draftCount, snapshotCount };
  }, [items]);

  const exportJson = useMemo(() => JSON.stringify(currentState, null, 2), [currentState]);

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
      assumptions: [],
      openQuestions: ["What source-backed evidence supports this?", "How does this change portfolio concentration and liquidity?"],
      risks: ["Evidence incomplete", "Portfolio fit not yet verified"],
      fitNotes: "Pending profile-fit analysis.",
      decision: "watch",
      confidence: "low",
      targetAllocation: "Research only; no allocation proposed.",
      reviewCadence: "Manual review",
      nextReviewAt: today(),
      createdAt: today(),
      sources: [],
      agentDrafts: [],
      decisionSnapshots: []
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
      checkedAt: today(),
      quality: "medium",
      claim: sourceClaim.trim() || "Claim needs to be summarized from source."
    };
    updateSelected({ sources: [...selected.sources, nextSource] });
    setSourceTitle("");
    setSourceUrl("");
    setSourceClaim("");
  }

  function queueAgentRequest() {
    if (!agentRequestDraft.trim()) return;
    const request = createResearchRequest(agentRequestDraft, selected?.id ?? "");
    setAgentInbox((current) => [request, ...current]);
    setAgentRequestDraft("");
  }

  function draftSelectedRequest(request: AgentResearchRequest) {
    if (!selected) return;
    const draft = createAgentDraftFromRequest(request, selected);
    updateSelected({ agentDrafts: [draft, ...selected.agentDrafts], status: "memo" });
    setAgentInbox((current) => current.map((item) => item.id === request.id ? { ...item, status: "drafted", linkedResearchItemId: selected.id } : item));
  }

  function captureDecisionSnapshot() {
    if (!selected) return;
    const snapshot = createDecisionSnapshot(selected, decisionRationale);
    updateSelected({ decisionSnapshots: [snapshot, ...selected.decisionSnapshots], status: "decided" });
    setDecisionRationale("");
  }

  function addRadarSignal() {
    if (!radarTheme.trim() && !radarSignal.trim()) return;
    setRadarSignals((current) => [createRadarSignal(radarTheme, radarSignal), ...current]);
    setRadarTheme("");
    setRadarSignal("");
  }

  function promoteRadarSignal(signal: FrontierRadarSignal) {
    const next: ResearchItem = {
      id: uid("research"),
      title: signal.theme,
      assetClass: "Theme / watchlist",
      theme: signal.theme,
      status: "inbox",
      whyNow: signal.signal,
      thesis: "Frontier radar signal promoted for evidence-backed research.",
      assumptions: [],
      openQuestions: [signal.sourceHint, "Which investable vehicles map cleanly to this theme?"],
      risks: ["Signal may be hype-driven", "Investable exposure may be indirect or overpriced"],
      fitNotes: signal.portfolioRelevance,
      decision: "watch",
      confidence: "low",
      targetAllocation: "Research only; no allocation proposed.",
      reviewCadence: "Manual review",
      nextReviewAt: today(),
      createdAt: today(),
      sources: [],
      agentDrafts: [],
      decisionSnapshots: []
    };
    setItems((current) => [next, ...current]);
    setSelectedId(next.id);
  }

  function resetWorkspace() {
    const next = createInitialInvestmentState(defaultProfile, sampleResearchItems);
    setProfile(next.profile);
    setItems(next.researchItems);
    setSelectedId(next.selectedResearchId);
    setAgentInbox(next.agentInbox);
    setRadarSignals(next.radarSignals);
    setSync(next.sync);
    setLastSavedAt(next.lastSavedAt);
    setImportDraft("");
    setImportMessage("Workspace reset to seed research data.");
  }

  function importWorkspace() {
    const parsed = deserializeInvestmentState(importDraft);
    if (!parsed) {
      setImportMessage("Import failed. Paste a complete Phase 2 or Phase 3 workspace JSON export.");
      return;
    }
    setProfile(parsed.profile);
    setItems(parsed.researchItems);
    setSelectedId(parsed.selectedResearchId || parsed.researchItems[0]?.id || "");
    setAgentInbox(parsed.agentInbox);
    setRadarSignals(parsed.radarSignals);
    setSync(parsed.sync);
    setLastSavedAt(parsed.lastSavedAt);
    setImportMessage("Imported workspace JSON. It will autosave locally using Phase 3 schema.");
  }

  return (
    <main className="min-h-screen px-5 py-6 md:px-10 lg:px-12">
      <section className="mx-auto max-w-7xl space-y-8">
        <header className="rounded-[2rem] border border-line bg-panel/85 p-7 shadow-soft backdrop-blur md:p-9">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="mb-3 inline-flex rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-accent">Hermes Investment Intelligence</p>
              <h1 className="text-4xl font-semibold tracking-tight text-ink md:text-6xl">Research OS for evidence, portfolio fit, memos, and decisions.</h1>
              <p className="mt-5 text-lg leading-8 text-muted">Phases 3–5 local build: cloud-ready persistence contract, Hermes research intake, frontier radar, portfolio-fit checks, and decision journaling. Research support only — no trade execution.</p>
            </div>
            <div className="grid min-w-[18rem] grid-cols-2 gap-3 rounded-3xl bg-slate-50 p-4">
              <Metric label="Inbox" value={metrics.byStatus.inbox} />
              <Metric label="Evidence" value={metrics.evidenceCount} />
              <Metric label="Agent drafts" value={metrics.draftCount} />
              <Metric label="Snapshots" value={metrics.snapshotCount} />
            </div>
          </div>
        </header>

        <section className="grid gap-5 lg:grid-cols-[0.95fr_1.45fr]">
          <ProfileCard profile={profile} onChange={setProfile} />
          <OperatingRules />
        </section>

        <PersistencePanel
          exportJson={exportJson}
          importDraft={importDraft}
          importMessage={importMessage}
          lastSavedAt={lastSavedAt}
          saveStatus={saveStatus}
          storageKey={INVESTMENT_STORAGE_KEY}
          syncStatus={sync.lastSyncStatus}
          onImport={importWorkspace}
          onImportDraftChange={setImportDraft}
          onReset={resetWorkspace}
        />

        <section className="grid gap-5 xl:grid-cols-[0.85fr_1.45fr_0.9fr]">
          <div className="space-y-5">
            <CapturePanel
              draftAssetClass={draftAssetClass}
              draftTheme={draftTheme}
              draftTitle={draftTitle}
              draftWhyNow={draftWhyNow}
              onAdd={addResearchItem}
              onAssetClassChange={setDraftAssetClass}
              onThemeChange={setDraftTheme}
              onTitleChange={setDraftTitle}
              onWhyNowChange={setDraftWhyNow}
            />
            <LifecyclePanel items={items} selectedId={selected?.id ?? ""} onSelect={setSelectedId} />
            <AgentIntakePanel agentInbox={agentInbox} draft={agentRequestDraft} onDraft={draftSelectedRequest} onDraftChange={setAgentRequestDraft} onQueue={queueAgentRequest} />
          </div>

          <div className="space-y-5">
            {selected ? <ThesisWorkbench item={selected} update={updateSelected} /> : null}
            {selected ? (
              <EvidencePanel
                item={selected}
                sourceClaim={sourceClaim}
                sourceTitle={sourceTitle}
                sourceUrl={sourceUrl}
                onAddEvidence={addEvidence}
                onClaimChange={setSourceClaim}
                onTitleChange={setSourceTitle}
                onUrlChange={setSourceUrl}
              />
            ) : null}
            {selected ? <DecisionJournal item={selected} rationale={decisionRationale} onCapture={captureDecisionSnapshot} onRationaleChange={setDecisionRationale} /> : null}
          </div>

          <div className="space-y-5">
            {selected ? <PortfolioFit item={selected} profile={profile} /> : null}
            <FrontierRadar signals={radarSignals} theme={radarTheme} signal={radarSignal} onAdd={addRadarSignal} onPromote={promoteRadarSignal} onSignalChange={setRadarSignal} onThemeChange={setRadarTheme} />
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

function PersistencePanel({ exportJson, importDraft, importMessage, lastSavedAt, saveStatus, storageKey, syncStatus, onImport, onImportDraftChange, onReset }: { exportJson: string; importDraft: string; importMessage: string; lastSavedAt: string; saveStatus: string; storageKey: string; syncStatus: string; onImport: () => void; onImportDraftChange: (value: string) => void; onReset: () => void; }) {
  return <Panel title="Cloud-ready Persistence" subtitle="Phase 3: browser-local storage now uses a server-ready schema with import/export migration. No cloud credentials are connected yet.">
    <div className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
      <div className="space-y-3 rounded-2xl border border-line bg-slate-50 p-4 text-sm leading-6 text-slate-700">
        <p><span className="font-semibold text-ink">Status:</span> {saveStatus}</p>
        <p><span className="font-semibold text-ink">Sync contract:</span> {syncStatus}</p>
        <p><span className="font-semibold text-ink">Last saved:</span> {new Date(lastSavedAt).toLocaleString()}</p>
        <p><span className="font-semibold text-ink">Storage key:</span> <span className="break-all">{storageKey}</span></p>
        <p className="text-amber-900">Cloud-ready only. Supabase/Vercel env changes remain separate deployment work.</p>
        <button className="focus-ring rounded-2xl border border-red-200 bg-white px-4 py-3 font-semibold text-red-700 transition hover:bg-red-50" onClick={onReset}>Reset local workspace</button>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="block"><span className="mb-1 block text-sm font-semibold text-slate-700">Export Phase 3 JSON</span><textarea className="focus-ring min-h-48 w-full rounded-2xl border border-line bg-white px-4 py-3 font-mono text-xs leading-5" value={exportJson} readOnly /></label>
        <div className="space-y-3"><Textarea label="Import Phase 2/3 JSON" value={importDraft} onChange={onImportDraftChange} placeholder="Paste workspace export here" /><button className="focus-ring rounded-2xl bg-ink px-4 py-3 font-semibold text-white transition hover:bg-slate-700" onClick={onImport}>Import workspace</button>{importMessage ? <p className="rounded-2xl bg-blue-50 p-4 text-sm font-semibold text-blue-950">{importMessage}</p> : null}</div>
      </div>
    </div>
  </Panel>;
}

function CapturePanel({ draftAssetClass, draftTheme, draftTitle, draftWhyNow, onAdd, onAssetClassChange, onThemeChange, onTitleChange, onWhyNowChange }: { draftAssetClass: string; draftTheme: string; draftTitle: string; draftWhyNow: string; onAdd: () => void; onAssetClassChange: (value: string) => void; onThemeChange: (value: string) => void; onTitleChange: (value: string) => void; onWhyNowChange: (value: string) => void; }) {
  return <Panel title="Capture opportunity" subtitle="Add a theme, ticker, asset, fund, or private opportunity for research.">
    <div className="space-y-3"><Input label="Title" value={draftTitle} onChange={onTitleChange} placeholder="e.g. Singapore REIT recovery basket" /><Input label="Theme" value={draftTheme} onChange={onThemeChange} placeholder="e.g. Rates / income" /><Input label="Asset class" value={draftAssetClass} onChange={onAssetClassChange} placeholder="ETF, stock, gold, bond, crypto..." /><Textarea label="Why now?" value={draftWhyNow} onChange={onWhyNowChange} placeholder="What signal made this worth attention?" /><button className="focus-ring w-full rounded-2xl bg-ink px-4 py-3 font-semibold text-white transition hover:bg-slate-700" onClick={onAdd}>Add to Research Inbox</button></div>
  </Panel>;
}

function LifecyclePanel({ items, selectedId, onSelect }: { items: ResearchItem[]; selectedId: string; onSelect: (id: string) => void }) {
  return <Panel title="Opportunity lifecycle" subtitle="Move ideas from inbox to memo to decision.">
    <div className="space-y-2">{items.map((item) => <button key={item.id} onClick={() => onSelect(item.id)} className={`focus-ring w-full rounded-2xl border p-4 text-left transition ${selectedId === item.id ? "border-accent bg-blue-50" : "border-line bg-white hover:border-slate-300"}`}><div className="flex items-start justify-between gap-3"><div><p className="font-semibold text-ink">{item.title}</p><p className="mt-1 text-sm text-muted">{item.assetClass} · {item.theme}</p></div><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">{statusLabels[item.status]}</span></div></button>)}</div>
  </Panel>;
}

function AgentIntakePanel({ agentInbox, draft, onDraft, onDraftChange, onQueue }: { agentInbox: AgentResearchRequest[]; draft: string; onDraft: (request: AgentResearchRequest) => void; onDraftChange: (value: string) => void; onQueue: () => void; }) {
  return <Panel title="Hermes Research Intake" subtitle="Phase 4: local app contract for Telegram/Hermes requests. Draft only; human review required.">
    <div className="space-y-3"><Textarea label="New research request" value={draft} onChange={onDraftChange} placeholder="e.g. Research whether gold still fits my portfolio this quarter" /><button className="focus-ring rounded-2xl bg-accent px-4 py-3 font-semibold text-white transition hover:bg-blue-700" onClick={onQueue}>Queue request</button></div>
    <div className="mt-5 space-y-3">{agentInbox.map((request) => <div key={request.id} className="rounded-2xl border border-line bg-slate-50 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{request.channel} · {request.status}</p><p className="mt-2 font-semibold text-ink">{request.rawRequest}</p><p className="mt-2 text-sm leading-6 text-muted">{request.approvalNote}</p><button className="focus-ring mt-3 rounded-2xl border border-line bg-white px-3 py-2 text-sm font-semibold text-ink" onClick={() => onDraft(request)}>Draft against selected item</button></div>)}</div>
  </Panel>;
}

function ThesisWorkbench({ item, update }: { item: ResearchItem; update: (patch: Partial<ResearchItem>) => void }) {
  return <Panel title="Thesis Workbench" subtitle="Structured memo draft for the selected opportunity.">
    <div className="grid gap-3 md:grid-cols-3"><Select label="Lifecycle" value={item.status} onChange={(status) => update({ status })} options={(Object.keys(statusLabels) as ResearchStatus[]).map((value) => ({ value, label: statusLabels[value] }))} /><Select label="Decision option" value={item.decision} onChange={(decision) => update({ decision })} options={(Object.keys(decisionLabels) as Decision[]).map((value) => ({ value, label: decisionLabels[value] }))} /><Select label="Confidence" value={item.confidence} onChange={(confidence) => update({ confidence })} options={["low", "medium", "high"].map((value) => ({ value: value as ResearchItem["confidence"], label: value }))} /></div>
    <div className="mt-4 space-y-3"><Input label="Title" value={item.title} onChange={(title) => update({ title })} /><Textarea label="Why this may matter now" value={item.whyNow} onChange={(whyNow) => update({ whyNow })} /><Textarea label="Thesis" value={item.thesis} onChange={(thesis) => update({ thesis })} /><Textarea label="Assumptions" value={item.assumptions.join("\n")} onChange={(value) => update({ assumptions: splitLines(value) })} /><Textarea label="Open questions" value={item.openQuestions.join("\n")} onChange={(value) => update({ openQuestions: splitLines(value) })} /><Textarea label="Key risks" value={item.risks.join("\n")} onChange={(value) => update({ risks: splitLines(value) })} /><Input label="Target allocation boundary" value={item.targetAllocation} onChange={(targetAllocation) => update({ targetAllocation })} /><Input label="Review cadence" value={item.reviewCadence} onChange={(reviewCadence) => update({ reviewCadence })} /><Input label="Next review date" value={item.nextReviewAt} onChange={(nextReviewAt) => update({ nextReviewAt })} /><Textarea label="Portfolio fit notes" value={item.fitNotes} onChange={(fitNotes) => update({ fitNotes })} /></div>
    {item.agentDrafts.length > 0 ? <div className="mt-5 space-y-3"><h3 className="font-semibold text-ink">Agent draft queue</h3>{item.agentDrafts.map((draft) => <div key={draft.id} className="rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm leading-6 text-blue-950"><p className="font-semibold">{draft.request}</p><p className="mt-2">Next: {draft.suggestedNextStep}</p><p className="mt-2 font-semibold">Human review required: {draft.humanReviewRequired ? "yes" : "no"}</p></div>)}</div> : null}
  </Panel>;
}

function EvidencePanel({ item, sourceClaim, sourceTitle, sourceUrl, onAddEvidence, onClaimChange, onTitleChange, onUrlChange }: { item: ResearchItem; sourceClaim: string; sourceTitle: string; sourceUrl: string; onAddEvidence: () => void; onClaimChange: (value: string) => void; onTitleChange: (value: string) => void; onUrlChange: (value: string) => void; }) {
  return <Panel title="Evidence Library" subtitle="Every claim should have a source, date, and quality level.">
    <div className="space-y-3"><Input label="Source title" value={sourceTitle} onChange={onTitleChange} placeholder="Issuer factsheet, 10-K, fund page..." /><Input label="Source URL" value={sourceUrl} onChange={onUrlChange} placeholder="https://" /><Textarea label="Claim supported" value={sourceClaim} onChange={onClaimChange} placeholder="What does this source prove or challenge?" /><button className="focus-ring rounded-2xl bg-accent px-4 py-3 font-semibold text-white transition hover:bg-blue-700" onClick={onAddEvidence}>Attach evidence</button></div>
    <div className="mt-5 space-y-3">{item.sources.length === 0 ? <p className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">No evidence attached yet. Do not finalize a memo without sources.</p> : item.sources.map((source) => <div key={source.id} className="rounded-2xl border border-line bg-slate-50 p-4"><div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-600"><span>{sourceTypeLabels[source.sourceType]}</span><span>·</span><span>{source.quality} quality</span><span>·</span><span>checked {source.checkedAt}</span></div><p className="mt-2 font-semibold text-ink">{source.title}</p><p className="mt-2 text-sm leading-6 text-muted">{source.claim}</p><a className="mt-2 inline-block break-all text-sm font-semibold text-accent" href={source.url} target="_blank" rel="noreferrer">{source.url}</a></div>)}</div>
  </Panel>;
}

function PortfolioFit({ item, profile }: { item: ResearchItem; profile: InvestmentProfile }) {
  const fit = scorePortfolioFit(item, profile);
  return <Panel title="Portfolio Fit Engine" subtitle="Phase 5: qualitative fit check before deeper analysis.">
    <div className="space-y-3 text-sm leading-6"><FitRow label="Score" value={`${fit.score}/100 · ${fit.label}`} /><FitRow label="Risk profile" value={profile.riskLevel} /><FitRow label="Time horizon" value={profile.horizon} /><FitRow label="Asset class" value={item.assetClass} /><div className="rounded-2xl bg-blue-50 p-4 text-blue-950"><p className="font-semibold">Fit interpretation</p><p className="mt-1">{item.fitNotes}</p></div>{fit.blockers.length > 0 ? <div className="rounded-2xl bg-amber-50 p-4 text-amber-950"><p className="font-semibold">Blockers</p><ul className="mt-1 list-disc pl-5">{fit.blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}</ul></div> : null}<div className="rounded-2xl bg-amber-50 p-4 text-amber-950"><p className="font-semibold">Before action</p><p className="mt-1">{fit.nextCheck} Do not execute trades from this app.</p></div></div>
  </Panel>;
}

function FitRow({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between gap-4 rounded-2xl border border-line bg-white p-3"><span className="font-semibold text-slate-600">{label}</span><span className="text-right font-semibold text-ink">{value}</span></div>;
}

function FrontierRadar({ signals, theme, signal, onAdd, onPromote, onSignalChange, onThemeChange }: { signals: FrontierRadarSignal[]; theme: string; signal: string; onAdd: () => void; onPromote: (signal: FrontierRadarSignal) => void; onSignalChange: (value: string) => void; onThemeChange: (value: string) => void; }) {
  return <Panel title="Frontier Radar" subtitle="Phase 5: recurring theme signals that can be promoted into the research inbox.">
    <div className="space-y-3"><Input label="Theme" value={theme} onChange={onThemeChange} placeholder="e.g. Edge AI" /><Textarea label="Signal" value={signal} onChange={onSignalChange} placeholder="What changed, and why might it matter?" /><button className="focus-ring rounded-2xl bg-ink px-4 py-3 font-semibold text-white transition hover:bg-slate-700" onClick={onAdd}>Add radar signal</button></div>
    <div className="mt-5 space-y-3">{signals.map((item) => <div key={item.id} className="rounded-2xl border border-line bg-white p-4"><div className="flex items-center justify-between gap-3"><p className="font-semibold text-ink">{item.theme}</p><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">{item.urgency}</span></div><p className="mt-2 text-sm leading-6 text-muted">{item.signal}</p><p className="mt-2 text-sm leading-6 text-slate-700"><span className="font-semibold">Next:</span> {item.nextAction}</p><button className="focus-ring mt-3 rounded-2xl border border-line bg-slate-50 px-3 py-2 text-sm font-semibold text-ink" onClick={() => onPromote(item)}>Promote to inbox</button></div>)}</div>
  </Panel>;
}

function DecisionJournal({ item, rationale, onCapture, onRationaleChange }: { item: ResearchItem; rationale: string; onCapture: () => void; onRationaleChange: (value: string) => void; }) {
  return <Panel title="Decision Journal" subtitle="Immutable-style accountability snapshots. Records research decisions, not trade instructions.">
    <div className="space-y-3"><Textarea label="Human rationale" value={rationale} onChange={onRationaleChange} placeholder="Why this decision state is being captured now" /><button className="focus-ring rounded-2xl bg-ink px-4 py-3 font-semibold text-white transition hover:bg-slate-700" onClick={onCapture}>Capture decision snapshot</button></div>
    <div className="mt-5 space-y-3">{item.decisionSnapshots.length === 0 ? <p className="rounded-2xl bg-slate-50 p-4 text-sm text-muted">No snapshots yet.</p> : item.decisionSnapshots.map((snapshot) => <div key={snapshot.id} className="rounded-2xl border border-line bg-slate-50 p-4 text-sm leading-6"><p className="font-semibold text-ink">{snapshot.decision} · {snapshot.confidence}</p><p className="mt-1 text-muted">{snapshot.humanRationale}</p><p className="mt-2 font-semibold text-amber-900">{snapshot.actionBoundary}</p></div>)}</div>
  </Panel>;
}
