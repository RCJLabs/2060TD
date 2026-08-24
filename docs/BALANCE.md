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
   1 |    100 |     78 |       43
   2 |    100 |     69 |       56
   3 |    100 |     69 |       69
   4 |     33 |     40 |       90
   5 |      0 |     25 |      100

RAID — UNITED STATES strike force (27 MP) vs PLA Front Line — STRIKE doctrine + fire plan
TIER | CLEAR% | DESTR% | MP LOST%
-----+--------+--------+---------
   1 |    100 |     82 |       37
   2 |    100 |     75 |       49
   3 |    100 |     69 |       68
   4 |     33 |     44 |       90
   5 |     22 |     42 |       98

RAID — UNITED STATES strike force (27 MP) vs PLA Front Line — AIR RAID (rotors + a ground tail)
TIER | CLEAR% | DESTR% | MP LOST%
-----+--------+--------+---------
   1 |    100 |     68 |       26
   2 |    100 |     58 |       41
   3 |    100 |     64 |       52
   4 |    100 |     51 |       47
   5 |     35 |     32 |       73

RAID — PLA EXPEDITIONARY FORCE strike force (28 MP) vs US ARMY Front Line
TIER | CLEAR% | DESTR% | MP LOST%
-----+--------+--------+---------
   1 |    100 |     63 |       58
   2 |    100 |     62 |       54
   3 |    100 |     54 |       67
   4 |     33 |     39 |       92
   5 |     45 |     38 |       91

RAID — PLA EXPEDITIONARY FORCE strike force (28 MP) vs US ARMY Front Line — STRIKE doctrine + fire plan
TIER | CLEAR% | DESTR% | MP LOST%
-----+--------+--------+---------
   1 |    100 |     81 |       36
   2 |    100 |     69 |       49
   3 |    100 |     60 |       67
   4 |     35 |     40 |       91
   5 |     45 |     46 |       90

RAID — PLA EXPEDITIONARY FORCE strike force (28 MP) vs US ARMY Front Line — AIR RAID (rotors + a ground tail)
TIER | CLEAR% | DESTR% | MP LOST%
-----+--------+--------+---------
   1 |    100 |     66 |       13
   2 |     67 |     38 |       53
   3 |    100 |     60 |       38
   4 |     75 |     50 |       60
   5 |     33 |     37 |       73

RAID — RUSSIAN GROUND FORCES strike force (27 MP) vs US ARMY Front Line
TIER | CLEAR% | DESTR% | MP LOST%
-----+--------+--------+---------
   1 |    100 |     77 |       45
   2 |    100 |     69 |       46
   3 |    100 |     56 |       56
   4 |      0 |     22 |      100
   5 |     67 |     50 |       87

RAID — RUSSIAN GROUND FORCES strike force (27 MP) vs US ARMY Front Line — STRIKE doctrine + fire plan
TIER | CLEAR% | DESTR% | MP LOST%
-----+--------+--------+---------
   1 |    100 |     82 |       33
   2 |    100 |     69 |       44
   3 |    100 |     60 |       56
   4 |      0 |     30 |      100
   5 |     67 |     53 |       77

RAID — RUSSIAN GROUND FORCES strike force (27 MP) vs US ARMY Front Line — AIR RAID (rotors + a ground tail)
TIER | CLEAR% | DESTR% | MP LOST%
-----+--------+--------+---------
   1 |    100 |     72 |       15
   2 |     77 |     47 |       47
   3 |     98 |     68 |       55
   4 |     78 |     52 |       58
   5 |     33 |     36 |       74

RAID — KOREAN PEOPLE'S ARMY strike force (27 MP) vs US ARMY Front Line
TIER | CLEAR% | DESTR% | MP LOST%
-----+--------+--------+---------
   1 |    100 |     75 |       57
   2 |     95 |     64 |       54
   3 |     33 |     47 |       93
   4 |      0 |     23 |      100
   5 |      0 |     24 |       98

RAID — KOREAN PEOPLE'S ARMY strike force (27 MP) vs US ARMY Front Line — hunt + raze squads TUNNELED
TIER | CLEAR% | DESTR% | MP LOST%
-----+--------+--------+---------
   1 |    100 |     78 |       49
   2 |     98 |     66 |       60
   3 |     67 |     55 |       80
   4 |      0 |     33 |      100
   5 |     22 |     40 |       87

