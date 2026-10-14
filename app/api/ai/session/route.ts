import { NextResponse } from "next/server";
import { aiConfigured, aiSessionStatus, createAISession, sameOriginRequest, setAISessionCookie, validAccessPassword } from "@/lib/ai-session";
export const dynamic = "force-dynamic";

const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
export async function GET(request: Request) { return aiSessionStatus(request); }
export async function POST(request: Request) {
  if (!sameOriginRequest(request)) return json({ error: "Same-origin unlock required." }, 403);
  if (!aiConfigured()) return json({ error: "AI activation is pending server configuration." }, 503);
  if (!(request.headers.get("content-type") ?? "").includes("application/json")) return json({ error: "JSON input required." }, 400);
  const raw = await request.text();
  if (raw.length > 4096) return json({ error: "Unlock request is too large." }, 413);
  let body: unknown;
  try { body = JSON.parse(raw); } catch { return json({ error: "Invalid unlock request." }, 400); }
  if (!body || typeof body !== "object" || !("password" in body) || typeof body.password !== "string" || !validAccessPassword(body.password)) return json({ error: "Private AI access password is incorrect." }, 401);
  return setAISessionCookie(json({ authenticated: true }), createAISession());
}
export async function DELETE(request: Request) {
  if (!sameOriginRequest(request)) return json({ error: "Same-origin lock required." }, 403);
  return setAISessionCookie(json({ authenticated: false }), "", 0);
}
