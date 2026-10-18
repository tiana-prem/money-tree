# Clover

Financial planning for your first full-time job. Clover helps recent graduates know what they can spend today, understand what a purchase costs their future, and grow toward their goals — with a virtual garden that rewards consistent weeks.

Built for the Hack like W@CC hackathon. React + Vite + TypeScript, no backend, no API keys. Runs fully offline with seeded demo data (product photos load from Wikimedia Commons, with an illustrated fallback if offline).

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # engine unit tests (Vitest)
npm run build      # static build in dist/ — deploy anywhere (Vercel, Netlify, GitHub Pages)
```

## Six tabs

| Tab | What it does |
|---|---|
| **Home** | Safe-to-spend (not your balance), cash vs. liabilities vs. investments, goal progress, financial audit, weekly streak, recent activity, recommended next action |
| **Plan** | Editable income, paystub, expenses, contributions and debt; monthly cash-flow chart; 12/24-month projection; milestone timeline; planning assumptions; DegreeWorks-style financial audit |
| **Goals** | Create / edit / pause / reprioritize / delete goals with live feasibility; over-allocation detection; goal detail with history + projection chart |
| **Simulate** | Searchable product catalog + custom purchases; price, date (slider), installments, recurrence; before/after comparison; goal delays; timeline; independently computed alternatives; per-goal "Show the math" ledger; apply-to-plan with confirmation |
| **Insights** | Calculated recommendations with accept/dismiss and math; planned vs. actual; month-over-month; employer 401(k) match; forecast report card (MAE / MAPE) |
| **Garden** | Points, streaks, shop with unlocks, place / move / remove items (click or drag), growth stages, themes and paths, points history |

## Architecture

```
src/
  engine/        Deterministic, pure, tested financial math (no UI, no AI)
    income.ts      pay-frequency normalization, pay-date schedules
    plan.ts        plan summary, savings capacity, priority allocation, safe-to-spend
    projection.ts  month-by-month projection, installments, recurring events
    goals.ts       remaining / required contribution / on-track analysis
    scenario.ts    baseline vs. scenario comparison, alternatives, "show the math" ledger
    match.ts       tiered employer 401(k) match
    forecast.ts    forecast report card (MAE, MAPE, like-for-like months)
    engine.test.ts
  garden/        Reward rules (idempotent by ISO week), items, SVG illustrations
  insights/      Recommendations, audit checklist, applying accepted recommendations
  explain/       Plain-language explanation templates (read engine output; never compute)
  data/          Seeded demo profile, synthetic transactions, product catalog
  state/         Zustand store (persisted to localStorage), derived-data cache, schema
  components/    UI primitives, charts, finance widgets
  pages/         The six tabs + onboarding
```

### Key modeling decisions

- **Money is integer cents** everywhere; formatting happens only at the edge.
- **Monthly basis** = per-paycheck × paychecks per year ÷ 12 (weekly 52, biweekly 26, semimonthly 24, monthly 12).
- **Safe to spend** = min(budget limit, cash limit). Only the unpaid remainder of each bill, debt payment and savings transfer is reserved, so nothing is double-counted. A negative result is shown as a shortfall.
- **Projection order (every month, every scenario):** income → essentials → discretionary → debt (interest first) → scheduled goal contributions → one-time purchases → recurring → buffer protection (pause lowest-priority contributions) → surplus sweep to goals by priority. Negative cash is flagged, never hidden. No investment returns or savings interest are assumed.
- **Goal delay** = scenario completion date − baseline completion date, from two runs of the same engine. "Not reached within the projection" is shown instead of inventing a date.
- **Simulations never touch balances or transactions.** Applying a scenario adds planned spending to the plan, after confirmation.
- **Garden points** are granted once per ISO week id, so reloads can't duplicate rewards. A week qualifies when discretionary spending ≤ (monthly budget × 12 ÷ 52) and every essential bill due that week is paid.
- **AI layer:** none configured. Explanations come from deterministic templates that read engine outputs. Personalization is a simple preference rule (repeatedly dismissed categories rank lower), not a learning model.

## Demo walkthrough

1. **Explore the demo** → Home shows take-home pay, safe-to-spend, goals, streak and a recommended action.
2. **Plan** → cash-flow allocation, projection chart (toggle 12/24 months), milestones, financial audit.
3. **Goals → Add goal** → enter target, saved amount and date; feasibility updates live.
4. **Simulate** → search "phone", add the flagship to the simulation.
5. Move the date slider → before/after and goal dates recalculate.
6. **Show the math** on a goal → inputs, rules and a month-by-month ledger.
7. **Alternatives** → try the midrange phone or a later date; the baseline is untouched.
8. **Apply to my plan** → confirm; it becomes planned spending (no transaction recorded).
9. **Insights** → recommendations reflect the change; open the forecast report card.
10. **Garden** → buy an item, select a plot to place it.
11. Reload → everything persists. **Reset demo data** restores the original sample.

All data is simulated. Clover is an educational planning tool, not financial, tax or investment advice.
