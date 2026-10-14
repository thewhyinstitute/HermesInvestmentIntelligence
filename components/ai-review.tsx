"use client";
import { useState } from "react";
import type { AIReview, AIReviewInput } from "@/lib/ai-review";
import { useAIAccess } from "./ai-access";

export function AIReviewPanel({ input }: { input: AIReviewInput }) {
  const { status, refresh } = useAIAccess();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ review: AIReview; model: string; generatedAt: string; boundary: string; input: string }>();
  async function generate() {
    setBusy(true); setError("");
    const context = JSON.stringify(input);
    try {
      const response = await fetch("/api/ai/review", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: context });
      const body = await response.json();
      if (response.status === 401) await refresh();
      if (!response.ok) throw new Error(body.error || "AI review failed.");
      setResult({ ...body, input: context });
    } catch (problem) { setError(problem instanceof Error ? problem.message : "AI review failed."); }
    finally { setBusy(false); }
  }
  return <details className="ai-review-panel"><summary>AI-assisted explanation</summary>
    <p>A manual review request sends this instrument&apos;s thesis, evidence, dated facts and scenarios to the OpenAI API and uses API credit. No holdings or profile notes are included. The draft does not change your decision.</p>
    {!status?.authenticated && <p className="notice">Unlock AI once in Market & data.</p>}
    <button className="secondary-button" disabled={!status?.authenticated || busy} onClick={generate}>{busy ? "Reviewing..." : "Generate AI research draft"}</button>
    <p role="status">{error}</p>
    {result && <div><h4>AI research draft · {result.review.assessment.replaceAll("_", " ")}</h4>
      <p>{result.model} · {result.generatedAt}</p><p>{result.boundary}</p>
      {result.input !== JSON.stringify(input) && <p className="notice">Inputs changed since this AI draft. Generate a new draft before relying on it.</p>}
      <p>{result.review.summary}</p>
      {([ ["Case for", result.review.caseFor], ["Case against", result.review.caseAgainst], ["Verify next", result.review.whatToVerify] ] as const).map(([heading, lines]) => <div key={heading}><h4>{heading}</h4><ul>{lines.map((line, index) => <li key={index}>{line}</li>)}</ul></div>)}
      {result.review.sourceIds.map(id => { const source = input.sources.find(source => source.id === id); return source ? <p key={id}><a href={source.url} target="_blank" rel="noreferrer">{source.title}</a></p> : null; })}
    </div>}
  </details>;
}
