# Hermes Investment Intelligence

An agent-ready personal investment research OS for Idris: evidence, frontier themes, portfolio fit, thesis memos, and decision journaling.

## MVP scope

This first build is a web-based research workspace. It does not execute trades, connect to brokers, or provide licensed financial advice.

Current modules:

- Investment Profile
- Research Inbox
- Opportunity Lifecycle
- Evidence Library
- Thesis Workbench
- Portfolio Fit
- Frontier Radar
- Operating Rules

## Tech stack

- Next.js
- TypeScript
- Tailwind CSS
- Vercel-ready

## Local development

```bash
npm install
npm run dev
```

## Verification

```bash
npm run typecheck
npm run build
```

## Planned phases

1. Core research OS UI and local state — complete
2. Browser-local persistent workspace with JSON backup/restore — complete
3. Server database layer and authenticated cloud sync
4. Hermes `investment` profile integration
5. Telegram research request flow via IdrisInvestmentBot
6. Market data adapters: yfinance/OpenBB/FinanceToolkit/PyPortfolioOpt
7. Decision journal and recurring frontier radar

## Guardrails

- Research support only
- No broker connection in MVP
- No trade execution
- Every memo must separate facts, assumptions, risks, and sources
- Decisions remain human-owned
- Never store secrets, account numbers, private keys, or seed phrases
