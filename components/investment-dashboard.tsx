"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ChartNoAxesCombined, Database, UserRound } from "lucide-react";
import { PersonalProfile } from "./personal-profile";
import { MarketDataPanel } from "./market-data-panel";
import { AIUnlock } from "./ai-access";
import { DecisionBrief } from "./decision-brief";
import { profileFitReason } from "@/lib/profile-guidance";
import type { MarketResponse } from "@/lib/market-data";
import { defaultProfile, sampleResearchItems } from "@/lib/sample-data";
import { RecommendationsView, RecommendationEditor } from "./recommendations-view";
import { buildInvestmentCandidates } from "@/lib/investment-candidates";
import { evaluateRecommendation } from "@/lib/recommendations";
import { mergeRadarEvidence } from "@/lib/radar-agent";
import {
  createInitialInvestmentState,
  deserializeInvestmentState,
  INVESTMENT_STORAGE_KEY,
  LEGACY_INVESTMENT_STORAGE_KEY,
  serializeInvestmentState,
  updateStateMetadata,
} from "@/lib/storage";
import { createRadarRun } from "@/lib/radar-runs";
import {
  createAgentDraftFromRequest,
  createDecisionSnapshot,
  createRadarSignal,
  createResearchRequest,
  createStructuredMemoDraft,
  evaluateEvidenceCoverage,
  evaluateMemoTrust,
  reviewEvidenceSource,
  scorePortfolioFit,
} from "@/lib/workflows";
import type { AgentChatMessage, AgentResearchRequest, Decision, EvidenceSource, FrontierRadarSignal, InvestmentAppState, InvestmentProfile, RadarRun, ResearchItem, ResearchStatus } from "@/lib/types";

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
  const [radarRuns, setRadarRuns] = useState<RadarRun[]>(initialState.radarRuns);
  const [agentMessages, setAgentMessages] = useState<AgentChatMessage[]>(initialState.agentMessages);
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
  const [radarScanStatus, setRadarScanStatus] = useState("Autonomous radar has not run yet.");
  const [agentCommand, setAgentCommand] = useState("Run radar and summarize what changed.");
  const [isAskingAgent, setIsAskingAgent] = useState(false);
  const [isScanningRadar, setIsScanningRadar] = useState(false);
  const [activeView, setActiveView] = useState<"recommendations" | "radar" | "inbox" | "memo" | "fit" | "journal" | "settings" | "profile">("recommendations");
  const [marketData, setMarketData] = useState<MarketResponse>();

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
      setRadarRuns(stored.radarRuns);
      setAgentMessages(stored.agentMessages);
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
    radarRuns,
    agentMessages,
    sync,
    lastSavedAt,
  }), [agentInbox, agentMessages, items, lastSavedAt, profile, radarRuns, radarSignals, selected?.id, selectedId, sync]);

  useEffect(() => {
    if (!isHydrated) return;
    const savedAt = new Date().toISOString();
    const state = updateStateMetadata(currentState, savedAt);
    window.localStorage.setItem(INVESTMENT_STORAGE_KEY, serializeInvestmentState(state));
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Reflects visible autosave timestamp after local write.
    setLastSavedAt(savedAt);
    setSaveStatus("Autosaved locally. Cloud connection not enabled yet.");
  // Metadata-only changes must not trigger another autosave write.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, items, selectedId, agentInbox, radarSignals, radarRuns, agentMessages, sync, isHydrated]);

  const exportJson = useMemo(() => JSON.stringify(currentState, null, 2), [currentState]);
  const latestRadarRun = radarRuns[0];
  const recommendationItems = useMemo(() => {
    const incoming = latestRadarRun?.opportunities ?? [];
    return [...items.map(item => {
      const fresh = incoming.find(candidate => candidate.recommendation?.symbol && candidate.recommendation.symbol === item.recommendation?.symbol);
      return fresh ? { ...item, sources: mergeRadarEvidence(fresh.sources, item.sources) } : item;
    }), ...incoming, ...buildInvestmentCandidates(profile)];
  }, [items, latestRadarRun, profile]);
  const fallbackPriority = useMemo(() => [...items].sort((a, b) => {
    const score = (item: ResearchItem) => item.sources.length * 2 - item.openQuestions.length + (item.status === "memo" ? 3 : 0) + (item.confidence === "high" ? 2 : item.confidence === "medium" ? 1 : 0);
    return score(b) - score(a);
  })[0], [items]);
  const highestPriority = latestRadarRun?.opportunities[0] ?? fallbackPriority;

  function addResearchItem() {
    if (!draftTitle.trim()) return;
    const next = createStructuredMemoDraft(draftTitle, draftTheme, draftAssetClass, draftWhyNow);
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
    const reviewed = evaluateRecommendation(selected, profile);
    const snapshotItem = selected.recommendation ? { ...selected, recommendation: { ...selected.recommendation, stance: reviewed.stance } } : selected;
    const snapshot = createDecisionSnapshot(snapshotItem, decisionRationale);
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

  async function runAutonomousRadar() {
    setIsScanningRadar(true);
    setRadarScanStatus("Scanning selected themes and gathering evidence links…");
    try {
      const response = await fetch("/api/radar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ profile })
      });
      if (!response.ok) throw new Error("Radar scan failed");
      const payload = await response.json() as { mode: string; opportunities: ResearchItem[] };
      const incoming = payload.opportunities ?? [];
      const run = createRadarRun({ mode: payload.mode, opportunities: incoming, previousRun: radarRuns[0] });
      setRadarRuns((current) => [run, ...current].slice(0, 12));
      setRadarScanStatus(`Saved radar run: ${incoming.length} opportunity memo(s), ${run.liveSourceCount} live sources, ${run.changes.newOpportunities.length} new opportunity(ies). Mode: ${payload.mode}. Promote only what deserves research.`);
      setActiveView("recommendations");
    } catch {
      setRadarScanStatus("Radar scan failed. Keep using manual capture while we reconnect the research agent.");
    } finally {
      setIsScanningRadar(false);
    }
  }

  async function askInvestmentAgent() {
    const message = agentCommand.trim();
    if (!message) return;
    setIsAskingAgent(true);
    const optimisticUser: AgentChatMessage = { id: uid("agent-user"), role: "user", content: message, createdAt: new Date().toISOString() };
    setAgentMessages((current) => [...current, optimisticUser]);
    setAgentCommand("");
    try {
      const response = await fetch("/api/agent/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ profile, latestRun: radarRuns[0], selectedItem: selected, messages: agentMessages, message })
      });
      if (!response.ok) throw new Error("Agent chat failed");
      const payload = await response.json() as { agentMessage?: AgentChatMessage; run?: RadarRun };
      if (payload.run) {
        setRadarRuns((current) => [payload.run as RadarRun, ...current].slice(0, 12));
        setRadarScanStatus(`Agent saved radar run: ${payload.run.opportunityCount} opportunity memo(s), ${payload.run.liveSourceCount} live sources, ${payload.run.changes.newOpportunities.length} new opportunity(ies).`);
      }
      if (payload.agentMessage) {
        setAgentMessages((current) => [...current, payload.agentMessage as AgentChatMessage]);
      }
      setActiveView("radar");
    } catch {
      setAgentMessages((current) => [...current, { id: uid("agent-error"), role: "agent", content: "Investment agent chat failed. Check the radar API connection and try again.", createdAt: new Date().toISOString() }]);
    } finally {
      setIsAskingAgent(false);
    }
  }

  function promoteRadarOpportunity(opportunity: ResearchItem) {
    const existing = items.find(item => item.title.toLowerCase() === opportunity.title.toLowerCase());
    const next: ResearchItem = {
      ...opportunity,
      id: uid("research"),
      status: "memo",
      createdAt: today(),
      agentDrafts: opportunity.agentDrafts.map((draft) => ({ ...draft, id: uid("draft") })),
      decisionSnapshots: [],
    };
    setItems((current) => {
      const existingIndex = current.findIndex((item) => item.title.toLowerCase() === opportunity.title.toLowerCase());
      if (existingIndex === -1) return [next, ...current];
      return current.map((item, index) => index === existingIndex ? { ...item, ...next, id: item.id, decisionSnapshots: item.decisionSnapshots } : item);
    });
    setSelectedId(existing?.id ?? next.id);
    setActiveView("memo");
  }

  function resetWorkspace() {
    const next = createInitialInvestmentState(defaultProfile, sampleResearchItems);
    setProfile(next.profile);
    setItems(next.researchItems);
    setSelectedId(next.selectedResearchId);
    setAgentInbox(next.agentInbox);
    setRadarSignals(next.radarSignals);
    setRadarRuns(next.radarRuns);
    setAgentMessages(next.agentMessages);
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
    setRadarRuns(parsed.radarRuns);
    setAgentMessages(parsed.agentMessages);
    setSync(parsed.sync);
    setLastSavedAt(parsed.lastSavedAt);
    setImportMessage("Imported workspace JSON. It will autosave locally.");
  }

  const fit = selected ? scorePortfolioFit(selected, profile) : null;

  return (
    <main className="simple-app">
      <header className="app-topbar">
        <div className="brand-lockup">
          <div className="brand-mark">II</div>
          <div>
            <h1>Investment Intelligence</h1>
          </div>
        </div>
        <nav className="primary-nav" aria-label="Main navigation">
          <button aria-current={["recommendations", "memo", "fit", "journal"].includes(activeView) ? "page" : undefined} onClick={() => setActiveView("recommendations")}><ChartNoAxesCombined size={18}/>Investments</button>
          <button aria-current={activeView === "profile" ? "page" : undefined} onClick={() => setActiveView("profile")}><UserRound size={18}/>My profile</button>
          <button aria-current={["settings", "radar", "inbox"].includes(activeView) ? "page" : undefined} onClick={() => setActiveView("settings")}><Database size={18}/>Market & data</button>
        </nav>
      </header>

      <section className="app-content">
        {activeView === "profile" ? <PersonalProfile profile={profile} onSave={setProfile}/> : null}
        {["memo", "fit", "journal", "radar", "inbox"].includes(activeView) ? <button className="text-button back-button" onClick={() => setActiveView(["radar", "inbox"].includes(activeView) ? "settings" : "recommendations")}><ArrowLeft size={18}/>Back to {["radar", "inbox"].includes(activeView) ? "Market & data" : "investments"}</button> : null}

        {activeView === "recommendations" ? <RecommendationsView items={recommendationItems} profile={profile} scanning={isScanningRadar} status={radarScanStatus} onRefresh={runAutonomousRadar} onProfile={() => setActiveView("profile")} onOpen={item => {
          const existing = items.find(candidate => candidate.id === item.id);
          if (existing) { setItems(current => current.map(candidate => candidate.id === item.id ? item : candidate)); setSelectedId(existing.id); setActiveView("memo"); }
          else promoteRadarOpportunity(item);
        }} /> : null}
        {activeView === "radar" ? <RadarView highestPriority={highestPriority} latestRun={latestRadarRun} radarRuns={radarRuns} signals={radarSignals} theme={radarTheme} signal={radarSignal} scanStatus={radarScanStatus} agentCommand={agentCommand} agentMessages={agentMessages} isAskingAgent={isAskingAgent} isScanning={isScanningRadar} onAdd={addRadarSignal} onAskAgent={askInvestmentAgent} onAgentCommandChange={setAgentCommand} onPromote={promoteRadarSignal} onPromoteOpportunity={promoteRadarOpportunity} onRunScan={runAutonomousRadar} onSignalChange={setRadarSignal} onThemeChange={setRadarTheme} onOpenMemo={() => setActiveView("memo")} /> : null}
        {activeView === "inbox" ? <InboxView items={items} selectedId={selected?.id ?? ""} draftAssetClass={draftAssetClass} draftTheme={draftTheme} draftTitle={draftTitle} draftWhyNow={draftWhyNow} agentInbox={agentInbox} agentRequestDraft={agentRequestDraft} onAdd={addResearchItem} onAssetClassChange={setDraftAssetClass} onDraft={draftSelectedRequest} onAgentDraftChange={setAgentRequestDraft} onQueueAgent={queueAgentRequest} onSelect={setSelectedId} onThemeChange={setDraftTheme} onTitleChange={setDraftTitle} onWhyNowChange={setDraftWhyNow} /> : null}
        {activeView === "memo" && selected ? <section className="investment-detail"><header className="page-heading"><p className="eyebrow">{selected.recommendation?.symbol} · {selected.assetClass}</p><h2>{selected.title}</h2></header><div className="case-overview"><h3>Why consider it</h3><p>{selected.recommendation?.rationale || selected.thesis}</p><h3>Fit for you</h3><p>{profileFitReason(selected, profile)}</p><h3>When to consider investing</h3><p>{selected.recommendation?.entryCondition || selected.whyNow}</p><h3>What could go wrong</h3><ul>{selected.risks.map(risk => <li key={risk}>{risk}</li>)}</ul><h3>What would change the view</h3><ul>{(selected.recommendation?.thesisBreakers ?? selected.openQuestions).map(reason => <li key={reason}>{reason}</li>)}</ul></div><DecisionBrief item={selected} profile={profile} market={marketData?.result?.symbol === selected.recommendation?.symbol ? marketData : undefined} onSave={item => updateSelected(item)}/><details className="case-evidence"><summary>Sources and evidence</summary>{selected.sources.length ? selected.sources.map(source => <p key={source.id}><a href={source.url.startsWith("https://") ? source.url : undefined} target="_blank" rel="noreferrer">{source.title}</a> · {source.checkedAt}<br/>{source.claim}</p>) : <p>No sources attached yet.</p>}</details><details><summary>Edit investment case</summary><MemoView item={selected} update={updateSelected} sourceClaim={sourceClaim} sourceTitle={sourceTitle} sourceUrl={sourceUrl} onAddEvidence={addEvidence} onClaimChange={setSourceClaim} onTitleChange={setSourceTitle} onUrlChange={setSourceUrl}/></details><div className="button-row"><button className="text-button" onClick={() => setActiveView("fit")}>Detailed fit checks</button><button className="text-button" onClick={() => setActiveView("journal")}>Decision history</button><button className="text-button" onClick={() => setActiveView("settings")}>Refresh price / unlock AI</button></div></section> : null}
        {activeView === "fit" && selected && fit ? <FitView item={selected} profile={profile} fit={fit} /> : null}
        {activeView === "journal" && selected ? <JournalView item={selected} rationale={decisionRationale} onCapture={captureDecisionSnapshot} onRationaleChange={setDecisionRationale} /> : null}
        {activeView === "settings" ? <><header className="page-heading"><h2>Market & data</h2><p>Dated market facts, research connections, and your saved workspace.</p></header><MarketDataPanel items={recommendationItems} onOpen={item => { const existing = items.find(candidate => candidate.id === item.id || candidate.recommendation?.symbol === item.recommendation?.symbol); if (existing) { setItems(current => current.map(candidate => candidate.id === existing.id ? { ...item, id: existing.id } : candidate)); setSelectedId(existing.id); setActiveView("memo"); } else promoteRadarOpportunity(item); }} onData={setMarketData}/><AIUnlock/><details className="advanced-workspace"><summary>Research tools and saved scans</summary><p>{radarScanStatus}</p><div className="button-row"><button className="secondary-button" onClick={() => setActiveView("radar")}>Market research</button><button className="secondary-button" onClick={() => setActiveView("inbox")}>Saved research ideas</button></div></details><SettingsView profile={profile} onProfileChange={setProfile} exportJson={exportJson} importDraft={importDraft} importMessage={importMessage} lastSavedAt={lastSavedAt} saveStatus={saveStatus} storageKey={INVESTMENT_STORAGE_KEY} syncStatus={sync.lastSyncStatus} onImport={importWorkspace} onImportDraftChange={setImportDraft} onReset={resetWorkspace} /></> : null}
      </section>
      <footer className="app-footer">Personal research only. No automatic trades. Your profile and saved cases stay in this browser.</footer>
    </main>
  );
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

function RadarView({ highestPriority, latestRun, radarRuns, signals, theme, signal, scanStatus, agentCommand, agentMessages, isAskingAgent, isScanning, onAdd, onAskAgent, onAgentCommandChange, onPromote, onPromoteOpportunity, onRunScan, onSignalChange, onThemeChange, onOpenMemo }: { highestPriority?: ResearchItem; latestRun?: RadarRun; radarRuns: RadarRun[]; signals: FrontierRadarSignal[]; theme: string; signal: string; scanStatus: string; agentCommand: string; agentMessages: AgentChatMessage[]; isAskingAgent: boolean; isScanning: boolean; onAdd: () => void; onAskAgent: () => void; onAgentCommandChange: (value: string) => void; onPromote: (signal: FrontierRadarSignal) => void; onPromoteOpportunity: (item: ResearchItem) => void; onRunScan: () => void; onSignalChange: (value: string) => void; onThemeChange: (value: string) => void; onOpenMemo: () => void }) {
  const evidenceCoverage = highestPriority ? evaluateEvidenceCoverage(highestPriority) : null;
  return <div className="view-grid two-col">
    <Panel title="Autonomous opportunity radar" subtitle="Run live research scans, save each run, and promote only the opportunities worth memo work." action={<button className="primary-button" onClick={onRunScan} disabled={isScanning}>{isScanning ? "Scanning…" : "Run radar scan"}</button>}>
      <div className="agent-status"><p className="eyebrow">Agent status</p><p>{scanStatus}</p></div>
      <div className="agent-command-card">
        <p className="eyebrow">Investment Agent Chat</p>
        <div className="agent-thread" aria-live="polite">
          {agentMessages.length === 0 ? <p className="empty-chat">Start with: run radar, what changed, which should I research first, or what evidence is missing?</p> : agentMessages.map((message) => <div key={message.id} className={`agent-bubble ${message.role === "user" ? "is-user" : "is-agent"}`}><strong>{message.role === "user" ? "You" : "Agent"}</strong><p>{message.content}</p></div>)}
          {isAskingAgent ? <div className="agent-bubble is-agent"><strong>Agent</strong><p>Thinking…</p></div> : null}
        </div>
        <Textarea label="Message" value={agentCommand} onChange={onAgentCommandChange} rows={3} placeholder="Ask a follow-up…" />
        <div className="button-row"><button className="primary-button" onClick={onAskAgent} disabled={isAskingAgent || !agentCommand.trim()}>{isAskingAgent ? "Sending…" : "Send"}</button></div>
        <p className="notice">Research support only. The agent cannot place trades, allocate capital, or authorize external actions.</p>
      </div>
      {latestRun ? <RadarRunSummary run={latestRun} /> : null}
      {highestPriority ? <div className="priority-card"><p className="tag">{highestPriority.theme}</p><h3>{highestPriority.title}</h3><p>{highestPriority.whyNow}</p><div className="checklist"><span>{highestPriority.sources.length} source(s)</span><span>{evidenceCoverage?.liveSearchCount ?? 0} live</span><span>{evidenceCoverage?.primaryCount ?? 0} primary</span><span>{highestPriority.openQuestions.length} open question(s)</span><span>{highestPriority.confidence} confidence</span></div><strong>Next: {nextActionFor(highestPriority)}</strong><div className="button-row priority-action"><button className="secondary-button" onClick={() => onPromoteOpportunity(highestPriority)}>Promote to memo</button><button className="secondary-button" onClick={onOpenMemo}>Open active memo</button></div></div> : <EmptyState text="No radar run yet. Run radar scan to save a dated evidence snapshot." />}
    </Panel>
    <Panel title="Saved radar runs" subtitle="Audit trail of scans and what changed since the previous run.">
      <div className="card-list">{radarRuns.length === 0 ? <EmptyState text="No saved radar runs yet." /> : radarRuns.map((run) => <RadarRunCard key={run.id} run={run} onPromoteOpportunity={onPromoteOpportunity} />)}</div>
    </Panel>
    <Panel title="Manual frontier radar" subtitle="Signals you may want to promote into research.">
      <div className="compact-form"><Input label="Theme" value={theme} onChange={onThemeChange} placeholder="e.g. Edge AI" /><Textarea label="Signal" value={signal} onChange={onSignalChange} placeholder="What changed, and why might it matter?" rows={3} /><button className="primary-button" onClick={onAdd}>Add signal</button></div>
      <div className="card-list">{signals.map((item) => <article key={item.id} className="signal-card"><div><p className="tag">{item.urgency} urgency</p><h4>{item.theme}</h4></div><p>{item.signal}</p><p><strong>Next:</strong> {item.nextAction}</p><button className="secondary-button" onClick={() => onPromote(item)}>Promote to inbox</button></article>)}</div>
    </Panel>
  </div>;
}

function RadarRunSummary({ run }: { run: RadarRun }) {
  return <div className="radar-run-summary">
    <InfoTile label="Saved run" value={new Date(run.generatedAt).toLocaleString()} />
    <InfoTile label="Mode" value={run.mode.replaceAll("-", " ")} />
    <InfoTile label="Live sources" value={String(run.liveSourceCount)} />
    <InfoTile label="Evidence gaps" value={String(run.evidenceGapCount)} />
  </div>;
}

function RadarRunCard({ run, onPromoteOpportunity }: { run: RadarRun; onPromoteOpportunity: (item: ResearchItem) => void }) {
  return <article className="mini-card radar-run-card">
    <div className="source-card-header"><p className="tag">{new Date(run.generatedAt).toLocaleString()}</p><p className="tag">{run.mode}</p></div>
    <h4>{run.opportunityCount} opportunities · {run.sourceCount} sources</h4>
    <div className="checklist"><span>{run.liveSourceCount} live</span><span>{run.primarySourceCount} primary</span><span>{run.evidenceGapCount} gaps</span></div>
    <ChangeList title="What changed" items={[...run.changes.newOpportunities.map((item) => `New opportunity: ${item}`), ...run.changes.improvedEvidenceTitles.map((item) => `Evidence improved: ${item}`), ...run.changes.worsenedEvidenceTitles.map((item) => `Evidence worsened: ${item}`), run.changes.newSourceUrls.length > 0 ? `${run.changes.newSourceUrls.length} new source link(s)` : "", run.changes.removedSourceUrls.length > 0 ? `${run.changes.removedSourceUrls.length} removed source link(s)` : ""].filter(Boolean)} empty="No material change versus previous scan." />
    <details className="run-details"><summary>Review opportunities from this run</summary><div className="card-list">{run.opportunities.map((item) => <article key={item.id} className="mini-card"><p className="tag">{item.theme}</p><h4>{item.title}</h4><p>{item.whyNow}</p><div className="checklist"><span>{item.sources.length} sources</span><span>{evaluateEvidenceCoverage(item).liveSearchCount} live</span><span>{evaluateEvidenceCoverage(item).primaryCount} primary</span></div><button className="secondary-button" onClick={() => onPromoteOpportunity(item)}>Promote to memo</button></article>)}</div></details>
  </article>;
}

function ChangeList({ title, items, empty }: { title: string; items: string[]; empty: string }) {
  return <div className={items.length > 0 ? "warning-box" : "insight-box"}><h4>{title}</h4>{items.length > 0 ? <ul>{items.map((item) => <li key={item}>{item}</li>)}</ul> : <p>{empty}</p>}</div>;
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
  const trust = evaluateMemoTrust(item);
  const evidenceCoverage = evaluateEvidenceCoverage(item);
  return <div className="view-grid memo-grid">
    <Panel title="Active memo" subtitle="Turn a raw idea into a source-backed investment memo.">
      <RecommendationEditor item={item} update={update} />
      <TrustStatus trust={trust} />
      <EvidenceGapPanel coverage={evidenceCoverage} />
      <div className="memo-header"><div><p className="tag">{item.theme}</p><h3>{item.title}</h3></div><span className="status-pill">{statusLabels[item.status]}</span></div>
      <div className="form-grid three"><Select label="Lifecycle" value={item.status} onChange={(status) => update({ status })} options={(Object.keys(statusLabels) as ResearchStatus[]).map((value) => ({ value, label: statusLabels[value] }))} /><Select label="Decision" value={item.decision} onChange={(decision) => update({ decision })} options={(Object.keys(decisionLabels) as Decision[]).map((value) => ({ value, label: decisionLabels[value] }))} /><Select label="Confidence" value={item.confidence} onChange={(confidence) => update({ confidence })} options={["low", "medium", "high"].map((value) => ({ value: value as ResearchItem["confidence"], label: value }))} /></div>
      <div className="compact-form"><Input label="Title" value={item.title} onChange={(title) => update({ title })} /><Textarea label="Why this may matter now" value={item.whyNow} onChange={(whyNow) => update({ whyNow })} /><Textarea label="Thesis" value={item.thesis} onChange={(thesis) => update({ thesis })} /><Textarea label="Assumptions" value={item.assumptions.join("\n")} onChange={(value) => update({ assumptions: splitLines(value) })} /><Textarea label="Open questions" value={item.openQuestions.join("\n")} onChange={(value) => update({ openQuestions: splitLines(value) })} /><Textarea label="Key risks" value={item.risks.join("\n")} onChange={(value) => update({ risks: splitLines(value) })} /></div>
    </Panel>
    <Panel title="Evidence" subtitle="Every important claim needs a source.">
      <div className="compact-form"><Input label="Source title" value={sourceTitle} onChange={onTitleChange} placeholder="Issuer factsheet, 10-K, fund page..." /><Input label="Source URL" value={sourceUrl} onChange={onUrlChange} placeholder="https://" /><Textarea label="Claim supported" value={sourceClaim} onChange={onClaimChange} placeholder="What does this source prove or challenge?" rows={3} /><button className="primary-button" onClick={onAddEvidence}>Attach evidence</button></div>
      <div className="card-list">{item.sources.length === 0 ? <EmptyState text="No evidence yet. Do not finalize without sources." /> : item.sources.map((source) => <EvidenceSourceCard key={source.id} source={source} />)}</div>
    </Panel>
  </div>;
}

function TrustStatus({ trust }: { trust: ReturnType<typeof evaluateMemoTrust> }) {
  const issues = [...trust.missingEvidence, ...trust.warnings];
  return <div className={`trust-panel ${trust.decisionReady ? "is-ready" : "is-blocked"}`}>
    <div><p className="eyebrow">Trust status</p><h4>{trust.score}/100 · {trust.label}</h4></div>
    <p>{trust.requiredNextStep}</p>
    {issues.length > 0 ? <ul>{issues.map((issue) => <li key={issue}>{issue}</li>)}</ul> : <p className="ready-copy">Evidence, risks, and questions are clean enough for human decision review.</p>}
  </div>;
}

function EvidenceGapPanel({ coverage }: { coverage: ReturnType<typeof evaluateEvidenceCoverage> }) {
  return <div className="evidence-gap-panel">
    <div className="evidence-score-row">
      <InfoTile label="Primary / official" value={String(coverage.primaryCount)} />
      <InfoTile label="Live search" value={String(coverage.liveSearchCount)} />
      <InfoTile label="Curated" value={String(coverage.curatedCount)} />
      <InfoTile label="Needs review" value={String(coverage.weakCount)} />
    </div>
    <div className={coverage.gaps.length > 0 ? "warning-box" : "insight-box"}>
      <h4>{coverage.gaps.length > 0 ? "Evidence gaps" : "Evidence coverage"}</h4>
      {coverage.gaps.length > 0
        ? <ul>{coverage.gaps.map((gap) => <li key={gap}>{gap}</li>)}</ul>
        : <p>Source coverage is sufficient for human memo review. Still verify claims before any decision snapshot.</p>}
    </div>
  </div>;
}

function EvidenceSourceCard({ source }: { source: EvidenceSource }) {
  const review = reviewEvidenceSource(source);
  return <article className={`mini-card evidence-card ${review.isPrimary ? "is-primary" : ""}`}>
    <div className="source-card-header">
      <p className="tag">{review.origin}</p>
      <p className="tag">{sourceTypeLabels[source.sourceType]} · {source.quality}</p>
    </div>
    <h4>{source.title}</h4>
    <p className="source-domain">{review.hostname} · checked {source.checkedAt}</p>
    <p>{source.claim}</p>
    <div className="insight-box source-review"><h4>{review.label}</h4><p>{review.reason}</p></div>
    {review.warnings.length > 0 ? <ul className="source-warnings">{review.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul> : null}
    <a href={source.url} target="_blank" rel="noreferrer">Open source</a>
  </article>;
}

function FitView({ item, profile, fit }: { item: ResearchItem; profile: InvestmentProfile; fit: ReturnType<typeof scorePortfolioFit> }) {
  const trust = evaluateMemoTrust(item);
  return <Panel title="Portfolio fit engine" subtitle="Qualitative fit check before deeper analysis or any human decision.">
    <div className="fit-score"><strong>{fit.score}</strong><span>/100 · {fit.label}</span></div>
    <div className="fit-grid"><InfoTile label="Risk profile" value={profile.riskLevel} /><InfoTile label="Time horizon" value={profile.horizon} /><InfoTile label="Asset class" value={item.assetClass} /><InfoTile label="Trust score" value={`${trust.score}/100`} /></div>
    <div className="insight-box"><h4>Interpretation</h4><p>{item.fitNotes}</p></div>
    {fit.blockers.length > 0 ? <div className="warning-box"><h4>Blockers</h4><ul>{fit.blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}</ul></div> : null}
    <div className="warning-box"><h4>Before action</h4><p>{fit.nextCheck} This app never executes trades.</p></div>
  </Panel>;
}

function JournalView({ item, rationale, onCapture, onRationaleChange }: { item: ResearchItem; rationale: string; onCapture: () => void; onRationaleChange: (value: string) => void }) {
  const trust = evaluateMemoTrust(item);
  return <Panel title="Decision journal" subtitle="Record why a decision state exists. This is not a trade instruction.">
    <TrustStatus trust={trust} />
    <div className="compact-form"><Textarea label="Human rationale" value={rationale} onChange={onRationaleChange} placeholder="Why is this decision state being captured now?" /><button className={trust.decisionReady ? "primary-button" : "danger-button"} onClick={onCapture}>{trust.decisionReady ? "Capture decision snapshot" : "Capture with warnings"}</button></div>
    <div className="card-list">{item.decisionSnapshots.length === 0 ? <EmptyState text="No snapshots yet." /> : item.decisionSnapshots.map((snapshot) => <article key={snapshot.id} className="mini-card"><p className="tag">{new Date(snapshot.createdAt).toLocaleString()}</p><h4>{decisionLabels[snapshot.decision]} · {snapshot.confidence}</h4>{snapshot.recommendation ? <p>{snapshot.recommendation.symbol} · investment stance at capture: {snapshot.recommendation.stance.replaceAll("_", " ")}</p> : null}<p>{snapshot.humanRationale}</p><p><strong>{snapshot.actionBoundary}</strong></p></article>)}</div>
  </Panel>;
}

function SettingsView({ exportJson, importDraft, importMessage, lastSavedAt, saveStatus, storageKey, syncStatus, onImport, onImportDraftChange, onReset }: { profile: InvestmentProfile; onProfileChange: (profile: InvestmentProfile) => void; exportJson: string; importDraft: string; importMessage: string; lastSavedAt: string; saveStatus: string; storageKey: string; syncStatus: string; onImport: () => void; onImportDraftChange: (value: string) => void; onReset: () => void; }) {
  return <div className="view-grid two-col">
    <Panel title="My saved data">
      <p>Saved in this browser. Export a backup before switching devices.</p>
      <details><summary>Storage status</summary><div className="settings-status"><p><strong>Status:</strong> {saveStatus}</p><p><strong>Sync:</strong> {syncStatus}</p><p><strong>Last saved:</strong> {new Date(lastSavedAt).toLocaleString()}</p><p><strong>Storage key:</strong> {storageKey}</p></div></details>
      <details className="backup-details"><summary>Export / import workspace JSON</summary><Textarea label="Export JSON" value={exportJson} onChange={() => undefined} rows={8} /><Textarea label="Import JSON" value={importDraft} onChange={onImportDraftChange} placeholder="Paste workspace export here" rows={6} /><div className="button-row"><button className="secondary-button" onClick={onImport}>Import workspace</button><button className="danger-button" onClick={onReset}>Reset local workspace</button></div>{importMessage ? <p className="notice">{importMessage}</p> : null}</details>
    </Panel>
  </div>;
}


function InfoTile({ label, value }: { label: string; value: string }) {
  return <div className="info-tile"><span>{label}</span><strong>{value}</strong></div>;
}

function EmptyState({ text }: { text: string }) {
  return <div className="empty-state">{text}</div>;
}
