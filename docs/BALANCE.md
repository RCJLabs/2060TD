# Balance snapshot (v1.24)

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
   1 |    100 |     80 |       43
   2 |    100 |     71 |       50
   3 |    100 |     67 |       62
   4 |     28 |     40 |       92
   5 |     17 |     38 |       96

RAID — UNITED STATES strike force (27 MP) vs PLA Front Line — STRIKE doctrine + fire plan
TIER | CLEAR% | DESTR% | MP LOST%
-----+--------+--------+---------
   1 |    100 |     87 |       32
   2 |    100 |     78 |       41
   3 |    100 |     70 |       59
   4 |     37 |     46 |       88
   5 |     27 |     44 |       93

RAID — UNITED STATES strike force (27 MP) vs PLA Front Line — AIR RAID (rotors + a ground tail)
TIER | CLEAR% | DESTR% | MP LOST%
-----+--------+--------+---------
   1 |    100 |     70 |       21
   2 |     73 |     45 |       51
   3 |     97 |     65 |       52
   4 |     88 |     50 |       56
   5 |     38 |     31 |       74

RAID — PLA EXPEDITIONARY FORCE strike force (28 MP) vs US ARMY Front Line
TIER | CLEAR% | DESTR% | MP LOST%
-----+--------+--------+---------
   1 |    100 |     74 |       46
   2 |    100 |     64 |       50
   3 |     97 |     53 |       67
   4 |     33 |     33 |       92
   5 |     37 |     37 |       91

RAID — PLA EXPEDITIONARY FORCE strike force (28 MP) vs US ARMY Front Line — STRIKE doctrine + fire plan
TIER | CLEAR% | DESTR% | MP LOST%
-----+--------+--------+---------
   1 |    100 |     80 |       37
   2 |    100 |     70 |       45
   3 |    100 |     58 |       61
   4 |     40 |     42 |       90
   5 |     43 |     47 |       90

RAID — PLA EXPEDITIONARY FORCE strike force (28 MP) vs US ARMY Front Line — AIR RAID (rotors + a ground tail)
TIER | CLEAR% | DESTR% | MP LOST%
-----+--------+--------+---------
   1 |    100 |     66 |       13
   2 |     72 |     42 |       52
   3 |    100 |     61 |       43
   4 |     83 |     53 |       55
   5 |     43 |     38 |       71

RAID — RUSSIAN GROUND FORCES strike force (27 MP) vs US ARMY Front Line
TIER | CLEAR% | DESTR% | MP LOST%
-----+--------+--------+---------
   1 |    100 |     81 |       40
   2 |    100 |     72 |       40
   3 |     90 |     59 |       61
   4 |      2 |     23 |       99
   5 |     52 |     50 |       82

RAID — RUSSIAN GROUND FORCES strike force (27 MP) vs US ARMY Front Line — STRIKE doctrine + fire plan
TIER | CLEAR% | DESTR% | MP LOST%
-----+--------+--------+---------
   1 |    100 |     89 |       25
   2 |    100 |     73 |       35
   3 |    100 |     65 |       58
   4 |     12 |     34 |       96
   5 |     70 |     55 |       80

RAID — RUSSIAN GROUND FORCES strike force (27 MP) vs US ARMY Front Line — AIR RAID (rotors + a ground tail)
TIER | CLEAR% | DESTR% | MP LOST%
-----+--------+--------+---------
   1 |    100 |     70 |       16
   2 |     75 |     44 |       47
   3 |     97 |     65 |       56
   4 |     73 |     51 |       59
   5 |     33 |     34 |       74

RAID — KOREAN PEOPLE'S ARMY strike force (27 MP) vs US ARMY Front Line
TIER | CLEAR% | DESTR% | MP LOST%
-----+--------+--------+---------
   1 |    100 |     82 |       44
   2 |     98 |     69 |       52
   3 |     42 |     56 |       87
   4 |      8 |     27 |       95
   5 |      0 |     35 |       95

