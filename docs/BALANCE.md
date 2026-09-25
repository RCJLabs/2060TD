# Balance snapshot (v1.62.0)

Deterministic headless matrices from `npm run balance -- --md`.
20 seeds × 3 base variants per raid cell; 20 seeds per defense cell.
Defense rows measure the permanent layer alone (no live CP play), the floor a base must clear —
an active player defends one to two ladder levels above their probe floor.

> **CLEAR% is becoming a probability, and was not one before v1.23.** Until then the sim
> never rolled in combat: a raid with no fire plan drew from the engine's stream exactly once
> per unit — a ±3-8% speed roll at spawn — and nothing else in it was random. 86% of matchups
> reached the SAME verdict under every seed and 54% brought the identical force home, so a
> cell was a count of matchups tipped rather than a rate, and a five-tier mean moved in steps
> of 6.7 points. Twelve releases of tuning were read off that.
>
> v1.23 rolls (`--seed` is the instrument, GDD §3): 63% and 28% now. A cell is still closer to
> a count than a rate — a matchup that is hopeless stays hopeless — so keep treating a gap
> narrower than one matchup as noise, and prefer DESTR%, which is continuous, when a change is
> smaller than a whole cell. What is no longer true is that a gap of a few points is
> necessarily nothing: the rows can move now without the content moving.
>
> Every table below EXCEPT the ones that name a model was measured with the rolls on, so none
> of them is comparable to a pre-v1.23 snapshot cell for cell.
>
> **These are the first tables measured against the KILL CHAIN (v1.41), and none of them is
> comparable to a v1.40 cell either.** Taking a command post is no longer chewing an HP bar:
> it is four staged gates — breach, suppress, charge, burn — each paid in a different stat
> (GDD §5.4a). Two things follow for reading these rows. The raid rows use REFERENCE PLANS
> that were re-derived against the chain and are combined arms now, so a raid cell measures
> a different force as well as a different objective. And the DEFENSE rows moved for a
> reason that is not content: `defenseMatrix` builds its config by hand, it was never told
> about the chain, and so every defence number in the v1.41 snapshot before this one was
> still being measured on the sponge while the game shipped the chain.
>
> **v1.41.1 moved MP LOST% and the DEFENSE rows, and nothing else.** v1.41's chain
> could deadlock: an attacker that had reached the post, could not pay the crew
> minimum and could no longer be shot had nowhere left to go, and 18% of reference
> sieges ended that way. A spent assault is now written off after 90 static seconds
> (GDD §5.4a). Held to ONE variable — same seeds, same plans, chain v1 against v2 —
> CLEAR% and DESTR% come back identical in every tier and only MP LOST% moves (USA
> T2 27 → 73, T4 66 → 75): the assault that stalls was never going to clear and had
> already done its damage, so the whole of the change is whether the force pinned at
> the wire walks home. It does not. The DEFENSE rows gained for the mirror reason —
> a stalemate used to run to the tick cap and be filed as a defeat, and is now
> scored as the defender victory it always was.
>
> **v1.41.2 latches the breach, and these tables are measured against chain
> version 3.** M22 dropped the opened post from the target list so standoff fire
> could not shell a bar that cannot move, and wrote it as a live comparison
> against the breach floor — which a repair aura crosses back over, handing the
> livelock straight back. Found in M23 Phase 2 on UN LATE (CC3) level 4, where a
> lone gunship held a bar oscillating either side of 0.70 for thirty thousand
> ticks. It was invisible to every table in this file, including the two written
> to hunt exactly this: a defender only reaches it by taking more than the three
> actions HOLDFAST allows, and nothing here had ever let one.
>
> **v1.42 LENGTHENED the assault ladder, so no defence row here is comparable
> to the row above it in the history by level number.** A level is a +25% step
> now instead of up to +67%, and today's level 6 is roughly what level 2 used
> to be. The defence tables sample levels 1, 4, 6, 8, 10 and 12 — the rungs
> covering the same difficulty range the old six did — so read a cell against
> its column header, never against its position.
>
> The reason is M23 Phase 3. A defence row is CONTESTED when it lands between
> winning every seed and losing every seed, and the band that does it is about
> 43% of attacker strength wide. A six-rung ladder over this range has a floor
> of +33% per rung even when perfectly uniform, so ONE contested level per base
> was the ceiling — which is what every snapshot in this file had recorded, and
> what three content notes carried since v0.6 were separately describing.
> Contested levels per row: 0.73 before, 2.20 after.
>
> **M34 moved every battle onto a 10x15 board at two units a cell, so no row here
> is comparable to a v1.44 cell.** The catalog is written in physical units and
> halves onto the new cells, but a gun or a wall cannot shrink below one, and the
> kill chain is version 4: a crew stuck on a covered post goes after the guns
> covering it. The eight generator plans, the three reference bases and the deal
> were drawn or chosen again for this board. The assault ladder was re-tuned so each
> defence row first holds under half where v1.44's did (`--retune`): a heavy every
> four levels instead of two, and +7% a level instead of +9%, which moves that level
> by −0.07 on average against −1.13 for the old ladder on this board. Two rows below
> measured nothing before this snapshot: the Engineer Corps HQ and the forward AA
> mount never landed. A reference layout that does not land now stops the harness.
>
> **v1.45.3 is kill chain 5, which changes how standing orders and fire plans AIM and
> nothing else.** Three distances an order aims by had stayed cells through M34 and are
> units now: the radius a cluster is counted within, and how far out the approach gun
> goes. A fire mission on the densest knot is laid ahead of it, on the ground force it
> can hit. A bare defence row has neither orders nor a fire plan and reads exactly as
> v1.45.2 did; the raid rows and every row fought under standing orders moved.
> HOLDFAST's second gun goes to the breach in the same release (M23 Phase 3c).
>
> **v1.47.0 is kill chain 6: a fire mission pins what it lands on (M23 Phase 5).** A
> ground unit a gun run or a barrage lands on moves no stage of the chain for eight
> seconds: it does not move, shoot, dig or hold. Only fire missions pin, and nothing in a
> bare defence row or a raid calls one on the attack, so those rows read exactly as
> v1.46.0's did. The rows fought under standing orders moved, and HOLDFAST's gun run
> waits for the assault to reach the post now.
>
> **v1.62.0 switches on the factions' own rules (M26).** Every defence row fights under
> its faction's rule now, as the game does: the USA's field kit, Russia's hulks and
> trimmed emplacements, the UN's standing mandate (the humanitarian shield). The USA's
> HOLDFAST table moved, since its garrison's field defences cost twice as much, and so
> did Russia's and the UN's tables and missions. China's and the KPA's, and every raid
> row, read exactly as they did. Nothing between v1.47.0 and v1.61.0 moved a row: measured
> without the rules (`--no-signatures`), this file is v1.47.0's, row for row.

