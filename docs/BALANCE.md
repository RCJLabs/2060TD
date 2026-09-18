# Balance snapshot (v1.40.0)

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
   2 |    100 |     62 |       11
   3 |    100 |     53 |       11
   4 |     20 |     45 |       91
   5 |     37 |     50 |       79

RAID — UNITED STATES strike force (27 MP) vs PLA Front Line — STRIKE doctrine + fire plan
TIER | CLEAR% | DESTR% | MP LOST%
-----+--------+--------+---------
   1 |    100 |     47 |        7
   2 |    100 |     61 |       10
   3 |    100 |     53 |       10
   4 |     68 |     59 |       64
   5 |     42 |     56 |       75

RAID — UNITED STATES strike force (27 MP) vs PLA Front Line — AIR RAID (rotors + a ground tail)
TIER | CLEAR% | DESTR% | MP LOST%
-----+--------+--------+---------
   1 |    100 |     85 |        5
   2 |     32 |     39 |       85
   3 |     68 |     58 |       53
   4 |     30 |     31 |       86
   5 |     33 |     38 |       78

RAID — PLA EXPEDITIONARY FORCE strike force (26 MP) vs US ARMY Front Line
TIER | CLEAR% | DESTR% | MP LOST%
-----+--------+--------+---------
   1 |    100 |     84 |       19
   2 |    100 |     70 |       23
   3 |    100 |     90 |       29
   4 |     45 |     59 |       87
   5 |     62 |     59 |       82

RAID — PLA EXPEDITIONARY FORCE strike force (26 MP) vs US ARMY Front Line — STRIKE doctrine + fire plan
TIER | CLEAR% | DESTR% | MP LOST%
-----+--------+--------+---------
   1 |    100 |     80 |       19
   2 |    100 |     75 |       20
   3 |    100 |     90 |       20
   4 |     82 |     71 |       70
   5 |     92 |     69 |       64

RAID — PLA EXPEDITIONARY FORCE strike force (26 MP) vs US ARMY Front Line — AIR RAID (rotors + a ground tail)
TIER | CLEAR% | DESTR% | MP LOST%
-----+--------+--------+---------
   1 |    100 |     74 |        5
   2 |     68 |     54 |       68
   3 |     67 |     49 |       54
   4 |      2 |     33 |      100
   5 |     33 |     41 |       81

RAID — RUSSIAN GROUND FORCES strike force (27 MP) vs US ARMY Front Line
TIER | CLEAR% | DESTR% | MP LOST%
-----+--------+--------+---------
   1 |    100 |     55 |        0
   2 |    100 |     51 |       16
   3 |    100 |     52 |       21
   4 |     58 |     50 |       65
   5 |     20 |     44 |       93

RAID — RUSSIAN GROUND FORCES strike force (27 MP) vs US ARMY Front Line — STRIKE doctrine + fire plan
TIER | CLEAR% | DESTR% | MP LOST%
-----+--------+--------+---------
   1 |    100 |     55 |        0
   2 |    100 |     51 |       12
   3 |    100 |     59 |       10
   4 |     72 |     59 |       50
   5 |     37 |     57 |       88

RAID — RUSSIAN GROUND FORCES strike force (27 MP) vs US ARMY Front Line — AIR RAID (rotors + a ground tail)
TIER | CLEAR% | DESTR% | MP LOST%
-----+--------+--------+---------
   1 |    100 |     83 |        6
   2 |     68 |     58 |       59
   3 |     67 |     58 |       54
   4 |      5 |     30 |       99
   5 |     33 |     40 |       74

RAID — KOREAN PEOPLE'S ARMY strike force (26 MP) vs US ARMY Front Line
TIER | CLEAR% | DESTR% | MP LOST%
-----+--------+--------+---------
   1 |     98 |     55 |       34
   2 |     83 |     61 |       54
   3 |     98 |     60 |       54
   4 |     57 |     47 |       80
   5 |      5 |     20 |       99

RAID — KOREAN PEOPLE'S ARMY strike force (26 MP) vs US ARMY Front Line — hunt + raze squads TUNNELED
TIER | CLEAR% | DESTR% | MP LOST%
-----+--------+--------+---------
   1 |    100 |     55 |       37
   2 |     93 |     64 |       52
   3 |     97 |     60 |       44
   4 |     60 |     50 |       79
   5 |     52 |     34 |       81

RAID — KOREAN PEOPLE'S ARMY strike force (26 MP) vs US ARMY Front Line — TUNNELED + STRIKE doctrine + fire plan
TIER | CLEAR% | DESTR% | MP LOST%
-----+--------+--------+---------
   1 |     97 |     54 |       32
   2 |     95 |     65 |       43
   3 |     95 |     59 |       41
   4 |     73 |     57 |       73
   5 |     70 |     41 |       70

RAID — KOREAN PEOPLE'S ARMY strike force (26 MP) vs US ARMY Front Line — STRIKE doctrine + fire plan
TIER | CLEAR% | DESTR% | MP LOST%
-----+--------+--------+---------
   1 |     98 |     55 |       29
   2 |     92 |     64 |       46
   3 |    100 |     61 |       47
   4 |     68 |     54 |       76
   5 |     20 |     31 |       93

RAID — KOREAN PEOPLE'S ARMY strike force (26 MP) vs US ARMY Front Line — AIR RAID (rotors + a ground tail)
TIER | CLEAR% | DESTR% | MP LOST%
-----+--------+--------+---------
   1 |    100 |     79 |        5
   2 |     25 |     37 |       94
   3 |     58 |     49 |       63
   4 |      3 |     35 |       99
   5 |      0 |     32 |      100