RAID — KOREAN PEOPLE'S ARMY strike force (27 MP) vs US ARMY Front Line — hunt + raze squads TUNNELED
TIER | CLEAR% | DESTR% | MP LOST%
-----+--------+--------+---------
   1 |    100 |     78 |       33
   2 |     87 |     65 |       53
   3 |     73 |     62 |       77
   4 |      8 |     36 |       98
   5 |     23 |     34 |       94

RAID — KOREAN PEOPLE'S ARMY strike force (27 MP) vs US ARMY Front Line — TUNNELED + STRIKE doctrine + fire plan
TIER | CLEAR% | DESTR% | MP LOST%
-----+--------+--------+---------
   1 |    100 |     84 |       29
   2 |     97 |     71 |       52
   3 |     90 |     70 |       63
   4 |     22 |     44 |       94
   5 |     40 |     41 |       87

RAID — KOREAN PEOPLE'S ARMY strike force (27 MP) vs US ARMY Front Line — STRIKE doctrine + fire plan
TIER | CLEAR% | DESTR% | MP LOST%
-----+--------+--------+---------
   1 |    100 |     86 |       30
   2 |     98 |     75 |       49
   3 |     62 |     68 |       74
   4 |     18 |     31 |       91
   5 |     15 |     44 |       91

RAID — KOREAN PEOPLE'S ARMY strike force (27 MP) vs US ARMY Front Line — AIR RAID (rotors + a ground tail)
TIER | CLEAR% | DESTR% | MP LOST%
-----+--------+--------+---------
   1 |    100 |     62 |        8
   2 |     73 |     47 |       46
   3 |     90 |     53 |       52
   4 |     30 |     44 |       87
   5 |     37 |     34 |       83

RAID — UN COALITION strike force (27 MP) vs PLA Front Line
TIER | CLEAR% | DESTR% | MP LOST%
-----+--------+--------+---------
   1 |    100 |     78 |       47
   2 |    100 |     73 |       62
   3 |     70 |     57 |       79
   4 |      0 |     25 |      100
   5 |     13 |     26 |       98

RAID — UN COALITION strike force (27 MP) vs PLA Front Line — CONTROL: medics replaced by riflemen
TIER | CLEAR% | DESTR% | MP LOST%
-----+--------+--------+---------
   1 |    100 |     75 |       51
   2 |    100 |     72 |       61
   3 |     70 |     57 |       78
   4 |      0 |     25 |      100
   5 |      5 |     24 |      100

RAID — UN COALITION strike force (27 MP) vs PLA Front Line — STRIKE doctrine + fire plan
TIER | CLEAR% | DESTR% | MP LOST%
-----+--------+--------+---------
   1 |    100 |     79 |       41
   2 |    100 |     75 |       51
   3 |     78 |     62 |       75
   4 |      8 |     35 |       98
   5 |     12 |     30 |       98

RAID — UN COALITION strike force (27 MP) vs PLA Front Line — AIR RAID (rotors + a ground tail)
TIER | CLEAR% | DESTR% | MP LOST%
-----+--------+--------+---------
   1 |    100 |     72 |       17
   2 |     85 |     51 |       43
   3 |    100 |     65 |       49
   4 |    100 |     51 |       46
   5 |     38 |     33 |       71

ARCHETYPES — UNITED STATES strike force (27 MP), clear% by tier
SHAPE        | FROM |   T1 |   T2 |   T3 |   T4 |   T5 |  MEAN | DESTR% | MP LOST%
-------------+------+------+------+------+------+------+-------+--------+---------
COMPOUND     |    1 |  100 |  100 |   67 |   52 |   57 |  75.2 |     59 |       69
OPEN CAMP    |    1 |  100 |  100 |   55 |   25 |   67 |  69.4 |     68 |       70
CORRIDOR     |    1 |  100 |  100 |   30 |   50 |   12 |  58.4 |     53 |       79
STAR FORT    |    2 |  100 |  100 |   55 |    0 |    2 |  51.4 |     43 |       75
  └ prepared |      |  100 |  100 |   80 |    7 |   18 |  61.0 |     49 |       68