```
RAID — UNITED STATES strike force (25 MP) vs PLA Front Line
TIER | CLEAR% | DESTR% | MP LOST%
-----+--------+--------+---------
   1 |    100 |     60 |        5
   2 |    100 |     55 |       23
   3 |     80 |     72 |       42
   4 |     25 |     43 |       87
   5 |      7 |     31 |       97

RAID — UNITED STATES strike force (25 MP) vs PLA Front Line — STRIKE doctrine + fire plan
TIER | CLEAR% | DESTR% | MP LOST%
-----+--------+--------+---------
   1 |    100 |     60 |        4
   2 |    100 |     55 |       20
   3 |     97 |     76 |       26
   4 |     57 |     53 |       72
   5 |     30 |     44 |       81

RAID — UNITED STATES strike force (25 MP) vs PLA Front Line — AIR RAID (rotors + a ground tail)
TIER | CLEAR% | DESTR% | MP LOST%
-----+--------+--------+---------
   1 |     50 |     89 |       58
   2 |      0 |     22 |      100
   3 |     17 |     59 |       90
   4 |      0 |     43 |      100
   5 |      3 |     53 |       99

RAID — PLA EXPEDITIONARY FORCE strike force (26 MP) vs US ARMY Front Line
TIER | CLEAR% | DESTR% | MP LOST%
-----+--------+--------+---------
   1 |    100 |     71 |       12
   2 |    100 |     75 |       32
   3 |     67 |     76 |       46
   4 |     67 |     59 |       58
   5 |     42 |     65 |       83

RAID — PLA EXPEDITIONARY FORCE strike force (26 MP) vs US ARMY Front Line — STRIKE doctrine + fire plan
TIER | CLEAR% | DESTR% | MP LOST%
-----+--------+--------+---------
   1 |    100 |     71 |       12
   2 |    100 |     76 |       25
   3 |     68 |     79 |       41
   4 |     92 |     64 |       40
   5 |     57 |     73 |       69

RAID — PLA EXPEDITIONARY FORCE strike force (26 MP) vs US ARMY Front Line — AIR RAID (rotors + a ground tail)
TIER | CLEAR% | DESTR% | MP LOST%
-----+--------+--------+---------
   1 |     60 |     93 |       42
   2 |      0 |     48 |      100
   3 |     35 |     66 |       77
   4 |      0 |     44 |      100
   5 |      0 |     55 |      100

RAID — RUSSIAN GROUND FORCES strike force (27 MP) vs US ARMY Front Line
TIER | CLEAR% | DESTR% | MP LOST%
-----+--------+--------+---------
   1 |    100 |     83 |       19
   2 |    100 |     86 |       24
   3 |    100 |     91 |       29
   4 |     68 |     77 |       68
   5 |     45 |     67 |       84

RAID — RUSSIAN GROUND FORCES strike force (27 MP) vs US ARMY Front Line — STRIKE doctrine + fire plan
TIER | CLEAR% | DESTR% | MP LOST%
-----+--------+--------+---------
   1 |    100 |     81 |       15
   2 |    100 |     87 |       19
   3 |    100 |     91 |       20
   4 |     98 |     85 |       38
   5 |     58 |     70 |       70

RAID — RUSSIAN GROUND FORCES strike force (27 MP) vs US ARMY Front Line — AIR RAID (rotors + a ground tail)
TIER | CLEAR% | DESTR% | MP LOST%
-----+--------+--------+---------
   1 |     63 |     94 |       39
   2 |      0 |     43 |      100
   3 |     27 |     69 |       78
   4 |      0 |     49 |      100
   5 |      0 |     61 |      100

RAID — KOREAN PEOPLE'S ARMY strike force (26 MP) vs US ARMY Front Line
TIER | CLEAR% | DESTR% | MP LOST%
-----+--------+--------+---------
   1 |    100 |     73 |       25
   2 |     98 |     75 |       29
   3 |    100 |     70 |       36
   4 |     65 |     66 |       74
   5 |     52 |     52 |       76

RAID — KOREAN PEOPLE'S ARMY strike force (26 MP) vs US ARMY Front Line — hunt + raze squads TUNNELED
TIER | CLEAR% | DESTR% | MP LOST%
-----+--------+--------+---------
   1 |    100 |     69 |       22
   2 |     87 |     81 |       45
   3 |    100 |     73 |       33
   4 |     87 |     73 |       62
   5 |     62 |     56 |       70

RAID — KOREAN PEOPLE'S ARMY strike force (26 MP) vs US ARMY Front Line — TUNNELED + STRIKE doctrine + fire plan
TIER | CLEAR% | DESTR% | MP LOST%
-----+--------+--------+---------
   1 |    100 |     69 |       18
   2 |    100 |     87 |       30
   3 |    100 |     78 |       32
   4 |    100 |     77 |       49
   5 |     65 |     60 |       65

RAID — KOREAN PEOPLE'S ARMY strike force (26 MP) vs US ARMY Front Line — STRIKE doctrine + fire plan
TIER | CLEAR% | DESTR% | MP LOST%
-----+--------+--------+---------
   1 |    100 |     74 |       19
   2 |    100 |     79 |       20
   3 |    100 |     76 |       31
   4 |     80 |     75 |       61
   5 |     67 |     56 |       63

RAID — KOREAN PEOPLE'S ARMY strike force (26 MP) vs US ARMY Front Line — AIR RAID (rotors + a ground tail)
TIER | CLEAR% | DESTR% | MP LOST%
-----+--------+--------+---------
   1 |     75 |     96 |       27
   2 |      0 |     31 |      100
   3 |     32 |     53 |       86
   4 |      0 |     44 |      100
   5 |      0 |     56 |      100

RAID — UN COALITION strike force (26 MP) vs PLA Front Line
TIER | CLEAR% | DESTR% | MP LOST%
-----+--------+--------+---------
   1 |    100 |     80 |       10
   2 |    100 |     88 |       23
   3 |     65 |     80 |       55
   4 |     35 |     66 |       85
   5 |      7 |     61 |       98

RAID — UN COALITION strike force (26 MP) vs PLA Front Line — CONTROL: medics replaced by riflemen
TIER | CLEAR% | DESTR% | MP LOST%
-----+--------+--------+---------
   1 |     77 |     81 |       67
   2 |     35 |     57 |       85
   3 |      8 |     52 |       97
   4 |      0 |     32 |      100
   5 |      0 |     36 |      100

RAID — UN COALITION strike force (26 MP) vs PLA Front Line — STRIKE doctrine + fire plan
TIER | CLEAR% | DESTR% | MP LOST%
-----+--------+--------+---------
   1 |    100 |     84 |        9
   2 |    100 |     88 |       15
   3 |     82 |     91 |       41
   4 |     77 |     82 |       56
   5 |     42 |     71 |       85

RAID — UN COALITION strike force (26 MP) vs PLA Front Line — AIR RAID (rotors + a ground tail)
TIER | CLEAR% | DESTR% | MP LOST%
-----+--------+--------+---------
   1 |      0 |     81 |      100
   2 |      0 |     25 |      100
   3 |      5 |     58 |       97
   4 |      0 |     46 |      100
   5 |      3 |     53 |       99

ARCHETYPES — UNITED STATES strike force (25 MP), clear% by tier
SHAPE        | FROM |   T1 |   T2 |   T3 |   T4 |   T5 |  MEAN | DESTR% | MP LOST%
-------------+------+------+------+------+------+------+-------+--------+---------
COMPOUND     |    1 |  100 |  100 |   82 |   83 |   67 |  86.4 |     54 |       29
OPEN CAMP    |    1 |  100 |  100 |   72 |   33 |    5 |  62.0 |     74 |       54
CORRIDOR     |    1 |  100 |  100 |   40 |    7 |   35 |  56.4 |     58 |       58
STAR FORT    |    2 |  100 |  100 |   75 |    3 |    0 |  55.6 |     52 |       59
  └ prepared |      |  100 |  100 |   97 |   28 |    0 |  65.0 |     58 |       51
DISPERSED DEPOT |    3 |  100 |  100 |   67 |    8 |   15 |  58.0 |     50 |       57
  └ prepared |      |  100 |  100 |   87 |   27 |   28 |  68.4 |     54 |       52
STRONGPOINTS |    3 |  100 |  100 |   92 |   68 |    2 |  72.4 |     53 |       43
KEEP         |    4 |  100 |  100 |  100 |   67 |   38 |  81.0 |     50 |       36
BUNKER COMPLEX |    5 |  100 |  100 |   47 |   32 |   17 |  59.2 |     66 |       52
  └ prepared |      |  100 |  100 |   72 |   40 |   55 |  73.4 |     70 |       43

FIELD CONDITIONS — UNITED STATES strike force (25 MP), clear% by tier
CONDITION    |   T1 |   T2 |   T3 |   T4 |   T5 |  MEAN | vs CLEAR
-------------+------+------+------+------+------+-------+---------
CLEAR LINE   |  100 |  100 |   80 |   25 |    7 |  62.4 |     +0.0
HARD RAIN    |  100 |  100 |  100 |   57 |   33 |  78.0 |    +15.6
DUG IN       |  100 |  100 |   68 |    5 |    0 |  54.6 |     -7.8
FUEL CRISIS  |  100 |  100 |   62 |    2 |    0 |  52.8 |     -9.6
BLACKOUT     |  100 |  100 |   80 |   25 |    7 |  62.4 |     +0.0
ATTRITION    |  100 |  100 |   75 |   12 |    0 |  57.4 |     -5.0

TERRAIN — the UNITED STATES reference force vs PLA posts, flat ground vs real
GROUND      |    T1 |    T2 |    T3 |    T4 |    T5 |  MEAN | MP LOST%
------------+-------+-------+-------+-------+-------+-------+---------
       FLAT |   100 |   100 |    87 |    42 |     8 |  67.4 |       47
     GROUND |   100 |   100 |    92 |    62 |    50 |  80.8 |       39
    SHEET 1 |   100 |   100 |    80 |    20 |    50 |  70.0 |       44
    SHEET 2 |   100 |   100 |    95 |    65 |    30 |  78.0 |       42
    SHEET 3 |   100 |   100 |   100 |   100 |    70 |  94.0 |       31

PARITY — every faction at its own best line, same manpower, same ladder
FACTION     |    T1 |    T2 |    T3 |    T4 |    T5 |  MEAN | MP LOST% | LINE
------------+-------+-------+-------+-------+-------+-------+----------+------
UNITED STAT |   100 |   100 |    92 |    62 |    50 |  80.8 |       39 | GROUND
PLA EXPEDIT |   100 |    98 |    77 |    82 |    47 |  80.8 |       45 | GROUND
RUSSIAN GRO |   100 |    90 |    93 |    77 |    55 |  83.0 |       48 | GROUND
KOREAN PEOP |   100 |   100 |    85 |    65 |    62 |  82.4 |       56 | TUNNEL
UN COALITIO |   100 |    97 |    68 |    60 |    50 |  75.0 |       51 | GROUND

SPREAD — 8.0 points between RUSSIA and UN. Five kits differing in STYLE (GDD §4) should not differ this much in ODDS.

THE DEAL — the three targets a rung offers vs the eight it could offer
SHAPE        |    T1 |    T2 |    T3 |    T4 |    T5 |  MEAN
-------------+-------+-------+-------+-------+-------+-------
star         |   100 |    96 |    76 |    21 |     1 |  58.9
depot        |   100 |    97 |    89 |    39 |    27 |  70.4
corridor     |   100 |    97 |    68 |    44 |    44 |  70.7
compound     |   100 |    96 |    61 |    73 |    39 |  73.9
bunker       |   100 |    92 |    71 |    52 |    55 |  73.9
strongpoints |   100 |    97 |    96 |    71 |    16 |  76.0
keep         |   100 |    97 |    93 |    68 |    36 |  78.9
camp         |   100 |   100 |    93 |    65 |    68 |  85.3

WHAT EACH FACTION IS DEALT — its three targets vs its own pool at that rung
FACTION |          T1 |          T2 |          T3 |          T4 |          T5 |   MEAN GAP
--------+-------------+-------------+-------------+-------------+-------------+-----------
    USA |  100/100 +0 |  100/100 +0 |    62/71 -9 |   60/37 +23 |   33/22 +11 |       +5.0
  CHINA |  100/100 +0 |    93/95 -2 |   67/79 -12 |   98/75 +23 |   71/53 +19 |       +5.5
 RUSSIA |  100/100 +0 |    96/97 -1 |    91/91 -0 |   82/60 +22 |   56/43 +13 |       +6.8
     NK |  100/100 +0 |    93/95 -2 |    93/97 -3 |    71/70 +2 |    47/43 +3 |       -0.0
     UN |  100/100 +0 |  100/100 +0 |    64/66 -1 |    36/30 +5 |   29/18 +11 |       +3.1

  dealt/pool and the gap. A deal that tracks its pool is offering that faction
  a fair read of the rung; a big negative gap is a rung of walls.

SHAPE COVERAGE — the rungs each faction is dealt each shape on
SHAPE        |         USA |       CHINA |      RUSSIA |          NK |          UN
-------------+-------------+-------------+-------------+-------------+-------------
compound     | T1,T2,T4,T5 | T1,T2,T3,T4 | T1,T2,T4,T5 | T1,T2,T4,T5 | T1,T2,T3,T4,T5
camp         | T1,T2,T4,T5 |          T1 |    T1,T4,T5 |       T1,T4 |       T1,T5
corridor     |       T1,T3 | T1,T2,T3,T5 |    T1,T2,T3 |       T1,T2 |    T1,T2,T4
star         |          T2 |          T2 |          T2 |       T2,T3 |          T2
depot        |          T3 |          T3 |          T3 |          T3 |          T3
strongpoints |          T3 |          T4 |          T3 |          T3 |          T3
keep         |          T4 |       T4,T5 |          T4 |       T4,T5 |          T4
bunker       |          T5 |          T5 |          T5 |          T5 |          T5

  8 of 8 shapes reach a player somewhere.

THE LADDER, pool mean per rung: T1 100  ->  T2 97  ->  T3 81  ->  T4 54  ->  T5 36
STEP SIZE: T1->T2 -3  T2->T3 -17  T3->T4 -26  T4->T5 -19 — POOL mean, at a fixed reference force.
  This is the whole pool, not the deal, and the force is a mature army: the early
  rungs saturate near 100 and no step between them can show. It is here to price
  the SHAPES, not to judge the ladder — `--rungs` does that, by asking how much
  force each rung demands rather than what one army does to all of them.

THE TWO KITS — every force against both sets of fortifications
FORCE   | vs PLA post | vs US firebase |   GAP | normally raids
--------+-------------+----------------+-------+---------------
    USA |        60.9 |           79.7 | -18.8 | CHINA
  CHINA |        56.3 |           74.5 | -18.2 | USA
 RUSSIA |        65.6 |           75.5 |  -9.9 | USA
     NK |        37.5 |           76.6 | -39.1 | USA
     UN |        55.7 |           69.8 | -14.1 | CHINA

WORST GAP 39.1 points. Two fronts differing in STYLE should not differ this much in DIFFICULTY — whoever raids the softer one is playing on easy and did not choose to.

THE PLAN, NOT THE FACTION — the same roster asked twice
FACTION | REF MP | REFERENCE | RECIPE MP | RECIPE |  BEST | PLAN IS WORTH
--------+--------+-----------+-----------+--------+-------+--------------
    USA |     25 |      68.8 |        26 |   45.4 |  68.8 |         -23.3
  CHINA |     26 |      79.6 |        25 |   44.6 |  79.6 |         -35.0
 RUSSIA |     27 |      80.4 |        27 |   50.4 |  80.4 |         -30.0
     NK |     26 |      80.4 |        26 |   80.4 |  80.4 |          +0.0
     UN |     26 |      64.6 |        24 |   38.8 |  64.6 |         -25.8

PLAN IS WORTH UP TO 35.0 POINTS — comparable to every effect this harness measures. Read BEST as the faction and the last column as the error bar; a single plan's row is not a reading of a kit.
BEST-PLAN SPREAD 15.8 points. `--kits` is unaffected: it holds the force fixed and swaps only the fortifications.

WHAT KILLS A COMMAND POST — the heavy's damage type, which was picked for flavour
FACTION | HEAVY FIRES | vs STRUCT | SHIPPING | ALL EXPLOSIVE | ALL KINETIC | SWING
--------+-------------+-----------+----------+---------------+-------------+------
    USA |   explosive |        x1 |     60.9 |          60.9 |        46.9 | +14.1
  CHINA |   explosive |        x1 |     74.5 |          74.5 |        41.1 | +33.3
 RUSSIA |     kinetic |      x0.5 |     75.5 |          75.5 |        75.5 |  +0.0
     NK |     kinetic |      x0.5 |     75.5 |          75.5 |        75.5 |  +0.0
     UN |     kinetic |      x0.5 |     55.7 |          55.7 |        55.7 |  +0.0

ONE FLAG ON ONE UNIT IS WORTH UP TO 33.3 POINTS. Ranged fire is discounted against structures (smallArms 0.15, kinetic 0.5, explosive 1.0); melee ignores the table but
  only fires when adjacent, which in practice only the heavy manages — it lands 60-84% of the killing blows. Normalising the flag does NOT lift the UN off the floor.

WHO CARRIES A RAID — every unit kind taken out of the plan, two ways
FACTION | UNIT         | MP | BASE | SILENCED | REPLACED | SHARE
--------+--------------+----+------+----------+----------+------
    USA |       abrams | 16 |   60 |       49 |       20 |   34%
    USA |       humvee |  6 |   60 |        2 |        3 |    5%
    USA |      javelin |  3 |   60 |        6 |        2 |    3%
  CHINA |    grenadier |  4 |   76 |        9 |       11 |   14%
  CHINA |      militia |  1 |   76 |        0 |        2 |    2%
  CHINA |       type99 | 21 |   76 |       70 |       48 |   63%
 RUSSIA |          btr | 18 |   77 |       65 |        5 |    6%
 RUSSIA |     demoteam |  6 |   77 |       15 |        2 |    2%
 RUSSIA |          rpg |  3 |   77 |       13 |       16 |   21%
     NK |      nkrifle | 12 |   80 |       11 |       21 |   26%
     NK |         rpg7 |  4 |   80 |       14 |       -2 |   -2%
     NK |     tunneler | 10 |   80 |       63 |       31 |   39%
     UN |         nlaw |  3 |   58 |       13 |        5 |    9%
     UN |     unsapper |  2 |   58 |        5 |        9 |   16%
     UN |          vab | 21 |   58 |       58 |       37 |   64%

WORST CARRY 64% — UN vab. M22's bar is 50%: above it, the plan is one unit and two decorations, and "your plan is your skill" is false.
SILENCED zeroes every damage stat and leaves the body; REPLACED takes the kind out and spends its manpower on the rest of the plan. A unit that scores low SILENCED and high REPLACED is earning its place with its BODY — under the kill chain that is a real job, since the charge needs a crew and the burn needs the ground held.

WHAT THE SEED DECIDES — the same matchup fought 12 times (25% of fire does not tell)
FORCE   | MATCHUPS | DECIDED     | SAME MEN HOME | LENGTH | CLEAR
--------+----------+-------------+---------------+--------+------
    USA |       40 |    30 (75%) |      14 (35%) |    648 |  70.4
  CHINA |       40 |    30 (75%) |      10 (25%) |    924 |  79.8
 RUSSIA |       40 |    28 (70%) |       6 (15%) |    792 |  80.0
     NK |       40 |    25 (63%) |        1 (3%) |    722 |  84.6
     UN |       40 |    27 (68%) |      13 (33%) |    742 |  65.2
--------+----------+-------------+---------------+--------+------
    ALL |      200 |   140 (70%) |      44 (22%) |    766 |  76.0

DECIDED is the headline and high is bad: those are matchups where every
seed agreed, so the pairing is the result and the battle is a formality.
SAME MEN HOME is harsher still — the identical force walked back every time.
Against v0 — 86% decided, 54% bringing the same men home — this is what
the model bought. LENGTH widening alongside is the same battles being
fought to different lengths rather than replayed.

WHAT A RAID COULD COME FOR — quota is 65% of what the base holds
FORCE  | DOCTRINE | TAKE POST | SPIKE GUNS | RAID STORES
-------+----------+-----------+------------+------------
USA
ARMOUR |  ASSAULT |      79.2 |       70.8 |        70.8
ARMOUR |     HUNT |      81.9 |       97.2 |        83.3
ARMOUR |     RAZE |      65.3 |       68.1 |        95.8
  FOOT |  ASSAULT |      13.9 |       29.2 |        65.3
  FOOT |     HUNT |      15.3 |       47.2 |        72.2
  FOOT |     RAZE |      19.4 |       23.6 |        80.6
 MIXED |  ASSAULT |      54.2 |       59.7 |        73.6
 MIXED |     HUNT |      54.2 |       79.2 |        72.2
 MIXED |     RAZE |      48.6 |       58.3 |        93.1
       best: POST ARMOUR/HUNT  ·  GUNS ARMOUR/HUNT  ·  STORES ARMOUR/RAZE
-------+----------+-----------+------------+------------
CHINA
ARMOUR |  ASSAULT |      90.3 |       77.8 |        84.7
ARMOUR |     HUNT |      98.6 |      100.0 |        95.8
ARMOUR |     RAZE |      81.9 |       79.2 |        97.2
  FOOT |  ASSAULT |       8.3 |        0.0 |         0.0
  FOOT |     HUNT |      13.9 |       27.8 |         0.0
  FOOT |     RAZE |       2.8 |        0.0 |        41.7
 MIXED |  ASSAULT |      80.6 |       86.1 |        84.7
 MIXED |     HUNT |      77.8 |      100.0 |        93.1
 MIXED |     RAZE |      87.5 |       86.1 |        98.6
       best: POST ARMOUR/HUNT  ·  GUNS ARMOUR/HUNT  ·  STORES MIXED/RAZE
-------+----------+-----------+------------+------------
RUSSIA
ARMOUR |  ASSAULT |      59.7 |       56.9 |        65.3
ARMOUR |     HUNT |      52.8 |       93.1 |        68.1
ARMOUR |     RAZE |      48.6 |       59.7 |        91.7
  FOOT |  ASSAULT |      40.3 |       48.6 |        72.2
  FOOT |     HUNT |      38.9 |       70.8 |        77.8
  FOOT |     RAZE |      25.0 |       36.1 |        81.9
 MIXED |  ASSAULT |      73.6 |       54.2 |        51.4
 MIXED |     HUNT |      86.1 |       95.8 |        65.3
 MIXED |     RAZE |      66.7 |       68.1 |        98.6
       best: POST MIXED/HUNT  ·  GUNS MIXED/HUNT  ·  STORES MIXED/RAZE
-------+----------+-----------+------------+------------
NK
ARMOUR |  ASSAULT |      44.4 |       26.4 |        27.8
ARMOUR |     HUNT |      25.0 |       62.5 |        23.6
ARMOUR |     RAZE |      31.9 |       20.8 |        66.7
  FOOT |  ASSAULT |      25.0 |        5.6 |         0.0
  FOOT |     HUNT |      88.9 |       95.8 |         0.0
  FOOT |     RAZE |      15.3 |        1.4 |        87.5
 MIXED |  ASSAULT |      27.8 |        8.3 |         6.9
 MIXED |     HUNT |      93.1 |      100.0 |        23.6
 MIXED |     RAZE |      20.8 |        8.3 |        86.1
       best: POST MIXED/HUNT  ·  GUNS MIXED/HUNT  ·  STORES FOOT/RAZE
-------+----------+-----------+------------+------------
UN
ARMOUR |  ASSAULT |      50.0 |       47.2 |        30.6
ARMOUR |     HUNT |      34.7 |       68.1 |        36.1
ARMOUR |     RAZE |      38.9 |       26.4 |        79.2
  FOOT |  ASSAULT |      30.6 |       31.9 |        62.5
  FOOT |     HUNT |      15.3 |       44.4 |        59.7
  FOOT |     RAZE |      18.1 |       29.2 |        84.7
 MIXED |  ASSAULT |      68.1 |       47.2 |        61.1
 MIXED |     HUNT |      68.1 |       86.1 |        69.4
 MIXED |     RAZE |      59.7 |       55.6 |       100.0
       best: POST MIXED/ASSAULT  ·  GUNS MIXED/HUNT  ·  STORES MIXED/RAZE
-------+----------+-----------+------------+------------

DISTINCT WINNERS 11 of 15. One force topping every column would mean the objective is a label on the same raid; a different force per column is the whole argument for letting a raid declare what it came for.

GARRISON — the UNITED STATES reference force vs PLA posts
CONFIG      |    T1 |    T2 |    T3 |    T4 |    T5 |  MEAN | MP LOST%
------------+-------+-------+-------+-------+-------+-------+---------
    v1.19 W |   100 |   100 |    68 |    38 |    17 |  64.6 |       49
    v1.19 — |   100 |   100 |    72 |    45 |    40 |  71.4 |       45
 GUNS 0.8 W |   100 |   100 |    90 |    83 |    65 |  87.6 |       33
 GUNS 0.8 — |   100 |   100 |    90 |    60 |    65 |  83.0 |       37
    WATCH W |   100 |   100 |    65 |    17 |    10 |  58.4 |       54
    WATCH — |   100 |   100 |    72 |    43 |    28 |  68.6 |       48
  SHIPPED W |   100 |   100 |    92 |    62 |    50 |  80.8 |       39
  SHIPPED — |   100 |   100 |    90 |    60 |    55 |  81.0 |       40

WALL LINE IS WORTH — v1.19 +6.8  |  GUNS 0.8 -4.6  |  WATCH +10.2  |  SHIPPED +0.2  (clear-rate points to the defender)

AIR — the UNITED STATES reference force vs PLA posts, with and without AA
      GROUND reference 25 MP, AIR plan 30 MP, so the edge is read against GROUND =30
FORCE       |    T1 |    T2 |    T3 |    T4 |    T5 |  MEAN | MP LOST%
------------+-------+-------+-------+-------+-------+-------+---------
     GROUND |   100 |   100 |    92 |    62 |    50 |  80.8 |       39
 GROUND =30 |   100 |   100 |    88 |    93 |    38 |  83.8 |       38
 AIR mounts |    68 |     0 |     0 |     0 |    25 |  18.6 |       87
AIR +manpads |    68 |     0 |     0 |     0 |    25 |  18.6 |       88

AIR'S EDGE OVER MATCHED GROUND — vs mounts -65.2  |  vs mounts+manpads -65.2  (clear-rate points, both forces at 30 MP)

AIR — the PLA EXPEDITIONARY FORCE reference force vs US ARMY posts, with and without AA
      GROUND reference 26 MP, AIR plan 30 MP, so the edge is read against GROUND =30
FORCE       |    T1 |    T2 |    T3 |    T4 |    T5 |  MEAN | MP LOST%
------------+-------+-------+-------+-------+-------+-------+---------
     GROUND |   100 |    98 |    77 |    82 |    47 |  80.8 |       45
 GROUND =30 |   100 |   100 |    82 |    87 |    63 |  86.4 |       45
 AIR mounts |    72 |    20 |    25 |     0 |     0 |  23.4 |       82
AIR +manpads |    72 |    23 |    22 |     0 |     0 |  23.4 |       82

AIR'S EDGE OVER MATCHED GROUND — vs mounts -63.0  |  vs mounts+manpads -63.0  (clear-rate points, both forces at 30 MP)

AIR — the RUSSIAN GROUND FORCES reference force vs US ARMY posts, with and without AA
      GROUND reference 27 MP, AIR plan 27 MP — already matched, so GROUND =N must repeat GROUND exactly
FORCE       |    T1 |    T2 |    T3 |    T4 |    T5 |  MEAN | MP LOST%
------------+-------+-------+-------+-------+-------+-------+---------
     GROUND |   100 |    90 |    93 |    77 |    55 |  83.0 |       48
 GROUND =27 |   100 |    90 |    93 |    77 |    55 |  83.0 |       48
 AIR mounts |    60 |     0 |    10 |     0 |     0 |  14.0 |       87
AIR +manpads |    60 |     0 |    30 |     0 |     2 |  18.4 |       86

AIR'S EDGE OVER MATCHED GROUND — vs mounts -69.0  |  vs mounts+manpads -64.6  (clear-rate points, both forces at 27 MP)

AIR — the KOREAN PEOPLE'S ARMY reference force vs US ARMY posts, with and without AA
      GROUND reference 26 MP, AIR plan 29 MP, so the edge is read against GROUND =29
FORCE       |    T1 |    T2 |    T3 |    T4 |    T5 |  MEAN | MP LOST%
------------+-------+-------+-------+-------+-------+-------+---------
     GROUND |   100 |   100 |    87 |    53 |    67 |  81.4 |       51
 GROUND =29 |   100 |   100 |    87 |    87 |    75 |  89.8 |       44
 AIR mounts |    65 |     0 |    15 |    17 |     0 |  19.4 |       84
AIR +manpads |    65 |     0 |     7 |    17 |     0 |  17.8 |       85

AIR'S EDGE OVER MATCHED GROUND — vs mounts -70.4  |  vs mounts+manpads -72.0  (clear-rate points, both forces at 29 MP)

AIR — the UN COALITION reference force vs PLA posts, with and without AA
      GROUND reference 26 MP, AIR plan 30 MP, so the edge is read against GROUND =30
FORCE       |    T1 |    T2 |    T3 |    T4 |    T5 |  MEAN | MP LOST%
------------+-------+-------+-------+-------+-------+-------+---------
     GROUND |   100 |    97 |    68 |    60 |    50 |  75.0 |       51
 GROUND =30 |   100 |   100 |    92 |    78 |    78 |  89.6 |       42
 AIR mounts |    35 |     0 |    13 |     0 |    33 |  16.2 |       89
AIR +manpads |    35 |     0 |    13 |     0 |    33 |  16.2 |       90

AIR'S EDGE OVER MATCHED GROUND — vs mounts -73.4  |  vs mounts+manpads -73.4  (clear-rate points, both forces at 30 MP)

WHAT AIR CHARGES — smallest manpower that clears half the time, by plan shape
FACTION     | SHAPE  |    T1 |    T2 |    T3 |    T4 |    T5 |  MEAN
------------+--------+-------+-------+-------+-------+-------+-------
UNITED STAT | GROUND |    14 |    20 |    22 |    28 |    31 |  23.0
            | AIR    |    32 |    76 |    90 |    90 |    76 |  72.8
            | x      |  2.3x |  3.8x |  4.1x |  3.2x |  2.5x |  3.2x
PLA EXPEDIT | GROUND |     9 |    24 |    20 |    28 |    28 |  21.8
            | AIR    |    28 |    38 |    38 |    76 |    64 |  48.8
            | x      |  3.1x |  1.6x |  1.9x |  2.7x |  2.3x |  2.2x
RUSSIAN GRO | GROUND |    11 |    19 |    19 |    24 |    27 |  20.0
            | AIR    |    27 |    38 |    33 |    54 |    54 |  41.2
            | x      |  2.5x |  2.0x |  1.7x |  2.3x |  2.0x |  2.1x
KOREAN PEOP | GROUND |     9 |    16 |    20 |    24 |    28 |  19.4
            | AIR    |    28 |    39 |    39 |    46 |    39 |  38.2
            | x      |  3.1x |  2.4x |  1.9x |  1.9x |  1.4x |  2.0x
UN COALITIO | GROUND |    11 |    23 |    28 |    28 |    28 |  23.6
            | AIR    |    32 |    76 |    64 |     — |     — |     —
            | x      |  2.9x |  3.3x |  2.3x |     — |     — |     —

  A rung a shape never clears at any budget on the grid reads —, and its mean
  is withheld rather than averaged over the rungs it did reach: a force that
  cannot take the top rung has not earned a better mean for stopping early.

  The AIR row is not monotone and that is not the instrument. See below.

THE SAME TARGETS, FLOWN — clear% at a fixed 24 MP, ground shape vs air shape
FACTION     | RUNG | SHAPE        | GROUND | AIR | AIR MINUS GROUND
------------+------+--------------+--------+-----+-----------------
UNITED STAT |   T1 | compound     |    100 |   0 | -##########
            |      | camp         |    100 |   0 | -##########
            |      | corridor     |    100 |   0 | -##########
            |   T2 | compound     |    100 |   0 | -##########
            |      | camp         |    100 |   0 | -##########
            |      | star         |    100 |   0 | -##########
            |   T3 | corridor     |     70 |   0 | -#######
            |      | depot        |     95 |   0 | -##########
            |      | strongpoints |    100 |   0 | -##########
            |   T4 | keep         |     45 |   0 | -#####
            |      | camp         |     50 |   0 | -#####
            |      | compound     |     45 |   0 | -#####
            |   T5 | bunker       |     25 |   0 | -###
            |      | compound     |     20 |   0 | -##
            |      | camp         |      5 |   0 | -#
            |      | MEAN / SPLIT |     70 |   0 | r=+0.00  30+ easier 0, harder 12

PLA EXPEDIT |   T1 | compound     |    100 |   0 | -##########
            |      | camp         |    100 |   0 | -##########
            |      | corridor     |    100 |   0 | -##########
            |   T2 | star         |     80 |   0 | -########
            |      | corridor     |     35 |   0 | -####
            |      | compound     |    100 |   0 | -##########
            |   T3 | compound     |     85 |   0 | -#########
            |      | corridor     |     55 |   0 | -######
            |      | depot        |     95 |   0 | -##########
            |   T4 | keep         |      5 |   0 | -#
            |      | strongpoints |     80 |   0 | -########
            |      | compound     |     25 |   0 | -###
            |   T5 | keep         |      0 |   0 | +
            |      | corridor     |      0 |   0 | +
            |      | bunker       |     20 |   0 | -##
            |      | MEAN / SPLIT |     59 |   0 | r=+0.00  30+ easier 0, harder 10

RUSSIAN GRO |   T1 | compound     |    100 |   0 | -##########
            |      | camp         |    100 |   0 | -##########
            |      | corridor     |    100 |   0 | -##########
            |   T2 | corridor     |     40 |   0 | -####
            |      | compound     |     95 |   0 | -##########
            |      | star         |    100 |   0 | -##########
            |   T3 | corridor     |     45 |   0 | -#####
            |      | strongpoints |     70 |   0 | -#######
            |      | depot        |    100 |   0 | -##########
            |   T4 | keep         |     30 |   0 | -###
            |      | compound     |     45 |   0 | -#####
            |      | camp         |     95 |   0 | -##########
            |   T5 | compound     |      0 |   0 | +
            |      | camp         |     40 |   0 | -####
            |      | bunker       |     40 |   0 | -####
            |      | MEAN / SPLIT |     67 |   0 | r=+0.00  30+ easier 0, harder 14

KOREAN PEOP |   T1 | compound     |    100 |   0 | -##########
            |      | camp         |    100 |   0 | -##########
            |      | corridor     |    100 |   0 | -##########
            |   T2 | compound     |    100 |   0 | -##########
            |      | corridor     |    100 |   0 | -##########
            |      | star         |    100 |   0 | -##########
            |   T3 | star         |     70 |   0 | -#######
            |      | strongpoints |     85 |   0 | -#########
            |      | depot        |     90 |   0 | -#########
            |   T4 | compound     |     90 |   0 | -#########
            |      | keep         |     65 |   0 | -#######
            |      | camp         |     45 |   0 | -#####
            |   T5 | compound     |     55 |   0 | -######
            |      | keep         |     20 |   0 | -##
            |      | bunker       |     50 |   0 | -#####
            |      | MEAN / SPLIT |     78 |   0 | r=+0.00  30+ easier 0, harder 14

UN COALITIO |   T1 | compound     |    100 |   0 | -##########
            |      | camp         |    100 |   0 | -##########
            |      | corridor     |    100 |   0 | -##########
            |   T2 | corridor     |     75 |   0 | -########
            |      | star         |     95 |   0 | -##########
            |      | compound     |    100 |   0 | -##########
            |   T3 | compound     |      5 |   0 | -#
            |      | depot        |     15 |   0 | -##
            |      | strongpoints |     80 |   0 | -########
            |   T4 | compound     |     10 |   0 | -#
            |      | keep         |      0 |   0 | +
            |      | corridor     |     30 |   0 | -###
            |   T5 | compound     |     10 |   0 | -#
            |      | bunker       |     30 |   0 | -###
            |      | camp         |      5 |   0 | -#
            |      | MEAN / SPLIT |     50 |   0 | r=+0.00  30+ easier 0, harder 9

  r is over the fifteen targets the faction is actually dealt, and it reads
  higher than it should: every T1 cell is 100/100 for both shapes, which is no
  information and still pulls the coefficient toward +1. Read the COUNTS, which
  cannot be inflated that way — they say how many of the fifteen targets are a
  materially different problem depending on whether you walked or flew.

  The MEANS are the other half of it: air is not WEAKER at a fixed budget, it is
  UNPREDICTABLE. A player is told the shape for free (GDD §5) and told nothing
  about what it means to an aircraft, so the choice to fly is a lottery over a
  ladder that was selected — correctly, by `--layouts` — against ground.

DOES THE AIR READ PREDICT? — every dealt target, air plan at 24 MP
FACTION     | RUNG | SHAPE        | OVERHEAD | TRANSIT | AIR CLEAR%
------------+------+--------------+----------+---------+-----------
UNITED STAT |   T1 | compound     |        0 |       0 |          0
            |      | camp         |        0 |       0 |          0
            |      | corridor     |        0 |       0 |          0
            |   T2 | compound     |        0 |      85 |          0
            |      | camp         |       48 |     206 |          0
            |      | star         |       48 |     253 |          0
            |   T3 | corridor     |        0 |     186 |          0
            |      | depot        |        0 |       0 |          0
            |      | strongpoints |        0 |      43 |          0
            |   T4 | keep         |       48 |      11 |          0
            |      | camp         |       48 |     160 |          0
            |      | compound     |        0 |       0 |          0
            |   T5 | bunker       |       48 |     167 |          0
            |      | compound     |        0 |      80 |          0
            |      | camp         |       48 |     223 |          0

PLA EXPEDIT |   T1 | compound     |        0 |       0 |          0
            |      | camp         |        0 |       0 |          0
            |      | corridor     |        0 |       0 |          0
            |   T2 | star         |       47 |      60 |          0
            |      | corridor     |        0 |       0 |          0
            |      | compound     |        0 |      71 |          0
            |   T3 | compound     |        0 |      71 |          0
            |      | corridor     |        0 |       0 |          0
            |      | depot        |        0 |      47 |          0
            |   T4 | keep         |       47 |      21 |          0
            |      | strongpoints |       47 |     112 |          0
            |      | compound     |        0 |      32 |          0
            |   T5 | keep         |        0 |       0 |          0
            |      | corridor     |       47 |     159 |          0
            |      | bunker       |       47 |     103 |          0

RUSSIAN GRO |   T1 | compound     |        0 |       0 |          0
            |      | camp         |        0 |       0 |          0
            |      | corridor     |        0 |       0 |          0
            |   T2 | corridor     |        0 |       0 |          0
            |      | compound     |        0 |      21 |          0
            |      | star         |       47 |     157 |          0
            |   T3 | corridor     |       47 |     127 |          0
            |      | strongpoints |       47 |     111 |          0
            |      | depot        |        0 |      36 |          0
            |   T4 | keep         |        0 |      61 |          0
            |      | compound     |       47 |      90 |          0
            |      | camp         |       47 |     150 |          0
            |   T5 | compound     |       47 |      74 |          0
            |      | camp         |       47 |     144 |          0
            |      | bunker       |       47 |     116 |          0

KOREAN PEOP |   T1 | compound     |        0 |       0 |          0
            |      | camp         |        0 |       0 |          0
            |      | corridor     |        0 |       0 |          0
            |   T2 | compound     |        0 |      56 |          0
            |      | corridor     |       47 |      84 |          0
            |      | star         |       47 |     155 |          0
            |   T3 | star         |       47 |      50 |          0
            |      | strongpoints |        0 |      40 |          0
            |      | depot        |        0 |      39 |          0
            |   T4 | compound     |       47 |      93 |          0
            |      | keep         |        0 |       0 |          0
            |      | camp         |       47 |     134 |          0
            |   T5 | compound     |       47 |      10 |          0
            |      | keep         |        0 |       0 |          0
            |      | bunker       |       47 |      89 |          0

UN COALITIO |   T1 | compound     |        0 |       0 |          0
            |      | camp         |        0 |       0 |          0
            |      | corridor     |        0 |       0 |          0
            |   T2 | corridor     |       48 |     104 |          0
            |      | star         |       48 |      42 |          0
            |      | compound     |        0 |      67 |          0
            |   T3 | compound     |        0 |      58 |          0
            |      | depot        |        0 |       5 |          0
            |      | strongpoints |        0 |       0 |          0
            |   T4 | compound     |       48 |      38 |          0
            |      | keep         |        0 |       0 |          0
            |      | corridor     |       48 |      94 |          0
            |   T5 | compound     |       48 |     101 |          0
            |      | bunker       |       48 |     131 |          0
            |      | camp         |       48 |     162 |          0

PREDICTOR                                   |     r |    r^2
--------------------------------------------+-------+-------
OVERHEAD flak DPS over the post             | +0.00 |   0.00
TRANSIT DPS-seconds on the way in           | +0.00 |   0.00
OVERHEAD + TRANSIT                          | +0.00 |   0.00
SHAPE alone (the incumbent, flattered)      | +0.00 |   0.00

  The bar is the last row. A player is told the shape for free, so a read that
  cannot beat predicting from the shape alone has bought nothing — and the shape
  baseline is scored on the very rows it was fitted to, which flatters it.

PER FACTION — a predictor carried by one roster is not a predictor
FACTION     | TRANSIT r | SHAPE r
------------+-----------+--------
UNITED STAT |     +0.00 |   +0.00
PLA EXPEDIT |     +0.00 |   +0.00
RUSSIAN GRO |     +0.00 |   +0.00
KOREAN PEOP |     +0.00 |   +0.00
UN COALITIO |     +0.00 |   +0.00

BANDS — cut at the terciles of transit, then measured
BAND  | TRANSIT       | TARGETS | MEAN AIR CLEAR%
------+---------------+---------+----------------
GOOD  | under 5       |      25 |             0.0
FAIR  | 5 to 89       |      25 |             0.0
POOR  | over 89       |      25 |             0.0

  The bands are the shippable form: a player cannot read DPS-seconds, and three
  words is the whole budget the target list has. The cuts are terciles of the
  measured population rather than round numbers, so they cannot be tuned to
  flatter the result.

VETERANCY — UNITED STATES strike force (25 MP), men returned% by tier
RANK    |  ×   |   T1 |   T2 |   T3 |   T4 |   T5 |  MEAN | CLEAR%
--------+------+------+------+------+------+------+-------+-------
GREEN   | 1.00 |   88 |   71 |   47 |   25 |   20 |  50.2 |     81
LINE    | 1.04 |   88 |   70 |   48 |   27 |   29 |  52.4 |     84
VETERAN | 1.09 |   88 |   81 |   49 |   31 |   33 |  56.4 |     87
CADRE   | 1.15 |   89 |   86 |   55 |   36 |   43 |  61.8 |     93

VETERANCY — PLA EXPEDITIONARY FORCE strike force (26 MP), men returned% by tier
RANK    |  ×   |   T1 |   T2 |   T3 |   T4 |   T5 |  MEAN | CLEAR%
--------+------+------+------+------+------+------+-------+-------
GREEN   | 1.00 |   74 |   48 |   40 |   28 |   10 |  40.0 |     81
LINE    | 1.04 |   73 |   50 |   44 |   35 |   13 |  43.0 |     86
VETERAN | 1.09 |   75 |   53 |   49 |   38 |   21 |  47.2 |     93
CADRE   | 1.15 |   73 |   54 |   55 |   42 |   26 |  50.0 |     96

VETERANCY — RUSSIAN GROUND FORCES strike force (27 MP), men returned% by tier
RANK    |  ×   |   T1 |   T2 |   T3 |   T4 |   T5 |  MEAN | CLEAR%
--------+------+------+------+------+------+------+-------+-------
GREEN   | 1.00 |   76 |   55 |   50 |   38 |   18 |  47.4 |     83
LINE    | 1.04 |   78 |   61 |   55 |   41 |   37 |  54.4 |     94
VETERAN | 1.09 |   79 |   64 |   57 |   49 |   44 |  58.6 |     98
CADRE   | 1.15 |   82 |   68 |   65 |   54 |   53 |  64.4 |     99

VETERANCY — KOREAN PEOPLE'S ARMY strike force (26 MP), men returned% by tier
RANK    |  ×   |   T1 |   T2 |   T3 |   T4 |   T5 |  MEAN | CLEAR%
--------+------+------+------+------+------+------+-------+-------
GREEN   | 1.00 |   76 |   66 |   47 |   17 |   26 |  46.4 |     81
LINE    | 1.04 |   78 |   66 |   49 |   23 |   34 |  50.0 |     86
VETERAN | 1.09 |   83 |   69 |   55 |   32 |   42 |  56.2 |     92
CADRE   | 1.15 |   85 |   73 |   65 |   39 |   48 |  62.0 |     95

VETERANCY — UN COALITION strike force (26 MP), men returned% by tier
RANK    |  ×   |   T1 |   T2 |   T3 |   T4 |   T5 |  MEAN | CLEAR%
--------+------+------+------+------+------+------+-------+-------
GREEN   | 1.00 |   86 |   62 |   36 |   28 |   23 |  47.0 |     75
LINE    | 1.04 |   87 |   69 |   48 |   37 |   35 |  55.2 |     84
VETERAN | 1.09 |   87 |   74 |   57 |   49 |   43 |  62.0 |     92
CADRE   | 1.15 |   87 |   77 |   58 |   61 |   50 |  66.6 |     96

DEFENSE — UNITED STATES permanent layer vs PLA assault ladder (hold%)
STAGE       |   L1 |   L2 |   L3 |   L4 |   L5 |   L6 |   L7 |   L8 |   L9 |  L10 |  L11 |  L12
------------+------+------+------+------+------+------+------+------+------+------+------+------
EARLY (CC1) |  100 |  100 |   20 |    0 |    0 |    0 |    0 |    0 |    0 |    0 |    0 |    0
MID (CC2)   |  100 |  100 |  100 |  100 |  100 |  100 |  100 |   65 |   35 |    0 |    0 |    0
LATE (CC3)  |  100 |  100 |  100 |  100 |  100 |  100 |  100 |  100 |  100 |  100 |   90 |   65

DEFENSE — UNITED STATES permanent layer vs PLA assault ladder (hold%) — HOLDFAST standing orders
STAGE       |   L1 |   L2 |   L3 |   L4 |   L5 |   L6 |   L7 |   L8 |   L9 |  L10 |  L11 |  L12
------------+------+------+------+------+------+------+------+------+------+------+------+------
EARLY (CC1) |  100 |  100 |   25 |    0 |    0 |    0 |    0 |    0 |    0 |    0 |    0 |    0
MID (CC2)   |  100 |  100 |  100 |  100 |  100 |  100 |  100 |   95 |   90 |   15 |    0 |    0
LATE (CC3)  |  100 |  100 |  100 |  100 |  100 |  100 |  100 |  100 |  100 |  100 |  100 |   90

DEFENSE — UNITED STATES permanent layer vs PLA assault ladder (hold%) — WITH AA COVER
STAGE       |   L1 |   L2 |   L3 |   L4 |   L5 |   L6 |   L7 |   L8 |   L9 |  L10 |  L11 |  L12
------------+------+------+------+------+------+------+------+------+------+------+------+------
EARLY (CC1) |  100 |  100 |  100 |  100 |  100 |  100 |    0 |    0 |    0 |    0 |    0 |    0
MID (CC2)   |  100 |  100 |  100 |  100 |  100 |  100 |  100 |  100 |   95 |   55 |    5 |    0
LATE (CC3)  |  100 |  100 |  100 |  100 |  100 |  100 |  100 |  100 |  100 |  100 |  100 |   95

DEFENSE — UNITED STATES permanent layer vs PLA assault ladder (hold%) — FORTIFY doctrine
STAGE       |   L1 |   L2 |   L3 |   L4 |   L5 |   L6 |   L7 |   L8 |   L9 |  L10 |  L11 |  L12
------------+------+------+------+------+------+------+------+------+------+------+------+------
EARLY (CC1) |  100 |  100 |   85 |    0 |    0 |    0 |    0 |    0 |    0 |    0 |    0 |    0
MID (CC2)   |  100 |  100 |  100 |  100 |  100 |  100 |  100 |   95 |   65 |    5 |    0 |    0
LATE (CC3)  |  100 |  100 |  100 |  100 |  100 |  100 |  100 |  100 |  100 |  100 |  100 |   85

DEFENSE — PLA EXPEDITIONARY FORCE permanent layer vs US ARMY assault ladder (hold%)
STAGE       |   L1 |   L2 |   L3 |   L4 |   L5 |   L6 |   L7 |   L8 |   L9 |  L10 |  L11 |  L12
------------+------+------+------+------+------+------+------+------+------+------+------+------
EARLY (CC1) |  100 |  100 |   80 |    0 |    0 |    0 |    0 |    0 |    0 |    0 |    0 |    0
MID (CC2)   |  100 |  100 |  100 |  100 |  100 |  100 |   40 |   20 |    0 |    0 |    0 |    0
LATE (CC3)  |  100 |  100 |  100 |  100 |  100 |  100 |  100 |  100 |  100 |  100 |   55 |    5

DEFENSE — PLA EXPEDITIONARY FORCE permanent layer vs US ARMY assault ladder (hold%) — HOLDFAST standing orders
STAGE       |   L1 |   L2 |   L3 |   L4 |   L5 |   L6 |   L7 |   L8 |   L9 |  L10 |  L11 |  L12
------------+------+------+------+------+------+------+------+------+------+------+------+------
EARLY (CC1) |  100 |  100 |   80 |    0 |    0 |    0 |    0 |    0 |    0 |    0 |    0 |    0
MID (CC2)   |  100 |  100 |  100 |  100 |  100 |  100 |   70 |   45 |    5 |    0 |    0 |    0
LATE (CC3)  |  100 |  100 |  100 |  100 |  100 |  100 |  100 |  100 |  100 |  100 |   90 |   75

DEFENSE — PLA EXPEDITIONARY FORCE permanent layer vs US ARMY assault ladder (hold%) — WITH AA COVER
STAGE       |   L1 |   L2 |   L3 |   L4 |   L5 |   L6 |   L7 |   L8 |   L9 |  L10 |  L11 |  L12
------------+------+------+------+------+------+------+------+------+------+------+------+------
EARLY (CC1) |  100 |  100 |  100 |  100 |  100 |  100 |    0 |    0 |    0 |    0 |    0 |    0
MID (CC2)   |  100 |  100 |  100 |  100 |  100 |  100 |  100 |  100 |   35 |    0 |    0 |    0
LATE (CC3)  |  100 |  100 |  100 |  100 |  100 |  100 |  100 |  100 |  100 |  100 |  100 |   90

DEFENSE — PLA EXPEDITIONARY FORCE permanent layer vs US ARMY assault ladder (hold%) — FORTIFY doctrine
STAGE       |   L1 |   L2 |   L3 |   L4 |   L5 |   L6 |   L7 |   L8 |   L9 |  L10 |  L11 |  L12
------------+------+------+------+------+------+------+------+------+------+------+------+------
EARLY (CC1) |  100 |  100 |  100 |    0 |    0 |    0 |    0 |    0 |    0 |    0 |    0 |    0
MID (CC2)   |  100 |  100 |  100 |  100 |  100 |  100 |   75 |   55 |   15 |    0 |    0 |    0
LATE (CC3)  |  100 |  100 |  100 |  100 |  100 |  100 |  100 |  100 |  100 |  100 |   95 |   35

DEFENSE — RUSSIAN GROUND FORCES permanent layer vs US ARMY assault ladder (hold%)
STAGE       |   L1 |   L2 |   L3 |   L4 |   L5 |   L6 |   L7 |   L8 |   L9 |  L10 |  L11 |  L12
------------+------+------+------+------+------+------+------+------+------+------+------+------
EARLY (CC1) |  100 |  100 |   80 |    0 |    0 |    0 |    0 |    0 |    0 |    0 |    0 |    0
MID (CC2)   |  100 |  100 |  100 |  100 |  100 |  100 |   85 |   90 |   25 |    0 |    0 |    0
LATE (CC3)  |  100 |  100 |  100 |  100 |  100 |  100 |  100 |  100 |  100 |  100 |  100 |  100

DEFENSE — RUSSIAN GROUND FORCES permanent layer vs US ARMY assault ladder (hold%) — HOLDFAST standing orders
STAGE       |   L1 |   L2 |   L3 |   L4 |   L5 |   L6 |   L7 |   L8 |   L9 |  L10 |  L11 |  L12
------------+------+------+------+------+------+------+------+------+------+------+------+------
EARLY (CC1) |  100 |  100 |   80 |    0 |    0 |    0 |    0 |    0 |    0 |    0 |    0 |    0
MID (CC2)   |  100 |  100 |  100 |  100 |  100 |  100 |  100 |   95 |   75 |   10 |    0 |    0
LATE (CC3)  |  100 |  100 |  100 |  100 |  100 |  100 |  100 |  100 |  100 |  100 |  100 |  100

DEFENSE — RUSSIAN GROUND FORCES permanent layer vs US ARMY assault ladder (hold%) — WITH AA COVER
STAGE       |   L1 |   L2 |   L3 |   L4 |   L5 |   L6 |   L7 |   L8 |   L9 |  L10 |  L11 |  L12
------------+------+------+------+------+------+------+------+------+------+------+------+------
EARLY (CC1) |  100 |  100 |  100 |    0 |    0 |    0 |    0 |    0 |    0 |    0 |    0 |    0
MID (CC2)   |  100 |  100 |  100 |  100 |  100 |  100 |  100 |  100 |   90 |   20 |    0 |    0
LATE (CC3)  |  100 |  100 |  100 |  100 |  100 |  100 |  100 |  100 |  100 |  100 |  100 |  100

DEFENSE — RUSSIAN GROUND FORCES permanent layer vs US ARMY assault ladder (hold%) — FORTIFY doctrine
STAGE       |   L1 |   L2 |   L3 |   L4 |   L5 |   L6 |   L7 |   L8 |   L9 |  L10 |  L11 |  L12
------------+------+------+------+------+------+------+------+------+------+------+------+------
EARLY (CC1) |  100 |  100 |  100 |    0 |    0 |    0 |    0 |    0 |    0 |    0 |    0 |    0
MID (CC2)   |  100 |  100 |  100 |  100 |  100 |  100 |  100 |  100 |   85 |   10 |    0 |    0
LATE (CC3)  |  100 |  100 |  100 |  100 |  100 |  100 |  100 |  100 |  100 |  100 |  100 |  100

DEFENSE — KOREAN PEOPLE'S ARMY permanent layer vs US ARMY assault ladder (hold%)
STAGE       |   L1 |   L2 |   L3 |   L4 |   L5 |   L6 |   L7 |   L8 |   L9 |  L10 |  L11 |  L12
------------+------+------+------+------+------+------+------+------+------+------+------+------
EARLY (CC1) |  100 |  100 |   30 |    0 |    0 |    0 |    0 |    0 |    0 |    0 |    0 |    0
MID (CC2)   |  100 |  100 |  100 |  100 |  100 |  100 |    5 |    0 |    0 |    0 |    0 |    0
LATE (CC3)  |  100 |  100 |  100 |  100 |  100 |  100 |  100 |  100 |  100 |   55 |   40 |    0

DEFENSE — KOREAN PEOPLE'S ARMY permanent layer vs US ARMY assault ladder (hold%) — HOLDFAST standing orders
STAGE       |   L1 |   L2 |   L3 |   L4 |   L5 |   L6 |   L7 |   L8 |   L9 |  L10 |  L11 |  L12
------------+------+------+------+------+------+------+------+------+------+------+------+------
EARLY (CC1) |  100 |  100 |   25 |    0 |    0 |    0 |    0 |    0 |    0 |    0 |    0 |    0
MID (CC2)   |  100 |  100 |  100 |  100 |  100 |  100 |   25 |    0 |    0 |    0 |    0 |    0
LATE (CC3)  |  100 |  100 |  100 |  100 |  100 |  100 |  100 |  100 |  100 |   95 |   50 |   40

DEFENSE — KOREAN PEOPLE'S ARMY permanent layer vs US ARMY assault ladder (hold%) — WITH AA COVER
STAGE       |   L1 |   L2 |   L3 |   L4 |   L5 |   L6 |   L7 |   L8 |   L9 |  L10 |  L11 |  L12
------------+------+------+------+------+------+------+------+------+------+------+------+------
EARLY (CC1) |  100 |  100 |  100 |    0 |    0 |    0 |    0 |    0 |    0 |    0 |    0 |    0
MID (CC2)   |  100 |  100 |  100 |  100 |  100 |  100 |   15 |   20 |    0 |    0 |    0 |    0
LATE (CC3)  |  100 |  100 |  100 |  100 |  100 |  100 |  100 |  100 |  100 |  100 |   55 |   25

DEFENSE — KOREAN PEOPLE'S ARMY permanent layer vs US ARMY assault ladder (hold%) — COUNTERBATTERY standing orders
STAGE       |   L1 |   L2 |   L3 |   L4 |   L5 |   L6 |   L7 |   L8 |   L9 |  L10 |  L11 |  L12
------------+------+------+------+------+------+------+------+------+------+------+------+------
EARLY (CC1) |  100 |  100 |   35 |    0 |    0 |    0 |    0 |    0 |    0 |    0 |    0 |    0
MID (CC2)   |  100 |  100 |  100 |  100 |  100 |  100 |   20 |   15 |    0 |    0 |    0 |    0
LATE (CC3)  |  100 |  100 |  100 |  100 |  100 |  100 |  100 |  100 |  100 |   90 |   35 |   15

DEFENSE — KOREAN PEOPLE'S ARMY permanent layer vs US ARMY assault ladder (hold%) — TRIPWIRE standing orders
STAGE       |   L1 |   L2 |   L3 |   L4 |   L5 |   L6 |   L7 |   L8 |   L9 |  L10 |  L11 |  L12
------------+------+------+------+------+------+------+------+------+------+------+------+------
EARLY (CC1) |  100 |  100 |   30 |    0 |    0 |    0 |    0 |    0 |    0 |    0 |    0 |    0
MID (CC2)   |  100 |  100 |  100 |  100 |  100 |  100 |   20 |   30 |    0 |    0 |    0 |    0
LATE (CC3)  |  100 |  100 |  100 |  100 |  100 |  100 |  100 |  100 |  100 |  100 |   50 |   45

DEFENSE — KOREAN PEOPLE'S ARMY permanent layer vs US ARMY assault ladder (hold%) — FORTIFY doctrine
STAGE       |   L1 |   L2 |   L3 |   L4 |   L5 |   L6 |   L7 |   L8 |   L9 |  L10 |  L11 |  L12
------------+------+------+------+------+------+------+------+------+------+------+------+------
EARLY (CC1) |  100 |  100 |   50 |    0 |    0 |    0 |    0 |    0 |    0 |    0 |    0 |    0
MID (CC2)   |  100 |  100 |  100 |  100 |  100 |   95 |   20 |   10 |    0 |    0 |    0 |    0
LATE (CC3)  |  100 |  100 |  100 |  100 |  100 |  100 |  100 |  100 |  100 |   95 |   80 |   20

DEFENSE — UN COALITION permanent layer vs PLA assault ladder (hold%)
STAGE       |   L1 |   L2 |   L3 |   L4 |   L5 |   L6 |   L7 |   L8 |   L9 |  L10 |  L11 |  L12
------------+------+------+------+------+------+------+------+------+------+------+------+------
EARLY (CC1) |  100 |  100 |   50 |    0 |    0 |    0 |    0 |    0 |    0 |    0 |    0 |    0
MID (CC2)   |  100 |  100 |  100 |  100 |  100 |  100 |   65 |   50 |    0 |    0 |    0 |    0
LATE (CC3)  |  100 |  100 |  100 |  100 |  100 |  100 |  100 |  100 |  100 |  100 |   85 |   10

DEFENSE — UN COALITION permanent layer vs PLA assault ladder (hold%) — HOLDFAST standing orders
STAGE       |   L1 |   L2 |   L3 |   L4 |   L5 |   L6 |   L7 |   L8 |   L9 |  L10 |  L11 |  L12
------------+------+------+------+------+------+------+------+------+------+------+------+------
EARLY (CC1) |  100 |  100 |   50 |    0 |    0 |    0 |    0 |    0 |    0 |    0 |    0 |    0
MID (CC2)   |  100 |  100 |  100 |  100 |  100 |  100 |   70 |   80 |   20 |    0 |    0 |    0
LATE (CC3)  |  100 |  100 |  100 |  100 |  100 |  100 |  100 |  100 |  100 |  100 |  100 |   50

DEFENSE — UN COALITION permanent layer vs PLA assault ladder (hold%) — WITH AA COVER
STAGE       |   L1 |   L2 |   L3 |   L4 |   L5 |   L6 |   L7 |   L8 |   L9 |  L10 |  L11 |  L12
------------+------+------+------+------+------+------+------+------+------+------+------+------
EARLY (CC1) |  100 |  100 |  100 |  100 |  100 |  100 |    0 |    0 |    0 |    0 |    0 |    0
MID (CC2)   |  100 |  100 |  100 |  100 |  100 |  100 |   95 |  100 |   70 |    0 |    0 |    0
LATE (CC3)  |  100 |  100 |  100 |  100 |  100 |  100 |  100 |  100 |  100 |  100 |  100 |   95

DEFENSE — UN COALITION permanent layer vs PLA assault ladder (hold%) — Engineer Corps HQ on the line
STAGE       |   L1 |   L2 |   L3 |   L4 |   L5 |   L6 |   L7 |   L8 |   L9 |  L10 |  L11 |  L12
------------+------+------+------+------+------+------+------+------+------+------+------+------
EARLY (CC1) |  100 |  100 |   50 |    0 |    0 |    0 |    0 |    0 |    0 |    0 |    0 |    0
MID (CC2)   |  100 |  100 |  100 |  100 |  100 |  100 |   95 |   95 |   15 |    0 |    0 |    0
LATE (CC3)  |  100 |  100 |  100 |  100 |  100 |  100 |  100 |  100 |  100 |  100 |  100 |   45

DEFENSE — UN COALITION permanent layer vs PLA assault ladder (hold%) — FORTIFY doctrine
STAGE       |   L1 |   L2 |   L3 |   L4 |   L5 |   L6 |   L7 |   L8 |   L9 |  L10 |  L11 |  L12
------------+------+------+------+------+------+------+------+------+------+------+------+------
EARLY (CC1) |  100 |  100 |   90 |    0 |    0 |    0 |    0 |    0 |    0 |    0 |    0 |    0
MID (CC2)   |  100 |  100 |  100 |  100 |  100 |  100 |   95 |   70 |   10 |    0 |    0 |    0
LATE (CC3)  |  100 |  100 |  100 |  100 |  100 |  100 |  100 |  100 |  100 |  100 |   95 |   30

MISSIONS — every campaign on 10x15 (chain v6), standard, 40 seeds, permanent layer alone, against v1.44 on 20x30 (chain v3, frozen)
hold% v1.44 -> now per reference base · * the base the campaign allows by then · ! moved 24+ points (3x the noise floor of 8.0, never under 20)

USA
MISSION                    | EARLY (CC1)  | MID (CC2)    | LATE (CC3)  
M1 DIG IN                  | *100 -> 100   |  100 -> 100   |  100 -> 100  
M2 FIRST BLOOD             | *100 -> 100   |  100 -> 100   |  100 -> 100  
M3 THE BREACH              | *100 -> 100   |  100 -> 100   |  100 -> 100  
M4 CONVOY                  | *100 -> 100   |  100 -> 100   |  100 -> 100  
M5 SUPPRESSION             |    0 ->   0   | *100 -> 100   |  100 -> 100  
M6 INFILTRATION            |  100 -> 100   | *100 -> 100   |  100 -> 100  
M7 ARMOR PROBE             |    0 ->   0   | * 95 ->  95   |  100 -> 100  
M8 THE LONG NIGHT          |    0 ->   0   |    3 ->   0   | *100 -> 100  
M9 LANDFALL                |    0 ->   0   |   88 ->   0 ! | *100 ->  90  

CHINA
MISSION                    | EARLY (CC1)  | MID (CC2)    | LATE (CC3)  
M1 BEACHHEAD               | *100 -> 100   |  100 -> 100   |  100 -> 100  
M2 COUNTERATTACK           | *100 -> 100   |  100 -> 100   |  100 -> 100  
M3 DEMOLITION TEAMS        | *100 -> 100   |  100 -> 100   |  100 -> 100  
M4 JAVELIN RAIN            |    3 ->   0   | *100 -> 100   |  100 -> 100  
M5 ARMOR SPEARHEAD         |    0 ->   0   | * 55 ->  70   |  100 -> 100  
M6 THE TIDE BREAKS         |    0 ->   0   | * 15 ->  10   |  100 -> 100  

RUSSIA
MISSION                    | EARLY (CC1)  | MID (CC2)    | LATE (CC3)  
M1 THE RAILHEAD            | *100 -> 100   |  100 -> 100   |  100 -> 100  
M2 WHITEOUT                | *100 -> 100   |  100 -> 100   |  100 -> 100  
M3 SAPPERS ON THE ICE      | *100 -> 100   |  100 -> 100   |  100 -> 100  
M4 RIDGELINE MISSILES      |   10 ->   0   | *100 -> 100   |  100 -> 100  
M5 STEEL ON STEEL          |    0 ->   0   | * 95 ->  98   |  100 -> 100  
M6 THE CORRIDOR HOLDS      |    0 ->   0   | * 68 ->  65   |  100 -> 100  

NK
MISSION                    | EARLY (CC1)  | MID (CC2)    | LATE (CC3)  
M1 THE ENCLAVE             | *100 -> 100   |  100 -> 100   |  100 -> 100  
M2 NO MOON                 | *100 -> 100   |  100 -> 100   |  100 -> 100  
M3 BREACHING CHARGES       | *100 -> 100   |  100 -> 100   |  100 -> 100  
M4 FIRE ON THE BLUFFS      |    0 ->   0   | *100 -> 100   |  100 -> 100  
M5 UP THE 101              |    0 ->   0   | * 75 ->  55   |  100 -> 100  
M6 DAYLIGHT                |    0 ->   0   | * 35 ->  30   |  100 -> 100  

UN
MISSION                    | EARLY (CC1)  | MID (CC2)    | LATE (CC3)  
M1 THE CORRIDOR            | *100 -> 100   |  100 -> 100   |  100 -> 100  
M2 RULES OF ENGAGEMENT     | *100 -> 100   |  100 -> 100   |  100 -> 100  
M3 SAPPERS AT THE WIRE     | *100 -> 100   |  100 -> 100   |  100 -> 100  
M4 GRENADIER LINE          |   50 ->  35   | *100 -> 100   |  100 -> 100  
M5 ARMOR ON THE FIVE       |    0 ->   0   | * 90 ->  98   |  100 -> 100  
M6 THE MANDATE HOLDS       |    0 ->   0   | * 13 ->  33   |  100 -> 100  

THE MISSION AS TUNED (the * cells): mean shift +0.1 points over 33, mean |shift| 2.7; 0 harder by 24+, 0 easier
  USA    mean shift   -1.1   held  99% of the time in v1.44,  98% now
  CHINA  mean shift   +1.7   held  78% of the time in v1.44,  80% now
  RUSSIA mean shift   +0.0   held  94% of the time in v1.44,  94% now
  NK     mean shift   -4.2   held  85% of the time in v1.44,  81% now
  UN     mean shift   +4.7   held  84% of the time in v1.44,  89% now
```

