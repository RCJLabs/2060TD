# LAST LINE *(working title)*

A hybrid **tower defense / base builder** set in a gritty modern alternate-history war:
North Korea, China, and Russia attack America and the United Nations. Pick a nation; your
town is the battlefield — the walls that protect your economy are the maze your enemies
fight through.

**Play it now:** https://rcjlabs.github.io/2060TD/

- **Defense is the action game:** real-time tower defense on top of your persistent base —
  spend Command Points placing field defenses and calling fire missions mid-wave.
- **Offense is the thinking game:** scout, compose a force, assign entry points and
  doctrines; a deterministic simulator resolves the raid into a watchable replay.
- **The war continues while you're away:** offline resource generation, build timers, and
  AI probe raids you come back to as replays.

Full design in [`docs/GDD.md`](docs/GDD.md) · milestones in [`docs/ROADMAP.md`](docs/ROADMAP.md)
· the ten locked decisions in [`docs/DECISIONS.md`](docs/DECISIONS.md).

## Current state — v1.2: share codes

**Your base, as a string you can paste to a friend.** No server, no
accounts — the last piece of PvP-lite from the original plan, built the way
decision #2 said it would be.

- **A base is a code.** `SHARE MY BASE` in the `WAR` tab packs the wire, the
  emplacements and the command post into a ~70–300 character string. A
  realistic mid-game base with 49 walls and 6 emplacements comes out at 127
  characters, because walls are grouped by kind and delta-packed: a straight
  line, horizontal or vertical, costs about a byte a segment.
- **`RAID A CODE` fights the snapshot.** The code *is* the intel, so there is
  nothing to scout and no target to cycle. Your losses are permanent, exactly
  as on the ladder — but the Front Line does not move, nothing counterattacks,
  and a given code pays loot only the first time you beat it. It is a duel,
  not a mine.
- **Nothing here changes when they raid you.** They fight a copy of your
  layout. That is the honest shape of a no-server game, and the share screen
  says so.
- **Codes are versioned and checksummed.** A truncated paste, a mangled
  character, or a code from another version is refused with a reason a player
  can act on, rather than loading half a base.
- **A real text box.** Phaser draws text but cannot take any, and
  `window.prompt` on a phone is a system dialog that mangles a 300-character
  string. `src/game/textbox.ts` is a small DOM overlay styled to match the
  game, with a copy button and a paste field that behaves on mobile.

## Current state — v1.1: a front door

**The game now starts at a main menu instead of dropping you into a town.**

- **Main menu** with the alternate-history framing, then the choices that
  belong there: CONTINUE THE WAR (with the faction, operation, next mission,
  Front Line tier and victory count read off your save), NEW WAR (two taps —
  it erases a campaign and there is no undo), SETTINGS, and TRAINING RANGE.
- **One settings screen, two doors.** Sound, colourblind palette and
  fullscreen live in a single overlay opened from the menu or from the
  town's `SYS` tab; in-game it also carries save export/import and a MAIN
  MENU link. Preferences follow the device, the campaign file follows the
  campaign, and neither is duplicated in two places with two labels.
- **A way home.** `SYS → MAIN MENU` writes the campaign to disk and walks
  back to the front door. It is deliberately absent from a live battle: a
  siege in progress has consequences, and the way out of one is to fight it.

`scripts/e2e-menu.mjs` walks the whole loop — boot to menu, settings from
both sides, into the war, and back out to a menu that now offers CONTINUE —
which is how the first version was caught stacking a fresh settings page on
top of the old one every time a toggle redrew it.

## Current state — v1.0: the air layer

**Walls are irrelevant to a helicopter.** The last unchecked mechanic from
the GDD landed: air units that ignore the maze entirely, and the anti-air
mounts that are the only real answer to them.

- **Flying ignores the grid.** An air unit does no pathfinding at all — no
  walls, no blockers, no breaching. It runs straight at whatever its doctrine
  wants, shoots it, and everything you spent on the maze buys you nothing.
  Mines are buried and lobbed shells land on the ground, so neither reaches
  it; a wire-guided ATGM cannot track it either.
- **The answer is a gun that can elevate.** Every faction gets a permanent
  **AA mount** (FIM-92 Stinger Site, PGZ-95 Flak, ZSU-23, ZPU-4 quad,
  Skyguard 35mm) and a CP-priced **MANPADS team** for rotors that arrive
  mid-wave. Ordinary guns can point up — the damage table just prices that
  badly. Flak is devastating against air and nearly useless against anything
  else, so a mount is a real slot decision, not a free upgrade.
- **Every mount outranges every aircraft**, deliberately. The first tuning
  pass had the Reaper standing off beyond the shorter mounts and killing them
  for free, which makes AA a decoration rather than a decision.
- **Five aircraft, one per faction:** MQ-9 Reaper (patient, precise), WZ-10
  (rocket weight of fire), Ka-52 (armoured, slow-cycling), AN-2 Colt (cheap,
  quick, made of canvas), NH90 (mid-pack, comes home). All trained at the new
  **Airfield**, which also raises your manpower cap.
