# LAST LINE — Game Design Document

*Working title. Candidates: **Last Line**, Sovereign Soil, Fortress Doctrine, Front Line: American Theater.*

**Genre:** Hybrid tower defense / base builder with idle systems
**Platform:** Web (desktop-first, mobile-friendly), TypeScript + Phaser 3
**Mode:** Single-player vs AI (PvP-lite via share-codes planned post-1.0)
**Tone:** Gritty, grounded modern warfare — alternate history
**Status:** Design v1 (M0). All numbers provisional until the balance harness exists (M5).

---

## 1. High concept

An alternate-history modern war: North Korea, China, and Russia launch a coordinated attack on
America and the United Nations. You command one nation's war effort from a single fortified
settlement that grows into a hardened firebase.

Your town **is** the battlefield. The walls you build to protect your economy form the maze that
enemy assaults must fight through. Defending is a **real-time tower defense game** — the active,
skill-driven half. Attacking is a **planning game**: scout an enemy base, compose your force,
choose entry points and doctrines, and a deterministic simulator resolves the assault into a
watchable replay — the strategic, idle-friendly half.

### Design pillars

1. **Defense is the action game.** When sirens sound, you play: placing field defenses and
   calling fire missions mid-wave, Kingdom-Rush-style, on top of your permanent base.
2. **Offense is the thinking game.** Recon, force composition, and entry planning decide raids.
   No micro — your plan is your skill.
3. **One deterministic simulator under everything.** Auto-raids, offline defense, and replays are
   the same engine. The active TD mode is that engine running in real time with live commands.
4. **Your town is the battlefield.** No separate TD maps. Economy layout, wall mazes, and kill
   zones are one decision space.
5. **Grounded tone.** Real hardware, terse radio-log briefings, the cost of war acknowledged.

### Content guardrails

The premise is explicitly alternate history and is framed as such in-game. Combatants are
militaries, machines, and materiel — never peoples or ethnicities. No atrocity mechanics, no
civilian targeting; where civilians appear in the campaign, the player protects and evacuates
them. Tone is somber, not celebratory.

---

## 2. The three loops

### 2.1 Active loop — Siege (minutes)

An enemy assault arrives in waves at map-edge entry roads and paths through your maze toward
your Command Center.

- **Permanent layer** (built with town resources, persists between battles): buildings, walls,
  gates, and a limited number of **emplacements** (permanent towers). This layer alone defends
  you when you're offline — it has to be good.
- **Battle layer** (exists only during a siege): you earn **Command Points (CP)** over time and
  per kill, and spend them live on **field defenses** — deployable turrets, infantry in
  foxholes, mines, barricades — plus **commander powers** (airstrikes, fire missions). Field
  defenses expire when the siege ends.
- Between waves: a short prep window to repair, reposition field defenses, and read the next
  wave's composition.
- **Lose conditions:** Command Center destroyed = defeat (full loot loss). Partial destruction =
  proportional loot loss. Surviving with an intact base = salvage bonus.

### 2.2 Strategic loop — Raids (sessions)

- Spend **Intel** to scout a target on the Front Line — fog lifts, revealing their maze,
  emplacements, and loot.
- Plan: assign squads to entry points, give each a **doctrine** (*Hunt Defenses* / *Beeline HQ*
  / *Raze Economy*), set timing offsets, and arm auto-trigger rules for your powers
  (e.g., "fire mission when 3+ defenders cluster").
- Launch: the deterministic sim resolves the raid. Watch at 1×/2×/4× or skip to the result.
- Loot by destruction percentage; your surviving units return, your losses cost you.

### 2.3 Idle loop — The war continues (hours)

- **Offline resource generation:** depots keep producing while you're away, capped by storage.
- **Build & research timers:** construction and tech complete in real time. Timers are short and
  generous (minutes to a few hours) — there is no monetization pressure, only pacing.
- **Offline probe raids:** AI factions test your base while you're gone. Resolved by the sim
  against your permanent layer only. You return to a **defense log**: outcomes, losses, loot
  changes, and watchable replays. Probes are frequency-capped and loss-capped (never punishing),
  and a defeat grants a shield window.

---

## 3. Setting & campaign