RAID — UN COALITION strike force (27 MP) vs PLA Front Line
TIER | CLEAR% | DESTR% | MP LOST%
-----+--------+--------+---------
   1 |    100 |     75 |        0
   2 |    100 |     71 |       13
   3 |    100 |     96 |       18
   4 |     37 |     53 |       85
   5 |     88 |     53 |       85

RAID — UN COALITION strike force (27 MP) vs PLA Front Line — CONTROL: medics replaced by riflemen
TIER | CLEAR% | DESTR% | MP LOST%
-----+--------+--------+---------
   1 |    100 |     71 |       37
   2 |     92 |     72 |       62
   3 |    100 |     61 |       73
   4 |      0 |     21 |      100
   5 |      0 |     26 |      100

RAID — UN COALITION strike force (27 MP) vs PLA Front Line — STRIKE doctrine + fire plan
TIER | CLEAR% | DESTR% | MP LOST%
-----+--------+--------+---------
   1 |    100 |     75 |        0
   2 |    100 |     70 |        7
   3 |    100 |     95 |       13
   4 |     62 |     61 |       66
   5 |     97 |     63 |       70

RAID — UN COALITION strike force (27 MP) vs PLA Front Line — AIR RAID (rotors + a ground tail)
TIER | CLEAR% | DESTR% | MP LOST%
-----+--------+--------+---------
   1 |    100 |     84 |       10
   2 |     47 |     40 |       79
   3 |     82 |     60 |       49
   4 |     33 |     31 |       84
   5 |     35 |     44 |       73

ARCHETYPES — UNITED STATES strike force (27 MP), clear% by tier
SHAPE        | FROM |   T1 |   T2 |   T3 |   T4 |   T5 |  MEAN | DESTR% | MP LOST%
-------------+------+------+------+------+------+------+-------+--------+---------
COMPOUND     |    1 |  100 |  100 |  100 |   67 |  100 |  93.4 |     56 |       25
OPEN CAMP    |    1 |  100 |  100 |  100 |   68 |  100 |  93.6 |     62 |       23
CORRIDOR     |    1 |  100 |  100 |   75 |   52 |   80 |  81.4 |     60 |       39
STAR FORT    |    2 |  100 |  100 |   98 |   45 |    0 |  68.6 |     48 |       44
  └ prepared |      |  100 |  100 |  100 |   65 |    0 |  73.0 |     49 |       40
DISPERSED DEPOT |    3 |  100 |  100 |   58 |   67 |   78 |  80.6 |     56 |       37
  └ prepared |      |  100 |  100 |   85 |   87 |  100 |  94.4 |     57 |       26
STRONGPOINTS |    3 |  100 |  100 |  100 |   67 |   13 |  76.0 |     50 |       39
KEEP         |    4 |  100 |  100 |   62 |    3 |   20 |  57.0 |     48 |       52
BUNKER COMPLEX |    5 |  100 |  100 |   78 |    2 |   38 |  63.6 |     57 |       54
  └ prepared |      |  100 |  100 |   98 |   10 |   50 |  71.6 |     62 |       49

FIELD CONDITIONS — UNITED STATES strike force (27 MP), clear% by tier
CONDITION    |   T1 |   T2 |   T3 |   T4 |   T5 |  MEAN | vs CLEAR
-------------+------+------+------+------+------+-------+---------
CLEAR LINE   |  100 |  100 |  100 |   20 |   37 |  71.4 |     +0.0
HARD RAIN    |  100 |  100 |  100 |   48 |   52 |  80.0 |     +8.6
DUG IN       |  100 |  100 |  100 |    0 |   32 |  66.4 |     -5.0
FUEL CRISIS  |  100 |  100 |  100 |    0 |   25 |  65.0 |     -6.4
BLACKOUT     |  100 |  100 |  100 |   20 |   37 |  71.4 |     +0.0
ATTRITION    |  100 |  100 |  100 |    5 |   28 |  66.6 |     -4.8

TERRAIN — the UNITED STATES reference force vs PLA posts, flat ground vs real
GROUND      |    T1 |    T2 |    T3 |    T4 |    T5 |  MEAN | MP LOST%
------------+-------+-------+-------+-------+-------+-------+---------
       FLAT |   100 |   100 |   100 |    68 |    50 |  83.6 |       32
     GROUND |   100 |   100 |    98 |    37 |    35 |  74.0 |       42
    SHEET 1 |   100 |   100 |   100 |    95 |     0 |  79.0 |       34
    SHEET 2 |   100 |   100 |    95 |     0 |    60 |  71.0 |       48
    SHEET 3 |   100 |   100 |   100 |    15 |    45 |  72.0 |       43

PARITY — every faction at its own best line, same manpower, same ladder
FACTION     |    T1 |    T2 |    T3 |    T4 |    T5 |  MEAN | MP LOST% | LINE
------------+-------+-------+-------+-------+-------+-------+----------+------
UNITED STAT |   100 |   100 |    98 |    37 |    35 |  74.0 |       42 | GROUND
PLA EXPEDIT |   100 |   100 |   100 |    70 |    90 |  92.0 |       40 | GROUND
RUSSIAN GRO |   100 |   100 |    97 |    37 |    25 |  71.8 |       46 | GROUND
KOREAN PEOP |   100 |    83 |    95 |    35 |    45 |  71.6 |       60 | TUNNEL
UN COALITIO |   100 |   100 |    97 |    67 |    62 |  85.2 |       45 | GROUND

SPREAD — 20.4 points between CHINA and NK. Five kits differing in STYLE (GDD §4) should not differ this much in ODDS.

