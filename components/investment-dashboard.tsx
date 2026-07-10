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
  inbox: "Inbox",
  watch: "Watchlist",
  memo: "Memo",
  decided: "Decided",
  rejected: "Rejected"
};

const decisionLabels: Record<Decision, string> = {
  watch: "Watch",
  research_deeper: "Research deeper",
  exploratory_allocation: "Explore allocation",
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

function nextActionFor(item: ResearchItem) {
  if (item.sources.length === 0) return "Attach source evidence before trusting this memo.";
  if (item.openQuestions.length > 0) return `Resolve ${item.openQuestions.length} open question(s).`;
  if (item.status !== "memo" && item.status !== "decided") return "Move this into the memo workbench.";
  return "Ready for human review and decision snapshot.";
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
  const [activeView, setActiveView] = useState<"radar" | "inbox" | "memo" | "fit" | "journal" | "settings">("radar");

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
      setSaveStatus(stored.schemaVersion === 2 ? "Loaded saved workspace from this browser." : "Migrated saved workspace into the current schema.");
    } else {
      setSaveStatus("Started from seed data. Changes autosave locally.");
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
    setSaveStatus("Autosaved locally. Cloud connection not enabled yet.");
  }, [currentState, isHydrated]);

  const metrics = useMemo(() => {
    const byStatus = items.reduce<Record<ResearchStatus, number>>((acc, item) => {
      acc[item.status] += 1;
      return acc;
    }, { inbox: 0, watch: 0, memo: 0, decided: 0, rejected: 0 });
    const evidenceCount = items.reduce((count, item) => count + item.sources.length, 0);
    const blockers = items.reduce((count, item) => count + item.openQuestions.length, 0);
    return { byStatus, evidenceCount, blockers, total: items.length };
  }, [items]);

  const exportJson = useMemo(() => JSON.stringify(currentState, null, 2), [currentState]);
  const highestPriority = useMemo(() => [...items].sort((a, b) => {
    const score = (item: ResearchItem) => item.sources.length * 2 - item.openQuestions.length + (item.status === "memo" ? 3 : 0) + (item.confidence === "high" ? 2 : item.confidence === "medium" ? 1 : 0);
    return score(b) - score(a);
  })[0], [items]);

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
    setActiveView("memo");
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
    updateSelected({ sources: [...selected.sources, nextSource], status: selected.status === "inbox" ? "memo" : selected.status });
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
    setActiveView("memo");
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
    setActiveView("memo");
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
      setImportMessage("Import failed. Paste a complete workspace JSON export.");
      return;
    }
    setProfile(parsed.profile);
    setItems(parsed.researchItems);
    setSelectedId(parsed.selectedResearchId || parsed.researchItems[0]?.id || "");
    setAgentInbox(parsed.agentInbox);
    setRadarSignals(parsed.radarSignals);
    setSync(parsed.sync);
    setLastSavedAt(parsed.lastSavedAt);
    setImportMessage("Imported workspace JSON. It will autosave locally.");
  }

  const fit = selected ? scorePortfolioFit(selected, profile) : null;

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand-lockup">
          <div className="brand-mark">II</div>
          <div>
            <p className="eyebrow">Hermes</p>
            <h1>Investment Intelligence</h1>
          </div>
        </div>
        <nav className="nav-list" aria-label="Workspace sections">
          <NavButton active={activeView === "radar"} label="Radar" detail="What deserves attention" onClick={() => setActiveView("radar")} />
          <NavButton active={activeView === "inbox"} label="Inbox" detail={`${metrics.byStatus.inbox} open ideas`} onClick={() => setActiveView("inbox")} />
          <NavButton active={activeView === "memo"} label="Memo" detail={selected?.title ?? "No item"} onClick={() => setActiveView("memo")} />
          <NavButton active={activeView === "fit"} label="Portfolio Fit" detail={fit ? `${fit.score}/100` : "No score"} onClick={() => setActiveView("fit")} />
          <NavButton active={activeView === "journal"} label="Journal" detail="Decision history" onClick={() => setActiveView("journal")} />
          <NavButton active={activeView === "settings"} label="Settings" detail="Profile & data" onClick={() => setActiveView("settings")} />
        </nav>
        <div className="guardrail-card">
          <p className="eyebrow">Boundary</p>
          <p>Research support only. No financial advice, broker connection, or trade execution.</p>
        </div>
      </aside>

      <section className="workspace">
        <header className="hero-card">
          <div>
            <p className="eyebrow">Usable MVP v1</p>
            <h2>Your investment research cockpit.</h2>
            <p className="hero-copy">Capture themes, turn them into evidence-backed memos, check portfolio fit, and record human-owned decisions.</p>
          </div>
          <div className="hero-actions">
            <button className="primary-button" onClick={() => setActiveView("inbox")}>Add research idea</button>
            <button className="secondary-button" onClick={() => setActiveView("memo")}>Review active memo</button>
          </div>
        </header>

        <div className="metric-grid">
          <Metric label="Research items" value={metrics.total} />
          <Metric label="Inbox" value={metrics.byStatus.inbox} />
          <Metric label="Evidence" value={metrics.evidenceCount} />
          <Metric label="Open questions" value={metrics.blockers} tone="warn" />
        </div>

        {activeView === "radar" ? <RadarView highestPriority={highestPriority} signals={radarSignals} theme={radarTheme} signal={radarSignal} onAdd={addRadarSignal} onPromote={promoteRadarSignal} onSignalChange={setRadarSignal} onThemeChange={setRadarTheme} onOpenMemo={() => setActiveView("memo")} /> : null}
        {activeView === "inbox" ? <InboxView items={items} selectedId={selected?.id ?? ""} draftAssetClass={draftAssetClass} draftTheme={draftTheme} draftTitle={draftTitle} draftWhyNow={draftWhyNow} agentInbox={agentInbox} agentRequestDraft={agentRequestDraft} onAdd={addResearchItem} onAssetClassChange={setDraftAssetClass} onDraft={draftSelectedRequest} onAgentDraftChange={setAgentRequestDraft} onQueueAgent={queueAgentRequest} onSelect={setSelectedId} onThemeChange={setDraftTheme} onTitleChange={setDraftTitle} onWhyNowChange={setDraftWhyNow} /> : null}
        {activeView === "memo" && selected ? <MemoView item={selected} update={updateSelected} sourceClaim={sourceClaim} sourceTitle={sourceTitle} sourceUrl={sourceUrl} onAddEvidence={addEvidence} onClaimChange={setSourceClaim} onTitleChange={setSourceTitle} onUrlChange={setSourceUrl} /> : null}
        {activeView === "fit" && selected && fit ? <FitView item={selected} profile={profile} fit={fit} /> : null}
        {activeView === "journal" && selected ? <JournalView item={selected} rationale={decisionRationale} onCapture={captureDecisionSnapshot} onRationaleChange={setDecisionRationale} /> : null}
        {activeView === "settings" ? <SettingsView profile={profile} onProfileChange={setProfile} exportJson={exportJson} importDraft={importDraft} importMessage={importMessage} lastSavedAt={lastSavedAt} saveStatus={saveStatus} storageKey={INVESTMENT_STORAGE_KEY} syncStatus={sync.lastSyncStatus} onImport={importWorkspace} onImportDraftChange={setImportDraft} onReset={resetWorkspace} /> : null}
      </section>

      <aside className="detail-rail">
        {selected ? <ActiveResearchCard item={selected} onMemo={() => setActiveView("memo")} /> : null}
        {selected && fit ? <FitSummary fit={fit} /> : null}
        <ProfileSummary profile={profile} />
      </aside>
    </main>
  );
}