## Reading the tables (v0.8 pass)

> These bullets are a LOG, not a caption. Each records what was learned when it was
> learned, and the tables above are re-measured on every `--md` run — so where a bullet
> cites a figure, read it as the number that produced the conclusion, and the table as
> the number today. A conclusion that stops holding gets rewritten here; a figure that
> merely moved does not.

- **The raid rows use a FIXED mid-game force**, so the ladder is supposed to outgrow it.
  USA (quality) stays potent deep into the ladder but pays 70%+ of the force at tier 4–5;
  China (mass) grinds tiers 2–3 with cheap replacements, then needs the late-game army:
  a 33-manpower PLA force with doubled armor clears tier 4–5 at ~70% (verified headlessly).
  Steeper curve + cheaper bodies is the intended faction texture, not a wall.
- **North Korea (tunnels) rewrites the entry problem, not the force problem**: the TUNNELED
  row re-sites squads through galleries inside the wire (the harness probes hunt+raze /
  raze-only / everything per base, like a player adapting to the scout). Tunnels turn
  tier 2 from a coin flip into a walkover and roughly quadruple tier-4 clears, but a
  27-MP force that is outmassed stays outmassed — the late answer stacks galleries with
  the KN-09 plan. Each gallery costs 40 Fuel, the faction tax.
