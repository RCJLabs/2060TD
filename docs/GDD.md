# 2060TD — Game Design Document

*Named **2060TD**. Earlier candidates — Last Line, Sovereign Soil, Fortress Doctrine,
Front Line: American Theater — are kept here only as a record of what was considered.
Note the tension worth resolving one day: the campaign is set in **2027**, not 2060.*

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

**The deal is not yet what this section claims** *(measured v1.21, `npm run balance -- --deal`)*.
Three targets a rung, drawn from one hardcoded shuffle that never sees the faction, means four of
these eight shapes ever appear: COMPOUND is dealt on all five rungs, CORRIDOR on four, and
DISPERSED DEPOT on none at all. The rule above is enforced for **silhouette** and not for
**difficulty**, so T5 deals BUNKER and STRONGPOINTS together — the two hardest shapes in the
game, to every faction at once — and a choice between three impossible problems passes the check
as readily as a real one. Banding the deal by measured difficulty was tried and reverted: a
faction-blind ordering cannot grade a rung, because the shapes do not order the same way for each
faction (COMPOUND at T5 measures 100% for the USA and 7% for China). The fix is a deal that sees
the faction; see the ROADMAP.

### The ladder *(v1.21)*

Tier scales three things, and until v1.21 it scaled them in one lump. `structureLevelFor` steps
every third rung, and every gun on a base used to step with it at once, which put the whole
ladder's difficulty into a single rung:

    pool mean, all eight shapes, all five factions
    before   T1 100  ->  T2 95  ->  T3 74  ->  T4 35  ->  T5 36
    after    T1 100  ->  T2 95  ->  T3 74  ->  T4 48  ->  T5 46

