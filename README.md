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

## Current state — M1: Siege vertical slice

**HOLD THE LINE** — the first playable battle of the Landfall arc. Five authored waves of
China's assault roster against your USA firebase at Coos Bay:

- **Fortify** (Supplies): lay wall mazes and permanent emplacements — M2 nest, 25mm
  autocannon, 120mm mortar — then start the assault.
- **Fight** (Command Points): earn CP passively and per kill; drop field defenses mid-wave
  (deployable MG, rifle foxhole, claymores, HESCO barricades) and call commander powers
  (A-10 gun run, 155mm fire mission).
- **Prep windows** between waves: repair, re-maze, and read the intel on what's inbound.
- Deterministic combat with damage-type × armor-class counters: small arms shred infantry,
  kinetic kills armor, explosive punishes crowds and structures.
- Six attacker types with real behaviors: militia swarms, rifle squads, wall-chewing
  sappers, grenadiers that stand off and shell your guns, ZBD IFVs, and a Type 99 MBT.
- Attackers weigh *going around* against *breaking through* everything you place — walls,
  barricades, even gun emplacements are obstacles with HP, not absolute barriers.

Losing the Command Center loses the battle. Clear all five waves and the sector holds.

## Quickstart

```bash
npm install
npm run dev        # the mission; add ?playground=1 for the sandbox maze lab,
                   # ?demo=1 for a scripted mid-battle (screenshot mode)
npm test           # sim test suites (pathfinding, combat, siege flow, determinism)
npm run build      # typecheck + production build
npm run screenshot # headless screenshot of the demo battle into screenshots/
```

## Mission controls

| Control | Action |
|---|---|
| Left-click / drag | Use selected tool (walls drag-paint; guns place per click) |
| Right-click / `ESC` | Cancel tool |
| `1`–`4` | Select build item (setup/prep: wall, M2, autocannon, mortar · combat: MG, foxhole, claymore, HESCO) |
| `E` | Erase / refund (setup & prep only) |
| `Q` / `W` | Arm A-10 gun run / 155mm fire mission, then click the target |
| `SPACE` | Start assault / skip prep |
| `P` | Toggle path visualization |
| `S` | Sim speed ×1 / ×2 / ×4 |
| `R` | Restart the mission |

The sandbox (`?playground=1`): `1/2/3` wall/M2/erase, `W` militia, `B` sapper,
`SPACE` mixed wave, same view keys.

## Project layout

```
docs/            Game design document, roadmap, locked decisions
src/sim/         Pure-TS deterministic simulation (no Phaser imports):
                 fixed-tick engine, siege phase machine, weighted multi-goal A*,
                 combat resolution, seeded PRNG, state hashing
src/content/     Data, not code: damage table, China attackers, USA defenses,
                 powers, the HOLD THE LINE wave scripts
src/game/        Phaser 3 presentation: BattleRenderer (shared battlefield
                 drawing), SiegeScene, sandbox PlaygroundScene, UI kit, palette
tests/           Vitest suites: pathfinding, engine behavior, siege flow,
                 damage table, determinism hashes
```

**Architecture rule:** `src/sim` never imports Phaser. Same seed + same commands ⇒
identical outcome (hash-tested), which is what makes replays, offline raid resolution,
and the future balance harness possible.
