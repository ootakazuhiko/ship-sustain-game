# Ship & Sustain MVP v0 (temporary freeze)

## Decision date
- 2026-02-17

## Scope
- Single scenario, 4 sprints, 1 player vs AI.
- CH gate enabled: if final CH < 40 then final score *= 0.5.
- Chargeback disabled in v0.

## Fixed parameters
- Capacity: single token model.
  - Base capacity per team per sprint: 6
- Budget per team at game start: 4
- Sprint count: 4
- Node count: 12
- Edge count: 18
- Maturity range: 0-3

## Actions
- Work(node, Deliver)
  - cost: capacity 1
  - DP += demand + maturity + ownerBonus
  - backlog += 1 on node
  - integrationDebt += couplingWeight on each 1-hop edge
- Work(node, Sustain)
  - cost: capacity 1
  - backlog -= 2 (min 0)
  - integrationDebt -= 1 on each 1-hop edge (min 0)
  - CC += 1 when node risk >= 4 and backlog <= 2 after action
- Invest(node, MaturityUp)
  - cost: capacity 2 + budget 1
  - maturity += 1 (max 3)
  - CC += 1
- Invest(node, BuildAsset)
  - cost: capacity 2 + budget 1
  - add asset tag to node
  - CC += 1

## Owner rule (temporary)
- owner bonus on Deliver: +1 DP when team matches node owner.
- owner maintenance cost in sprint-end: +1 CH penalty per owner node with backlog > 0.

## Sprint-end
- Base CH loss = floor(totalBacklog * 0.4 + totalIntegrationDebt * 0.25 + ownerMaintenancePenalty)
- Accident probability per node:
  - p = min(0.95, 0.01 + risk * 0.03 + backlog * 0.02)
- Accident effect (when triggered)
  - CH -= 3
  - next sprint capacity of owner team -= 1 (if no owner, both teams -= 1)

## Score
- Dividend pool B = 5 * CH
- shareRaw(player) = B * CC_player / (CC_player + CC_ai)
- share(player) = min(shareRaw(player), DP_player)
- final(player) = DP_player + share(player) + revenue_player - penalty_player
- if CH < 40 then final(player) *= 0.5

## Open Questions moved to v1
- Split capacity types (Dev/Ops/etc)
- Multi-hop debt propagation
- Chargeback enablement and pricing
- Stronger accident taxonomy
- Asset usage economy