DISPERSED DEPOT |    3 |  100 |   72 |   67 |   93 |   18 |  70.0 |     48 |       73
  └ prepared |      |  100 |   97 |  100 |   97 |   37 |  86.2 |     55 |       66
STRONGPOINTS |    3 |  100 |  100 |  100 |   15 |   28 |  68.6 |     55 |       75
KEEP         |    4 |  100 |   97 |   95 |    5 |   37 |  66.8 |     48 |       75
BUNKER COMPLEX |    5 |  100 |  100 |    2 |   18 |   45 |  53.0 |     54 |       78
  └ prepared |      |  100 |  100 |    3 |   17 |   52 |  54.4 |     58 |       73

FIELD CONDITIONS — UNITED STATES strike force (27 MP), clear% by tier
CONDITION    |   T1 |   T2 |   T3 |   T4 |   T5 |  MEAN | vs CLEAR
-------------+------+------+------+------+------+-------+---------
CLEAR LINE   |  100 |  100 |  100 |   28 |   17 |  69.0 |     +0.0
HARD RAIN    |  100 |  100 |  100 |   42 |   32 |  74.8 |     +5.8
DUG IN       |  100 |  100 |  100 |   17 |   13 |  66.0 |     -3.0
FUEL CRISIS  |  100 |  100 |  100 |   12 |   15 |  65.4 |     -3.6
BLACKOUT     |  100 |  100 |  100 |   28 |   17 |  69.0 |     +0.0
ATTRITION    |  100 |  100 |   98 |   15 |   10 |  64.6 |     -4.4

TERRAIN — the UNITED STATES reference force vs PLA posts, flat ground vs real
GROUND      |    T1 |    T2 |    T3 |    T4 |    T5 |  MEAN | MP LOST%
------------+-------+-------+-------+-------+-------+-------+---------
       FLAT |   100 |   100 |    72 |    62 |    43 |  75.4 |       81
     GROUND |   100 |   100 |    73 |    72 |    50 |  79.0 |       84
    SHEET 1 |   100 |   100 |    65 |    50 |    50 |  73.0 |       80
    SHEET 2 |   100 |   100 |    55 |   100 |   100 |  91.0 |       85
    SHEET 3 |   100 |   100 |   100 |    65 |     0 |  73.0 |       88

PARITY — every faction at its own best line, same manpower, same ladder
FACTION     |    T1 |    T2 |    T3 |    T4 |    T5 |  MEAN | MP LOST% | LINE
------------+-------+-------+-------+-------+-------+-------+----------+------
UNITED STAT |   100 |   100 |    73 |    72 |    50 |  79.0 |       84 | GROUND
PLA EXPEDIT |   100 |   100 |    68 |     0 |    17 |  57.0 |       86 | GROUND
RUSSIAN GRO |   100 |    93 |    68 |    38 |    15 |  62.8 |       74 | GROUND
KOREAN PEOP |   100 |    87 |    75 |     8 |    23 |  58.6 |       75 | TUNNEL
UN COALITIO |   100 |   100 |    38 |     2 |    27 |  53.4 |       89 | GROUND

SPREAD — 25.6 points between USA and UN. Five kits differing in STYLE (GDD §4) should not differ this much in ODDS.

THE DEAL — the three targets a rung offers vs the eight it could offer
SHAPE        |    T1 |    T2 |    T3 |    T4 |    T5 |  MEAN
-------------+-------+-------+-------+-------+-------+-------
bunker       |   100 |    75 |     4 |    16 |    24 |  43.7
star         |   100 |    89 |    40 |     0 |     0 |  45.9
strongpoints |    99 |    84 |    61 |     5 |    11 |  52.0
keep         |   100 |    81 |    55 |     9 |    32 |  55.5
depot        |   100 |    57 |    61 |    67 |    23 |  61.6
corridor     |   100 |    83 |    40 |    57 |    39 |  63.7
compound     |   100 |    93 |    73 |    43 |    32 |  68.3
camp         |    99 |    97 |    77 |    47 |    55 |  74.9