function NavButton({ active, label, detail, onClick }: { active: boolean; label: string; detail: string; onClick: () => void }) {
  return <button className={`nav-button ${active ? "is-active" : ""}`} onClick={onClick}><span>{label}</span><small>{detail}</small></button>;
}

function Metric({ label, value, tone }: { label: string; value: number; tone?: "warn" }) {
  return <div className={`metric-card ${tone === "warn" ? "is-warn" : ""}`}><strong>{value}</strong><span>{label}</span></div>;
}

function Panel({ title, subtitle, children, action }: { title: string; subtitle?: string; children: React.ReactNode; action?: React.ReactNode }) {
  return <section className="panel"><div className="panel-header"><div><h3>{title}</h3>{subtitle ? <p>{subtitle}</p> : null}</div>{action}</div>{children}</section>;
}

function Input({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  return <label className="field"><span>{label}</span><input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} /></label>;
}

function Textarea({ label, value, onChange, placeholder, rows = 4 }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; rows?: number }) {
  return <label className="field"><span>{label}</span><textarea rows={rows} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} /></label>;
}

function Select<T extends string>({ label, value, onChange, options }: { label: string; value: T; onChange: (value: T) => void; options: { label: string; value: T }[] }) {
  return <label className="field"><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value as T)}>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>;
}

