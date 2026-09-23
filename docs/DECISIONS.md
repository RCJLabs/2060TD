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
- 2026-08-25 — **A gesture belongs to whichever region it started in.** The
  owner reported that a single scroll moved the map and the button drawer at
  once, and the first guess — overlapping rects — was wrong: the board and the
  drawer are disjoint in both orientations, and both wheel handlers were
  already correctly gated. Three separate faults produced the same symptom, and
  none of them was visible to any existing harness, because a double-scroll
  presses no button and changes no text. (1) The drawer decided ownership from
  where the finger *is*, not where it went *down*, so a pan that started on the
  map was adopted the moment it crossed the boundary — and then anchored on a
  press that happened somewhere else, which snapped the list by the whole
  distance between them. It now tests `pointer.downX/downY`. (2) The board's
  pan flag had no owner: the pointer-up that ends a drag over the drawer is
  swallowed by the row under the finger, so `dragging` stayed raised and the
  *next* gesture — wherever it started — panned the map as well. The pan is now
  bound to the `downTime` of the press that opened it, the same way the drawer
  already bound its own. (3) A flick left coasting kept running under the next
  gesture, so the drawer was still moving while a drag panned the map. A new
  gesture now catches it, on its first movement rather than on the press —
  stopping on the press kills every flick, because a touch release can
  synthesize a compatibility mouse-down at the moment of the lift. Pinned by
  `scripts/e2e-gesture.mjs`, which reads the board camera and the drawer's
  scroll offset across one gesture; each of the three checks was verified to
  fail when its own cause is reverted, and two false passes were found and
  fixed in the harness itself along the way — a list already at its stop cannot
  move, and reads zero for a reason that has nothing to do with the fix.
- 2026-08-25 — **The seed was nearly inert, and every balance table was a count.**
  `npm run balance -- --seed` was written to ask a question nobody had asked in
  twelve releases: does the seed change a raid? Fighting each of 200 matchups
  twelve times, **86% reached the same verdict every time** and in **54%** the
  identical force walked back. The one thing that moved was how long a battle
  took — the ±3–8% spawn jitter perturbing arrival times without perturbing
  who wins, which is exactly why nothing ever looked wrong. Two consequences
  followed and both were live: `clearPct` in every matrix was a COUNT of
  matchups tipped rather than a probability, so a 15-cell mean moved in
  6.7-point steps and twelve releases of tuning had been read off it; and
  re-fighting a base was pointless, which quietly hollowed out the league, the
  day orders and the ladder. The per-faction split corroborated v1.22 from a
  new direction — the USA and China, whose raids succeed on the tank alone,
  were the most decided at 93% and 95%, against 80–83% for the three with a
  real second arm.
- 2026-08-25 — **Not every burst tells: a quarter of fire does nothing, and the
  rest is scaled so nothing is buffed.** Twelve candidates across four shapes
  were priced on the same 8 seeds, each built so its expected multiplier is
  exactly 1 — a roll whose mean drifts is a difficulty change wearing a
  variance costume and the tables cannot tell the two apart. Three findings,
  two of them not the guess. **A fine spread washes out**: ±50% on every shot
  moved DECIDED only 88%→77%, because many small independent rolls average to
  their mean inside one engagement, so variance has to be COARSE to survive to
  the outcome. **The zero matters, not just the variance**: a 40% glance to
  ×0.3 and a 25% miss have almost identical variance (0.327 against 0.333) and
  land five points apart, because a shot that does nothing lets a unit at 1hp
  live. **Aiming loosely is a difficulty change rather than a variance one**:
  letting a gun pick among near-equal targets cost +2.2 clear for a thin fall
  in DECIDED, and stacked on the winner it UNDID six points of it — spreading
  fire across a force averages the damage instead of concentrating it, so
  nobody crosses a threshold early. It was measured, it lost, and the
  mechanism was deleted rather than left in as dead surface. 25% turned out to
  be an optimum rather than a floor: 30% and 40% both buy less resolution for
  more drift. Shipped: DECIDED 86%→63%, SAME MEN HOME 54%→28%, and the plan is
  still worth up to 13.7 points, so skill did not wash out with the certainty.
- 2026-08-25 — **A duel is a puzzle to beat, so its rolls are pinned; the
  ladder's are not.** Once combat rolls, "fight this pasted code" splits in
  two. A challenge pins its rolls to the code's own fingerprint: `town.duels`
  records the challenges you have SOLVED, and the rule already in place strips
  the weather and the loot bonus from a duel so that the PLAN is what differs
  between two attempts — rolls that varied per attempt would put the luck
  straight back in and "beaten" would stop meaning solved. The ladder, seeded
  from the clock, is a different battle every time you go out, which is the
  half of the game that was stale. Share codes needed no change at all: a code
  carries a BASE, and the model is a property of the battle fought against it.
- 2026-08-25 — **Changed the measure, did not tune in the same release.** Every
  spread narrowed on its own — parity 27.0→25.6, the two-kit gap 13.5→12.0,
  the best-plan spread 20.4→18.3 — and the ladder's impossible rungs mostly
  stopped being impossible, four exact zeros in the parity table becoming one.
  The mean rose ~1 point, which the pricing predicted and which is threshold
  asymmetry rather than a broken mean: a raid needs its heavy to reach the
  post, so noise in the fire trying to stop it helps the attacker slightly
  more often than it hurts. None of that was tuned back. Doing both halves in
  one release is how a milestone ends up unable to say which half did the
  work, and this project has recorded that mistake before — Russia's ten
  points were left standing for the same reason in v1.20.
