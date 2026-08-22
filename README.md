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

## Current state — v0.5: the northern front

**Russia is playable** — the third faction, and the first shipped as a pure content
drop on the role pipeline (no plumbing changes):

- **RUSSIAN GROUND FORCES — Operation Iron Corridor.** Hold the Nome railhead, the
  Alaskan end of the ice-road corridor, through six missions against the US
  counteroffensive — then counter-raid with conscripts, motor rifle squads, UR
  demolition teams, RPG-29s, BTR-82As, and the T-72B3.
- **OVERBUILT**, the faction signature: everything carries ~25–30% more concrete —
  walls at 190 HP, bunkers, the command post — but town builds cost ~15% more, take
  30% longer, and wreck repairs run 42% of cumulative cost instead of 30%.
- **Artillery doctrine:** a BM-21 Grad rocket line instead of a gun run, and the
  TOS-1A thermobaric salvo — five huge fuel-air blasts. The balance harness confirms
  the faction thesis: Russia's late-game raids stall without preparation, and clear
  when a thermobaric fire plan hits the guns before the armor walks in.

## v0.4: the intel war

The depth patch: signals, doctrine, and fire support.

- **Intel is the third resource.** The Signals Station (both factions) generates it;
  scouting Front Line targets now costs Intel, not Supplies.
- **Research & doctrine** (`T`): nine projects in three branches — **FORTIFY** (wall HP,
  emplacement damage, cheaper field works), **STRIKE** (raid unit HP/damage, faster
  training), **LOGISTICS** (storage, generation, cheaper recon). One project at a time;
  it finishes while you're away. Effects are carried inside each battle's config, so
  replays of old battles keep their original math.
- **Pre-planned fire support on raids.** The same A-10 / 155mm (or MLRS / PLZ-05)
  charges you stock for defense can ride with a raid: set a fire plan per power —
  T+15/40/70 seconds, on the guns or on the command post — and the hands-off resolver
  executes it. Attacker-side ordnance pounds structures and walls, never your own
  units, and every replay re-fires the plan identically.
- **Operations map** (`M`): fight the next objective or replay held sectors at 35% pay.
- **Defeat forensics:** battle reports, replays, and the defense log name what landed
  the killing blow on your Command Center.
- **Presentation pass:** vehicles face their heading, tower barrels track targets,
  muzzle flashes, textured ground, synthesized battle SFX and radio chatter (zero audio
  assets), colorblind-safe hostile palette toggle, siege ×8 speed.
- Saves migrate (v5); missions you'd already cleared re-grant the new Signals
  requisition automatically.

## v0.3: pick your war

China is playable. The first screen now asks whose war you're fighting:

- **UNITED STATES — Operation Landfall.** Hold Coos Bay through the nine-mission
  campaign, then raid PLA Front Line bases. Fewer soldiers, better hardware.
- **PLA EXPEDITIONARY FORCE — Operation Eastern Tide.** Hold the Grays Harbor
  beachhead through six missions against Guard swarms, Ranger companies, engineer
  breach teams, Javelin overwatch, and Abrams spearheads — then counter-raid US
  firebases with militia tides, sappers, ZBD-04s, and the Type 99.
- **One pipeline, two wars:** every structure kind is a shared *role* (gun nest,
  anti-armor post, mortar, strafe tasking…), so the same gating, saves, unlock keys,
  and scenes serve both sides — factions are pure data behind `content/factions.ts`.
  China's kit answers different threats: shaped-charge HJ-8 posts because their armor
  problem is the M1 Abrams, MLRS ripples instead of an A-10, PLZ-05 saturation
  instead of precision 155s.
- **Balance harness:** `npm run balance` fights ~1,400 seeded battles headlessly in
  ~12 seconds — raid clear/destruction/loss matrices per tier and permanent-layer
  hold% per stage, for both factions ([`docs/BALANCE.md`](docs/BALANCE.md)). The
  first tuning pass shipped with it (real demolition for breachers, later mortars in
  low-tier firebases, cheaper PLA manpower, tougher PLA vehicles).
- Saves migrate: pre-v0.3 towns continue as USA. Resetting the base re-offers the
  faction choice.

## v0.2: the counterattack

Offense is in. After mission 5 grants counter-raid authority, the **FRONT LINE** opens:

- **Raise an army:** Barracks and Motor Pool with real training queues (they keep
  working while you're away) — Rangers, Combat Engineers, Javelin teams, Humvees, and
  the M1 Abrams, capped by manpower from facility levels. **Losses are permanent.**
- **Pick a target:** procedurally generated Chinese Front Line bases (three per tier,
  deterministic layouts from compound/star/corridor templates). Scout with Supplies to
  lift the fog, or raid blind.
- **Plan, don't drive:** split the army into three squads, each with an entry sector
  (eight around the map) and a doctrine — **Assault** the command post, **Hunt** the
  towers, or **Raze** the economy. Doctrines are real unit-AI programs in the sim.
- **Launch:** the raid resolves instantly and deterministically; loot per structure
  destroyed, tier progress for command posts. Then **watch the replay** — the config is
  the recording, at ×1–×8.
- **The line pushes back:** every second post you clear triggers a counterattack siege
  on *your* base, and while you're away the enemy runs **probe raids** against your
  standing defenses — capped, shielded after a breach, and fully replayable from the
  defense log.

## v0.1 "LANDFALL": the campaign

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
npm run dev        # the game (faction pick → town → missions/raids loop)
                   # ?playground=1 sandbox maze lab · ?demo=1 scripted battle
                   # ?demo=town showcase base · ?demo=raid Front Line planner
                   # add &faction=china to demos for the Eastern Tide side
npm test           # sim + meta suites (pathfinding, combat, siege, town,
                   # doctrines, warfare, factions, determinism)
npm run balance    # headless balance matrices (add -- --md to rewrite docs/BALANCE.md)
npm run build      # typecheck + production build
npm run screenshot # headless screenshots into screenshots/
```

## Controls

**Town:** left-click uses the selected tool (buildings place per click, walls drag-paint);
click a structure in select mode to inspect/upgrade/move/sell/repair; right-click or
`ESC` returns to select; `SPACE` launches the next assault; `T` research; `M` operations
map; `F` Front Line. SFX and colorblind-palette toggles live in the utility row.

**Siege:**

| Control | Action |
|---|---|
| Left-click / drag | Use selected tool (walls drag-paint; guns place per click) |
| Right-click / `ESC` | Cancel tool |
| `1`–`4` | Build item (setup/prep: wall, M2, autocannon, mortar · combat: MG, foxhole, claymore, HESCO) |
| `E` | Erase / refund (setup & prep only) |
| `Q` / `W` | Arm A-10 gun run / 155mm fire mission, then click the target |
| `SPACE` | Start assault / skip prep / return to base when it's over |
| `P` / `S` / `F` | Path visualization / sim speed ×1–×8 / hold (pause) |
| `R` | Restart (standalone battles only — town battles have consequences) |

The sandbox (`?playground=1`): `1/2/3` wall/M2/erase, `W` militia, `B` sapper,
`SPACE` mixed wave.

## Project layout

```
docs/            Game design document, roadmap, locked decisions, balance snapshot
src/sim/         Pure-TS deterministic simulation (no Phaser imports):
                 fixed-tick engine, siege phase machine, weighted multi-goal A*,
                 combat resolution, structure levels, seeded PRNG, state hashing
src/content/     Data, not code: damage table, both factions' defenses, armies,
                 campaigns, base kits, and the faction switch (factions.ts)
src/meta/        The persistent layer: town state (timers, accrual, gating,
                 wrecks), the siege bridge, warfare/raids, versioned saves
src/game/        Phaser 3 presentation: shared glyphs + BattleRenderer,
                 Town/Siege/Briefing/Raid/Replay scenes, UI kit, palette
src/tools/       The headless balance harness (npm run balance)
tests/           Vitest suites: pathfinding, engine, siege flow, town meta,
                 assault ladder, doctrines, warfare, factions, determinism
```

**Architecture rule:** `src/sim` never imports Phaser. Same seed + same commands ⇒
identical outcome (hash-tested), which is what makes replays, offline raid resolution,
and the balance harness possible.

## Deploying

`.github/workflows/deploy.yml` builds, tests, and publishes `dist/` to GitHub Pages on
every push to `main` (once Pages is set to "GitHub Actions" in the repo settings).
The build is fully static and relative-pathed — any static host works:
`npm run build && rsync dist/ somewhere`.