THE DEAL — the three targets a rung offers vs the eight it could offer
SHAPE        |    T1 |    T2 |    T3 |    T4 |    T5 |  MEAN
-------------+-------+-------+-------+-------+-------+-------
keep         |    97 |    79 |    51 |    25 |    27 |  55.7
star         |    97 |    92 |    80 |    39 |    16 |  64.8
strongpoints |   100 |    93 |    96 |    65 |    20 |  74.9
depot        |   100 |   100 |    85 |    57 |    43 |  77.1
corridor     |   100 |    95 |    81 |    71 |    47 |  78.7
bunker       |   100 |    96 |    83 |    52 |    63 |  78.7
compound     |   100 |    91 |    96 |    69 |    85 |  88.3
camp         |   100 |   100 |   100 |    83 |    93 |  95.2

WHAT EACH FACTION IS DEALT — its three targets vs its own pool at that rung
FACTION |          T1 |          T2 |          T3 |          T4 |          T5 |   MEAN GAP
--------+-------------+-------------+-------------+-------------+-------------+-----------
    USA |  100/100 +0 |  100/100 +0 |   76/88 -12 |   40/52 -12 |   33/52 -19 |       -8.8
  CHINA |  100/100 +0 |    87/88 -2 |    98/99 -1 |    80/74 +6 |   82/69 +13 |       +3.2
 RUSSIA |  100/100 +0 |  100/100 +0 |    91/90 +1 |    60/64 -4 |   84/43 +41 |       +7.7
     NK |  100/100 +0 |    78/83 -6 |    89/90 -1 |    42/47 -4 |   56/37 +19 |       +1.6
     UN |  100/100 +0 |  100/100 +0 |    76/82 -7 |    51/55 -4 |    53/44 +9 |       -0.3

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

THE LADDER, pool mean per rung: T1 100  ->  T2 94  ->  T3 90  ->  T4 58  ->  T5 49
STEP SIZE: T1->T2 -6  T2->T3 -5  T3->T4 -31  T4->T5 -9 — POOL mean, at a fixed reference force.
  This is the whole pool, not the deal, and the force is a mature army: the early
  rungs saturate near 100 and no step between them can show. It is here to price
  the SHAPES, not to judge the ladder — `--rungs` does that, by asking how much
  force each rung demands rather than what one army does to all of them.

THE TWO KITS — every force against both sets of fortifications
FORCE   | vs PLA post | vs US firebase |   GAP | normally raids
--------+-------------+----------------+-------+---------------
    USA |        69.3 |           92.7 | -23.4 | CHINA
  CHINA |        66.1 |           85.9 | -19.8 | USA
 RUSSIA |        75.5 |           75.0 |  +0.5 | USA
     NK |        24.0 |           60.9 | -37.0 | USA
     UN |        70.8 |           78.1 |  -7.3 | CHINA

WORST GAP 37.0 points. Two fronts differing in STYLE should not differ this much in DIFFICULTY — whoever raids the softer one is playing on easy and did not choose to.

THE PLAN, NOT THE FACTION — the same roster asked twice
FACTION | REF MP | REFERENCE | RECIPE MP | RECIPE |  BEST | PLAN IS WORTH
--------+--------+-----------+-----------+--------+-------+--------------
    USA |     27 |      75.4 |        26 |   70.0 |  75.4 |          -5.4
  CHINA |     26 |      88.8 |        25 |   75.4 |  88.8 |         -13.3
 RUSSIA |     27 |      80.0 |        27 |   66.3 |  80.0 |         -13.8
     NK |     26 |      72.1 |        26 |   72.1 |  72.1 |          +0.0
     UN |     27 |      76.7 |        24 |   63.7 |  76.7 |         -12.9

PLAN IS WORTH UP TO 13.8 POINTS — comparable to every effect this harness measures. Read BEST as the faction and the last column as the error bar; a single plan's row is not a reading of a kit.
BEST-PLAN SPREAD 16.7 points. `--kits` is unaffected: it holds the force fixed and swaps only the fortifications.

WHAT KILLS A COMMAND POST — the heavy's damage type, which was picked for flavour
FACTION | HEAVY FIRES | vs STRUCT | SHIPPING | ALL EXPLOSIVE | ALL KINETIC | SWING
--------+-------------+-----------+----------+---------------+-------------+------
    USA |   explosive |        x1 |     69.3 |          69.3 |        53.1 | +16.1
  CHINA |   explosive |        x1 |     85.9 |          85.9 |        37.5 | +48.4
 RUSSIA |     kinetic |      x0.5 |     75.0 |          75.0 |        75.0 |  +0.0
     NK |     kinetic |      x0.5 |     65.6 |          65.6 |        65.6 |  +0.0
     UN |     kinetic |      x0.5 |     70.8 |          70.8 |        70.8 |  +0.0

ONE FLAG ON ONE UNIT IS WORTH UP TO 48.4 POINTS. Ranged fire is discounted against structures (smallArms 0.15, kinetic 0.5, explosive 1.0); melee ignores the table but
  only fires when adjacent, which in practice only the heavy manages — it lands 60-84% of the killing blows. Normalising the flag does NOT lift the UN off the floor.

WHO CARRIES A RAID — each unit kind silenced in turn, both damage channels
FACTION | CARRY UNIT   | ITS MP | RAID IS | DEAD WEIGHT (MP delivering nothing)
--------+--------------+--------+---------+------------------------------------
    USA |       abrams |     24 |     99% |                          0 of 27 MP
  CHINA |       type99 |     21 |    100% |                          5 of 26 MP
 RUSSIA |          btr |     27 |    100% |                          0 of 27 MP
     NK |     tunneler |     18 |     25% |                          3 of 26 MP
     UN |          vab |     27 |    100% |                          0 of 27 MP

ONE UNIT IS UP TO 100% OF A RAID. Ending a raid means killing the command post; ranged fire is discounted hard against structures and melee only fires when ADJACENT,
  so the heavy is the only unit that reliably survives to get there and hits hard when it does. Everything else is escort — and a buff to an escort buys nothing.