**The war:** 2027, alternate timeline. A coordinated offensive — the **Coalition of the Three**
(China, Russia, North Korea) — strikes the American mainland and UN forces worldwide. The story
is told through terse mission briefings, radio logs, and after-action reports. No cutscenes;
the writing does the work.

### Campaign arcs (one per faction, released over time)

1. **USA — "Landfall"** (v0.1): China lands on the West Coast. You hold a headland town in
   Oregon that becomes the last supply corridor south. Missions: found the base, first sieges,
   civilian evacuation under fire, NK infiltration interlude, Russian armor probe, and a finale
   siege — then the counterattack order arrives (unlocks offense, v0.2).
2. **China — "Eastern Tide"** (v0.3): the mirror arc — establishing a beachhead economy under
   USA counterattack.
3. **Russia — "Iron Corridor"**, **North Korea — "Silent Tunnels"**, **UN — "Blue Line"**
   (v0.5+): one arc per faction release.

### The Front Line (endless ladder)

A war map of AI bases in escalating difficulty tiers (DEFCON-style ranks). Raiding advances
your position; between raids, counter-siege defense events target your base. Standing, leagues
and the daily condition rotation ride on top of the ladder — see 5.8; the shapes of the bases
themselves are in 5.9.

### Base archetypes *(v1.6)*

Eight shapes, each posing a different question rather than the same question with more hit
points. A shape decides its own wall plan, how many guns it gets relative to the tier
baseline, how much economy (and therefore how much loot), and whether it is built a level
deeper.

| Shape | From tier | What it is |
|---|---|---|
| COMPOUND | 1 | Walled rectangle, two or three gates. The standard problem. |
| OPEN CAMP | 1 | Barely wired and thinly gunned. A breather, not a payday. |
| CORRIDOR | 1 | Two offset wall lines: one way in, and it is long. |
| STAR FORT | 2 | Diamond wall with two breaches; every approach enfiladed. |
| DISPERSED DEPOT | 3 | Stores in four corner pens, each with its own gun. Killing the post barely dents the score. |
| STRONGPOINTS | 3 | Four small pens, one holding the post. Split up or be picked apart. |
| KEEP | 4 | Two concentric rings with opposite gates; everything covers everything. |
| BUNKER COMPLEX | 5 | No wire and few positions, each dug a level deeper. The hardest thing on the board. |

Shapes unlock with depth, and the three targets offered at any tier are always three
**different** shapes — a choice between identical problems is not a choice. Which shape a
target is comes free with the target list: knowing you are looking at a bunker complex is the
decision the archetypes exist to create. The **layout** still costs Intel.

The generator is deterministic in `(tier, variant)`, so scouting, raiding and replaying always
agree about the world.

---

## 4. Factions

Five factions, each a full kit: buildings, walls, emplacements, field defenses, units, powers.
USA and China ship first (elite-vs-swarm is the clearest balance axis). All content is
data-driven so later factions are content drops, not engine work.

### 4.1 USA — Quality & Response

*Few, expensive, excellent. Air power and precision.*

- **Strengths:** elite units, precision single-target emplacements, drone/air powers, fast
  logistics (reduced build/repair times).
- **Weaknesses:** low unit counts, every loss hurts, thin static line without active support.
- **Signature mechanic:** **Rapid Response** — field defenses deploy instantly (no build-up
  animation delay) and refund partial CP when they survive a wave.

| Units (offense) | Role |
|---|---|
| Ranger Squad | Balanced infantry |
| Javelin Team | Anti-armor infantry |
| Humvee CROWS | Fast harasser, light gun |
| M1 Abrams | Heavy breakthrough armor |
| Stryker ICV | Mid armor, carries a squad |
| MQ-9 Reaper (v1.0) | Air: ignores the maze, dies to flak |

| Emplacements (permanent) | Role |
|---|---|
| M2 MG Nest | Cheap anti-infantry |
| 25mm Autocannon | Anti-light-vehicle |
| TOW Battery | Slow, huge single-target anti-armor |
| 120mm Mortar Pit | Long-range splash, min range |
| Stinger Site | Anti-air — longest reach in the war, flak (v1.0) |
| ECM Jammer | Slows/disrupts in radius |

| Field defenses (CP) | Powers (CP) |
|---|---|
| Deployable MG turret | A-10 Gun Run (line strafe) |
| Rifle squad foxhole | 155mm Fire Mission (AoE) |
| Claymore field | Medevac (heal defenders) |
| HESCO barricade | Reaper Loiter (auto-strikes, duration) |