WHAT EACH FACTION IS DEALT — its three targets vs its own pool at that rung
FACTION |          T1 |          T2 |          T3 |          T4 |          T5 |   MEAN GAP
--------+-------------+-------------+-------------+-------------+-------------+-----------
    USA |  100/100 +0 |  100/100 +0 |    69/66 +3 |    38/32 +5 |   49/34 +15 |       +4.7
  CHINA |  100/100 +0 |  100/100 +0 |    64/62 +2 |   22/47 -24 |   11/31 -20 |       -8.4
 RUSSIA |  100/100 +0 |    89/90 -1 |    60/64 -4 |   49/37 +12 |    29/29 -0 |       +1.2
     NK |    98/98 +0 |    82/80 +2 |    64/64 +0 |    42/34 +8 |    29/28 +1 |       +2.1
     UN |  100/100 +0 |    78/83 -6 |   24/38 -13 |    11/12 -1 |     7/12 -5 |       -5.0

  dealt/pool and the gap. A deal that tracks its pool is offering that faction
  a fair read of the rung; a big negative gap is a rung of walls.

SHAPE COVERAGE — the rungs each faction is dealt each shape on
SHAPE        |         USA |       CHINA |      RUSSIA |          NK |          UN
-------------+-------------+-------------+-------------+-------------+-------------
compound     |       T1,T4 | T1,T2,T3,T4 |       T1,T5 | T1,T2,T3,T4 |       T1,T5
camp         | T1,T2,T3,T4,T5 |       T1,T5 |    T1,T2,T3 |    T1,T2,T3 |    T1,T2,T3
corridor     | T1,T2,T3,T4 |    T1,T2,T3 | T1,T2,T3,T4 |       T1,T5 | T1,T2,T3,T4
star         |          T2 | T2,T3,T4,T5 |       T2,T3 |       T2,T3 |       T2,T3
depot        |          T5 |   — never — |          T4 |          T4 |          T4
strongpoints |          T3 |   — never — |          T4 |       T4,T5 |       T4,T5
keep         |   — never — |          T4 |          T5 |   — never — |   — never —
bunker       |          T5 |          T5 |          T5 |          T5 |          T5

  8 of 8 shapes reach a player somewhere.

THE LADDER, pool mean per rung: T1 100  ->  T2 91  ->  T3 59  ->  T4 33  ->  T5 27
STEP SIZE: T1->T2 -9  T2->T3 -32  T3->T4 -26  T4->T5 -6 — a ladder should not have a flat rung or a rung that goes back up.

THE TWO KITS — every force against both sets of fortifications
FORCE   | vs PLA post | vs US firebase |   GAP | normally raids
--------+-------------+----------------+-------+---------------
    USA |        53.6 |           65.6 | -12.0 | CHINA
  CHINA |        49.5 |           55.7 |  -6.2 | USA
 RUSSIA |        52.1 |           51.0 |  +1.0 | USA
     NK |        19.8 |           30.2 | -10.4 | USA
     UN |        29.2 |           21.4 |  +7.8 | CHINA

WORST GAP 12.0 points. Two fronts differing in STYLE should not differ this much in DIFFICULTY — whoever raids the softer one is playing on easy and did not choose to.

THE PLAN, NOT THE FACTION — the same roster asked twice
FACTION | REF MP | REFERENCE | RECIPE MP | RECIPE |  BEST | PLAN IS WORTH
--------+--------+-----------+-----------+--------+-------+--------------
    USA |     27 |      62.9 |        26 |   64.2 |  64.2 |          +1.3
  CHINA |     28 |      64.6 |        25 |   75.4 |  75.4 |         +10.8
 RUSSIA |     27 |      60.8 |        27 |   71.3 |  71.3 |         +10.4
     NK |     27 |      62.9 |        26 |   62.9 |  62.9 |          +0.0
     UN |     27 |      43.3 |        24 |   57.1 |  57.1 |         +13.7

PLAN IS WORTH UP TO 13.7 POINTS — comparable to every effect this harness measures. Read BEST as the faction and the last column as the error bar; a single plan's row is not a reading of a kit.
BEST-PLAN SPREAD 18.3 points. `--kits` is unaffected: it holds the force fixed and swaps only the fortifications.