WHAT THE SEED DECIDES — the same matchup fought 12 times (25% of fire does not tell)
FORCE   | MATCHUPS | DECIDED     | SAME MEN HOME | LENGTH | CLEAR
--------+----------+-------------+---------------+--------+------
    USA |       40 |    32 (80%) |      18 (45%) |    509 |  77.5
  CHINA |       40 |    34 (85%) |      18 (45%) |    907 |  87.3
 RUSSIA |       40 |    32 (80%) |      11 (28%) |    579 |  84.2
     NK |       40 |    15 (38%) |        2 (5%) |   1348 |  66.9
     UN |       40 |    35 (88%) |      15 (38%) |    446 |  78.3
--------+----------+-------------+---------------+--------+------
    ALL |      200 |   148 (74%) |      64 (32%) |    758 |  78.8

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
ARMOUR |  ASSAULT |      77.8 |       59.7 |        40.3
ARMOUR |     HUNT |      81.9 |       76.4 |        61.1
ARMOUR |     RAZE |      72.2 |       77.8 |        91.7
  FOOT |  ASSAULT |      62.5 |       29.2 |        61.1
  FOOT |     HUNT |      44.4 |       40.3 |        54.2
  FOOT |     RAZE |      43.1 |       26.4 |        81.9
 MIXED |  ASSAULT |      75.0 |       55.6 |        44.4
 MIXED |     HUNT |      75.0 |       72.2 |        59.7
 MIXED |     RAZE |      73.6 |       73.6 |        91.7
       best: POST ARMOUR/HUNT  ·  GUNS ARMOUR/RAZE  ·  STORES ARMOUR/RAZE
-------+----------+-----------+------------+------------
CHINA
ARMOUR |  ASSAULT |      95.8 |       72.2 |        58.3
ARMOUR |     HUNT |      88.9 |       76.4 |        72.2
ARMOUR |     RAZE |      93.1 |       93.1 |       100.0
  FOOT |  ASSAULT |       1.4 |        0.0 |         0.0
  FOOT |     HUNT |       2.8 |       11.1 |         0.0
  FOOT |     RAZE |       0.0 |        0.0 |        19.4
 MIXED |  ASSAULT |      88.9 |       66.7 |        51.4
 MIXED |     HUNT |      81.9 |       75.0 |        63.9
 MIXED |     RAZE |      88.9 |       75.0 |        97.2
       best: POST ARMOUR/ASSAULT  ·  GUNS ARMOUR/RAZE  ·  STORES ARMOUR/RAZE
-------+----------+-----------+------------+------------
RUSSIA
ARMOUR |  ASSAULT |      70.8 |       51.4 |        45.8
ARMOUR |     HUNT |      62.5 |       66.7 |        61.1
ARMOUR |     RAZE |      55.6 |       66.7 |        93.1
  FOOT |  ASSAULT |      47.2 |       37.5 |        52.8
  FOOT |     HUNT |      47.2 |       45.8 |        50.0
  FOOT |     RAZE |      45.8 |       44.4 |        81.9
 MIXED |  ASSAULT |      91.7 |       56.9 |        51.4
 MIXED |     HUNT |      88.9 |       81.9 |        68.1
 MIXED |     RAZE |      88.9 |       66.7 |       100.0
       best: POST MIXED/ASSAULT  ·  GUNS MIXED/HUNT  ·  STORES MIXED/RAZE
-------+----------+-----------+------------+------------
NK
ARMOUR |  ASSAULT |      38.9 |       27.8 |        40.3
ARMOUR |     HUNT |      43.1 |       47.2 |        41.7
ARMOUR |     RAZE |      30.6 |       15.3 |        68.1
  FOOT |  ASSAULT |       4.2 |        0.0 |         0.0
  FOOT |     HUNT |      68.1 |       77.8 |         0.0
  FOOT |     RAZE |       1.4 |        0.0 |        87.5
 MIXED |  ASSAULT |       9.7 |        0.0 |         0.0
 MIXED |     HUNT |      68.1 |       86.1 |         0.0
 MIXED |     RAZE |       2.8 |        0.0 |        87.5
       best: POST FOOT/HUNT  ·  GUNS MIXED/HUNT  ·  STORES FOOT/RAZE
-------+----------+-----------+------------+------------
UN
ARMOUR |  ASSAULT |      61.1 |       36.1 |        27.8
ARMOUR |     HUNT |      63.9 |       50.0 |        36.1
ARMOUR |     RAZE |      48.6 |       23.6 |        61.1
  FOOT |  ASSAULT |      58.3 |       34.7 |        56.9
  FOOT |     HUNT |      44.4 |       36.1 |        51.4
  FOOT |     RAZE |      41.7 |       27.8 |        79.2
 MIXED |  ASSAULT |      80.6 |       41.7 |        52.8
 MIXED |     HUNT |      77.8 |       59.7 |        63.9
 MIXED |     RAZE |      61.1 |       54.2 |        88.9
       best: POST MIXED/ASSAULT  ·  GUNS MIXED/HUNT  ·  STORES MIXED/RAZE
-------+----------+-----------+------------+------------

DISTINCT WINNERS 13 of 15. One force topping every column would mean the objective is a label on the same raid; a different force per column is the whole argument for letting a raid declare what it came for.

GARRISON — the UNITED STATES reference force vs PLA posts
CONFIG      |    T1 |    T2 |    T3 |    T4 |    T5 |  MEAN | MP LOST%
------------+-------+-------+-------+-------+-------+-------+---------
    v1.19 W |   100 |   100 |    82 |    30 |    10 |  64.4 |       46
    v1.19 — |   100 |   100 |    95 |    35 |    22 |  70.4 |       43
 GUNS 0.8 W |   100 |   100 |    98 |    43 |    37 |  75.6 |       39
 GUNS 0.8 — |   100 |   100 |    95 |    50 |    42 |  77.4 |       36
    WATCH W |   100 |   100 |    87 |    28 |     8 |  64.6 |       47
    WATCH — |   100 |   100 |    97 |    35 |    12 |  68.8 |       45
  SHIPPED W |   100 |   100 |    98 |    37 |    35 |  74.0 |       42
  SHIPPED — |   100 |   100 |    98 |    50 |    43 |  78.2 |       38

