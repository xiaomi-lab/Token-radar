# token-radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/xiaomi-lab/token-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/xiaomi-lab/token-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

A token launch radar: 226 pre-token protocols ranked by implied value, priced the way the market prices live tokens in their own category. The watchlist (40 protocols, TVL ≥ $50M, no token) is covered in full, plus an early radar of 186 pre-token protocols below the floor. Every row carries a concrete farm plan with costs and time, and the dashboard is a fully offline, sortable, filterable page with a detail view for every protocol.

The model is comparables-based, not a name list. For each category it takes the median market-cap/TVL of live-token protocols in that category, clamps it to [0.02, 1.5], shrinks it toward the global median (0.214 across 129 live protocols) with k = 3, and clamps the result to [0.05, 1.0]. Implied value is then TVL × category multiple × a growth multiplier (7-day TVL change, clamped to [−60%, +120%], weighted 0.5×) × a maturity multiplier (age since first listing, unknown age 365 days) × a chain multiplier (+2% per extra chain, up to 5). No protocol name is special-cased anywhere.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input <path-to-snapshot.json>
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=a0xag3vq&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
