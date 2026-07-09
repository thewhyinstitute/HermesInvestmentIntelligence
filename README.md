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

1. Core research OS UI and local state
2. Persistent database layer
3. Hermes `investment` profile integration
4. Telegram research request flow via IdrisInvestmentBot
5. Market data adapters: yfinance/OpenBB/FinanceToolkit/PyPortfolioOpt
6. Decision journal and recurring frontier radar

## Guardrails

- Research support only
- No broker connection in MVP
- No trade execution
- Every memo must separate facts, assumptions, risks, and sources
- Decisions remain human-owned
- Never store secrets, account numbers, private keys, or seed phrases