### 4.2 China — Mass & Production

*Numbers are a quality of their own.*

- **Strengths:** cheap fast-produced swarms, rapid-fire anti-swarm emplacements, saturation
  artillery, storage-efficient economy at scale.
- **Weaknesses:** individually fragile units, weak answers to elite heavy armor, needs wide
  storage/production footprint (bigger base to defend).
- **Signature mechanic:** **Production Surge** — barracks queue at double speed during and
  immediately after any battle.

| Units | Role |
|---|---|
| Militia Rush | Very cheap, very fast swarm |
| PLA Rifle Squad | Standard infantry |
| Sapper Team | Wall breacher (walls cost ~nothing to them) |
| Grenadier | Ranged, shreds field defenses |
| ZBD-04 IFV | Light armor, escorts infantry |
| Type 99 Tank | Heavy, slow, building-buster |

| Emplacements | Field defenses / Powers |
|---|---|
| Type 88 HMG Nest | Conscript wave (spawn defenders) |
| QLZ Auto-Grenade (AoE anti-swarm) | Sandbag line |
| HJ-8 ATGM Battery (anti-elite) | PLZ Saturation Barrage (huge AoE, long CD) |
| PGZ-95 Flak (v1.0) | Smoke screen (towers miss, cover repairs) |

### 4.3 Russia — Armor & Artillery *(v0.5+)*

*Everything is heavier than it needs to be.*

- **Strengths:** highest HP units and emplacements, thermobaric splash (TOS-1), cannon bunkers,
  attacks that ignore partial cover.
- **Weaknesses:** slow everything, poor AA coverage, expensive repairs, fuel-hungry.
- **Signature mechanic:** **Overbuilt** — structures keep fighting at 25% effectiveness for a
  while after "destruction" (burning hulk state).

### 4.4 North Korea — Asymmetric & Tunnels *(v0.5+)*

*The maze doesn't matter if you're under it.*

- **Strengths:** tunnel entrances that bypass wall mazes (attackers emerge inside the
  perimeter), ambush spawns, off-map artillery barrages, EMP/hacking to blind emplacements,
  dirt-cheap infantry.
- **Weaknesses:** low tech ceiling, collapses in sustained fights, fragile economy, tunnels are
  destructible once discovered.
- **Signature mechanic:** **Tunnel Network** — both offensive (raid insertion points) and
  defensive (redeploy defenders between tunnel nodes instantly).

### 4.5 UN Coalition — Support & Versatility *(v0.5+)*

*Held together by paperwork and engineering corps.*

- **Strengths:** engineering (fast repairs, temporary barricades anywhere), medics and shield
  generators... field hospitals, logistics interdiction (debuff attacker spawn rates), one unit
  borrowed from every member state (versatile roster).
- **Weaknesses:** master of none, lowest raw damage, powers are utility-heavy.
- **Signature mechanic:** **Mandate** — pre-battle, choose one temporary doctrine buff for the
  whole engagement (defensive works, rapid deployment, humanitarian shield).

---

## 5. Systems

### 5.1 Resources

| Resource | Source | Spent on |
|---|---|---|
| **Supplies** | Supply Depots, raid loot | Buildings, walls, infantry, field defenses stockpile |
| **Fuel** | Fuel Depots, raid loot | Vehicles, powers, emplacement ammo reserves |
| **Intel** *(M6)* | Radar/Comms, defense victories | Research, scouting raid targets |
| **Manpower** | Camps (soft cap, not a currency) | Army size limit |

Offline accrual caps at storage capacity; default 8h of production banked.

### 5.2 Buildings (USA names; every faction has analogues)

Command Center (HQ; its level gates everything), Supply Depot, Storage Bunker, Fuel Depot,
Barracks, Motor Pool, Research Lab, Engineering Bay (build/repair speed), Radar Station
(Intel + scouting, M6), Airfield (v1.0 — trains the faction's aircraft and raises the manpower cap), Walls & Gates (gates let defenders through, close
against attackers), Emplacement foundations.

### 5.3 The maze rule (core mechanic)

Attackers use **weighted pathfinding**: a wall tile's traversal cost = time to walk plus
`wallHP / unitWallDPS`. Units with no wall damage treat walls as impassable; sappers treat them
as nearly free; everyone else genuinely weighs "around vs through."