RAID — KOREAN PEOPLE'S ARMY strike force (27 MP) vs US ARMY Front Line — TUNNELED + STRIKE doctrine + fire plan
TIER | CLEAR% | DESTR% | MP LOST%
-----+--------+--------+---------
   1 |    100 |     83 |       23
   2 |     98 |     70 |       56
   3 |     77 |     65 |       68
   4 |      2 |     35 |      100
   5 |     32 |     44 |       86

RAID — KOREAN PEOPLE'S ARMY strike force (27 MP) vs US ARMY Front Line — STRIKE doctrine + fire plan
TIER | CLEAR% | DESTR% | MP LOST%
-----+--------+--------+---------
   1 |    100 |     82 |       35
   2 |    100 |     71 |       50
   3 |     45 |     52 |       87
   4 |      0 |     22 |      100
   5 |      0 |     38 |       94

RAID — KOREAN PEOPLE'S ARMY strike force (27 MP) vs US ARMY Front Line — AIR RAID (rotors + a ground tail)
TIER | CLEAR% | DESTR% | MP LOST%
-----+--------+--------+---------
   1 |    100 |     60 |        8
   2 |     68 |     42 |       44
   3 |    100 |     56 |       46
   4 |     35 |     45 |       83
   5 |     33 |     31 |       83

RAID — UN COALITION strike force (27 MP) vs PLA Front Line
TIER | CLEAR% | DESTR% | MP LOST%
-----+--------+--------+---------
   1 |    100 |     78 |       55
   2 |    100 |     74 |       63
   3 |     72 |     55 |       84
   4 |      0 |     20 |      100
   5 |      0 |     21 |      100

RAID — UN COALITION strike force (27 MP) vs PLA Front Line — CONTROL: medics replaced by riflemen
TIER | CLEAR% | DESTR% | MP LOST%
-----+--------+--------+---------
   1 |    100 |     73 |       58
   2 |    100 |     74 |       62
   3 |     72 |     58 |       84
   4 |      0 |     20 |      100
   5 |      0 |     19 |      100

RAID — UN COALITION strike force (27 MP) vs PLA Front Line — STRIKE doctrine + fire plan
TIER | CLEAR% | DESTR% | MP LOST%
-----+--------+--------+---------
   1 |    100 |     79 |       54
   2 |    100 |     77 |       62
   3 |     72 |     61 |       84
   4 |      0 |     29 |      100
   5 |     23 |     33 |       97

RAID — UN COALITION strike force (27 MP) vs PLA Front Line — AIR RAID (rotors + a ground tail)
TIER | CLEAR% | DESTR% | MP LOST%
-----+--------+--------+---------
   1 |    100 |     71 |       16
   2 |    100 |     58 |       42
   3 |    100 |     65 |       52
   4 |    100 |     50 |       46
   5 |     33 |     31 |       73

ARCHETYPES — UNITED STATES strike force (27 MP), clear% by tier
SHAPE        | FROM |   T1 |   T2 |   T3 |   T4 |   T5 |  MEAN | DESTR% | MP LOST%
-------------+------+------+------+------+------+------+-------+--------+---------
COMPOUND     |    1 |  100 |  100 |   67 |   67 |   63 |  79.4 |     58 |       70
OPEN CAMP    |    1 |  100 |  100 |   67 |   33 |   67 |  73.4 |     67 |       71
CORRIDOR     |    1 |  100 |  100 |    2 |   33 |    0 |  47.0 |     47 |       83
STAR FORT    |    2 |  100 |  100 |   67 |    0 |    0 |  53.4 |     43 |       77
  └ prepared |      |  100 |  100 |   73 |    0 |    7 |  56.0 |     47 |       72
DISPERSED DEPOT |    3 |  100 |  100 |  100 |  100 |   33 |  86.6 |     44 |       69
  └ prepared |      |  100 |  100 |  100 |  100 |   33 |  86.6 |     51 |       67
STRONGPOINTS |    3 |  100 |  100 |  100 |   10 |    0 |  62.0 |     52 |       78
KEEP         |    4 |  100 |  100 |  100 |    0 |   20 |  64.0 |     45 |       77
BUNKER COMPLEX |    5 |  100 |  100 |    0 |    0 |   33 |  46.6 |     50 |       79
  └ prepared |      |  100 |  100 |    2 |    0 |   55 |  51.4 |     57 |       78