WHAT KILLS A COMMAND POST — the heavy's damage type, which was picked for flavour
FACTION | HEAVY FIRES | vs STRUCT | SHIPPING | ALL EXPLOSIVE | ALL KINETIC | SWING
--------+-------------+-----------+----------+---------------+-------------+------
    USA |   explosive |        x1 |     53.6 |          53.6 |        44.8 |  +8.9
  CHINA |   explosive |        x1 |     55.7 |          55.7 |        34.4 | +21.4
 RUSSIA |     kinetic |      x0.5 |     51.0 |          65.6 |        51.0 | +14.6
     NK |     kinetic |      x0.5 |     54.2 |          60.4 |        54.2 |  +6.3
     UN |     kinetic |      x0.5 |     29.2 |          42.2 |        29.2 | +13.0

ONE FLAG ON ONE UNIT IS WORTH UP TO 21.4 POINTS. Ranged fire is discounted against structures (smallArms 0.15, kinetic 0.5, explosive 1.0); melee ignores the table but
  only fires when adjacent, which in practice only the heavy manages — it lands 60-84% of the killing blows. Normalising the flag does NOT lift the UN off the floor.

WHO CARRIES A RAID — each unit kind silenced in turn, both damage channels
FACTION | CARRY UNIT   | ITS MP | RAID IS | DEAD WEIGHT (MP delivering nothing)
--------+--------------+--------+---------+------------------------------------
    USA |       abrams |      8 |     80% |                         13 of 27 MP
  CHINA |       type99 |      7 |     75% |                         14 of 28 MP
 RUSSIA |          rpg |      6 |     63% |                          4 of 27 MP
     NK |         rpg7 |      4 |     67% |                          0 of 27 MP
     UN |         nlaw |      6 |     45% |                         12 of 27 MP

ONE UNIT IS UP TO 80% OF A RAID. Ending a raid means killing the command post; ranged fire is discounted hard against structures and melee only fires when ADJACENT,
  so the heavy is the only unit that reliably survives to get there and hits hard when it does. Everything else is escort — and a buff to an escort buys nothing.

WHAT THE SEED DECIDES — the same matchup fought 12 times (25% of fire does not tell)
FORCE   | MATCHUPS | DECIDED     | SAME MEN HOME | LENGTH | CLEAR
--------+----------+-------------+---------------+--------+------
    USA |       40 |    25 (63%) |       9 (23%) |    847 |  60.6
  CHINA |       40 |    31 (78%) |      14 (35%) |   1043 |  65.2
 RUSSIA |       40 |    22 (55%) |       7 (18%) |   1640 |  64.4
     NK |       40 |    20 (50%) |       9 (23%) |   1890 |  61.7
     UN |       40 |    26 (65%) |      16 (40%) |   1305 |  45.2
--------+----------+-------------+---------------+--------+------
    ALL |      200 |   124 (62%) |      55 (28%) |   1345 |  59.4

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
ARMOUR |  ASSAULT |      83.3 |       47.2 |        15.3
ARMOUR |     HUNT |      75.0 |       80.6 |        45.8
ARMOUR |     RAZE |      76.4 |       51.4 |        65.3
  FOOT |  ASSAULT |      40.3 |       23.6 |         6.9
  FOOT |     HUNT |      36.1 |       37.5 |        29.2
  FOOT |     RAZE |      33.3 |       19.4 |        48.6
 MIXED |  ASSAULT |      62.5 |       19.4 |        11.1
 MIXED |     HUNT |      62.5 |       70.8 |        38.9
 MIXED |     RAZE |      58.3 |       23.6 |        63.9
       best: POST ARMOUR/ASSAULT  ·  GUNS ARMOUR/HUNT  ·  STORES ARMOUR/RAZE