WALL LINE IS WORTH — v1.19 +6.0  |  GUNS 0.8 +1.8  |  WATCH +4.2  |  SHIPPED +4.2  (clear-rate points to the defender)

AIR — the UNITED STATES reference force vs PLA posts, with and without AA
      GROUND reference 27 MP, AIR plan 30 MP, so the edge is read against GROUND =30
FORCE       |    T1 |    T2 |    T3 |    T4 |    T5 |  MEAN | MP LOST%
------------+-------+-------+-------+-------+-------+-------+---------
     GROUND |   100 |   100 |    98 |    37 |    35 |  74.0 |       42
 GROUND =30 |   100 |   100 |   100 |    45 |    52 |  79.4 |       38
 AIR mounts |   100 |    50 |    18 |    70 |    38 |  55.2 |       58
AIR +manpads |   100 |    42 |     7 |    67 |    10 |  45.2 |       64

AIR'S EDGE OVER MATCHED GROUND — vs mounts -24.2  |  vs mounts+manpads -34.2  (clear-rate points, both forces at 30 MP)

AIR — the PLA EXPEDITIONARY FORCE reference force vs US ARMY posts, with and without AA
      GROUND reference 26 MP, AIR plan 30 MP, so the edge is read against GROUND =30
FORCE       |    T1 |    T2 |    T3 |    T4 |    T5 |  MEAN | MP LOST%
------------+-------+-------+-------+-------+-------+-------+---------
     GROUND |   100 |   100 |   100 |    70 |    90 |  92.0 |       40
 GROUND =30 |   100 |   100 |   100 |    65 |    60 |  85.0 |       51
 AIR mounts |   100 |    65 |    37 |    67 |    35 |  60.8 |       57
AIR +manpads |   100 |    62 |    33 |    67 |    33 |  59.0 |       59

AIR'S EDGE OVER MATCHED GROUND — vs mounts -24.2  |  vs mounts+manpads -26.0  (clear-rate points, both forces at 30 MP)

AIR — the RUSSIAN GROUND FORCES reference force vs US ARMY posts, with and without AA
      GROUND reference 27 MP, AIR plan 27 MP — already matched, so GROUND =N must repeat GROUND exactly
FORCE       |    T1 |    T2 |    T3 |    T4 |    T5 |  MEAN | MP LOST%
------------+-------+-------+-------+-------+-------+-------+---------
     GROUND |   100 |   100 |    97 |    37 |    25 |  71.8 |       46
 GROUND =27 |   100 |   100 |    97 |    37 |    25 |  71.8 |       46
 AIR mounts |   100 |    67 |    57 |    22 |     0 |  49.2 |       65
AIR +manpads |   100 |    62 |    35 |    22 |     0 |  43.8 |       67

AIR'S EDGE OVER MATCHED GROUND — vs mounts -22.6  |  vs mounts+manpads -28.0  (clear-rate points, both forces at 27 MP)

AIR — the KOREAN PEOPLE'S ARMY reference force vs US ARMY posts, with and without AA
      GROUND reference 26 MP, AIR plan 29 MP, so the edge is read against GROUND =29
FORCE       |    T1 |    T2 |    T3 |    T4 |    T5 |  MEAN | MP LOST%
------------+-------+-------+-------+-------+-------+-------+---------
     GROUND |   100 |    60 |    97 |    38 |    22 |  63.4 |       65
 GROUND =29 |    97 |    80 |    97 |    47 |    45 |  73.2 |       60
 AIR mounts |   100 |    12 |    45 |     0 |     0 |  31.4 |       77
AIR +manpads |   100 |     0 |    40 |     0 |     0 |  28.0 |       79

AIR'S EDGE OVER MATCHED GROUND — vs mounts -41.8  |  vs mounts+manpads -45.2  (clear-rate points, both forces at 29 MP)

AIR — the UN COALITION reference force vs PLA posts, with and without AA
      GROUND reference 27 MP, AIR plan 30 MP, so the edge is read against GROUND =30
FORCE       |    T1 |    T2 |    T3 |    T4 |    T5 |  MEAN | MP LOST%
------------+-------+-------+-------+-------+-------+-------+---------
     GROUND |   100 |   100 |    97 |    67 |    62 |  85.2 |       45
 GROUND =30 |   100 |   100 |    97 |    67 |    62 |  85.2 |       42
 AIR mounts |   100 |    18 |    72 |    62 |    42 |  58.8 |       63
AIR +manpads |   100 |    10 |    45 |    38 |    32 |  45.0 |       68

AIR'S EDGE OVER MATCHED GROUND — vs mounts -26.4  |  vs mounts+manpads -40.2  (clear-rate points, both forces at 30 MP)

WHAT AIR CHARGES — smallest manpower that clears half the time, by plan shape
FACTION     | SHAPE  |    T1 |    T2 |    T3 |    T4 |    T5 |  MEAN
------------+--------+-------+-------+-------+-------+-------+-------
UNITED STAT | GROUND |    11 |    11 |    14 |    33 |    38 |  21.4
            | AIR    |    12 |    38 |    38 |    12 |    54 |  30.8
            | x      |  1.1x |  3.5x |  2.7x |  0.4x |  1.4x |  1.4x