FIELD CONDITIONS — UNITED STATES strike force (27 MP), clear% by tier
CONDITION    |   T1 |   T2 |   T3 |   T4 |   T5 |  MEAN | vs CLEAR
-------------+------+------+------+------+------+-------+---------
CLEAR LINE   |  100 |  100 |  100 |   33 |    0 |  66.6 |     +0.0
HARD RAIN    |  100 |  100 |  100 |   33 |   33 |  73.2 |     +6.6
DUG IN       |  100 |  100 |  100 |   33 |    0 |  66.6 |     +0.0
FUEL CRISIS  |  100 |  100 |  100 |   33 |    0 |  66.6 |     +0.0
BLACKOUT     |  100 |  100 |  100 |   33 |    0 |  66.6 |     +0.0
ATTRITION    |  100 |  100 |  100 |   33 |    0 |  66.6 |     +0.0

TERRAIN — the UNITED STATES reference force vs PLA posts, flat ground vs real
GROUND      |    T1 |    T2 |    T3 |    T4 |    T5 |  MEAN | MP LOST%
------------+-------+-------+-------+-------+-------+-------+---------
       FLAT |   100 |   100 |    62 |    65 |    33 |  72.0 |       82
     GROUND |   100 |   100 |    68 |    97 |    33 |  79.6 |       85
    SHEET 1 |   100 |   100 |   100 |    90 |     0 |  78.0 |       79
    SHEET 2 |   100 |   100 |     5 |   100 |   100 |  81.0 |       88
    SHEET 3 |   100 |   100 |   100 |   100 |     0 |  80.0 |       87

PARITY — every faction at its own best line, same manpower, same ladder
FACTION     |    T1 |    T2 |    T3 |    T4 |    T5 |  MEAN | MP LOST% | LINE
------------+-------+-------+-------+-------+-------+-------+----------+------
UNITED STAT |   100 |   100 |    68 |    97 |    33 |  79.6 |       85 | GROUND
PLA EXPEDIT |   100 |   100 |    73 |     0 |    45 |  63.6 |       87 | GROUND
RUSSIAN GRO |   100 |    95 |    67 |    33 |    33 |  65.6 |       79 | GROUND
KOREAN PEOP |   100 |    98 |    70 |     0 |    22 |  58.0 |       81 | TUNNEL
UN COALITIO |   100 |   100 |    33 |     0 |    33 |  53.2 |       92 | GROUND

SPREAD — 26.4 points between USA and UN. Five kits differing in STYLE (GDD §4) should not differ this much in ODDS.

THE DEAL — the three targets a rung offers vs the eight it could offer
SHAPE        |    T1 |    T2 |    T3 |    T4 |    T5 |  MEAN
-------------+-------+-------+-------+-------+-------+-------
bunker       |   100 |    53 |     7 |    13 |    15 |  37.6
star         |    99 |    93 |    33 |     0 |     0 |  45.1
strongpoints |   100 |    85 |    68 |     4 |     0 |  51.5
keep         |   100 |    72 |    68 |     7 |    35 |  56.3
depot        |   100 |    57 |    60 |    64 |    27 |  61.6
corridor     |   100 |    87 |    32 |    55 |    45 |  63.7
compound     |   100 |    87 |    79 |    47 |    41 |  70.7
camp         |   100 |   100 |    80 |    47 |    64 |  78.1

WHAT EACH FACTION IS DEALT — its three targets vs its own pool at that rung
FACTION |          T1 |          T2 |          T3 |          T4 |          T5 |   MEAN GAP
--------+-------------+-------------+-------------+-------------+-------------+-----------
    USA |  100/100 +0 |  100/100 +0 |   58/68 -10 |    42/35 +7 |   44/28 +17 |       +2.8
  CHINA |  100/100 +0 |  100/100 +0 |    73/66 +8 |   22/48 -25 |   16/33 -17 |       -6.9
 RUSSIA |  100/100 +0 |   100/92 +8 |   56/66 -10 |   49/39 +10 |    42/36 +6 |       +2.9
     NK |  100/100 +0 |    89/83 +6 |    56/57 -1 |    33/30 +4 |    29/30 -1 |       +1.4
     UN |  100/100 +0 |    78/83 -6 |   20/38 -18 |      7/8 -1 |    11/16 -5 |       -5.8

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

