# LAST LINE *(working title)*

A hybrid **tower defense / base builder** set in a gritty modern alternate-history war:
North Korea, China, and Russia attack America and the United Nations. Pick a nation; your
town is the battlefield — the walls that protect your economy are the maze your enemies
fight through.

- **Defense is the action game:** real-time tower defense on top of your persistent base —
  spend Command Points placing field defenses and calling fire missions mid-wave.
- **Offense is the thinking game:** scout, compose a force, assign entry points and
  doctrines; a deterministic simulator resolves the raid into a watchable replay.
- **The war continues while you're away:** offline resource generation, build timers, and
  AI probe raids you come back to as replays.

Full design in [`docs/GDD.md`](docs/GDD.md) · milestones in [`docs/ROADMAP.md`](docs/ROADMAP.md)
· the ten locked decisions in [`docs/DECISIONS.md`](docs/DECISIONS.md).

## Current state — M0: Maze Playground

The riskiest mechanic, proven first: **weighted maze pathfinding** inside a deterministic,
fixed-tick simulation. Attackers weigh "walk around the walls" against "break through them"
(`wall HP ÷ unit wall-DPS`), so mazing works, sappers counter turtling, and full enclosure
buys time instead of immunity.

The playground lets you paint walls, drop turrets, and spawn attackers to watch their paths
re-route live.

## Quickstart

```bash
npm install
npm run dev        # open the printed URL; add ?demo=1 for a pre-built maze demo
npm test           # sim unit tests (pathfinding, determinism, engine)
npm run build      # typecheck + production build
npm run screenshot # headless screenshot of the demo into screenshots/
```

## Playground controls

| Control | Action |
|---|---|
| Left-click / drag on grid | Use current tool (build wall / place turret / erase) |
| `1` `2` `3` | Select tool: Wall / Turret / Erase |
| `W` | Spawn a walker (paths around walls) |
| `B` | Spawn a breacher (chews through walls) |
| `Space` | Spawn a mixed wave of 10 |
| `P` | Toggle path visualization |
| `S` | Cycle sim speed ×1 / ×2 / ×4 |
| `R` | Reset the battlefield |

Attackers enter from the left edge and push toward the Command Center on the right. The HUD
tracks kills and leaks.

## Project layout

```
docs/           Game design document, roadmap, locked decisions
src/sim/        Pure-TS deterministic simulation (no Phaser imports) — engine, grid,
                weighted A*, seeded PRNG, entities
src/content/    Data definitions (unit/turret profiles)
src/game/       Phaser 3 presentation: scenes, palette, input
tests/          Vitest suites for the sim (behavior + determinism hashes)
```

**Architecture rule:** `src/sim` never imports Phaser. Same seed + same commands ⇒ identical
outcome (hash-tested), which is what makes replays, offline raid resolution, and the future
balance harness possible.
