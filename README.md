# Hermes Investment Intelligence

An agent-ready personal investment research OS for Idris: evidence, frontier themes, portfolio fit, thesis memos, and decision journaling.

## Scope

This web workspace supports investment research and decision preparation. It does not execute trades, connect to brokers, move money, or provide licensed financial advice.

## Current modules

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