- **NK defense floor sits one ladder step below China by design** (MID holds L3 at ~80%,
  L4 at ~20%): rock barricades and sentry nests are the cheapest line in the war and die
  like it. The compensators are price (rebuild fast, repair at 25%), the Koksan pit
  outranging every gun in the game, and the CP battle layer (ambush teams at 20, mines
  at 12) — the reference measures none of those.
- **UN (sustainment) is measured against its own control**: the CONTROL row runs the
  same 27 MP with the medics swapped for riflemen. Medics clear the bar where the fight
  is winnable — tier-1 losses drop ~18 points and tier-3 clears gain ~13 — and go quiet
  where the force is simply outgunned (tier 4+): healing at 22/s loses to two guns
  focused, by design. On defense the Engineer Corps HQ row shows the aura the reference
  can see; the Engineer Revetment (CP layer, 15 hp/s over 3 units) is the live-play
  tool the reference cannot. Every UN gun is deliberately mid-pack; the faction wins
  by still being there in wave three.
- **Russia (artillery) progresses through fire preparation**: their bare late-game force
  stalls past tier 3 (43/12/0 at t3–5), but a max-cap army behind a TOS-1A fire plan on
  the guns holds 53/52/42 — shell the batteries first, then walk the armor in. Their
  ordnance habit is the faction tax: fuel per charge, every raid.