-------+----------+-----------+------------+------------
CHINA
ARMOUR |  ASSAULT |      90.3 |       48.6 |        22.2
ARMOUR |     HUNT |      90.3 |       87.5 |        51.4
ARMOUR |     RAZE |      90.3 |       52.8 |        76.4
  FOOT |  ASSAULT |      13.9 |        0.0 |         0.0
  FOOT |     HUNT |       4.2 |       22.2 |         0.0
  FOOT |     RAZE |       0.0 |        0.0 |        16.7
 MIXED |  ASSAULT |      69.4 |       30.6 |        18.1
 MIXED |     HUNT |      59.7 |       66.7 |        30.6
 MIXED |     RAZE |      54.2 |       23.6 |        75.0
       best: POST ARMOUR/ASSAULT  ·  GUNS ARMOUR/HUNT  ·  STORES ARMOUR/RAZE
-------+----------+-----------+------------+------------
RUSSIA
ARMOUR |  ASSAULT |      59.7 |       33.3 |        18.1
ARMOUR |     HUNT |      66.7 |       66.7 |        41.7
ARMOUR |     RAZE |      69.4 |       37.5 |        66.7
  FOOT |  ASSAULT |      55.6 |       38.9 |        20.8
  FOOT |     HUNT |      55.6 |       61.1 |        40.3
  FOOT |     RAZE |      48.6 |       44.4 |        54.2
 MIXED |  ASSAULT |      54.2 |       26.4 |         6.9
 MIXED |     HUNT |      62.5 |       68.1 |        38.9
 MIXED |     RAZE |      43.1 |       23.6 |        77.8
       best: POST ARMOUR/RAZE  ·  GUNS MIXED/HUNT  ·  STORES MIXED/RAZE
-------+----------+-----------+------------+------------
NK
ARMOUR |  ASSAULT |      36.1 |       13.9 |        16.7
ARMOUR |     HUNT |      52.8 |       63.9 |        25.0
ARMOUR |     RAZE |      29.2 |       12.5 |        52.8
  FOOT |  ASSAULT |      18.1 |        0.0 |         0.0
  FOOT |     HUNT |      72.2 |       86.1 |         0.0
  FOOT |     RAZE |       5.6 |        0.0 |        86.1
 MIXED |  ASSAULT |      41.7 |        6.9 |         0.0
 MIXED |     HUNT |      75.0 |       79.2 |        15.3
 MIXED |     RAZE |      36.1 |       16.7 |        83.3
       best: POST MIXED/HUNT  ·  GUNS FOOT/HUNT  ·  STORES FOOT/RAZE
-------+----------+-----------+------------+------------
UN
ARMOUR |  ASSAULT |      54.2 |       38.9 |        18.1
ARMOUR |     HUNT |      48.6 |       63.9 |        34.7
ARMOUR |     RAZE |      44.4 |       31.9 |        41.7
  FOOT |  ASSAULT |      48.6 |       33.3 |        15.3
  FOOT |     HUNT |      29.2 |       43.1 |        33.3
  FOOT |     RAZE |      37.5 |       27.8 |        47.2
 MIXED |  ASSAULT |      48.6 |       15.3 |         8.3
 MIXED |     HUNT |      59.7 |       63.9 |        20.8
 MIXED |     RAZE |      52.8 |       19.4 |        70.8
       best: POST MIXED/HUNT  ·  GUNS ARMOUR/HUNT  ·  STORES MIXED/RAZE
-------+----------+-----------+------------+------------

DISTINCT WINNERS 15 of 15. One force topping every column would mean the objective is a label on the same raid; a different force per column is the whole argument for letting a raid declare what it came for.

GARRISON — the UNITED STATES reference force vs PLA posts
CONFIG      |    T1 |    T2 |    T3 |    T4 |    T5 |  MEAN | MP LOST%
------------+-------+-------+-------+-------+-------+-------+---------
    v1.19 W |   100 |   100 |    73 |    63 |    63 |  79.8 |       82
    v1.19 — |   100 |   100 |    82 |    75 |    62 |  83.8 |       82
 GUNS 0.8 W |   100 |   100 |    82 |    85 |    68 |  87.0 |       76
 GUNS 0.8 — |   100 |   100 |    88 |    97 |    60 |  89.0 |       75
    WATCH W |   100 |   100 |    63 |    55 |    48 |  73.2 |       88
    WATCH — |   100 |   100 |    77 |    67 |    60 |  80.8 |       85
  SHIPPED W |   100 |   100 |    73 |    72 |    50 |  79.0 |       84
  SHIPPED — |   100 |   100 |    90 |    87 |    58 |  87.0 |       79