PLA EXPEDIT | GROUND |     9 |    16 |    20 |    28 |    28 |  20.2
            | AIR    |     8 |    24 |    38 |    24 |    46 |  28.0
            | x      |  0.9x |  1.5x |  1.9x |  0.9x |  1.6x |  1.4x
RUSSIAN GRO | GROUND |     6 |    12 |    15 |    33 |    33 |  19.8
            | AIR    |    16 |    23 |    33 |    38 |    45 |  31.0
            | x      |  2.7x |  1.9x |  2.2x |  1.2x |  1.4x |  1.6x
KOREAN PEOP | GROUND |     9 |    16 |    12 |    28 |    28 |  18.6
            | AIR    |     6 |    39 |    33 |    46 |    54 |  35.6
            | x      |  0.7x |  2.4x |  2.8x |  1.6x |  1.9x |  1.9x
UN COALITIO | GROUND |     6 |    12 |    18 |    15 |    27 |  15.6
            | AIR    |    12 |    46 |    38 |    38 |    46 |  36.0
            | x      |  2.0x |  3.8x |  2.1x |  2.5x |  1.7x |  2.3x

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
            |   T2 | compound     |    100 |  10 | -#########
            |      | camp         |    100 | 100 | +
            |      | star         |    100 |  10 | -#########
            |   T3 | corridor     |     90 |   0 | -#########
            |      | camp         |     80 |  15 | -#######
            |      | depot        |    100 |   0 | -##########
            |   T4 | star         |     75 | 100 | +###
            |      | keep         |      0 |   0 | +
            |      | strongpoints |      0 | 100 | +##########
            |   T5 | bunker       |      0 |   0 | +
            |      | corridor     |     85 |   0 | -#########
            |      | star         |      0 |  25 | +###
            |      | MEAN / SPLIT |     69 |  44 | r=+0.18  30+ easier 1, harder 6

PLA EXPEDIT |   T1 | compound     |    100 | 100 | +
            |      | camp         |    100 | 100 | +
            |      | corridor     |    100 | 100 | +
            |   T2 | compound     |     90 |  15 | -########
            |      | camp         |    100 | 100 | +
            |      | star         |    100 |  70 | -###
            |   T3 | star         |    100 |   0 | -##########
            |      | depot        |    100 |   0 | -##########
            |      | strongpoints |    100 | 100 | +
            |   T4 | compound     |      5 |   0 | -#
            |      | strongpoints |    100 | 100 | +
            |      | keep         |      0 |  90 | +#########
            |   T5 | compound     |    100 |   5 | -##########
            |      | strongpoints |     10 | 100 | +#########
            |      | bunker       |     10 |   0 | -#
            |      | MEAN / SPLIT |     74 |  59 | r=+0.16  30+ easier 2, harder 5

RUSSIAN GRO |   T1 | compound     |    100 | 100 | +
            |      | camp         |    100 | 100 | +
            |      | corridor     |    100 | 100 | +
            |   T2 | compound     |     65 |   5 | -######
            |      | camp         |    100 | 100 | +
            |      | star         |    100 |  80 | -##
            |   T3 | camp         |    100 |  10 | -#########
            |      | corridor     |     45 |  60 | +##
            |      | depot        |    100 |  30 | -#######
            |   T4 | strongpoints |     95 |  65 | -###
            |      | keep         |      5 |   0 | -#
            |      | compound     |      0 |   0 | +
            |   T5 | camp         |     65 |   0 | -#######
            |      | bunker       |      0 |   0 | +
            |      | compound     |      0 |   0 | +
            |      | MEAN / SPLIT |     65 |  43 | r=+0.71  30+ easier 0, harder 5

KOREAN PEOP |   T1 | compound     |    100 | 100 | +
            |      | camp         |    100 | 100 | +
            |      | corridor     |    100 | 100 | +
            |   T2 | compound     |     70 |   0 | -#######
            |      | corridor     |     90 |   0 | -#########
            |      | star         |     90 |  10 | -########
            |   T3 | depot        |    100 |   0 | -##########
            |      | compound     |     95 |  10 | -#########
            |      | strongpoints |     85 | 100 | +##
            |   T4 | compound     |      0 |   0 | +
            |      | keep         |      0 |   0 | +
            |      | camp         |    100 |   0 | -##########
            |   T5 | compound     |     35 |   0 | -####
            |      | corridor     |     50 |   0 | -#####
            |      | bunker       |     50 |   0 | -#####
            |      | MEAN / SPLIT |     71 |  28 | r=+0.47  30+ easier 0, harder 9

UN COALITIO |   T1 | compound     |    100 | 100 | +
            |      | camp         |    100 | 100 | +
            |      | corridor     |    100 | 100 | +
            |   T2 | camp         |    100 |   0 | -##########
            |      | corridor     |    100 |  15 | -#########
            |      | star         |    100 |   0 | -##########
            |   T3 | star         |     65 | 100 | +####
            |      | compound     |     80 |  45 | -####
            |      | depot        |    100 |   0 | -##########
            |   T4 | compound     |    100 |   0 | -##########
            |      | keep         |      0 |   5 | +#
            |      | strongpoints |    100 | 100 | +
            |   T5 | bunker       |     15 |   5 | -#
            |      | compound     |      0 |   0 | +
            |      | strongpoints |     90 |  90 | +
            |      | MEAN / SPLIT |     77 |  44 | r=+0.36  30+ easier 1, harder 6

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
            |   T2 | compound     |       48 |     106 |         10
            |      | camp         |       48 |      52 |        100
            |      | star         |       48 |     244 |         10
            |   T3 | corridor     |       48 |     141 |          0
            |      | camp         |       48 |     183 |         15
            |      | depot        |       48 |     205 |          0
            |   T4 | star         |       48 |      50 |        100
            |      | keep         |       48 |      75 |          0
            |      | strongpoints |        0 |       0 |        100
            |   T5 | bunker       |       48 |     163 |          0
            |      | corridor     |       48 |     204 |          0
            |      | star         |       48 |     215 |         25

