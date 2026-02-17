# Ship & Sustain v1 balance tuning notes

## Goal
- Reduce the CH gate trigger frequency in automated runs.
- Keep both player and AI able to win across seeds.
- Keep baseline verification with `chargebackEnabled = false` (v1 acceptance scope).

## Applied parameter changes (2026-02-17)
- `deliverEdgeDebtGain`: `1.0 -> 0.5`
- `sustainEdgeDebtReduction`: `1 -> 2`
- `ownerMaintenancePenalty`: `1 -> 0.3`
- `chPenaltyBacklogWeight`: `0.4 -> 0.12`
- `chPenaltyDebtWeight`: `0.25 -> 0.03`
- `accidentBaseProbability`: `0.01 -> 0.005`
- `accidentRiskWeight`: `0.03 -> 0.015`
- `accidentBacklogWeight`: `0.02 -> 0.006`
- `accidentChPenalty`: `3 -> 2`
- sprint start team alternates each sprint (`player -> ai -> player -> ...`)

## AI evaluation tuning
- default weights:
  - `dpWeight`: `1.45`
  - `ccWeight`: `1.35`
  - `riskAversion`: `1.45`
  - `leverageWeight`: `0.35`
  - `thresholdRiskWeight`: `0.8`
  - `revenueWeight`: `1.1`
  - `budgetWeight`: `0.3`
  - `chargebackRentWeight`: `0.25`
- difficulty presets:
  - `easy`: lookahead depth `0`
  - `normal`: lookahead depth `1`
  - `hard`: lookahead depth `2`
- UI supports overriding `lookaheadDepth` and `topK` for experiments.
- analyze preset (risk_aware):
  - `dpWeight`: `1.45`
  - `ccWeight`: `1.2`
  - `riskAversion`: `1.4`
  - `leverageWeight`: `0.35`
  - `thresholdRiskWeight`: `0.8`
  - `revenueWeight`: `1.1`
  - `budgetWeight`: `0.3`
  - `chargebackRentWeight`: `0.25`

## AI evaluation highlights
- immediate value:
  - DP gain / CC gain / revenue gain
- risk control:
  - backlog/debt penalty
  - projected sprint-end CH vs fail threshold penalty
- leverage:
  - investment on high-centrality dependency nodes/edges gets bonus
- economy:
  - budget delta component
  - chargeback rent potential bonus (when chargeback enabled)
  - edge-target multiplier for chargeback rent (to surface edge asset investment candidates)
  - chargeback rent cap (to prevent edge-invest over-concentration)

## Additional diagnostics
- Sprint summary now records CH loss breakdown:
  - backlog / debt / owner / accident
- Post-game report includes sprint metrics:
  - per-sprint Deliver/Sustain/Invest/Pass counts (player + AI)
  - per-sprint DP/CC gains and CH transition
- Web log panel includes AI decision trace:
  - chosen action score split (`local`, `lookahead`)
  - top candidate scores (`score/local/future`) per turn
- Post-game report includes:
  - play style classification
  - top bottleneck nodes
  - accident hotspots
  - chargeback transfer summary (paid/received count)
- 10 seed verification command:
  - `pnpm analyze:v1`
  - each run JSON includes `decisionTrace` for feature-level AI decision logs
- chargeback verification command:
  - `pnpm analyze:v2:chargeback`
  - outputs `docs/playlogs/v2-chargeback-*.json` and `docs/playlogs/v2-chargeback-summary.md`

## v2-ready config (implemented, default OFF)
- chargeback economy:
  - `chargebackEnabled`
  - `chargebackPerAssetUse`
- when enabled, `Work` on node with opponent-owned node assets or connected-edge assets transfers budget and increments owner revenue.
- edge asset runtime effect:
  - `Deliver` gets `+1 DP` when the acting team owns at least one asset on connected edges.

## v2 strategy retune (2026-02-17)
- objective:
  - keep edge investment active while recovering `asset_builder` win path
- AI options added:
  - `edgeRentTargetMultiplier` (default `3`, clamp `1..5`)
  - `chargebackRentCap` (default `4`, clamp `0..12`)
- analyze output:
  - summary now includes strategy action mix (deliver/sustain/invest-node/invest-edge/pass)
- updated `asset_builder` preset (`scripts/evaluate-v1.ts`):
  - `dpWeight`: `1.4`
  - `ccWeight`: `1.15`
  - `riskAversion`: `1.2`
  - `leverageWeight`: `0.5`
  - `thresholdRiskWeight`: `0.85`
  - `revenueWeight`: `1.0`
  - `budgetWeight`: `0.4`
  - `chargebackRentWeight`: `0.6`
  - `edgeRentTargetMultiplier`: `2.8`
  - `chargebackRentCap`: `3.2`
- latest `pnpm analyze:v2:chargeback` (2026-02-17):
  - `asset_builder` win count: `13`
  - `asset_builder` action mix: `invest(edge) 20 / turns 376 (5.3%)`

## v2 stability retune (2026-02-17)
- objective:
  - reduce CH failed rate while preserving edge investment and builder win path
- updated `asset_consumer` preset (`scripts/evaluate-v1.ts`):
  - `dpWeight`: `1.45`
  - `ccWeight`: `0.95`
  - `riskAversion`: `1.1`
  - `leverageWeight`: `0.1`
  - `thresholdRiskWeight`: `0.8`
  - `revenueWeight`: `0.6`
  - `budgetWeight`: `0.08`
  - `chargebackRentWeight`: `0.05`
- latest `pnpm analyze:v2:chargeback` (2026-02-17):
  - CH failed rate: `7.5%` (`40.0% -> 22.5% -> 7.5%`)
  - strategy win count: `asset_builder 15`, `asset_consumer 5`
  - action mix:
    - `asset_builder invest(edge) 22 / 381 turns (5.8%)`
    - `asset_consumer sustain 110 / 441 turns (24.9%)`
