[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/Unge32/best-game/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/Unge32/best-game/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

Entry for [make.fun's "Make the best game" bounty](https://make.fun/bounty/best-game-01) ($1,000 in USDC).

# Emberwarden

Defend the Last Lantern. A 2D canvas tower-defence game that runs offline
from static files — no build step, no network requests, no libraries.

Cinders march down the ember road to snuff out the Last Lantern. Build
towers on the open ground, hold 10 waves, and keep the flame alive.

## How to play

Serve the `game/` folder with any static server (for example
`python3 -m http.server` inside `game/`) and open `index.html` in a
desktop browser.

- **Mouse:** pick a tower from the shop (right panel), click a glowing
  plot to build it. Click a built tower to upgrade or sell it.
- **Keys:** `1` / `2` / `3` pick a tower, `Space` starts the next wave,
  `P` pauses, `M` mutes, `Esc` deselects, `Enter` starts / restarts.
- **Goal:** survive all 10 waves. The lantern has 10 hit points; every
  cinder that reaches it costs 1. If the flame dies, the run ends.
- **Towers:** Spark Spire (fast, cheap), Frost Obelisk (slows the horde),
  Ember Cannon (heavy splash damage). Towers gain levels up to 3.
- **Gold:** kills pay gold, clearing a wave pays a bonus. Spend it on
  towers and upgrades.

## Screenshots

Deterministic scenes for the entry: `?shot=start|play|end|win&seed=N`
stages the scene, renders it twice and sets `window.__shotReady`.

## Entry

`main.ts` (Node 22, standard library only) copies `game/` and
`screenshots/` to `/output` and writes `/output/dossier.json` with the
vendored `vendor/makefun-game.ts` library:

```
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

MIT licensed. Original art, sounds and names — no assets from any other game.