PLA EXPEDIT |   T1 | compound     |        0 |       0 |        100
            |      | camp         |        0 |       0 |        100
            |      | corridor     |        0 |       0 |        100
            |   T2 | compound     |        0 |      58 |         15
            |      | camp         |       47 |      43 |        100
            |      | star         |       47 |     179 |         70
            |   T3 | star         |       47 |     140 |          0
            |      | depot        |        0 |     108 |          0
            |      | strongpoints |        0 |       0 |        100
            |   T4 | compound     |       47 |      69 |          0
            |      | strongpoints |        0 |      36 |        100
            |      | keep         |       47 |      16 |         90
            |   T5 | compound     |       47 |      69 |          5
            |      | strongpoints |        0 |       0 |        100
            |      | bunker       |       47 |     143 |          0

RUSSIAN GRO |   T1 | compound     |        0 |       0 |        100
            |      | camp         |        0 |       0 |        100
            |      | corridor     |        0 |       0 |        100
            |   T2 | compound     |       47 |      73 |          5
            |      | camp         |       47 |      83 |        100
            |      | star         |       47 |     158 |         80
            |   T3 | camp         |       47 |     122 |         10
            |      | corridor     |       47 |     152 |         60
            |      | depot        |       47 |     133 |         30
            |   T4 | strongpoints |        0 |      43 |         65
            |      | keep         |        0 |      33 |          0
            |      | compound     |       47 |      70 |          0
            |   T5 | camp         |       47 |     141 |          0
            |      | bunker       |       47 |     138 |          0
            |      | compound     |       47 |      84 |          0

KOREAN PEOP |   T1 | compound     |        0 |       0 |        100
            |      | camp         |        0 |       0 |        100
            |      | corridor     |        0 |       0 |        100
            |   T2 | compound     |       47 |      96 |          0
            |      | corridor     |       47 |     121 |          0
            |      | star         |       47 |     149 |         10
            |   T3 | depot        |        0 |      86 |          0
            |      | compound     |        0 |      10 |         10
            |      | strongpoints |        0 |       0 |        100
            |   T4 | compound     |       47 |      76 |          0
            |      | keep         |        0 |      36 |          0
            |      | camp         |       47 |     126 |          0
            |   T5 | compound     |       47 |      92 |          0
            |      | corridor     |       47 |     122 |          0
            |      | bunker       |       47 |     124 |          0

UN COALITIO |   T1 | compound     |        0 |       0 |        100
            |      | camp         |        0 |       0 |        100
            |      | corridor     |        0 |       0 |        100
            |   T2 | camp         |       48 |     162 |          0
            |      | corridor     |       48 |     183 |         15
            |      | star         |       48 |     191 |          0
            |   T3 | star         |       48 |      48 |        100
            |      | compound     |       48 |      63 |         45
            |      | depot        |       48 |     161 |          0
            |   T4 | compound     |        0 |      76 |          0
            |      | keep         |        0 |      62 |          5
            |      | strongpoints |        0 |       0 |        100
            |   T5 | bunker       |       48 |     138 |          5
            |      | compound     |       48 |     111 |          0
            |      | strongpoints |        0 |       0 |         90

PREDICTOR                                   |     r |    r^2
--------------------------------------------+-------+-------
OVERHEAD flak DPS over the post             | -0.55 |   0.30
TRANSIT DPS-seconds on the way in           | -0.70 |   0.49
OVERHEAD + TRANSIT                          | -0.69 |   0.48
SHAPE alone (the incumbent, flattered)      | +0.56 |   0.31

  The bar is the last row. A player is told the shape for free, so a read that
  cannot beat predicting from the shape alone has bought nothing — and the shape
  baseline is scored on the very rows it was fitted to, which flatters it.

PER FACTION — a predictor carried by one roster is not a predictor
FACTION     | TRANSIT r | SHAPE r
------------+-----------+--------
UNITED STAT |     -0.84 |   +0.53
PLA EXPEDIT |     -0.68 |   +0.68
RUSSIAN GRO |     -0.42 |   +0.44
KOREAN PEOP |     -0.78 |   +0.53
UN COALITIO |     -0.85 |   +0.57

BANDS — cut at the terciles of transit, then measured
BAND  | TRANSIT       | TARGETS | MEAN AIR CLEAR%
------+---------------+---------+----------------
GOOD  | under 36      |      25 |            87.6
FAIR  | 36 to 122     |      25 |            30.0
POOR  | over 122      |      25 |            13.2

  The bands are the shippable form: a player cannot read DPS-seconds, and three
  words is the whole budget the target list has. The cuts are terciles of the
  measured population rather than round numbers, so they cannot be tuned to
  flatter the result.

VETERANCY — UNITED STATES strike force (27 MP), men returned% by tier
RANK    |  ×   |   T1 |   T2 |   T3 |   T4 |   T5 |  MEAN | CLEAR%
--------+------+------+------+------+------+------+-------+-------
GREEN   | 1.00 |   78 |   75 |   62 |   23 |   10 |  49.6 |     74
LINE    | 1.04 |   77 |   75 |   63 |   30 |   11 |  51.2 |     77
VETERAN | 1.09 |   78 |   75 |   65 |   50 |   13 |  56.2 |     83
CADRE   | 1.15 |   78 |   75 |   70 |   60 |   19 |  60.4 |     88

