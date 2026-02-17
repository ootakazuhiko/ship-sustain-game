# v1 balance simulation summary

- Run date: 2026-02-17T17:03:25.687Z
- Seeds: 1, 2, 3, 4, 5, 6, 7, 8, 9, 10
- Matchups: delivery_vs_risk, risk_vs_delivery
- Player wins / AI wins / Draws: 19 / 1 / 0
- Company failed count (CH < 40): 0/20
- Company failed rate: 0.0%
- Average final score: player 174.95, ai 133.20
- Average CH end: 49.40
- Average decisions per run: player 21.6, ai 22.4
- Average revenue: player 0.00, ai 0.00
- Average chargeback transfers: 0.00

## Acceptance check

- CH gate trigger rate < 50%: PASS (0.0%)
- At least two strategies have winning runs: PASS (delivery_push, risk_aware)

## Strategy win count

- delivery_push: 9
- risk_aware: 11

## Style distribution

- dp_focused: 10
- balanced: 10

## Average CH loss drivers

- backlog: 10.05
- debt: 4.85
- owner: 8.00
- accident: 7.70

## Per run

| Run | Seed | Matchup | Winner Team | Winner Strategy | Player Final | AI Final | CH | Failed | Style |
| --- | ---: | --- | --- | --- | ---: | ---: | ---: | --- | --- |
| delivery_vs_risk-seed-1 | 1 | delivery_vs_risk | player | delivery_push | 147.00 | 120.00 | 57 | no | dp_focused |
| risk_vs_delivery-seed-1 | 1 | risk_vs_delivery | player | risk_aware | 196.00 | 132.00 | 46 | no | balanced |
| delivery_vs_risk-seed-2 | 2 | delivery_vs_risk | player | delivery_push | 154.00 | 132.00 | 48 | no | dp_focused |
| risk_vs_delivery-seed-2 | 2 | risk_vs_delivery | player | risk_aware | 196.00 | 132.00 | 42 | no | balanced |
| delivery_vs_risk-seed-3 | 3 | delivery_vs_risk | player | delivery_push | 147.00 | 132.00 | 53 | no | dp_focused |
| risk_vs_delivery-seed-3 | 3 | risk_vs_delivery | player | risk_aware | 182.00 | 132.00 | 46 | no | balanced |
| delivery_vs_risk-seed-4 | 4 | delivery_vs_risk | player | delivery_push | 161.00 | 132.00 | 56 | no | dp_focused |
| risk_vs_delivery-seed-4 | 4 | risk_vs_delivery | player | risk_aware | 210.00 | 138.00 | 49 | no | balanced |
| delivery_vs_risk-seed-5 | 5 | delivery_vs_risk | player | delivery_push | 147.00 | 132.00 | 52 | no | dp_focused |
| risk_vs_delivery-seed-5 | 5 | risk_vs_delivery | player | risk_aware | 196.00 | 132.00 | 46 | no | balanced |
| delivery_vs_risk-seed-6 | 6 | delivery_vs_risk | ai | risk_aware | 133.00 | 144.00 | 52 | no | dp_focused |
| risk_vs_delivery-seed-6 | 6 | risk_vs_delivery | player | risk_aware | 182.00 | 138.00 | 43 | no | balanced |
| delivery_vs_risk-seed-7 | 7 | delivery_vs_risk | player | delivery_push | 154.00 | 144.00 | 50 | no | dp_focused |
| risk_vs_delivery-seed-7 | 7 | risk_vs_delivery | player | risk_aware | 210.00 | 138.00 | 41 | no | balanced |
| delivery_vs_risk-seed-8 | 8 | delivery_vs_risk | player | delivery_push | 154.00 | 132.00 | 52 | no | dp_focused |
| risk_vs_delivery-seed-8 | 8 | risk_vs_delivery | player | risk_aware | 180.00 | 132.00 | 44 | no | balanced |
| delivery_vs_risk-seed-9 | 9 | delivery_vs_risk | player | delivery_push | 168.00 | 132.00 | 58 | no | dp_focused |
| risk_vs_delivery-seed-9 | 9 | risk_vs_delivery | player | risk_aware | 224.00 | 138.00 | 50 | no | balanced |
| delivery_vs_risk-seed-10 | 10 | delivery_vs_risk | player | delivery_push | 154.00 | 120.00 | 55 | no | dp_focused |
| risk_vs_delivery-seed-10 | 10 | risk_vs_delivery | player | risk_aware | 204.00 | 132.00 | 48 | no | balanced |
