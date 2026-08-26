# Balance snapshot (v1.34.0)

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

```
RAID — UNITED STATES strike force (27 MP) vs PLA Front Line
TIER | CLEAR% | DESTR% | MP LOST%
-----+--------+--------+---------
   1 |    100 |     48 |        7
   2 |    100 |     50 |       11
   3 |    100 |     61 |       11
   4 |    100 |     56 |       33
   5 |     30 |     46 |       85

RAID — UNITED STATES strike force (27 MP) vs PLA Front Line — STRIKE doctrine + fire plan
TIER | CLEAR% | DESTR% | MP LOST%
-----+--------+--------+---------
   1 |    100 |     47 |        7
   2 |    100 |     48 |       11
   3 |    100 |     60 |       11
   4 |    100 |     56 |       29
   5 |     33 |     49 |       79

RAID — UNITED STATES strike force (27 MP) vs PLA Front Line — AIR RAID (rotors + a ground tail)
TIER | CLEAR% | DESTR% | MP LOST%
-----+--------+--------+---------
   1 |    100 |     70 |       21
   2 |     73 |     45 |       51
   3 |     97 |     65 |       52
   4 |     88 |     50 |       60
   5 |     38 |     31 |       74

RAID — PLA EXPEDITIONARY FORCE strike force (26 MP) vs US ARMY Front Line
TIER | CLEAR% | DESTR% | MP LOST%
-----+--------+--------+---------
   1 |    100 |     85 |       19
   2 |    100 |     75 |       36
   3 |    100 |     67 |       35
   4 |     82 |     62 |       45
   5 |     97 |     58 |       57

RAID — PLA EXPEDITIONARY FORCE strike force (26 MP) vs US ARMY Front Line — STRIKE doctrine + fire plan
TIER | CLEAR% | DESTR% | MP LOST%
-----+--------+--------+---------
   1 |    100 |     85 |       19
   2 |    100 |     76 |       34
   3 |    100 |     69 |       30
   4 |    100 |     69 |       27
   5 |    100 |     60 |       49

RAID — PLA EXPEDITIONARY FORCE strike force (26 MP) vs US ARMY Front Line — AIR RAID (rotors + a ground tail)
TIER | CLEAR% | DESTR% | MP LOST%
-----+--------+--------+---------
   1 |    100 |     66 |       13
   2 |     72 |     42 |       52
   3 |    100 |     61 |       43
   4 |     83 |     54 |       57
   5 |     43 |     38 |       71

RAID — RUSSIAN GROUND FORCES strike force (27 MP) vs US ARMY Front Line
TIER | CLEAR% | DESTR% | MP LOST%
-----+--------+--------+---------
   1 |    100 |     49 |        0
   2 |    100 |     69 |       26
   3 |    100 |     55 |        8
   4 |     95 |     56 |       56
   5 |     47 |     39 |       81

RAID — RUSSIAN GROUND FORCES strike force (27 MP) vs US ARMY Front Line — STRIKE doctrine + fire plan
TIER | CLEAR% | DESTR% | MP LOST%
-----+--------+--------+---------
   1 |    100 |     49 |        0
   2 |    100 |     65 |       11
   3 |    100 |     55 |        4
   4 |    100 |     56 |       24
   5 |     67 |     47 |       62

RAID — RUSSIAN GROUND FORCES strike force (27 MP) vs US ARMY Front Line — AIR RAID (rotors + a ground tail)
TIER | CLEAR% | DESTR% | MP LOST%
-----+--------+--------+---------
   1 |    100 |     70 |       16
   2 |     75 |     44 |       47
   3 |     97 |     65 |       56
   4 |     73 |     51 |       66
   5 |     33 |     34 |       74

RAID — KOREAN PEOPLE'S ARMY strike force (26 MP) vs US ARMY Front Line
TIER | CLEAR% | DESTR% | MP LOST%
-----+--------+--------+---------
   1 |     97 |     54 |       32
   2 |     88 |     64 |       55
   3 |     97 |     58 |       43
   4 |     40 |     47 |       90
   5 |     17 |     24 |       93

RAID — KOREAN PEOPLE'S ARMY strike force (26 MP) vs US ARMY Front Line — hunt + raze squads TUNNELED
TIER | CLEAR% | DESTR% | MP LOST%
-----+--------+--------+---------
   1 |     95 |     54 |       39
   2 |     93 |     63 |       49
   3 |     92 |     57 |       44
   4 |     73 |     57 |       70
   5 |     28 |     37 |       90

RAID — KOREAN PEOPLE'S ARMY strike force (26 MP) vs US ARMY Front Line — TUNNELED + STRIKE doctrine + fire plan
TIER | CLEAR% | DESTR% | MP LOST%
-----+--------+--------+---------
   1 |    100 |     55 |       28
   2 |     95 |     64 |       43
   3 |    100 |     59 |       35
   4 |     87 |     62 |       59
   5 |     43 |     44 |       84

RAID — KOREAN PEOPLE'S ARMY strike force (26 MP) vs US ARMY Front Line — STRIKE doctrine + fire plan
TIER | CLEAR% | DESTR% | MP LOST%
-----+--------+--------+---------
   1 |     97 |     54 |       32
   2 |     95 |     64 |       51
   3 |     98 |     58 |       38
   4 |     63 |     55 |       76
   5 |     23 |     28 |       91

RAID — KOREAN PEOPLE'S ARMY strike force (26 MP) vs US ARMY Front Line — AIR RAID (rotors + a ground tail)
TIER | CLEAR% | DESTR% | MP LOST%
-----+--------+--------+---------
   1 |    100 |     62 |        8
   2 |     73 |     47 |       46
   3 |     90 |     53 |       52
   4 |     30 |     46 |       87
   5 |     37 |     34 |       83

RAID — UN COALITION strike force (27 MP) vs PLA Front Line
TIER | CLEAR% | DESTR% | MP LOST%
-----+--------+--------+---------
   1 |    100 |     75 |        0
   2 |    100 |     81 |        9
   3 |    100 |     74 |       23
   4 |     92 |     66 |       39
   5 |     32 |     40 |       87

RAID — UN COALITION strike force (27 MP) vs PLA Front Line — CONTROL: medics replaced by riflemen
TIER | CLEAR% | DESTR% | MP LOST%
-----+--------+--------+---------
   1 |    100 |     75 |       51
   2 |    100 |     72 |       61
   3 |     70 |     57 |       78
   4 |      0 |     30 |      100
   5 |      5 |     24 |      100

RAID — UN COALITION strike force (27 MP) vs PLA Front Line — STRIKE doctrine + fire plan
TIER | CLEAR% | DESTR% | MP LOST%
-----+--------+--------+---------
   1 |    100 |     75 |        0
   2 |    100 |     80 |        1
   3 |    100 |     75 |       14
   4 |    100 |     66 |       23
   5 |     70 |     62 |       64

RAID — UN COALITION strike force (27 MP) vs PLA Front Line — AIR RAID (rotors + a ground tail)
TIER | CLEAR% | DESTR% | MP LOST%
-----+--------+--------+---------
   1 |    100 |     72 |       17
   2 |     85 |     51 |       43
   3 |    100 |     65 |       49
   4 |    100 |     49 |       52
   5 |     38 |     33 |       71

ARCHETYPES — UNITED STATES strike force (27 MP), clear% by tier
SHAPE        | FROM |   T1 |   T2 |   T3 |   T4 |   T5 |  MEAN | DESTR% | MP LOST%
-------------+------+------+------+------+------+------+-------+--------+---------
COMPOUND     |    1 |  100 |  100 |  100 |  100 |  100 | 100.0 |     56 |       22
OPEN CAMP    |    1 |  100 |  100 |   98 |   97 |  100 |  99.0 |     58 |       25
CORRIDOR     |    1 |  100 |  100 |  100 |  100 |   72 |  94.4 |     61 |       32
STAR FORT    |    2 |  100 |  100 |   85 |   67 |   33 |  77.0 |     43 |       37
  └ prepared |      |  100 |  100 |   95 |   68 |   33 |  79.2 |     44 |       33
DISPERSED DEPOT |    3 |  100 |  100 |  100 |  100 |   67 |  93.4 |     50 |       21
  └ prepared |      |  100 |  100 |  100 |  100 |   80 |  96.0 |     49 |       16
STRONGPOINTS |    3 |  100 |  100 |  100 |  100 |   73 |  94.6 |     60 |       25
KEEP         |    4 |  100 |  100 |  100 |   53 |   45 |  79.6 |     42 |       32
BUNKER COMPLEX |    5 |  100 |  100 |   18 |   57 |   33 |  61.6 |     57 |       53
  └ prepared |      |  100 |  100 |   35 |   78 |   35 |  69.6 |     60 |       47

FIELD CONDITIONS — UNITED STATES strike force (27 MP), clear% by tier
CONDITION    |   T1 |   T2 |   T3 |   T4 |   T5 |  MEAN | vs CLEAR
-------------+------+------+------+------+------+-------+---------
CLEAR LINE   |  100 |  100 |  100 |  100 |   30 |  86.0 |     +0.0
HARD RAIN    |  100 |  100 |  100 |  100 |   33 |  86.6 |     +0.6
DUG IN       |  100 |  100 |  100 |  100 |   20 |  84.0 |     -2.0
FUEL CRISIS  |  100 |  100 |  100 |  100 |    7 |  81.4 |     -4.6
BLACKOUT     |  100 |  100 |  100 |  100 |   30 |  86.0 |     +0.0
ATTRITION    |  100 |  100 |   90 |  100 |   20 |  82.0 |     -4.0

TERRAIN — the UNITED STATES reference force vs PLA posts, flat ground vs real
GROUND      |    T1 |    T2 |    T3 |    T4 |    T5 |  MEAN | MP LOST%
------------+-------+-------+-------+-------+-------+-------+---------
       FLAT |   100 |   100 |    98 |    72 |    43 |  82.6 |       38
     GROUND |   100 |   100 |    85 |    65 |    53 |  80.6 |       39
    SHEET 1 |   100 |   100 |    65 |    40 |    45 |  70.0 |       47
    SHEET 2 |   100 |   100 |    90 |    60 |    55 |  81.0 |       43
    SHEET 3 |   100 |   100 |   100 |    95 |    60 |  91.0 |       28

PARITY — every faction at its own best line, same manpower, same ladder
FACTION     |    T1 |    T2 |    T3 |    T4 |    T5 |  MEAN | MP LOST% | LINE
------------+-------+-------+-------+-------+-------+-------+----------+------
UNITED STAT |   100 |   100 |    85 |    65 |    53 |  80.6 |       39 | GROUND
PLA EXPEDIT |   100 |    98 |    82 |    60 |    53 |  78.6 |       50 | GROUND
RUSSIAN GRO |   100 |    98 |    80 |    78 |    57 |  82.6 |       43 | GROUND
KOREAN PEOP |    98 |    93 |    88 |    53 |    60 |  78.4 |       59 | TUNNEL
UN COALITIO |   100 |    97 |    83 |    77 |    52 |  81.8 |       39 | GROUND

SPREAD — 4.2 points between RUSSIA and NK. Five kits differing in STYLE (GDD §4) should not differ this much in ODDS.

THE DEAL — the three targets a rung offers vs the eight it could offer
SHAPE        |    T1 |    T2 |    T3 |    T4 |    T5 |  MEAN
-------------+-------+-------+-------+-------+-------+-------
keep         |    95 |    95 |    88 |    35 |    15 |  65.3
bunker       |   100 |    95 |    48 |    51 |    41 |  66.9
star         |    96 |    99 |    87 |    53 |    24 |  71.7
strongpoints |   100 |    95 |    96 |    80 |    43 |  82.7
corridor     |    97 |    97 |    88 |    81 |    55 |  83.7
depot        |   100 |    99 |   100 |    95 |    71 |  92.8
compound     |   100 |   100 |    97 |    79 |    88 |  92.8
camp         |   100 |   100 |    96 |    92 |    89 |  95.5

WHAT EACH FACTION IS DEALT — its three targets vs its own pool at that rung
FACTION |          T1 |          T2 |          T3 |          T4 |          T5 |   MEAN GAP
--------+-------------+-------------+-------------+-------------+-------------+-----------
    USA |  100/100 +0 |  100/100 +0 |   100/98 +2 |   71/87 -16 |   47/67 -20 |       -6.7
  CHINA |  100/100 +0 |  100/100 +0 |   100/94 +6 |    67/71 -5 |    76/75 +1 |       +0.3
 RUSSIA |  100/100 +0 |  100/100 +0 |    93/97 -3 |    60/68 -8 |   80/48 +32 |       +4.1
     NK |    96/96 +0 |    96/97 -1 |    89/91 -2 |    62/67 -4 |    42/39 +3 |       -0.9
     UN |  100/100 +0 |    98/98 -1 |    82/90 -8 |   62/75 -13 |    40/37 +3 |       -3.6

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

THE LADDER, pool mean per rung: T1 99  ->  T2 99  ->  T3 94  ->  T4 74  ->  T5 53
STEP SIZE: T1->T2 -0  T2->T3 -5  T3->T4 -20  T4->T5 -20 — POOL mean, at a fixed reference force.
  This is the whole pool, not the deal, and the force is a mature army: the early
  rungs saturate near 100 and no step between them can show. It is here to price
  the SHAPES, not to judge the ladder — `--rungs` does that, by asking how much
  force each rung demands rather than what one army does to all of them.

THE TWO KITS — every force against both sets of fortifications
FORCE   | vs PLA post | vs US firebase |   GAP | normally raids
--------+-------------+----------------+-------+---------------
    USA |        81.8 |           91.1 |  -9.4 | CHINA
  CHINA |        75.5 |           85.9 | -10.4 | USA
 RUSSIA |        82.8 |           78.6 |  +4.2 | USA
     NK |        27.6 |           68.8 | -41.1 | USA
     UN |        75.0 |           80.2 |  -5.2 | CHINA

WORST GAP 41.1 points. Two fronts differing in STYLE should not differ this much in DIFFICULTY — whoever raids the softer one is playing on easy and did not choose to.

THE PLAN, NOT THE FACTION — the same roster asked twice
FACTION | REF MP | REFERENCE | RECIPE MP | RECIPE |  BEST | PLAN IS WORTH
--------+--------+-----------+-----------+--------+-------+--------------
    USA |     27 |      85.4 |        26 |   66.7 |  85.4 |         -18.8
  CHINA |     26 |      88.8 |        25 |   77.1 |  88.8 |         -11.7
 RUSSIA |     27 |      82.9 |        27 |   72.1 |  82.9 |         -10.8
     NK |     26 |      77.9 |        26 |   77.9 |  77.9 |          +0.0
     UN |     27 |      80.0 |        24 |   58.3 |  80.0 |         -21.7

PLAN IS WORTH UP TO 21.7 POINTS — comparable to every effect this harness measures. Read BEST as the faction and the last column as the error bar; a single plan's row is not a reading of a kit.
BEST-PLAN SPREAD 10.8 points. `--kits` is unaffected: it holds the force fixed and swaps only the fortifications.

WHAT KILLS A COMMAND POST — the heavy's damage type, which was picked for flavour
FACTION | HEAVY FIRES | vs STRUCT | SHIPPING | ALL EXPLOSIVE | ALL KINETIC | SWING
--------+-------------+-----------+----------+---------------+-------------+------
    USA |   explosive |        x1 |     81.8 |          81.8 |        64.6 | +17.2
  CHINA |   explosive |        x1 |     85.9 |          85.9 |        39.1 | +46.9
 RUSSIA |     kinetic |      x0.5 |     78.6 |          78.6 |        78.6 |  +0.0
     NK |     kinetic |      x0.5 |     75.0 |          75.0 |        75.0 |  +0.0
     UN |     kinetic |      x0.5 |     75.0 |          75.0 |        75.0 |  +0.0

ONE FLAG ON ONE UNIT IS WORTH UP TO 46.9 POINTS. Ranged fire is discounted against structures (smallArms 0.15, kinetic 0.5, explosive 1.0); melee ignores the table but
  only fires when adjacent, which in practice only the heavy manages — it lands 60-84% of the killing blows. Normalising the flag does NOT lift the UN off the floor.

WHO CARRIES A RAID — each unit kind silenced in turn, both damage channels
FACTION | CARRY UNIT   | ITS MP | RAID IS | DEAD WEIGHT (MP delivering nothing)
--------+--------------+--------+---------+------------------------------------
    USA |       abrams |     24 |     99% |                          0 of 27 MP
  CHINA |       type99 |     21 |    100% |                          5 of 26 MP
 RUSSIA |          btr |     27 |    100% |                          0 of 27 MP
     NK |     tunneler |     18 |     13% |                          0 of 26 MP
     UN |          vab |     27 |    100% |                          0 of 27 MP

ONE UNIT IS UP TO 100% OF A RAID. Ending a raid means killing the command post; ranged fire is discounted hard against structures and melee only fires when ADJACENT,
  so the heavy is the only unit that reliably survives to get there and hits hard when it does. Everything else is escort — and a buff to an escort buys nothing.

WHAT THE SEED DECIDES — the same matchup fought 12 times (25% of fire does not tell)
FORCE   | MATCHUPS | DECIDED     | SAME MEN HOME | LENGTH | CLEAR
--------+----------+-------------+---------------+--------+------
    USA |       40 |    37 (93%) |      25 (63%) |    437 |  83.3
  CHINA |       40 |    31 (78%) |      21 (53%) |    969 |  86.9
 RUSSIA |       40 |    38 (95%) |      10 (25%) |    390 |  89.4
     NK |       40 |    17 (43%) |        0 (0%) |   1906 |  79.6
     UN |       40 |    32 (80%) |      12 (30%) |    540 |  81.9
--------+----------+-------------+---------------+--------+------
    ALL |      200 |   155 (78%) |      68 (34%) |    848 |  84.2

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
ARMOUR |  ASSAULT |      86.1 |       47.2 |        15.3
ARMOUR |     HUNT |      79.2 |       79.2 |        45.8
ARMOUR |     RAZE |      77.8 |       51.4 |        65.3
  FOOT |  ASSAULT |      41.7 |       23.6 |         9.7
  FOOT |     HUNT |      36.1 |       37.5 |        29.2
  FOOT |     RAZE |      36.1 |       19.4 |        48.6
 MIXED |  ASSAULT |      87.5 |       47.2 |        19.4
 MIXED |     HUNT |      79.2 |       81.9 |        43.1
 MIXED |     RAZE |      75.0 |       51.4 |        68.1
       best: POST MIXED/ASSAULT  ·  GUNS MIXED/HUNT  ·  STORES MIXED/RAZE
-------+----------+-----------+------------+------------
CHINA
ARMOUR |  ASSAULT |      90.3 |       48.6 |        22.2
ARMOUR |     HUNT |      90.3 |       83.3 |        48.6
ARMOUR |     RAZE |      93.1 |       52.8 |        76.4
  FOOT |  ASSAULT |      13.9 |        0.0 |         0.0
  FOOT |     HUNT |       4.2 |       22.2 |         0.0
  FOOT |     RAZE |       0.0 |        0.0 |        16.7
 MIXED |  ASSAULT |      86.1 |       43.1 |        12.5
 MIXED |     HUNT |      90.3 |       87.5 |        45.8
 MIXED |     RAZE |      86.1 |       56.9 |        88.9
       best: POST ARMOUR/RAZE  ·  GUNS MIXED/HUNT  ·  STORES MIXED/RAZE
-------+----------+-----------+------------+------------
RUSSIA
ARMOUR |  ASSAULT |      68.1 |       33.3 |        18.1
ARMOUR |     HUNT |      69.4 |       62.5 |        38.9
ARMOUR |     RAZE |      76.4 |       37.5 |        66.7
  FOOT |  ASSAULT |      59.7 |       38.9 |        22.2
  FOOT |     HUNT |      58.3 |       61.1 |        40.3
  FOOT |     RAZE |      50.0 |       44.4 |        55.6
 MIXED |  ASSAULT |      95.8 |       55.6 |        22.2
 MIXED |     HUNT |      91.7 |       87.5 |        45.8
 MIXED |     RAZE |      80.6 |       51.4 |        91.7
       best: POST MIXED/ASSAULT  ·  GUNS MIXED/HUNT  ·  STORES MIXED/RAZE
-------+----------+-----------+------------+------------
NK
ARMOUR |  ASSAULT |      36.1 |       13.9 |        20.8
ARMOUR |     HUNT |      52.8 |       65.3 |        25.0
ARMOUR |     RAZE |      33.3 |       12.5 |        56.9
  FOOT |  ASSAULT |      18.1 |        0.0 |         0.0
  FOOT |     HUNT |      76.4 |       88.9 |         0.0
  FOOT |     RAZE |       5.6 |        0.0 |        88.9
 MIXED |  ASSAULT |      20.8 |        0.0 |         0.0
 MIXED |     HUNT |      83.3 |       91.7 |         0.0
 MIXED |     RAZE |       2.8 |        0.0 |        88.9
       best: POST MIXED/HUNT  ·  GUNS MIXED/HUNT  ·  STORES FOOT/RAZE
-------+----------+-----------+------------+------------
UN
ARMOUR |  ASSAULT |      58.3 |       38.9 |        22.2
ARMOUR |     HUNT |      52.8 |       68.1 |        34.7
ARMOUR |     RAZE |      48.6 |       31.9 |        43.1
  FOOT |  ASSAULT |      48.6 |       33.3 |        18.1
  FOOT |     HUNT |      29.2 |       43.1 |        33.3
  FOOT |     RAZE |      38.9 |       27.8 |        50.0
 MIXED |  ASSAULT |      83.3 |       51.4 |        29.2
 MIXED |     HUNT |      90.3 |       84.7 |        34.7
 MIXED |     RAZE |      66.7 |       61.1 |        87.5
       best: POST MIXED/HUNT  ·  GUNS MIXED/HUNT  ·  STORES MIXED/RAZE
-------+----------+-----------+------------+------------

DISTINCT WINNERS 13 of 15. One force topping every column would mean the objective is a label on the same raid; a different force per column is the whole argument for letting a raid declare what it came for.

GARRISON — the UNITED STATES reference force vs PLA posts
CONFIG      |    T1 |    T2 |    T3 |    T4 |    T5 |  MEAN | MP LOST%
------------+-------+-------+-------+-------+-------+-------+---------
    v1.19 W |   100 |   100 |    67 |    38 |    13 |  63.6 |       49
    v1.19 — |   100 |   100 |    85 |    78 |    50 |  82.6 |       39
 GUNS 0.8 W |   100 |   100 |    88 |    75 |    68 |  86.2 |       37
 GUNS 0.8 — |   100 |   100 |   100 |   100 |    67 |  93.4 |       30
    WATCH W |   100 |   100 |    58 |    20 |    12 |  58.0 |       53
    WATCH — |   100 |   100 |    70 |    77 |    48 |  79.0 |       43
  SHIPPED W |   100 |   100 |    85 |    65 |    53 |  80.6 |       39
  SHIPPED — |   100 |   100 |    97 |   100 |    65 |  92.4 |       32

WALL LINE IS WORTH — v1.19 +19.0  |  GUNS 0.8 +7.2  |  WATCH +21.0  |  SHIPPED +11.8  (clear-rate points to the defender)

AIR — the UNITED STATES reference force vs PLA posts, with and without AA
      GROUND reference 27 MP, AIR plan 30 MP, so the edge is read against GROUND =30
FORCE       |    T1 |    T2 |    T3 |    T4 |    T5 |  MEAN | MP LOST%
------------+-------+-------+-------+-------+-------+-------+---------
     GROUND |   100 |   100 |    85 |    65 |    53 |  80.6 |       39
 GROUND =30 |   100 |   100 |    92 |    75 |    65 |  86.4 |       42
 AIR mounts |   100 |   100 |    65 |   100 |    70 |  87.0 |       45
AIR +manpads |   100 |    80 |    48 |    88 |    30 |  69.2 |       55

AIR'S EDGE OVER MATCHED GROUND — vs mounts +0.6  |  vs mounts+manpads -17.2  (clear-rate points, both forces at 30 MP)

AIR — the PLA EXPEDITIONARY FORCE reference force vs US ARMY posts, with and without AA
      GROUND reference 26 MP, AIR plan 30 MP, so the edge is read against GROUND =30
FORCE       |    T1 |    T2 |    T3 |    T4 |    T5 |  MEAN | MP LOST%
------------+-------+-------+-------+-------+-------+-------+---------
     GROUND |   100 |    98 |    82 |    60 |    53 |  78.6 |       50
 GROUND =30 |   100 |   100 |    72 |    73 |    83 |  85.6 |       52
 AIR mounts |   100 |    93 |   100 |    58 |    67 |  83.6 |       46
AIR +manpads |   100 |    73 |   100 |    52 |    67 |  78.4 |       48

AIR'S EDGE OVER MATCHED GROUND — vs mounts -2.0  |  vs mounts+manpads -7.2  (clear-rate points, both forces at 30 MP)

AIR — the RUSSIAN GROUND FORCES reference force vs US ARMY posts, with and without AA
      GROUND reference 27 MP, AIR plan 27 MP — already matched, so GROUND =N must repeat GROUND exactly
FORCE       |    T1 |    T2 |    T3 |    T4 |    T5 |  MEAN | MP LOST%
------------+-------+-------+-------+-------+-------+-------+---------
     GROUND |   100 |    98 |    80 |    78 |    57 |  82.6 |       43
 GROUND =27 |   100 |    98 |    80 |    78 |    57 |  82.6 |       43
 AIR mounts |   100 |    80 |    32 |    65 |     5 |  56.4 |       62
AIR +manpads |   100 |    73 |    32 |    37 |     0 |  48.4 |       66

AIR'S EDGE OVER MATCHED GROUND — vs mounts -26.2  |  vs mounts+manpads -34.2  (clear-rate points, both forces at 27 MP)

AIR — the KOREAN PEOPLE'S ARMY reference force vs US ARMY posts, with and without AA
      GROUND reference 26 MP, AIR plan 29 MP, so the edge is read against GROUND =29
FORCE       |    T1 |    T2 |    T3 |    T4 |    T5 |  MEAN | MP LOST%
------------+-------+-------+-------+-------+-------+-------+---------
     GROUND |    97 |    72 |    80 |    48 |    43 |  68.0 |       62
 GROUND =29 |    92 |    87 |    95 |    57 |    55 |  77.2 |       57
 AIR mounts |   100 |    50 |    67 |    35 |    32 |  56.8 |       66
AIR +manpads |   100 |    43 |    38 |    13 |    20 |  42.8 |       72

AIR'S EDGE OVER MATCHED GROUND — vs mounts -20.4  |  vs mounts+manpads -34.4  (clear-rate points, both forces at 29 MP)

AIR — the UN COALITION reference force vs PLA posts, with and without AA
      GROUND reference 27 MP, AIR plan 30 MP, so the edge is read against GROUND =30
FORCE       |    T1 |    T2 |    T3 |    T4 |    T5 |  MEAN | MP LOST%
------------+-------+-------+-------+-------+-------+-------+---------
     GROUND |   100 |    97 |    83 |    77 |    52 |  81.8 |       39
 GROUND =30 |   100 |   100 |    98 |    83 |    88 |  93.8 |       28
 AIR mounts |   100 |    67 |   100 |    70 |    63 |  80.0 |       54
AIR +manpads |   100 |    53 |    97 |    63 |    22 |  67.0 |       62

AIR'S EDGE OVER MATCHED GROUND — vs mounts -13.8  |  vs mounts+manpads -26.8  (clear-rate points, both forces at 30 MP)

WHAT AIR CHARGES — smallest manpower that clears half the time, by plan shape
FACTION     | SHAPE  |    T1 |    T2 |    T3 |    T4 |    T5 |  MEAN
------------+--------+-------+-------+-------+-------+-------+-------
UNITED STAT | GROUND |     6 |    11 |    19 |    27 |    27 |  18.0
            | AIR    |    12 |    12 |    38 |    12 |    38 |  22.4
            | x      |  2.0x |  1.1x |  2.0x |  0.4x |  1.4x |  1.2x
PLA EXPEDIT | GROUND |     9 |    20 |    20 |    24 |    28 |  20.2
            | AIR    |     8 |    12 |    20 |    38 |    24 |  20.4
            | x      |  0.9x |  0.6x |  1.0x |  1.6x |  0.9x |  1.0x
RUSSIAN GRO | GROUND |     6 |     6 |    24 |    27 |    27 |  18.0
            | AIR    |     9 |    16 |    33 |    38 |    45 |  28.2
            | x      |  1.5x |  2.7x |  1.4x |  1.4x |  1.7x |  1.6x
KOREAN PEOP | GROUND |     9 |    16 |    20 |    24 |    28 |  19.4
            | AIR    |     6 |    33 |    33 |    24 |    24 |  24.0
            | x      |  0.7x |  2.1x |  1.6x |  1.0x |  0.9x |  1.2x
UN COALITIO | GROUND |     6 |     9 |    18 |    24 |    27 |  16.8
            | AIR    |    12 |    24 |    20 |    24 |    38 |  23.6
            | x      |  2.0x |  2.7x |  1.1x |  1.0x |  1.4x |  1.4x

  A rung a shape never clears at any budget on the grid reads —, and its mean
  is withheld rather than averaged over the rungs it did reach: a force that
  cannot take the top rung has not earned a better mean for stopping early.

  The AIR row is not monotone and that is not the instrument. See below.

THE SAME TARGETS, FLOWN — clear% at a fixed 24 MP, ground shape vs air shape
FACTION     | RUNG | SHAPE        | GROUND | AIR | AIR MINUS GROUND
------------+------+--------------+--------+-----+-----------------
UNITED STAT |   T1 | compound     |    100 | 100 | +
            |      | camp         |    100 | 100 | +
            |      | corridor     |    100 | 100 | +
            |   T2 | compound     |    100 |  30 | -#######
            |      | camp         |    100 | 100 | +
            |      | star         |    100 | 100 | +
            |   T3 | corridor     |     45 |  50 | +#
            |      | camp         |     60 |   0 | -######
            |      | depot        |    100 |   5 | -##########
            |   T4 | star         |     45 | 100 | +######
            |      | keep         |     35 | 100 | +#######
            |      | strongpoints |     45 |  75 | +###
            |   T5 | bunker       |      0 |  40 | +####
            |      | corridor     |      0 |   0 | +
            |      | star         |      5 |  70 | +#######
            |      | MEAN / SPLIT |     62 |  65 | r=+0.31  30+ easier 5, harder 3

PLA EXPEDIT |   T1 | compound     |    100 | 100 | +
            |      | camp         |    100 | 100 | +
            |      | corridor     |    100 | 100 | +
            |   T2 | compound     |     55 |  20 | -####
            |      | camp         |    100 | 100 | +
            |      | star         |    100 | 100 | +
            |   T3 | star         |     50 | 100 | +#####
            |      | depot        |     95 | 100 | +#
            |      | strongpoints |    100 |  95 | -#
            |   T4 | compound     |    100 |  30 | -#######
            |      | strongpoints |     45 |  10 | -####
            |      | keep         |      5 |  90 | +#########
            |   T5 | compound     |    100 | 100 | +
            |      | strongpoints |      0 |  95 | +##########
            |      | bunker       |     10 |   0 | -#
            |      | MEAN / SPLIT |     71 |  76 | r=+0.40  30+ easier 3, harder 3

RUSSIAN GRO |   T1 | compound     |    100 | 100 | +
            |      | camp         |    100 | 100 | +
            |      | corridor     |    100 | 100 | +
            |   T2 | compound     |     85 |   5 | -########
            |      | camp         |    100 | 100 | +
            |      | star         |    100 | 100 | +
            |   T3 | camp         |     70 |   5 | -#######
            |      | corridor     |     50 |   5 | -#####
            |      | depot        |    100 |  40 | -######
            |   T4 | strongpoints |     30 |  65 | +####
            |      | keep         |      0 |  45 | +#####
            |      | compound     |     65 |   0 | -#######
            |   T5 | camp         |      5 |   0 | -#
            |      | bunker       |      0 |   0 | +
            |      | compound     |     65 |   0 | -#######
            |      | MEAN / SPLIT |     65 |  44 | r=+0.57  30+ easier 2, harder 6

KOREAN PEOP |   T1 | compound     |     90 | 100 | +#
            |      | camp         |    100 | 100 | +
            |      | corridor     |     95 | 100 | +#
            |   T2 | compound     |     95 |   0 | -##########
            |      | corridor     |     95 |  25 | -#######
            |      | star         |     80 | 100 | +##
            |   T3 | depot        |     55 |   0 | -######
            |      | compound     |     90 |  55 | -###
            |      | strongpoints |    100 | 100 | +
            |   T4 | compound     |     60 | 100 | +####
            |      | keep         |     70 | 100 | +###
            |      | camp         |     70 |   5 | -#######
            |   T5 | compound     |     25 | 100 | +########
            |      | corridor     |     55 |  60 | +
            |      | bunker       |     20 |   0 | -##
            |      | MEAN / SPLIT |     73 |  63 | r=+0.23  30+ easier 3, harder 5

UN COALITIO |   T1 | compound     |    100 | 100 | +
            |      | camp         |    100 | 100 | +
            |      | corridor     |    100 | 100 | +
            |   T2 | camp         |     85 |   0 | -#########
            |      | corridor     |     95 |  55 | -####
            |      | star         |    100 | 100 | +
            |   T3 | star         |     30 | 100 | +#######
            |      | compound     |     80 |  75 | -#
            |      | depot        |    100 |   5 | -##########
            |   T4 | compound     |     50 |  95 | +#####
            |      | keep         |     15 |  80 | +#######
            |      | strongpoints |     95 |  10 | -#########
            |   T5 | bunker       |      5 |  60 | +######
            |      | compound     |     20 |   0 | -##
            |      | strongpoints |      0 |  55 | +######
            |      | MEAN / SPLIT |     65 |  62 | r=+0.05  30+ easier 5, harder 4

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
UNITED STAT |   T1 | compound     |        0 |       0 |        100
            |      | camp         |        0 |       0 |        100
            |      | corridor     |        0 |       0 |        100
            |   T2 | compound     |       48 |      95 |         30
            |      | camp         |       48 |      53 |        100
            |      | star         |       48 |      34 |        100
            |   T3 | corridor     |        0 |     131 |         50
            |      | camp         |       48 |     179 |          0
            |      | depot        |       48 |     155 |          5
            |   T4 | star         |       48 |      27 |        100
            |      | keep         |       48 |      47 |        100
            |      | strongpoints |        0 |       0 |         75
            |   T5 | bunker       |       48 |     162 |         40
            |      | corridor     |       48 |     169 |          0
            |      | star         |       48 |     214 |         70

PLA EXPEDIT |   T1 | compound     |        0 |       0 |        100
            |      | camp         |        0 |       0 |        100
            |      | corridor     |        0 |       0 |        100
            |   T2 | compound     |        0 |      60 |         20
            |      | camp         |       47 |      44 |        100
            |      | star         |       47 |      32 |        100
            |   T3 | star         |       47 |      15 |        100
            |      | depot        |        0 |      70 |        100
            |      | strongpoints |        0 |       0 |         95
            |   T4 | compound     |       47 |      64 |         30
            |      | strongpoints |        0 |      41 |         10
            |      | keep         |        0 |       0 |         90
            |   T5 | compound     |       47 |      64 |        100
            |      | strongpoints |        0 |       0 |         95
            |      | bunker       |       47 |     141 |          0

RUSSIAN GRO |   T1 | compound     |        0 |       0 |        100
            |      | camp         |        0 |       0 |        100
            |      | corridor     |        0 |       0 |        100
            |   T2 | compound     |       47 |     144 |          5
            |      | camp         |       47 |      67 |        100
            |      | star         |       47 |      86 |        100
            |   T3 | camp         |       47 |     152 |          5
            |      | corridor     |       47 |     152 |          5
            |      | depot        |       47 |     144 |         40
            |   T4 | strongpoints |        0 |      46 |         65
            |      | keep         |        0 |      93 |         45
            |      | compound     |       47 |     143 |          0
            |   T5 | camp         |       47 |     157 |          0
            |      | bunker       |       47 |     155 |          0
            |      | compound     |       47 |     136 |          0

KOREAN PEOP |   T1 | compound     |        0 |       0 |        100
            |      | camp         |        0 |       0 |        100
            |      | corridor     |        0 |       0 |        100
            |   T2 | compound     |       47 |      91 |          0
            |      | corridor     |       47 |     125 |         25
            |      | star         |       47 |      27 |        100
            |   T3 | depot        |       47 |      53 |          0
            |      | compound     |        0 |       0 |         55
            |      | strongpoints |        0 |       0 |        100
            |   T4 | compound     |       47 |      73 |        100
            |      | keep         |        0 |      30 |        100
            |      | camp         |       47 |     125 |          5
            |   T5 | compound     |       47 |      91 |        100
            |      | corridor     |       47 |     132 |         60
            |      | bunker       |       47 |     122 |          0

UN COALITIO |   T1 | compound     |        0 |       0 |        100
            |      | camp         |        0 |       0 |        100
            |      | corridor     |        0 |       0 |        100
            |   T2 | camp         |       48 |     168 |          0
            |      | corridor     |        0 |     184 |         55
            |      | star         |       48 |      27 |        100
            |   T3 | star         |       48 |      29 |        100
            |      | compound     |       48 |      59 |         75
            |      | depot        |       48 |     122 |          5
            |   T4 | compound     |        0 |      77 |         95
            |      | keep         |        0 |      63 |         80
            |      | strongpoints |        0 |       0 |         10
            |   T5 | bunker       |       48 |     138 |         60
            |      | compound     |       48 |     110 |          0
            |      | strongpoints |        0 |       9 |         55

PREDICTOR                                   |     r |    r^2
--------------------------------------------+-------+-------
OVERHEAD flak DPS over the post             | -0.41 |   0.17
TRANSIT DPS-seconds on the way in           | -0.71 |   0.50
OVERHEAD + TRANSIT                          | -0.68 |   0.46
SHAPE alone (the incumbent, flattered)      | +0.46 |   0.21

  The bar is the last row. A player is told the shape for free, so a read that
  cannot beat predicting from the shape alone has bought nothing — and the shape
  baseline is scored on the very rows it was fitted to, which flatters it.

PER FACTION — a predictor carried by one roster is not a predictor
FACTION     | TRANSIT r | SHAPE r
------------+-----------+--------
UNITED STAT |     -0.78 |   +0.51
PLA EXPEDIT |     -0.66 |   +0.42
RUSSIAN GRO |     -0.90 |   +0.38
KOREAN PEOP |     -0.63 |   +0.60
UN COALITIO |     -0.54 |   +0.42

BANDS — cut at the terciles of transit, then measured
BAND  | TRANSIT       | TARGETS | MEAN AIR CLEAR%
------+---------------+---------+----------------
GOOD  | under 27      |      25 |            91.0
FAIR  | 27 to 95      |      25 |            76.8
POOR  | over 95       |      25 |            18.4

  The bands are the shippable form: a player cannot read DPS-seconds, and three
  words is the whole budget the target list has. The cuts are terciles of the
  measured population rather than round numbers, so they cannot be tuned to
  flatter the result.

VETERANCY — UNITED STATES strike force (27 MP), men returned% by tier
RANK    |  ×   |   T1 |   T2 |   T3 |   T4 |   T5 |  MEAN | CLEAR%
--------+------+------+------+------+------+------+-------+-------
GREEN   | 1.00 |   86 |   75 |   47 |   39 |   16 |  52.6 |     81
LINE    | 1.04 |   86 |   75 |   50 |   48 |   19 |  55.6 |     88
VETERAN | 1.09 |   87 |   75 |   53 |   45 |   23 |  56.6 |     92
CADRE   | 1.15 |   87 |   75 |   61 |   45 |   30 |  59.6 |     93

VETERANCY — PLA EXPEDITIONARY FORCE strike force (26 MP), men returned% by tier
RANK    |  ×   |   T1 |   T2 |   T3 |   T4 |   T5 |  MEAN | CLEAR%
--------+------+------+------+------+------+------+-------+-------
GREEN   | 1.00 |   50 |   49 |   32 |   15 |   11 |  31.4 |     79
LINE    | 1.04 |   50 |   50 |   40 |   17 |   14 |  34.2 |     89
VETERAN | 1.09 |   50 |   50 |   40 |   20 |   23 |  36.6 |     93
CADRE   | 1.15 |   50 |   50 |   44 |   26 |   32 |  40.4 |     96

VETERANCY — RUSSIAN GROUND FORCES strike force (27 MP), men returned% by tier
RANK    |  ×   |   T1 |   T2 |   T3 |   T4 |   T5 |  MEAN | CLEAR%
--------+------+------+------+------+------+------+-------+-------
GREEN   | 1.00 |   99 |   76 |   59 |   32 |   21 |  57.4 |     83
LINE    | 1.04 |  100 |   82 |   72 |   46 |   30 |  66.0 |     92
VETERAN | 1.09 |  100 |   86 |   79 |   52 |   37 |  70.8 |     94
CADRE   | 1.15 |  100 |   90 |   84 |   64 |   51 |  77.8 |     97

VETERANCY — KOREAN PEOPLE'S ARMY strike force (26 MP), men returned% by tier
RANK    |  ×   |   T1 |   T2 |   T3 |   T4 |   T5 |  MEAN | CLEAR%
--------+------+------+------+------+------+------+-------+-------
GREEN   | 1.00 |   63 |   38 |   43 |   15 |   16 |  35.0 |     68
LINE    | 1.04 |   66 |   41 |   48 |   13 |   21 |  37.8 |     73
VETERAN | 1.09 |   70 |   45 |   53 |   16 |   23 |  41.4 |     78
CADRE   | 1.15 |   72 |   50 |   58 |   27 |   28 |  47.0 |     85

VETERANCY — UN COALITION strike force (27 MP), men returned% by tier
RANK    |  ×   |   T1 |   T2 |   T3 |   T4 |   T5 |  MEAN | CLEAR%
--------+------+------+------+------+------+------+-------+-------
GREEN   | 1.00 |  100 |   82 |   61 |   45 |   16 |  60.8 |     82
LINE    | 1.04 |  100 |   85 |   69 |   61 |   25 |  68.0 |     87
VETERAN | 1.09 |  100 |   85 |   72 |   67 |   36 |  72.0 |     93
CADRE   | 1.15 |  100 |   92 |   85 |   79 |   45 |  80.2 |     98

DEFENSE — UNITED STATES permanent layer vs PLA assault ladder (hold%)
STAGE       |   L1 |   L2 |   L3 |   L4 |   L5 |   L6
------------+------+------+------+------+------+------
EARLY (CC1) |  100 |  100 |    0 |    0 |    0 |    0
MID (CC2)   |  100 |  100 |  100 |   95 |   75 |    0
LATE (CC3)  |  100 |  100 |  100 |  100 |  100 |  100

DEFENSE — UNITED STATES permanent layer vs PLA assault ladder (hold%) — HOLDFAST standing orders
STAGE       |   L1 |   L2 |   L3 |   L4 |   L5 |   L6
------------+------+------+------+------+------+------
EARLY (CC1) |  100 |  100 |    0 |    0 |    0 |    0
MID (CC2)   |  100 |  100 |  100 |  100 |  100 |   15
LATE (CC3)  |  100 |  100 |  100 |  100 |  100 |  100

DEFENSE — UNITED STATES permanent layer vs PLA assault ladder (hold%) — WITH AA COVER
STAGE       |   L1 |   L2 |   L3 |   L4 |   L5 |   L6
------------+------+------+------+------+------+------
EARLY (CC1) |  100 |  100 |    0 |    0 |    0 |    0
MID (CC2)   |  100 |  100 |  100 |  100 |  100 |   60
LATE (CC3)  |  100 |  100 |  100 |  100 |  100 |  100

DEFENSE — UNITED STATES permanent layer vs PLA assault ladder (hold%) — FORTIFY doctrine
STAGE       |   L1 |   L2 |   L3 |   L4 |   L5 |   L6
------------+------+------+------+------+------+------
EARLY (CC1) |  100 |  100 |    0 |    0 |    0 |    0
MID (CC2)   |  100 |  100 |  100 |   95 |   80 |    0
LATE (CC3)  |  100 |  100 |  100 |  100 |  100 |  100

DEFENSE — PLA EXPEDITIONARY FORCE permanent layer vs US ARMY assault ladder (hold%)
STAGE       |   L1 |   L2 |   L3 |   L4 |   L5 |   L6
------------+------+------+------+------+------+------
EARLY (CC1) |  100 |  100 |    0 |    0 |    0 |    0
MID (CC2)   |  100 |  100 |   70 |    0 |    0 |    0
LATE (CC3)  |  100 |  100 |  100 |    0 |    0 |    0

DEFENSE — PLA EXPEDITIONARY FORCE permanent layer vs US ARMY assault ladder (hold%) — HOLDFAST standing orders
STAGE       |   L1 |   L2 |   L3 |   L4 |   L5 |   L6
------------+------+------+------+------+------+------
EARLY (CC1) |  100 |  100 |    0 |    0 |    0 |    0
MID (CC2)   |  100 |  100 |  100 |    0 |    0 |    0
LATE (CC3)  |  100 |  100 |  100 |    0 |    5 |    0

DEFENSE — PLA EXPEDITIONARY FORCE permanent layer vs US ARMY assault ladder (hold%) — WITH AA COVER
STAGE       |   L1 |   L2 |   L3 |   L4 |   L5 |   L6
------------+------+------+------+------+------+------
EARLY (CC1) |  100 |  100 |    0 |    0 |    0 |    0
MID (CC2)   |  100 |  100 |  100 |   80 |   20 |    0
LATE (CC3)  |  100 |  100 |  100 |  100 |  100 |  100

DEFENSE — PLA EXPEDITIONARY FORCE permanent layer vs US ARMY assault ladder (hold%) — FORTIFY doctrine
STAGE       |   L1 |   L2 |   L3 |   L4 |   L5 |   L6
------------+------+------+------+------+------+------
EARLY (CC1) |  100 |  100 |    0 |    0 |    0 |    0
MID (CC2)   |  100 |  100 |   95 |    0 |    0 |    0
LATE (CC3)  |  100 |  100 |  100 |    0 |    0 |    0

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
MID (CC2)   |  100 |  100 |  100 |  100 |   95 |   20
LATE (CC3)  |  100 |  100 |  100 |  100 |  100 |  100

DEFENSE — RUSSIAN GROUND FORCES permanent layer vs US ARMY assault ladder (hold%) — WITH AA COVER
STAGE       |   L1 |   L2 |   L3 |   L4 |   L5 |   L6
------------+------+------+------+------+------+------
EARLY (CC1) |  100 |  100 |    0 |    0 |    0 |    0
MID (CC2)   |  100 |  100 |  100 |  100 |   95 |    0
LATE (CC3)  |  100 |  100 |  100 |  100 |  100 |  100

DEFENSE — RUSSIAN GROUND FORCES permanent layer vs US ARMY assault ladder (hold%) — FORTIFY doctrine
STAGE       |   L1 |   L2 |   L3 |   L4 |   L5 |   L6
------------+------+------+------+------+------+------
EARLY (CC1) |  100 |  100 |    0 |    0 |    0 |    0
MID (CC2)   |  100 |  100 |  100 |  100 |   90 |    0
LATE (CC3)  |  100 |  100 |  100 |  100 |  100 |  100

DEFENSE — KOREAN PEOPLE'S ARMY permanent layer vs US ARMY assault ladder (hold%)
STAGE       |   L1 |   L2 |   L3 |   L4 |   L5 |   L6
------------+------+------+------+------+------+------
EARLY (CC1) |  100 |  100 |    0 |    0 |    0 |    0
MID (CC2)   |  100 |  100 |   60 |    0 |    0 |    0
LATE (CC3)  |  100 |  100 |  100 |    0 |    0 |    0

DEFENSE — KOREAN PEOPLE'S ARMY permanent layer vs US ARMY assault ladder (hold%) — HOLDFAST standing orders
STAGE       |   L1 |   L2 |   L3 |   L4 |   L5 |   L6
------------+------+------+------+------+------+------
EARLY (CC1) |  100 |  100 |    0 |    0 |    0 |    0
MID (CC2)   |  100 |  100 |  100 |    0 |    0 |    0
LATE (CC3)  |  100 |  100 |  100 |    0 |    0 |    0

DEFENSE — KOREAN PEOPLE'S ARMY permanent layer vs US ARMY assault ladder (hold%) — WITH AA COVER
STAGE       |   L1 |   L2 |   L3 |   L4 |   L5 |   L6
------------+------+------+------+------+------+------
EARLY (CC1) |  100 |  100 |    0 |    0 |    0 |    0
MID (CC2)   |  100 |  100 |   85 |    0 |    0 |    0
LATE (CC3)  |  100 |  100 |  100 |   15 |    0 |    0

DEFENSE — KOREAN PEOPLE'S ARMY permanent layer vs US ARMY assault ladder (hold%) — COUNTERBATTERY standing orders
STAGE       |   L1 |   L2 |   L3 |   L4 |   L5 |   L6
------------+------+------+------+------+------+------
EARLY (CC1) |  100 |   95 |    0 |    0 |    0 |    0
MID (CC2)   |  100 |  100 |   45 |    0 |    0 |    0
LATE (CC3)  |  100 |  100 |  100 |    0 |    0 |    0

DEFENSE — KOREAN PEOPLE'S ARMY permanent layer vs US ARMY assault ladder (hold%) — TRIPWIRE standing orders
STAGE       |   L1 |   L2 |   L3 |   L4 |   L5 |   L6
------------+------+------+------+------+------+------
EARLY (CC1) |  100 |  100 |    0 |    0 |    0 |    0
MID (CC2)   |  100 |  100 |   45 |    0 |    0 |    0
LATE (CC3)  |  100 |  100 |  100 |    0 |    0 |    0

DEFENSE — KOREAN PEOPLE'S ARMY permanent layer vs US ARMY assault ladder (hold%) — FORTIFY doctrine
STAGE       |   L1 |   L2 |   L3 |   L4 |   L5 |   L6
------------+------+------+------+------+------+------
EARLY (CC1) |  100 |  100 |    0 |    0 |    0 |    0
MID (CC2)   |  100 |  100 |   85 |    0 |    0 |    0
LATE (CC3)  |  100 |  100 |  100 |    0 |    5 |    0

DEFENSE — UN COALITION permanent layer vs PLA assault ladder (hold%)
STAGE       |   L1 |   L2 |   L3 |   L4 |   L5 |   L6
------------+------+------+------+------+------+------
EARLY (CC1) |  100 |  100 |    0 |    0 |    0 |    0
MID (CC2)   |  100 |  100 |   90 |    0 |    0 |    0
LATE (CC3)  |  100 |  100 |  100 |    0 |    0 |    0

DEFENSE — UN COALITION permanent layer vs PLA assault ladder (hold%) — HOLDFAST standing orders
STAGE       |   L1 |   L2 |   L3 |   L4 |   L5 |   L6
------------+------+------+------+------+------+------
EARLY (CC1) |  100 |  100 |    0 |    0 |    0 |    0
MID (CC2)   |  100 |  100 |  100 |    0 |    0 |    0
LATE (CC3)  |  100 |  100 |  100 |    0 |    0 |    0

DEFENSE — UN COALITION permanent layer vs PLA assault ladder (hold%) — WITH AA COVER
STAGE       |   L1 |   L2 |   L3 |   L4 |   L5 |   L6
------------+------+------+------+------+------+------
EARLY (CC1) |  100 |  100 |    0 |    0 |    0 |    0
MID (CC2)   |  100 |  100 |  100 |   90 |    5 |    0
LATE (CC3)  |  100 |  100 |  100 |  100 |  100 |  100

DEFENSE — UN COALITION permanent layer vs PLA assault ladder (hold%) — Engineer Corps HQ on the line
STAGE       |   L1 |   L2 |   L3 |   L4 |   L5 |   L6
------------+------+------+------+------+------+------
EARLY (CC1) |  100 |  100 |    0 |    0 |    0 |    0
MID (CC2)   |  100 |  100 |  100 |    0 |    0 |    0
LATE (CC3)  |  100 |  100 |  100 |    0 |    0 |    0

DEFENSE — UN COALITION permanent layer vs PLA assault ladder (hold%) — FORTIFY doctrine
STAGE       |   L1 |   L2 |   L3 |   L4 |   L5 |   L6
------------+------+------+------+------+------+------
EARLY (CC1) |  100 |  100 |    0 |    0 |    0 |    0
MID (CC2)   |  100 |  100 |  100 |    0 |    0 |    0
LATE (CC3)  |  100 |  100 |  100 |    0 |    0 |    0
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