WALL LINE IS WORTH — v1.19 +4.0  |  GUNS 0.8 +2.0  |  WATCH +7.6  |  SHIPPED +8.0  (clear-rate points to the defender)

AIR — the UNITED STATES reference force vs PLA posts, with and without AA
FORCE       |    T1 |    T2 |    T3 |    T4 |    T5 |  MEAN | MP LOST%
------------+-------+-------+-------+-------+-------+-------+---------
     GROUND |   100 |   100 |    73 |    72 |    50 |  79.0 |       84
  AIR no AA |   100 |    83 |    45 |    38 |    85 |  70.2 |       62
    AIR +AA |   100 |    52 |    30 |    20 |    70 |  54.4 |       67

AIR'S EDGE OVER GROUND — without AA -8.8  |  with AA -24.6  (clear-rate points)

AIR — the PLA EXPEDITIONARY FORCE reference force vs US ARMY posts, with and without AA
FORCE       |    T1 |    T2 |    T3 |    T4 |    T5 |  MEAN | MP LOST%
------------+-------+-------+-------+-------+-------+-------+---------
     GROUND |   100 |   100 |    68 |     0 |    17 |  57.0 |       86
  AIR no AA |   100 |   100 |    85 |    85 |    57 |  85.4 |       54
    AIR +AA |   100 |    93 |    80 |    83 |    42 |  79.6 |       55

AIR'S EDGE OVER GROUND — without AA +28.4  |  with AA +22.6  (clear-rate points)

AIR — the RUSSIAN GROUND FORCES reference force vs US ARMY posts, with and without AA
FORCE       |    T1 |    T2 |    T3 |    T4 |    T5 |  MEAN | MP LOST%
------------+-------+-------+-------+-------+-------+-------+---------
     GROUND |   100 |    93 |    68 |    38 |    15 |  62.8 |       74
  AIR no AA |   100 |    47 |    97 |    92 |    72 |  81.6 |       56
    AIR +AA |   100 |    42 |    83 |    77 |    67 |  73.8 |       59

AIR'S EDGE OVER GROUND — without AA +18.8  |  with AA +11.0  (clear-rate points)

AIR — the KOREAN PEOPLE'S ARMY reference force vs US ARMY posts, with and without AA
FORCE       |    T1 |    T2 |    T3 |    T4 |    T5 |  MEAN | MP LOST%
------------+-------+-------+-------+-------+-------+-------+---------
     GROUND |   100 |    98 |    48 |    10 |     0 |  51.2 |       78
  AIR no AA |   100 |    75 |   100 |    55 |    12 |  68.4 |       56
    AIR +AA |   100 |    73 |    80 |    48 |     3 |  60.8 |       61

AIR'S EDGE OVER GROUND — without AA +17.2  |  with AA +9.6  (clear-rate points)

AIR — the UN COALITION reference force vs PLA posts, with and without AA
FORCE       |    T1 |    T2 |    T3 |    T4 |    T5 |  MEAN | MP LOST%
------------+-------+-------+-------+-------+-------+-------+---------
     GROUND |   100 |   100 |    38 |     2 |    27 |  53.4 |       89
  AIR no AA |   100 |    52 |    82 |    67 |    97 |  79.6 |       58
    AIR +AA |   100 |    52 |    70 |    67 |    72 |  72.2 |       61

AIR'S EDGE OVER GROUND — without AA +26.2  |  with AA +18.8  (clear-rate points)

