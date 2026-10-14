# Hermes Investment Intelligence

An agent-ready personal investment research OS for Idris: evidence, frontier themes, portfolio fit, thesis memos, and decision journaling.

## Scope

This web workspace supports investment research and decision preparation. It does not execute trades, connect to brokers, move money, or provide licensed financial advice.

## Current modules

- Recommendations-first shortlist: specific instruments, stance, reasons, entry conditions, risks and thesis breakers
- Investment Profile
- Research Inbox
- Opportunity Lifecycle
- Evidence Library
- Thesis Workbench
- Portfolio Fit Engine
- Frontier Radar
- Hermes Research Intake contract
- Decision Journal
- Cloud-ready Persistence export/import
- Operating Rules

## Completed phases

1. Core research OS UI and local state — complete
2. Browser-local persistent workspace with JSON backup/restore — complete
3. Cloud-ready persistence architecture — complete locally
   - Phase 3 schema version
   - Phase 2 import migration
   - localStorage autosave remains active
   - Supabase-ready sync state contract, but no Supabase credentials or env changes yet
4. Hermes / Telegram research intake contract — complete locally
   - queued research requests
   - draft generation against selected opportunities
   - human-review-required boundaries
5. Frontier radar, portfolio-fit, and decision journal workflow — complete locally
   - radar signals promoted into inbox
   - qualitative fit scoring
   - decision snapshots with explicit non-trade boundaries

## Not implemented yet

- AI-generated investment analysis and automated valuation forecasts (deferred)
- An exhaustive investment universe (initial candidates: QQQM, GRID, IAU, SGOV, NVDA)
- Cloud database connection
- Authentication
- Supabase schema deployment
- Broker/account integrations
- Paid market-data feeds
- Trade execution
- Public/private access hardening

## Tech stack

- Next.js
- TypeScript
- Tailwind CSS
- Vitest
- Vercel-ready

## Local development

```bash
npm install
npm run dev
```

## Production check

```bash
npm run build
npm run start -- --hostname 127.0.0.1 --port 3077
```

## Verification

```bash
npm test
npm run lint
npm run typecheck
npm run build
```

## Guardrails

- Research support only
- No broker connection in MVP
- No trade execution
- No external messages or capital commitments from the app
- Every memo must separate facts, assumptions, risks, and sources
- Decisions remain human-owned and approval-gated
- Never store secrets, account numbers, private keys, seed phrases, or raw sensitive financial identifiers

## Personal recommendations workflow

Recommendations is the default view. Refresh shortlist searches for instrument-specific evidence using the existing Tavily connection; a missing or unavailable key falls back to explicitly curated instrument candidates. Discovery results do not automatically authorize buying.

Open an investment case to review the ticker, exchange, valuation, entry condition, thesis breakers, alternatives and sourced price/date. Settings holds the actual-holdings and liquidity review. Consider-buying and accumulation stances are downgraded to Wait until freshness, independent evidence, memo quality and human/holdings reviews pass. Watch and Avoid remain valid outcomes. Trust/fit rankings are qualitative research priority, not return forecasts.

Existing v2 browser workspaces are retained. Recommendation fields are optional and exported with the workspace. Decision snapshots preserve the investment case at capture. No market prices, target prices, expected returns or allocations are fabricated.

## Direct market data (no AI or Hermes required)

The Recommendations view has a Market facts panel and a deterministic return scenario calculator. `/api/market-data` fetches Treasury par yields without a key. Add `ALPHA_VANTAGE_API_KEY` as a server-side Vercel environment variable (or in `.env.local` for development) and redeploy to enable end-of-day quotes, NVDA company overview, and ETF profiles for QQQM, GRID, IAU and SGOV. Obtain a key at https://www.alphavantage.co/support/#api-key. Do not use a NEXT_PUBLIC key.

Fetch one instrument at a time to conserve the free provider quota. Successful quotes/Treasury responses are cached for six hours and fundamentals for 24 hours. Coverage, free-tier limits and subscription restrictions depend on the provider; unavailable fields stay unavailable. This is not a real-time feed. API keys and raw provider errors are never returned to the browser. Only the fixed five-symbol universe is accepted.

Prices use the provider trading date, Treasury rates use the published observation date, and ETF holdings are explicitly undated when the provider gives no holdings date. The overview's latest-quarter date is not claimed as a valuation snapshot date. Calculated price/EPS can differ from provider P/E because snapshots may differ. No scraped news price becomes a verified quote.

Use price in investment case is an explicit action that replaces that case's quote, adds dated provenance, and clears the human-review date. Nothing automatically changes the investment stance. Quotes not transferred to a case are temporary panel data; transferred quotes are included in the existing workspace export. Scenario assumptions are temporary, user-supplied, and not forecasts. Treasury par yields are not ETF distribution yields. AI model and Telegram/Hermes connections remain deferred.

## Decision briefs and tracking

Each shortlist instrument has a rule-based decision brief with facts, gaps, entry conditions, risks, and a pending portfolio-fit statement until real holdings are reviewed. Enter bear/base/bull ending prices, a duration, annual cash, a return hurdle, and a maximum bear-case loss. These are your explicit assumptions, never generated forecasts. The app compares the base annualized equivalent and bear total return against your thresholds; it never upgrades a stance or authorizes allocation from those comparisons.

Save dated brief retains up to 30 immutable snapshots per research item, including the available provider response, dated quote, evidence, thesis, risks and scenario assumptions. Assumptions and history are browser-local and included in JSON backups. Existing workspaces remain schema v2 with optional new fields. Imported brief histories are validated. The older standalone market-panel calculator remains temporary; the per-instrument brief is the durable workflow.

On return to the shortlist or after a market refresh, the app rechecks saved dates and compares the current brief with the latest snapshot. It flags changes to prices, scenarios, thesis/entry conditions, valuation, evidence and pending checks. Archived conclusions are not current recommendations. This is review-time tracking, not an unattended background monitor or notification service. Stock/ETF provider activation still requires a user-supplied server-side ALPHA_VANTAGE_API_KEY; no AI credentials are needed.

## Optional OpenAI research explanations

AI-assisted explanation in each decision brief uses the OpenAI Responses API. Activation requires server-only `OPENAI_API_KEY` and `INVESTMENT_AI_ACCESS_TOKEN` (a private password of at least 24 characters) in Vercel, followed by a redeploy. Do not expose either through NEXT_PUBLIC variables or source control. Enter only the private access password in the app; never enter the OpenAI API key there. The password stays in component memory and is not part of workspace exports.

`/api/ai/review` fails closed without both credentials. Manual requests are authenticated, limited to the five supported symbols and 12,000 characters of research input, and capped at 1,800 output tokens. Default model is `gpt-6-luna`; server configuration `OPENAI_MODEL=gpt-6.1-sol` opts into the larger model. There are no automatic retries, background AI calls, search tools or trade tools. Use a dedicated OpenAI project and project spend controls as an additional cost boundary; these application limits are not a durable monthly budget cap.

Each explicit generate action sends the instrument thesis, entry condition, facts, gaps, risks, scenarios and up to 12 source claims to OpenAI. Holdings and profile notes are excluded. `store: false` disables Responses storage; it is not a promise of zero provider retention. Structured output is validated, unknown citations/refusals/incomplete responses are rejected, and AI drafts never modify the human stance, decision gates or snapshots. Drafts are temporary and marked when their inputs change. Sources are supplied evidence, not independently visited or verified by the AI. Current market data still requires the separate market-data connection.
