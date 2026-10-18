# Clover

Financial planning for your first full-time job. Clover helps recent graduates know what they can spend today, understand what a purchase costs their future, and grow toward their goals — with a virtual garden that rewards consistent weeks.

Built for the Hack like W@CC hackathon. React + Vite + TypeScript, no backend, no API keys. Runs fully offline with seeded demo data (product images load from the DummyJSON CDN and Wikimedia Commons, with an illustrated fallback if offline).

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # engine unit tests (Vitest)
npm run build      # static build in dist/ — deploy anywhere (Vercel, Netlify, GitHub Pages)
```

## Four tabs

| Tab | What it does |
|---|---|
| **Home** | Safe-to-spend (not your balance), your streak and friend rank, suggestions with Show the math, goal progress. **Edit my money** opens every plan input in one place. |
| **Simulate** | "Can I afford it?" Pick a product or a custom purchase, see which goals it delays, compare cheaper or later options, apply it to your plan. |
| **Goals** | Add, edit, pause, reprioritize and delete goals with live feasibility; where you're headed (projection) and milestones. |
| **Garden** | Weekly streak and points, a shop with unlocks, place and grow items, friends leaderboard, points history. |

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
    engine.test.ts
  garden/        Reward rules (idempotent by ISO week), items, SVG illustrations, demo friends
  insights/      Recommendations and applying accepted ones
  explain/       Plain-language explanation templates (read engine output; never compute)
  data/          Seeded demo profile, synthetic transactions, product catalog
  state/         Zustand store (persisted to localStorage), derived-data cache, schema
  components/    UI primitives, charts, finance widgets
  pages/         The four tabs, Edit my money, onboarding
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

1. **Explore the demo** → Home shows safe-to-spend, your 2-week streak, suggestions and goals.
2. **Goals → Add goal** → enter a target and date; feasibility updates as you type.
3. **Simulate** → search "phone" and add the flagship → see which goals it delays.
4. Drag the date slider, or try the cheaper option under Alternatives. Your plan isn't touched.
5. **Show the math** on a goal → the month-by-month ledger behind the delay.
6. **Apply to my plan** → it becomes planned spending (no transaction recorded).
7. **Garden** → buy an item, place it, and check where you rank among friends.
8. Reload → everything persists. **Reset demo data** restores the original sample.

Demo friends on the leaderboard are simulated; real friends would need accounts and a server.

All data is simulated. Clover is an educational planning tool, not financial, tax or investment advice.
