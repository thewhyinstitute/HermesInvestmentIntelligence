import { afterEach, describe, expect, it, vi } from "vitest";
import { isAIReviewInput, parseAIReview } from "./ai-review";
import { GET, POST } from "../app/api/ai/review/route";

const token = "test-private-access-password-12345";
const input = { symbol: "NVDA", thesis: "Research AI infrastructure", entryCondition: "Verify valuation", facts: [], gaps: ["No price"], risks: ["Concentration"], scenarios: [], sources: [{ id: "issuer", title: "Issuer", url: "https://investor.nvidia.com", claim: "Identity only" }] };
const review = { summary: "Price is missing", assessment: "wait", caseFor: ["Business exposure"], caseAgainst: ["Concentration"], whatToVerify: ["Price"], sourceIds: ["issuer"] };
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
function configure() { vi.stubEnv("OPENAI_API_KEY", "test-openai-key"); vi.stubEnv("INVESTMENT_AI_ACCESS_TOKEN", token); }
function request(body: unknown = input, password = token) { return new Request("http://localhost/api/ai/review", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${password}` }, body: JSON.stringify(body) }); }

describe("private AI research review", () => {
  it("validates context and rejects unrecognized citations and buy instructions", () => {
    expect(isAIReviewInput(input)).toBe(true);
    expect(isAIReviewInput({ ...input, symbol: "INVALID" })).toBe(false);
    expect(parseAIReview(review, ["issuer"])).toEqual(review);
    expect(() => parseAIReview({ ...review, sourceIds: ["invented"] }, ["issuer"])).toThrow();
    expect(() => parseAIReview({ ...review, assessment: "buy" }, ["issuer"])).toThrow();
  });
  it("fails closed without both required credentials and never calls OpenAI", async () => {
    vi.stubEnv("OPENAI_API_KEY", ""); vi.stubEnv("INVESTMENT_AI_ACCESS_TOKEN", "");
    const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    expect((await GET()).status).toBe(200);
    expect((await (await GET()).json()).configured).toBe(false);
    expect((await POST(request())).status).toBe(503); expect(fetchMock).not.toHaveBeenCalled();
  });
  it("rejects unauthenticated requests and oversized contexts before spending", async () => {
    configure(); const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    expect((await POST(request(input, "wrong"))).status).toBe(401);
    expect((await POST(request({ ...input, thesis: "x".repeat(13000) }))).status).toBe(413);
    expect((await POST(request({ ...input, symbol: "INVALID" }))).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("makes one bounded non-stored Responses request and returns a validated draft", async () => {
    configure(); const fetchMock = vi.fn().mockResolvedValue(Response.json({ status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(review) }] }], usage: { input_tokens: 100, output_tokens: 50 } }));
    vi.stubGlobal("fetch", fetchMock);
    const response = await POST(request({ ...input, holdingsNotes: "private account information" })); const result = await response.json();
    expect(response.status).toBe(200); expect(result.review).toEqual(review);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(sent.store).toBe(false); expect(sent.max_output_tokens).toBe(1800);
    expect(sent.text.format.strict).toBe(true); expect(sent.tools).toBeUndefined();
    expect(JSON.stringify(sent.input)).not.toContain("private account information");
    expect(JSON.stringify(result)).not.toContain("test-openai-key"); expect(JSON.stringify(result)).not.toContain(token);
  });
  it("rejects refusals and incomplete output without accepting an analysis", async () => {
    configure(); vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ status: "incomplete", output: [] })));
    expect((await POST(request())).status).toBe(502);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ status: "completed", output: [{ type: "message", content: [{ type: "refusal" }] }] })));
    expect((await POST(request())).status).toBe(422);
  });
  it("does not retry quota failures or leak provider error bodies", async () => {
    configure(); const fetchMock = vi.fn().mockResolvedValue(Response.json({ error: "test-openai-key" }, { status: 429 })); vi.stubGlobal("fetch", fetchMock);
    const response = await POST(request()); expect(response.status).toBe(502);
    expect(await response.text()).not.toContain("test-openai-key"); expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