- 2026-08-25 — **A raid declares what it came for, and progress stops being one
  boolean.** Four milestones kept arriving at the same place: a raid was 46-87%
  one tank and the planner was decoration around *did you bring the heavy*.
  The cause turned out to be narrower and cheaper to fix than "there is only
  one way to end a raid". A failed raid already razes a third of the post and
  banks about half a win's loot — the material economy had partial credit all
  along. What had none was PROGRESS: `frontline.wins`, standing, veterancy
  records, `postsTaken` and duel completion all read `cleared`. So the razers
  and hunters did deliver something; it was the currency that could not
  advance you. The measurement with a veto over the whole design was whether
  named objectives would select for different forces, and it came back **15
  distinct winners of 15** — a specialist lands 83-86% on its own mission and
  0-25% on the others. The mechanism was already in the damage model: melee
  ignores `DAMAGE_MULT` so infantry can kill a command post, while ranged fire
  is discounted hard against structures so the same infantry cannot kill a
  tower. Different missions need different armies because the combat maths
  already made them need different armies.
- 2026-08-25 — **The objective lives in the war layer, not the sim.** The
  engine knows what a structure IS — `structureClass` and `countStanding` are
  queries it answers — and `src/meta/objectives.ts` decides what that means
  for a raid. So there is no new `Phase`, no engine branch and no determinism
  risk; the objective rides the config only so the resolver and the replay
  stop on the same tick, through one shared `watchObjective` they both build
  rather than two checks that could drift. The quota is a share of what the
  base is holding rather than a flat count, because a flat count is impossible
  on a small base and free on a large one; 0.65 was swept, not chosen. Only
  taking the post advances the ladder, which protects it by construction, and
  the standing rates were set from standing per MAN LOST rather than argued —
  the post stays the efficient climb in all five factions by 1.5-2.3x.
- 2026-08-25 — **"Beeline HQ" never beelined, and fixing that was the wrong
  change.** ASSAULT halts for whatever comes into reach, exactly as HUNT and
  RAZE do, only without preferring anything — which measured across three
  force compositions left it the worst doctrine for guns, economy and loot in
  every row, with a best case of TYING hunt at taking the post. Making it fire
  on the move looked like the obvious fix and gave enormous gains: armour-only
  forces went 59.7 to 88.9 for Russia, 36.1 to 80.6 for the KPA, 54.2 to 77.8
  for the UN. It was still rejected. On the plans players actually send it made
  three factions worse, the parity spread went 25.6 to 30.8, and it deleted a
  mechanic specified and tested since M2 — two of its three test failures were
  the single assertion "a ranged attacker stops to destroy a defensive
  structure, then moves on". The armour-only row keeps being seductive and
  keeps being wrong: a force nobody sends is not evidence about the game. What
  objectives DID give ASSAULT is a reason to exist — there is now an ending
  that only cares about the post — and it is the best post-taker for the USA
  and China. For the other three it remains weakly dominated, and the untested
  option is removing the doctrine outright.
- 2026-08-26 — **A measurement cannot be read finer than the axis it was taken
  on.** `--rungs` finds the smallest force that clears a rung half the time by
  walking a fixed budget grid, and the grid jumped 27 → 33. Every rung whose
  true demand sat between them reported as one or the other, so four of five
  factions read "flat at the top" and two milestones recorded that flatness as
  a ladder defect to fix. On a grid roughly 20% apart at the bottom and 10% at
  the top, the USA and the UN are fully monotone: there was never a defect
  there, only a quantiser. The instrument had already earned trust by
  overturning the fixed-force ladder tables, which is exactly what made its
  output easy to read past its resolution. The rule the project already had —
  check an instrument before trusting its output — needs the sharper form:
  check what its output can and cannot resolve, because an instrument reporting
  a step it cannot see is not obviously broken, it is confidently wrong.
- 2026-08-26 — **Greedy selection does not just miss a target, it spends the
  option another slot needed.** A rung deals three (shape, layout) pairs chosen
  against a target curve. Filling each slot in turn with the closest remaining
  pair put China's T3 at 58 / 92 / 100 against a want of 70 / 85 / 100 — the
  pair the middle slot had no substitute for had already gone to the hard slot.
  Only the best pair per (shape, target) can be in a winning triple, so the
  candidate set trims to eight per slot and an exhaustive search over
  distinct-shape triples is a few hundred thousand combinations: instant, and
  structurally unable to make that trade. Parity 5.8 → 4.2, the best this
  project has measured. The general shape: when a selection has interacting
  slots and a small candidate set, search the combination — a greedy pass is
  not an approximation of it, it is a different and worse objective.
- 2026-08-26 — **Three labels, three false readings, one habit.** Pointing
  `--parity`'s question at air meant reading the air table closely for the first
  time, and its own words were wrong in three places at once. The edge column
  compared forces of different sizes — four of five air plans fly 3-4 MP more
  than the ground reference, documented as "roughly the same manpower" and never
  checked — so the two factions whose air appeared to WIN were only bigger.
  `MP LOST%` counted heads, so a 7-MP gunship and a 1-MP conscript weighed the
  same and a three-airframe force read as catastrophic for losses a nine-body
  force shrugs off. `AIR no AA` never removed any AA: every generated base builds
  its mounts and no row took them off, the control only stripped the garrison's
  reactive order. Each of the three had been read as a finding for four or more
  releases. The habit worth keeping is narrow and mechanical: **a comparison
  table must print the budget of both sides, and a column heading is a claim the
  code has to keep.** Two of the three fixes are one line of arithmetic; what was
  missing was ever asking the table to say what it was doing. The correct
  manpower computation had existed at the top of the same file the whole time —
  five later tables each re-implemented it by hand and each got heads, which is
  the argument for extracting a shared helper over trusting a pattern.