- **The doctrine rows are the v0.4 ceiling**: full Strike research plus a stocked fire plan
  (an A-10/MLRS pass on the guns at T+15, 155s/PLZ-05 on the post at T+40). It lifts the
  USA tail to ~92–98% and trims losses ~6 points; for China it converts into destruction
  and loot more than into clears — their tier 4+ answer remains the max-cap army.
- **FORTIFY is strictly non-negative everywhere** (verified after the reference-base fix
  below). China's defense floor runs softer than the USA's at MID — their besiegers are
  Rangers, Javelins, and Abrams, not militia — which makes the FORTIFY branch their
  must-have doctrine (L4 hold: 50% → 85%).
- **Coverage lesson baked into the MID reference**: a lone tank that survives to the wall
  line will stand at standoff range and shell the CC; every breach approach must be inside
  some AT post's arc or that tank ends the siege. The reference base was fixed to overlap
  its arcs, which is also the in-game lesson for players.
- **Standing orders (v0.8) are the offline defense doctrines**: the HOLDFAST rows show
  the probe floor when the garrison spends kill-earned CP by policy (a 1-second command
  cadence and a hard per-battle action budget are the handicap; breach-reactive field
  guns are the payoff). HOLDFAST lifts chokepointed MID layouts two to three ladder
  levels and still collapses when outmassed (NK MID L6 stays 0%); COUNTERBATTERY burns
  the real ordnance stock and TRIPWIRE is the budget option — the NK section compares
  all three. Orders cost supplies upkeep per action and every probe replay re-issues
  them from the config.