THE LADDER, pool mean per rung: T1 100  ->  T2 92  ->  T3 59  ->  T4 32  ->  T5 28
STEP SIZE: T1->T2 -8  T2->T3 -33  T3->T4 -27  T4->T5 -3 — a ladder should not have a flat rung or a rung that goes back up.

THE TWO KITS — every force against both sets of fortifications
FORCE   | vs PLA post | vs US firebase |   GAP | normally raids
--------+-------------+----------------+-------+---------------
    USA |        51.6 |           62.5 | -10.9 | CHINA
  CHINA |        55.2 |           52.6 |  +2.6 | USA
 RUSSIA |        44.3 |           50.5 |  -6.3 | USA
     NK |        15.1 |           18.8 |  -3.6 | USA
     UN |        29.7 |           19.8 |  +9.9 | CHINA

WORST GAP 10.9 points. Two fronts differing in STYLE should not differ this much in DIFFICULTY — whoever raids the softer one is playing on easy and did not choose to.

GARRISON — the UNITED STATES reference force vs PLA posts
CONFIG      |    T1 |    T2 |    T3 |    T4 |    T5 |  MEAN | MP LOST%
------------+-------+-------+-------+-------+-------+-------+---------
    v1.19 W |   100 |   100 |    73 |    97 |    33 |  80.6 |       84
    v1.19 — |   100 |   100 |   100 |   100 |    33 |  86.6 |       84
 GUNS 0.8 W |   100 |   100 |    68 |    97 |    45 |  82.0 |       80
 GUNS 0.8 — |   100 |   100 |   100 |   100 |    42 |  88.4 |       78
    WATCH W |   100 |   100 |    72 |    72 |    33 |  75.4 |       88
    WATCH — |   100 |   100 |    98 |   100 |    33 |  86.2 |       87
  SHIPPED W |   100 |   100 |    68 |    97 |    33 |  79.6 |       85
  SHIPPED — |   100 |   100 |   100 |   100 |    42 |  88.4 |       84

WALL LINE IS WORTH — v1.19 +6.0  |  GUNS 0.8 +6.4  |  WATCH +10.8  |  SHIPPED +8.8  (clear-rate points to the defender)

AIR — the UNITED STATES reference force vs PLA posts, with and without AA
FORCE       |    T1 |    T2 |    T3 |    T4 |    T5 |  MEAN | MP LOST%
------------+-------+-------+-------+-------+-------+-------+---------
     GROUND |   100 |   100 |    68 |    97 |    33 |  79.6 |       85
  AIR no AA |   100 |   100 |    33 |    43 |   100 |  75.2 |       63
    AIR +AA |   100 |    67 |    33 |    33 |    68 |  60.2 |       69

AIR'S EDGE OVER GROUND — without AA -4.4  |  with AA -19.4  (clear-rate points)

AIR — the PLA EXPEDITIONARY FORCE reference force vs US ARMY posts, with and without AA
FORCE       |    T1 |    T2 |    T3 |    T4 |    T5 |  MEAN | MP LOST%
------------+-------+-------+-------+-------+-------+-------+---------
     GROUND |   100 |   100 |    73 |     0 |    45 |  63.6 |       87
  AIR no AA |   100 |   100 |    82 |    93 |    62 |  87.4 |       53
    AIR +AA |   100 |   100 |    77 |    67 |    33 |  75.4 |       55

AIR'S EDGE OVER GROUND — without AA +23.8  |  with AA +11.8  (clear-rate points)

AIR — the RUSSIAN GROUND FORCES reference force vs US ARMY posts, with and without AA
FORCE       |    T1 |    T2 |    T3 |    T4 |    T5 |  MEAN | MP LOST%
------------+-------+-------+-------+-------+-------+-------+---------
     GROUND |   100 |    95 |    67 |    33 |    33 |  65.6 |       79
  AIR no AA |   100 |    60 |   100 |   100 |    67 |  85.4 |       54
    AIR +AA |   100 |    43 |    88 |    80 |    67 |  75.6 |       58

AIR'S EDGE OVER GROUND — without AA +19.8  |  with AA +10.0  (clear-rate points)

AIR — the KOREAN PEOPLE'S ARMY reference force vs US ARMY posts, with and without AA
FORCE       |    T1 |    T2 |    T3 |    T4 |    T5 |  MEAN | MP LOST%
------------+-------+-------+-------+-------+-------+-------+---------
     GROUND |   100 |    95 |    33 |     0 |     0 |  45.6 |       84
  AIR no AA |   100 |    78 |   100 |    50 |     0 |  65.6 |       57
    AIR +AA |   100 |    68 |   100 |    50 |     0 |  63.6 |       59

