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

- Automatic current-price feed and automated valuation models (price and valuation are sourced review inputs)
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