- **Base archetypes (v1.6) are eight different questions**, and the ARCHETYPES table
  is what keeps them that way: the shapes have to SPREAD, and none of them may be a
  wall at a tier where it is actually offered. The band runs OPEN CAMP 99% (the
  breather) through COMPOUND 94% (the baseline) to BUNKER COMPLEX 71% (33% at the
  tier it first appears). Prepared rows sit under the three hardest so a shape that
  stops the reference force can be shown to open for a force that planned for it.
- **The bunker complex overturned the obvious design.** "Few walls, many guns" was
  built as more guns and a level deeper, and measured 0% clears at tiers 4 AND 5 —
  with the doctrine ceiling behind the force. The cause is structural: with no wall
  line there is no breach to wait for, so every gun engages from the first second.
  An open base is harder at the SAME gun count, which means the multiplier has to
  come down. It ships at 0.65× guns, one level deeper: fewest positions on the
  board, best dug, and the hardest thing on it that can still be taken.
- **Field conditions (v1.3) are trades, not buffs**, and the FIELD CONDITIONS table is
  what enforces that: the pay must rise with the measured difficulty. The rotation lands
  on ±9 points of clear rate around CLEAR LINE — HARD RAIN is the walkover that pays 0.85×,
  DUG IN / FUEL CRISIS / ATTRITION cost 8–10 points and pay 1.3–1.45×. Two readings matter:
  defender weaponDamage is by far the strongest lever (wall HP alone barely moves a fixed
  force, because softer walls just deliver it to the guns sooner), and BLACKOUT reads as
  exactly neutral here BY CONSTRUCTION — it carries no sim modifiers at all. Its cost is
  that no target can be scouted at any price, so the plan is made against fog and NK loses
  tunnels entirely; a headless matrix that always fights with the layout in hand cannot
  price that, which is why its 1.25× is a judgement and is labelled as one.
