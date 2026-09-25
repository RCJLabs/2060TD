# 2060TD — Game Design Document

*Named **2060TD**. Earlier candidates — Last Line, Sovereign Soil, Fortress Doctrine,
Front Line: American Theater — are kept here only as a record of what was considered.
Note the tension worth resolving one day: the campaign is set in **2027**, not 2060.*

**Genre:** Hybrid tower defense / base builder with idle systems
**Platform:** Web (desktop-first, mobile-friendly), TypeScript, the DOM and a Canvas2D stage of
its own (Phaser 3 until v1.49)
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
  generous (minutes to a few hours) — there is no monetization pressure, only pacing. The longest
  are the research graph's top tiers *(v1.52)*: four hours and ten, an afternoon and a night. A
  week-long graph was measured and refused on this line (see 5.2e).
- **Offline probe raids:** AI factions test your base while you're gone. Resolved by the sim
  against your permanent layer only. You return to a **defense log**: outcomes, losses, loot
  changes, and watchable replays. Probes are frequency-capped and loss-capped (never punishing),
  and a defeat grants a shield window.
- **The enemy strikes back** *(v1.54)*: when the front has been quiet for 36 hours, the enemy
  retakes ground behind it, one sector and a day later a second, and no more until you act on
  the Front Line again. It is on standing decay's clock, and a commander who raids daily never
  sees it. See "The Front Line" in section 3.
- **The supply line** *(v1.55)*: the towns you hold behind the front are fed from what your
  depots make, before anything is banked, and a front they cannot feed loses ground. See "The
  Front Line" in section 3.
- **The capital** *(v1.57)*: the enemy's stronghold falls to its three roads and then its
  citadel, and the citadel's fall wins the war, which goes on. See "The Front Line" in section 3.
- **The last stand** *(v1.58)*: a front pushed back to the first town and left quiet brings the
  enemy to your capital, offered like a live defence; lost, the capital is sacked, and the war goes
  on. See "The Front Line" in section 3.

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

**The theater** *(v1.53)*. The ladder is a road. Each faction's war runs from its own base up
a real road toward the enemy's stronghold, and a tier is how far up it the front has been
pushed: tier 1 is the first town past the base, and the stronghold is tier 13.

| Faction | Theater | From | Toward | The three lanes |
|---|---|---|---|---|
| USA | The Oregon Coast | Coos Bay | Grays Harbor | the Beaches · Highway 101 · the Coast Range |
| China | The Chehalis Valley | Grays Harbor | Joint Base Lewis-McChord | the Chehalis River · Route 8 · the Black Hills |
| Russia | The Yukon Route | Nome | Fairbanks | the Sea Ice · the Iditarod Trail · the Ridges |
| KPA | The Redwood Coast | Humboldt Bay | Santa Rosa | the Lost Coast · Highway 101 · the Eel River |
| UN | The South Sound | Tacoma | Grays Harbor | Puget Sound · the I-5 Corridor · the Black Hills |

Each town is three sectors, one per lane, and each lane always holds the same band of the
tier's deal: the heavy fight, the middle one, or the one a commander can take today. So the
Oregon Coast's heavy post is always on Highway 101. A sector's post is exactly the post the
ladder deals, and any three wins at the front take its town, repeats allowed, if the depots
can feed it (see the supply line, below). The map is read off the tier and its wins and is not
stored: towns behind the front are held, the front is contested with its three pushes marked,
and the rest is enemy ground. THEATER in the WAR tab (or G) draws it, and choosing a front post
there opens the raid planner on it. The towns are places on a road: taking one is taking its
three posts, under the guardrails above.

**The enemy strikes back** *(v1.54)*. Held ground is stored now, because the enemy takes some
of it back. When the front has been quiet for 36 hours (no raid, no counterattack, no defence
fought in person: what resets standing decay), the enemy retakes one sector of the town
directly behind the front, and a day later a second. Two is the most one quiet spell costs.

- **It cuts roads.** It takes the sector of a lane that still reaches the front, down its main
  road first (heavy, then middle, then light), and a front post whose lane has a loss anywhere
  behind it cannot be raided until the loss is retaken. Any three wins still take the front's
  town, through whichever lanes are open.
- **The front can fall back.** Only when every road is cut does the enemy take what is left of
  the town behind the front, and when all three of its sectors are lost the front falls back to
  it: the rung goes down one and the pushes start from none. Since a quiet spell takes at most
  two, one absence never pushes the front back from a town that was whole.
- **Retaking is a raid.** A lost sector's post is the one the ladder dealt at that tier and
  lane. Taking it retakes the sector and pays loot and standing like any post at that tier;
  it moves no pushes at the front.

The map strikes lost sectors out and says how long the front has been quiet and when the enemy
strikes; the planner lists the open front posts, then the ground to retake. Over four measured
weeks a commander who raids daily loses nothing, and one who plays every other day spends about
one raid in three retaking.

**The supply line** *(v1.55)*. Holding ground costs. Every sector held behind the front takes
five supplies an hour for each rung of its town's distance from home: a whole town at the fifth
rung takes 75, and the line to a front at the sixth rung 225. The front costs nothing until it
is taken, and neither does ground the enemy holds. The line is fed out of what the depots make
before anything is banked and before the works take their share, and never out of the
stockpile. It grows with the square of the front's depth, so the depots bound how deep a front
a town can hold:

| Built out | Supplies an hour | Feeds a front to |
|---|---|---|
| CC1 | 240 | the 6th rung |
| CC2 | 630 | the 9th |
| CC3 | 1,320 | the 13th, the enemy's stronghold |
| CC3, the yard and the research | about 1,900 | the 16th |

- **Overextending punishes.** When the depots make less than the line takes, the front is
  short and goes hungry at the share it is short by. A day of hunger costs a sector, struck the
  way a quiet front's is: wholly unfed, a sector a day; half fed, one every two days. Each loss
  lightens the line, so an overextended front shrinks to what its town can feed, and a front fed
  again forgets its hunger.
- **A town the depots cannot feed holds** *(v1.56)*. The third push at the front takes its
  town only if the depots could feed the line with it in. If they could not, the win pays and
  counts like any other, and the front holds at two pushes until the depots make more; the map
  says so in red while the front is at that ceiling. So the table above is where a front stops,
  not where it starts to starve, and hunger is for a town whose production falls, a wrecked
  depot, say. Holding the first town takes 15 an hour, so a town with no depots cannot take
  it, and taking the stronghold would put the line at 1,365, beyond a CC3 town without its
  yard.
- **It is the economy's sink.** On a full store most of what the line takes would have been
  lost. Measured, it takes a tenth of production while the front is young and a fifth or more at
  the eighth rung, where a full store at war then loses 24-47% of what the town makes instead of
  44-75%.

The map says what each held town takes an hour and whether the depots feed the line, the status
strip shows the line's draw beside the supplies rate, and a short front is bannered and marked
SHORT on the WAR tab.

**The capital, and a war won** *(v1.57)*. The enemy's stronghold is its capital, and it is not
taken by any three wins. Each of its three roads has to fall once; a second win on a road already
taken pays like any post and counts for nothing more. With all three taken the **citadel** comes
into range: the enemy's headquarters, a fourth target in no lane and a shape dealt nowhere else.
Two rings with the inner gate at the back, so a raid walks in and all the way round the post under
the guns; every gun dug in at the full level, where a rung's guns creep up a third at a time; and
the richest stores on the board. Its strength is each faction's, as the deal is, because the five
armies do not take a fortress alike: each citadel is chosen so that 62 of the 66 men a built town
fields take it about half the time.