VETERANCY — UNITED STATES strike force (27 MP), men returned% by tier
RANK    |  ×   |   T1 |   T2 |   T3 |   T4 |   T5 |  MEAN | CLEAR%
--------+------+------+------+------+------+------+-------+-------
GREEN   | 1.00 |   30 |   15 |   14 |   12 |    7 |  15.6 |     79
LINE    | 1.04 |   42 |   16 |   21 |   13 |    8 |  20.0 |     82
VETERAN | 1.09 |   45 |   20 |   19 |   16 |   11 |  22.2 |     84
CADRE   | 1.15 |   48 |   26 |   23 |   20 |   11 |  25.6 |     84

VETERANCY — PLA EXPEDITIONARY FORCE strike force (28 MP), men returned% by tier
RANK    |  ×   |   T1 |   T2 |   T3 |   T4 |   T5 |  MEAN | CLEAR%
--------+------+------+------+------+------+------+-------+-------
GREEN   | 1.00 |   38 |   24 |    8 |    0 |    1 |  14.2 |     57
LINE    | 1.04 |   38 |   27 |    8 |    0 |    2 |  15.0 |     59
VETERAN | 1.09 |   47 |   25 |    9 |    0 |    2 |  16.6 |     61
CADRE   | 1.15 |   51 |   27 |    9 |    1 |    4 |  18.4 |     65

VETERANCY — RUSSIAN GROUND FORCES strike force (27 MP), men returned% by tier
RANK    |  ×   |   T1 |   T2 |   T3 |   T4 |   T5 |  MEAN | CLEAR%
--------+------+------+------+------+------+------+-------+-------
GREEN   | 1.00 |   57 |   35 |   20 |   13 |    3 |  25.6 |     63
LINE    | 1.04 |   60 |   36 |   21 |   14 |    4 |  27.0 |     65
VETERAN | 1.09 |   63 |   40 |   21 |   13 |    3 |  28.0 |     68
CADRE   | 1.15 |   72 |   43 |   27 |   16 |    4 |  32.4 |     76

VETERANCY — KOREAN PEOPLE'S ARMY strike force (27 MP), men returned% by tier
RANK    |  ×   |   T1 |   T2 |   T3 |   T4 |   T5 |  MEAN | CLEAR%
--------+------+------+------+------+------+------+-------+-------
GREEN   | 1.00 |   54 |   41 |    8 |    4 |    2 |  21.8 |     51
LINE    | 1.04 |   55 |   41 |   11 |    5 |    4 |  23.2 |     55
VETERAN | 1.09 |   66 |   40 |   16 |    8 |    5 |  27.0 |     62
CADRE   | 1.15 |   68 |   45 |   21 |   11 |    4 |  29.8 |     64

VETERANCY — UN COALITION strike force (27 MP), men returned% by tier
RANK    |  ×   |   T1 |   T2 |   T3 |   T4 |   T5 |  MEAN | CLEAR%
--------+------+------+------+------+------+------+-------+-------
GREEN   | 1.00 |   28 |   17 |    7 |    0 |    4 |  11.2 |     53
LINE    | 1.04 |   30 |   20 |   10 |    1 |    6 |  13.4 |     58
VETERAN | 1.09 |   31 |   21 |   11 |    0 |    6 |  13.8 |     57
CADRE   | 1.15 |   31 |   26 |   13 |    4 |    7 |  16.2 |     63

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
  conditions clear. It does: GROUND lands 6.6 points under FLAT on the mean, inside the
  ±9 band, while the three sheets disagree with each other by forty points. Two of them
  are walkovers for the reference force and one stops it dead at T3 and T5. That is the
  whole point of putting a base somewhere rather than nowhere.
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
- **Watch items for v0.6**: the EARLY L2→L3 cliff on all sides (armor arrives before
  anti-armor requisitions), China MID vs L5+ (Javelin overwatch), and NK MID vs L4+
  (everything kills sentry nests).
- M7 changes behind these numbers: tunneled squads surface as one push around the mouth
  after an 8s dig (reserved cells carry the mouths into replays), the Bulsae matches the
  HJ-8 trade (46/58/72 at 0.5/s), the Koksan runs a 4.2s cadence with a 3.5 dead zone
  in exchange for 10.5–11 reach, and v0.7 adds sustainment auras: healing is additive,
  capped per target, and deterministic — it out-heals one gun, never two.
