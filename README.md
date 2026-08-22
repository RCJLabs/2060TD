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

## Current state — v0.1 "LANDFALL": the campaign

The first shareable build. **Operation Landfall** is a nine-mission defense campaign
fought on your persistent base at Coos Bay, from the first militia probe (**DIG IN**)
to the combined-arms finale (**LANDFALL**):

- **Radio-log missions:** each mission opens with a terse CASCADE transmission, ends
  with an after-action report (stats, bonus objective, requisitions), and headlines one
  threat — sappers void your maze at M3, grenadiers outrange your guns at M5, NK
  infiltrators surface from tunnel mouths *inside your wire* at M6, a Russian T-72
  detachment probes at M7.
- **Requisition progression:** you start with walls, supply depots, and M2 nests.
  Victories unlock the rest — field defenses, claymores, fuel economy, autocannons,
  mortars, air power, CC expansions — always one mission before you need it.
- **Bonus objectives** pay +50% (hold CC above 90%, lose no structures, keep the maze).
- **Standard or Hard** (+30% hostiles), committed at first run with the
  alternate-history framing up front.
- **The persistent town** (M2) underneath it all: real-time economy, build timers,
  offline accrual, wrecks and repairs, save export/import — and the SKIRMISH ladder
  unlocks after M2 as the endless farming track between story missions.

The core mechanics carry through: active TD defense with CP-bought field works and
commander powers, damage-type × armor counters, and weighted pathfinding where
*everything* you build is an obstacle with HP — attackers always do the math.

## Quickstart

```bash
npm install
npm run dev        # the game (town → siege loop)
                   # ?playground=1 sandbox maze lab · ?demo=1 scripted battle
                   # ?demo=town showcase base (screenshot modes)
npm test           # sim + meta suites (pathfinding, combat, siege, town, determinism)
npm run build      # typecheck + production build
npm run screenshot # headless screenshots into screenshots/
```

## Controls

**Town:** left-click uses the selected tool (buildings place per click, walls drag-paint);
click a structure in select mode to inspect/upgrade/move/sell/repair; right-click or
`ESC` returns to select; `SPACE` launches the next assault.

**Siege:**

| Control | Action |
|---|---|
| Left-click / drag | Use selected tool (walls drag-paint; guns place per click) |
| Right-click / `ESC` | Cancel tool |
| `1`–`4` | Build item (setup/prep: wall, M2, autocannon, mortar · combat: MG, foxhole, claymore, HESCO) |
| `E` | Erase / refund (setup & prep only) |
| `Q` / `W` | Arm A-10 gun run / 155mm fire mission, then click the target |
| `SPACE` | Start assault / skip prep / return to base when it's over |
| `P` / `S` / `F` | Path visualization / sim speed ×1 ×2 ×4 / hold (pause) |
| `R` | Restart (standalone battles only — town battles have consequences) |

The sandbox (`?playground=1`): `1/2/3` wall/M2/erase, `W` militia, `B` sapper,
`SPACE` mixed wave.

## Project layout

```
docs/            Game design document, roadmap, locked decisions
src/sim/         Pure-TS deterministic simulation (no Phaser imports):
                 fixed-tick engine, siege phase machine, weighted multi-goal A*,
                 combat resolution, structure levels, seeded PRNG, state hashing
src/content/     Data, not code: damage table, China attackers, USA defenses &
                 buildings with level tables, CC gating, the assault ladder
src/meta/        The persistent layer: town state (timers, accrual, gating,
                 wrecks), the siege bridge, versioned saves
src/game/        Phaser 3 presentation: shared glyphs + BattleRenderer,
                 TownScene, SiegeScene, sandbox PlaygroundScene, UI kit, palette
tests/           Vitest suites: pathfinding, engine, siege flow, town meta,
                 assault ladder, damage table, determinism hashes
```

**Architecture rule:** `src/sim` never imports Phaser. Same seed + same commands ⇒
identical outcome (hash-tested), which is what makes replays, offline raid resolution,
and the future balance harness possible.

## Deploying

`.github/workflows/deploy.yml` builds, tests, and publishes `dist/` to GitHub Pages on
every push to `main` (once Pages is set to "GitHub Actions" in the repo settings).
The build is fully static and relative-pathed — any static host works:
`npm run build && rsync dist/ somewhere`.