- **The citadel's fall wins the war.** The war is dated, paid like IRON's season placement (4,000
  supplies, 700 fuel, 400 intel), and marked won on a victory screen, the service record and the
  war menu. Nothing resets.
- **The war goes on.** The citadel's fall takes the stronghold as a third push takes a town, if
  the depots can feed it, and the front moves into the enemy's rear, where any three wins take a
  town again, until the supply line runs out: the sixteenth rung for a built CC3 town. If the
  depots cannot feed the stronghold, the war is won all the same and the front holds there with
  its roads until they can.
- **A front that falls back from the capital loses its roads**, as any front that falls back
  loses its pushes. A war won stays won.

The map marks the roads as they fall and draws the citadel past the stronghold; the planner opens
on it once it is in range. A commander who grows the army four men a rung and raids daily wins in
thirteen to sixteen days.

**The last stand** *(v1.58)*. The enemy can reach your capital too. When a quiet spell's strike
finds the front already at the first town, in a war whose front has been deeper, there is nothing
behind it left to retake, and the enemy marches on the capital instead. It takes long neglect: from
the sixth rung, fifteen sectors lost, eight quiet spells with nothing retaken, and a strike more.

- **Offered like a live defence**, for thirty minutes from when you next see it, and answered the
  same two ways: DEFEND, the whole assault with the town's siege economy behind you, or GARRISON,
  the same assault fought by the standing orders, which can lose it. Walking away, or out of the
  battle, is GARRISON.
- **Held**, the enemy is thrown back from the gates: a skirmish's whole loot at its level, and
  standing.
- **Lost**, the capital is **sacked**: every building that fell is wrecked, as in any played siege,
  40% of the stockpile goes where a defeat takes 15%, standing goes with it, and the service
  record says SACKED. The war goes on from the first town: a sack cannot end it.
- **Its level is the town's own**, by faction and the level of the command post: the lowest level
  at which that faction's reference town of that size, its permanent defences alone, holds the
  whole assault within fifteen points of half the time. So what the commander does decides it.
  By faction, because each faces a different enemy's assault.

The WAR tab leads with THE CAPITAL while a march waits, the map's clock says when the enemy will
march from the first town of a war that has been deeper, and the defence log keeps the last stands.

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

**The deal spans difficulty, per faction** *(v1.21)*. Until v1.21 the rule above was enforced for
**silhouette** and not for difficulty: three targets came off one hardcoded shuffle that never saw
the faction, so four of these eight shapes ever appeared, DISPERSED DEPOT appeared on no rung at
all, and T5 dealt BUNKER and STRONGPOINTS together — the two hardest shapes in the game, to
everyone at once. A choice between three impossible problems passed the check as readily as a real
one.

A rung's pool is now ranked by what each shape costs **that faction**, cut into three bands, and
one target drawn from each: slot 0 is the heavy fight, slot 2 the one you can take today, slot 1
the reason to think about it. The ordering has to be per faction because the shapes genuinely do
not order the same way — a KEEP is the hardest thing Russia meets and mid-table for the USA, and a
CAMP is everyone's breather and the USA's third-hardest target. A single ordering averaged across
the five was tried first and graded a rung for nobody. All eight shapes now reach a player, and
each faction's three targets sit within a few points of its own pool mean.

**The deal names the ground too** *(v1.31)*. Banding by shape is a coarse lever, and for two
releases it was the only one: the generator drew the layout from the slot index, so a rung's three
targets were a shape band with a difficulty lottery on top. Shape explains well under half the
variance in clear rate and layout explains most of the rest, which made the lottery the larger
term — two rungs could swap places, and the USA's rung 4 measured easier than its rung 3. A target
is a `(shape, layout)` PAIR now, and because the layout pool is wide, a pair can be chosen to land
on a NUMBER rather than in a band. Every faction is given the same target curve — clear rate
falling 100 / 95 / 85 / 70 / 55 across the rungs, three targets spread ±15 around each — so the
ladder and faction parity stop competing: both are satisfied by construction. The table is
regenerated from measurement by `npm run balance -- --layouts`, never hand-written, and the three
pairs at a rung are chosen as a **triple** rather than one slot at a time, because filling slots in
turn spends the pair a later slot needed. Faction parity across the ladder went 15.0 → 4.2 points.

**The deep rungs are chosen too** *(v1.56)*. Until v1.56 the table stopped at rung 5, and every
rung past it dealt rung 5's pairs with the layouts moved on: nobody chose them, and the climb to
the stronghold spiked past what a built town can field. Rungs 6 to 13 are selected now by the same
search (`npm run balance -- --deeplayouts`), against a force that grows with the rung, since the
reference force is what rung 5 is tuned for and cannot be what the stronghold is: each faction's
reference shape resized to four men a rung more than its own, the middle post at 55% and the other
two fifteen points either side, as at rung 5. A commander who grows the army at that rate meets rung
5's odds all the way up, and one who does not stops near the ninth rung. The stronghold asks 53 to 60
of the 66 men a built town fields. Past it, the enemy's rear keeps the stronghold's shapes, with the
layouts moving on.

None of this changes what a player is told: you still see three shapes and still pay Intel to learn
the layout. The generator stays deterministic in `(tier, variant)` — the deal is a lookup, not a
roll.

Two players of different factions therefore see different front lines at the same rung. That is
correct — they are fighting different enemies — and nothing in the codecs depends on it, since
share codes and replay codes both carry a layout cell by cell rather than a `(tier, variant)` to
re-generate from.

### What a raid is, measured *(v1.21)*

**A raid is very nearly one unit, and this is a design question the game has not
answered.** Ending a raid means killing the command post. Ranged fire goes through
`DAMAGE_MULT` and is discounted hard against a structure — smallArms 0.15, flak 0.1,
kinetic 0.5, explosive 1.0 — while melee (`hqDps`) ignores the table but only fires when a
unit is **adjacent**. The heavy is the only thing that reliably survives to get there and
hits hard when it does, and it lands 60–84% of the killing blows.

Silencing one unit kind at a time to measure what each delivers:

    faction   carry unit   its MP   raid is   dead weight
    USA       abrams            8      86%    16 of 27 MP
    CHINA     type99            7      87%    12 of 28 MP
    RUSSIA    t72               7      63%    11 of 27 MP
    NK        chonma            5      46%    18 of 27 MP
    UN        leo1              6      53%    12 of 27 MP

Three USA Ranger squads move the outcome by **zero**. So do the UN's medics and its breach
team. Between a third and two thirds of every reference plan is manpower that does not
change whether the raid succeeds — which means the raid planner, with its squads, sectors,
doctrines, launch delays and veterancy, is currently decoration around *did you bring the
tank*.

`npm run balance -- --carry` is the instrument. The ROADMAP carries the three directions
out of it; nothing has been tuned on the strength of it yet, because a buff to a unit that
never reaches the post buys nothing.

### The two fronts *(v1.21)*

The game has exactly two Front Line kits — the PLA post that the USA and the UN raid, and the US
firebase that China, Russia and the KPA raid — and until v1.21 nothing had ever compared them.
Running every reference force against both found the PLA kit **34 clear-rate points softer for all
five**, which meant a faction pick was quietly also a difficulty pick. Two of the three gun slots
carried it; the basic slot was already even.

They are levelled now, and levelled on **worth** rather than on design. The two kits are still
meant to answer different questions and the numbers say so: the PLA post fires faster, splashes,
and works close in — GDD §4.2's "rapid-fire anti-swarm emplacements", which the QLZ finally is —
while the US firebase reaches further and hits single targets harder, which is §4.1's "precision
single-target emplacements". The fix was rate and reach, never damage, because a heavier shell
would have turned China's guns into the other kit's identity.

