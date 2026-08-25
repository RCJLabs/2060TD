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
- 2026-08-24 — **A faction pick was also a difficulty pick.** The game has two
  Front Line kits — the PLA post that the USA and the UN raid, the US firebase
  that China, Russia and the KPA raid — and nothing had ever compared them.
  Every reference force against both, with forced shapes so the target deal
  could not move the answer, found the PLA kit 34 clear-rate points softer for
  all five. Two of the three gun slots carried it: weighted by effective damage
  against the armour the reference plans field, times covered ground, the US
  area-denial gun was worth 2.80x its opposite number and the anti-armor gun
  2.00x, while the basic slot was already even at 0.91x. The GDD had been
  contradicting itself in the same place — §4.2 gives China "rapid-fire
  anti-swarm emplacements" and the QLZ fired slower than the US autocannon.
  Levelled on rate and reach, never on damage, because a heavier shell would
  have made China's guns precision weapons and precision is the other kit's
  identity. Parity of worth, not of design. The lesson is narrower than the
  usual one and worth keeping: a whole layer of this game had no instrument
  pointed at it for eleven releases, and the reason it went unnoticed is that
  every table in the harness measured factions against their OWN front and
  never across.
- 2026-08-24 — **A command post is killed by melee, and the heavy's damage type
  is one of the largest numbers in the game.** Ranged fire goes through
  `DAMAGE_MULT` and is discounted hard against a structure — smallArms 0.15,
  flak 0.1, kinetic 0.5, explosive 1.0. Melee (`hqDps`) ignores the table
  entirely but only fires when a unit is adjacent, which in practice only the
  heavy manages: it lands 60-84% of the killing blows. So the flag naming what
  a tank shoots decides how fast that faction can end a raid, and it was picked
  for flavour — USA and China fire explosive at full value, Russia, the KPA and
  the UN fire kinetic at half. Swapping only that flag is worth +3.6 to +16.7
  clear-rate points. Nothing is being changed on the strength of this yet,
  because `--plans` says the faction ordering is not a reliable target until
  the reference plans are settled; what is recorded is that three factions pay
  a large undocumented tax on a field that reads as tank trivia. The general
  rule, and the third instance of it this milestone: a number that looks like
  flavour can be load-bearing, and the way to find out is to swap it and
  measure rather than to reason about what it obviously does.
- 2026-08-25 — **A raid is one unit, and nobody decided that.** Silencing each
  unit kind in turn — both damage channels, everything else held — measures what
  a unit delivers rather than what its stat line advertises. One tank is 46-87%
  of a raid for every faction, and 11-18 of every 27 manpower delivers nothing
  measurable: three USA Ranger squads move the outcome by zero, as do the UN's
  medics and its breach team. The mechanism is that ending a raid means killing
  the command post, ranged fire is discounted hard against structures, and melee
  only fires when a unit is adjacent, so the heavy is the only thing that
  reliably arrives and hurts. This is a design question before it is a balance
  one: as it stands the raid planner — squads, sectors, doctrines, launch
  delays, veterancy — is decoration around whether the tank was brought. The
  three ways out are recorded in the ROADMAP (give infantry a way to hurt a
  post, make the heavy killable enough to need escorts, or accept it and stop
  pretending). Nothing is tuned until that is settled, because a buff to a unit
  that never reaches the post buys nothing — which cost three separate
  measurements to learn.
- 2026-08-25 — **A raid is now two units for three factions, and still one for
  two.** v1.22 moved anti-structure power out of the heavy (×0.8 on both its
  channels) and into the ranged infantry (×1.5 on its weapon), which unlike the
  riflemen fire `shaped` or `explosive` and so can hurt a command post from a
  standoff. Measured: the clear rate moved 40.3 → 40.2 and the parity spread
  26.4 → 27.0, both inside noise, while the heavy's share of a raid fell from
  67% to 50%. Russia, the KPA and the UN now have a real second carry at 55%,
  62% and 36%. The USA and China do not, and the reason is worth recording
  because the obvious guess was wrong: their escorts are not incapable, their
  raids simply succeed on the tank alone, so silencing the escort changes
  nothing. Normalising the heavies' damage type was measured as the fix and is
  not one — it costs 12-22 clear points and leaves the Javelin at 8%. What is
  left needs the heavy to be insufficient by itself, which is a difficulty
  decision as much as a design one.
- 2026-08-25 — **Concentration is not always a defect: closing the USA/China
  carry share without a change.** After v1.22 those two still won on the tank
  alone (86% and 79%) where the other three had a real second arm. Four routes
  were measured and none moved them — heavy HP, anti-armor towers, normalising
  the heavies' damage type, thickening the command post — each costing 3-22
  clear-rate points for nothing. The reason is that every one of them attacked
  the tank or the defence, and the actual term is the escorts: the USA's have
  the second-highest anti-structure output in the game and the fewest bodies
  and the least hit points, so they fail on survival rather than output (escort
  HP ×1.3 lifts their standalone clear rate from 8.3 to 20.3; doubling their
  damage only reaches 29.2). Which makes the fix a buff to the strongest
  faction — and worse, GDD §4.1 gives the USA "low unit counts, every loss
  hurts" and §4.2 gives China "individually fragile units". Eight escort bodies
  dying before the objective is that design working. The trade landed for the
  three rosters built to sustain a second arm and left the two whose identity
  says they cannot, which is the right answer. The lesson is the one this
  milestone keeps teaching from new angles: check what a number is supposed to
  mean before deciding it is wrong.