- 2026-08-26 — **Air is not weaker. It is a different ladder, and the game does
  not say so.** The deal picks each rung's three targets against measured GROUND
  difficulty — `--layouts` does that deliberately and should, since almost every
  raid is a ground raid. Measured per dealt target at a fixed budget, the two
  orderings barely relate: 39 of the 75 targets the five factions are dealt move
  by 30 or more clear-rate points depending on whether the force walked or flew,
  and for the USA the two targets an air force cannot take at all (`camp` 0%,
  `depot` 5%) are the two its ground force finds EASIEST (60%, 100%), while
  `star` and `keep` invert the other way at 100% flown against 45% and 35% on
  foot. The mechanism is not subtle once seen: walls and overlapping arcs are
  what make a rung hard on the ground and neither exists for an aircraft, so
  what remains is the flight in — and the shapes with the fewest walls are the
  ones that spread their mounts and their command post over the most ground. The
  means are close for four of five factions, so this is not a power problem, it
  is an INFORMATION problem: a player is told the shape for free and told
  nothing about what it means to an aircraft, which makes the choice to fly a
  lottery. Selecting the deal against both ladders is the cheap answer and costs
  ground parity that took three milestones to earn; saying which targets suit an
  aircraft is the better one and touches no number that is currently right.
- 2026-08-26 — **A read has to beat what the player already gets for free.**
  v1.33 left air as an information problem: half the dealt targets are a
  materially different proposition flown, and the game never said which. The
  fix could have been a lookup table keyed on (tier, slot, faction) — cheap, and
  worthless the moment a share code or a duel puts a base in front of you that
  no table has seen. It is a RULE instead, computed from the layout: for every
  gun that can elevate, how much of the straight run in falls inside its
  envelope, over the speed of the slowest airframe, times its damage per second.
  What makes that a decision rather than a story is the bar it had to clear. A
  player is already told the shape, so the shape's own mean was scored as the
  incumbent — and scored on the very rows it was fitted to, which flatters it.
  Transit wins 0.50 r² against 0.21, and wins for all five factions separately,
  which is what rules out a predictor carried by one roster. The obvious
  dominant term did NOT ship: flak covering the post, where the aircraft has to
  hover, scores 0.17 and makes the combination worse, because on a generated
  base it is nearly binary and a term that cannot vary cannot predict. The
  presentation went the same way — three bands, cut at the TERCILES of the
  measured population rather than at round numbers, so the boundaries could not
  be nudged to make the separation look better than it is (91.0 / 76.8 / 18.4).
- 2026-08-26 — **A fixture that has never owned the feature cannot test it.**
  The demo raid town describes itself as "a mustered mid-game town" and had a
  barracks, a motorpool, five kinds of infantry and armour, a fire plan, and no
  airfield — so in four releases of air-layer work nothing in the harness had
  ever flown. The air read shipped invisible in the first E2E run for exactly
  that reason, and the gate was working correctly: no strip, no row. The lesson
  generalises past this fixture. A showcase drifts into being a snapshot of
  whatever existed when it was written, and every feature added after it is
  untested by everything that uses it. Worth asking of any fixture: which
  shipped systems does this thing not contain?
- 2026-09-18 — **Hue was spending the whole budget to say one thing.** The map
  table of v1.19 used colour to carry ground class — green woodland, blue
  water, buff paper — and the cost of that shows up in a clause the palette
  had to state out loud: everything you own has to sit between L\* 21 and 35
  because everything the ground does sits between 63 and 83, and a silhouette
  drawn on top of it needs a cream knockout behind it or it is lost. The ink
  pass says the same thing with TONE DENSITY and gets the value budget back.
  The legend is not decorative: `t10` open, `t20` rough, `t40` steep, hatch
  woodland, cross-hatch water, bare paper road is exactly the `Ground` enum
  the pathfinder reads, so the density you see is the move cost you pay. What
  it buys is a rule with no gap in it — ground is never darker than a screen,
  hostile is solid ink, yours is bare paper inside a keyline, and nothing is a
  mid grey. A phone at 40% brightness in sunlight loses crimson-against-olive
  and loses none of this, and the whole direction is colour-blind safe almost
  by accident, because the one hue left is a mark rather than a fill.
- 2026-09-18 — **The same margin is a keyline at 90 px and a blot at 26 px.**
  Structures and units both carried v1.19's paper halo, sized as a knockout
  pad, and inverting it to ink worked on one and destroyed the other: a
  building came out as paper inside a clean line, and a rifleman came out as a
  small white figure in the middle of a large black disc, because the pad had
  never been sized as a line. Three passes at the contact sheet to see it, and
  the fix is that they are different objects. A structure is architecture
  drawn on the map and gets a keyline. A unit is a counter placed on it, and
  gets its outline by painting the whole figure eight times in ink around
  itself — equivalent to a real outline for a closed silhouette, and free for
  all thirty-four kinds and the nine primitives they share, where drawing one
  per shape would not have been. The general form: a margin measured as a pad
  is not a margin measured as a line, and a set of counters can only be judged
  as a set, at the size the game actually draws them.
- 2026-09-18 — **A palette swap is a rendering change everywhere the palette
  is read, including where nothing looks at it.** Flipping `bgPanel` to paper
  and `ink` to black repainted the entire UI correctly and silently broke two
  things no test could see. An active tab filled with ink and kept an ink
  label, so the open tab was a black rectangle with no name in it. Worse,
  full-screen overlays had never owned a background — they drew type straight
  onto an 86% black scrim, which worked while the type was cream — so every
  briefing, report and menu became #111 on near-black, and all twenty-two E2E
  harnesses stayed green, because the text objects were all still present and
  still reported their strings. Label-driven checks cannot see contrast. The
  answer was a harness change, not just a fix: `npm run screenshot` now shoots
  the front door and drives a real overlay open, and `npm run zoom` magnifies
  a region nearest-neighbour, which is how the grey rotor ring, the grey air
  shadow and the health bar with an invisible trough were all found — every
  one of them invisible at page size and obvious at 8x.
- 2026-09-18 — **A default that was right for one theme is a bug in the next,
  and it fails silently.** Every `PanelRow.icon` supplier hard-coded
  `onDark: true`, which was correct for four releases while the drawer was a
  dark rail. Inverting the drawer to paper made all of them draw a white
  silhouette on a white row — invisible, leaving only the grey trim, and
  nothing anywhere reports an error. The row is the only thing that knows
  whether it is a knockout, so the flag became a parameter the row passes in
  rather than a constant the caller guesses. Worth asking at every theme
  change: which callers encoded an assumption about the theme as a literal?