`npm run balance -- --kits` is the measurement of record; `tests/kits.test.ts` is the structural
guard that fails first.

### What a raid comes for *(v1.24)*

Until v1.24 a raid had exactly one ending that counted. Everything the player keeps —
ladder rungs, standing, veterancy records, contracts, a duel marked solved — read the one
boolean `cleared`. The material economy already knew better: a failed raid razes a third
of the post and comes home with roughly half a win's loot, and the command post is only
40% of the lootable value on the board. **Partial success existed; only progress did
not** — which is what made one unit the whole raid.

A raid now declares one of three missions before it launches:

| | what it takes | what it pays |
| --- | --- | --- |
| **TAKE THE POST** | kill the command post | a full clear, and the only rung the Front Line gives |
| **SPIKE THE GUNS** | 65% of the emplacements standing | 40% of a clear in standing |
| **RAID THE STORES** | 65% of the depots standing | a 1.5× loot premium; nothing on the board |

**A lesser mission ends the raid the moment it is filled**, and that is the trade: over 96
measured raids, withdrawing on the quota ended at 653 ticks instead of 1692 and brought
**3.00 men home instead of 1.54**. You come back with less and keep the army you spent.

The quota is a share of what the base is *holding*, fixed at tick zero — a flat count is
impossible on a small base and free on a large one, and a quota the raid could move by
filling it would be a moving target.

**Only taking the post advances the ladder**, so three wins still climb a tier and that
still means something. The failure mode of paying anything for a lesser mission is that a
cheap raid you can run twice as often becomes the fast climb; measured as standing per man
lost, taking the post is the efficient route in all five factions by 1.5–2.3×.

This works because the doctrines already deliver very differently, and because the reason
is in the damage model rather than bolted on: melee ignores `DAMAGE_MULT` so infantry can
kill a command post, while ranged fire is discounted hard against structures so the same
infantry cannot kill a tower. `npm run balance -- --objective` is the instrument, and its
headline is that **three objectives select three genuinely different forces** — 15 distinct
winners of 15, with each winner scoring 0–25% on the missions it was not built for.

Taking the post is a superset of every lesser mission: a force sent for the guns that ends
up killing the command post has not failed, and pays like a post raid whatever it declared.
A duel is always for the post — `town.duels` records the codes you have *beaten*, and that
has to mean the same thing for everyone who fights one.

### What flying is worth *(v1.33)*

Air was shipped at v1.0 on a thesis: **an aircraft buys speed and survival, not odds.** It
should not clear more often than a ground push of the same size, it should lose fewer men
doing it, and anti-air should be the answer to it. Three releases of tables appeared to
confirm that, and all three were reading instruments that described themselves wrongly.

The air plans are documented as "roughly the same manpower, flown", and `roughly` had never
been checked — four of the five fly 3–4 MP more than the ground reference they were being
compared against, and the only matched one is the one that measured worst. The loss column
said `MP LOST%` and counted **heads**, so a 7-MP gunship weighed the same as a 1-MP
conscript and a three-airframe force read as annihilated for losses a nine-body force
shrugs off. And the control row labelled "no AA" never removed any AA: every generated base
builds its flak mounts and no row took them off — what the control removed was the
garrison's reactive `manpads` order. Read against a manpower-matched control, no faction's
air beats its own ground, and air still loses **more** manpower than matched ground for four
of five factions. Half the thesis is not true yet.

The more useful finding is what `--wing` turned up when the fixed-force table was replaced
with a demand table — the same correction `--rungs` made to the ladder. **Air does not climb
a harder ladder. It climbs a different one.** The deal picks each rung's three targets
against measured GROUND difficulty (§5.3), correctly, because almost every raid is a ground
raid. Measured per dealt target at a fixed budget, the two orderings barely relate: **39 of
the 75 targets the five factions are dealt move by 30 or more clear-rate points depending on
whether the force walked or flew.** For the USA the two targets an air force cannot take at
all — OPEN CAMP at 0% and DISPERSED DEPOT at 5% — are the two its ground force finds
easiest, at 60% and 100%; STAR FORT and KEEP invert the other way, 100% flown against 45%
and 35% on foot.

The mechanism is plain once it is stated. Walls and overlapping arcs are what make a rung
hard on the ground, and **neither exists for an aircraft**. What is left is the flight in —
and the shapes with the fewest walls are exactly the ones that spread their mounts and their
command post over the most ground.

So this is not a power problem: for four of five factions the means are close. It is an
**information** problem. The shape is free knowledge (§5.3) and the game said nothing about
what it means to an aircraft, which made the decision to fly a lottery rather than the
tactical read the air layer exists to be. `npm run balance -- --wing` is the instrument.

**The target says it now** *(v1.34)*. Beside the shape, free and for the same reason — air
defence is the one thing a post cannot hide, and a read that cost Intel would leave flying
the lottery it was:

    COMPOUND — RING WITH GATES
    AIR — HEAVY FLAK · 153 ON THE APPROACH
    The run in crosses heavy anti-air. Walk this one.

It is a RULE, not a table, so a pasted share code reads exactly like a ladder rung. From
`Engine.updateAirAttacker`: an aircraft ignores the grid, flies a straight line, and hovers.
Walls, gates and the maze do not exist for it, so what is left is the flight in — for every
gun that can elevate, the length of the run in that falls inside its envelope, over the
speed of the slowest airframe, times its damage per second.

It ships because it BEAT what a player already had. `npm run balance -- --airread` scores it
against the measured air clear rate on all 75 dealt targets, with the shape's own mean as
the incumbent — flattered, being scored on the rows it was fitted to. Transit takes r² 0.50
against the shape's 0.21, and wins for each faction separately. The obvious term did not
ship: flak covering the post, where the aircraft has to hover, scores 0.17 and makes the
combination WORSE, because on a generated base it is nearly binary. The three bands are cut
at the terciles of the measured population, and what each third clears at, flown, is
**91.0 / 76.8 / 18.4** — the information is the bottom band, and it is a cliff. The raw
figure rides along because a band cannot rank two posts that both read CONTESTED, and
ranking the three on offer is the decision the front line presents.

### A raid is a roll *(v1.23)*

For twelve releases the sim never rolled in combat. The engine's one shared stream had
exactly three draw sites — a ±3–8% speed jitter at spawn and two for barrage scatter — so a
raid was decided by its **matchup** rather than by its **battle**. `npm run balance -- --seed`
is the instrument that measured it, fighting each matchup twelve times:

    200 matchups          BEFORE      AFTER
    every seed agreed     172 (86%)   125 (63%)
    same men walked back  108 (54%)    55 (28%)
    mean clear rate          58.3       59.7

The only thing that moved before was how *long* a battle took, which is the spawn jitter
perturbing arrival times without perturbing who wins — and is why nothing ever looked wrong
from the outside. It mattered anyway: `clearPct` in every table was a **count of matchups
tipped**, not a probability, so a 15-cell mean moved in steps of 6.7 points; and re-fighting
a base was pointless, which quietly hollowed out the league, the day orders and the ladder.

**The model is that not every burst tells.** A quarter of fire does nothing at all and the
rest is scaled up so a gun's expected output over a battle is exactly what its stat line
says — nothing is buffed and nothing is nerfed. What changes is that a unit's death is no
longer a fixed number of ticks after it comes into range.