- **Both sides feel it.** The assault ladder sends rotors from level 4, the
  campaign's late missions put them over your wire, and generated Front Line
  compounds carry a dedicated air-defence launcher from tier 2 — so a raid
  flown on rotors stops being free exactly where the ladder starts asking
  for a plan.

**Measured, both directions** (`docs/BALANCE.md`, 3,450+ battles): an air
raid clears a tier-1 compound — which has no mount — 100% of the time for
14–19% losses; from tier 2 the losses roughly triple and the clears fall
away. On defense, a reference line with two mounts holds level 4 at 100% and
level 5 at 80–100% for the USA, UN, China and Russia; the KPA's cheap quads
sit one step below, which is what "cheapest kit in the war" is supposed to
cost. Without a mount, the same line loses at level 4 — a maze cannot shoot.

## v0.9: mobile-first

**The presentation layer was rebuilt around the phone.** Everything before
this shipped as a fixed 1280×768 canvas scaled to fit, which on a phone meant
10px text rendered at five CSS pixels. It now sizes itself to the real
viewport, in either orientation, and PC is simply the wide case:

- **A canvas that matches the device.** The drawing buffer is viewport ×
  devicePixelRatio (capped at 2×) displayed at CSS size, so type is crisp on
  retina screens instead of upscaled. Rotating the phone, the URL bar sliding
  away, or a desktop resize re-flows the whole game in one frame.
- **Two layouts, one game.** Portrait puts a status strip on top, the
  battlefield in the middle, and a collapsible drawer of 44px rows above a
  five-tab strip; landscape hands the board the full height and moves the
  panel to a right rail. Tapping the open tab collapses the drawer and gives
  the whole screen back to the battlefield.
- **A real board camera.** Pinch to zoom, drag to pan, double-tap to reframe,
  on-screen `+`/`−` keys for the discoverable version — and the town opens
  framed on what you have actually built rather than on empty grid. Wall
  tools switch the board to paint mode so a drag lays wire instead of panning.
- **Type and targets sized for thumbs.** Layout tokens are declared in CSS
  pixels and multiplied into device pixels once, so a 44px row is 44px of
  glass on every phone. Long labels are clipped by monospace arithmetic
  rather than overflowing into their own price tags.
- **Verified on the devices, not just the desktop.** The E2E harness now taps
  buttons *by label* through a live-button seam instead of by hard-coded
  pixels, and runs the whole first-run flow across six viewports — 360×740 up
  to 1440×900 — asserting no page errors and no object outside the two-camera
  partition on any screen.

Bugs the rewrite surfaced and fixed: panel rows never fired at all (a
button's `stopPropagation` aborts Phaser's scene-level pointer events, which
the deferred tap dispatch depended on); overlays were drawn twice, once at
board zoom, because they sat outside both camera layers; an open overlay was
destroyed rather than re-flowed when the viewport changed; and — because that
same swallowed pointer-up left the drag anchored to the previous gesture —
every second swipe snapped the drawer back to the top. Drags are now tracked
from the pointer's own press identity, carry a flick, and a modal owns the
gesture so nothing scrolls or pans behind it. `scripts/e2e-touch.mjs` drives
real touch events through CDP to keep all of that honest.

## v0.8: standing orders

**Your base now fights back while you're away.** Offline probe raids used to
meet the permanent layer alone; now the garrison executes the defense
doctrine you leave behind:

- **Three presets, one button** (the `ORD` slot in the town panel):
  **HOLDFAST** guns down breaches with your kill-earned Command Points,
  **COUNTERBATTERY** spends your *stocked ordnance* on massed attackers with
  mines in between, **TRIPWIRE** seeds the approach with charges and mans the
  inner line. All role-keyed — every faction executes the same orders through
  its own kit.