- **Veterancy (v1.9) pays in survivors, not in wins**, and the VETERANCY tables are
  the proof: from GREEN to CADRE the mean share of the force that walks home rises for
  every faction (USA 28→34, China 12→16, Russia 18→20, NK 12→20, UN 20→27), while the
  clear rate barely moves for three of the five. That is the intended shape — a rank is
  worth a few men, never a win — and it is self-reinforcing by design, because the men
  who come home are the experience. A +15% top-end multiplier is deliberately too small
  to substitute for bringing enough people.
- **The first veterancy table measured the wrong thing.** It thinned the reference force
  to push the clear rate to the margin, which made the swarm factions read as flat: a
  China or NK plan cut in half dies at every rank, and a 15% HP bump cannot save a unit
  that was never going to survive the volley. Measured at full strength the signal is
  monotone for all five. The lesson is general — a multiplier is invisible at the floor
  and at the ceiling, so it has to be measured where the units were already living.
- **The ground (v1.19) is a trade, and the reading is the SPREAD.** Terrain has to change
  WHICH bases are hard rather than making all of them harder — the same bar field
  conditions clear. Read the KITS table two ways: GROUND against FLAT on the mean, which
  has to land inside the ±9 band field conditions are held to, and the three SHEET rows
  against each other, which has to be much wider than that. It has held at every
  measurement since — a couple of points on the mean against roughly twenty across the
  sheets at v1.32 — and the second number is the whole point of putting a base somewhere
  rather than nowhere. Both move when the deal moves, because the sheets are measured on
  the bases the deal names.
