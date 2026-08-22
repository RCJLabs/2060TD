# Balance snapshot (v0.3)

Deterministic headless matrices from `npm run balance -- --md`.
20 seeds × 3 base variants per raid cell; 20 seeds per defense cell.
Defense rows measure the permanent layer alone (no live CP play), the floor a base must clear —
an active player defends one to two ladder levels above their probe floor.

```
RAID — UNITED STATES strike force (27 MP) vs PLA Front Line
TIER | CLEAR% | DESTR% | MP LOST%
-----+--------+--------+---------
   1 |    100 |     61 |       45
   2 |    100 |     64 |       52
   3 |    100 |     74 |       58
   4 |     78 |     39 |       77
   5 |     77 |     50 |       76

RAID — PLA EXPEDITIONARY FORCE strike force (28 MP) vs US ARMY Front Line
TIER | CLEAR% | DESTR% | MP LOST%
-----+--------+--------+---------
   1 |    100 |     56 |       57
   2 |     67 |     44 |       83
   3 |     63 |     51 |       83
   4 |     10 |     28 |       98
   5 |      0 |     20 |      100

DEFENSE — UNITED STATES permanent layer vs PLA assault ladder (hold%)
STAGE       |   L1 |   L2 |   L3 |   L4 |   L5 |   L6
------------+------+------+------+------+------+------
EARLY (CC1) |  100 |  100 |    0 |    0 |    0 |    0
MID (CC2)   |  100 |  100 |  100 |   95 |   85 |   60
LATE (CC3)  |  100 |  100 |  100 |  100 |  100 |  100

DEFENSE — PLA EXPEDITIONARY FORCE permanent layer vs US ARMY assault ladder (hold%)
STAGE       |   L1 |   L2 |   L3 |   L4 |   L5 |   L6
------------+------+------+------+------+------+------
EARLY (CC1) |  100 |  100 |    0 |    0 |    0 |    0
MID (CC2)   |  100 |  100 |  100 |  100 |   80 |   10
LATE (CC3)  |  100 |  100 |  100 |  100 |  100 |  100
```

## Reading the tables (M5 tuning pass)

- **The raid rows use a FIXED mid-game force**, so the ladder is supposed to outgrow it.
  USA (quality) stays potent deep into the ladder but pays 75%+ of the force at tier 4–5;
  China (mass) grinds tiers 2–3 with cheap replacements, then needs the late-game army:
  a 33-manpower PLA force with doubled armor clears tier 4–5 at ~70% (verified headlessly).
  Steeper curve + cheaper bodies is the intended faction texture, not a wall.
- **Both factions hold their probe floor**: EARLY holds L1–2 (probes cap near the Front Line
  tier), MID holds L3–5ish, LATE holds everything on the current ladder.
- **Watch items for v0.4**: China MID vs the L6 US assault (Javelin teams outrange the wire
  and snipe HJ-8 posts — mortars are the intended answer and MID fields only one), and the
  EARLY L2→L3 cliff on both sides (armor arrives before anti-armor requisitions).
- M5 changes behind these numbers: deliberate demolition now uses the breacher stat
  (max of hqDps/wallDps) against non-CC structures; USA firebases delay mortars to tier 3;
  HJ-8 posts and Type 88 nests hit harder; PLA manpower runs cheaper (grn 2, zbd 3, t99 7);
  PLA vehicle hp raised to survive level-2 tower lines.