T4 came out **harder than T5**, so grinding past the wall got you to an easier rung. The upgrade
now creeps through the gun line instead — a third of it at the ceiling on a band's first rung,
two thirds on the second, all of it on the third, best positions first, so a raider can read off
the board which guns are the built-up ones. Same ceiling, three rungs instead of one.

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
(Intel + scouting, M6), Airfield (v1.0 — trains the faction's aircraft and raises the manpower cap), Walls & Gates (a gate is a wall the commander can open and close mid-siege for CP; see 5.2a — the older line about letting defenders through described a game where friendly units walk, and none do here), Emplacement foundations.

### 5.2a Gates *(v1.17)*

A gate is a wall with a state, and the only thing in the game that lets the player
**edit the maze during a fight**.

- **Closed it is a wall.** Attackers path through its HP or route around it, exactly
  like any other segment.
- **Open it is a hole.** Weighted A* re-costs the moment it swings, and a hole is the
  cheapest cell on the board — so opening a gate *pulls* the assault toward it. That is
  the play: open one to route the attack into a killzone you built, close it to strand
  whoever came through.
- **A swing costs Command Points**, so the lever competes with a turret and a fire
  mission for the same budget, and only during combat — CP does not flow before the
  shooting starts.
- **It will not close on somebody standing in the gateway.** That is what makes opening
  one a commitment rather than a free look.
- **Battles begin with every gate shut.** A gate is barred when nobody is on the wall,
  which keeps the whole feature in the battle layer: nothing to store, nothing for a
  share code or a replay code to carry, and an unattended base is honest about what it
  is.
- **A destroyed gate is a permanent hole**, like any destroyed wall.
- **It costs two segments of the wall allowance.** The intended price was HP — a gate
  carries about half a wall's — and the harness said that costs the defender nothing:
  swapping up to 48 ring segments for doors moved the clear rate by a point, because
  attackers route rather than breach. Wall HP is not what decides a raid, so it cannot
  be what prices a gate. Ring length is, and it is exactly the right thing to charge for
  a hole you chose to leave in your own wall.

### 5.2b The ground *(v1.19)*

Every battle is fought on a generated sheet, derived from one seed and never stored. The
same seed rebuilds the same ground anywhere, so a replay carries two numbers rather than
768 cells, and `TERRAIN_VERSION` names a generator rather than a revision of one — improving
the maths means adding a version, so an archived battle keeps re-fighting the ground it was
fought on.

Every effect is a flat multiplier. There are no line-of-sight checks anywhere in this sim
(decided at M2, §5.4) and terrain does not reopen that.

| Ground | What it does |
|---|---|
| **Water** | Impassable. A river across a flank is a wall you did not pay for — and one the enemy has to walk around, which is your maze doing free work. Three crossings: a road bridge and two fords. |
| **Road** | 0.7× movement. Where an assault wants to be, which makes "where the road enters your perimeter" the first question you answer when you build. |
| **Rough / steep** | 1.3× / 1.6× movement. Attackers grind uphill into your guns. |
| **Woodland** | Incoming **aimed** fire ×0.7, and 1.15× movement. Cover against a gunner, nothing at all against a barrage or mortar splash — canopy hides a man, not a shell landing in the trees. That asymmetry is what stops it being a free hiding place, and what gives the fire-mission layer something to answer. |
| **Elevation** | A gun's reach ×(1 + 0.05 per band), so the top band is +15%. |

**Nothing you own can stand in a river.** The generator takes every occupied cell as a
constraint, so a war that predates terrain gets ground *around* what is already built — and
when no sheet fits, the SEED is what gives way, never the layout. Terrain must stay a pure
function of its seed, or the river would move every time somebody sold a depot.

**Why elevation is only +15%.** The mockup proposed +40% and the harness refused it: the
reference force's clear rate fell 33 points, and switching the term off put terrain within
0.4 points of flat ground — meaning water, cover and movement cost together accounted for
almost none of the drop. Reach is read from the firer's cell for both sides, which is
symmetric in code and deeply asymmetric in play, because a defender's guns sit in fixed
emplacements and an attacker mostly closes to contact. Same lesson as field conditions and
as gates: **a raid is decided by gun coverage.** See `docs/BALANCE.md`.

### 5.2c The garrison *(v1.20)*

Until v1.20 a Front Line post was a diorama. Its Command Point economy was switched off
(`cpPerSecond: 0`, `cpCap: 1`) and the standing-orders evaluator was gated to the player's
own side, so an AI base could not react to anything: no reserve, no reinforcement, no
deadline. That is the structural reason the harness kept reporting the same finding —
**route length and wall HP can only ever spend the attacker's TIME, and nothing charged
for time.**

Measured, the fortification was not merely inert. Taking every wall out of a generated base
made it *easier to hold*: 86.7 clear with the wall line against 81.5 without it. The maze's
one real effect was steering raiders **around** the guns.

Two changes, for two different faults. They are separable and were separated, because a
first read that moved both at once credited the wrong one.

**The gun trade** is what earns the wall line. Standing gun damage on a raided post is
×0.8, and that alone — with no garrison anywhere near it — takes the wall line from −5.2 to
+8.6 without moving the clear rate at all. Weaker guns let attackers live longer in the
open, so a wall that holds a force in a corridor under fire finally matters more than a
maze that routes them around the shooting.

**The garrison** is what earns the clock. The base starts asleep, banks CP at 1.2/s — the
rate every siege already runs on — and spends it standing guns up on the densest knot of
attackers it can see. A concentrated push arrives before the reserve exists; a dawdling one
walks into guns that were not there when it set off. Over 1200 raids a cell, a 60-second
launch stagger costs 5.1 points unwatched and 8.3 watched.

| | What it is | What it buys |
|---|---|---|
| **Reserve** | `claymore`, `depmg`, `foxhole` — role ids, so each faction fields its own at its own prices | Something the base can actually stand up mid-battle |
| **Posture** | `screen` / `standto` / `redoubt`, picked by archetype; 2–4 orders per battle | A camp is barely manned; a keep is somebody's whole plan |
| **Target** | Always the densest cluster | `ccApproach` and `breach` measured indistinguishable from no garrison at all — a last stand at the objective is too late, and by then the corridor has been walked for free |

The garrison **never calls fire missions**, and that is a correctness rule rather than a
taste one: the engine reads `playerSide` to decide whether an impact lands on units or on
structures, so a garrison barrage would shell its own base.

A raid HUD shows the watch counting down — orders committed, and how many seconds of
dawdling buys the next one — because a cost the player cannot see teaches nobody anything.

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

### 5.5a Buttons and rows *(v1.13, v1.16.1)*

Every row in this game is measured, never reserved. A label is drawn from a
top-anchored origin and centred by measuring the block it renders as, so a row
that wraps stays inside its own box instead of overlapping the tap target below
it. Two rules follow from that and are worth stating, because both were learned
by shipping the opposite: a button re-places its label whenever anything changes
that label's height, and a phrase that can outgrow its box must be given a wrap
width rather than trusted to clip — a centred label in a box narrower than
itself runs off both edges.

A block whose height CHANGES while the screen is up (the briefing's transmission
reveals a line at a time) is laid out at the size it will finish at and then
shown partially, so the space below it is reserved from the first frame and
nothing moves as it fills.

Touch adds one more rule (v1.17.2). A button owns the press that started on it
until that press ends, however far the finger wanders in between — sliding off
un-highlights the button but does not cancel it, and a release just past the
edge still counts on a button with nothing behind it to scroll. A thumb on a
one-row button at the bottom of a phone rolls; a press discarded for that is a
press the player is certain they made.

### 5.6 Raid planning & doctrines

Each deployed squad gets: an entry point (revealed map-edge sectors), a launch delay (0–60s),
and a doctrine — **Hunt Defenses** (prioritize emplacements), **Beeline HQ** (ignore
everything possible, race the Command Center), **Raze Economy** (target depots/storage).
Powers get auto-trigger rules from a small predicate list. The plan is saved with the replay,
so you can iterate on a failed plan directly: the planner opens on the last plan launched, not
on three empty formations. All three slots are kept, empties included — leaving a formation at
home is a decision, and a plan that comes back missing it is not the plan that was written.
What returns is the shape; what fills it is today's army, so a plan is trimmed to the men who
actually came back, lead formation first, and the planner says so rather than leaving it to be
noticed at the launch button. A gallery is only reopened if it is still diggable on the new
target; the ordered delay survives the dropped hole. NEW PLAN wipes all three.

The delay is a picker with seven stops — 0/6/12/20/30/45/60 seconds after LAUNCH — and the
first three are the old fixed stagger, so the plan the planner opens on is one the picker can
say. Tunnel dig time is added on top of the order: a gallery squad told T+0 still surfaces
when the ground opens, because the order is when the ground is opened, not when the men are
already up. A plan that names no delay falls back to the stagger, which is why every replay
recorded before v1.15 re-fights the battle it recorded rather than a new one.

What the choice is worth is measured (`npm run balance -- --delay`) and it is a trade in both
directions: **mass takes the base, patience brings the men home.** Widening the stagger raises
the share of the force that walks back and lowers the clear rate, and the size of that penalty
is the faction — the USA can trickle at no cost to the objective, the KPA cannot trickle at
all. Sending the assault formation in LAST is a blunder in all five.

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

### 5.10 The replay vault and replay codes *(v1.11)*

The simulator is deterministic, so **a battle is its config**: re-running it reproduces the
fight exactly, down to the state hash. There is no frame log and nothing that can desync,
which is what makes both halves of this feature possible at all.

The **vault** keeps the last ten hands-off battles — ladder raids, code duels, and the
offline probes fought while you were away — on the WAR tab, each still watchable. A
**replay code** is any one of them as a pasteable string: whoever pastes it watches exactly
the battle that was fought, and risks nothing of their own doing so.

Entries are stored *as codes* rather than as configs. That is six times smaller, but the
real reason is that it collapses three problems into one: reading the vault off disk is the
same checksummed decode as reading a paste, copying a battle out costs nothing because the
code is already what is stored, and a corrupted entry is refused at load rather than
crashing a replay three taps later.

Kind names ride in a **dictionary** written into each code, not a fixed byte table. Share
codes use a fixed table and carry a standing warning never to reorder it; this game adds
units and buildings every release across five factions, so a format that names its own
kinds is the one that survives that. It costs about ten bytes per distinct kind and a
battle uses a dozen. Strings are UTF-8, unlike share codes — a share code names a base the
player typed, but a replay code names generated content, and posts are quoted with curly
quotes while probes are titled with an em dash.

**Live sieges are excluded, deliberately.** What the commander places during a siege is a
command, and the config never held it; a "replay" of one would be a battle nobody fought.
Recording those would mean a command log and a second replay path, which is a different
feature.

### 5.11 Day orders *(v1.12)*

Three standing orders a day, posted off the same fixed epoch as the field-condition
rotation: no server, no stored schedule, no way for two saves to disagree about what today
asks. One per **category** — one on the front, one behind the wire, one in the yard — so the
day always has something for whatever the commander happens to be doing.

Three separate pools of different sizes (5 offensive, 4 defensive, 6 at home) give a
sixty-day cycle before the exact triple repeats. A single pool of fifteen would repeat
every fifteen days and pin each order to the same weekday forever.

Only the **progress** is stored, alongside the day index it belongs to, so a sheet found on
disk from yesterday is replaced rather than credited against orders it never saw. What each
filled order *paid* is stored as well: a raid can fill an order and move the commander's
band in the same breath, so a screen that re-priced it from the current band would sometimes
print a figure nobody was ever paid.

Two rules make orders fit the rest of the design rather than fight it:

- **An order pays itself the moment it is filled**, not when it is claimed. This is a game
  built to be left alone for a day, and a reward that expires because nobody tapped it
  punishes exactly the play pattern everything else encourages. The screen exists to read
  what today asks, not to collect a debt.
- **Orders never pay standing.** Standing is the one number in the game that falls on its
  own, and a daily faucet of it would quietly undo the decay the whole board is built
  around. An errand pays wages: Supplies, Fuel and Intel.

Goals are flat; the payout scales with the commander's league band. A tier-5 commander runs
the same errand a tier-1 one does, and the band is what keeps it worth their afternoon.

Every metric has exactly **one** call site in the meta layer. An order counted from two
places would drift, and nothing in the save could say which count was right.

---

## 5.12 A note on the panel *(v1.13)*

Panel rows and headings wrap. Until v1.13 they were one line each, cut off with an ellipsis
worked out from a monospace character width, and that constraint reached back into the
content: two systems grew a second field to keep a heading short, and four content tables
carried a 26-character cap enforced by tests.

Row heights are **measured**, in two passes — the first sets every label's text and wrap
width and reads the height it renders at, the second places the rows once each line's
tallest is known. Predicting the height from a character count is the guess that put this
project's overlay bugs on screen twice; in a list of tap targets it would be worse, because
a row that is short by a line overlaps the row below it rather than some prose.

The caps that remain are **editorial**: a row the commander has to read twice is a badly
written row, whatever the drawer's width. Abbreviation fields (`short`) stay tight for the
same reason — an abbreviation that takes two lines is not one.

---

## 6. Presentation

### 6.1 Art direction — "the map table" *(rewritten v1.19)*

**You are not looking down at a battlefield. You are looking at a map of one, and drawing
your defences onto it.**

A buff topographic sheet, lying on a dark table. Contours traced from the real height field,
a watercourse, woodland, a road, kilometre grid with edge references. Your base sits on top
in ink: real top-down silhouettes, one per structure kind, each with a paper knockout behind
it the way a counter is printed over a map.

The fiction earns its keep. It explains why the view is top-down and abstract, it makes
marginalia native instead of clutter — a map is *supposed* to carry a scale bar and a grid
reference — and it turns your buildings into what they already are: counters placed on ground
somebody surveyed.

**The value rule, measured, and it is about AREA rather than lightness alone:**

> Ground that **covers area** — paper, road, water, woodland — sits between L\* 63 and 83.
> Everything you own that covers area sits between L\* 21 and 35. Nothing occupies the gap.

Ground *marks* may go darker (the index contour is L\* 46) because a hairline covering no
area cannot compete with a filled shape. Alarm accents are the deliberate exception: the
tracer sits at L\* 76, squarely inside the ground band, and is unmissable anyway because it
earns its read from hue and a knockout rather than from lightness.

**The UI is not on the sheet.** Panels, rows and text stay dark — they are the table the map
is lying on. That is why the whole board changed and the drawer did not.

| Token | Hex | Use |
|---|---|---|
| `bg-field` | `#d9cdb4` | The sheet |
| `paper-warm` | `#e2d8c2` | Knockout halos, the inside of a gate |
| `contour` | `#a88253` | Every 10 m, hairline |
| `contour-index` | `#8a6538` | Every 50 m, heavier |
| `water` / `water-deep` | `#93aaba` / `#6e8c9e` | Watercourse and its bank |
| `wood` / `wood-edge` | `#8ca06a` / `#6f8050` | Canopy tint and stipple |
| `road-case` / `road-fill` | `#f0eadb` / `#c9bfa6` | The road |
| `grid-line` | `#7c7a6e` | Kilometre grid, at 14% |
| `marg` | `#5a5346` | Sheet name, scale bar, grid references |
| `olive-dark` / `olive` | `#2e3626` / `#3e4a32` | Structure ink |
| `sand-dark` / `sand` | `#39422f` / `#4b563c` | Wall line, hesco |
| `crimson` / `crimson-dark` | `#7a2b24` / `#5a1e19` | Hostile |
| `bg-panel` / `bg-control` | `#20241f` / `#2a2f28` | The table: panels, and a control's face |
| `ink` | `#d8d5c7` | UI text, on those dark panels |
| `alarm` / `signal` / `tracer` | `#c0392b` / `#d35400` / `#e8b44a` | Accents |

Faction cameos: NK slate `#4a535c`, Russia rust `#6b4520`, UN blue `#3f6bab`.

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
