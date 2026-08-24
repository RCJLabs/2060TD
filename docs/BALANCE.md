# Balance snapshot (v1.21)

Deterministic headless matrices from `npm run balance -- --md`.
20 seeds × 3 base variants per raid cell; 20 seeds per defense cell.
Defense rows measure the permanent layer alone (no live CP play), the floor a base must clear —
an active player defends one to two ladder levels above their probe floor.

> **CLEAR% is not a probability.** Measured in v1.21: a raid with no fire plan draws from the
> engine's stream exactly once per unit — a ±3-8% speed roll at spawn — and nothing else in it
> is random. 45% of the 75 (faction, tier, variant) matchups return a BYTE-IDENTICAL outcome
> across all 20 seeds, one of them held the same result for 200, and 66 of the 75 land on
> exactly 0% or exactly 100%. The seed does reach the sim (different seeds give different state
> hashes at every checkpoint, on a board with units on it) — it simply washes out.
>
> So a raid cell is really a sample of 3, not 60, and a tier reads in
> thirds while a five-tier mean moves in steps of 6.7 points. Read a CLEAR% as **how many of
> these matchups are winnable at all**, and treat any gap narrower than one matchup as noise.
> DESTR% is the continuous one; prefer it when a change is smaller than a whole cell.

```
RAID — UNITED STATES strike force (27 MP) vs PLA Front Line
TIER | CLEAR% | DESTR% | MP LOST%
-----+--------+--------+---------
   1 |    100 |     63 |       58
   2 |    100 |     79 |       48
   3 |     67 |     59 |       79
   4 |    100 |     60 |       67
   5 |     67 |     49 |       77

RAID — UNITED STATES strike force (27 MP) vs PLA Front Line — STRIKE doctrine + fire plan
TIER | CLEAR% | DESTR% | MP LOST%
-----+--------+--------+---------
   1 |    100 |     75 |       42
   2 |    100 |     87 |       40
   3 |    100 |     72 |       63
   4 |    100 |     68 |       62
   5 |     67 |     54 |       80

RAID — UNITED STATES strike force (27 MP) vs PLA Front Line — AIR RAID (rotors + a ground tail)
TIER | CLEAR% | DESTR% | MP LOST%
-----+--------+--------+---------
   1 |    100 |     71 |       13
   2 |     77 |     44 |       51
   3 |     97 |     64 |       71
   4 |     67 |     46 |       84
   5 |     67 |     48 |       63

RAID — PLA EXPEDITIONARY FORCE strike force (28 MP) vs US ARMY Front Line
TIER | CLEAR% | DESTR% | MP LOST%
-----+--------+--------+---------
   1 |    100 |     74 |       54
   2 |    100 |     62 |       70
   3 |     73 |     51 |       82
   4 |     98 |     43 |       75
   5 |      0 |     47 |      100

RAID — PLA EXPEDITIONARY FORCE strike force (28 MP) vs US ARMY Front Line — STRIKE doctrine + fire plan
TIER | CLEAR% | DESTR% | MP LOST%
-----+--------+--------+---------
   1 |    100 |     81 |       53
   2 |     98 |     73 |       60
   3 |     70 |     51 |       83
   4 |    100 |     46 |       74
   5 |      0 |     50 |      100

RAID — PLA EXPEDITIONARY FORCE strike force (28 MP) vs US ARMY Front Line — AIR RAID (rotors + a ground tail)
TIER | CLEAR% | DESTR% | MP LOST%
-----+--------+--------+---------
   1 |    100 |     70 |        4
   2 |     97 |     55 |       28
   3 |     10 |     49 |       95
   4 |     33 |     42 |       87
   5 |     72 |     55 |       66

RAID — RUSSIAN GROUND FORCES strike force (27 MP) vs US ARMY Front Line
TIER | CLEAR% | DESTR% | MP LOST%
-----+--------+--------+---------
   1 |    100 |     85 |       48
   2 |     70 |     53 |       82
   3 |     48 |     44 |       87
   4 |     53 |     40 |       85
   5 |      0 |     36 |      100

RAID — RUSSIAN GROUND FORCES strike force (27 MP) vs US ARMY Front Line — STRIKE doctrine + fire plan
TIER | CLEAR% | DESTR% | MP LOST%
-----+--------+--------+---------
   1 |    100 |     85 |       39
   2 |    100 |     62 |       64
   3 |     67 |     48 |       83
   4 |     97 |     55 |       69
   5 |      0 |     44 |      100

RAID — RUSSIAN GROUND FORCES strike force (27 MP) vs US ARMY Front Line — AIR RAID (rotors + a ground tail)
TIER | CLEAR% | DESTR% | MP LOST%
-----+--------+--------+---------
   1 |    100 |     70 |        5
   2 |    100 |     62 |       28
   3 |     22 |     45 |       88
   4 |     32 |     42 |       87
   5 |     33 |     46 |       75

RAID — KOREAN PEOPLE'S ARMY strike force (27 MP) vs US ARMY Front Line
TIER | CLEAR% | DESTR% | MP LOST%
-----+--------+--------+---------
   1 |    100 |     80 |       64
   2 |     47 |     49 |       89
   3 |      0 |     36 |      100
   4 |      0 |     33 |       94
   5 |      0 |     32 |      100

RAID — KOREAN PEOPLE'S ARMY strike force (27 MP) vs US ARMY Front Line — hunt + raze squads TUNNELED
TIER | CLEAR% | DESTR% | MP LOST%
-----+--------+--------+---------
   1 |    100 |     85 |       57
   2 |    100 |     69 |       56
   3 |     33 |     62 |       91
   4 |     33 |     47 |       98
   5 |     28 |     31 |       95

RAID — KOREAN PEOPLE'S ARMY strike force (27 MP) vs US ARMY Front Line — TUNNELED + STRIKE doctrine + fire plan
TIER | CLEAR% | DESTR% | MP LOST%
-----+--------+--------+---------
   1 |    100 |     84 |       38
   2 |    100 |     77 |       45
   3 |     40 |     65 |       88
   4 |     47 |     55 |       90
   5 |     33 |     39 |       91

RAID — KOREAN PEOPLE'S ARMY strike force (27 MP) vs US ARMY Front Line — STRIKE doctrine + fire plan
TIER | CLEAR% | DESTR% | MP LOST%
-----+--------+--------+---------
   1 |    100 |     90 |       54
   2 |     57 |     59 |       87
   3 |     10 |     48 |       98
   4 |      7 |     38 |       94
   5 |      0 |     43 |      100

RAID — KOREAN PEOPLE'S ARMY strike force (27 MP) vs US ARMY Front Line — AIR RAID (rotors + a ground tail)
TIER | CLEAR% | DESTR% | MP LOST%
-----+--------+--------+---------
   1 |    100 |     70 |        7
   2 |     92 |     51 |       69
   3 |      0 |     34 |      100
   4 |     23 |     43 |       93
   5 |     30 |     42 |       94

RAID — UN COALITION strike force (27 MP) vs PLA Front Line
TIER | CLEAR% | DESTR% | MP LOST%
-----+--------+--------+---------
   1 |    100 |     82 |       46
   2 |    100 |     90 |       46
   3 |     68 |     54 |       83
   4 |     33 |     43 |       93
   5 |     58 |     41 |       83

RAID — UN COALITION strike force (27 MP) vs PLA Front Line — CONTROL: medics replaced by riflemen
TIER | CLEAR% | DESTR% | MP LOST%
-----+--------+--------+---------
   1 |    100 |     72 |       42
   2 |    100 |     92 |       45
   3 |     50 |     50 |       91
   4 |     33 |     43 |       93
   5 |     67 |     44 |       81

RAID — UN COALITION strike force (27 MP) vs PLA Front Line — STRIKE doctrine + fire plan
TIER | CLEAR% | DESTR% | MP LOST%
-----+--------+--------+---------
   1 |    100 |     81 |       41
   2 |    100 |     89 |       46
   3 |     90 |     63 |       70
   4 |     33 |     48 |       87
   5 |     67 |     45 |       81

RAID — UN COALITION strike force (27 MP) vs PLA Front Line — AIR RAID (rotors + a ground tail)
TIER | CLEAR% | DESTR% | MP LOST%
-----+--------+--------+---------
   1 |    100 |     75 |        9
   2 |     85 |     46 |       49
   3 |    100 |     65 |       59
   4 |     67 |     42 |       80
   5 |     67 |     46 |       67

ARCHETYPES — UNITED STATES strike force (27 MP), clear% by tier
SHAPE        | FROM |   T1 |   T2 |   T3 |   T4 |   T5 |  MEAN | DESTR% | MP LOST%
-------------+------+------+------+------+------+------+-------+--------+---------
COMPOUND     |    1 |  100 |  100 |  100 |  100 |  100 | 100.0 |     65 |       59
OPEN CAMP    |    1 |  100 |  100 |   67 |   95 |  100 |  92.4 |     75 |       57
CORRIDOR     |    1 |  100 |  100 |   98 |  100 |  100 |  99.6 |     68 |       65
STAR FORT    |    2 |  100 |  100 |  100 |   67 |   50 |  83.4 |     59 |       67
  └ prepared |      |  100 |  100 |  100 |   67 |   60 |  85.4 |     64 |       58
DISPERSED DEPOT |    3 |  100 |  100 |  100 |  100 |  100 | 100.0 |     52 |       60
  └ prepared |      |  100 |  100 |  100 |  100 |  100 | 100.0 |     61 |       54
STRONGPOINTS |    3 |  100 |  100 |  100 |   90 |  100 |  98.0 |     63 |       63
KEEP         |    4 |  100 |  100 |  100 |   95 |  100 |  99.0 |     61 |       62
BUNKER COMPLEX |    5 |  100 |  100 |   67 |   63 |   67 |  79.4 |     67 |       70
  └ prepared |      |  100 |  100 |   67 |   97 |   67 |  86.2 |     76 |       62

FIELD CONDITIONS — UNITED STATES strike force (27 MP), clear% by tier
CONDITION    |   T1 |   T2 |   T3 |   T4 |   T5 |  MEAN | vs CLEAR
-------------+------+------+------+------+------+-------+---------
CLEAR LINE   |  100 |  100 |   67 |  100 |   67 |  86.8 |     +0.0
HARD RAIN    |  100 |  100 |  100 |  100 |   67 |  93.4 |     +6.6
DUG IN       |  100 |  100 |   67 |  100 |   67 |  86.8 |     +0.0
FUEL CRISIS  |  100 |  100 |   67 |   95 |   67 |  85.8 |     -1.0
BLACKOUT     |  100 |  100 |   67 |  100 |   67 |  86.8 |     +0.0
ATTRITION    |  100 |  100 |  100 |  100 |   67 |  93.4 |     +6.6

TERRAIN — the UNITED STATES reference force vs PLA posts, flat ground vs real
GROUND      |    T1 |    T2 |    T3 |    T4 |    T5 |  MEAN | MP LOST%
------------+-------+-------+-------+-------+-------+-------+---------
       FLAT |   100 |   100 |   100 |   100 |    67 |  93.4 |       70
     GROUND |   100 |   100 |    67 |   100 |    67 |  86.8 |       80
    SHEET 1 |   100 |   100 |   100 |   100 |   100 | 100.0 |       72
    SHEET 2 |   100 |   100 |     0 |   100 |     0 |  60.0 |       87
    SHEET 3 |   100 |   100 |   100 |   100 |   100 | 100.0 |       81

PARITY — every faction at its own best line, same manpower, same ladder
FACTION     |    T1 |    T2 |    T3 |    T4 |    T5 |  MEAN | MP LOST% | LINE
------------+-------+-------+-------+-------+-------+-------+----------+------
UNITED STAT |   100 |   100 |    67 |   100 |    67 |  86.8 |       80 | GROUND
PLA EXPEDIT |   100 |   100 |    73 |    98 |     0 |  74.2 |       88 | GROUND
RUSSIAN GRO |   100 |    70 |    48 |    53 |     0 |  54.2 |       89 | GROUND
KOREAN PEOP |   100 |   100 |    33 |    33 |    28 |  58.8 |       85 | TUNNEL
UN COALITIO |   100 |   100 |    68 |    33 |    58 |  71.8 |       78 | GROUND

SPREAD — 32.6 points between USA and RUSSIA. Five kits differing in STYLE (GDD §4) should not differ this much in ODDS.

THE DEAL — the three targets a rung offers vs the eight it could offer
SHAPE        |    T1 |    T2 |    T3 |    T4 |    T5 |  MEAN | DEALT ON
-------------+-------+-------+-------+-------+-------+-------+---------
bunker       |   100 |    67 |    33 |    27 |    23 |  49.9 | T5
star         |    99 |   100 |    55 |    13 |    17 |  56.8 | T2
strongpoints |   100 |    85 |    68 |    27 |    24 |  60.8 | T5
keep         |   100 |    79 |    73 |    27 |    53 |  66.4 | T4
depot        |   100 |    68 |    73 |    67 |    48 |  71.2 | — never —
compound     |   100 |    87 |    92 |    57 |    56 |  78.4 | T1,T2,T3,T4,T5
corridor     |   100 |    93 |    68 |    75 |    65 |  80.3 | T1,T2,T3,T4
camp         |   100 |   100 |    85 |    68 |    79 |  86.4 | T1,T3

WHAT THE RUNG OFFERS — dealt three vs the whole pool at that tier
TIER | DEALT SHAPES                         | DEALT | POOL |   GAP
-----+--------------------------------------+-------+------+------
T1   | camp, compound, corridor             |   100 |  100 |    +0
T2   | compound, star, corridor             |    93 |   95 |    -2
T3   | compound, camp, corridor             |    82 |   74 |    +8
T4   | compound, corridor, keep             |    53 |   48 |    +5
T5   | compound, bunker, strongpoints       |    34 |   46 |   -11

THE LADDER, pool mean per rung: T1 100  ->  T2 95  ->  T3 74  ->  T4 48  ->  T5 46
STEP SIZE: T1->T2 -5  T2->T3 -21  T3->T4 -26  T4->T5 -2 — a ladder should not have a flat rung or a rung that goes back up.

GARRISON — the UNITED STATES reference force vs PLA posts
CONFIG      |    T1 |    T2 |    T3 |    T4 |    T5 |  MEAN | MP LOST%
------------+-------+-------+-------+-------+-------+-------+---------
    v1.19 W |   100 |   100 |    67 |   100 |    67 |  86.8 |       80
    v1.19 — |   100 |   100 |   100 |   100 |    67 |  93.4 |       79
 GUNS 0.8 W |   100 |   100 |    67 |   100 |    67 |  86.8 |       74
 GUNS 0.8 — |   100 |   100 |   100 |   100 |    80 |  96.0 |       71
    WATCH W |   100 |   100 |    67 |   100 |    67 |  86.8 |       83
    WATCH — |   100 |   100 |   100 |   100 |    67 |  93.4 |       83
  SHIPPED W |   100 |   100 |    67 |   100 |    67 |  86.8 |       80
  SHIPPED — |   100 |   100 |   100 |   100 |    72 |  94.4 |       78

WALL LINE IS WORTH — v1.19 +6.6  |  GUNS 0.8 +9.2  |  WATCH +6.6  |  SHIPPED +7.6  (clear-rate points to the defender)

AIR — the UNITED STATES reference force vs PLA posts, with and without AA
FORCE       |    T1 |    T2 |    T3 |    T4 |    T5 |  MEAN | MP LOST%
------------+-------+-------+-------+-------+-------+-------+---------
     GROUND |   100 |   100 |    67 |   100 |    67 |  86.8 |       80
  AIR no AA |   100 |   100 |   100 |    67 |    67 |  86.8 |       58
    AIR +AA |   100 |    77 |    97 |    67 |    67 |  81.6 |       64

AIR'S EDGE OVER GROUND — without AA +0.0  |  with AA -5.2  (clear-rate points)

AIR — the PLA EXPEDITIONARY FORCE reference force vs US ARMY posts, with and without AA
FORCE       |    T1 |    T2 |    T3 |    T4 |    T5 |  MEAN | MP LOST%
------------+-------+-------+-------+-------+-------+-------+---------
     GROUND |   100 |   100 |    73 |    98 |     0 |  74.2 |       88
  AIR no AA |   100 |   100 |    15 |    35 |    77 |  65.4 |       62
    AIR +AA |   100 |    97 |    10 |    33 |    72 |  62.4 |       63

AIR'S EDGE OVER GROUND — without AA -8.8  |  with AA -11.8  (clear-rate points)

AIR — the RUSSIAN GROUND FORCES reference force vs US ARMY posts, with and without AA
FORCE       |    T1 |    T2 |    T3 |    T4 |    T5 |  MEAN | MP LOST%
------------+-------+-------+-------+-------+-------+-------+---------
     GROUND |   100 |    70 |    48 |    53 |     0 |  54.2 |       89
  AIR no AA |   100 |   100 |    28 |    33 |    33 |  58.8 |       64
    AIR +AA |   100 |   100 |    22 |    32 |    33 |  57.4 |       66

AIR'S EDGE OVER GROUND — without AA +4.6  |  with AA +3.2  (clear-rate points)

AIR — the KOREAN PEOPLE'S ARMY reference force vs US ARMY posts, with and without AA
FORCE       |    T1 |    T2 |    T3 |    T4 |    T5 |  MEAN | MP LOST%
------------+-------+-------+-------+-------+-------+-------+---------
     GROUND |   100 |    47 |     0 |     0 |     0 |  29.4 |       93
  AIR no AA |   100 |    98 |     0 |    35 |    37 |  54.0 |       72
    AIR +AA |   100 |    92 |     0 |    23 |    30 |  49.0 |       74

AIR'S EDGE OVER GROUND — without AA +24.6  |  with AA +19.6  (clear-rate points)

AIR — the UN COALITION reference force vs PLA posts, with and without AA
FORCE       |    T1 |    T2 |    T3 |    T4 |    T5 |  MEAN | MP LOST%
------------+-------+-------+-------+-------+-------+-------+---------
     GROUND |   100 |   100 |    68 |    33 |    58 |  71.8 |       78
  AIR no AA |   100 |   100 |   100 |    67 |    67 |  86.8 |       58
    AIR +AA |   100 |    85 |   100 |    67 |    67 |  83.8 |       60

AIR'S EDGE OVER GROUND — without AA +15.0  |  with AA +12.0  (clear-rate points)

VETERANCY — UNITED STATES strike force (27 MP), men returned% by tier
RANK    |  ×   |   T1 |   T2 |   T3 |   T4 |   T5 |  MEAN | CLEAR%
--------+------+------+------+------+------+------+-------+-------
GREEN   | 1.00 |   27 |   37 |    9 |   14 |   11 |  19.6 |     87
LINE    | 1.04 |   39 |   45 |   12 |   17 |   11 |  24.8 |     93
VETERAN | 1.09 |   39 |   44 |   14 |   14 |    7 |  23.6 |     93
CADRE   | 1.15 |   42 |   50 |   21 |   16 |    7 |  27.2 |     93

VETERANCY — PLA EXPEDITIONARY FORCE strike force (28 MP), men returned% by tier
RANK    |  ×   |   T1 |   T2 |   T3 |   T4 |   T5 |  MEAN | CLEAR%
--------+------+------+------+------+------+------+-------+-------
GREEN   | 1.00 |   33 |   12 |    6 |    8 |    0 |  11.8 |     74
LINE    | 1.04 |   36 |   13 |    5 |    8 |    0 |  12.4 |     74
VETERAN | 1.09 |   32 |   21 |    5 |    8 |    0 |  13.2 |     73
CADRE   | 1.15 |   41 |   22 |    5 |    9 |    0 |  15.4 |     73

VETERANCY — RUSSIAN GROUND FORCES strike force (27 MP), men returned% by tier
RANK    |  ×   |   T1 |   T2 |   T3 |   T4 |   T5 |  MEAN | CLEAR%
--------+------+------+------+------+------+------+-------+-------
GREEN   | 1.00 |   37 |    7 |    4 |    6 |    0 |  10.8 |     54
LINE    | 1.04 |   42 |   15 |    6 |    4 |    0 |  13.4 |     63
VETERAN | 1.09 |   47 |   17 |    6 |   13 |    2 |  17.0 |     73
CADRE   | 1.15 |   46 |   18 |    6 |   18 |    1 |  17.8 |     76

VETERANCY — KOREAN PEOPLE'S ARMY strike force (27 MP), men returned% by tier
RANK    |  ×   |   T1 |   T2 |   T3 |   T4 |   T5 |  MEAN | CLEAR%
--------+------+------+------+------+------+------+-------+-------
GREEN   | 1.00 |   26 |    7 |    0 |    2 |    0 |   7.0 |     29
LINE    | 1.04 |   34 |    9 |    0 |    2 |    0 |   9.0 |     30
VETERAN | 1.09 |   38 |    7 |    0 |    2 |    0 |   9.4 |     32
CADRE   | 1.15 |   42 |    8 |    1 |    2 |    0 |  10.6 |     31

VETERANCY — UN COALITION strike force (27 MP), men returned% by tier
RANK    |  ×   |   T1 |   T2 |   T3 |   T4 |   T5 |  MEAN | CLEAR%
--------+------+------+------+------+------+------+-------+-------
GREEN   | 1.00 |   44 |   43 |   12 |    3 |    9 |  22.2 |     72
LINE    | 1.04 |   46 |   40 |   13 |    3 |    9 |  22.2 |     74
VETERAN | 1.09 |   44 |   41 |   14 |    3 |   10 |  22.4 |     76
CADRE   | 1.15 |   49 |   42 |   19 |   13 |   10 |  26.6 |     86

DEFENSE — UNITED STATES permanent layer vs PLA assault ladder (hold%)
STAGE       |   L1 |   L2 |   L3 |   L4 |   L5 |   L6
------------+------+------+------+------+------+------
EARLY (CC1) |  100 |  100 |    0 |    0 |    0 |    0
MID (CC2)   |  100 |  100 |  100 |  100 |   85 |    0
LATE (CC3)  |  100 |  100 |  100 |  100 |  100 |  100

DEFENSE — UNITED STATES permanent layer vs PLA assault ladder (hold%) — HOLDFAST standing orders
STAGE       |   L1 |   L2 |   L3 |   L4 |   L5 |   L6
------------+------+------+------+------+------+------
EARLY (CC1) |  100 |  100 |    0 |    0 |    0 |    0
MID (CC2)   |  100 |  100 |  100 |  100 |  100 |    0
LATE (CC3)  |  100 |  100 |  100 |  100 |  100 |  100

DEFENSE — UNITED STATES permanent layer vs PLA assault ladder (hold%) — WITH AA COVER
STAGE       |   L1 |   L2 |   L3 |   L4 |   L5 |   L6
------------+------+------+------+------+------+------
EARLY (CC1) |  100 |  100 |    0 |    0 |    0 |    0
MID (CC2)   |  100 |  100 |  100 |  100 |  100 |   40
LATE (CC3)  |  100 |  100 |  100 |  100 |  100 |  100

DEFENSE — UNITED STATES permanent layer vs PLA assault ladder (hold%) — FORTIFY doctrine
STAGE       |   L1 |   L2 |   L3 |   L4 |   L5 |   L6
------------+------+------+------+------+------+------
EARLY (CC1) |  100 |  100 |    0 |    0 |    0 |    0
MID (CC2)   |  100 |  100 |  100 |  100 |  100 |    0
LATE (CC3)  |  100 |  100 |  100 |  100 |  100 |  100

DEFENSE — PLA EXPEDITIONARY FORCE permanent layer vs US ARMY assault ladder (hold%)
STAGE       |   L1 |   L2 |   L3 |   L4 |   L5 |   L6
------------+------+------+------+------+------+------
EARLY (CC1) |  100 |  100 |    0 |    0 |    0 |    0
MID (CC2)   |  100 |  100 |   90 |    0 |    0 |    0
LATE (CC3)  |  100 |  100 |  100 |    0 |    0 |    0

DEFENSE — PLA EXPEDITIONARY FORCE permanent layer vs US ARMY assault ladder (hold%) — HOLDFAST standing orders
STAGE       |   L1 |   L2 |   L3 |   L4 |   L5 |   L6
------------+------+------+------+------+------+------
EARLY (CC1) |  100 |  100 |    0 |    0 |    0 |    0
MID (CC2)   |  100 |  100 |  100 |    0 |    0 |    0
LATE (CC3)  |  100 |  100 |  100 |    0 |    0 |    0

DEFENSE — PLA EXPEDITIONARY FORCE permanent layer vs US ARMY assault ladder (hold%) — WITH AA COVER
STAGE       |   L1 |   L2 |   L3 |   L4 |   L5 |   L6
------------+------+------+------+------+------+------
EARLY (CC1) |  100 |  100 |    0 |    0 |    0 |    0
MID (CC2)   |  100 |  100 |  100 |  100 |   40 |    0
LATE (CC3)  |  100 |  100 |  100 |  100 |  100 |  100

DEFENSE — PLA EXPEDITIONARY FORCE permanent layer vs US ARMY assault ladder (hold%) — FORTIFY doctrine
STAGE       |   L1 |   L2 |   L3 |   L4 |   L5 |   L6
------------+------+------+------+------+------+------
EARLY (CC1) |  100 |  100 |    0 |    0 |    0 |    0
MID (CC2)   |  100 |  100 |  100 |    0 |    0 |    0
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
MID (CC2)   |  100 |  100 |  100 |  100 |  100 |   20
LATE (CC3)  |  100 |  100 |  100 |  100 |  100 |  100

DEFENSE — RUSSIAN GROUND FORCES permanent layer vs US ARMY assault ladder (hold%) — WITH AA COVER
STAGE       |   L1 |   L2 |   L3 |   L4 |   L5 |   L6
------------+------+------+------+------+------+------
EARLY (CC1) |  100 |  100 |    0 |    0 |    0 |    0
MID (CC2)   |  100 |  100 |  100 |  100 |  100 |    0
LATE (CC3)  |  100 |  100 |  100 |  100 |  100 |  100

DEFENSE — RUSSIAN GROUND FORCES permanent layer vs US ARMY assault ladder (hold%) — FORTIFY doctrine
STAGE       |   L1 |   L2 |   L3 |   L4 |   L5 |   L6
------------+------+------+------+------+------+------
EARLY (CC1) |  100 |  100 |    0 |    0 |    0 |    0
MID (CC2)   |  100 |  100 |  100 |  100 |  100 |    0
LATE (CC3)  |  100 |  100 |  100 |  100 |  100 |  100

DEFENSE — KOREAN PEOPLE'S ARMY permanent layer vs US ARMY assault ladder (hold%)
STAGE       |   L1 |   L2 |   L3 |   L4 |   L5 |   L6
------------+------+------+------+------+------+------
EARLY (CC1) |  100 |  100 |    0 |    0 |    0 |    0
MID (CC2)   |  100 |  100 |   80 |    0 |    0 |    0
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
MID (CC2)   |  100 |  100 |  100 |    0 |    0 |    0
LATE (CC3)  |  100 |  100 |  100 |   95 |    0 |    0

DEFENSE — KOREAN PEOPLE'S ARMY permanent layer vs US ARMY assault ladder (hold%) — COUNTERBATTERY standing orders
STAGE       |   L1 |   L2 |   L3 |   L4 |   L5 |   L6
------------+------+------+------+------+------+------
EARLY (CC1) |  100 |  100 |    0 |    0 |    0 |    0
MID (CC2)   |  100 |  100 |   90 |    0 |    0 |    0
LATE (CC3)  |  100 |  100 |  100 |    0 |    0 |    0

DEFENSE — KOREAN PEOPLE'S ARMY permanent layer vs US ARMY assault ladder (hold%) — TRIPWIRE standing orders
STAGE       |   L1 |   L2 |   L3 |   L4 |   L5 |   L6
------------+------+------+------+------+------+------
EARLY (CC1) |  100 |  100 |    0 |    0 |    0 |    0
MID (CC2)   |  100 |  100 |   95 |    0 |    0 |    0
LATE (CC3)  |  100 |  100 |  100 |    0 |    0 |    0

DEFENSE — KOREAN PEOPLE'S ARMY permanent layer vs US ARMY assault ladder (hold%) — FORTIFY doctrine
STAGE       |   L1 |   L2 |   L3 |   L4 |   L5 |   L6
------------+------+------+------+------+------+------
EARLY (CC1) |  100 |  100 |    0 |    0 |    0 |    0
MID (CC2)   |  100 |  100 |   95 |    0 |    0 |    0
LATE (CC3)  |  100 |  100 |  100 |    0 |    0 |    0

DEFENSE — UN COALITION permanent layer vs PLA assault ladder (hold%)
STAGE       |   L1 |   L2 |   L3 |   L4 |   L5 |   L6
------------+------+------+------+------+------+------
EARLY (CC1) |  100 |  100 |    0 |    0 |    0 |    0
MID (CC2)   |  100 |  100 |  100 |    0 |    0 |    0
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
MID (CC2)   |  100 |  100 |  100 |  100 |   80 |    0
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