VETERANCY — PLA EXPEDITIONARY FORCE strike force (26 MP), men returned% by tier
RANK    |  ×   |   T1 |   T2 |   T3 |   T4 |   T5 |  MEAN | CLEAR%
--------+------+------+------+------+------+------+-------+-------
GREEN   | 1.00 |   50 |   43 |   41 |   20 |   33 |  37.4 |     92
LINE    | 1.04 |   50 |   47 |   45 |   27 |   36 |  41.0 |     95
VETERAN | 1.09 |   50 |   51 |   47 |   30 |   41 |  43.8 |     97
CADRE   | 1.15 |   50 |   50 |   46 |   34 |   44 |  44.8 |     98

VETERANCY — RUSSIAN GROUND FORCES strike force (27 MP), men returned% by tier
RANK    |  ×   |   T1 |   T2 |   T3 |   T4 |   T5 |  MEAN | CLEAR%
--------+------+------+------+------+------+------+-------+-------
GREEN   | 1.00 |   99 |   74 |   69 |   12 |   14 |  53.6 |     72
LINE    | 1.04 |   99 |   84 |   74 |   21 |   20 |  59.6 |     78
VETERAN | 1.09 |  100 |   88 |   78 |   29 |   25 |  64.0 |     82
CADRE   | 1.15 |  100 |   89 |   82 |   36 |   36 |  68.6 |     86

VETERANCY — KOREAN PEOPLE'S ARMY strike force (26 MP), men returned% by tier
RANK    |  ×   |   T1 |   T2 |   T3 |   T4 |   T5 |  MEAN | CLEAR%
--------+------+------+------+------+------+------+-------+-------
GREEN   | 1.00 |   75 |   24 |   46 |   12 |    7 |  32.8 |     63
LINE    | 1.04 |   80 |   25 |   53 |   15 |    9 |  36.4 |     68
VETERAN | 1.09 |   76 |   31 |   53 |   17 |   16 |  38.6 |     74
CADRE   | 1.15 |   79 |   34 |   54 |   24 |   24 |  43.0 |     82

VETERANCY — UN COALITION strike force (27 MP), men returned% by tier
RANK    |  ×   |   T1 |   T2 |   T3 |   T4 |   T5 |  MEAN | CLEAR%
--------+------+------+------+------+------+------+-------+-------
GREEN   | 1.00 |  100 |   69 |   46 |   44 |   16 |  55.0 |     85
LINE    | 1.04 |  100 |   70 |   50 |   46 |   16 |  56.4 |     84
VETERAN | 1.09 |  100 |   72 |   64 |   50 |   23 |  61.8 |     86
CADRE   | 1.15 |  100 |   71 |   71 |   61 |   24 |  65.4 |     89

DEFENSE — UNITED STATES permanent layer vs PLA assault ladder (hold%)
STAGE       |   L1 |   L2 |   L3 |   L4 |   L5 |   L6
------------+------+------+------+------+------+------
EARLY (CC1) |  100 |  100 |    0 |    0 |    0 |    0
MID (CC2)   |  100 |  100 |  100 |   75 |   70 |    0
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
MID (CC2)   |  100 |  100 |  100 |  100 |   95 |   50
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
MID (CC2)   |  100 |  100 |   35 |    0 |    0 |    0
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
MID (CC2)   |  100 |  100 |   85 |    0 |    0 |    0
LATE (CC3)  |  100 |  100 |  100 |   95 |    5 |    0

DEFENSE — PLA EXPEDITIONARY FORCE permanent layer vs US ARMY assault ladder (hold%) — FORTIFY doctrine
STAGE       |   L1 |   L2 |   L3 |   L4 |   L5 |   L6
------------+------+------+------+------+------+------
EARLY (CC1) |  100 |  100 |    0 |    0 |    0 |    0
MID (CC2)   |  100 |  100 |   80 |    0 |    0 |    0
LATE (CC3)  |  100 |  100 |  100 |    0 |   10 |    0

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
MID (CC2)   |  100 |  100 |  100 |  100 |   90 |    0
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
EARLY (CC1) |  100 |   85 |    0 |    0 |    0 |    0
MID (CC2)   |  100 |  100 |   25 |    0 |    0 |    0
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
MID (CC2)   |  100 |  100 |   65 |    0 |    0 |    0
LATE (CC3)  |  100 |  100 |  100 |   35 |    0 |    0

DEFENSE — KOREAN PEOPLE'S ARMY permanent layer vs US ARMY assault ladder (hold%) — COUNTERBATTERY standing orders
STAGE       |   L1 |   L2 |   L3 |   L4 |   L5 |   L6
------------+------+------+------+------+------+------
EARLY (CC1) |  100 |  100 |    0 |    0 |    0 |    0
MID (CC2)   |  100 |  100 |   30 |    0 |    0 |    0
LATE (CC3)  |  100 |  100 |  100 |    0 |    0 |    0

DEFENSE — KOREAN PEOPLE'S ARMY permanent layer vs US ARMY assault ladder (hold%) — TRIPWIRE standing orders
STAGE       |   L1 |   L2 |   L3 |   L4 |   L5 |   L6
------------+------+------+------+------+------+------
EARLY (CC1) |  100 |  100 |    0 |    0 |    0 |    0
MID (CC2)   |  100 |  100 |   40 |    0 |    0 |    0
LATE (CC3)  |  100 |  100 |  100 |    0 |    0 |    0

DEFENSE — KOREAN PEOPLE'S ARMY permanent layer vs US ARMY assault ladder (hold%) — FORTIFY doctrine
STAGE       |   L1 |   L2 |   L3 |   L4 |   L5 |   L6
------------+------+------+------+------+------+------
EARLY (CC1) |  100 |  100 |    0 |    0 |    0 |    0
MID (CC2)   |  100 |  100 |   55 |    0 |    0 |    0
LATE (CC3)  |  100 |  100 |  100 |    0 |    5 |    0

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
MID (CC2)   |  100 |  100 |  100 |    0 |    0 |    0
LATE (CC3)  |  100 |  100 |  100 |   10 |    0 |    0

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