Consequences, all intended:

- Mazing works — most units prefer open paths, so serpentines buy real time.
- Full enclosure is legal but not absolute — it trades wall HP for time against wall-chewers.
- Sappers are the counter to turtling; anti-infantry kill zones are the counter to sappers.
- Every wall you add is a routing decision, not just a stat.

### 5.4 Combat math v1

Deterministic, DPS-based. No damage RNG (randomness is cosmetic + spawn variance only) — this
keeps replays exact and balance analyzable.

Damage types × armor classes multiplier table (v1):

| | None | Light | Heavy | Structure |
|---|---|---|---|---|
| **Small arms** | 1.0 | 0.6 | 0.2 | 0.15 |
| **Kinetic (AP)** | 0.8 | 1.2 | 1.0 | 0.5 |
| **Explosive** | 1.2 | 1.0 | 0.6 | 1.0 |
| **Shaped (AT)** | 0.5 | 1.1 | 1.4 | 0.8 |

Targeting is deterministic: nearest valid target, ties broken by lowest entity id.

**Line of sight (decided, M2):** there are no LoS checks. Mortars and grenades lob;
direct-fire weapons shooting "through" walls are an accepted abstraction — both sides
benefit symmetrically, and the readability win beats the realism loss. Revisit only if
playtesting shows degenerate tactics.

### 5.5 Command Points (siege battle economy)

- Base income: ~1 CP/sec, +CP per kill (scaled by kill value).
- Field defenses cost 5–40 CP; powers 30–80 CP with cooldowns.
- Unspent CP partially converts to salvage (Supplies) on victory — hoarding is a choice.

### 5.6 Raid planning & doctrines

Each deployed squad gets: an entry point (revealed map-edge sectors), a launch delay (0–60s),
and a doctrine — **Hunt Defenses** (prioritize emplacements), **Beeline HQ** (ignore
everything possible, race the Command Center), **Raze Economy** (target depots/storage).
Powers get auto-trigger rules from a small predicate list. The plan is saved with the replay,
so you can iterate on a failed plan directly.

### 5.6a Veterancy and named squads *(v1.9)*

The three raid slots are three **standing formations** with call signs (HAMMER, RONIN and
TALON for the USA; a set per faction) and a file: raids run, posts taken, men lost, and a
rank — **GREEN → LINE → VETERAN → CADRE**, worth at most +15% health and damage.

One rule carries the system: **experience lives in the men**, so it leaves with the ones
who don't come back. Each raid a formation's experience becomes `(experience + lesson) ×
survival fraction` — a squad that comes back whole banks everything, one that loses half
its strength loses half of what it knew, and a wipe puts the name on a fresh set of
replacements. The lesson itself is `max(1, tier) × 6`, ×1.5 for a cleared post; experience
caps a little above cadre so the top rank can absorb one bad afternoon but not a war's
worth of insurance against being thrown away.

