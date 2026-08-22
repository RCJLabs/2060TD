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

## Current state — M2: The persistent town

The game is now a loop, not a mission. Your **forward base at Coos Bay** exists between
battles: it generates Supplies and Fuel in real time (even while you're away, capped at
8 hours), buildings construct and upgrade on timers, and your save lives in the browser
with file export/import.

- **Build the base:** Supply/Fuel Depots, Storage Bunkers, an Engineering Bay that
  speeds construction, wall mazes, and emplacements — all gated by your Command Center's
  level (counts *and* upgrade levels; leveled guns carry their stats into battle).
- **Defend it for real:** the assault ladder generates escalating attacks — 3 waves of
  infantry at level 1, grenadiers at 2, armor and the Type 99 from 3, scaling counts
  beyond. The battle happens on your *actual* town layout: economy buildings are big
  demolishable obstacles, walls lost stay lost, and destroyed structures come back
  wrecked until repaired.
- **Consequences both ways:** victory pays loot, converts unspent CP into salvage, and
  advances the ladder; defeat lets the raiders take 15% of your stores.
- **Ordnance:** stock A-10 and 155mm charges with Fuel in town; each cast in battle
  consumes one.

The M1 siege mechanics (active TD with CP-bought field defenses, powers, prep windows,
damage-type × armor counters, everything-is-demolishable pathing) all carry forward.

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
| `P` / `S` | Path visualization / sim speed ×1 ×2 ×4 |
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