- **An honest handicap:** the duty officer works a 1-second command cycle
  with a hard per-battle action budget, reinforces *around* a breach (corking
  the hole is a live commander's move), and bills supplies upkeep per action.
  Ordnance fired offline is gone from your stock, exactly like raid fire
  support.
- **Measured, not promised:** the balance snapshot now carries HOLDFAST rows
  for all five factions — it lifts North Korea's mid-game probe floor from
  20% to 100% at L4 and still collapses at L6, while EARLY bases keep dying
  to armor no orders can answer. The full three-preset comparison runs on the
  NK section.
- **Fully replayable:** orders ride the battle config like everything else,
  so every defense-log replay re-issues them tick for tick, and the log names
  the doctrine that fought.

## v0.7: the blue line

The UN Coalition arrived as the fifth and final faction from the GDD,
built on a new engine mechanic that powers both sides of its kit:

- **UN COALITION — Operation Blue Line.** Hold the Tacoma evacuation corridor
  — the port, the rail spur, and the last open miles of I-5 — through six
  missions against the PLA push, with the last convoys loading behind you.
- **Sustainment auras**, the faction signature: the Engineer Revetment (22 CP)
  and the Engineer Corps HQ repair every structure and wall in radius *while
  the fight is on* — and on raids the Field Medic Team heals the squad around
  it. Healing is deterministic, additive, and capped: it out-heals one enemy
  gun, never two. Where you park the Engineer Corps HQ is the base-planning
  decision of the faction — the harness measures its aura turning the
  mid-game L4 assault from a 60% hold into 100%.
- **Master of none, by the numbers:** every UN gun is deliberately mid-pack —
  Peacekeeper MG posts, Milan ATGM posts, the fast-cycling AMOS twin mortar,
  a Gripen gun pass, and a 105mm battery whose only virtue is that it lands
  exactly where it was asked to. Wreck repairs run 20% of cost, the cheapest
  in the war.
- **Loss aversion measured:** the balance snapshot runs the UN raid force
  against its own control (medics swapped for riflemen) — medics cut tier-1
  manpower losses by ~18 points and lift tier-3 clears by ~13, and survivors
  actually come home.

## v0.6: the war underground

North Korea arrived as the fourth faction, and the first to change how
offense itself works:

- **KOREAN PEOPLE'S ARMY — Operation Silent Tunnels.** Hold the Humboldt Bay
  enclave, a sealift harbor dug into the redwood coast, through six missions
  against the US counteroffensive — the finale turns your own doctrine against
  you, with Rangers surfacing from captured galleries inside your wire.
- **Tunnel insertion**, the faction signature: on the Front Line, any squad can
  swap its entry sector for a **gallery head you site on the scouted map**
  (click to dig). The squad surfaces inside the enemy wire as one push after an
  8-second dig — walls, gates, and the whole maze bypassed — for 40 Fuel per
  gallery. Mouths are drawn in the replay; validation keeps them off walls and
  at least 4 cells from the command post.
- **EXPENDABLE**, the base-building identity: the cheapest kit in the war —
  builds cost ~10% less and finish ~15% faster, wreck repairs run 25% of cost,
  ambush teams at 20 CP and directional mines at 12 — but rock barricades carry
  145 HP, the Tunnel Complex HQ is the softest command post in the game, and
  the permanent-layer floor sits one ladder step below everyone else's.
- **The Koksan gun pit** outranges every emplacement in the game (10.5–11
  cells, with a real 3.5-cell dead zone up close), and the power roles are
  saturation rocketry: an MRL fire lane and the wide-scatter KN-09 salvo.
- The balance harness measures the thesis: tunnels turn tier-2 raids from a
  coin flip into a walkover and quintuple tier-4 clears; tunnels plus a KN-09
  fire plan open tier 5 entirely (0% → 32% with the fixed reference force).

## v0.5: the northern front

Russia arrived as the third faction, and the first shipped as a pure content
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
                   # add &faction=china|russia|nk|un to demos for the other wars
npm test           # sim + meta suites (pathfinding, combat, siege, town,
                   # doctrines, warfare, factions, determinism)
npm run balance    # headless balance matrices (add -- --md to rewrite docs/BALANCE.md)
npm run build      # typecheck + production build
npm run screenshot # headless screenshots into screenshots/ (desktop + phone)
node scripts/e2e-flow.mjs            # first-run flow, desktop
VIEWPORT=phone-portrait FACTION=nk \
  node scripts/e2e-flow.mjs          # …on a phone, as the KPA
node scripts/e2e-touch.mjs           # touch gestures: scroll, flick, tap-vs-drag
node scripts/e2e-menu.mjs            # menu → settings → war → back to menu
node scripts/e2e-share.mjs           # code out, code in, duel fought
```

`scripts/e2e-flow.mjs` taps buttons by label (through `window.lastline`)
rather than by pixel, so it runs unchanged on every viewport:
`phone-portrait`, `phone-landscape`, `small-portrait`, `tablet-portrait`,
`tablet-landscape`, `desktop`.

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
| `1`–`5` | Build item (setup/prep: wall, M2, autocannon, mortar, AA mount · combat: MG, foxhole, claymore, HESCO, MANPADS) |
| `E` | Erase / refund (setup & prep only) |
| `Q` / `W` | Arm A-10 gun run / 155mm fire mission, then click the target |
| `SPACE` | Start assault / skip prep / return to base when it's over |
| `P` / `S` / `F` | Path visualization / sim speed ×1–×8 / hold (pause) |
| `R` | Restart (standalone battles only — town battles have consequences) |

The sandbox (`?playground=1`): `1/2/3` wall/M2/erase, `W` militia, `B` sapper,
`SPACE` mixed wave.

**Mobile (the primary target):** both orientations are first-class. Portrait
gives you a status strip, the battlefield, and a drawer of touch-sized rows
over a five-tab strip; landscape hands the board the full height and puts the
panel in a right rail. Pinch to zoom, drag to pan, double-tap to reframe, or
use the on-screen `+`/`−` keys; a wall tool turns a drag into painting.
Tapping the open tab collapses the drawer for a full-screen board, and
FULLSCREEN lives in the `SYS` tab. Tap an armed tool's row again to cancel it
— the touch stand-in for right-click/`ESC`.

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
src/game/        Phaser 3 presentation: responsive layout + board camera rig,
                 shared glyphs + BattleRenderer, Town/Siege/Briefing/Raid/
                 Replay scenes, touch UI kit, overlays, palette
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
