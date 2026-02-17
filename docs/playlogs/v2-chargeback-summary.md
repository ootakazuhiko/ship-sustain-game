# v2-chargeback balance simulation summary

- Run date: 2026-02-17T18:50:52.259Z
- Seeds: 1, 2, 3, 4, 5, 6, 7, 8, 9, 10
- Matchups: delivery_vs_risk, risk_vs_delivery, builder_vs_consumer, consumer_vs_builder
- Player wins / AI wins / Draws: 33 / 7 / 0
- Company failed count (CH < 40): 3/40
- Company failed rate: 7.5%
- Average final score: player 178.46, ai 146.64
- Average CH end: 46.15
- Average decisions per run: player 21.2, ai 21.2
- Average revenue: player 0.78, ai 1.00
- Average chargeback transfers: 1.75

## Acceptance check

- CH gate trigger rate < 50%: PASS (7.5%)
- At least two strategies have winning runs: PASS (delivery_push, risk_aware, asset_builder, asset_consumer)

## Strategy win count

- delivery_push: 10
- risk_aware: 10
- asset_builder: 15
- asset_consumer: 5

## Style distribution

- dp_focused: 30
- balanced: 10

## Average CH loss drivers

- backlog: 11.53
- debt: 6.63
- owner: 8.00
- accident: 7.70

## Strategy action mix

- delivery_push: turns=441, deliver=438 (99.3%), sustain=3 (0.7%), invest(node)=0 (0.0%), invest(edge)=0 (0.0%), invest(maturity)=0 (0.0%), pass=0 (0.0%)
- risk_aware: turns=435, deliver=246 (56.6%), sustain=184 (42.3%), invest(node)=0 (0.0%), invest(edge)=5 (1.1%), invest(maturity)=0 (0.0%), pass=0 (0.0%)
- asset_builder: turns=381, deliver=307 (80.6%), sustain=14 (3.7%), invest(node)=38 (10.0%), invest(edge)=22 (5.8%), invest(maturity)=0 (0.0%), pass=0 (0.0%)
- asset_consumer: turns=441, deliver=331 (75.1%), sustain=110 (24.9%), invest(node)=0 (0.0%), invest(edge)=0 (0.0%), invest(maturity)=0 (0.0%), pass=0 (0.0%)

## Per run

