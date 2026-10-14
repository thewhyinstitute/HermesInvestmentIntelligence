import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

export const AI_SESSION_SECONDS = 30 * 86400;
export const sessionCookieName = () => process.env.NODE_ENV === "production" ? "__Host-investment_ai_session" : "investment_ai_session";
export const aiConfigured = () => !!process.env.OPENAI_API_KEY?.trim() && (process.env.INVESTMENT_AI_ACCESS_TOKEN?.trim().length ?? 0) >= 24;
export function validAccessPassword(password: string) {
  const expected = process.env.INVESTMENT_AI_ACCESS_TOKEN;
  if (!expected || expected.trim().length < 24) return false;
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(expected), digest(password));
}
const sign = (payload: string, secret: string) => createHmac("sha256", secret).update(`investment-ai-session:${payload}`).digest("hex");
export function createAISession(now = Date.now()) {
  const secret = process.env.INVESTMENT_AI_ACCESS_TOKEN;
  if (!secret || secret.trim().length < 24) throw new Error("AI access is not configured.");
  const payload = `v1.${Math.floor(now / 1000) + AI_SESSION_SECONDS}.${randomBytes(16).toString("hex")}`;
  return `${payload}.${sign(payload, secret)}`;
}
export function verifyAISession(value: string | undefined, now = Date.now()) {
  const secret = process.env.INVESTMENT_AI_ACCESS_TOKEN;
  if (!secret || secret.trim().length < 24 || !value || value.length > 200) return false;
  const parts = value.split(".");
  if (parts.length !== 4 || parts[0] !== "v1" || !/^\d{10}$/.test(parts[1]) || !/^[a-f0-9]{32}$/.test(parts[2]) || !/^[a-f0-9]{64}$/.test(parts[3])) return false;
  const expires = Number(parts[1]); const seconds = Math.floor(now / 1000);
  if (expires <= seconds || expires > seconds + AI_SESSION_SECONDS + 60) return false;
  return timingSafeEqual(Buffer.from(parts[3], "hex"), Buffer.from(sign(parts.slice(0, 3).join("."), secret), "hex"));
}
export function authenticatedAIRequest(request: Request) {
  return verifyAISession(new NextRequest(request.url, { headers: request.headers }).cookies.get(sessionCookieName())?.value);
}
export function sameOriginRequest(request: Request) {
  try {
    const origin = new URL(request.headers.get("origin") ?? "");
    const url = new URL(request.url);
    return origin.host === (request.headers.get("host") ?? url.host) && origin.protocol === url.protocol;
  } catch { return false; }
}
export function setAISessionCookie(response: NextResponse, value: string, maxAge = AI_SESSION_SECONDS) {
  response.cookies.set(sessionCookieName(), value, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge });
  return response;
}
export function aiSessionStatus(request: Request) {
  const configured = aiConfigured(); const authenticated = configured && authenticatedAIRequest(request);
  const response = NextResponse.json({ configured, authenticated, accessRequired: !authenticated,
    model: process.env.OPENAI_MODEL === "gpt-6.1-sol" ? "gpt-6.1-sol" : "gpt-6-luna" }, { headers: { "Cache-Control": "private, no-store" } });
  return authenticated ? setAISessionCookie(response, createAISession()) : response;
}
