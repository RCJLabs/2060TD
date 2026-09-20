# Balance snapshot (v1.41.1)

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

```
RAID — UNITED STATES strike force (25 MP) vs PLA Front Line
TIER | CLEAR% | DESTR% | MP LOST%
-----+--------+--------+---------
   1 |     67 |     55 |       47
   2 |     35 |     50 |       73
   3 |     72 |     54 |       44
   4 |     38 |     43 |       75
   5 |      0 |     43 |      100

RAID — UNITED STATES strike force (25 MP) vs PLA Front Line — STRIKE doctrine + fire plan
TIER | CLEAR% | DESTR% | MP LOST%
-----+--------+--------+---------
   1 |     67 |     59 |       43
   2 |     40 |     51 |       67
   3 |     83 |     55 |       39
   4 |     48 |     48 |       68
   5 |     13 |     55 |       94

RAID — UNITED STATES strike force (25 MP) vs PLA Front Line — AIR RAID (rotors + a ground tail)
TIER | CLEAR% | DESTR% | MP LOST%
-----+--------+--------+---------
   1 |     98 |    100 |        6
   2 |      0 |     31 |      100
   3 |     30 |     43 |       83
   4 |      0 |     30 |      100
   5 |      0 |     39 |      100

RAID — PLA EXPEDITIONARY FORCE strike force (26 MP) vs US ARMY Front Line
TIER | CLEAR% | DESTR% | MP LOST%
-----+--------+--------+---------
   1 |     67 |     63 |       45
   2 |    100 |     69 |       20
   3 |     97 |     69 |       34
   4 |     38 |     56 |       77
   5 |     17 |     64 |       93

RAID — PLA EXPEDITIONARY FORCE strike force (26 MP) vs US ARMY Front Line — STRIKE doctrine + fire plan
TIER | CLEAR% | DESTR% | MP LOST%
-----+--------+--------+---------
   1 |     67 |     63 |       44
   2 |    100 |     69 |       18
   3 |    100 |     71 |       24
   4 |     73 |     69 |       53
   5 |     52 |     74 |       77

RAID — PLA EXPEDITIONARY FORCE strike force (26 MP) vs US ARMY Front Line — AIR RAID (rotors + a ground tail)
TIER | CLEAR% | DESTR% | MP LOST%
-----+--------+--------+---------
   1 |     82 |     97 |       19
   2 |      5 |     53 |       99
   3 |      7 |     49 |       95
   4 |      0 |     38 |      100
   5 |      0 |     43 |      100

RAID — RUSSIAN GROUND FORCES strike force (27 MP) vs US ARMY Front Line
TIER | CLEAR% | DESTR% | MP LOST%
-----+--------+--------+---------
   1 |    100 |     99 |       27
   2 |     98 |     96 |       29
   3 |     87 |     92 |       45
   4 |     13 |     56 |       95
   5 |     20 |     65 |       91

RAID — RUSSIAN GROUND FORCES strike force (27 MP) vs US ARMY Front Line — STRIKE doctrine + fire plan
TIER | CLEAR% | DESTR% | MP LOST%
-----+--------+--------+---------
   1 |    100 |     99 |       20
   2 |    100 |     95 |       22
   3 |    100 |     95 |       25
   4 |     72 |     84 |       68
   5 |     37 |     75 |       84

RAID — RUSSIAN GROUND FORCES strike force (27 MP) vs US ARMY Front Line — AIR RAID (rotors + a ground tail)
TIER | CLEAR% | DESTR% | MP LOST%
-----+--------+--------+---------
   1 |     88 |     98 |       13
   2 |     15 |     58 |       96
   3 |     18 |     60 |       88
   4 |      0 |     35 |      100
   5 |      0 |     42 |      100

RAID — KOREAN PEOPLE'S ARMY strike force (26 MP) vs US ARMY Front Line
TIER | CLEAR% | DESTR% | MP LOST%
-----+--------+--------+---------
   1 |    100 |     75 |       28
   2 |     85 |     76 |       41
   3 |     92 |     76 |       49
   4 |     33 |     49 |       86
   5 |     23 |     40 |       87

RAID — KOREAN PEOPLE'S ARMY strike force (26 MP) vs US ARMY Front Line — hunt + raze squads TUNNELED
TIER | CLEAR% | DESTR% | MP LOST%
-----+--------+--------+---------
   1 |     98 |     73 |       30
   2 |     98 |     83 |       44
   3 |     95 |     80 |       43
   4 |     40 |     50 |       84
   5 |     50 |     41 |       78

RAID — KOREAN PEOPLE'S ARMY strike force (26 MP) vs US ARMY Front Line — TUNNELED + STRIKE doctrine + fire plan
TIER | CLEAR% | DESTR% | MP LOST%
-----+--------+--------+---------
   1 |    100 |     74 |       24
   2 |    100 |     84 |       33
   3 |     98 |     86 |       32
   4 |     67 |     63 |       65
   5 |     57 |     47 |       72

RAID — KOREAN PEOPLE'S ARMY strike force (26 MP) vs US ARMY Front Line — STRIKE doctrine + fire plan
TIER | CLEAR% | DESTR% | MP LOST%
-----+--------+--------+---------
   1 |    100 |     76 |       19
   2 |     97 |     79 |       30
   3 |     95 |     80 |       43
   4 |     65 |     69 |       68
   5 |     33 |     46 |       79

RAID — KOREAN PEOPLE'S ARMY strike force (26 MP) vs US ARMY Front Line — AIR RAID (rotors + a ground tail)
TIER | CLEAR% | DESTR% | MP LOST%
-----+--------+--------+---------
   1 |    100 |    100 |        4
   2 |     12 |     39 |       98
   3 |      7 |     45 |       99
   4 |      0 |     28 |      100
   5 |      0 |     33 |      100

RAID — UN COALITION strike force (26 MP) vs PLA Front Line
TIER | CLEAR% | DESTR% | MP LOST%
-----+--------+--------+---------
   1 |    100 |     93 |       10
   2 |    100 |     90 |       22
   3 |    100 |     99 |       28
   4 |      5 |     49 |       98
   5 |      0 |     39 |      100

RAID — UN COALITION strike force (26 MP) vs PLA Front Line — CONTROL: medics replaced by riflemen
TIER | CLEAR% | DESTR% | MP LOST%
-----+--------+--------+---------
   1 |     73 |     84 |       66
   2 |     15 |     71 |       94
   3 |     12 |     61 |       96
   4 |      0 |     25 |      100
   5 |      0 |     21 |      100

RAID — UN COALITION strike force (26 MP) vs PLA Front Line — STRIKE doctrine + fire plan
TIER | CLEAR% | DESTR% | MP LOST%
-----+--------+--------+---------
   1 |    100 |     96 |       12
   2 |    100 |     94 |       16
   3 |    100 |     99 |       20
   4 |     37 |     71 |       85
   5 |      0 |     54 |      100

RAID — UN COALITION strike force (26 MP) vs PLA Front Line — AIR RAID (rotors + a ground tail)
TIER | CLEAR% | DESTR% | MP LOST%
-----+--------+--------+---------
   1 |     85 |     98 |       20
   2 |      0 |     32 |      100
   3 |     33 |     46 |       78
   4 |      0 |     31 |      100
   5 |      0 |     45 |      100

ARCHETYPES — UNITED STATES strike force (25 MP), clear% by tier
SHAPE        | FROM |   T1 |   T2 |   T3 |   T4 |   T5 |  MEAN | DESTR% | MP LOST%
-------------+------+------+------+------+------+------+-------+--------+---------
COMPOUND     |    1 |  100 |  100 |   75 |   40 |   72 |  77.4 |     50 |       46
OPEN CAMP    |    1 |   67 |   67 |   72 |   33 |   87 |  65.2 |     59 |       54
CORRIDOR     |    1 |  100 |  100 |   67 |   33 |    5 |  61.0 |     61 |       55
STAR FORT    |    2 |  100 |   35 |   65 |   47 |    0 |  49.4 |     49 |       62
  └ prepared |      |  100 |   40 |   83 |   62 |    2 |  57.4 |     52 |       54
DISPERSED DEPOT |    3 |  100 |  100 |   48 |   75 |   38 |  72.2 |     46 |       48
  └ prepared |      |  100 |  100 |   57 |   93 |   62 |  82.4 |     50 |       39
STRONGPOINTS |    3 |  100 |  100 |  100 |   67 |    5 |  74.4 |     59 |       45
KEEP         |    4 |  100 |  100 |   47 |   60 |   62 |  73.8 |     46 |       46
BUNKER COMPLEX |    5 |  100 |  100 |   55 |   25 |    0 |  56.0 |     60 |       58
  └ prepared |      |  100 |  100 |   67 |   52 |   10 |  65.8 |     66 |       51

FIELD CONDITIONS — UNITED STATES strike force (25 MP), clear% by tier
CONDITION    |   T1 |   T2 |   T3 |   T4 |   T5 |  MEAN | vs CLEAR
-------------+------+------+------+------+------+-------+---------
CLEAR LINE   |   67 |   35 |   72 |   38 |    0 |  42.4 |     +0.0
HARD RAIN    |   67 |   35 |   97 |   33 |   23 |  51.0 |     +8.6
DUG IN       |   67 |   35 |   67 |   32 |    0 |  40.2 |     -2.2
FUEL CRISIS  |   67 |   35 |   67 |   28 |    0 |  39.4 |     -3.0
BLACKOUT     |   67 |   35 |   72 |   38 |    0 |  42.4 |     +0.0
ATTRITION    |   67 |   33 |   67 |   33 |    0 |  40.0 |     -2.4

TERRAIN — the UNITED STATES reference force vs PLA posts, flat ground vs real
GROUND      |    T1 |    T2 |    T3 |    T4 |    T5 |  MEAN | MP LOST%
------------+-------+-------+-------+-------+-------+-------+---------
       FLAT |   100 |    67 |    38 |    90 |     0 |  59.0 |       58
     GROUND |   100 |    68 |    58 |    60 |     8 |  58.8 |       58
    SHEET 1 |   100 |   100 |    75 |     0 |     0 |  55.0 |       60
    SHEET 2 |   100 |   100 |     0 |    80 |    25 |  61.0 |       58
    SHEET 3 |   100 |     5 |   100 |   100 |     0 |  61.0 |       56

PARITY — every faction at its own best line, same manpower, same ladder
FACTION     |    T1 |    T2 |    T3 |    T4 |    T5 |  MEAN | MP LOST% | LINE
------------+-------+-------+-------+-------+-------+-------+----------+------
UNITED STAT |   100 |    68 |    58 |    60 |     8 |  58.8 |       58 | GROUND
PLA EXPEDIT |   100 |    98 |    85 |    45 |    32 |  72.0 |       49 | GROUND
RUSSIAN GRO |   100 |    93 |   100 |    65 |    12 |  74.0 |       54 | GROUND
KOREAN PEOP |    98 |    98 |    92 |    28 |    72 |  77.6 |       57 | TUNNEL
UN COALITIO |   100 |    88 |    58 |    48 |     0 |  58.8 |       61 | GROUND

SPREAD — 18.8 points between NK and USA. Five kits differing in STYLE (GDD §4) should not differ this much in ODDS.

THE DEAL — the three targets a rung offers vs the eight it could offer
SHAPE        |    T1 |    T2 |    T3 |    T4 |    T5 |  MEAN
-------------+-------+-------+-------+-------+-------+-------
star         |   100 |    80 |    55 |    28 |     8 |  54.1
keep         |    99 |    95 |    69 |    25 |    27 |  62.9
bunker       |   100 |    95 |    69 |    39 |    19 |  64.3
corridor     |   100 |    87 |    68 |    53 |    28 |  67.2
depot        |   100 |   100 |    71 |    51 |    29 |  70.1
compound     |   100 |    87 |    84 |    44 |    37 |  70.4
strongpoints |   100 |    92 |    95 |    64 |    13 |  72.8
camp         |    87 |    93 |    95 |    63 |    96 |  86.7

WHAT EACH FACTION IS DEALT — its three targets vs its own pool at that rung
FACTION |          T1 |          T2 |          T3 |          T4 |          T5 |   MEAN GAP
--------+-------------+-------------+-------------+-------------+-------------+-----------
    USA |    89/89 +0 |    69/77 -8 |    62/70 -8 |    51/47 +4 |    0/31 -31 |       -8.4
  CHINA |    89/89 +0 |    87/88 -2 |    78/81 -3 |    53/62 -9 |    49/48 +1 |       -2.4
 RUSSIA |  100/100 +0 |    84/78 +6 |   89/78 +11 |    51/52 -1 |   36/25 +11 |       +5.3
     NK |  100/100 +0 |    98/98 -1 |    89/87 +2 |    53/57 -4 |   56/44 +11 |       +1.8
     UN |  100/100 +0 |    89/92 -3 |   60/73 -13 |    20/16 +4 |    0/13 -13 |       -5.1

  dealt/pool and the gap. A deal that tracks its pool is offering that faction
  a fair read of the rung; a big negative gap is a rung of walls.

SHAPE COVERAGE — the rungs each faction is dealt each shape on
SHAPE        |         USA |       CHINA |      RUSSIA |          NK |          UN
-------------+-------------+-------------+-------------+-------------+-------------
compound     |       T1,T2 | T1,T2,T4,T5 | T1,T2,T4,T5 | T1,T2,T3,T4,T5 | T1,T3,T4,T5
camp         |    T1,T2,T3 |       T1,T2 | T1,T2,T3,T5 |       T1,T4 |       T1,T2
corridor     |    T1,T3,T5 |          T1 |       T1,T3 |    T1,T2,T5 |       T1,T2
star         |    T2,T4,T5 |       T2,T3 |          T2 |          T2 |       T2,T3
depot        |          T3 |          T3 |          T3 |          T3 |          T3
strongpoints |          T4 |    T3,T4,T5 |          T4 |          T3 |       T4,T5
keep         |          T4 |          T4 |          T4 |          T4 |          T4
bunker       |          T5 |          T5 |          T5 |          T5 |          T5

  8 of 8 shapes reach a player somewhere.

THE LADDER, pool mean per rung: T1 96  ->  T2 87  ->  T3 78  ->  T4 47  ->  T5 32
STEP SIZE: T1->T2 -9  T2->T3 -9  T3->T4 -31  T4->T5 -15 — POOL mean, at a fixed reference force.
  This is the whole pool, not the deal, and the force is a mature army: the early
  rungs saturate near 100 and no step between them can show. It is here to price
  the SHAPES, not to judge the ladder — `--rungs` does that, by asking how much
  force each rung demands rather than what one army does to all of them.

THE TWO KITS — every force against both sets of fortifications
FORCE   | vs PLA post | vs US firebase |   GAP | normally raids
--------+-------------+----------------+-------+---------------
    USA |        63.5 |           71.4 |  -7.8 | CHINA
  CHINA |        59.4 |           69.3 |  -9.9 | USA
 RUSSIA |        56.8 |           63.0 |  -6.3 | USA
     NK |        31.3 |           69.8 | -38.5 | USA
     UN |        49.0 |           60.9 | -12.0 | CHINA

WORST GAP 38.5 points. Two fronts differing in STYLE should not differ this much in DIFFICULTY — whoever raids the softer one is playing on easy and did not choose to.

THE PLAN, NOT THE FACTION — the same roster asked twice
FACTION | REF MP | REFERENCE | RECIPE MP | RECIPE |  BEST | PLAN IS WORTH
--------+--------+-----------+-----------+--------+-------+--------------
    USA |     25 |      70.8 |        26 |   31.7 |  70.8 |         -39.2
  CHINA |     26 |      75.4 |        25 |   42.1 |  75.4 |         -33.3
 RUSSIA |     27 |      70.4 |        27 |   44.2 |  70.4 |         -26.3
     NK |     26 |      79.2 |        26 |   79.2 |  79.2 |          +0.0
     UN |     26 |      59.2 |        24 |   32.5 |  59.2 |         -26.7

PLAN IS WORTH UP TO 39.2 POINTS — comparable to every effect this harness measures. Read BEST as the faction and the last column as the error bar; a single plan's row is not a reading of a kit.
BEST-PLAN SPREAD 20.0 points. `--kits` is unaffected: it holds the force fixed and swaps only the fortifications.

WHAT KILLS A COMMAND POST — the heavy's damage type, which was picked for flavour
FACTION | HEAVY FIRES | vs STRUCT | SHIPPING | ALL EXPLOSIVE | ALL KINETIC | SWING
--------+-------------+-----------+----------+---------------+-------------+------
    USA |   explosive |        x1 |     63.5 |          63.5 |        53.6 |  +9.9
  CHINA |   explosive |        x1 |     69.3 |          69.3 |        45.3 | +24.0
 RUSSIA |     kinetic |      x0.5 |     63.0 |          63.0 |        63.0 |  +0.0
     NK |     kinetic |      x0.5 |     74.0 |          74.0 |        74.0 |  +0.0
     UN |     kinetic |      x0.5 |     49.0 |          49.0 |        49.0 |  +0.0

ONE FLAG ON ONE UNIT IS WORTH UP TO 24.0 POINTS. Ranged fire is discounted against structures (smallArms 0.15, kinetic 0.5, explosive 1.0); melee ignores the table but
  only fires when adjacent, which in practice only the heavy manages — it lands 60-84% of the killing blows. Normalising the flag does NOT lift the UN off the floor.

WHO CARRIES A RAID — every unit kind taken out of the plan, two ways
FACTION | UNIT         | MP | BASE | SILENCED | REPLACED | SHARE
--------+--------------+----+------+----------+----------+------
    USA |       abrams | 16 |   63 |       60 |       23 |   38%
    USA |       humvee |  6 |   63 |        0 |       -1 |   -1%
    USA |      javelin |  3 |   63 |        3 |       -3 |   -5%
  CHINA |    grenadier |  4 |   70 |        3 |       18 |   26%
  CHINA |      militia |  1 |   70 |        0 |        2 |    3%
  CHINA |       type99 | 21 |   70 |       64 |       42 |   61%
 RUSSIA |          btr | 18 |   63 |       54 |        4 |    6%
 RUSSIA |     demoteam |  6 |   63 |        5 |      -10 |  -16%
 RUSSIA |          rpg |  3 |   63 |       11 |        2 |    3%
     NK |      nkrifle | 12 |   70 |       10 |       20 |   28%
     NK |         rpg7 |  4 |   70 |        7 |       -4 |   -6%
     NK |     tunneler | 10 |   70 |       53 |       29 |   42%
     UN |         nlaw |  3 |   51 |        8 |       -2 |   -3%
     UN |     unsapper |  2 |   51 |        2 |        5 |    9%
     UN |          vab | 21 |   51 |       50 |       36 |   71%

WORST CARRY 71% — UN vab. M22's bar is 50%: above it, the plan is one unit and two decorations, and "your plan is your skill" is false.
SILENCED zeroes every damage stat and leaves the body; REPLACED takes the kind out and spends its manpower on the rest of the plan. A unit that scores low SILENCED and high REPLACED is earning its place with its BODY — under the kill chain that is a real job, since the charge needs a crew and the burn needs the ground held.

WHAT THE SEED DECIDES — the same matchup fought 12 times (25% of fire does not tell)
FORCE   | MATCHUPS | DECIDED     | SAME MEN HOME | LENGTH | CLEAR
--------+----------+-------------+---------------+--------+------
    USA |       40 |    31 (78%) |      13 (33%) |    738 |  69.4
  CHINA |       40 |    26 (65%) |       5 (13%) |    723 |  80.0
 RUSSIA |       40 |    28 (70%) |       5 (13%) |    755 |  75.2
     NK |       40 |    24 (60%) |        3 (8%) |    681 |  78.1
     UN |       40 |    30 (75%) |      12 (30%) |    610 |  60.6
--------+----------+-------------+---------------+--------+------
    ALL |      200 |   139 (70%) |      38 (19%) |    701 |  72.7

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
ARMOUR |  ASSAULT |      80.6 |       81.9 |        48.6
ARMOUR |     HUNT |      77.8 |       93.1 |        87.5
ARMOUR |     RAZE |      73.6 |       83.3 |        93.1
  FOOT |  ASSAULT |      25.0 |       33.3 |        58.3
  FOOT |     HUNT |       8.3 |       52.8 |        59.7
  FOOT |     RAZE |      22.2 |       31.9 |        79.2
 MIXED |  ASSAULT |      56.9 |       66.7 |        50.0
 MIXED |     HUNT |      54.2 |       80.6 |        70.8
 MIXED |     RAZE |      51.4 |       68.1 |        88.9
       best: POST ARMOUR/ASSAULT  ·  GUNS ARMOUR/HUNT  ·  STORES ARMOUR/RAZE
-------+----------+-----------+------------+------------
CHINA
ARMOUR |  ASSAULT |      75.0 |       87.5 |        62.5
ARMOUR |     HUNT |      83.3 |       94.4 |        91.7
ARMOUR |     RAZE |      80.6 |       94.4 |        98.6
  FOOT |  ASSAULT |       4.2 |        0.0 |         0.0
  FOOT |     HUNT |       5.6 |       18.1 |         0.0
  FOOT |     RAZE |       0.0 |        0.0 |        18.1
 MIXED |  ASSAULT |      81.9 |       84.7 |        56.9
 MIXED |     HUNT |      81.9 |       94.4 |        90.3
 MIXED |     RAZE |      73.6 |       88.9 |        94.4
       best: POST ARMOUR/HUNT  ·  GUNS ARMOUR/HUNT  ·  STORES ARMOUR/RAZE
-------+----------+-----------+------------+------------
RUSSIA
ARMOUR |  ASSAULT |      45.8 |       51.4 |        43.1
ARMOUR |     HUNT |      47.2 |       87.5 |        77.8
ARMOUR |     RAZE |      40.3 |       86.1 |        91.7
  FOOT |  ASSAULT |      33.3 |       38.9 |        51.4
  FOOT |     HUNT |      23.6 |       65.3 |        62.5
  FOOT |     RAZE |      27.8 |       56.9 |        84.7
 MIXED |  ASSAULT |      56.9 |       65.3 |        59.7
 MIXED |     HUNT |      84.7 |       88.9 |        87.5
 MIXED |     RAZE |      65.3 |       72.2 |        95.8
       best: POST MIXED/HUNT  ·  GUNS MIXED/HUNT  ·  STORES MIXED/RAZE
-------+----------+-----------+------------+------------
NK
ARMOUR |  ASSAULT |      29.2 |       34.7 |        33.3
ARMOUR |     HUNT |      36.1 |       77.8 |        55.6
ARMOUR |     RAZE |      15.3 |       36.1 |        75.0
  FOOT |  ASSAULT |       9.7 |        0.0 |         0.0
  FOOT |     HUNT |      70.8 |       94.4 |         0.0
  FOOT |     RAZE |       2.8 |        0.0 |        87.5
 MIXED |  ASSAULT |      23.6 |        0.0 |         0.0
 MIXED |     HUNT |      80.6 |       91.7 |        22.2
 MIXED |     RAZE |       8.3 |        4.2 |        91.7
       best: POST MIXED/HUNT  ·  GUNS FOOT/HUNT  ·  STORES MIXED/RAZE
-------+----------+-----------+------------+------------
UN
ARMOUR |  ASSAULT |      41.7 |       40.3 |        29.2
ARMOUR |     HUNT |      37.5 |       62.5 |        38.9
ARMOUR |     RAZE |      26.4 |       36.1 |        62.5
  FOOT |  ASSAULT |      27.8 |       37.5 |        56.9
  FOOT |     HUNT |      11.1 |       50.0 |        54.2
  FOOT |     RAZE |      15.3 |       40.3 |        76.4
 MIXED |  ASSAULT |      51.4 |       47.2 |        65.3
 MIXED |     HUNT |      68.1 |       84.7 |        79.2
 MIXED |     RAZE |      54.2 |       62.5 |        93.1
       best: POST MIXED/HUNT  ·  GUNS MIXED/HUNT  ·  STORES MIXED/RAZE
-------+----------+-----------+------------+------------

DISTINCT WINNERS 12 of 15. One force topping every column would mean the objective is a label on the same raid; a different force per column is the whole argument for letting a raid declare what it came for.

GARRISON — the UNITED STATES reference force vs PLA posts
CONFIG      |    T1 |    T2 |    T3 |    T4 |    T5 |  MEAN | MP LOST%
------------+-------+-------+-------+-------+-------+-------+---------
    v1.19 W |   100 |    70 |    55 |    57 |     5 |  57.4 |       59
    v1.19 — |   100 |    67 |    35 |    23 |     0 |  45.0 |       63
 GUNS 0.8 W |   100 |    70 |    62 |    67 |    10 |  61.8 |       54
 GUNS 0.8 — |   100 |    67 |    37 |    40 |     0 |  48.8 |       60
    WATCH W |   100 |    68 |    42 |    42 |     2 |  50.8 |       65
    WATCH — |   100 |    67 |    33 |    25 |     0 |  45.0 |       65
  SHIPPED W |   100 |    68 |    58 |    60 |     8 |  58.8 |       58
  SHIPPED — |   100 |    67 |    35 |    37 |     0 |  47.8 |       63

WALL LINE IS WORTH — v1.19 -12.4  |  GUNS 0.8 -13.0  |  WATCH -5.8  |  SHIPPED -11.0  (clear-rate points to the defender)

AIR — the UNITED STATES reference force vs PLA posts, with and without AA
      GROUND reference 25 MP, AIR plan 30 MP, so the edge is read against GROUND =30
FORCE       |    T1 |    T2 |    T3 |    T4 |    T5 |  MEAN | MP LOST%
------------+-------+-------+-------+-------+-------+-------+---------
     GROUND |   100 |    68 |    58 |    60 |     8 |  58.8 |       58
 GROUND =30 |   100 |    70 |    48 |    30 |    30 |  55.6 |       59
 AIR mounts |    83 |     2 |     0 |     0 |     0 |  17.0 |       84
AIR +manpads |    83 |     0 |     0 |     0 |     0 |  16.6 |       84

AIR'S EDGE OVER MATCHED GROUND — vs mounts -38.6  |  vs mounts+manpads -39.0  (clear-rate points, both forces at 30 MP)

AIR — the PLA EXPEDITIONARY FORCE reference force vs US ARMY posts, with and without AA
      GROUND reference 26 MP, AIR plan 30 MP, so the edge is read against GROUND =30
FORCE       |    T1 |    T2 |    T3 |    T4 |    T5 |  MEAN | MP LOST%
------------+-------+-------+-------+-------+-------+-------+---------
     GROUND |   100 |    98 |    85 |    45 |    32 |  72.0 |       49
 GROUND =30 |   100 |    93 |    83 |    35 |    43 |  70.8 |       55
 AIR mounts |    80 |     0 |     8 |     0 |     0 |  17.6 |       83
AIR +manpads |    80 |     0 |     7 |     0 |     0 |  17.4 |       83

AIR'S EDGE OVER MATCHED GROUND — vs mounts -53.2  |  vs mounts+manpads -53.4  (clear-rate points, both forces at 30 MP)

AIR — the RUSSIAN GROUND FORCES reference force vs US ARMY posts, with and without AA
      GROUND reference 27 MP, AIR plan 27 MP — already matched, so GROUND =N must repeat GROUND exactly
FORCE       |    T1 |    T2 |    T3 |    T4 |    T5 |  MEAN | MP LOST%
------------+-------+-------+-------+-------+-------+-------+---------
     GROUND |   100 |    93 |   100 |    65 |    12 |  74.0 |       54
 GROUND =27 |   100 |    93 |   100 |    65 |    12 |  74.0 |       54
 AIR mounts |    88 |     0 |    23 |     0 |     0 |  22.2 |       79
AIR +manpads |    88 |     0 |    20 |     0 |     0 |  21.6 |       80

AIR'S EDGE OVER MATCHED GROUND — vs mounts -51.8  |  vs mounts+manpads -52.4  (clear-rate points, both forces at 27 MP)

AIR — the KOREAN PEOPLE'S ARMY reference force vs US ARMY posts, with and without AA
      GROUND reference 26 MP, AIR plan 29 MP, so the edge is read against GROUND =29
FORCE       |    T1 |    T2 |    T3 |    T4 |    T5 |  MEAN | MP LOST%
------------+-------+-------+-------+-------+-------+-------+---------
     GROUND |   100 |    80 |    98 |    18 |    30 |  65.2 |       62
 GROUND =29 |   100 |    72 |   100 |    25 |    52 |  69.8 |       60
 AIR mounts |    95 |     0 |     8 |     0 |     0 |  20.6 |       82
AIR +manpads |    95 |     0 |     7 |     0 |     0 |  20.4 |       82

AIR'S EDGE OVER MATCHED GROUND — vs mounts -49.2  |  vs mounts+manpads -49.4  (clear-rate points, both forces at 29 MP)

AIR — the UN COALITION reference force vs PLA posts, with and without AA
      GROUND reference 26 MP, AIR plan 30 MP, so the edge is read against GROUND =30
FORCE       |    T1 |    T2 |    T3 |    T4 |    T5 |  MEAN | MP LOST%
------------+-------+-------+-------+-------+-------+-------+---------
     GROUND |   100 |    88 |    58 |    48 |     0 |  58.8 |       61
 GROUND =30 |   100 |    97 |    95 |    28 |     0 |  64.0 |       58
 AIR mounts |    83 |     0 |     0 |     0 |     0 |  16.6 |       84
AIR +manpads |    83 |     0 |     0 |     0 |     0 |  16.6 |       84

AIR'S EDGE OVER MATCHED GROUND — vs mounts -47.4  |  vs mounts+manpads -47.4  (clear-rate points, both forces at 30 MP)

WHAT AIR CHARGES — smallest manpower that clears half the time, by plan shape
FACTION     | SHAPE  |    T1 |    T2 |    T3 |    T4 |    T5 |  MEAN
------------+--------+-------+-------+-------+-------+-------+-------
UNITED STAT | GROUND |    14 |    20 |    39 |    31 |    39 |  28.6
            | AIR    |    28 |    76 |    54 |    76 |    76 |  62.0
            | x      |  2.0x |  3.8x |  1.4x |  2.5x |  1.9x |  2.2x
PLA EXPEDIT | GROUND |    12 |    24 |    24 |    33 |    39 |  26.4
            | AIR    |    28 |    46 |    46 |    64 |    64 |  49.6
            | x      |  2.3x |  1.9x |  1.9x |  1.9x |  1.6x |  1.9x
RUSSIAN GRO | GROUND |    11 |    19 |    19 |    27 |    38 |  22.8
            | AIR    |    27 |    38 |    33 |    63 |    54 |  43.0
            | x      |  2.5x |  2.0x |  1.7x |  2.3x |  1.4x |  1.9x
KOREAN PEOP | GROUND |     9 |    20 |    16 |    28 |    24 |  19.4
            | AIR    |    28 |    39 |    39 |    46 |    64 |  43.2
            | x      |  3.1x |  1.9x |  2.4x |  1.6x |  2.7x |  2.2x
UN COALITIO | GROUND |    11 |    20 |    28 |    33 |    46 |  27.6
            | AIR    |    28 |    76 |    76 |     — |    90 |     —
            | x      |  2.5x |  3.8x |  2.7x |     — |  2.0x |     —

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
            |      | star         |      0 |   0 | +
            |   T3 | corridor     |     60 |   0 | -######
            |      | camp         |      0 |   0 | +
            |      | depot        |    100 |   0 | -##########
            |   T4 | star         |      0 |   0 | +
            |      | keep         |     85 |   0 | -#########
            |      | strongpoints |    100 |   0 | -##########
            |   T5 | bunker       |      0 |   0 | +
            |      | corridor     |     20 |   0 | -##
            |      | star         |      0 |   0 | +
            |      | MEAN / SPLIT |     58 |   0 | r=+0.00  30+ easier 0, harder 9

PLA EXPEDIT |   T1 | compound     |    100 |   0 | -##########
            |      | camp         |    100 |   0 | -##########
            |      | corridor     |    100 |   0 | -##########
            |   T2 | compound     |    100 |   0 | -##########
            |      | camp         |     95 |   0 | -##########
            |      | star         |      0 |   0 | +
            |   T3 | star         |     85 |   0 | -#########
            |      | depot        |     25 |   0 | -###
            |      | strongpoints |     55 |   0 | -######
            |   T4 | compound     |      0 |   0 | +
            |      | strongpoints |    100 |   0 | -##########
            |      | keep         |      0 |   0 | +
            |   T5 | compound     |     45 |   0 | -#####
            |      | strongpoints |      0 |   0 | +
            |      | bunker       |      0 |   0 | +
            |      | MEAN / SPLIT |     54 |   0 | r=+0.00  30+ easier 0, harder 9

RUSSIAN GRO |   T1 | compound     |    100 |   0 | -##########
            |      | camp         |    100 |   0 | -##########
            |      | corridor     |    100 |   0 | -##########
            |   T2 | compound     |     50 |   0 | -#####
            |      | camp         |    100 |   0 | -##########
            |      | star         |     90 |   0 | -#########
            |   T3 | camp         |    100 |   0 | -##########
            |      | corridor     |     80 |   0 | -########
            |      | depot        |    100 |   0 | -##########
            |   T4 | strongpoints |     55 |   0 | -######
            |      | keep         |     30 |   0 | -###
            |      | compound     |      0 |   0 | +
            |   T5 | camp         |     25 |   0 | -###
            |      | bunker       |      0 |   0 | +
            |      | compound     |      0 |   0 | +
            |      | MEAN / SPLIT |     62 |   0 | r=+0.00  30+ easier 0, harder 11

KOREAN PEOP |   T1 | compound     |     95 |   0 | -##########
            |      | camp         |     95 |   0 | -##########
            |      | corridor     |    100 |   0 | -##########
            |   T2 | compound     |     95 |   0 | -##########
            |      | corridor     |    100 |   0 | -##########
            |      | star         |    100 |   0 | -##########
            |   T3 | depot        |    100 |   0 | -##########
            |      | compound     |     95 |   0 | -##########
            |      | strongpoints |     85 |   0 | -#########
            |   T4 | compound     |      0 |   0 | +
            |      | keep         |     20 |   0 | -##
            |      | camp         |     60 |   0 | -######
            |   T5 | compound     |     35 |   0 | -####
            |      | corridor     |     75 |   0 | -########
            |      | bunker       |     85 |   0 | -#########
            |      | MEAN / SPLIT |     76 |   0 | r=+0.00  30+ easier 0, harder 13

UN COALITIO |   T1 | compound     |    100 |   0 | -##########
            |      | camp         |    100 |   0 | -##########
            |      | corridor     |    100 |   0 | -##########
            |   T2 | camp         |    100 |   0 | -##########
            |      | corridor     |     45 |   0 | -#####
            |      | star         |     90 |   0 | -#########
            |   T3 | star         |     25 |   0 | -###
            |      | compound     |     15 |   0 | -##
            |      | depot        |     65 |   0 | -#######
            |   T4 | compound     |     30 |   0 | -###
            |      | keep         |      0 |   0 | +
            |      | strongpoints |     10 |   0 | -#
            |   T5 | bunker       |      0 |   0 | +
            |      | compound     |      0 |   0 | +
            |      | strongpoints |      0 |   0 | +
            |      | MEAN / SPLIT |     45 |   0 | r=+0.00  30+ easier 0, harder 8

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
            |   T2 | compound     |       48 |     106 |          0
            |      | camp         |       48 |     216 |          0
            |      | star         |       48 |     244 |          0
            |   T3 | corridor     |        0 |     151 |          0
            |      | camp         |       48 |     183 |          0
            |      | depot        |       48 |     205 |          0
            |   T4 | star         |       48 |      27 |          0
            |      | keep         |        0 |       0 |          0
            |      | strongpoints |        0 |       0 |          0
            |   T5 | bunker       |       48 |     163 |          0
            |      | corridor     |       48 |     176 |          0
            |      | star         |       48 |      37 |          0

PLA EXPEDIT |   T1 | compound     |        0 |       0 |          0
            |      | camp         |        0 |       0 |          0
            |      | corridor     |        0 |       0 |          0
            |   T2 | compound     |        0 |      58 |          0
            |      | camp         |       47 |     160 |          0
            |      | star         |       47 |     179 |          0
            |   T3 | star         |       47 |      51 |          0
            |      | depot        |        0 |     108 |          0
            |      | strongpoints |        0 |       0 |          0
            |   T4 | compound     |       47 |      69 |          0
            |      | strongpoints |        0 |      36 |          0
            |      | keep         |        0 |       0 |          0
            |   T5 | compound     |       47 |      69 |          0
            |      | strongpoints |        0 |       0 |          0
            |      | bunker       |       47 |     143 |          0

RUSSIAN GRO |   T1 | compound     |        0 |       0 |          0
            |      | camp         |        0 |       0 |          0
            |      | corridor     |        0 |       0 |          0
            |   T2 | compound     |       47 |      73 |          0
            |      | camp         |       47 |     139 |          0
            |      | star         |       47 |     158 |          0
            |   T3 | camp         |       47 |     122 |          0
            |      | corridor     |       47 |     152 |          0
            |      | depot        |       47 |     133 |          0
            |   T4 | strongpoints |        0 |      43 |          0
            |      | keep         |        0 |      33 |          0
            |      | compound     |       47 |      70 |          0
            |   T5 | camp         |       47 |     141 |          0
            |      | bunker       |       47 |     138 |          0
            |      | compound     |       47 |      80 |          0

KOREAN PEOP |   T1 | compound     |        0 |       0 |          0
            |      | camp         |        0 |       0 |          0
            |      | corridor     |        0 |       0 |          0
            |   T2 | compound     |       47 |      96 |          0
            |      | corridor     |       47 |     121 |          0
            |      | star         |       47 |     149 |          0
            |   T3 | depot        |        0 |      86 |          0
            |      | compound     |        0 |      10 |          0
            |      | strongpoints |        0 |       0 |          0
            |   T4 | compound     |       47 |      76 |          0
            |      | keep         |        0 |      36 |          0
            |      | camp         |       47 |     126 |          0
            |   T5 | compound     |       47 |      92 |          0
            |      | corridor     |       47 |     122 |          0
            |      | bunker       |       47 |     124 |          0

UN COALITIO |   T1 | compound     |        0 |       0 |          0
            |      | camp         |        0 |       0 |          0
            |      | corridor     |        0 |       0 |          0
            |   T2 | camp         |       48 |     171 |          0
            |      | corridor     |       48 |     183 |          0
            |      | star         |       48 |     191 |          0
            |   T3 | star         |       48 |      29 |          0
            |      | compound     |       48 |      63 |          0
            |      | depot        |       48 |     161 |          0
            |   T4 | compound     |        0 |      76 |          0
            |      | keep         |        0 |      62 |          0
            |      | strongpoints |        0 |       0 |          0
            |   T5 | bunker       |       48 |     138 |          0
            |      | compound     |       48 |     111 |          0
            |      | strongpoints |        0 |       0 |          0

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
GOOD  | under 29      |      25 |             0.0
FAIR  | 29 to 122     |      25 |             0.0
POOR  | over 122      |      25 |             0.0

  The bands are the shippable form: a player cannot read DPS-seconds, and three
  words is the whole budget the target list has. The cuts are terciles of the
  measured population rather than round numbers, so they cannot be tuned to
  flatter the result.

VETERANCY — UNITED STATES strike force (25 MP), men returned% by tier
RANK    |  ×   |   T1 |   T2 |   T3 |   T4 |   T5 |  MEAN | CLEAR%
--------+------+------+------+------+------+------+-------+-------
GREEN   | 1.00 |   73 |   34 |   33 |   21 |    2 |  32.6 |     59
LINE    | 1.04 |   71 |   39 |   33 |   22 |    3 |  33.6 |     60
VETERAN | 1.09 |   73 |   40 |   36 |   25 |    5 |  35.8 |     63
CADRE   | 1.15 |   73 |   44 |   38 |   26 |    5 |  37.2 |     63

VETERANCY — PLA EXPEDITIONARY FORCE strike force (26 MP), men returned% by tier
RANK    |  ×   |   T1 |   T2 |   T3 |   T4 |   T5 |  MEAN | CLEAR%
--------+------+------+------+------+------+------+-------+-------
GREEN   | 1.00 |   64 |   45 |   35 |   20 |    9 |  34.6 |     72
LINE    | 1.04 |   64 |   52 |   39 |   21 |   18 |  38.8 |     77
VETERAN | 1.09 |   65 |   53 |   42 |   25 |   25 |  42.0 |     83
CADRE   | 1.15 |   66 |   54 |   44 |   34 |   33 |  46.2 |     92

VETERANCY — RUSSIAN GROUND FORCES strike force (27 MP), men returned% by tier
RANK    |  ×   |   T1 |   T2 |   T3 |   T4 |   T5 |  MEAN | CLEAR%
--------+------+------+------+------+------+------+-------+-------
GREEN   | 1.00 |   65 |   56 |   61 |   24 |    6 |  42.4 |     74
LINE    | 1.04 |   68 |   63 |   64 |   29 |   10 |  46.8 |     79
VETERAN | 1.09 |   69 |   63 |   67 |   35 |   16 |  50.0 |     82
CADRE   | 1.15 |   72 |   67 |   72 |   44 |   23 |  55.6 |     89

VETERANCY — KOREAN PEOPLE'S ARMY strike force (26 MP), men returned% by tier
RANK    |  ×   |   T1 |   T2 |   T3 |   T4 |   T5 |  MEAN | CLEAR%
--------+------+------+------+------+------+------+-------+-------
GREEN   | 1.00 |   72 |   38 |   53 |    7 |   10 |  36.0 |     65
LINE    | 1.04 |   73 |   36 |   57 |   13 |   13 |  38.4 |     70
VETERAN | 1.09 |   78 |   44 |   66 |   14 |   18 |  44.0 |     76
CADRE   | 1.15 |   79 |   47 |   68 |   22 |   28 |  48.8 |     81

VETERANCY — UN COALITION strike force (26 MP), men returned% by tier
RANK    |  ×   |   T1 |   T2 |   T3 |   T4 |   T5 |  MEAN | CLEAR%
--------+------+------+------+------+------+------+-------+-------
GREEN   | 1.00 |   85 |   55 |   23 |   24 |    0 |  37.4 |     59
LINE    | 1.04 |   87 |   59 |   38 |   28 |    0 |  42.4 |     64
VETERAN | 1.09 |   86 |   63 |   43 |   31 |    0 |  44.6 |     68
CADRE   | 1.15 |   87 |   71 |   57 |   38 |    0 |  50.6 |     71

DEFENSE — UNITED STATES permanent layer vs PLA assault ladder (hold%)
STAGE       |   L1 |   L2 |   L3 |   L4 |   L5 |   L6
------------+------+------+------+------+------+------
EARLY (CC1) |  100 |  100 |    0 |    0 |    0 |    0
MID (CC2)   |  100 |  100 |  100 |   90 |   75 |   10
LATE (CC3)  |  100 |  100 |  100 |  100 |  100 |  100

DEFENSE — UNITED STATES permanent layer vs PLA assault ladder (hold%) — HOLDFAST standing orders
STAGE       |   L1 |   L2 |   L3 |   L4 |   L5 |   L6
------------+------+------+------+------+------+------
EARLY (CC1) |  100 |  100 |    0 |    0 |    0 |    0
MID (CC2)   |  100 |  100 |  100 |  100 |  100 |   70
LATE (CC3)  |  100 |  100 |  100 |  100 |  100 |  100

DEFENSE — UNITED STATES permanent layer vs PLA assault ladder (hold%) — WITH AA COVER
STAGE       |   L1 |   L2 |   L3 |   L4 |   L5 |   L6
------------+------+------+------+------+------+------
EARLY (CC1) |  100 |  100 |    0 |    0 |    0 |    0
MID (CC2)   |  100 |  100 |  100 |  100 |  100 |   75
LATE (CC3)  |  100 |  100 |  100 |  100 |  100 |  100

DEFENSE — UNITED STATES permanent layer vs PLA assault ladder (hold%) — FORTIFY doctrine
STAGE       |   L1 |   L2 |   L3 |   L4 |   L5 |   L6
------------+------+------+------+------+------+------
EARLY (CC1) |  100 |  100 |    0 |    0 |    0 |    0
MID (CC2)   |  100 |  100 |  100 |  100 |   85 |    0
LATE (CC3)  |  100 |  100 |  100 |  100 |  100 |  100

DEFENSE — PLA EXPEDITIONARY FORCE permanent layer vs US ARMY assault ladder (hold%)
STAGE       |   L1 |   L2 |   L3 |   L4 |   L5 |   L6
------------+------+------+------+------+------+------
EARLY (CC1) |  100 |  100 |    0 |    0 |    0 |    0
MID (CC2)   |  100 |  100 |   85 |    0 |    0 |    0
LATE (CC3)  |  100 |  100 |  100 |  100 |  100 |   95

DEFENSE — PLA EXPEDITIONARY FORCE permanent layer vs US ARMY assault ladder (hold%) — HOLDFAST standing orders
STAGE       |   L1 |   L2 |   L3 |   L4 |   L5 |   L6
------------+------+------+------+------+------+------
EARLY (CC1) |  100 |  100 |    0 |    0 |    0 |    0
MID (CC2)   |  100 |  100 |  100 |   95 |   75 |    0
LATE (CC3)  |  100 |  100 |  100 |  100 |  100 |  100

DEFENSE — PLA EXPEDITIONARY FORCE permanent layer vs US ARMY assault ladder (hold%) — WITH AA COVER
STAGE       |   L1 |   L2 |   L3 |   L4 |   L5 |   L6
------------+------+------+------+------+------+------
EARLY (CC1) |  100 |  100 |    0 |    0 |    0 |    0
MID (CC2)   |  100 |  100 |  100 |  100 |  100 |   70
LATE (CC3)  |  100 |  100 |  100 |  100 |  100 |  100

DEFENSE — PLA EXPEDITIONARY FORCE permanent layer vs US ARMY assault ladder (hold%) — FORTIFY doctrine
STAGE       |   L1 |   L2 |   L3 |   L4 |   L5 |   L6
------------+------+------+------+------+------+------
EARLY (CC1) |  100 |  100 |    0 |    0 |    0 |    0
MID (CC2)   |  100 |  100 |   95 |    0 |    5 |    0
LATE (CC3)  |  100 |  100 |  100 |  100 |  100 |  100

DEFENSE — RUSSIAN GROUND FORCES permanent layer vs US ARMY assault ladder (hold%)
STAGE       |   L1 |   L2 |   L3 |   L4 |   L5 |   L6
------------+------+------+------+------+------+------
EARLY (CC1) |  100 |  100 |    0 |    0 |    0 |    0
MID (CC2)   |  100 |  100 |  100 |  100 |   95 |    0
LATE (CC3)  |  100 |  100 |  100 |  100 |  100 |  100

DEFENSE — RUSSIAN GROUND FORCES permanent layer vs US ARMY assault ladder (hold%) — HOLDFAST standing orders
STAGE       |   L1 |   L2 |   L3 |   L4 |   L5 |   L6
------------+------+------+------+------+------+------
EARLY (CC1) |  100 |  100 |    0 |    0 |    0 |    0
MID (CC2)   |  100 |  100 |  100 |  100 |  100 |  100
LATE (CC3)  |  100 |  100 |  100 |  100 |  100 |  100

DEFENSE — RUSSIAN GROUND FORCES permanent layer vs US ARMY assault ladder (hold%) — WITH AA COVER
STAGE       |   L1 |   L2 |   L3 |   L4 |   L5 |   L6
------------+------+------+------+------+------+------
EARLY (CC1) |  100 |  100 |    0 |    0 |    0 |    0
MID (CC2)   |  100 |  100 |  100 |  100 |  100 |   80
LATE (CC3)  |  100 |  100 |  100 |  100 |  100 |  100

DEFENSE — RUSSIAN GROUND FORCES permanent layer vs US ARMY assault ladder (hold%) — FORTIFY doctrine
STAGE       |   L1 |   L2 |   L3 |   L4 |   L5 |   L6
------------+------+------+------+------+------+------
EARLY (CC1) |  100 |  100 |    0 |    0 |    0 |    0
MID (CC2)   |  100 |  100 |  100 |  100 |  100 |   15
LATE (CC3)  |  100 |  100 |  100 |  100 |  100 |  100

DEFENSE — KOREAN PEOPLE'S ARMY permanent layer vs US ARMY assault ladder (hold%)
STAGE       |   L1 |   L2 |   L3 |   L4 |   L5 |   L6
------------+------+------+------+------+------+------
EARLY (CC1) |  100 |   85 |    0 |    0 |    0 |    0
MID (CC2)   |  100 |  100 |   85 |    0 |    0 |    0
LATE (CC3)  |  100 |  100 |  100 |  100 |  100 |   85

DEFENSE — KOREAN PEOPLE'S ARMY permanent layer vs US ARMY assault ladder (hold%) — HOLDFAST standing orders
STAGE       |   L1 |   L2 |   L3 |   L4 |   L5 |   L6
------------+------+------+------+------+------+------
EARLY (CC1) |  100 |  100 |    0 |    0 |    0 |    0
MID (CC2)   |  100 |  100 |  100 |   75 |   20 |    0
LATE (CC3)  |  100 |  100 |  100 |  100 |  100 |  100

DEFENSE — KOREAN PEOPLE'S ARMY permanent layer vs US ARMY assault ladder (hold%) — WITH AA COVER
STAGE       |   L1 |   L2 |   L3 |   L4 |   L5 |   L6
------------+------+------+------+------+------+------
EARLY (CC1) |  100 |  100 |    0 |    0 |    0 |    0
MID (CC2)   |  100 |  100 |  100 |   95 |   95 |   20
LATE (CC3)  |  100 |  100 |  100 |  100 |  100 |  100

DEFENSE — KOREAN PEOPLE'S ARMY permanent layer vs US ARMY assault ladder (hold%) — COUNTERBATTERY standing orders
STAGE       |   L1 |   L2 |   L3 |   L4 |   L5 |   L6
------------+------+------+------+------+------+------
EARLY (CC1) |  100 |  100 |    0 |    0 |    0 |    0
MID (CC2)   |  100 |  100 |   90 |    0 |    0 |    0
LATE (CC3)  |  100 |  100 |  100 |  100 |  100 |   95

DEFENSE — KOREAN PEOPLE'S ARMY permanent layer vs US ARMY assault ladder (hold%) — TRIPWIRE standing orders
STAGE       |   L1 |   L2 |   L3 |   L4 |   L5 |   L6
------------+------+------+------+------+------+------
EARLY (CC1) |  100 |  100 |    0 |    0 |    0 |    0
MID (CC2)   |  100 |  100 |   85 |    0 |    0 |    0
LATE (CC3)  |  100 |  100 |  100 |  100 |  100 |  100

DEFENSE — KOREAN PEOPLE'S ARMY permanent layer vs US ARMY assault ladder (hold%) — FORTIFY doctrine
STAGE       |   L1 |   L2 |   L3 |   L4 |   L5 |   L6
------------+------+------+------+------+------+------
EARLY (CC1) |  100 |  100 |    0 |    0 |    0 |    0
MID (CC2)   |  100 |  100 |   85 |    0 |    0 |    0
LATE (CC3)  |  100 |  100 |  100 |  100 |  100 |   90

DEFENSE — UN COALITION permanent layer vs PLA assault ladder (hold%)
STAGE       |   L1 |   L2 |   L3 |   L4 |   L5 |   L6
------------+------+------+------+------+------+------
EARLY (CC1) |  100 |  100 |    0 |    0 |    0 |    0
MID (CC2)   |  100 |  100 |   95 |    0 |    0 |    0
LATE (CC3)  |  100 |  100 |  100 |  100 |  100 |   80

DEFENSE — UN COALITION permanent layer vs PLA assault ladder (hold%) — HOLDFAST standing orders
STAGE       |   L1 |   L2 |   L3 |   L4 |   L5 |   L6
------------+------+------+------+------+------+------
EARLY (CC1) |  100 |  100 |    0 |    0 |    0 |    0
MID (CC2)   |  100 |  100 |  100 |  100 |   90 |    0
LATE (CC3)  |  100 |  100 |  100 |  100 |  100 |  100

DEFENSE — UN COALITION permanent layer vs PLA assault ladder (hold%) — WITH AA COVER
STAGE       |   L1 |   L2 |   L3 |   L4 |   L5 |   L6
------------+------+------+------+------+------+------
EARLY (CC1) |  100 |  100 |    0 |    0 |    0 |    0
MID (CC2)   |  100 |  100 |  100 |   95 |  100 |   50
LATE (CC3)  |  100 |  100 |  100 |  100 |  100 |   95

DEFENSE — UN COALITION permanent layer vs PLA assault ladder (hold%) — Engineer Corps HQ on the line
STAGE       |   L1 |   L2 |   L3 |   L4 |   L5 |   L6
------------+------+------+------+------+------+------
EARLY (CC1) |  100 |  100 |    0 |    0 |    0 |    0
MID (CC2)   |  100 |  100 |   95 |    0 |    0 |    0
LATE (CC3)  |  100 |  100 |  100 |  100 |  100 |   80

DEFENSE — UN COALITION permanent layer vs PLA assault ladder (hold%) — FORTIFY doctrine
STAGE       |   L1 |   L2 |   L3 |   L4 |   L5 |   L6
------------+------+------+------+------+------+------
EARLY (CC1) |  100 |  100 |    0 |    0 |    0 |    0
MID (CC2)   |  100 |  100 |  100 |   10 |    5 |    0
LATE (CC3)  |  100 |  100 |  100 |  100 |  100 |  100
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
  can see; the Engineer Revetment (CP layer, 15 hp/s over 3 cells) is the live-play
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