function RadarView({ highestPriority, signals, theme, signal, onAdd, onPromote, onSignalChange, onThemeChange, onOpenMemo }: { highestPriority?: ResearchItem; signals: FrontierRadarSignal[]; theme: string; signal: string; onAdd: () => void; onPromote: (signal: FrontierRadarSignal) => void; onSignalChange: (value: string) => void; onThemeChange: (value: string) => void; onOpenMemo: () => void }) {
  return <div className="view-grid two-col">
    <Panel title="Today’s priority" subtitle="The strongest item to review next." action={<button className="secondary-button" onClick={onOpenMemo}>Open memo</button>}>
      {highestPriority ? <div className="priority-card"><p className="tag">{highestPriority.theme}</p><h3>{highestPriority.title}</h3><p>{highestPriority.whyNow}</p><div className="checklist"><span>{highestPriority.sources.length} source(s)</span><span>{highestPriority.openQuestions.length} open question(s)</span><span>{highestPriority.confidence} confidence</span></div><strong>Next: {nextActionFor(highestPriority)}</strong></div> : <EmptyState text="No research items yet. Add your first idea from Inbox." />}
    </Panel>
    <Panel title="Frontier radar" subtitle="Signals you may want to promote into research.">
      <div className="compact-form"><Input label="Theme" value={theme} onChange={onThemeChange} placeholder="e.g. Edge AI" /><Textarea label="Signal" value={signal} onChange={onSignalChange} placeholder="What changed, and why might it matter?" rows={3} /><button className="primary-button" onClick={onAdd}>Add signal</button></div>
      <div className="card-list">{signals.map((item) => <article key={item.id} className="signal-card"><div><p className="tag">{item.urgency} urgency</p><h4>{item.theme}</h4></div><p>{item.signal}</p><p><strong>Next:</strong> {item.nextAction}</p><button className="secondary-button" onClick={() => onPromote(item)}>Promote to inbox</button></article>)}</div>
    </Panel>
  </div>;
}