Twelve candidates were priced before that one was chosen, and two of the findings were not
the guess. **A fine spread washes out**: ±50% on every shot barely moves the verdict,
because many small independent rolls average to their mean inside one engagement. **The
zero matters, not just the variance**: a 40%-chance glance to ×0.3 has almost the same
variance as a 25% miss and lands five points apart, because a shot that does nothing lets a
unit at 1hp live. And **aiming loosely is a difficulty change rather than a variance one** —
letting a gun pick among near-equal targets made raids easier for a thin fall in DECIDED,
and stacked on the winner it *undid* six points of it, because spreading fire across a force
averages the damage instead of concentrating it.

Determinism is untouched. The rolls draw from their own stream, seeded separately, so the
same `(seed, combatSeed, model)` is the same battle every time and a replay re-fights what
it recorded. The model is a **version**, frozen forever: version 0 is the sim that never
rolled, which is what every config written before v1.23 gets.

**A duel does not roll differently between attempts.** A challenge pins its rolls to the
pasted code's own fingerprint, because `town.duels` records the challenges you have *solved*
and the existing rule already strips the weather and the bonus so that the plan is what
differs. The ladder, seeded from the clock, is a different battle every time you go out.

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
  animation delay) and refund partial CP when they survive a wave. *(M26: the USA fields its own
  kit, "few, expensive, excellent": every field defence has 30% more HP and damage at twice the
  CP, and one standing at the end of the wave it was placed in pays back half its CP, once,
  lettered over it on the board. Built in v1.59.0, reshaped in v1.61.0, in play since
  v1.62.0.)*

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
  immediately after any battle. *(M26: built as written and measured almost inert, since a
  unit trains in 8 to 60 seconds. It now halves the price instead: for 30 minutes after a
  battle the commander fights, training costs half, with the window's clock on the training
  lines. Built in v1.59.0, in play since v1.62.0.)*

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
  while after "destruction" (burning hulk state). *(M26: a destroyed emplacement burns on for
  up to 15 seconds with a quarter of its HP, firing at a quarter of its damage and still
  blocking the path, drawn as a burning wreck with its own bar. Russia's emplacements are
  built to 0.875 of their HP to pay for it, so it defends as well as before and differently.
  Built in v1.59.0, in play since v1.62.0.)*

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
  whole engagement (defensive works, rapid deployment, humanitarian shield). *(M26: walls 30%
  sturdier; CP prices 25% lower with field defences 20% lighter; or the post 30% harder to
  take. The town keeps a standing choice, set in the WAR tab and changed in a defence offer,
  and every battle it fights carries it, the garrison's included; the shield by default.
  Built in v1.59.0, in play since v1.62.0.)*

---

## 5. Systems

### 5.0 The board *(v1.40, M34)*

**10 cells across, 15 deep, two units a cell, attacked from the north.** Every battle in
the game is fought on this shape: the town when it is besieged, a generated ladder base, a
pasted share code, a campaign mission.

**Lengths are written in units, not cells** — ranges, radii, speeds, strike strips, the
column an arrival enters at — and the board says how many units a cell is. At two, every
2x2 building is exactly one cell, and the narrowest phone draws a cell at 36px with the
whole board in view above the drawer at rest: twice the 18px of 20x30, and enough to build
on a named cell with one touch. What cannot halve is anything already one cell, so a gun
and a wall stand on twice the ground they did. That made the move a redesign rather than a
port: the generator's eight plans, the balance harness's reference bases and the ladder's
deal were drawn or chosen again for this board, the kill chain gained a rule (a crew stuck
on a covered post goes after the guns covering it), and the assault ladder was re-tuned so
each defence stage falls where it did on 20x30.

It was 32x24 entered from the west until v1.40, and 20x30 until M34. The reason it turned,
then shrank, is that this is a phone game. Thirty-two cells across the short side of a 360px phone is an **11px cell**, and
an 11px cell cannot carry a silhouette, a level pip or a fingertip — measurable with
`npm run fit`, which scores a candidate grid against the real board rect on six devices.
Upright, the same phone gets **18px**, and a typical one 20-21px.

What that cost is small and specific, and it is why the board turned rather than shrinking:

| | v1.39 | v1.40 | M34 |
|---|---|---|---|
| Depth from the entry line | 32 | 30 | 15 cells, 30 units |
| Across the entry line | 24 | 20 | 10 cells, 20 units |
| Cells | 768 | 600 | 150 |
| Cell on a 360px phone | 11.3px | 18.0px | 36.0px |

**Depth is what decides a raid** — route length and gun coverage, per `docs/BALANCE.md` —
and depth lost two cells. The axis that lost four is the one nobody walks along.

Two consequences run through the whole codebase:

- **Layouts are written in approach space.** `u` is depth from the line the attack comes
  down; `v` runs across it. The eight wall plans, the balance harness's three reference
  bases and the showcase town are all authored that way, and the transform to real cells
  lives at the few points where a plan emits something. Eight shapes tuned over six releases
  did not have to be re-tuned to rotate.
- **A cell index means something different on each board**, so a save, a share code or a
  replay has to say which one it meant. Replays name their `spawnEdge` and re-fight the
  battle they recorded. Saves and share codes carry a grid version and are TRANSPOSED
  forward — the map that carries the old command post to the new one, so every building
  keeps its exact offset from the post and its exact distance from the enemy. A base that
  funnelled attackers into a crossfire still does. The move to 10x15 is not exact, so it
  is not free: a 20x30 town comes across by the one rule, `floor(p / 2)`. A block of the
  new board is wall when half of it was, a building that lands on a taken cell walks to
  the nearest free one, and every wall that does not come across — merged into a block
  with another, or past the new budget — is refunded.
  Replays carry their cell size and re-fight on the board they recorded.

### 5.1 Resources

| Resource | Source | Spent on |
|---|---|---|
| **Supplies** | Supply Depots, raid loot | Buildings, walls, infantry, field defenses stockpile, the research graph's top tiers, the works |
| **Fuel** | Fuel Depots, the Refinery *(v1.52)*, raid loot | Vehicles, powers, emplacement ammo reserves, the research graph's top tiers |
| **Intel** *(M6)* | Radar/Comms, the Intel Bureau *(v1.52)*, defense victories | Research, scouting raid targets |
| **Manpower** | Camps (soft cap, not a currency) | Army size limit |

Offline accrual caps at storage capacity, and at eight hours. Production is stated per hour, and
since v1.50 it is a twentieth of what it was: the rate at which the storage a stage allows holds
those eight hours. A built CC1 fills its supplies in 8.3 hours, CC2 in 9.5 and CC3 in 11, and
every storage bunker is needed to get there, so an absence keeps what it makes. Until then a
store filled in half an hour and an eight-hour absence kept 5–7% of it (M24 Phase 1). Loot, the
day's orders and a season placement land on top of a full store and stay until spent; production
does not. A battle's own pay stops at the cap, but a battle never takes a store below what it held
going in, and a wrecked bunker keeps what it held; production waits for the repair *(v1.52.1)*.

**The war pays for itself.** Measured over a week at CC3 (M24 Phase 4), raids more than repay the
units they lose, and a commander who raids and climbs the skirmish ladder every session still loses
44-60% of what the town makes to a full store, against 70% for one who never fights. Repairs are
the war's one real cost. The sink a built town needs is M25's: holding ground.

**What production is worth.** At these rates the whole town takes about three days to buy for a
commander who plays several times a day, and nine for one who plays once. The battles pay hours:
a siege held at level 8 pays 3,250 supplies, thirteen hours of a built CC1's production and two
and a half of a CC3's.

**Wrecks are the damage that lasts.** A structure destroyed in a battle the commander fights is
wrecked: it stops working, and putting it back costs a share of everything spent on it (30%;
Russia 42%, the KPA 25%, the UN 20%). Damage short of that does not carry over. Measured, it is
5–9% of what a siege costs to repair: a gun comes through nearly whole or not at all. After a
battle the town says what it wrecked and what the repairs cost, and the base tab repairs every
wreck at once. Offline probes never wreck anything; they bill the stockpile instead (5.7).

