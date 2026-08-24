# 2060TD — Locked Design Decisions

Ten fine-tuning decisions made during the initial brainstorm (2026-08-22), before any code.
These are the project's constitution: changing one is allowed but is a *decision*, recorded
here with the change and its date.

| # | Decision | Choice |
|---|----------|--------|
| 1 | Tech stack | TypeScript + Phaser 3 (Vite, web-first) |
| 2 | Multiplayer | Single-player vs AI; PvP-lite (share-codes) later |
| 3 | First factions | USA + China; Russia, North Korea, UN follow |
| 4 | Art style | Flat vector top-down, tactical-map aesthetic |
| 5 | Defense combat | Classic **active** TD (live placement mid-wave) |
| 6 | Offense combat | **Hands-off auto raid** (plan → sim resolves → replay) |
| 7 | Idle systems | Offline resource gen + build/research timers + offline probe raids w/ replays |
| 8 | Progression | Story campaign + endless "Front Line" ladder |
| 9 | MVP scope | Defense-first slice (v0.1 has no offense) |
| 10 | Tone | Gritty & grounded |

## Rationale

1. **TypeScript + Phaser 3.** Battle-tested 2D web framework: instant iteration, runs anywhere,
   trivially shareable builds, and testable headlessly in CI. A full engine (Godot/Unity) buys
   nothing this 2D grid game needs and slows the loop.

2. **Single-player vs AI.** Servers, accounts, and matchmaking would double early scope before
   the game is fun. AI bases (templates + procedural mutation) deliver the raid fantasy alone.
   The base-layout save format is designed standalone/compact from day one so share-code and
   async PvP can bolt on without a rewrite.

3. **USA + China first.** Elite-vs-swarm is the crispest mechanical contrast to balance the
   core against — expensive precision versus cheap saturation stresses both halves of the
   combat math. It's also the campaign's opening matchup.

4. **Flat vector top-down.** Fastest style to produce at consistent quality, perfectly legible
   for a grid game, and it *is* the fiction (a tactical ops map). Isometric remains a possible
   later art upgrade; nothing in the sim assumes a camera.

5. **Active TD defense.** The user's call, and the spicier one: defense is the *action* game.
   Reconciled with the persistent base via two layers — the permanent layer (buildings, walls,
   emplacements) that also defends you offline, and a battle layer (CP-bought field defenses +
   powers) that exists only during a siege. Skill lives in the battle layer; investment lives
   in the permanent layer.

6. **Hands-off offense.** The counterweight: attacking is pure planning (scout, composition,
   entry points, doctrines) resolved by the deterministic sim into a replay. This is what makes
   the active/idle hybrid coherent — and it forces the deterministic-sim architecture that
   also powers offline defense and replays.

7. **Idle trio.** Offline generation, short generous timers, and offline probe raids with
   replays. Auto-skirmish (endless idle wave mode) was considered and cut — it competes with
   sieges for identity. Probes are capped so returning to the game never feels like punishment.

8. **Campaign + ladder.** The setting demands a story (each faction sees the war differently),
   and the builder loop demands an endless track. Campaign gates unlocks; the Front Line
   provides infinite play and the raid economy.

9. **Defense-first MVP.** v0.1 = build + defend only. The active TD half must be fun in
   isolation; offense (v0.2) then reuses the same sim, content, and AI bases. Fastest path to
   a genuinely playable build.

10. **Gritty & grounded.** Played straight, not camp. Constraint accepted knowingly: real
    countries + somber tone requires care — hence the content guardrails in the GDD
    (alternate-history framing, militaries not peoples, no atrocity mechanics, protective
    civilian missions only).

## Change log

- 2026-08-22 — Initial ten decisions locked.
- 2026-08-24 — **Decision 4 deepened, not changed.** "Flat vector top-down,
  tactical-map aesthetic" now means a buff topographic SHEET rather than a dark
  field: the fiction is that you are looking at a military map and planning
  defences on it. The board goes from dark to paper; the UI stays dark, because
  it is the table the map is lying on. Structures become real top-down
  silhouettes instead of coloured rectangles. Isometric remains as unavailable
  as it always was, and nothing in the sim assumes a camera. See GDD §6.1 and
  the "Map Table" mockup.