The rank is deliberately small. It is an edge, not a substitute for bringing enough people,
and it pays in the one currency that compounds: veterans lose fewer men, and the men are
the experience. The balance harness's per-faction `VETERANCY` matrix (`npm run balance --
--vet`) enforces exactly that reading — the share of the force that walks home has to rise
with rank; the clear rate does not have to.

Deterministically, veterancy is a per-squad attacker multiplier baked into the wave at
launch, so a replay re-fights the raid with the formation that actually went out rather
than the one promoted or gutted since. Squads carry an explicit slot because the launcher
drops empty ones from the plan — without it, the third formation would come home as the
second and inherit a stranger's record.

### 5.7 Offline probes

- Max 3 probe raids per offline period; total possible loss capped (~15% of unbanked loot).
- Full-loss defeat grants a 12h shield. Probes scale to your Front Line tier, slightly soft.
- Every probe produces a replay — offline losses must always be explainable.

### 5.8 Leagues and field conditions *(v1.3)*

The tier is how far up the ladder you have climbed; **standing** is whether you are still
there. It is the one number in the game that falls on its own.

**Standing.** Clearing a rung pays `18 + 7 × tier`, scaled by the day's condition. A failed
raid costs 14, a breached offline probe costs 30, a repelled one pays 5, and a counterattack
fought in person is ±35/40. Standing never goes below zero.

**Bands.** IRREGULARS (0) → THE LINE (150) → VANGUARD (400) → SHOCK (800) → IRON (1400). A
band is a trade, not a trophy: it multiplies ladder loot (up to ×1.30) *and* raises the level
of the probes that hit you while you are away (up to +2). Standing is visibility.

**Decay.** After 36 hours of silence, standing bleeds 30/day. Anything on the Front Line —
a raid, a counterattack — resets the grace. Offline probes move the number but buy no quiet
time: sitting behind a garrison is not playing.

**Seasons.** Fourteen days, counted from a fixed epoch so the schedule is a function of the
clock rather than something a save has to remember. At rollover the season closes, pays a
**placement** for the *peak* band reached (not the closing one — a spike that decayed away
still counts), records it, and carries a quarter of the standing forward.

**Field conditions.** One rotating event is in force at a time, changing daily on the same
epoch-derived schedule. Six of them, never seven — a seven-long pool would pin every
condition to one weekday forever. Each is a trade, and the pay rises with the measured
difficulty (`npm run balance -- --conditions` is the check):

| Condition | What it does | Pays |
|---|---|---|
| CLEAR LINE | nothing | par |
| HARD RAIN | target walls −30%, their guns −25% | 0.85× |
| BLACKOUT | no scouting at any price | 1.25× standing |
| ATTRITION | your damage +25%, their guns +50% | 1.30× standing, loot ×1.25 |
| FUEL CRISIS | your units −10% HP, −15% damage | 1.30× standing, fuel loot ×1.8 |
| DUG IN | target walls +45%, their guns +20% | 1.45× standing, loot ×1.4 |

BLACKOUT carries no simulation modifiers at all: the fog *is* the condition. It is the one
day that changes how you play rather than what the numbers are — plans are made blind, and
North Korea loses tunnel insertion entirely (a gallery needs a layout to dig to).

Conditions apply to the Front Line only. Campaign missions are authored, skirmishes are
practice, and code duels are somebody else's snapshot — none of them are the front.

### 5.9 The service record *(v1.10)*

One screen, on the WAR tab, that says what this war has taken and what it has cost: the
board (tier, standing, peak, best band ever held, closed seasons), the offense (raids
launched, posts taken, codes beaten, men lost, and the three formations that lost them),
the defense (battles won and lost, the heaviest assault turned back, and the probes the
garrison fought while nobody was watching), and the long game (missions, technologies).
Other save slots get a line each — the record is per-war by nature, since a town is one
commander's file.

Almost all of it is **derived**, not stored: the ladder, the campaign, the town and the
squad roster have been accumulating this since v0.2. Four counters were genuinely missing
and are kept in a small war log — when the war began, raids *launched* (a raid is not one
squad, and clears are not attempts), and probes held and breached, which the four-entry
defense log forgets almost immediately.

**The standing line** is a daily sample of standing over the last month. Days the game was
never opened are filled by interpolation, which is not a guess: decay is linear, and decay
is the only thing that moves standing while nobody is playing. Awards land on the day they
happen and read as the steps they are, and a season rollover is recorded at the boundary
rather than smeared across however long the game stayed closed. The chart's floor is zero
rather than the run minimum, because standing is a distance above nothing — a chart that
rescaled its own floor would draw a war spent at 20 points exactly like one spent at 2,000.

The record is deliberately **not** gated on the Front Line: missions, research, sieges held
and the heaviest assault turned back all happen before the ladder is ever offered.

---

## 6. Presentation

### 6.1 Art direction — "the map table"

Flat vector top-down, styled as a live tactical operations map: crisp geometric silhouettes,
NATO-symbology-influenced iconography, subtle grid, blueprint overlays in build mode. Muted
palette with faction accents:

| Token | Hex | Use |
|---|---|---|
| `bg-field` | `#171a17` | Terrain base |
| `bg-panel` | `#20241f` | UI panels |
| `grid-line` | `#262b24` | Grid |
| `olive` / `olive-dark` | `#6b7f43` / `#4a5a33` | USA structures/units |
| `sand` / `sand-dark` | `#c2b280` / `#8a7f5c` | Walls, terrain accents |
| `steel` | `#7d8a8f` | Neutral machinery |
| `alarm` | `#c0392b` | Hostiles, alerts |
| `signal` | `#d35400` | Fire/explosions, warnings |
| `intel` | `#4a7fa5` | Intel, scanning, friendly UI |
| `ink` | `#d8d5c7` | Text |

