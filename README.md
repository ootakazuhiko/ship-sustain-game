# Ship & Sustain Game

1v1 (Player vs AI) management simulation game for balancing delivery output and company health.

## Stack
- pnpm workspace
- TypeScript
- Vite + React (`apps/web`)
- Vitest
- ESLint + Prettier

## Workspace structure
- `apps/web`: playable browser UI
- `packages/engine`: pure game state model and transition rules
- `packages/ai`: evaluation-based AI action selection
- `docs/specs/mvp-v0.md`: temporary frozen MVP decisions

## Quick start
```bash
pnpm install
pnpm dev
```

Open `http://localhost:5173`.

## Commands
```bash
pnpm lint
pnpm test
pnpm test:e2e
pnpm build
pnpm analyze:v1
pnpm analyze:v2:chargeback
```

## Manual playable check (MVP)
1. Set seed in the top-right panel.
2. Start a new game.
3. Play actions on selected node until 4 sprints complete.
4. Verify result panel shows DP/CC/CH/final score.
5. Restart with same seed and repeat to validate deterministic behavior.
6. Beginner tutorial: `docs/manuals/beginner-tutorial.md`
7. Detailed manual: `docs/manuals/test-play-manual.md`

## Current rule highlights (v1/v2)
- 4 sprints fixed
- capacity per team per sprint: 6
- actions: Work(Deliver/Sustain), Invest(Maturity/NodeAsset/EdgeAsset)
- deliver edge bonus: +1 DP when at least one connected edge asset is owned by acting team
- CH gate: if CH < 40 then final score *= 0.5
- chargeback: OFF (default)

Detailed formulas are in `docs/specs/mvp-v0.md`.

## Balance simulation
- `pnpm analyze:v1`
- output:
  - `docs/playlogs/v1-<matchup>-seed-*.json`
  - `docs/playlogs/v1-summary.md`
  - each run JSON includes `decisionTrace` (AI feature vectors and selected action score)
  - summary includes `Strategy action mix` (deliver/sustain/invest node/invest edge/pass by strategy)
- chargeback experiment:
  - `pnpm analyze:v2:chargeback`
  - output:
    - `docs/playlogs/v2-chargeback-<matchup>-seed-*.json`
    - `docs/playlogs/v2-chargeback-summary.md`
  - latest tuning notes and recommended v2 presets: `docs/specs/v1-balance-tuning.md`
  - current reference (2026-02-17): CH failed rate `7.5%`, `asset_builder` edge invest `5.8%`

## AI difficulty
- `easy`: no lookahead (fast)
- `normal`: 1-ply lookahead
- `hard`: 2-ply lookahead
- web UI allows overriding `Depth` and `TopK` per run for tuning.
- AI evaluation includes:
  - projected CH threshold risk penalty
  - leverage bonus for high-centrality investment targets
  - revenue/budget components and chargeback-rent potential
  - additional edge-target multiplier for chargeback-rent scoring
  - chargeback rent cap to suppress over-invest loops
- web UI shows `AI Decision Trace`:
  - chosen action score split (`local`, `lookahead`)
  - top candidate comparisons per AI turn
- result panel includes sprint metrics:
  - per-sprint Deliver/Sustain/Invest/Pass counts (player + AI)
  - per-sprint DP/CC gains and CH transition (`loss`, `after`)
- web panel supports edge selection and `Invest Edge Asset`.
- result panel includes chargeback summary (paid/received/transfers).

## Chargeback option
- engine config supports chargeback toggle:
  - `chargebackEnabled` (default `false`)
  - `chargebackPerAssetUse` (default `1`)
- when enabled, using opponent-owned node/connected-edge asset in `Work` transfers budget to owner team and adds owner `revenue`.