function InboxView({ items, selectedId, draftAssetClass, draftTheme, draftTitle, draftWhyNow, agentInbox, agentRequestDraft, onAdd, onAssetClassChange, onDraft, onAgentDraftChange, onQueueAgent, onSelect, onThemeChange, onTitleChange, onWhyNowChange }: { items: ResearchItem[]; selectedId: string; draftAssetClass: string; draftTheme: string; draftTitle: string; draftWhyNow: string; agentInbox: AgentResearchRequest[]; agentRequestDraft: string; onAdd: () => void; onAssetClassChange: (value: string) => void; onDraft: (request: AgentResearchRequest) => void; onAgentDraftChange: (value: string) => void; onQueueAgent: () => void; onSelect: (id: string) => void; onThemeChange: (value: string) => void; onTitleChange: (value: string) => void; onWhyNowChange: (value: string) => void }) {
  return <div className="view-grid two-col">
    <Panel title="Capture an opportunity" subtitle="Add a theme, ticker, fund, or private opportunity in under 10 seconds.">
      <div className="compact-form"><Input label="Title" value={draftTitle} onChange={onTitleChange} placeholder="e.g. Singapore REIT recovery basket" /><Input label="Theme" value={draftTheme} onChange={onThemeChange} placeholder="e.g. Rates / income" /><Input label="Asset class" value={draftAssetClass} onChange={onAssetClassChange} placeholder="ETF, stock, gold, bond, crypto..." /><Textarea label="Why now?" value={draftWhyNow} onChange={onWhyNowChange} placeholder="What signal made this worth attention?" /><button className="primary-button" onClick={onAdd}>Add to inbox</button></div>
    </Panel>
    <Panel title="Research queue" subtitle="Select one item to work on.">
      <div className="research-list">{items.map((item) => <button key={item.id} onClick={() => onSelect(item.id)} className={`research-row ${selectedId === item.id ? "is-selected" : ""}`}><div><h4>{item.title}</h4><p>{item.assetClass} · {item.theme}</p></div><span>{statusLabels[item.status]}</span></button>)}</div>
    </Panel>
    <Panel title="Hermes research intake" subtitle="Queue an agent-style research request against the selected item.">
      <div className="compact-form"><Textarea label="New research request" value={agentRequestDraft} onChange={onAgentDraftChange} placeholder="Research whether gold still fits my portfolio this quarter" rows={3} /><button className="secondary-button" onClick={onQueueAgent}>Queue request</button></div>
      <div className="card-list">{agentInbox.map((request) => <article key={request.id} className="mini-card"><p className="tag">{request.channel} · {request.status}</p><h4>{request.rawRequest}</h4><p>{request.approvalNote}</p><button className="secondary-button" onClick={() => onDraft(request)}>Draft against selected item</button></article>)}</div>
    </Panel>
  </div>;
}

function MemoView({ item, update, sourceClaim, sourceTitle, sourceUrl, onAddEvidence, onClaimChange, onTitleChange, onUrlChange }: { item: ResearchItem; update: (patch: Partial<ResearchItem>) => void; sourceClaim: string; sourceTitle: string; sourceUrl: string; onAddEvidence: () => void; onClaimChange: (value: string) => void; onTitleChange: (value: string) => void; onUrlChange: (value: string) => void }) {
  return <div className="view-grid memo-grid">
    <Panel title="Active memo" subtitle="Turn a raw idea into a source-backed investment memo.">
      <div className="memo-header"><div><p className="tag">{item.theme}</p><h3>{item.title}</h3></div><span className="status-pill">{statusLabels[item.status]}</span></div>
      <div className="form-grid three"><Select label="Lifecycle" value={item.status} onChange={(status) => update({ status })} options={(Object.keys(statusLabels) as ResearchStatus[]).map((value) => ({ value, label: statusLabels[value] }))} /><Select label="Decision" value={item.decision} onChange={(decision) => update({ decision })} options={(Object.keys(decisionLabels) as Decision[]).map((value) => ({ value, label: decisionLabels[value] }))} /><Select label="Confidence" value={item.confidence} onChange={(confidence) => update({ confidence })} options={["low", "medium", "high"].map((value) => ({ value: value as ResearchItem["confidence"], label: value }))} /></div>
      <div className="compact-form"><Input label="Title" value={item.title} onChange={(title) => update({ title })} /><Textarea label="Why this may matter now" value={item.whyNow} onChange={(whyNow) => update({ whyNow })} /><Textarea label="Thesis" value={item.thesis} onChange={(thesis) => update({ thesis })} /><Textarea label="Assumptions" value={item.assumptions.join("\n")} onChange={(value) => update({ assumptions: splitLines(value) })} /><Textarea label="Open questions" value={item.openQuestions.join("\n")} onChange={(value) => update({ openQuestions: splitLines(value) })} /><Textarea label="Key risks" value={item.risks.join("\n")} onChange={(value) => update({ risks: splitLines(value) })} /></div>
    </Panel>
    <Panel title="Evidence" subtitle="Every important claim needs a source.">
      <div className="compact-form"><Input label="Source title" value={sourceTitle} onChange={onTitleChange} placeholder="Issuer factsheet, 10-K, fund page..." /><Input label="Source URL" value={sourceUrl} onChange={onUrlChange} placeholder="https://" /><Textarea label="Claim supported" value={sourceClaim} onChange={onClaimChange} placeholder="What does this source prove or challenge?" rows={3} /><button className="primary-button" onClick={onAddEvidence}>Attach evidence</button></div>
      <div className="card-list">{item.sources.length === 0 ? <EmptyState text="No evidence yet. Do not finalize without sources." /> : item.sources.map((source) => <article key={source.id} className="mini-card"><p className="tag">{sourceTypeLabels[source.sourceType]} · {source.quality} · checked {source.checkedAt}</p><h4>{source.title}</h4><p>{source.claim}</p><a href={source.url} target="_blank" rel="noreferrer">Open source</a></article>)}</div>
    </Panel>
  </div>;
}