- **The first cut of terrain was a difficulty spike, and the harness said which term did
  it.** GROUND opened at 33 points under FLAT. Switching the elevation multiplier off
  put it at 93.0 against 93.4 — meaning water, cover and movement cost together
  accounted for almost NONE of the drop and elevation accounted for all of it. The
  mockup had proposed +40% reach on the top band; it ships at +15%.
- **That was the third time this project learned the same thing**: a raid is decided
  by GUN COVERAGE, not by route length or wall HP. Field conditions found it (defender
  weaponDamage is by far the strongest lever, wall HP barely moves a fixed force), gates
  found it (48 doors in a ring moved the clear rate by one point, because attackers
  route rather than breach), and terrain found it again. v1.20 went after the cause
  rather than working around it a fourth time — see the GARRISON table above.
- **The cause was that a raid charged nothing for TIME (v1.20).** `raidConfig` set
  cpPerSecond 0 and cpCap 1, so a defending post had no economy, and the standing-orders
  evaluator bailed on the attacker side, so nothing it might have bought could be spent.
  A Front Line base was a diorama. Route length and wall HP can only ever spend the
  attacker’s time, and time was free — so the whole fortification layer was priced at
  zero. It was in fact priced BELOW zero: stripping every wall out of a generated base
  made it EASIER to hold, 86.7 against 81.5, because the maze’s one real effect was
  steering raiders AROUND the guns.
- **Two faults, two fixes, and they had to be separated to be seen.** The GARRISON
  table is a 2x2 for a reason: a first read moved the watch and the gun trade together
  and credited the watch with the wall line. Held still one at a time, GUNS 0.8 alone
  takes the wall line from -5.0 to +8.6 with the clear rate unmoved, and the watch is
  slightly negative on that axis (+6.6 shipped). Weaker guns let attackers live longer
  in the open, so a wall that holds a force in a corridor under fire finally outweighs
  a maze that routes them past the shooting.
- **What the watch earns is the CLOCK, which this table cannot see.** Measured by
  staggering the same three squads instead of launching them together, over 1200 raids
  a cell: a 60-second stagger costs 5.1 points unwatched and 8.3 watched. A concentrated
  push arrives before the reserve exists; a dawdling one walks into guns that were not
  there when it set off. Targeting is the whole of it — ccApproach and breach both
  measured indistinguishable from having no garrison at all, because a last stand at
  the objective comes after the corridor has already been walked for free.
- **The method lesson is the one worth keeping.** A test written against the first,
  wrong read PASSED with the garrison deleted, because it moved two things and asserted
  on the sum. tests/garrison.test.ts now moves one thing per test, and each claim was
  checked to FAIL when its own cause is reverted and to SURVIVE when the other is.
- **The fords are the one thing that came out backwards.** A river with a single bridge
  is a chokepoint worth more than any wall, so two fords were added — and they did not
  move the clear rate at all. What they moved was the butcher’s bill, the wrong way:
  losses rose from 85% to 91% on the hardest sheet, because a force that splits across
  three crossings arrives piecemeal, and piecemeal is how you die. Three doors is worse
  than one if you insist on using all of them.
- **Woodland is a trade because artillery ignores it.** Cover applies to aimed fire and
  not to a barrage or mortar splash: canopy hides a man from a gunner, not from
  something that lands in the trees. That asymmetry is what stops it being a free
  hiding place, and it is what gives the fire-mission layer something to answer.
- **Terrain moved the veterancy fixture onto the floor, which is its own lesson.** The
  survival test measures a thin 5R1A push at tier 4; with ground under it, GREEN and
  CADRE bring home exactly the same men, because a 15% HP bump cannot save a unit that
  was never going to survive the volley. It measures on flat ground now — the same
  correction the first veterancy table needed, for the same reason.
- **Air is not weaker. It is a different LADDER (v1.33), and three labels had to be
  fixed before that was visible.** The v1.32 reading of this section said the air
  ROSTER was mispriced, off a spread of 32 clear-rate points. That spread was measured
  against a control of the wrong size: four of the five air plans fly 3-4 MP more than
  the ground reference, and the only matched one is the faction that measured worst.
  Against `GROUND =N` no air force beats its own ground, and the USA's +6.4 is +0.6.
  The loss column was counting heads rather than manpower, and the row labelled `no AA`
  never removed any AA — the mounts are built into every base and only the garrison's
  reactive order came off. All three are fixed above; each had been read as a finding
  for four or more releases.
- **What is left is the real one.** `--wing` prices air the way `--rungs` prices the
  ladder, and the air demand row comes out non-monotone: the USA needs 38 MP at T3 and
  12 at T4. Probed directly that is not noise — a 12-MP air force clears T4 62% of the
  time and T3 0%. Measured per dealt target, the two hardest shapes for the USA's
  aircraft (`camp` 0%, `depot` 5%) are the two its ground force finds EASIEST (60%,
  100%), and `star` and `keep` invert the other way. Walls and overlapping arcs make a
  rung hard on the ground and neither exists for an aircraft; what is left is the flight
  in, and the shapes with the fewest walls spread their mounts and their post over the
  most ground. 39 of the 75 dealt targets move by 30+ points depending on whether the
  force walked or flew, while four of five factions have MEANS within a few points. It
  is not a power problem, it is an information one: the shape is free knowledge and the
  game says nothing about what it means to an aircraft.
- **Watch items for v0.6**: the EARLY L2→L3 cliff on all sides (armor arrives before
  anti-armor requisitions), China MID vs L5+ (Javelin overwatch), and NK MID vs L4+
  (everything kills sentry nests).
- M7 changes behind these numbers: tunneled squads surface as one push around the mouth
  after an 8s dig (reserved cells carry the mouths into replays), the Bulsae matches the
  HJ-8 trade (46/58/72 at 0.5/s), the Koksan runs a 4.2s cadence with a 3.5 dead zone
  in exchange for 10.5–11 reach, and v0.7 adds sustainment auras: healing is additive,
  capped per target, and deterministic — it out-heals one gun, never two.
- **The campaign is in this file from v1.45.1 (`--missions`).** Every mission is held
  up against v1.44's campaign, frozen, on the three reference bases; `*` marks the base
  the campaign allows by then. It had never been measured, and on the 10x15 board every
  mission that fields heavies had drifted toward the attacker, by about forty points on
  average at its own base. None without heavies moved. The armour missions and finales
  now field two heavies, chosen per mission by measurement (`--missions fit`). One cell
  still off is LANDFALL fought without the CC3 the campaign has unlocked by then: with no
  heavies at all a CC2 base holds it 15% of the time, so it is the mission, not the tanks.
- **The keep's guns spread in v1.45.2.** Drawn for 10x15 with every gun in the bands
  in front of and behind the post, it was a wall for the three reference forces that
  hunt guns — Russia 7, the UN 0 and the KPA 11 clears in 144 at T4-T5 — because each
  gun covered every other. With the same guns in the bands' corners and in outworks
  outside the outer ring, 54, 12 and 58, still each one's third hardest shape, and the
  deal hands the keep to all five factions again.
- **The defender's verbs were re-judged on the contested band in v1.45.3 (`--verbs`).**
  Every rule that stands up a gun wins two to twelve battles for each it loses, +20 to
  +26 held. A fire mission lands now, and it changes about one battle in four, nearly as
  often each way: +3 for the A-10 and +4 for the barrage, which is noise with a price.
  Before chain 5 the A-10 had never landed at all. On the new aim HOLDFAST's inner-line
  gun stood beside the post, inside the ring an assault clears first, and cost it 7 on
  MID; at the breach HOLDFAST is +16 and positive on every stage. It is now the best
  preset on an EARLY base and TRIPWIRE on MID and LATE, where on chain 4 HOLDFAST was
  the best of the three on every stage.
- **The fire missions got a job the chain can see in v1.47.0 (`--pins`, `--verbs`).** Two
  things kept them stirring battles rather than deciding them, and each was priced alone.
  The duty officer called a strike the moment it could pay, onto the densest knot on the
  board, usually the column still forming at the edge of the map. Waiting for two or
  three in the post's cover ring already makes both starred verbs on chain 5: the A-10
  +6, the barrage +9. And a strike did damage and nothing else. On chain 6 it pins every
  ground unit it lands on for eight seconds, and a gun run on the assault is +13, winning
  74 battles for 13 lost. Nearly all of the pin is in the tanks: pinning heavies alone
  gives +12. HOLDFAST's gun run waits for the assault now, +22 against +12 on its old aim.
  COUNTERBATTERY keeps its aim, because its claymore spends the budget while a waiting
  strike holds its fire: 13 re-aimed against 15 as it stands.
