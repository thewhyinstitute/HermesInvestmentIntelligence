"use client";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

interface AIStatus { configured: boolean; authenticated: boolean }
interface AIAccess { status?: AIStatus; error: string; refresh: () => Promise<void>; unlock: (password: string) => Promise<void>; lock: () => Promise<void> }
const AccessContext = createContext<AIAccess | null>(null);
export function useAIAccess() {
  const access = useContext(AccessContext);
  if (!access) throw new Error("AI access provider is missing.");
  return access;
}
export function AIAccessProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AIStatus>(); const [error, setError] = useState("");
  const refresh = useCallback(() => {
    return fetch("/api/ai/session", { credentials: "same-origin", cache: "no-store" }).then(async response => {
      if (!response.ok) throw new Error();
      setStatus(await response.json()); setError("");
    }).catch(() => { setError("AI access status unavailable."); });
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  async function changeAccess(method: "POST" | "DELETE", password?: string) {
    const response = await fetch("/api/ai/session", { method, credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: method === "POST" ? JSON.stringify({ password }) : undefined });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "AI access could not be updated.");
    setStatus(current => ({ configured: current?.configured ?? true, authenticated: body.authenticated })); setError("");
  }
  return <AccessContext.Provider value={{ status, error, refresh, unlock: password => changeAccess("POST", password), lock: () => changeAccess("DELETE") }}>{children}</AccessContext.Provider>;
}
export function AIUnlock() {
  const { status, error, unlock, lock } = useAIAccess();
  const [password, setPassword] = useState(""); const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");
  async function submit() {
    setBusy(true); setMessage("");
    try { await unlock(password); setPassword(""); }
    catch (problem) { setMessage(problem instanceof Error ? problem.message : "Unlock failed."); }
    finally { setBusy(false); }
  }
  return <section className="ai-unlock" aria-label="AI access"><h3>AI access</h3>
    {!status ? <p>{error || "Checking AI access..."}</p> : !status.configured ? <p>AI activation is pending server configuration.</p>
      : status.authenticated ? <><p>AI unlocked for this browser.</p><button className="secondary-button" disabled={busy} onClick={async () => {
        setBusy(true); setMessage(""); try { await lock(); } catch { setMessage("Could not lock AI. Try again."); } finally { setBusy(false); }
      }}>Lock AI</button></> : <form onSubmit={event => { event.preventDefault(); void submit(); }}>
        <label className="field"><span>Private AI access password</span><input type="password" autoComplete="off" value={password} onChange={event => setPassword(event.target.value)}/></label>
        <button className="secondary-button" type="submit" disabled={busy || password.trim().length < 24}>{busy ? "Unlocking..." : "Unlock AI"}</button>
      </form>}
    <p role="status">{message || error}</p>
  </section>;
}
