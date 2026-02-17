# v0 playlog summary

- Run date: 2026-02-17T13:36:09.791Z
- Seeds: 42, 314, 2718
- Player wins: 1
- AI wins: 2
- Draws: 0
- Company failed count (CH < 40): 3/3
- Average final score: player 59.00, ai 63.00
- Average CH end: 0.00

## Per seed

| Seed | Winner | Player Final | AI Final | CH | Company Failed |
| --- | --- | ---: | ---: | ---: | --- |
| 42 | player | 60.00 | 57.00 | 0 | yes |
| 314 | ai | 57.00 | 66.00 | 0 | yes |
| 2718 | ai | 60.00 | 66.00 | 0 | yes |

## Initial balance observations

- All runs ended with CH < 40. End-of-sprint penalties are likely too strong for v0.
- Win/loss is mixed across seeds. Current heuristic produces non-trivial outcomes.
- Detailed raw logs are saved as JSON files in docs/playlogs/.