AIR'S EDGE OVER GROUND — without AA +20.0  |  with AA +18.0  (clear-rate points)

AIR — the UN COALITION reference force vs PLA posts, with and without AA
FORCE       |    T1 |    T2 |    T3 |    T4 |    T5 |  MEAN | MP LOST%
------------+-------+-------+-------+-------+-------+-------+---------
     GROUND |   100 |   100 |    33 |     0 |    33 |  53.2 |       92
  AIR no AA |   100 |    67 |    67 |    67 |   100 |  80.2 |       57
    AIR +AA |   100 |    67 |    67 |    67 |    67 |  73.6 |       61

AIR'S EDGE OVER GROUND — without AA +27.0  |  with AA +20.4  (clear-rate points)

VETERANCY — UNITED STATES strike force (27 MP), men returned% by tier
RANK    |  ×   |   T1 |   T2 |   T3 |   T4 |   T5 |  MEAN | CLEAR%
--------+------+------+------+------+------+------+-------+-------
GREEN   | 1.00 |   27 |   15 |   18 |   13 |    4 |  15.4 |     80
LINE    | 1.04 |   39 |   15 |   19 |   14 |    5 |  18.4 |     79
VETERAN | 1.09 |   39 |   15 |   20 |   14 |    4 |  18.4 |     79
CADRE   | 1.15 |   42 |   17 |   20 |   21 |   18 |  23.6 |     84

VETERANCY — PLA EXPEDITIONARY FORCE strike force (28 MP), men returned% by tier
RANK    |  ×   |   T1 |   T2 |   T3 |   T4 |   T5 |  MEAN | CLEAR%
--------+------+------+------+------+------+------+-------+-------
GREEN   | 1.00 |   31 |   22 |    7 |    0 |    3 |  12.6 |     64
LINE    | 1.04 |   37 |   27 |    6 |    0 |    3 |  14.6 |     63
VETERAN | 1.09 |   41 |   25 |    6 |    0 |    3 |  15.0 |     63
CADRE   | 1.15 |   52 |   20 |    6 |    0 |    3 |  16.2 |     62

VETERANCY — RUSSIAN GROUND FORCES strike force (27 MP), men returned% by tier
RANK    |  ×   |   T1 |   T2 |   T3 |   T4 |   T5 |  MEAN | CLEAR%
--------+------+------+------+------+------+------+-------+-------
GREEN   | 1.00 |   44 |   26 |   21 |   12 |    3 |  21.2 |     66
LINE    | 1.04 |   52 |   27 |   22 |   12 |    3 |  23.2 |     67
VETERAN | 1.09 |   52 |   31 |   23 |   12 |    3 |  24.2 |     70
CADRE   | 1.15 |   56 |   32 |   25 |   12 |    4 |  25.8 |     73

VETERANCY — KOREAN PEOPLE'S ARMY strike force (27 MP), men returned% by tier
RANK    |  ×   |   T1 |   T2 |   T3 |   T4 |   T5 |  MEAN | CLEAR%
--------+------+------+------+------+------+------+-------+-------
GREEN   | 1.00 |   39 |   39 |    3 |    0 |    1 |  16.4 |     46
LINE    | 1.04 |   50 |   37 |    4 |    0 |    2 |  18.6 |     47
VETERAN | 1.09 |   58 |   37 |    6 |    0 |    2 |  20.6 |     47
CADRE   | 1.15 |   66 |   43 |    8 |    0 |    2 |  23.8 |     52

VETERANCY — UN COALITION strike force (27 MP), men returned% by tier
RANK    |  ×   |   T1 |   T2 |   T3 |   T4 |   T5 |  MEAN | CLEAR%
--------+------+------+------+------+------+------+-------+-------
GREEN   | 1.00 |   20 |   14 |    3 |    0 |    3 |   8.0 |     53
LINE    | 1.04 |   23 |   14 |    3 |    0 |    3 |   8.6 |     53
VETERAN | 1.09 |   23 |   14 |    3 |    0 |    6 |   9.2 |     58
CADRE   | 1.15 |   28 |   14 |    3 |    0 |    7 |  10.4 |     59

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