| Run | Seed | Matchup | Winner Team | Winner Strategy | Player Final | AI Final | CH | Failed | Style |
| --- | ---: | --- | --- | --- | ---: | ---: | ---: | --- | --- |
| delivery_vs_risk-seed-1 | 1 | delivery_vs_risk | player | delivery_push | 147.00 | 120.00 | 57 | no | dp_focused |
| risk_vs_delivery-seed-1 | 1 | risk_vs_delivery | player | risk_aware | 196.00 | 132.00 | 46 | no | balanced |
| builder_vs_consumer-seed-1 | 1 | builder_vs_consumer | player | asset_builder | 252.00 | 170.33 | 41 | no | dp_focused |
| consumer_vs_builder-seed-1 | 1 | consumer_vs_builder | player | asset_consumer | 174.00 | 164.00 | 42 | no | dp_focused |
| delivery_vs_risk-seed-2 | 2 | delivery_vs_risk | player | delivery_push | 154.00 | 132.00 | 48 | no | dp_focused |
| risk_vs_delivery-seed-2 | 2 | risk_vs_delivery | player | risk_aware | 190.00 | 178.50 | 42 | no | balanced |
| builder_vs_consumer-seed-2 | 2 | builder_vs_consumer | player | asset_builder | 224.29 | 144.00 | 44 | no | dp_focused |
| consumer_vs_builder-seed-2 | 2 | consumer_vs_builder | ai | asset_builder | 81.92 | 82.00 | 37 | yes | dp_focused |
| delivery_vs_risk-seed-3 | 3 | delivery_vs_risk | player | delivery_push | 147.00 | 132.00 | 53 | no | dp_focused |
| risk_vs_delivery-seed-3 | 3 | risk_vs_delivery | ai | delivery_push | 176.00 | 183.50 | 46 | no | balanced |
| builder_vs_consumer-seed-3 | 3 | builder_vs_consumer | player | asset_builder | 240.00 | 157.33 | 44 | no | dp_focused |
| consumer_vs_builder-seed-3 | 3 | consumer_vs_builder | ai | asset_builder | 160.00 | 162.00 | 42 | no | dp_focused |
| delivery_vs_risk-seed-4 | 4 | delivery_vs_risk | player | delivery_push | 161.00 | 132.00 | 56 | no | dp_focused |
| risk_vs_delivery-seed-4 | 4 | risk_vs_delivery | player | risk_aware | 196.00 | 137.00 | 49 | no | balanced |
| builder_vs_consumer-seed-4 | 4 | builder_vs_consumer | player | asset_builder | 207.25 | 144.00 | 49 | no | dp_focused |
| consumer_vs_builder-seed-4 | 4 | consumer_vs_builder | player | asset_consumer | 183.67 | 178.00 | 44 | no | dp_focused |
| delivery_vs_risk-seed-5 | 5 | delivery_vs_risk | player | delivery_push | 147.00 | 132.00 | 52 | no | dp_focused |
| risk_vs_delivery-seed-5 | 5 | risk_vs_delivery | player | risk_aware | 196.00 | 132.00 | 46 | no | balanced |
| builder_vs_consumer-seed-5 | 5 | builder_vs_consumer | player | asset_builder | 240.50 | 180.00 | 43 | no | dp_focused |
| consumer_vs_builder-seed-5 | 5 | consumer_vs_builder | ai | asset_builder | 160.00 | 192.00 | 42 | no | dp_focused |
| delivery_vs_risk-seed-6 | 6 | delivery_vs_risk | ai | risk_aware | 133.00 | 144.00 | 52 | no | dp_focused |
| risk_vs_delivery-seed-6 | 6 | risk_vs_delivery | player | risk_aware | 182.00 | 138.00 | 43 | no | balanced |
| builder_vs_consumer-seed-6 | 6 | builder_vs_consumer | player | asset_builder | 214.50 | 192.00 | 41 | no | dp_focused |
| consumer_vs_builder-seed-6 | 6 | consumer_vs_builder | ai | asset_builder | 160.00 | 178.00 | 42 | no | dp_focused |
| delivery_vs_risk-seed-7 | 7 | delivery_vs_risk | player | delivery_push | 154.00 | 144.00 | 50 | no | dp_focused |
| risk_vs_delivery-seed-7 | 7 | risk_vs_delivery | player | risk_aware | 210.00 | 138.00 | 41 | no | balanced |
| builder_vs_consumer-seed-7 | 7 | builder_vs_consumer | player | asset_builder | 128.17 | 84.83 | 37 | yes | dp_focused |
| consumer_vs_builder-seed-7 | 7 | consumer_vs_builder | ai | asset_builder | 74.83 | 88.00 | 38 | yes | dp_focused |
| delivery_vs_risk-seed-8 | 8 | delivery_vs_risk | player | delivery_push | 154.00 | 132.00 | 52 | no | dp_focused |
| risk_vs_delivery-seed-8 | 8 | risk_vs_delivery | player | risk_aware | 176.00 | 170.00 | 44 | no | balanced |
| builder_vs_consumer-seed-8 | 8 | builder_vs_consumer | player | asset_builder | 215.00 | 156.00 | 42 | no | dp_focused |
| consumer_vs_builder-seed-8 | 8 | consumer_vs_builder | player | asset_consumer | 167.17 | 164.00 | 41 | no | dp_focused |
| delivery_vs_risk-seed-9 | 9 | delivery_vs_risk | player | delivery_push | 168.00 | 132.00 | 58 | no | dp_focused |
| risk_vs_delivery-seed-9 | 9 | risk_vs_delivery | player | risk_aware | 224.00 | 138.00 | 50 | no | balanced |
| builder_vs_consumer-seed-9 | 9 | builder_vs_consumer | player | asset_builder | 240.67 | 144.00 | 52 | no | dp_focused |
| consumer_vs_builder-seed-9 | 9 | consumer_vs_builder | player | asset_consumer | 185.33 | 178.00 | 46 | no | dp_focused |
| delivery_vs_risk-seed-10 | 10 | delivery_vs_risk | player | delivery_push | 154.00 | 120.00 | 55 | no | dp_focused |
| risk_vs_delivery-seed-10 | 10 | risk_vs_delivery | player | risk_aware | 183.00 | 132.00 | 48 | no | balanced |
| builder_vs_consumer-seed-10 | 10 | builder_vs_consumer | player | asset_builder | 200.25 | 144.00 | 49 | no | dp_focused |
| consumer_vs_builder-seed-10 | 10 | consumer_vs_builder | player | asset_consumer | 181.00 | 164.00 | 42 | no | dp_focused |
