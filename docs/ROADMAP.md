# LAST LINE — Roadmap

Milestones are scoped as focused build-sessions, not calendar time. Each milestone ends in a
committed, runnable state. Versions: v0.1 is the first shareable build (M3).

---

## M0 — Foundation ✅ *(this session)*

Prove the riskiest mechanic (weighted maze pathfinding) inside a deterministic sim, with docs
and tooling in place.

- [x] Design docs: `GDD.md`, `ROADMAP.md`, `DECISIONS.md`
- [x] Scaffold: Vite + TypeScript (strict) + Phaser 3 + Vitest + ESLint, README
- [x] Sim core: fixed-tick engine (20 tps), seeded PRNG, grid with wall HP, command queue
- [x] Weighted A*: wall traversal cost = `wallHP / unitWallDPS`; around-vs-through behavior
- [x] Runners (walker + breacher profiles), turret (deterministic targeting), HQ leak counting
- [x] Tests: PRNG, pathfinding behavior, engine behavior, determinism state-hash
- [x] Maze playground scene: paint/erase walls, place turrets, spawn runners, live path
      visualization, HUD, sim speed toggle, `?demo=1` scripted setup
- [x] Verified: `npm test`, `npm run build`, Playwright screenshot

## M1 — Siege vertical slice ✅

The active TD battle became a real game: **HOLD THE LINE**, five authored waves at the
Coos Bay perimeter.

- [x] Wave system: authored wave definitions (composition, spacing, entry rows), inbound
      wave preview in the INTEL panel during setup/prep
- [x] Command Point economy: passive + per-kill income, phase-gated costs (Supplies for
      the permanent layer, CP for field defenses/powers), repair-all pricing
- [x] 4 USA field defenses: deployable MG, rifle foxhole, claymore field, HESCO barricade
- [x] 3 USA emplacements: M2 nest, 25mm autocannon, 120mm mortar (splash, min range,
      target-leading lobbed shells)
- [x] 6 China attacker types: militia, rifle squad, sapper, grenadier (stands off and
      shells defenses), ZBD IFV, Type 99 — plus demolition of *any* blocking structure
      (gun lines are obstacles with HP, not hard walls)
- [x] Damage-type × armor-class combat table; hitscan weapons + deterministic mortar
      projectiles
- [x] Command Center entity (2×2, perimeter assault), win/lose flow, between-wave prep
      window with repair and re-mazing
- [x] Battle HUD: CP bar, phase banner, build palettes per phase, power buttons with
      cooldowns, INTEL/SITREP blocks, victory/defeat overlay
- [x] Render polish: interpolation, per-damage-type tracers, shells in flight, AoE rings,
      strafe fx, ghost previews with range rings, power target previews

Carried to M2: unspent-CP → salvage conversion on victory (needs the persistent town
economy to matter), weapon line-of-sight rules (decide vs keep lob-over-walls), hit-flash
on damaged targets.

## M2 — Town & economy *(~2 sessions)*

The persistent base between battles.

- [ ] Carried from M1: unspent-CP salvage on victory; line-of-sight decision; hit flashes

- [ ] TownScene build mode: place/move/rotate buildings, wall drag-painting, footprint rules
- [ ] Resources: Supplies + Fuel, generation rates, storage caps
- [ ] Build/upgrade timers (Engineering Bay speed-ups), building levels gate content
- [ ] USA building set v1 (Command Center, depots, storages, Barracks, Motor Pool, Eng. Bay)
- [ ] Save/load: versioned JSON, localStorage + export/import file
- [ ] Offline resource accrual on load (capped), elapsed-time handling
- [ ] Siege entry: attacks target your *actual* town layout

## M3 — v0.1 "Landfall": defense campaign *(~2–3 sessions)* → **first shareable build**

- [ ] 8–10 USA campaign missions with authored waves and difficulty curve
- [ ] Mission select map (Oregon corridor), radio-log briefings + after-action reports
- [ ] Tutorialization through mission design (no modal tutorial)
- [ ] Unlock flow: buildings/emplacements/field defenses gated by mission progress
- [ ] Difficulty options (at least: Standard / Hard)
- [ ] First-run experience, alternate-history framing text, pause/settings
- [ ] Deploy story: static hosting build (GitHub Pages or equivalent)

## M4 — v0.2: offense + the Front Line *(~3 sessions)*

- [ ] AI base generator: handcrafted templates + procedural mutation, tier scaling
- [ ] Intel scouting flow (flat cost pre-M6): fog-of-war reveal on target base
- [ ] Raid planner: squad assignment to entry sectors, launch delays, doctrines
      (Hunt Defenses / Beeline HQ / Raze Economy), power auto-trigger rules
- [ ] Auto-resolve through the sim; loot by destruction %
- [ ] Replay viewer: 1×/2×/4×, skip-to-result, saved with the plan for iteration
- [ ] Front Line ladder v1: tiers, defense events interleaved with raids
- [ ] Offline probe raids: frequency/loss caps, shield window, defense log with replays
- [ ] Army management: Barracks/Motor Pool production queues, Manpower cap

## M5 — v0.3: China playable *(~2–3 sessions)*

- [ ] Faction content pipeline proven: China as pure data (buildings, emplacements, units,
      field defenses, powers, signature mechanic)
- [ ] China campaign arc "Eastern Tide"
- [ ] Faction select at new-game
- [ ] **Headless balance harness**: batch-run raids/sieges, win-rate + time-to-kill matrices,
      first real balance pass

## M6 — v0.4: depth & polish *(~2–3 sessions)*

- [ ] Intel as a resource + Radar Station; research tech tree
- [ ] Vector art pass: proper unit/building silhouettes, atlas pipeline, palette enforcement
- [ ] Audio: radio-chatter UI feedback, siege ambience, sparse score
- [ ] Replay polish, kill-cams for probe raids
- [ ] QoL: hotkeys, colorblind-safe faction accents, speed controls everywhere
- [ ] Balance pass 2 with harness

## M7 — v0.5+: expansion *(ongoing, one drop per release)*

- [ ] Russia faction + "Iron Corridor" arc (Overbuilt mechanic, thermobarics)
- [ ] North Korea faction + "Silent Tunnels" arc (tunnel network bypassing mazes)
- [ ] UN Coalition faction + "Blue Line" arc (Mandate system, engineering)
- [ ] Air layer: air units + AA emplacements
- [ ] Offline defense doctrines (preset CP-spending AI for offline sieges)
- [ ] Share-code PvP-lite: export base as code, friends raid the snapshot
- [ ] Leagues, rotating events on the Front Line

---

## Working agreements

- The sim stays Phaser-free and deterministic; every feature lands with sim tests first.
- Balance numbers are provisional until M5's harness; resist hand-tuning before it exists.
- Each milestone is pushed to the repo in a runnable state with green tests.