Faction accent hues: USA olive, China crimson `#a83232`, Russia rust `#8c5a2b`, NK slate
`#5c6670`, UN blue `#4a7fa5`.

### 6.2 Audio

Synthesized, never sampled: there are no audio assets in this project and the
artifact ships as one HTML file, so everything is built from oscillators and
filtered noise in the gritty register.

**Effects** are texture, not a show — clicks, gunfire ticks, breaches, radio
blips, end-of-battle stingers — throttled per sound so a firefight does not
stack into noise.

**The score** *(v1.8)* is three moods of one idea: the same bleak interval set
(minor pentatonic with the flat second in place of the fourth) played sparser
or tighter. A continuous detuned drone underneath, a heartbeat pulse whose rate
is the mood, and voices two octaves up that only sound when the mood's density
lets them. QUIET has no pulse at all — a room with a radio on. PLANNING adds
one every four beats. BATTLE is the same music with a pulse every other beat.
Changing mood slides the drone rather than restarting it, so moving between
scenes has no seam.

Because the score is data (`content/score.ts`) and the synth is separate
(`game/music.ts`), the musical decisions are testable without a browser.

**The mixer** is two buses — effects and music — set independently in five
stops, because a bed that competes with the gunfire is not a bed.


### 6.3 Teaching *(v1.5)*

Three things about this game are opaque on a first run and none of them can be
discovered by poking at it: that the wire is a **route** rather than a barrier,
that kills pay a **budget that only exists during this battle**, and that the
field guns bought with it **die when the siege does**. A coach says those three
things over the first battle a commander ever fights, in the order the battle
raises them, and then never appears again.

Two rules keep it from being an obstacle. A line is never flashed past: every
step serves a dwell before it can advance. And a step never traps anyone: the
dwell also ends any hold, so a player who ignores the coach entirely loses a
few seconds and is never stuck waiting on an action they were not going to
take. A tap serves the rest of a dwell, because reading fast should not be
punished.

The raid planner gets one screen on first arrival — it is the only place in the
game with four tabs and a plan that resolves without you. One-shot screens are
recorded per war, and REPLAY BRIEFINGS in settings makes them first contact
again: a first battle is not a good time to be taking notes.

### 6.4 Writing style

Terse military register. Briefings are radio logs and after-action reports, 4–8 lines each.
Casualty reports use numbers, not adjectives. The war is never cool; the craft is.

---

## 7. Technical design

```
src/sim/       Pure TypeScript, zero Phaser imports. Fixed-tick (20 tps) deterministic
               engine: seeded PRNG, grid, weighted A*, combat, command queue.
               Replay = initial state + seed + timestamped commands.
src/game/      Phaser 3 rendering & input: scenes (Town, Siege, RaidPlanner, Replay),
               HUD, interpolated rendering on top of sim ticks.
src/content/   Data-driven definitions: units, emplacements, buildings, waves, missions.
               Factions are data, not code.
src/meta/      Saves (versioned JSON, three localStorage war slots + export/import
               file), timers,
               offline resolution (accrue + fast-forward probes headlessly on load).
```

- **Determinism contract:** same seed + same command list ⇒ identical end state (hash-tested in
  CI). All gameplay randomness flows through the seeded PRNG; iteration orders are canonical.
- **Why it matters:** replays are tiny (commands, not frames); offline resolution is exact; and
  a headless **balance harness** (M5) can run thousands of raids per minute to produce
  win-rate matrices per faction/tier.
- **Save format** is versioned with migrations from day one, and base layouts serialize to a
  compact standalone form — the future share-code PvP format.

---

## 8. Scope guardrails

- v0.1 ships **defense only** and must be fun with one faction defending.
- Air units, Intel/tech tree, and factions 3–5 stay out until their milestone. No early nibbling.
  *(All three have since shipped: factions at v0.3–v0.7, the tech tree at v0.4, the air layer at v1.0.)*
- All balance numbers are placeholder until the harness (M5); don't hand-tune before then.
- No servers, accounts, or real-time PvP in any current milestone.

See `ROADMAP.md` for milestones and `DECISIONS.md` for the ten locked design decisions.