### 5.2 Buildings (USA names; every faction has analogues)

Command Center (HQ; its level gates everything), Supply Depot, Storage Bunker, Fuel Depot,
Barracks, Motor Pool, Research Lab, Engineering Bay (build/repair speed), Radar Station
(Intel + scouting, M6), Airfield (v1.0 — trains the faction's aircraft and raises the manpower cap), Generator (v1.51 — powers the cells around it; see 5.2d), Refinery and Intel Bureau (v1.52 — turn supply production into fuel and intel; see 5.2e), Walls & Gates (a gate is a wall the commander can open and close mid-siege for CP; see 5.2a — the older line about letting defenders through described a game where friendly units walk, and none do here), Emplacement foundations.

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
600 cells, and `TERRAIN_VERSION` names a generator rather than a revision of one — improving
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

### 5.2d The yard *(v1.51)*

Where a building stands decides what it makes, not only which way the attack walks round
it. Two rules, both about the cells a building shares, and every building is one cell on
the 10x15 board.

- **Power.** The Command Center powers every cell within two of it, diagonals included,
  and a Generator every cell within its reach: one, two or three by level. The producers,
  the depots and the Signals Station, make half as much without power. Nothing else needs
  it. The Generator comes with the CC2 requisition, one at CC2 and two at CC3. In a battle
  it is an obstacle and a target like any building, so wrecking one darkens its reach until
  it is repaired.
- **Adjacency.** A building's neighbours are the four cells that share an edge with it.
  A depot makes a quarter more for each Storage Bunker beside it, up to two. The Signals
  Station makes half as much again beside a Generator. A Barracks trains a quarter cheaper
  beside a Supply Depot, and a Motor Pool or Airfield beside a Fuel Depot. A wreck beside
  the Engineering Bay repairs for half.

Each rule is one line on the building's card. While a building is aimed, the line along
the foot of the board says what it would do on that cell, and a producer or a Generator
shows the edge of the powered ground.

None of it reaches a battle. The rules read the town and never a config, so no replay
and no balance table moved. Measured (M24 Phase 3), the best yard behind the lines makes
about a third more than the same buildings nearest the post and never holds less than
the defence alone. Where the economy stands turned out to matter to the defence more than
either rule. Nearest the post it can break a CC1 or CC2 defence and wall a CC3 post in,
and the defence tables do not see it: they measure the permanent layer alone.

### 5.2e The works and the research graph *(v1.52)*

After the build-out a town makes more supplies than anything spends, and fuel and intel are
what run short. Two buildings turn the one into the others, and research gets a top.

- **The works.** The Refinery makes fuel and the Intel Bureau makes intel, out of the town's
  supply production: 120, 240 or 400 supplies an hour in by level, for 16, 34 or 60 fuel or 6,
  13 or 24 intel. A converter never draws on the stockpile. It takes from what the depots make,
  so on a full supply store it runs on production that would have been lost, and it idles
  while the store it fills is full. When the depots make less than the works want, each gets
  its share. Both need power, like the producers, and one of each is allowed at CC3, where
  the surplus is: at CC2 they would take three quarters of what the town makes while it is
  still being bought, and their two cells crowded the CC2 yard into the maze. Research
  unlocks them, not the campaign: the Refinery comes with Deep Stockpiles and the Intel
  Bureau with Signals Intercepts. On a supply store that is filling, what they take is a
  price, three fifths of a CC3 town's production, so a commander can stand either down from
  its card and set it back to work; stood down, it draws as a building not yet working. Its card and the aiming line say what it takes and
  makes on that cell.
- **The graph.** The nine doctrines stay as they were. Each branch gains a fourth and a fifth
  tier, and each of those needs a tech from another branch as well as its own:

  | tech | needs | does | costs |
  |---|---|---|---|
  | FORTIFY 4, Layered Defence | Rapid Entrenchment, Signals Intercepts | walls +15% more HP, weapons +8% more | 400 I, 8,000 S, 1,500 F, 4 h |
  | FORTIFY 5, Kill Zones | Layered Defence, Rapid Mobilization | weapons +10% more, CP 10% cheaper again | 600 I, 14,000 S, 3,000 F, 10 h |
  | STRIKE 4, Veteran Cadres | Rapid Mobilization, Interlocking Fire | raid units +12% more HP | 400 I, 8,000 S, 2,000 F, 4 h |
  | STRIKE 5, Deep Strike | Veteran Cadres, Forward Logistics | raid units +12% more damage, one more charge of each ordnance | 600 I, 14,000 S, 4,000 F, 10 h |
  | LOGISTICS 4, Field Engineering | Forward Logistics, Interlocking Fire | wreck repairs 30% cheaper | 400 I, 6,000 S, 1,000 F, 4 h |
  | LOGISTICS 5, Strategic Reserve | Field Engineering, Marksmanship Doctrine | the works make 25% more, storage +20% more | 600 I, 12,000 S, 2,500 F, 10 h |

  Every price fits a built-out CC3 town's stores with the storage research its own
  prerequisites bring; a CC3 town holds 660 intel. The battle multipliers ride in the config
  the way the nine always have, at the thousandths a replay code carries.

Measured (M24 Phase 4), a commander who only builds has the graph about three days after the
town, on day five or six, and the top tiers move a defence about as far as the three below
them: about half a level a tier. Stretching the timers to a week was measured and refused
(2.3). With no war to spend fuel and intel, the works run on what research takes and idle the
rest of the time: most of what a built town makes is still lost to a full store until the war
spends it.

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

### 5.4a Taking a command post — the kill chain *(v1.41; spent assault v1.41.1; latched breach v1.41.2; pins v1.47)*

For twenty-two milestones the post was an **HP sponge**, and it decided the game in a way
nobody designed. Ranged fire is discounted hard against `structure` and `hqDps` only fires
at adjacency, so there were exactly two ways to win: walk a survivor onto the post, or —
the one nobody noticed until M22 measured it — **park a tank at range four and shell the
post down without ever entering the base**. `--carry` read one unit at 99-100% of a raid
because one unit could do both.

The post is now a **progress bar through a demolition job**, in four stages. Each is gated
on a different stat, which is the whole design: no unit answers all four.

| Stage | Bar | What moves it | Who is good at it |
|---|---|---|---|
| **BREACH** | 1.00 → 0.70 | `wallDps` at the perimeter, plus shells and fire support | sappers (60-80) over heavies (22-35) |
| **SUPPRESS** | gate at 0.70 | every live gun within 4 cells of the post must be down | AT teams and IFVs — anything with reach |
| **CHARGE** | 0.70 → 0.55 | `hqDps`, and only with **two bodies** on the perimeter | cheap infantry, per point of manpower |
| **BURN** | 0.55 → 0.00 | a 20-second clock, while the ground is held | whatever survives, and the medic keeping it alive |

Six rules carry the design, and each of them was a measured correction rather than a guess:

- **A shell opens the post; it does not take it.** Standoff fire works the BREACH share and
  stops at its floor. Once the post is open it stops being a target for guns at all — which
  is what sends the troops in, and without it three tanks stand at range four shelling a bar
  that cannot move, forever.
- **Two bodies, minimum.** One unit cannot work a demolition charge and provide its own
  security. This is the one rule that makes a solo heavy impossible rather than merely slow,
  and it is kept even though dropping it is the single largest gain in clear rate on the board.
- **An aircraft is not a body on the ground.** It can shell the post open and kill the guns
  covering it — two of four stages, a real job — but it is never crew and holds nothing while
  the post burns. Without this, two gunships take a post with no demolition and no infantry.
- **The burn backs off, it does not reset.** Losing the last holder costs the attacker
  ground, not the raid.
- **An assault that achieves nothing is spent** *(v1.41.1)*. Ninety seconds of a completely
  static board — no damage to the post, nothing destroyed, nobody killed — with somebody
  still standing on the objective, and the assault is written off where it stands. The crew
  minimum means one attacker can never take a post, and once every gun that could reach it is
  dead it can never be killed either; a battle ends when the attackers do, so without this
  the rule that made a solo heavy impossible also made 18% of sieges impossible to finish.
  The fiction calls it a withdrawal; the stats credit the defender with the kills, because a
  second way for a unit to leave the board with nothing watching it is worse than a repulse
  that reads as one. Held to one variable it changes no raid's clear rate and no raid's
  destruction — only what a half-failed one costs.
- **A breach stays open** *(v1.41.2)*. "A shell opens the post; it does not take it" was
  written as a live comparison against the breach floor, and a post being REPAIRED crosses
  back over it — so the defence's own engineering re-arms the post as a ranged target and
  hands back the very livelock that rule exists to prevent. Measured on the sustainment
  faction defending at CC3: a lone gunship held the bar oscillating between 0.7031 and
  0.7094 for thirty thousand ticks, and none of the three ways the spent-assault rule can
  end a battle could see it. The breach is a high-water mark now. The post can still be
  healed and healing it still costs the attacker time at BURN; it just cannot make itself
  a target again.

`KILL_CHAIN_VERSION` names a MODEL, frozen forever — version 0 is the sponge, so every
archived replay re-fights the battle it recorded. Same discipline as `TERRAIN_VERSION` and
the combat model. Nothing here draws from an RNG: the chain is accounting, and one source of
variance per battle is enough.

**The chain also carries the duty officer's aim (version 5, v1.45.3).** Every config names a
chain and every replay code carries one, so that is where a change to how standing orders
and fire plans aim is versioned. Version 5 is version 4 with two fixes that re-judging the
defender's verbs on the contested band found (M23 Phase 3c). The distances an order aims by,
the radius a cluster is counted within and the approach gun's three units out, are physical
units like every other distance since M34; they had been cells, so on 10x15 they reached
twice as far. And a fire mission ordered onto the densest knot is laid where the knot will be
when it lands, on the ground force it can hit. Until then the A-10 had never landed: it came
down where the file had been half a second before, and the file had walked out of it.

**A fire mission pins what it lands on (version 6, v1.47.0).** Every ground unit a gun run or
a barrage lands on is pinned for eight seconds. It does not move, shoot, dig or hold, so while
it is down it moves no stage of the chain: no demolition at BREACH, no fire at the guns holding
SUPPRESS shut, no crew at CHARGE, nobody holding the ground while the post BURNS. Until then a
strike did damage and nothing else, and killing a few of the men walking up to a post moves
nothing the chain counts. Heavies are pinned as well, and most of the pin's worth is there: a
strike that kills a rifleman leaves a tank standing, so for a tank the pin is all a fire
mission does, and a tank is what shells the guns from standoff and holds the post while it
burns. Only fire missions pin. A mortar or a mine fires all battle, and a pin
from one would be a new permanent layer rather than a new verb.

The duty officer learned when to call a strike in the same release. A standing order can aim
at **the assault**, the densest knot of ground attackers inside the post's cover ring, and
only while there is one, and it can wait for a knot of a given size. Fired the moment it could
be paid for, a strike had gone onto the column still forming at the edge of the map, and that
timing was half of why the fire missions only stirred battles. HOLDFAST's gun run waits for
two in the ring now; COUNTERBATTERY keeps its aim, because its claymore spends the budget
while a waiting strike holds its fire.

**What it bought, measured.** Suppression stopped being a formality (97-99% of raids passed
it; now 64-84%), the stages became monotone where the sponge's were incoherent, and the five
factions' clear rates tightened from a 23-point spread to 13. DUG IN's inverted sign — the
M33 finding that thicker wire *raised* destruction — is fixed by it, because wire is now
stage one of four and nothing past it can be done at range.

**What it did not buy.** The heavy is still the best unit to bring, and M22 Phase 2 named why
with a number: the binding constraint is not what wins at the post, it is who survives the
approach, and small arms do 1.0 against `none` and 0.2 against `heavy`. The chain gives
infantry a job; the approach still denies them the chance to do it. That is an armour-table
question, and it is where the rest of M22 goes.

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

### 5.6b The after-action report *(v1.63, M29)*

A raid is a plan, so what a player needs after one is what to change. The result gives the
headline: who came home, what fell, and where a failed assault stalled. REPORT gives the rest,
on the result and on any raid watched again:

- **What killed them.** Every death names the hit that caused it: the emplacement, mine or fire
  mission, and its damage type. The report ranks them.
- **The squads.** Each formation's men sent and back, what it lost and to what, and its battle
  split by what most of its living men were doing: on the move, cutting the wire, in the fight,
  at the post, stuck, pinned down.
- **The chain.** The second each stage fell, and where a failed assault stalled and for how long.

The report is not stored. A raid is its config, so the report is fought again when asked for,
the same battle tick for tick, and a replay code carries everything it needs. Nothing in it
changes a battle: the killing blow is kept on the unit that took it and read only when it dies.

**Where it happened** *(v1.64)*. The heat map puts the report on the board, in the page's one
colour: a cross where each man fell, and a shade over each cell the fire landed in, deeper the
more of the force it hit there, counted in men (a hit is its share of the man's whole health). It
shows the killing ground even on a raid that lost nobody. It is on in two places:

- **The replay** draws it as the footage plays, on the ground under the battle; HEAT MAP turns it
  off. The report's ON THE MAP opens the footage at its end with the map on.
- **The raid planner** draws the last raid on a post over the post the next one goes for, found in
  the replay vault by its ground and fought again. THE LAST RAID HERE, under VIEW, says how many
  fell and turns it off.

It began as the time men were held at the wire. Raids hardly spend any (none in two raids of
three, measured), so the shade is where they were hit.

**What if** *(v1.65)*. The report's WHAT IF fights the raid again with one thing changed: one
more or one fewer of a unit in a squad, or one squad's entry sector, doctrine or start. Three
rows pick the change, and the answer is fought as soon as one moves:

- **On the raid's own dice**, beside what happened: did it take the post (or do what it came
  for), when, and how many of how many were lost; a repulse says where the chain stalled.
- **Over ten more rolls**, both plans: how often each did the job and the men it lost on
  average, because a close raid can come out either way on one roll. A duel's dice are fixed,
  so a duel's what-if is its one roll.

WATCH IT plays the changed raid, heat map and all. On the raid just fought, INTO THE PLAN makes
the change to the plan the planner reopens with. A what-if is free, and always one change from
the raid as fought, never two: its footage offers no what-if of its own, and a second change
taken into the plan replaces the first. The plan is read off the battle's config and proven by
rebuilding the config from it, so any raid in the vault can be asked, and one whose plan does
not rebuild exactly is not offered.

### 5.6c Officers *(v1.67, M28)*

Experience that lives in the men bleeds away with them: a squad comes home wiped in about a
quarter of raids, loses half or more in most, and goes out VETERAN a few times a war. An
**officer** is the one soldier whose experience stays.

- **Promoted at LINE.** The first time a squad reaches LINE, one of its men takes command:
  a name and a doctrine, dealt by the war's own calendar, so the same war deals the same
  officers. A squad whose officer falls earns another the same way.
- **Falls with a wiped squad.** An officer keeps every lesson (the squad's, `tier × 6`, ×1.5
  for a job done) for as long as anyone from the squad comes home, whatever it lost, and falls
  with a squad that comes home with nobody: the moment its rank resets too. Duels count,
  since their losses are real; ghost raids do not. The service record keeps the fallen by name.
- **Best at one doctrine.** Three grades: LIEUTENANT on promotion, CAPTAIN at 120 experience,
  MAJOR at 360. On the officer's own doctrine the squad fights at +4, +7 or +10% health and
  damage by grade; on other orders +1, +2 or +3%. The edge multiplies the squad's rank, and the
  product is stamped on the wave at launch like the rank always was, so replays, ghost codes
  and what-ifs carry it.

The planner's orders block names the officer and says what they give the squad on the orders
it has: ON IT +7%, OFF IT +2%. It is a small edge on purpose: kept on the orders the force
was chosen for, officers add one to five points of clear rate; switching every squad to its
officer's doctrine costs six to eleven, because each side's best doctrine is worth more than a
grade. So an officer's doctrine decides which squad goes on which job, not what a squad is
ordered.

### 5.7 Offline probes

- Max 3 probe raids per offline period; total possible loss capped (~15% of unbanked loot).
- Full-loss defeat grants a 12h shield. Probes scale to your Front Line tier, slightly soft.
- Every probe produces a replay — offline losses must always be explainable.

**The last one is offered, not resolved** *(v1.43)*. Coming back to a full
after-action report is a report about a game you did not play, so the final probe
of an absence is held back with a thirty-minute window on it and two answers:

- **GARRISON** resolves it exactly as never being offered would have — the probe,
  under standing orders, a slice of the stockpile on a breach and no buildings
  wrecked. Walking away is the same answer; the attack lands either way. There is
  no penalty for declining, because a player who cannot play right now is not
  doing anything wrong.
- **DEFEND** is a different battle. A probe is two waves with the defender economy
  switched off, which makes it unloseable for a built town and unplayable for the
  commander — no CP means no verbs. Standing to fight makes them commit: the same
  rung, the same seed, the whole assault, with the town's own siege economy. Hold
  it and nothing is lost and half a skirmish's loot is paid; lose it and it is a
  played siege, so every structure that did not survive is wrecked and costs a
  repair.

A defence you fought is logged as DEFENDED rather than PROBE and carries no replay,
under the same rule as the vault (§5.9): a played battle was made of commands the
config never held.

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

The **vault** keeps the last ten hands-off battles — ladder raids, code duels, ghost raids
(v1.66) and the offline probes fought while you were away — on the WAR tab, each still watchable. A
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

### 5.10a Ghost raids *(v1.66, M27)*

A share code was a boast with nothing riding on it: a friend raided a snapshot of your base on
their own machine, and you never heard of it. A **ghost raid** is that raid with the other
commander on the other end of it, and still no server: what goes between the two is codes.

- **A callsign.** Each war has one, chosen on the WAR tab and made from when the war began until
  it is. Every code a war sends carries it, and SHARE MY BASE is named for it.
- **Sending one.** SEND A GHOST RAID takes a base code and opens the planner on that snapshot,
  entered by its edge, with no galleries and no fire plan. The launch sends a **ghost code**
  instead of fighting: each squad's men, sector, doctrine, start and rank, the army's research,
  the dice, who it is from and who it is for, and the sender's own base, so it can be answered.
  The men never leave the yard. GHOSTS OUT keeps each ghost, and its code, until its result
  comes back.
- **Taking one.** TAKE A GHOST CODE fights it on the town as it stands, under its standing
  orders, as a probe is fought, on the attacker's own units. The defence log and the vault name
  who sent it, and its report and heat map are the attacker's raid seen from the wire. The card
  offers SEND THE RESULT, the battle as a replay code, and SEND ONE BACK, the planner on the
  sender's base. A town takes a ghost once, and only one addressed to its callsign.
- **Collecting.** The result goes into the same box. The attacker's game matches it to a ghost it
  sent, checks the battle is that ghost (the same men on the same seconds at the same rank, the
  same research and dice, nothing fired at them, a fight for the post), fights it again and pays
  by the ending it reaches itself. A result pays once.

**What moves is standing.** A hold pays the defender 15 and a breach costs 15; taking the post
pays the attacker 30 and a duel's loot, and being thrown back costs what a failed raid does. A
ghost is a copy of an army, and the town it hits is fought, not damaged: nobody's men, stores,
walls or ordnance change. Three ghost battles a day move standing, each way, and the rest are
fought and filed for nothing, because without a server nothing can tell a real result from one
written by hand, or a friend from a second war of one's own.

**A commander's town is entered by its edge.** A town is walled against its north edge, and the
south sectors are the row under its command post, so a ghost, and since v1.66 a duel, comes in
by N1 or N2. A plan written against a post opens on a town with each squad moved to the nearer
of the two, and a duel's what-if offers only those.

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

## 5.13 What a row can do *(v1.26–v1.28)*

A phone has one button. Every gesture the drawer answers has to be told apart from every
other one by the same finger, so each is separated by an axis or by time rather than by a
different input:

| gesture | what it does |
| --- | --- |
| tap a row | the row's main action — arm a tool, open a card, spend |
| **hold a row** | its spec card: what the thing is, costs and does |
| drag up/down in the list | scroll |
| **drag sideways in the list** | previous/next tab *(portrait only)* |
| drag the handle | resize the drawer; release snaps to shut/rest/half/full |
| tap the handle | collapse, or back to rest |
| **a finger on a coasting list** | stops it, and activates nothing |
| **drag a row's silhouette to the map** | arms the tool and aims it, in one stroke |

**Rest** is where the drawer opens *(M34)*: exactly the room the board leaves below the
world at its fit zoom, so the whole map is in view with the drawer open. It is never less
than two rows of list and never more than half. It is a name rather than a height,
resolved on every layout, because the right height depends on the world's shape as well
as the phone's, and a rotation has to re-measure it. Where the world fills the height
first — a browser tab, a tablet — there is nothing to leave, and rest is the two-row floor.

The carry is the one gesture that does not share a finger with the list, and
it is the only one that could not: in portrait the drawer sits BELOW the board,
so dragging a row onto the map and scrolling the list are the same stroke in
the same direction. Nothing about the motion separates them, so the target
does — the silhouette is a grab area, the rest of the row is not. Tap-then-tap
still works, and is still the faster path for placing six of the same thing.

The lock decides **once**, early, from travel since the press began — a per-frame
comparison flips axis on any wobble — and vertical wins ties and near-ties 1.4:1, because
scrolling is what a list is for and a scroll that keeps changing tab is worse than a swipe
that has to be deliberate. Sideways only means "next tab" in portrait; in landscape the
panel is a vertical rail and a horizontal drag across it is a drag onto the map.

The hold is reserved for things that **do not change state**. It is discovered by accident
— a thumb resting on a row while the player reads it is a long press — so the only safe
thing to find there is information. It fires while the finger is still down, confirmed by
a buzz: a long press that only resolves on the lift gives no way to tell it worked, and
the player lifts. Firing it spends the tap; a press is one thing or the other.

### The spec card

Two cards, and they ask different questions. A **defence** is judged on what it
shoots and what bounces off it. An **attacker** is judged on what it can get
through, how fast it crosses the ground, and what losing it costs — nobody
wonders how far a rifleman shoots. So the unit card leads with the demolition
rates against walls and the Command Center, the walk in cells per second, and
`cpValue`: the number that reads backwards, because every unit sent is Command
Points handed to the defender when it dies.

A card opens on a **disabled** row too. Reading about something you cannot
afford yet, or have not unlocked, is exactly when you want to — so a control
that will not act still answers. The press is taken for the hold alone; the
release still refuses, so nothing can be bought by accident.

Until v1.28 nothing in the game said what a structure does. The build list gave a name, a
price and a count; range, rate of fire, splash, minimum range, and what a weapon shreds or
bounces off lived in the content files and appeared on no screen. Four emplacements at
four prices, and the only way to compare them was to buy one.

The card shows the silhouette (the same `drawStructureGlyph` the board draws, so the card
teaches the shape it will have), the price and build time, HP and footprint, what it
produces an hour if it produces anything, its weapon as **effective DPS against each
armour class it can actually reach**, and the upgrade ladder with prices.

Effective DPS rather than the raw multiplier on purpose: a multiplier is a number about
the damage table, and effective DPS is a number about the fight — it is the one that makes
two guns comparable at a glance. Classes a weapon may never engage are omitted rather than
printed at their table value, because "×0.3 vs AIRCRAFT" for a rifle pit that cannot
elevate is a lie about a shot it will never take.

Nothing on the card is authored prose about a structure. Every number is read out of the
catalog the engine fights with, so a balance pass moves the card with it and a card can
never describe a gun that no longer exists.

---

## 6. Presentation

### 6.1 Art direction — "the ink page" *(rewritten M32)*

**You are not looking down at a battlefield. You are looking at a page of a graphic novel
about one, and drawing your defences onto it.**

Black and white, shaded with adhesive screentone, with exactly one colour on it. The board
is a panel with a heavy border; so is the rail beside it; so is every overlay. The fiction
is unchanged from v1.19 — it is still a map you are planning on, which is still why the view
is top-down and why marginalia is native rather than clutter — but the medium changed from a
surveyor's sheet to a printed page, and the medium is what carries the meaning now.

**The substitution.** v1.19 said what ground you were looking at with HUE — green woodland,
blue water, buff paper — and spent its entire value budget doing it, which is why every
silhouette needed a cream knockout to survive being drawn on top of it. This says it with
TONE DENSITY. The legend is the sim's own ground classes, so the density you see IS the class
the pathfinder reads:

| Ground | Screen | What it costs you |
|---|---|---|
| Open | `t10` dots | move cost 1.0 |
| Rough | `t20` dots | 1.3 |
| Steep | `t40` dots | 1.6, and +range to whoever holds it |
| Woodland | 45° hatch | 1.15, and ×0.7 incoming direct fire |
| Water | −30° cross-hatch | impassable |
| Road | bare paper | 0.7 — the fastest ground there is, and the brightest |

**The value rule, and it is still about AREA rather than lightness alone:**

> Ground covers area and is never darker than a tone screen, so it is always at least 60%
> paper by area. Anything hostile covers area and is **solid ink**. Anything you own covers
> area and is **bare paper inside an ink keyline**. Nothing on the board is a mid grey, so
> nothing on the board is ambiguous.

That last clause is the one that does the work. A phone at 40% brightness in sunlight loses a
crimson-versus-olive pair completely and loses nothing here, and the direction is very nearly
colour-blind safe by construction — the one hue is a mark rather than a fill.

**Objects get opposite treatments, and the reason is scale.** A structure is architecture
drawn on the map: mass in paper, keyline in ink, detail marks in ink, and hostile structures
filled solid with their marks knocked out. A unit is a counter placed on it — at 26 px a 3 px
keyline round a 20 px figure closes up and turns the whole thing into a blot, so yours is
painted eight times in ink around itself and theirs keeps a paper pad under a solid
silhouette.

**Two greys, one job each.** `ink-dim` is secondary ink for body copy and captions;
hierarchy on a printed page comes from size and weight, not from washing out the value.
`disabled` is the only light grey in the system, means "you cannot do this", and appears
nowhere on the board — which is why a disabled row reads as disabled before it is read.

**The UI is ON the page.** v1.19 kept panels dark on the argument that the board was paper
and the UI was the table it was lying on. A comic has no table. The rail is a panel at the
same line weight as the board, and every control has three states and no more: **knockout**
(chosen, pressed, or the primary action — solid ink, paper label), **disabled** (paper inside
a grey line, no ink at all), **resting** (paper inside an ink line).

**Kinetics instead of particles.** An impact is a jagged star filled paper and stroked ink; a
heavy one throws focus lines at itself; a strafe is speed lines. Ink does not fade to grey, so
an effect holds full value and then cuts rather than dissolving. See `kinetics.ts`.

| Token | Hex | Use |
|---|---|---|
| `bg-field` / `paper-warm` | `#ffffff` | The paper, and the fill of anything you own |
| tone screens | — | `t10`–`t60` dots, 45° hatch, −30° cross-hatch (`tone.ts`) |
| `olive-dark` / `sand-dark` | `#111111` | Every keyline, every mark, every rule |
| `crimson` | `#111111` | Hostile, filled solid |
| `olive` / `sand` / `steel` | `#c9c9c9` | A secondary panel inside a silhouette |
| `ink` | `#111111` | UI text |
| `ink-dim` | `#4a4a4a` | Secondary copy, captions, marginalia |
| `disabled` | `#9e9e9e` | "You cannot do this", and nothing else |
| `alarm` / `signal` / `tracer` | `#e0243c` | The one colour. Three or four marks a screen |
| `un-blue` | `#e0243c` | A medic's cross — the one persistent mark that earns it |

**Screentone is locked to the WORLD, not the screen.** The page is baked once in world space
and lives inside the board container, so the dots are part of the ground: pan and they stay
put, zoom and you lean in over the paper. A screen-locked dot screen crawls and moirés, and
that is the usual way this style fails in a game.

**Two faces, and the split between them is the whole type system.** The DISPLAY face is
Barlow Condensed and carries every LABEL — a row's name, a button, a tab, a heading, a
masthead. It is what a comic sets its captions and its shouting in, and it is where the
direction's character comes from; the game read like a terminal until it arrived. MONO
carries every FIGURE — costs, counts, timers, hashes, share codes — and prose, because a
column of numbers has to line up and a code is read a character at a time.

Neither costs a request. Two weights of the latin subset are base64 data URIs in
`src/fonts.css`, about 45 KB of font, so the PWA works offline and the single-file build
still fetches nothing. Barlow is SIL OFL 1.1; the licence travels in `LICENSES.md`.

Loading is not automatic and the failure is silent. Canvas text does not trigger font
loading, and the board's `Text` measures a face the first time it sets a string and keeps
those metrics — so a game that starts before the face is ready measures the FALLBACK and
places the board's lettering for a font it is not drawing. Until M30 moved the UI into the
DOM, that was every row, wrap and tap target too. `main.ts` waits on
`document.fonts.load` for both weights before it constructs the game, raced against a
timeout so a font that fails to decode costs the look and not the game.

A condensed face at the same pixel height reads noticeably smaller than a mono one, so
`display()` multiplies the layout token by `DISPLAY_SCALE`. That is the only thing the two
faces have to agree on: a row label and the figure beside it looking like the same size.

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
src/sim/       Pure TypeScript, zero rendering imports. Fixed-tick (20 tps) deterministic
               engine: seeded PRNG, grid, weighted A*, combat, command queue.
               Replay = initial state + seed + timestamped commands.
src/game/      Rendering & input: scenes (Town, Siege, RaidPlanner, Replay), the board
               drawn by a Canvas2D stage of the game's own (Phaser 3 until v1.49), the
               UI in the DOM over it, interpolated rendering on top of sim ticks.
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