function FitView({ item, profile, fit }: { item: ResearchItem; profile: InvestmentProfile; fit: ReturnType<typeof scorePortfolioFit> }) {
  return <Panel title="Portfolio fit engine" subtitle="Qualitative fit check before deeper analysis or any human decision.">
    <div className="fit-score"><strong>{fit.score}</strong><span>/100 · {fit.label}</span></div>
    <div className="fit-grid"><InfoTile label="Risk profile" value={profile.riskLevel} /><InfoTile label="Time horizon" value={profile.horizon} /><InfoTile label="Asset class" value={item.assetClass} /><InfoTile label="Evidence count" value={String(item.sources.length)} /></div>
    <div className="insight-box"><h4>Interpretation</h4><p>{item.fitNotes}</p></div>
    {fit.blockers.length > 0 ? <div className="warning-box"><h4>Blockers</h4><ul>{fit.blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}</ul></div> : null}
    <div className="warning-box"><h4>Before action</h4><p>{fit.nextCheck} This app never executes trades.</p></div>
  </Panel>;
}

function JournalView({ item, rationale, onCapture, onRationaleChange }: { item: ResearchItem; rationale: string; onCapture: () => void; onRationaleChange: (value: string) => void }) {
  return <Panel title="Decision journal" subtitle="Record why a decision state exists. This is not a trade instruction.">
    <div className="compact-form"><Textarea label="Human rationale" value={rationale} onChange={onRationaleChange} placeholder="Why is this decision state being captured now?" /><button className="primary-button" onClick={onCapture}>Capture snapshot</button></div>
    <div className="card-list">{item.decisionSnapshots.length === 0 ? <EmptyState text="No snapshots yet." /> : item.decisionSnapshots.map((snapshot) => <article key={snapshot.id} className="mini-card"><p className="tag">{new Date(snapshot.createdAt).toLocaleString()}</p><h4>{decisionLabels[snapshot.decision]} · {snapshot.confidence}</h4><p>{snapshot.humanRationale}</p><p><strong>{snapshot.actionBoundary}</strong></p></article>)}</div>
  </Panel>;
}