- 2026-08-24 — **A raid now charges for time.** Three releases of measurement said
  a raid is decided by gun coverage, not by route length or wall HP. The cause
  was structural: an AI base had no economy and no way to spend one, so time —
  the only thing a wall or a detour can cost an attacker — was free. Walls were
  measurably worse than no walls. Two changes, deliberately separable: standing
  gun damage on a raided post is ×0.8, which is what earns the wall line; and
  the base now banks Command Points and stands guns up while you walk, which is
  what earns the clock. The lesson filed alongside them is about method rather
  than balance — the first read moved both at once and credited the wrong one,
  and a test written against that read passed with the garrison deleted. Move
  one thing. See GDD §5.2c and the 2×2 in `docs/BALANCE.md`.
- 2026-08-24 — **A clear rate is a count, not a probability.** The balance harness
  runs 20 seeds × 3 base variants per raid cell and every table in
  `docs/BALANCE.md` was being read as if that were 60 samples. It is not. A raid
  with no fire plan draws from the engine's stream exactly once per unit — a
  ±3-8% speed roll at spawn — and nothing else in it is random. 45% of the 75
  (faction, tier, variant) matchups return a byte-identical outcome across all 20
  seeds; one held the same result for 200; 66 of the 75 land on exactly 0% or
  exactly 100%. The seed does reach the sim — different seeds give different state
  hashes at every checkpoint, on a board with units on it — it simply washes out.
  So the variant is the real sample and it is a sample of three: a tier reads in
  thirds, a five-tier mean moves in steps of 6.7 points, and half of a "34.6-point
  faction spread" is five matchups flipping. Nothing about determinism changes;
  what changes is what the number means. `--deal` and the caveat at the top of
  `docs/BALANCE.md` now say so.
- 2026-08-24 — **Read the metric a change exists to serve, not the metric it
  reports.** The front line deals three targets a rung from one hardcoded shuffle
  that never sees the faction, so four of the eight archetypes ever appear, the
  depot appears on none, and T5 deals the two hardest shapes together to everybody.
  Banding the deal by measured difficulty fixed every one of those: the dealt mean
  tracked the pool at all five rungs, seven of eight shapes entered the rotation,
  the depot got dealt. It was still wrong. `--parity` — the table the work exists
  to improve — showed the USA at 100% on every rung and the faction spread widening
  from 32.6 to 42.0, because a single difficulty ordering averaged across five
  factions grades a rung for none of them (compound at T5 measures 100% for the USA
  and 7% for China). Reverted, with the successor specified: the deal has to see
  the faction. The general lesson is the one the garrison taught in a different
  costume — a change that improves its own table has not been measured yet.
- 2026-08-24 — **The front line sees the faction.** A rung's three targets used
  to come off one hardcoded shuffle that never saw who was raiding, so four of
  the eight archetypes ever appeared, the dispersed depot appeared on no rung at
  all, and T5 dealt the two hardest shapes in the game together to everybody.
  Banding by difficulty fixed the silhouette problem and not the real one: the
  shapes do not order the same way for each faction — a keep is the hardest
  thing Russia meets and mid-table for the USA — so one averaged ordering grades
  a rung for nobody, and the first attempt put the USA at 100% on every rung.
  The ordering is per faction now, measured by `npm run balance -- --pressure`
  and printed as a paste-ready literal rather than hand-copied. Two players of
  different factions see different front lines at the same rung, which is
  correct: they are fighting different enemies. Nothing in the codecs depends on
  it — share codes and replay codes carry a layout cell by cell, not a
  `(tier, variant)` to re-generate from.
- 2026-08-24 — **v1.20's wall line was never resolved, and the correction is the
  point.** That release shipped on a clear-rate reading — the wall line worth
  -5.2 at full gun strength and +7.3 after `GARRISON_GUN_TRADE`. The seed
  finding above says a 15-cell near-binary mean moves in steps of 6.7 points and
  therefore cannot resolve a 7-point effect; read per faction on current content
  the same statistic gives +1.4 for the USA, -8.8 for China and -11.2 for the
  KPA. The claim was not wrong so much as unsupported at the resolution it was
  made. Nothing about the design changes — a wall still spends the attacker's
  time and the gun trade still buys the attacker survival — but both are now
  asserted on continuous measures that can see them: ticks-to-first-loss (walls
  buy +4.9% to +13.2%, same sign everywhere) and destruction share. The general
  rule this leaves behind: before believing an effect, check that the instrument
  can resolve something that small.