- 2026-09-18 — **Hue was carrying faction identity too, and nothing replaced
  it until now.** The ink pass took the colour out of the board and left five
  armies looking identical everywhere but their names — which is worse than it
  sounds, because the names are phrases (PLA EXPEDITIONARY FORCE, KOREAN
  PEOPLE'S ARMY) and a phrase is not an identity you can see at a glance. The
  replacement is SHAPE, one mark each, each one saying what that army is for:
  a star, a star with four wheeling off it, a slab over a chevron, an arrow
  going under the line, a globe in laurel. It costs nothing on the board — the
  marks live in the UI, where identity is a choice rather than a threat — and
  it is the same substitution the ground made, for the same reason: the page
  has one colour and it is spent on things that just happened.
- 2026-09-18 — **"Blocked" was a trade nobody had priced.** One release earlier
  this project wrote down, in the GDD and the roadmap both, that the display
  face could not ship: Barlow Condensed is what the mockups are set in, adding
  it would cost the offline build and the single-file build a network
  dependency, and a Phaser canvas cannot subset and inline a face the way a
  DOM UI can. Every clause of that is true and the conclusion was still wrong,
  because the trade was never network-versus-nothing. Google already serves a
  latin subset: two weights are 45 KB, which as base64 data URIs in a
  stylesheet is 60 KB against a single-file build of 1.8 MB — three per cent,
  no request, still offline. The lesson is not about fonts. A constraint
  written as a sentence goes unchallenged; the same constraint written as two
  numbers answers itself. Anything filed as blocked deserves one measurement
  before it is believed.
- 2026-09-18 — **Canvas text does not load fonts, and Phaser measures at
  construction.** The two together make a failure with no error in it: a game
  that starts before the face is ready measures the FALLBACK, caches those
  metrics, and lays every row, wrap and tap target out for a font it is not
  drawing. `main.ts` waits on `document.fonts.load` for both weights before
  constructing the game, raced against a timeout so a face that fails to
  decode costs the look rather than the session. The same shape of bug then
  turned up one layer down: `Button.setFont` resized both the label and the
  sub by the same number, which was correct while they shared a face and wrong
  the moment the label became condensed and took a scale multiplier.
- 2026-09-18 — **A promise that stops being true silently needs an assertion,
  not a comment.** `build:single` printed "one file, no requests" from the
  moment it was written, and it was true because Vite emitted no CSS at all —
  the page carried its handful of rules inline. Inlining the font made Vite
  emit a stylesheet, the inliner only ever folded in the script, and the
  build cheerfully printed the same sentence over a file that now fetched
  something. The fix is two lines of check: no surviving stylesheet link, no
  surviving `./assets/` reference. Any claim a build makes about its own
  output should be enforced by that build.
- 2026-09-18 — **A test that passes on a coincidence is a test that will lie
  to you later.** `e2e-vet` asserted that a fully loaded squad row wraps onto
  a second line and grows, and it passed for four releases — not because the
  wrap machinery was verified, but because the longest label this screen can
  produce, 36 characters, happened to overrun a desktop rail. Setting labels
  in a condensed face bought back about a fifth of their width and the
  assertion failed with nothing broken. Narrowing the window does not restore
  it either: a narrower rail drops to one column and the row gets WIDER, which
  is worth knowing on its own. The assertion is gone rather than contorted,
  and the coverage loss is written into the harness beside the checks that
  remain, because a fixture that fakes a condition is worse than a documented
  gap. The general form: when a check asserts a MECHANISM through a fixture
  that only incidentally triggers it, the fixture is the test, and it will
  keep reporting green through the first real regression that shortens the
  input.
- 2026-09-18 — **"It cuts rather than fades" was a comment, not a curve.**
  `punch()` was written to keep an effect at full ink and then cut, because
  ink at any alpha between black and nothing is the mid grey the whole
  direction refuses. What it actually did was hold for two thirds of the life
  and ramp over the remaining third — 300ms of grey on a heavy impact, which
  is not a cut by any reading. It survived because at page scale a dying
  effect is small and nobody looks at it; it was obvious the moment a frame
  was magnified, with the focus lines and the lettering both sitting at about
  30%. The hold runs to 0.88 now and the ramp is 0.12. The general form: a
  constant that encodes an intention should be checked against the intention,
  because the name in the comment will keep being true long after the number
  stops being.
- 2026-09-18 — **A moment that lasts half a second needs an instrument, not a
  screenshot.** Everything the ink pass added to combat — lettering, focus
  lines, speed lines — exists only while something is being destroyed, and
  `npm run screenshot` fires at a fixed wall-clock time. Verifying meant
  shooting blind and hoping. `npm run catch` samples a running battle and
  keeps only the frames where the on-screen text matches a pattern, off the
  same `lastline.texts()` seam the E2E harnesses already use. It found the
  grey ramp above on its first run. The pattern generalises past this project:
  when a thing is too brief to catch on a timer, the harness should catch it
  on a PREDICATE.
- 2026-09-18 — **A theme pass stops at the edge of the thing you are looking
  at.** Eight phases of the ink pass repainted every pixel inside the canvas
  and left the entire launch surface on the previous direction: a dark boot
  card, a dark body, `theme-color: #101210` painting the notch and system bars
  around a white game, a manifest still describing "a topographic map sheet",
  and four PWA icons still olive on cream. None of it is reachable from the
  code that changed, none of it is covered by a harness that drives the game,
  and all of it is what a player sees FIRST — the load sequence was a dark
  screen resolving into a white one, on every launch, on every device. The
  icons now have a generator rather than being hand-made binaries, which is
  the difference between an asset that can drift silently and one that is a
  re-run. Worth asking at any direction change: what does this project ship
  that is not source?
- 2026-09-18 — **Dev and production disagreed about when a font exists, and
  the screenshot could not see it.** The display face shipped as
  `src/fonts.css`, imported from `main.ts`. Vite emits that as a
  render-blocking `<link>` in a production build and injects it through the
  module graph in dev — so the boot card, which paints before any module runs,
  came up in Barlow for a player and in the mono fallback for every screenshot
  this repo takes. The fix is to inline the two `@font-face` blocks in
  `index.html`, which also costs one round trip less before first paint, which
  is the one thing the boot card exists to win. The general form: a build tool
  that makes dev "faster" often makes it DIFFERENT, and the difference lands
  exactly on whatever paints earliest.
- 2026-09-18 — **The board turned upright, and the axis that shrank is the one
  nobody walks along.** 32x24 entered from the west put 32 cells across the
  short side of a phone: an 11px cell, too small for a silhouette, a level pip
  or a fingertip. 20x30 entered from the north gets the same phone 18px. The
  measurement is what made the choice obvious and it took an instrument to get
  it — `npm run fit` scores a candidate grid against the real board rect on six
  devices, and its first draft asserted that the drawer could not matter
  because "width is what binds", which was true only of the shape being
  replaced. **Two levers, and each alone is worthless:** the shipped grid reads
  11.3px whatever the drawer does, and a portrait grid reads 10.9px with a
  half-open drawer that refits the board. Neither number moves until both move.
  The cost is four cells ACROSS the line and two of depth, and depth is what
  decides a raid — so this is a 22% cut in area that barely touches the fight.
- 2026-09-18 — **Author in the frame the thing is about, not in the frame the
  screen happens to be.** Eight wall plans, three reference bases and a
  showcase town were all written in x and y, which only ever meant anything
  because the attack came from the west. Moving them to `u` (depth from the
  entry line) and `v` (across it), with the transform at the few points where a
  plan emits a cell, let the board rotate without re-tuning a single shape —
  verified as 184 generated bases fingerprinting identically against a v1.39
  worktree before the shape changed. The same principle caught five E2E
  harnesses: each carried its own copy of the grid's dimensions or a box of
  coordinates around where the base used to sit, and all five failed saying "no
  free cell in view", which reads like a camera bug and was arithmetic. **A
  test should not hold an opinion about the size of the thing it is testing.**
- 2026-09-18 — **A migration that reinterprets an index fails quietly.** Every
  other migration this project has done added a field, and a save missing one
  is obvious. This one changes what a cell number MEANS, and left alone the
  file still loads, the buildings are all there, and the base is simply wrong.
  The transpose is chosen over anything cleverer precisely because it is the
  map that carries the old command post to the new one: every building keeps
  its offset from the post AND its distance from the enemy, so a base that
  funnelled attackers into a crossfire still does. Two details earned
  themselves: it runs BEFORE the terrain is fitted, because the ground is
  fitted around whatever is standing and fitting first would put a river where
  the base is about to move; and the rehoming walk for the 168 cells that no
  longer exist is aimed at the CLAMPED transposed position, because the first
  draft fell back to cell 0 and teleported a fuel dump from the deep rear
  corner to the enemy's doorstep — still present, still counted, and a gift.

- 2026-09-19 — **Taking a command post is a job, not a health bar** (M22, the
  kill chain). The post becomes a four-stage progress bar — breach, suppress,
  charge, burn — each stage gated on a DIFFERENT stat, so no unit answers all
  four. Behind `KILL_CHAIN_VERSION`, frozen, with version 0 the sponge, exactly
  as `TERRAIN_VERSION` and the combat model are. Three of its rules were
  written because a measurement or a test refused the first draft: an aircraft
  is not a body on the ground (two gunships took a post with no demolition and
  no infantry), the burn backs off rather than resetting, and the crew minimum
  of two stays even though dropping it is the single largest gain in clear rate
  available — buying back difficulty by reopening the defect the milestone
  exists to close is a poor trade.
- 2026-09-19 — **A model that takes something away is how you find out what was
  really carrying the game.** Wiring the stages in dropped the reference
  expeditions from 76.9% to 11.3%, and no constant moved it: four of five
  factions scored EXACTLY ZERO under every variant swept, which is the shape of
  a structural cause rather than a balance one. It was. Explosive does 1.0
  against `structure`, so three tanks had been parking at range four and
  shelling the post down without ever entering the base — a win condition
  nobody designed, undetectable for twenty-two milestones because it worked.
  The chain clamps standoff fire at the breach floor, and the AI then stood
  there shelling a bar that could not move, since a unit with a target in reach
  does not advance. Dropping the opened post from the target list took the same
  constants from 11.3% to 49.4%. **Identical results across a whole sweep are a
  finding, not a plateau.**
- 2026-09-19 — **An instrument that cannot see a channel reports zero, and zero
  reads like a finding.** `--chain`'s `silence()` zeroed `hqDps` and the weapon
  but not `wallDps`, so Phase 1 reported the KPA tunneler moving 13-15 points
  when its demolition is worth 62-67, and reported two of China's three kinds
  as contributing nothing. Separately, the first staged run reported BURN at 0%
  for every faction while the post's bar reached 0.000 in every raid that set a
  charge — the stage was read before the burn was applied, and the battle ends
  in the same tick, so a completed burn looked like a stalled one forever. Both
  were caught by cross-checking the instrument against a second reading before
  tuning against it, which is the only reason the constants were not re-derived
  against a broken readout.
- 2026-09-19 — **A search cannot propose what its representation forbids** (M22
  Phase 3). `--derive` capped a composition at three unit kinds, which was
  invisible until the kill chain gave the game four stages wanting four
  different units. The search would have answered "nothing beat the reference"
  and the answer would have been about the instrument. Lifted to four — one per
  stage — and three of five factions immediately turned up three-kind plans
  containing units that had measured zero for twenty-two milestones. Before
  concluding that a model failed to change behaviour, check that the thing
  measuring behaviour can express the change.
- 2026-09-19 — **An argmax cannot price a trade.** The plan search reported one
  winner per faction, which can say whether the reference is stale and nothing
  about what a better-shaped plan costs. Reporting the best plan at each number
  of unit kinds turned an unanswerable question into a two-line answer: mixing
  is free — every faction has a three-kind plan within 2.5 points of its best
  concentrated one, and China and Russia gain 10-17 by it. The milestone's whole
  premise turned on that number and no previous run could have produced it.
- 2026-09-19 — **Disagreeing with yourself is data.** Raising the plan search
  from 150 samples to 260 — a strict superset of the same seeded stream — moved
  the USA's reported three-kind optimum from 75.0 DOWN to 65.8. More candidates
  cannot make a true best worse, so the drop proved the noisy screen was
  evicting the real winner before it was ever deep-scored. Two habits paid for
  themselves here: running the same measurement at two sizes, and verifying the
  plans actually adopted directly on held-out battles instead of trusting the
  search's own report of them.
- 2026-09-19 — **A bar written before the measurement can turn out to be about
  something else.** M22 asked for a carry at or under 50%. Re-derived plans
  deliver it for three factions — Russia falls to 6% — and cannot for China or
  the UN at any composition measured: dropping one Type 99 costs 16-35 points,
  dropping two VABs costs 7-14. Those rosters concentrate 21 of 26 manpower's
  worth of value in one unit, so the bar is a claim about CONTENT and no choice
  of plan satisfies it. Recorded as failed rather than redefined as met.
- 2026-09-20 — **A fix that explains nothing is still a fix, and saying which
  is the job.** The first chain-measured balance snapshot showed every WITH AA
  COVER defence row jumping two to three ladder levels. The guess was that
  `coveringGuns()` counted air-only mounts, and a change shipped saying the
  snapshot had found it. Re-running with the change in place reproduced all
  fourteen moved rows EXACTLY: the mounts in that row are dual-purpose flak
  sited inside the cover radius, so they gate suppression correctly and the
  jump is the model working. The rule is kept — a Stinger pit cannot suppress
  infantry standing on the post — but it is latent, and the only thing that
  exercises it is a test written for that purpose. A causal claim and a
  correctness claim are different claims; publishing the first on the evidence
  for the second is how a changelog starts lying.
- 2026-09-20 — **A re-tune wants a stable target, and M22 has not been played.**
  Phase 4 regenerated every matrix and then changed no content. The chain
  closed the faction spread 23.0 to 18.8 and dropped the mean 83.8 to 68.2,
  with tier 5 at 8/32/12/72/0 — a real wall, and three obvious levers for it.
  All three are the mistake M33 already made and measured, where scaling the
  gun ladder by frontage overshot so far that a +45% wall condition measured no
  difference at all. Tuning content against a snapshot one run old, of a combat
  model four phases old, that no player has touched, is doing the work twice.
  Measured, explained, levers named, handed forward.
- 2026-09-20 — **A rule that makes something unwinnable must also make it end**
  (M23 Phase 1). The kill chain's crew minimum means one attacker can never take
  a command post — which was the point, and which nobody thought through to its
  conclusion: once every gun that could reach that attacker is dead it can never
  be killed either, and a wave ends only when the attackers do. v1.41 shipped an
  18% chance of a siege that never finishes. Measured as 0% on the sponge against
  18% on the chain, the signature identical every time: one unit, state
  `assaulting`, bar pinned at the breach floor. An assault that achieves nothing
  for ninety seconds is now spent and withdraws. The termination argument for a
  battle used to be "attackers die"; adding a rule that makes an attacker
  incapable of winning quietly removed the other half of it.
- 2026-09-20 — **The second half of a bug hides behind the first.** Fixing the
  ground deadlock revealed an identical one for aircraft, caused by a different
  M22 rule: "an aircraft is not a body on the ground" keeps it out of the holder
  count, so a stall clock gated on holders never started for the attacker that is
  hardest to shoot down. Two rules written a phase apart, each correct alone,
  composed into a hole. The measurement that caught the first was re-run after
  fixing it and still showed 6% — which is the only reason the second was found
  at all.
- 2026-09-20 — **A spent assault is written off, not walked home.** The stall rule
  ends the deadlock by destroying whoever is still standing on the post, and the
  fiction calls that a withdrawal. Held to one variable — same seeds, same plans,
  chain v1 against v2 — CLEAR% and DESTR% come back identical in every tier of
  the USA ladder and only MP LOST% moves, T2 27 → 73 and T4 66 → 75. So the rule
  changes nothing about what a raid achieves and everything about what a
  half-failed one costs. Both halves of that were worth keeping: a second removal
  path that let a unit vanish without the defender being credited would be a new
  way for something to leave the board with nothing watching it, and a stall that
  cost the attacker nothing would be a free way to end a raid that is going
  badly. The price is that a repulse reads as a kill in the stats, which for a
  defender who has just destroyed an assault at their own wire is close enough to
  true.
- 2026-09-20 — **A threshold a rule tests LIVE can be crossed back.** M22 stopped
  standoff fire shelling an immovable bar by dropping the opened post from the
  target list, and asked "is the bar above the breach floor?" every tick. A
  repair aura lifting the post a hair over that floor re-arms it as a target, so
  the defence's own engineering reinstates the livelock — measured on the
  sustainment faction defending its own command post, a bar oscillating between
  0.7031 and 0.7094 for thirty thousand ticks. The fix is a latch, not a bigger
  number: `chainDone` was already a high-water mark. The general lesson is that
  a rule expressing "this has HAPPENED" must not be written as a test on a
  quantity something else can restore.
- 2026-09-20 — **An instrument can only find bugs in the range it samples.**
  Three instruments looked at these sieges — `--siege`, `--leverage`, `--spend`
  — and all three read identically before and after a fix for a hang that
  affected 14 of 20 battles in one row. Every one of them ran the defender at or
  below the three actions HOLDFAST allows, and the hang needs more. The sweep
  that found it, `--budget`, was written to test a hypothesis that turned out to
  be wrong; it earned its place by what it found on the way. When a lever is
  cheap to sweep, sweep it past where the content currently sits.
- 2026-09-20 — **A rule list is a priority list, and nobody said so.** Standing
  orders evaluate in array order and every action spends one of `maxActions`, so
  a cheap rule at the top with a short cooldown silently starves an expensive
  one below it. TRIPWIRE ships with the best verb in the game at position two
  and scores WORSE THAN DOING NOTHING because a claymore rule at `cpAtLeast: 16`
  spends the whole budget first; deleting that one rule takes it from 65% to
  100% on the same five actions. The rule is a trap for whoever authors a preset
  next, including a player if authoring ever reaches them, and the defect is not
  in either rule — it is in the fact that ordering carries meaning nothing
  declares.
- 2026-09-20 — **The kill chain made the defence geometric, and the presets did
  not notice.** `--verbs` prices each defender action alone: a gun deployed
  within the post's cover radius is worth +31 points of hold rate, the same gun
  at the breach +4, a mine +2, a fire mission 0 or -3. SUPPRESS gates on live
  guns near the post, so placing a weapon there adds a GATE while everything
  else merely does damage — and damage is not what decides these battles. Two of
  the three shipped presets are all damage. They were written for the HP sponge
  M22 replaced, and nothing re-read them afterwards, which is the same oversight
  as `defenseMatrix` never being told about the chain, one layer up.
- 2026-09-20 — **The defence ladder is a step function, and that is why no verb
  matters.** 93% of the defence rows in `BALANCE.md` have one contested level or
  none: `100 | 85 | 0 | 0 | 0 | 0`. One row in fifteen is a ramp. Every lever
  priced in M23 Phase 2 — the action budget, rule order, a per-wave refill, the
  choice of verb, where it is aimed — moved rows between 0% and 100% and never
  produced a battle that was close, because a curve with no slope has nowhere
  for a player's input to land. The instinct at the start of the phase was to
  add verbs; the measurement says the verbs were never the binding constraint.
- 2026-09-20 — **A metric that falls for two opposite reasons cannot be read
  alone.** M23 Phase 1 shipped LIVE WAVES — the share of waves that move the
  post's margin — as the headline for "is defence an action game". It falls when
  the attack never arrives, which was the point, and it ALSO falls when the
  defence is dominant: the `perWave` variant raises hold rate to 93-100% and
  drops LIVE in every row. "Close" needs hold% near 50 AND live waves, and a
  single number cannot say that. Pairing it was the mistake, not measuring it.
- 2026-09-20 — **The step function is SUPPRESS being the whole battle.** Every
  defence row that reads 0% or 100% sums to exactly 100 across "the defence
  held" and "the attack cleared SUPPRESS": in those battles the gate and the
  objective are one event. Contested rows sum to MORE, because the attack got
  through and then failed at CHARGE or BURN — "then took it" is 18-40% there
  against 100% everywhere else. So the obvious repair, softening the gate, is
  the wrong one: it moves rows from "never starts" to "always finishes" without
  creating anything in between. What makes a battle close is the last two
  stages being able to fail, and in 14 of 15 rows they cannot. M22 built four
  stages and the ladder only ever uses two of them.
- 2026-09-21 — **The step function is the assault ladder's granularity, and
  three sweeps were needed to rule out everywhere else.** `--band` prices every
  chain constant that could make the last two stages decide a battle — burn
  length, burn decay, crew minimum, cover radius — and CONTESTED sits at 12% for
  all of them. `--slope` then dials attacker HP continuously and the rows move
  smoothly through every value: 100/85/40/15/0. So difficulty is continuous, the
  contested band is real and roughly 0.7x-1.0x of attacker HP wide, and one
  integer level of the ladder is a bigger jump than the entire band. The fix is
  content, not the chain. Worth the three sweeps: the first two hypotheses were
  mine and both were wrong, and the only thing that distinguished them was
  making the difficulty knob continuous.
- 2026-09-21 — **A lever can be right about the mechanism and worth nothing.**
  `coverRadius` 4 equals a deployed gun's weapon range, so the guns that gate
  SUPPRESS and the guns that can reach the post are the same set by
  construction — clearing the gate necessarily removes everything that could
  contest the burn. Shrinking it to 2 does exactly what that reasoning predicts:
  PASSED GATE 44% → 51%, THEN TOOK IT 83% → 73%. And the contested share does
  not move, because more attacks start and more of them fail, and the two
  cancel. Predicting a mechanism correctly is not the same as predicting an
  outcome, and only the outcome was the goal.
- 2026-09-21 — **A fix that improves the target metric and moves another one is
  half a fix.** Ramping newly unlocked assault waves in over three levels raises
  contested rows from 12% to 17% — the number M23 Phase 3 exists to move — and
  raises mean hold rate from 64% to 71%, because smaller early steps make the
  early ladder genuinely easier. Reporting only the first number would have been
  true and misleading. It sits on the branch unshipped until the top of the
  ladder is re-tuned to pay for it, on the same principle M22 Phase 4 used: a
  re-tune wants a stable target, and changing two things at once to make one
  number look good is how a changelog starts lying.
- 2026-09-21 — **The ladder was too short, and nothing was stopping it being
  longer.** A six-rung ladder over this difficulty range cannot have steps
  smaller than +33% even when perfectly uniform, and the contested band is only
  ~43% wide, so at best a player gets one contested level per base — which is
  exactly what eleven releases of tables recorded. Flattening inside six rungs
  costs either a 54% harder level 1 or a much easier middle. Adding rungs costs
  neither, and `assaultLevel` was never capped: the "six levels" existed only in
  the balance tables' sampling. Growth 0.18 → 0.09 takes contested levels per
  row from 0.73 to 2.20.
- 2026-09-21 — **A metric keyed to level NUMBERS cannot survive changing what a
  level is.** `--band` samples levels 2-5 and read the lengthened ladder as 3%
  contested and 82% mean hold — a catastrophic-looking regression that was
  entirely the sample sliding out from under it, since those rungs now field a
  third of what they used to. The replacement counts contested levels across the
  whole ladder, which is what a player actually climbs and is invariant to its
  length. An instrument that hard-codes a coordinate is measuring the
  coordinate, not the thing.
- 2026-09-21 — **A new flag silently shadowed an old instrument.** `--contested`
  was first written as `--rungs`, which M15 already used for the manpower-demand
  table; `process.argv.includes` matches the first handler, so the older
  instrument became unreachable and nothing failed. It was caught because the
  GDD happened to name the old flag in prose. The balance tool now has enough
  flags that adding one should start with grepping for it — a duplicate costs an
  instrument, and an instrument that has quietly stopped running is worse than
  one that was never written.
- 2026-09-21 — **The contested band is a property of the base, not of the game.**
  `--width` measures how much attacker strength separates always-win from
  always-lose, per reference base: EARLY +22%, MID +95%, LATE +59%. v1.42 sized
  the ladder's rungs at +25% against a board-wide average of ~43%, which is why
  MID and LATE now ramp and EARLY still does not. A single rung size cannot
  serve bases whose bands differ four-fold, and the narrow one is narrow because
  three guns is too small a sample for the outcome to vary — checked by doubling
  its maze, which moved nothing at any attacker strength. Whether that is a
  defect depends on an unanswered design question: if CC1 is the onboarding
  stage, a flat row there is correct and should stop being counted against the
  step-function total.
- 2026-09-21 — **The offered battle is not the battle that was offered, and that
  is the design.** A live-defence offer that hands the player the probe the
  garrison would have fought is a decision on paper only: a probe is the first
  two waves of its rung with `startingCp: 0, cpPerSecond: 0`, so the player gets
  no CP and therefore no verbs, and a built town holds it in 100% of eight-seed
  runs at every level from 1 to 24. Accepting means standing to fight, so they
  commit the whole rung with the town's own siege economy — 100/88/75/0 percent
  held across levels 4/5/6/8 with nobody acting, which is Phase 3c's contested
  band. The fiction is the mechanic rather than a coat of paint on it: a probe
  is what they send when nobody is home. Declining still fights the probe, so
  the player who cannot play right now loses nothing by saying so.
- 2026-09-21 — **A full unit suite and a green E2E harness cannot tell you the
  feature is worth using.** The first live-defence offer passed twenty-two unit
  tests and an eleven-check browser harness. Both asked whether the loop closed
  — offer, claim, battle, fold, log — and it did, exactly as specified. Neither
  could ask whether the battle was worth fighting, because that is a question
  about a DISTRIBUTION and every test in the repo runs one battle at a time. A
  twenty-minute sweep over two towns and eight seeds changed the design. Tests
  pin behaviour; only a sweep prices it.
- 2026-09-23 — **The similarity transform failed its own test, and the suspect
  named in advance was the wrong one.** M34 was picked as the overhaul that
  changes no rule: halve every length and every speed, and a 10x15 board plays
  like 20x30 drawn twice as big. The check fought the whole defence matrix both
  ways against a noise floor it measured rather than assumed, and missed by
  eight times. Crowding was the suspect written down beforehand; the mapped
  bases came out with LESS wall, not more. The cause was geometry at the post.
  On a board of half-cells three things land on knife-edges: where the post's
  centre sits, which cell an attacker stops on, and a range against the cover
  radius. Four tanks sat 0.24 cells out of reach of the gun holding the post
  shut, for 90 seconds, twice. When a rule's outcome turns on `<` versus `<=`,
  it is sitting on a quantisation boundary, and two structural fixes each broke
  a different tier. So a smaller board is a new game rather than a port, and
  building it is a design decision, not a drift to correct.
- 2026-09-23 — **A gesture checked only where it lands can be wrong all the way
  there.** Since the drawer's handle shipped in v1.27 it has run about 17% ahead
  of the finger dragging it, after jumping on the first pixel, and every handle
  drag has also scrolled the list underneath: a 120px drag moved the drawer
  208px and scrolled the list 372. Neither was visible to a harness that only
  asked where a drag LANDED, because a release snaps to a detent, and a snapped
  drawer is right however wrong the drag that got it there was. Holding the
  finger still halfway and asking where the handle was found both on the first
  run. The unit error was a share read against one height and replayed against
  another. The scroll was a press tested against the rect as it was after the
  press had moved it. Both are the same shape: state read in one frame of
  reference and acted on in another.
- 2026-09-23 — **An instrument that skips what it cannot place measures a base
  nobody drew.** The engine drops a layout piece that does not fit without a
  word, which is right for a save: a building that a migration could not place
  must not brick the battle. It is wrong for a measurement. Two rows of the
  published snapshot measured nothing. The Engineer Corps HQ was a 2x2 on the
  last row of the 20x30 board for eight releases, so the "HQ on the line" row
  matched the bare UN row to the cell. The AA cover's forward mount had stood
  on MID's inner wall since the row was added. The harness now refuses a reference layout that does not
  land, and the first thing it did was confirm the redrawn rows land. The
  showcase town took the same lesson on the same day: seed 4242's river moved
  under a depot, and the demo died on a `!` three lines after the placement
  that had quietly failed.
- 2026-09-23 — **Re-tune the lever that only the drifted thing pulls.** On
  10x15 the defence rows fell 1.13 levels sooner than v1.44's, and the raid
  tables did not drift. Chain v4 caused it — a crew stuck on a covered post now
  goes after the guns covering it, so every heavy that reaches the post kills
  what holds it shut — but the chain also decides raids, and a chain made
  kinder to defenders would have bought the defence ladder back with the
  Front Line's top rungs. The assault ladder decides town defence and nothing
  else. Twelve ladders were priced against where each v1.44 row first held
  under half: a heavy every four levels instead of two, and +7% a level
  instead of +9%, moved that level by −0.07 on average, every row within one
  of v1.44's. The raid side's own surface, the deal, was re-selected by
  measurement for the redrawn bases rather than carried over.