function SettingsView({ profile, onProfileChange, exportJson, importDraft, importMessage, lastSavedAt, saveStatus, storageKey, syncStatus, onImport, onImportDraftChange, onReset }: { profile: InvestmentProfile; onProfileChange: (profile: InvestmentProfile) => void; exportJson: string; importDraft: string; importMessage: string; lastSavedAt: string; saveStatus: string; storageKey: string; syncStatus: string; onImport: () => void; onImportDraftChange: (value: string) => void; onReset: () => void; }) {
  return <div className="view-grid two-col">
    <Panel title="Investment profile" subtitle="Constraints the app should respect before suggesting research directions.">
      <div className="form-grid two"><Select label="Risk level" value={profile.riskLevel} onChange={(riskLevel) => onProfileChange({ ...profile, riskLevel })} options={["low", "moderate", "balanced", "high", "barbell"].map((value) => ({ label: value, value: value as InvestmentProfile["riskLevel"] }))} /><Select label="Time horizon" value={profile.horizon} onChange={(horizon) => onProfileChange({ ...profile, horizon })} options={["0-1y", "1-3y", "3-7y", "7y+"].map((value) => ({ label: value, value: value as InvestmentProfile["horizon"] }))} /><Input label="Geography" value={profile.geography} onChange={(geography) => onProfileChange({ ...profile, geography })} /><Input label="Preferred assets" value={profile.preferredAssets.join(", ")} onChange={(value) => onProfileChange({ ...profile, preferredAssets: splitCsv(value) })} /></div>
      <div className="form-grid two"><Textarea label="Liquidity needs" value={profile.liquidityNeed} onChange={(liquidityNeed) => onProfileChange({ ...profile, liquidityNeed })} /><Textarea label="Exclusions / notes" value={profile.excludedAssets} onChange={(excludedAssets) => onProfileChange({ ...profile, excludedAssets })} /></div>
    </Panel>
    <Panel title="Data & backup" subtitle="Debug/import/export moved here so the main workflow stays clean.">
      <div className="settings-status"><p><strong>Status:</strong> {saveStatus}</p><p><strong>Sync:</strong> {syncStatus}</p><p><strong>Last saved:</strong> {new Date(lastSavedAt).toLocaleString()}</p><p><strong>Storage key:</strong> {storageKey}</p></div>
      <details className="backup-details"><summary>Export / import workspace JSON</summary><Textarea label="Export JSON" value={exportJson} onChange={() => undefined} rows={8} /><Textarea label="Import JSON" value={importDraft} onChange={onImportDraftChange} placeholder="Paste workspace export here" rows={6} /><div className="button-row"><button className="secondary-button" onClick={onImport}>Import workspace</button><button className="danger-button" onClick={onReset}>Reset local workspace</button></div>{importMessage ? <p className="notice">{importMessage}</p> : null}</details>
    </Panel>
  </div>;
}

function ActiveResearchCard({ item, onMemo }: { item: ResearchItem; onMemo: () => void }) {
  return <section className="rail-card"><p className="eyebrow">Active research</p><h3>{item.title}</h3><p>{item.theme} · {item.assetClass}</p><div className="rail-stats"><span>{item.sources.length} sources</span><span>{item.openQuestions.length} questions</span></div><p className="next-action">{nextActionFor(item)}</p><button className="secondary-button" onClick={onMemo}>Open memo</button></section>;
}

function FitSummary({ fit }: { fit: ReturnType<typeof scorePortfolioFit> }) {
  return <section className="rail-card"><p className="eyebrow">Fit score</p><div className="rail-score"><strong>{fit.score}</strong><span>{fit.label}</span></div>{fit.blockers.length > 0 ? <p>{fit.blockers.length} blocker(s) before review.</p> : <p>No major qualitative blockers flagged.</p>}</section>;
}

function ProfileSummary({ profile }: { profile: InvestmentProfile }) {
  return <section className="rail-card"><p className="eyebrow">Profile</p><h3>{profile.riskLevel} · {profile.horizon}</h3><p>{profile.geography}</p><p>{profile.preferredAssets.join(" · ")}</p></section>;
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return <div className="info-tile"><span>{label}</span><strong>{value}</strong></div>;
}

function EmptyState({ text }: { text: string }) {
  return <div className="empty-state">{text}</div>;
}
