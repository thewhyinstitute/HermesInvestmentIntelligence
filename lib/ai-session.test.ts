import { afterEach, describe, expect, it, vi } from "vitest";
import { AI_SESSION_SECONDS, createAISession, sessionCookieName, verifyAISession } from "./ai-session";
import { GET, POST, DELETE } from "../app/api/ai/session/route";

const password = "private-test-password-123456789";
afterEach(() => { vi.unstubAllEnvs(); });
function configure() { vi.stubEnv("OPENAI_API_KEY", "fake-key"); vi.stubEnv("INVESTMENT_AI_ACCESS_TOKEN", password); }
const unlock = (value = password, origin = "https://app.test") => new Request("https://app.test/api/ai/session", { method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify({ password: value }) });

describe("persistent private AI sessions", () => {
  it("issues an opaque signed cookie, never the original password", () => {
    configure(); const session = createAISession(1800000000000);
    expect(session).not.toContain(password); expect(verifyAISession(session, 1800000001000)).toBe(true);
    expect(verifyAISession(session + "x", 1800000001000)).toBe(false);
    expect(verifyAISession(session.replace("v1", "v2"), 1800000001000)).toBe(false);
    expect(verifyAISession(session, 1800000000000 + AI_SESSION_SECONDS * 1000)).toBe(false);
  });
  it("revokes existing sessions when the configured password changes", () => {
    configure(); const session = createAISession(); vi.stubEnv("INVESTMENT_AI_ACCESS_TOKEN", "a-different-private-password-12345");
    expect(verifyAISession(session)).toBe(false);
  });
  it("sets a persistent HttpOnly, Secure, same-site host-only production cookie", async () => {
    configure(); vi.stubEnv("NODE_ENV", "production");
    const response = await POST(unlock()); const cookie = response.headers.get("set-cookie")!;
    expect(response.status).toBe(200); expect(cookie).toContain("__Host-investment_ai_session=");
    expect(cookie).toContain("HttpOnly"); expect(cookie).toContain("Secure"); expect(cookie).toContain("SameSite=strict");
    expect(cookie).toContain(`Max-Age=${AI_SESSION_SECONDS}`); expect(cookie).not.toContain("Domain="); expect(cookie).not.toContain(password);
  });
  it("shares unlock across instruments and renews the browser cookie on status checks", async () => {
    configure(); const cookie = (await POST(unlock())).headers.get("set-cookie")!.split(";")[0];
    const response = await GET(new Request("https://app.test/api/ai/session", { headers: { Cookie: cookie } }));
    expect((await response.json()).authenticated).toBe(true); expect(response.headers.get("set-cookie")).toBeTruthy();
  });
  it("rejects wrong passwords, malformed requests and cross-site mutation", async () => {
    configure(); expect((await POST(unlock("wrong"))).status).toBe(401);
    expect((await POST(unlock(password, "https://other.test"))).status).toBe(403);
    expect((await POST(new Request("https://app.test/api/ai/session", { method: "POST", headers: { Origin: "https://app.test", "Content-Type": "application/json" }, body: "not-json" }))).status).toBe(400);
    expect((await DELETE(new Request("https://app.test/api/ai/session", { method: "DELETE", headers: { Origin: "https://other.test" } }))).status).toBe(403);
  });
  it("checks the public request host behind a server proxy", async () => {
    configure();
    const request = new Request("https://internal.test/api/ai/session", { method: "POST", headers: { Host: "app.test", Origin: "https://app.test", "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
    expect((await POST(request)).status).toBe(200);
  });
  it("clears the cookie on explicit lock and rejects anonymous status", async () => {
    configure(); const status = await GET(new Request("https://app.test/api/ai/session"));
    expect((await status.json()).authenticated).toBe(false);
    const locked = await DELETE(new Request("https://app.test/api/ai/session", { method: "DELETE", headers: { Origin: "https://app.test" } }));
    expect(locked.headers.get("set-cookie")).toContain("Max-Age=0");
    expect(verifyAISession(undefined)).toBe(false); expect(sessionCookieName()).toContain("investment_ai_session");
  });
});
