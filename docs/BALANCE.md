# Balance snapshot (v1.45.0)

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

```
RAID — UNITED STATES strike force (25 MP) vs PLA Front Line
TIER | CLEAR% | DESTR% | MP LOST%
-----+--------+--------+---------
   1 |    100 |     60 |        5
   2 |    100 |     55 |       23
   3 |     83 |     73 |       40
   4 |     25 |     43 |       87
   5 |      7 |     30 |       97

RAID — UNITED STATES strike force (25 MP) vs PLA Front Line — STRIKE doctrine + fire plan
TIER | CLEAR% | DESTR% | MP LOST%
-----+--------+--------+---------
   1 |    100 |     60 |        4
   2 |    100 |     55 |       20
   3 |     97 |     76 |       26
   4 |     62 |     53 |       70
   5 |     30 |     43 |       81

RAID — UNITED STATES strike force (25 MP) vs PLA Front Line — AIR RAID (rotors + a ground tail)
TIER | CLEAR% | DESTR% | MP LOST%
-----+--------+--------+---------
   1 |     57 |     91 |       51
   2 |      0 |     22 |      100
   3 |     13 |     59 |       92
   4 |      0 |     43 |      100
   5 |      3 |     53 |       99

RAID — PLA EXPEDITIONARY FORCE strike force (26 MP) vs US ARMY Front Line
TIER | CLEAR% | DESTR% | MP LOST%
-----+--------+--------+---------
   1 |    100 |     71 |       11
   2 |    100 |     75 |       32
   3 |     67 |     76 |       46
   4 |     67 |     59 |       58
   5 |     42 |     65 |       83

RAID — PLA EXPEDITIONARY FORCE strike force (26 MP) vs US ARMY Front Line — STRIKE doctrine + fire plan
TIER | CLEAR% | DESTR% | MP LOST%
-----+--------+--------+---------
   1 |    100 |     72 |       11
   2 |    100 |     76 |       24
   3 |     68 |     79 |       42
   4 |     92 |     64 |       40
   5 |     57 |     73 |       69

RAID — PLA EXPEDITIONARY FORCE strike force (26 MP) vs US ARMY Front Line — AIR RAID (rotors + a ground tail)
TIER | CLEAR% | DESTR% | MP LOST%
-----+--------+--------+---------
   1 |     55 |     93 |       45
   2 |      0 |     47 |      100
   3 |     33 |     66 |       82
   4 |      0 |     43 |      100
   5 |      0 |     57 |      100

RAID — RUSSIAN GROUND FORCES strike force (27 MP) vs US ARMY Front Line
TIER | CLEAR% | DESTR% | MP LOST%
-----+--------+--------+---------
   1 |    100 |     83 |       19
   2 |     98 |     86 |       28
   3 |     98 |     91 |       33
   4 |     63 |     75 |       70
   5 |     43 |     66 |       84

RAID — RUSSIAN GROUND FORCES strike force (27 MP) vs US ARMY Front Line — STRIKE doctrine + fire plan
TIER | CLEAR% | DESTR% | MP LOST%
-----+--------+--------+---------
   1 |    100 |     81 |       15
   2 |    100 |     87 |       21
   3 |    100 |     90 |       21
   4 |     98 |     85 |       42
   5 |     57 |     71 |       71

RAID — RUSSIAN GROUND FORCES strike force (27 MP) vs US ARMY Front Line — AIR RAID (rotors + a ground tail)
TIER | CLEAR% | DESTR% | MP LOST%
-----+--------+--------+---------
   1 |     52 |     92 |       49
   2 |      0 |     43 |      100
   3 |     27 |     68 |       79
   4 |      0 |     49 |      100
   5 |      0 |     61 |      100

RAID — KOREAN PEOPLE'S ARMY strike force (26 MP) vs US ARMY Front Line
TIER | CLEAR% | DESTR% | MP LOST%
-----+--------+--------+---------
   1 |    100 |     71 |       21
   2 |     98 |     75 |       28
   3 |    100 |     71 |       35
   4 |     65 |     66 |       75
   5 |     57 |     52 |       72

RAID — KOREAN PEOPLE'S ARMY strike force (26 MP) vs US ARMY Front Line — hunt + raze squads TUNNELED
TIER | CLEAR% | DESTR% | MP LOST%
-----+--------+--------+---------
   1 |    100 |     67 |       20
   2 |     87 |     80 |       43
   3 |    100 |     75 |       21
   4 |     83 |     73 |       62
   5 |     57 |     56 |       75

RAID — KOREAN PEOPLE'S ARMY strike force (26 MP) vs US ARMY Front Line — TUNNELED + STRIKE doctrine + fire plan
TIER | CLEAR% | DESTR% | MP LOST%
-----+--------+--------+---------
   1 |    100 |     68 |       16
   2 |    100 |     87 |       27
   3 |    100 |     77 |       20
   4 |     98 |     75 |       47
   5 |     60 |     60 |       67

RAID — KOREAN PEOPLE'S ARMY strike force (26 MP) vs US ARMY Front Line — STRIKE doctrine + fire plan
TIER | CLEAR% | DESTR% | MP LOST%
-----+--------+--------+---------
   1 |    100 |     73 |       14
   2 |    100 |     79 |       23
   3 |    100 |     76 |       28
   4 |     82 |     73 |       58
   5 |     65 |     56 |       63

RAID — KOREAN PEOPLE'S ARMY strike force (26 MP) vs US ARMY Front Line — AIR RAID (rotors + a ground tail)
TIER | CLEAR% | DESTR% | MP LOST%
-----+--------+--------+---------
   1 |     77 |     97 |       25
   2 |      0 |     28 |      100
   3 |     33 |     52 |       89
   4 |      0 |     44 |      100
   5 |      0 |     54 |      100

RAID — UN COALITION strike force (26 MP) vs PLA Front Line
TIER | CLEAR% | DESTR% | MP LOST%
-----+--------+--------+---------
   1 |    100 |     79 |       11
   2 |    100 |     88 |       21
   3 |     63 |     81 |       55
   4 |     32 |     64 |       86
   5 |      5 |     62 |       98

RAID — UN COALITION strike force (26 MP) vs PLA Front Line — CONTROL: medics replaced by riflemen
TIER | CLEAR% | DESTR% | MP LOST%
-----+--------+--------+---------
   1 |     73 |     79 |       69
   2 |     37 |     54 |       83
   3 |      7 |     54 |       98
   4 |      0 |     33 |      100
   5 |      0 |     35 |      100

RAID — UN COALITION strike force (26 MP) vs PLA Front Line — STRIKE doctrine + fire plan
TIER | CLEAR% | DESTR% | MP LOST%
-----+--------+--------+---------
   1 |    100 |     82 |       11
   2 |    100 |     88 |       14
   3 |     85 |     92 |       39
   4 |     77 |     81 |       58
   5 |     47 |     73 |       83

RAID — UN COALITION strike force (26 MP) vs PLA Front Line — AIR RAID (rotors + a ground tail)
TIER | CLEAR% | DESTR% | MP LOST%
-----+--------+--------+---------
   1 |      0 |     82 |      100
   2 |      0 |     25 |      100
   3 |      5 |     59 |       97
   4 |      0 |     46 |      100
   5 |      3 |     56 |       99

ARCHETYPES — UNITED STATES strike force (25 MP), clear% by tier
SHAPE        | FROM |   T1 |   T2 |   T3 |   T4 |   T5 |  MEAN | DESTR% | MP LOST%
-------------+------+------+------+------+------+------+-------+--------+---------
COMPOUND     |    1 |  100 |  100 |   82 |   83 |   67 |  86.4 |     54 |       29
OPEN CAMP    |    1 |  100 |  100 |   78 |   33 |    5 |  63.2 |     74 |       54
CORRIDOR     |    1 |  100 |  100 |   42 |    8 |   35 |  57.0 |     58 |       58
STAR FORT    |    2 |  100 |  100 |   73 |    5 |    0 |  55.6 |     51 |       59
  └ prepared |      |  100 |  100 |   97 |   27 |    0 |  64.8 |     58 |       52
DISPERSED DEPOT |    3 |  100 |  100 |   67 |   10 |   15 |  58.4 |     50 |       57
  └ prepared |      |  100 |  100 |   92 |   33 |   27 |  70.4 |     54 |       52
STRONGPOINTS |    3 |  100 |  100 |   92 |   68 |    2 |  72.4 |     53 |       43
KEEP         |    4 |  100 |  100 |   72 |   62 |    7 |  68.2 |     51 |       49
BUNKER COMPLEX |    5 |  100 |  100 |   48 |   32 |   17 |  59.4 |     66 |       53
  └ prepared |      |  100 |  100 |   77 |   40 |   53 |  74.0 |     71 |       43

FIELD CONDITIONS — UNITED STATES strike force (25 MP), clear% by tier
CONDITION    |   T1 |   T2 |   T3 |   T4 |   T5 |  MEAN | vs CLEAR
-------------+------+------+------+------+------+-------+---------
CLEAR LINE   |  100 |  100 |   83 |   25 |    7 |  63.0 |     +0.0
HARD RAIN    |  100 |  100 |  100 |   58 |   28 |  77.2 |    +14.2
DUG IN       |  100 |  100 |   70 |    5 |    0 |  55.0 |     -8.0
FUEL CRISIS  |  100 |  100 |   62 |    2 |    0 |  52.8 |    -10.2
BLACKOUT     |  100 |  100 |   83 |   25 |    7 |  63.0 |     +0.0
ATTRITION    |  100 |  100 |   75 |   12 |    0 |  57.4 |     -5.6

TERRAIN — the UNITED STATES reference force vs PLA posts, flat ground vs real
GROUND      |    T1 |    T2 |    T3 |    T4 |    T5 |  MEAN | MP LOST%
------------+-------+-------+-------+-------+-------+-------+---------
       FLAT |   100 |   100 |    85 |    52 |     3 |  68.0 |       46
     GROUND |   100 |   100 |    90 |    72 |    42 |  80.8 |       38
    SHEET 1 |   100 |   100 |    75 |    50 |    50 |  75.0 |       40
    SHEET 2 |   100 |   100 |    95 |    65 |    30 |  78.0 |       43
    SHEET 3 |   100 |   100 |   100 |   100 |    45 |  89.0 |       30

PARITY — every faction at its own best line, same manpower, same ladder
FACTION     |    T1 |    T2 |    T3 |    T4 |    T5 |  MEAN | MP LOST% | LINE
------------+-------+-------+-------+-------+-------+-------+----------+------
UNITED STAT |   100 |   100 |    90 |    72 |    42 |  80.8 |       38 | GROUND
PLA EXPEDIT |   100 |    98 |    78 |    80 |    50 |  81.2 |       43 | GROUND
RUSSIAN GRO |   100 |    93 |    92 |    58 |    48 |  78.2 |       50 | GROUND
KOREAN PEOP |   100 |    98 |    88 |    72 |    57 |  83.0 |       55 | TUNNEL
UN COALITIO |   100 |    93 |    65 |    65 |    52 |  75.0 |       51 | GROUND

SPREAD — 8.0 points between NK and UN. Five kits differing in STYLE (GDD §4) should not differ this much in ODDS.

THE DEAL — the three targets a rung offers vs the eight it could offer
SHAPE        |    T1 |    T2 |    T3 |    T4 |    T5 |  MEAN
-------------+-------+-------+-------+-------+-------+-------
keep         |   100 |    80 |    68 |    29 |    17 |  58.9
star         |   100 |    96 |    76 |    23 |     0 |  58.9
depot        |   100 |    96 |    89 |    36 |    27 |  69.6
corridor     |   100 |   100 |    71 |    49 |    37 |  71.5
bunker       |   100 |    93 |    72 |    47 |    53 |  73.1
compound     |   100 |    93 |    59 |    72 |    44 |  73.6
strongpoints |   100 |   100 |    96 |    75 |    19 |  77.9
camp         |   100 |   100 |    96 |    68 |    65 |  85.9

WHAT EACH FACTION IS DEALT — its three targets vs its own pool at that rung
FACTION |          T1 |          T2 |          T3 |          T4 |          T5 |   MEAN GAP
--------+-------------+-------------+-------------+-------------+-------------+-----------
    USA |  100/100 +0 |  100/100 +0 |   62/72 -10 |   60/39 +21 |   40/21 +19 |       +6.0
  CHINA |  100/100 +0 |    93/95 -2 |   69/80 -11 |   84/64 +21 |   62/48 +14 |       +4.3
 RUSSIA |  100/100 +0 |    98/98 -1 |    91/90 +1 |   64/53 +11 |   58/34 +24 |       +7.1
     NK |  100/100 +0 |    91/93 -2 |    93/96 -2 |    67/66 +1 |   69/46 +23 |       +3.9
     UN |  100/100 +0 |  100/100 +0 |    62/68 -6 |   49/30 +19 |   27/15 +12 |       +5.1

  dealt/pool and the gap. A deal that tracks its pool is offering that faction
  a fair read of the rung; a big negative gap is a rung of walls.

SHAPE COVERAGE — the rungs each faction is dealt each shape on
SHAPE        |         USA |       CHINA |      RUSSIA |          NK |          UN
-------------+-------------+-------------+-------------+-------------+-------------
compound     | T1,T2,T4,T5 | T1,T2,T3,T4 | T1,T2,T4,T5 | T1,T2,T4,T5 | T1,T2,T3,T4,T5
camp         |    T1,T2,T4 |       T1,T4 |    T1,T4,T5 |       T1,T4 |       T1,T5
corridor     |       T1,T3 | T1,T2,T3,T5 | T1,T2,T3,T4 |    T1,T2,T5 |    T1,T2,T4
star         |          T2 |          T2 |          T2 |       T2,T3 |          T2
depot        |          T3 |          T3 |          T3 |          T3 |          T3
strongpoints |          T3 |          T4 |          T3 |          T3 |       T3,T4
keep         |       T4,T5 |          T5 |   — never — |          T4 |   — never —
bunker       |          T5 |          T5 |          T5 |          T5 |          T5

  8 of 8 shapes reach a player somewhere.

THE LADDER, pool mean per rung: T1 100  ->  T2 97  ->  T3 81  ->  T4 50  ->  T5 33
STEP SIZE: T1->T2 -3  T2->T3 -16  T3->T4 -31  T4->T5 -17 — POOL mean, at a fixed reference force.
  This is the whole pool, not the deal, and the force is a mature army: the early
  rungs saturate near 100 and no step between them can show. It is here to price
  the SHAPES, not to judge the ladder — `--rungs` does that, by asking how much
  force each rung demands rather than what one army does to all of them.

THE TWO KITS — every force against both sets of fortifications
FORCE   | vs PLA post | vs US firebase |   GAP | normally raids
--------+-------------+----------------+-------+---------------
    USA |        59.9 |           76.6 | -16.7 | CHINA
  CHINA |        53.6 |           71.9 | -18.2 | USA
 RUSSIA |        60.4 |           69.3 |  -8.9 | USA
     NK |        34.9 |           74.0 | -39.1 | USA
     UN |        52.1 |           64.6 | -12.5 | CHINA

WORST GAP 39.1 points. Two fronts differing in STYLE should not differ this much in DIFFICULTY — whoever raids the softer one is playing on easy and did not choose to.

THE PLAN, NOT THE FACTION — the same roster asked twice
FACTION | REF MP | REFERENCE | RECIPE MP | RECIPE |  BEST | PLAN IS WORTH
--------+--------+-----------+-----------+--------+-------+--------------
    USA |     25 |      67.9 |        26 |   40.8 |  67.9 |         -27.1
  CHINA |     26 |      77.5 |        25 |   40.8 |  77.5 |         -36.7
 RUSSIA |     27 |      75.4 |        27 |   47.5 |  75.4 |         -27.9
     NK |     26 |      81.7 |        26 |   81.7 |  81.7 |          +0.0
     UN |     26 |      61.7 |        24 |   34.2 |  61.7 |         -27.5

PLAN IS WORTH UP TO 36.7 POINTS — comparable to every effect this harness measures. Read BEST as the faction and the last column as the error bar; a single plan's row is not a reading of a kit.
BEST-PLAN SPREAD 20.0 points. `--kits` is unaffected: it holds the force fixed and swaps only the fortifications.

WHAT KILLS A COMMAND POST — the heavy's damage type, which was picked for flavour
FACTION | HEAVY FIRES | vs STRUCT | SHIPPING | ALL EXPLOSIVE | ALL KINETIC | SWING
--------+-------------+-----------+----------+---------------+-------------+------
    USA |   explosive |        x1 |     59.9 |          59.9 |        44.8 | +15.1
  CHINA |   explosive |        x1 |     71.9 |          71.9 |        36.5 | +35.4
 RUSSIA |     kinetic |      x0.5 |     69.3 |          69.3 |        69.3 |  +0.0
     NK |     kinetic |      x0.5 |     77.1 |          77.1 |        77.1 |  +0.0
     UN |     kinetic |      x0.5 |     52.1 |          52.1 |        52.1 |  +0.0

ONE FLAG ON ONE UNIT IS WORTH UP TO 35.4 POINTS. Ranged fire is discounted against structures (smallArms 0.15, kinetic 0.5, explosive 1.0); melee ignores the table but
  only fires when adjacent, which in practice only the heavy manages — it lands 60-84% of the killing blows. Normalising the flag does NOT lift the UN off the floor.

WHO CARRIES A RAID — every unit kind taken out of the plan, two ways
FACTION | UNIT         | MP | BASE | SILENCED | REPLACED | SHARE
--------+--------------+----+------+----------+----------+------
    USA |       abrams | 16 |   59 |       49 |       20 |   35%
    USA |       humvee |  6 |   59 |        4 |        7 |   12%
    USA |      javelin |  3 |   59 |        8 |        2 |    3%
  CHINA |    grenadier |  4 |   73 |       12 |       10 |   14%
  CHINA |      militia |  1 |   73 |        0 |        2 |    2%
  CHINA |       type99 | 21 |   73 |       68 |       50 |   68%
 RUSSIA |          btr | 18 |   72 |       60 |        8 |   11%
 RUSSIA |     demoteam |  6 |   72 |       13 |        0 |    0%
 RUSSIA |          rpg |  3 |   72 |       16 |       17 |   24%
     NK |      nkrifle | 12 |   75 |       10 |       23 |   31%
     NK |         rpg7 |  4 |   75 |       12 |       -1 |   -1%
     NK |     tunneler | 10 |   75 |       63 |       27 |   36%
     UN |         nlaw |  3 |   53 |       13 |        3 |    6%
     UN |     unsapper |  2 |   53 |        5 |       13 |   25%
     UN |          vab | 21 |   53 |       53 |       33 |   62%

WORST CARRY 68% — CHINA type99. M22's bar is 50%: above it, the plan is one unit and two decorations, and "your plan is your skill" is false.
SILENCED zeroes every damage stat and leaves the body; REPLACED takes the kind out and spends its manpower on the rest of the plan. A unit that scores low SILENCED and high REPLACED is earning its place with its BODY — under the kill chain that is a real job, since the charge needs a crew and the burn needs the ground held.

WHAT THE SEED DECIDES — the same matchup fought 12 times (25% of fire does not tell)
FORCE   | MATCHUPS | DECIDED     | SAME MEN HOME | LENGTH | CLEAR
--------+----------+-------------+---------------+--------+------
    USA |       40 |    29 (73%) |      13 (33%) |    722 |  68.8
  CHINA |       40 |    31 (78%) |      12 (30%) |    882 |  78.1
 RUSSIA |       40 |    27 (68%) |       6 (15%) |    778 |  77.7
     NK |       40 |    27 (68%) |        3 (8%) |    566 |  84.8
     UN |       40 |    28 (70%) |      13 (33%) |    579 |  61.9
--------+----------+-------------+---------------+--------+------
    ALL |      200 |   142 (71%) |      47 (24%) |    705 |  74.3

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
ARMOUR |  ASSAULT |      77.8 |       73.6 |        68.1
ARMOUR |     HUNT |      75.0 |       97.2 |        81.9
ARMOUR |     RAZE |      66.7 |       66.7 |        95.8
  FOOT |  ASSAULT |      15.3 |       31.9 |        62.5
  FOOT |     HUNT |      12.5 |       41.7 |        70.8
  FOOT |     RAZE |      22.2 |       25.0 |        83.3
 MIXED |  ASSAULT |      54.2 |       58.3 |        75.0
 MIXED |     HUNT |      52.8 |       77.8 |        72.2
 MIXED |     RAZE |      43.1 |       58.3 |        93.1
       best: POST ARMOUR/ASSAULT  ·  GUNS ARMOUR/HUNT  ·  STORES ARMOUR/RAZE
-------+----------+-----------+------------+------------
CHINA
ARMOUR |  ASSAULT |      88.9 |       86.1 |        84.7
ARMOUR |     HUNT |      94.4 |      100.0 |        94.4
ARMOUR |     RAZE |      81.9 |       75.0 |        98.6
  FOOT |  ASSAULT |       4.2 |        0.0 |         0.0
  FOOT |     HUNT |      16.7 |       26.4 |         0.0
  FOOT |     RAZE |       2.8 |        0.0 |        41.7
 MIXED |  ASSAULT |      81.9 |       88.9 |        84.7
 MIXED |     HUNT |      76.4 |      100.0 |        91.7
 MIXED |     RAZE |      86.1 |       87.5 |        98.6
       best: POST ARMOUR/HUNT  ·  GUNS ARMOUR/HUNT  ·  STORES ARMOUR/RAZE
-------+----------+-----------+------------+------------
RUSSIA
ARMOUR |  ASSAULT |      58.3 |       59.7 |        63.9
ARMOUR |     HUNT |      47.2 |       88.9 |        61.1
ARMOUR |     RAZE |      45.8 |       61.1 |        91.7
  FOOT |  ASSAULT |      34.7 |       47.2 |        63.9
  FOOT |     HUNT |      43.1 |       65.3 |        72.2
  FOOT |     RAZE |      23.6 |       33.3 |        81.9
 MIXED |  ASSAULT |      68.1 |       50.0 |        48.6
 MIXED |     HUNT |      83.3 |       94.4 |        72.2
 MIXED |     RAZE |      63.9 |       65.3 |        98.6
       best: POST MIXED/HUNT  ·  GUNS MIXED/HUNT  ·  STORES MIXED/RAZE
-------+----------+-----------+------------+------------
NK
ARMOUR |  ASSAULT |      40.3 |       26.4 |        26.4
ARMOUR |     HUNT |      19.4 |       63.9 |        27.8
ARMOUR |     RAZE |      27.8 |       20.8 |        66.7
  FOOT |  ASSAULT |      18.1 |        5.6 |         0.0
  FOOT |     HUNT |      84.7 |       93.1 |         0.0
  FOOT |     RAZE |      15.3 |        1.4 |        84.7
 MIXED |  ASSAULT |      20.8 |       11.1 |        12.5
 MIXED |     HUNT |      87.5 |       97.2 |        27.8
 MIXED |     RAZE |      13.9 |        9.7 |        84.7
       best: POST MIXED/HUNT  ·  GUNS MIXED/HUNT  ·  STORES FOOT/RAZE
-------+----------+-----------+------------+------------
UN
ARMOUR |  ASSAULT |      51.4 |       50.0 |        34.7
ARMOUR |     HUNT |      31.9 |       63.9 |        37.5
ARMOUR |     RAZE |      38.9 |       27.8 |        79.2
  FOOT |  ASSAULT |      25.0 |       26.4 |        56.9
  FOOT |     HUNT |      16.7 |       44.4 |        61.1
  FOOT |     RAZE |      13.9 |       25.0 |        83.3
 MIXED |  ASSAULT |      66.7 |       47.2 |        62.5
 MIXED |     HUNT |      63.9 |       79.2 |        66.7
 MIXED |     RAZE |      54.2 |       51.4 |        97.2
       best: POST MIXED/ASSAULT  ·  GUNS MIXED/HUNT  ·  STORES MIXED/RAZE
-------+----------+-----------+------------+------------

DISTINCT WINNERS 12 of 15. One force topping every column would mean the objective is a label on the same raid; a different force per column is the whole argument for letting a raid declare what it came for.

GARRISON — the UNITED STATES reference force vs PLA posts
CONFIG      |    T1 |    T2 |    T3 |    T4 |    T5 |  MEAN | MP LOST%
------------+-------+-------+-------+-------+-------+-------+---------
    v1.19 W |   100 |   100 |    68 |    33 |    18 |  63.8 |       48
    v1.19 — |   100 |   100 |    72 |    25 |    43 |  68.0 |       47
 GUNS 0.8 W |   100 |   100 |    90 |    77 |    65 |  86.4 |       31
 GUNS 0.8 — |   100 |   100 |    90 |    52 |    75 |  83.4 |       36
    WATCH W |   100 |   100 |    63 |    20 |    10 |  58.6 |       53
    WATCH — |   100 |   100 |    72 |    25 |    23 |  64.0 |       51
  SHIPPED W |   100 |   100 |    90 |    72 |    42 |  80.8 |       38
  SHIPPED — |   100 |   100 |    90 |    45 |    60 |  79.0 |       40

WALL LINE IS WORTH — v1.19 +4.2  |  GUNS 0.8 -3.0  |  WATCH +5.4  |  SHIPPED -1.8  (clear-rate points to the defender)

AIR — the UNITED STATES reference force vs PLA posts, with and without AA
      GROUND reference 25 MP, AIR plan 30 MP, so the edge is read against GROUND =30
FORCE       |    T1 |    T2 |    T3 |    T4 |    T5 |  MEAN | MP LOST%
------------+-------+-------+-------+-------+-------+-------+---------
     GROUND |   100 |   100 |    90 |    72 |    42 |  80.8 |       38
 GROUND =30 |   100 |   100 |    88 |    75 |    40 |  80.6 |       39
 AIR mounts |    85 |     0 |     0 |     0 |    28 |  22.6 |       83
AIR +manpads |    85 |     0 |     0 |     0 |    23 |  21.6 |       85

AIR'S EDGE OVER MATCHED GROUND — vs mounts -58.0  |  vs mounts+manpads -59.0  (clear-rate points, both forces at 30 MP)

AIR — the PLA EXPEDITIONARY FORCE reference force vs US ARMY posts, with and without AA
      GROUND reference 26 MP, AIR plan 30 MP, so the edge is read against GROUND =30
FORCE       |    T1 |    T2 |    T3 |    T4 |    T5 |  MEAN | MP LOST%
------------+-------+-------+-------+-------+-------+-------+---------
     GROUND |   100 |    98 |    78 |    80 |    50 |  81.2 |       43
 GROUND =30 |   100 |   100 |    83 |    90 |    58 |  86.2 |       44
 AIR mounts |    68 |    32 |    25 |     0 |     0 |  25.0 |       81
AIR +manpads |    68 |    27 |    20 |     0 |     0 |  23.0 |       82

AIR'S EDGE OVER MATCHED GROUND — vs mounts -61.2  |  vs mounts+manpads -63.2  (clear-rate points, both forces at 30 MP)

AIR — the RUSSIAN GROUND FORCES reference force vs US ARMY posts, with and without AA
      GROUND reference 27 MP, AIR plan 27 MP — already matched, so GROUND =N must repeat GROUND exactly
FORCE       |    T1 |    T2 |    T3 |    T4 |    T5 |  MEAN | MP LOST%
------------+-------+-------+-------+-------+-------+-------+---------
     GROUND |   100 |    93 |    92 |    58 |    48 |  78.2 |       50
 GROUND =27 |   100 |    93 |    92 |    58 |    48 |  78.2 |       50
 AIR mounts |    57 |     0 |    10 |     3 |     0 |  14.0 |       88
AIR +manpads |    57 |     0 |    32 |     3 |     2 |  18.8 |       86

AIR'S EDGE OVER MATCHED GROUND — vs mounts -64.2  |  vs mounts+manpads -59.4  (clear-rate points, both forces at 27 MP)

AIR — the KOREAN PEOPLE'S ARMY reference force vs US ARMY posts, with and without AA
      GROUND reference 26 MP, AIR plan 29 MP, so the edge is read against GROUND =29
FORCE       |    T1 |    T2 |    T3 |    T4 |    T5 |  MEAN | MP LOST%
------------+-------+-------+-------+-------+-------+-------+---------
     GROUND |   100 |   100 |    90 |    65 |    40 |  79.0 |       52
 GROUND =29 |   100 |   100 |    87 |    77 |    62 |  85.2 |       45
 AIR mounts |    75 |     0 |    15 |    33 |     0 |  24.6 |       82
AIR +manpads |    75 |     0 |     7 |    30 |     0 |  22.4 |       82

AIR'S EDGE OVER MATCHED GROUND — vs mounts -60.6  |  vs mounts+manpads -62.8  (clear-rate points, both forces at 29 MP)

AIR — the UN COALITION reference force vs PLA posts, with and without AA
      GROUND reference 26 MP, AIR plan 30 MP, so the edge is read against GROUND =30
FORCE       |    T1 |    T2 |    T3 |    T4 |    T5 |  MEAN | MP LOST%
------------+-------+-------+-------+-------+-------+-------+---------
     GROUND |   100 |    93 |    65 |    65 |    52 |  75.0 |       51
 GROUND =30 |   100 |   100 |    90 |    90 |    80 |  92.0 |       42
 AIR mounts |    37 |     0 |    13 |     0 |    33 |  16.6 |       89
AIR +manpads |    37 |     0 |    13 |     0 |    33 |  16.6 |       90

AIR'S EDGE OVER MATCHED GROUND — vs mounts -75.4  |  vs mounts+manpads -75.4  (clear-rate points, both forces at 30 MP)

WHAT AIR CHARGES — smallest manpower that clears half the time, by plan shape
FACTION     | SHAPE  |    T1 |    T2 |    T3 |    T4 |    T5 |  MEAN
------------+--------+-------+-------+-------+-------+-------+-------
UNITED STAT | GROUND |    14 |    20 |    22 |    22 |    31 |  21.8
            | AIR    |    32 |    76 |    90 |    90 |    32 |  64.0
            | x      |  2.3x |  3.8x |  4.1x |  4.1x |  1.0x |  2.9x
PLA EXPEDIT | GROUND |     9 |    24 |    20 |    28 |    28 |  21.8
            | AIR    |    28 |    38 |    38 |    64 |    76 |  48.8
            | x      |  3.1x |  1.6x |  1.9x |  2.3x |  2.7x |  2.2x
RUSSIAN GRO | GROUND |    11 |    19 |    19 |    27 |    32 |  21.6
            | AIR    |    27 |    45 |    33 |    45 |    54 |  40.8
            | x      |  2.5x |  2.4x |  1.7x |  1.7x |  1.7x |  1.9x
KOREAN PEOP | GROUND |     9 |    16 |    20 |    20 |    24 |  17.8
            | AIR    |    28 |    39 |    33 |    46 |    54 |  40.0
            | x      |  3.1x |  2.4x |  1.6x |  2.3x |  2.3x |  2.2x
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
            |   T3 | corridor     |     80 |   0 | -########
            |      | depot        |     90 |   0 | -#########
            |      | strongpoints |    100 |   0 | -##########
            |   T4 | camp         |     65 |   0 | -#######
            |      | keep         |     50 |   0 | -#####
            |      | compound     |     45 |   0 | -#####
            |   T5 | bunker       |     25 |   0 | -###
            |      | compound     |     15 |   0 | -##
            |      | keep         |     40 |   0 | -####
            |      | MEAN / SPLIT |     74 |   0 | r=+0.00  30+ easier 0, harder 13

PLA EXPEDIT |   T1 | compound     |    100 |   0 | -##########
            |      | camp         |    100 |   0 | -##########
            |      | corridor     |    100 |   0 | -##########
            |   T2 | star         |     75 |   0 | -########
            |      | corridor     |     35 |   0 | -####
            |      | compound     |    100 |   0 | -##########
            |   T3 | compound     |     85 |   0 | -#########
            |      | corridor     |     65 |   0 | -#######
            |      | depot        |     95 |   0 | -##########
            |   T4 | camp         |     10 |   0 | -#
            |      | strongpoints |     55 |   0 | -######
            |      | compound     |     45 |   0 | -#####
            |   T5 | keep         |      0 |   0 | +
            |      | corridor     |      0 |   0 | +
            |      | bunker       |     25 |   0 | -###
            |      | MEAN / SPLIT |     59 |   0 | r=+0.00  30+ easier 0, harder 11

RUSSIAN GRO |   T1 | compound     |    100 |   0 | -##########
            |      | camp         |    100 |   0 | -##########
            |      | corridor     |    100 |   0 | -##########
            |   T2 | corridor     |     85 |   0 | -#########
            |      | compound     |     90 |   0 | -#########
            |      | star         |    100 |   0 | -##########
            |   T3 | corridor     |     35 |   0 | -####
            |      | strongpoints |     60 |   0 | -######
            |      | depot        |    100 |   0 | -##########
            |   T4 | compound     |     35 |   0 | -####
            |      | corridor     |      5 |   0 | -#
            |      | camp         |     90 |   0 | -#########
            |   T5 | compound     |      0 |   0 | +
            |      | camp         |     45 |   0 | -#####
            |      | bunker       |     35 |   0 | -####
            |      | MEAN / SPLIT |     65 |   0 | r=+0.00  30+ easier 0, harder 13

KOREAN PEOP |   T1 | compound     |    100 |   0 | -##########
            |      | camp         |    100 |   0 | -##########
            |      | corridor     |    100 |   0 | -##########
            |   T2 | compound     |     95 |   0 | -##########
            |      | corridor     |    100 |   0 | -##########
            |      | star         |    100 |   0 | -##########
            |   T3 | star         |     70 |   0 | -#######
            |      | strongpoints |     80 |   0 | -########
            |      | depot        |    100 |   0 | -##########
            |   T4 | keep         |     40 |   0 | -####
            |      | compound     |     90 |   0 | -#########
            |      | camp         |     70 |   0 | -#######
            |   T5 | corridor     |     55 |   0 | -######
            |      | compound     |     50 |   0 | -#####
            |      | bunker       |     50 |   0 | -#####
            |      | MEAN / SPLIT |     80 |   0 | r=+0.00  30+ easier 0, harder 15

UN COALITIO |   T1 | compound     |    100 |   0 | -##########
            |      | camp         |    100 |   0 | -##########
            |      | corridor     |    100 |   0 | -##########
            |   T2 | corridor     |     65 |   0 | -#######
            |      | star         |     75 |   0 | -########
            |      | compound     |    100 |   0 | -##########
            |   T3 | compound     |     10 |   0 | -#
            |      | depot        |     15 |   0 | -##
            |      | strongpoints |     80 |   0 | -########
            |   T4 | compound     |     10 |   0 | -#
            |      | corridor     |      0 |   0 | +
            |      | strongpoints |     55 |   0 | -######
            |   T5 | compound     |     10 |   0 | -#
            |      | bunker       |     30 |   0 | -###
            |      | camp         |      0 |   0 | +
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
            |   T4 | camp         |       48 |     223 |          0
            |      | keep         |       48 |     197 |          0
            |      | compound     |        0 |       0 |          0
            |   T5 | bunker       |       48 |     167 |          0
            |      | compound     |        0 |      80 |          0
            |      | keep         |       48 |      17 |          0

PLA EXPEDIT |   T1 | compound     |        0 |       0 |          0
            |      | camp         |        0 |       0 |          0
            |      | corridor     |        0 |       0 |          0
            |   T2 | star         |       47 |      60 |          0
            |      | corridor     |        0 |       0 |          0
            |      | compound     |        0 |      71 |          0
            |   T3 | compound     |        0 |      71 |          0
            |      | corridor     |        0 |       0 |          0
            |      | depot        |        0 |      47 |          0
            |   T4 | camp         |       47 |     120 |          0
            |      | strongpoints |       47 |     112 |          0
            |      | compound     |        0 |      32 |          0
            |   T5 | keep         |       47 |      19 |          0
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
            |   T4 | compound     |        0 |      21 |          0
            |      | corridor     |        0 |       0 |          0
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
            |   T4 | keep         |       47 |      18 |          0
            |      | compound     |       47 |      64 |          0
            |      | camp         |       47 |     134 |          0
            |   T5 | corridor     |       47 |      77 |          0
            |      | compound     |        0 |      53 |          0
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
            |      | corridor     |        0 |      96 |          0
            |      | strongpoints |        0 |       0 |          0
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
GOOD  | under 18      |      25 |             0.0
FAIR  | 18 to 85      |      25 |             0.0
POOR  | over 85       |      25 |             0.0

  The bands are the shippable form: a player cannot read DPS-seconds, and three
  words is the whole budget the target list has. The cuts are terciles of the
  measured population rather than round numbers, so they cannot be tuned to
  flatter the result.

VETERANCY — UNITED STATES strike force (25 MP), men returned% by tier
RANK    |  ×   |   T1 |   T2 |   T3 |   T4 |   T5 |  MEAN | CLEAR%
--------+------+------+------+------+------+------+-------+-------
GREEN   | 1.00 |   88 |   71 |   45 |   29 |   21 |  50.8 |     81
LINE    | 1.04 |   88 |   70 |   49 |   33 |   33 |  54.6 |     87
VETERAN | 1.09 |   89 |   81 |   48 |   38 |   34 |  58.0 |     88
CADRE   | 1.15 |   89 |   86 |   55 |   42 |   48 |  64.0 |     96

VETERANCY — PLA EXPEDITIONARY FORCE strike force (26 MP), men returned% by tier
RANK    |  ×   |   T1 |   T2 |   T3 |   T4 |   T5 |  MEAN | CLEAR%
--------+------+------+------+------+------+------+-------+-------
GREEN   | 1.00 |   73 |   48 |   40 |   33 |   11 |  41.0 |     81
LINE    | 1.04 |   74 |   50 |   44 |   43 |   13 |  44.8 |     86
VETERAN | 1.09 |   74 |   53 |   50 |   43 |   22 |  48.4 |     94
CADRE   | 1.15 |   73 |   54 |   56 |   48 |   28 |  51.8 |     99

VETERANCY — RUSSIAN GROUND FORCES strike force (27 MP), men returned% by tier
RANK    |  ×   |   T1 |   T2 |   T3 |   T4 |   T5 |  MEAN | CLEAR%
--------+------+------+------+------+------+------+-------+-------
GREEN   | 1.00 |   75 |   57 |   48 |   32 |   17 |  45.8 |     78
LINE    | 1.04 |   76 |   61 |   55 |   37 |   27 |  51.2 |     87
VETERAN | 1.09 |   78 |   62 |   55 |   41 |   35 |  54.2 |     91
CADRE   | 1.15 |   81 |   67 |   62 |   52 |   45 |  61.4 |     96

VETERANCY — KOREAN PEOPLE'S ARMY strike force (26 MP), men returned% by tier
RANK    |  ×   |   T1 |   T2 |   T3 |   T4 |   T5 |  MEAN | CLEAR%
--------+------+------+------+------+------+------+-------+-------
GREEN   | 1.00 |   75 |   65 |   48 |   28 |   15 |  46.2 |     79
LINE    | 1.04 |   75 |   65 |   53 |   31 |   21 |  49.0 |     80
VETERAN | 1.09 |   82 |   70 |   56 |   33 |   21 |  52.4 |     81
CADRE   | 1.15 |   85 |   73 |   63 |   42 |   29 |  58.4 |     86

VETERANCY — UN COALITION strike force (26 MP), men returned% by tier
RANK    |  ×   |   T1 |   T2 |   T3 |   T4 |   T5 |  MEAN | CLEAR%
--------+------+------+------+------+------+------+-------+-------
GREEN   | 1.00 |   85 |   59 |   31 |   38 |   24 |  47.4 |     75
LINE    | 1.04 |   85 |   65 |   46 |   44 |   37 |  55.4 |     85
VETERAN | 1.09 |   85 |   73 |   56 |   50 |   43 |  61.4 |     92
CADRE   | 1.15 |   85 |   77 |   57 |   55 |   51 |  65.0 |     96

DEFENSE — UNITED STATES permanent layer vs PLA assault ladder (hold%)
STAGE       |   L1 |   L2 |   L3 |   L4 |   L5 |   L6 |   L7 |   L8 |   L9 |  L10 |  L11 |  L12
------------+------+------+------+------+------+------+------+------+------+------+------+------
EARLY (CC1) |  100 |  100 |   20 |    0 |    0 |    0 |    0 |    0 |    0 |    0 |    0 |    0
MID (CC2)   |  100 |  100 |  100 |  100 |  100 |  100 |  100 |   65 |   35 |    0 |    0 |    0
LATE (CC3)  |  100 |  100 |  100 |  100 |  100 |  100 |  100 |  100 |  100 |  100 |   90 |   65

DEFENSE — UNITED STATES permanent layer vs PLA assault ladder (hold%) — HOLDFAST standing orders
STAGE       |   L1 |   L2 |   L3 |   L4 |   L5 |   L6 |   L7 |   L8 |   L9 |  L10 |  L11 |  L12
------------+------+------+------+------+------+------+------+------+------+------+------+------
EARLY (CC1) |  100 |  100 |  100 |    0 |    0 |    0 |    0 |    0 |    0 |    0 |    0 |    0
MID (CC2)   |  100 |  100 |  100 |  100 |  100 |  100 |  100 |  100 |  100 |   80 |   10 |    0
LATE (CC3)  |  100 |  100 |  100 |  100 |  100 |  100 |  100 |  100 |  100 |  100 |  100 |  100

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
EARLY (CC1) |  100 |  100 |  100 |    0 |    0 |    0 |    0 |    0 |    0 |    0 |    0 |    0
MID (CC2)   |  100 |  100 |  100 |  100 |  100 |   95 |   35 |   15 |    0 |    0 |    0 |    0
LATE (CC3)  |  100 |  100 |  100 |  100 |  100 |  100 |  100 |  100 |  100 |  100 |   60 |   60

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
EARLY (CC1) |  100 |  100 |   95 |    0 |    0 |    0 |    0 |    0 |    0 |    0 |    0 |    0
MID (CC2)   |  100 |  100 |  100 |  100 |  100 |  100 |  100 |   85 |   55 |    5 |    0 |    0
LATE (CC3)  |  100 |  100 |  100 |  100 |  100 |  100 |  100 |  100 |  100 |  100 |  100 |  100

DEFENSE — RUSSIAN GROUND FORCES permanent layer vs US ARMY assault ladder (hold%) — HOLDFAST standing orders
STAGE       |   L1 |   L2 |   L3 |   L4 |   L5 |   L6 |   L7 |   L8 |   L9 |  L10 |  L11 |  L12
------------+------+------+------+------+------+------+------+------+------+------+------+------
EARLY (CC1) |  100 |  100 |  100 |    0 |    0 |    0 |    0 |    0 |    0 |    0 |    0 |    0
MID (CC2)   |  100 |  100 |  100 |  100 |  100 |  100 |   90 |   85 |   40 |   50 |   20 |    0
LATE (CC3)  |  100 |  100 |  100 |  100 |  100 |  100 |  100 |  100 |  100 |  100 |  100 |  100

DEFENSE — RUSSIAN GROUND FORCES permanent layer vs US ARMY assault ladder (hold%) — WITH AA COVER
STAGE       |   L1 |   L2 |   L3 |   L4 |   L5 |   L6 |   L7 |   L8 |   L9 |  L10 |  L11 |  L12
------------+------+------+------+------+------+------+------+------+------+------+------+------
EARLY (CC1) |  100 |  100 |  100 |    0 |    0 |    0 |    0 |    0 |    0 |    0 |    0 |    0
MID (CC2)   |  100 |  100 |  100 |  100 |  100 |  100 |  100 |  100 |   85 |   15 |    0 |    0
LATE (CC3)  |  100 |  100 |  100 |  100 |  100 |  100 |  100 |  100 |  100 |  100 |  100 |  100

DEFENSE — RUSSIAN GROUND FORCES permanent layer vs US ARMY assault ladder (hold%) — FORTIFY doctrine
STAGE       |   L1 |   L2 |   L3 |   L4 |   L5 |   L6 |   L7 |   L8 |   L9 |  L10 |  L11 |  L12
------------+------+------+------+------+------+------+------+------+------+------+------+------
EARLY (CC1) |  100 |  100 |  100 |    0 |    0 |    0 |    0 |    0 |    0 |    0 |    0 |    0
MID (CC2)   |  100 |  100 |  100 |  100 |  100 |  100 |  100 |  100 |   85 |   25 |    0 |    0
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
EARLY (CC1) |  100 |  100 |   90 |    0 |    0 |    0 |    0 |    0 |    0 |    0 |    0 |    0
MID (CC2)   |  100 |  100 |   95 |   85 |   95 |   80 |    0 |    0 |    0 |    0 |    0 |    0
LATE (CC3)  |  100 |  100 |  100 |  100 |  100 |  100 |  100 |  100 |  100 |  100 |   60 |   70

DEFENSE — KOREAN PEOPLE'S ARMY permanent layer vs US ARMY assault ladder (hold%) — WITH AA COVER
STAGE       |   L1 |   L2 |   L3 |   L4 |   L5 |   L6 |   L7 |   L8 |   L9 |  L10 |  L11 |  L12
------------+------+------+------+------+------+------+------+------+------+------+------+------
EARLY (CC1) |  100 |  100 |  100 |    0 |    0 |    0 |    0 |    0 |    0 |    0 |    0 |    0
MID (CC2)   |  100 |  100 |  100 |  100 |  100 |  100 |   15 |   20 |    0 |    0 |    0 |    0
LATE (CC3)  |  100 |  100 |  100 |  100 |  100 |  100 |  100 |  100 |  100 |  100 |   55 |   25

DEFENSE — KOREAN PEOPLE'S ARMY permanent layer vs US ARMY assault ladder (hold%) — COUNTERBATTERY standing orders
STAGE       |   L1 |   L2 |   L3 |   L4 |   L5 |   L6 |   L7 |   L8 |   L9 |  L10 |  L11 |  L12
------------+------+------+------+------+------+------+------+------+------+------+------+------
EARLY (CC1) |  100 |  100 |   30 |    0 |    0 |    0 |    0 |    0 |    0 |    0 |    0 |    0
MID (CC2)   |  100 |  100 |  100 |  100 |  100 |  100 |    0 |    0 |    0 |    0 |    0 |    0
LATE (CC3)  |  100 |  100 |  100 |  100 |  100 |  100 |  100 |  100 |  100 |   95 |   10 |   10

DEFENSE — KOREAN PEOPLE'S ARMY permanent layer vs US ARMY assault ladder (hold%) — TRIPWIRE standing orders
STAGE       |   L1 |   L2 |   L3 |   L4 |   L5 |   L6 |   L7 |   L8 |   L9 |  L10 |  L11 |  L12
------------+------+------+------+------+------+------+------+------+------+------+------+------
EARLY (CC1) |  100 |  100 |   25 |    0 |    0 |    0 |    0 |    0 |    0 |    0 |    0 |    0
MID (CC2)   |  100 |  100 |  100 |  100 |  100 |  100 |   15 |    5 |    0 |    0 |    0 |    0
LATE (CC3)  |  100 |  100 |  100 |  100 |  100 |  100 |  100 |  100 |  100 |   95 |   50 |   10

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
MID (CC2)   |  100 |  100 |  100 |  100 |  100 |  100 |   40 |   25 |    0 |    0 |    0 |    0
LATE (CC3)  |  100 |  100 |  100 |  100 |  100 |  100 |  100 |  100 |  100 |  100 |   70 |   10

DEFENSE — UN COALITION permanent layer vs PLA assault ladder (hold%) — HOLDFAST standing orders
STAGE       |   L1 |   L2 |   L3 |   L4 |   L5 |   L6 |   L7 |   L8 |   L9 |  L10 |  L11 |  L12
------------+------+------+------+------+------+------+------+------+------+------+------+------
EARLY (CC1) |  100 |  100 |  100 |   55 |    0 |    0 |    0 |    0 |    0 |    0 |    0 |    0
MID (CC2)   |  100 |  100 |  100 |  100 |  100 |  100 |  100 |   80 |   30 |   10 |    0 |    0
LATE (CC3)  |  100 |  100 |  100 |  100 |  100 |  100 |  100 |  100 |  100 |   95 |   75 |   80

DEFENSE — UN COALITION permanent layer vs PLA assault ladder (hold%) — WITH AA COVER
STAGE       |   L1 |   L2 |   L3 |   L4 |   L5 |   L6 |   L7 |   L8 |   L9 |  L10 |  L11 |  L12
------------+------+------+------+------+------+------+------+------+------+------+------+------
EARLY (CC1) |  100 |  100 |  100 |  100 |  100 |  100 |    0 |    0 |    0 |    0 |    0 |    0
MID (CC2)   |  100 |  100 |  100 |  100 |  100 |  100 |   95 |  100 |   60 |    0 |    0 |    0
LATE (CC3)  |  100 |  100 |  100 |  100 |  100 |  100 |  100 |  100 |  100 |  100 |  100 |   95

DEFENSE — UN COALITION permanent layer vs PLA assault ladder (hold%) — Engineer Corps HQ on the line
STAGE       |   L1 |   L2 |   L3 |   L4 |   L5 |   L6 |   L7 |   L8 |   L9 |  L10 |  L11 |  L12
------------+------+------+------+------+------+------+------+------+------+------+------+------
EARLY (CC1) |  100 |  100 |   50 |    0 |    0 |    0 |    0 |    0 |    0 |    0 |    0 |    0
MID (CC2)   |  100 |  100 |  100 |  100 |  100 |  100 |   75 |   75 |    0 |    0 |    0 |    0
LATE (CC3)  |  100 |  100 |  100 |  100 |  100 |  100 |  100 |  100 |  100 |  100 |   95 |   30

DEFENSE — UN COALITION permanent layer vs PLA assault ladder (hold%) — FORTIFY doctrine
STAGE       |   L1 |   L2 |   L3 |   L4 |   L5 |   L6 |   L7 |   L8 |   L9 |  L10 |  L11 |  L12
------------+------+------+------+------+------+------+------+------+------+------+------+------
EARLY (CC1) |  100 |  100 |   90 |    0 |    0 |    0 |    0 |    0 |    0 |    0 |    0 |    0
MID (CC2)   |  100 |  100 |  100 |  100 |  100 |  100 |   90 |   50 |    5 |    0 |    0 |    0
LATE (CC3)  |  100 |  100 |  100 |  100 |  100 |  100 |  100 |  100 |  100 |  100 |   95 |   20
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
