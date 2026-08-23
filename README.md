# 2060TD

A hybrid **tower defense / base builder** set in a gritty modern alternate-history war:
North Korea, China, and Russia attack America and the United Nations. Pick a nation; your
town is the battlefield — the walls that protect your economy are the maze your enemies
fight through.

**Play it now:** https://rcjlabs.github.io/2060TD/

- **Defense is the action game:** real-time tower defense on top of your persistent base —
  spend Command Points placing field defenses and calling fire missions mid-wave.
- **Offense is the thinking game:** scout, compose a force, assign entry points and
  doctrines; a deterministic simulator resolves the raid into a watchable replay.
- **The war continues while you're away:** offline resource generation, build timers, and
  AI probe raids you come back to as replays.

Full design in [`docs/GDD.md`](docs/GDD.md) · milestones in [`docs/ROADMAP.md`](docs/ROADMAP.md)
· the ten locked decisions in [`docs/DECISIONS.md`](docs/DECISIONS.md).

## Current state — v1.17: gates

**The GDD promised gates in its first draft and never got them** — and the function it
promised ("let defenders through, close against attackers") describes a game where
friendly units walk. None do here. So the design was rewritten rather than implemented,
and what shipped is the version that fits: **the only thing in the game that lets you
edit the maze during a fight.**

- **Closed it is a wall. Open it is a hole.** Weighted A* re-costs the moment it swings,
  and a hole is the cheapest cell on the board — so opening a gate *pulls* the assault
  toward it. Open one to route the attack into a killzone you built; close it to strand
  whoever came through.
- **A swing costs Command Points**, so it competes with a turret and a fire mission for
  the same budget, and only once the shooting has started.
- **It will not close on somebody standing in the gateway** — which is what makes opening
  one a commitment rather than a free look.
- **Battles begin with every gate shut.** A gate is barred when nobody is on the wall.
  That keeps the whole feature in the battle layer: no save schema change, nothing for a
  share code or replay code to carry, and an unattended base honest about what it is.
- **The harness killed the price and picked a better one.** A gate was meant to pay for
  itself in HP. `npm run balance -- --gates` put 48 doors in a ring — most of the wall
  line — and moved the clear rate by one point, because attackers route rather than
  breach. Wall HP is not what decides a raid, so a gate now costs **two segments of the
  wall allowance**: ring length is a number the player feels and cannot route around.
- **The harness can now tap the map.** Every E2E check until this one addressed the UI by
  label, which is fine while every decision is a row in a drawer. A gate is a thing at a
  place, so `lastline.cell(col,row)` was added and `e2e-gates` presses the gate a player
  would press — after waiting for the CP, like a player would.

## Current state — v1.16.1: the front door, squared up

Two formatting bugs on the first two screens anyone sees, both from the v1.13
switch to top-anchored labels.

- **Every button drew its label flush against the top of its own box.** A
  top-origin label is only centred by the code that measures it, and that code
  lived in `setRect` — so any button nobody laid out again after construction
  (the whole main menu, the faction picker, settings) sat wrong. Buttons now
  place themselves on creation, and re-place on every change that alters the
  label's height: a new label, a new font size, a new wrap width.
- **The faction picker ran off both edges of a phone.** `PLA EXPEDITIONARY
  FORCE — OP. EASTERN TIDE` is a phrase, not a label; unwrapped and centred in
  a box narrower than itself, it doesn't clip politely, it spills out of both
  sides. Overlay rows can now flow by the height they actually render at, the
  same two-pass measure the drawer has used since v1.13, and the picker's
  pitch lines are measured prose instead of a reserved line count.
- **The intro and commitment screens flow their own headers**, the way the main
  menu already did: a title pinned to the top of the screen leaves a hole
  between itself and a body that centres on its own. Their scrims are opaque
  too — a first-run card had a town HUD showing through its title.
- **Guarded, and the guard was proved.** `e2e-menu` now checks every button
  label against its own box — centred vertically, inside it horizontally — on
  the menu, in settings, in the picker and on the commitment screen. Removing
  the fix makes it fail; that is the only reason to trust it.

## Current state — v1.16: the plan is still there

**The planner reset to three empty formations every time you walked in.** The GDD
has said since its first draft that "the plan is saved with the replay, so you can
iterate on a failed plan directly" — iterating means the plan is *there* when you
come back. Now it is.

- **Filed, not reconstructed.** A saved raid *is* its config, but a config is a
  list of men with arrival ticks; the decisions above it — which sector, which
  doctrine, which second, which gallery — are only recoverable by inference, and
  inference is how a restored plan quietly stops being the plan that was written.
- **All three slots come back, empties included.** Leaving a formation at home is
  a decision too. The plan is filed by slot rather than by array position, because
  the launcher drops the empty formations on the way out.
- **The shape returns; today's army fills it.** A raid spends people, so a
  reopened plan is capped by what is actually in the yard — lead formation made
  whole first — and the planner says `LAST PLAN REOPENED — 3/5 STILL IN THE YARD`
  rather than leaving you to discover it at the launch button.
- **A gallery is re-checked, not trusted.** A mouth was sited on *one* base; on
  the next target that cell may be a wall or the wrong side of the wire, so an
  invalid gallery is dropped. The ordered delay survives it — how late a
  formation goes in is a decision about the clock, not about the hole.
- **`NEW PLAN` throws it away**, back to three empty formations on the default
  stagger.
- **Filed before the battle, not after**, so a plan that ends in a wipe is still
  there to iterate on. That is the entire point of keeping it.

## Current state — v1.15: order the clock

**Squads crossed the line on a fixed conveyor** — slot 1 at T+0, slot 2 at T+6, slot 3
at T+12, shown read-only. The GDD had promised a launch delay since the first draft.
Now it's a picker.

- **Seven stops: 0 / 6 / 12 / 20 / 30 / 45 / 60 seconds.** The first three are the old
  stagger on purpose. A picker whose opening value isn't one of its own stops corrects
  itself on the first tap instead of obeying it.
- **Nothing that predates it fights a different battle.** A plan that names no delay
  falls back to the stagger it always had, so every replay in the vault re-fights the
  raid it recorded. The delay rides in the wave's own arrival ticks, which replay codes
  already carried — no format change.
- **The dig is added on top, not folded in.** A gallery squad ordered to T+0 still
  surfaces when the ground opens. The number you ordered and the number the ground
  imposes are different facts, and only one of them is yours.
- **It's a trade, and `--delay` says what kind.** Mass takes the base; patience brings
  the men home. Widening the stagger raises the share of the force that walks back and
  lowers the clear rate — and the size of that penalty is the faction. The USA trickles
  for free (clear rate flat at 92–93%, men home 24→32%); the KPA can't trickle at all
  (all-at-once 17.2/58%, wide 5.6/26%). Sending the assault formation in last is a
  blunder in all five.
- **Time is currently free in a raid, and that's recorded as a finding.** Raids run
  59–125s against a 300s stop and never time out, because a raided garrison gets no CP
  and never repairs — it can't use the minute you hand it. The fix is the standing-orders
  trickle on raided bases; filed, not bolted on, because it moves every number in
  `docs/BALANCE.md`.

## Current state — v1.14: the game is called 2060TD

The working title is retired. `LAST LINE` was provisional from the first commit; the
game ships as **2060TD**. The save key still reads `lastline_save_v1` — a key is an
address, not a label, and renaming it would strand every existing campaign.

## Current state — v1.13: the panel wraps

**Panel rows were one line each**, cut off with an ellipsis worked out from a
monospace character width. That cost real copy — and it's gone.

- **Two workarounds retired.** The raid planner drew a shape's name and its tag
  as two heading rows, and the day's condition as two more, purely because one
  row couldn't hold a phrase. Each pair is now a single row that reads as one
  statement.
- **Heights are measured, in two passes.** The first sets every label's text
  and wrap width and reads back the height it actually renders at; the second
  places the rows once each line's tallest is known. A predicted height is the
  same guess that put this project's overlay bugs on screen twice — and here it
  would be worse: a row short by a line doesn't overlap prose, it overlaps a
  tap target.
- **The content caps are editorial now**, not structural: 64 characters because
  a row the player has to read twice is badly written, not 26 because the
  drawer would clip it. `short` fields stay tight — an abbreviation that takes
  two lines isn't an abbreviation.
- **Proved on real content.** A squad row loaded with five unit kinds grows
  from 28px to 43px instead of being truncated, and `e2e-touch` sweeps every
  row on screen to check nothing spills out of its own rectangle.

## Current state — v1.12: three orders a day

**DAY ORDERS on the WAR tab** — three standing orders, posted daily off the
same fixed epoch as the field-condition rotation. No server, no stored
schedule, no way for two saves to disagree about what today asks.

- **One per category** — the front, the wire, the yard — so there's always
  something for whatever you happen to be doing. Three pools of different
  sizes (5, 4, 6) mean the exact triple doesn't come round for sixty days; one
  pool of fifteen would repeat every fifteen and pin each order to the same
  weekday forever.
- **They pay themselves.** An order settles the instant it's filled, not when
  you come back to collect. This is a game built to be left alone for a day,
  and a reward that expires because nobody tapped it punishes exactly that.
- **They never pay standing.** Standing is the one number that falls on its
  own; a daily faucet of it would quietly undo the whole board. Orders pay
  Supplies, Fuel and Intel.
- **Goals are flat; the rate is your band.** A tier-5 commander runs the same
  errand a tier-1 one does — the league multiplier is what keeps it worth
  their afternoon.
- **Only the progress is stored**, with the day it belongs to, so a stale
  sheet is replaced rather than credited against orders it never saw. What
  each order *paid* is stored too: a raid can fill an order and move your band
  in the same breath, and a screen that re-priced it would print a number
  nobody was ever paid.

## Current state — v1.11: a battle is a string

**The sim is deterministic, so a battle *is* its config.** No frame log, no
recording, nothing to desync — which means the last ten battles can be kept
and any one of them handed to somebody else as a line of text.

- **The vault** keeps the last ten hands-off battles on the WAR tab: ladder
  raids, code duels, and the offline probes fought while you were away. Each
  one is still watchable, and each one is a code.
- **Live sieges are deliberately absent.** What you place during a siege is a
  *command*, and the config never held it — a "replay" of one would be a
  battle nobody fought.
- **Entries are stored as codes, not configs.** Six times smaller, and it
  turns three problems into one: reading the vault off disk is the same
  checksummed decode as reading a paste, copying a battle out is free because
  the code is already what's stored, and a corrupt entry is refused at load
  rather than crashing a replay three taps later.
- **A code is verifiable.** Encode it, decode it, run both, compare state
  hashes — the tests do exactly that, for a raid and for a probe with standing
  orders in force.
- **Kind names ride in a dictionary**, not a fixed byte table. Share codes use
  a fixed table and carry a warning never to reorder it; this game adds units
  every release across five factions, so a code that names its own kinds is
  the format that survives that.

## Current state — v1.10: the war has a file

**A long war left no trace of itself anywhere the commander could look.** It
does now — `SERVICE RECORD`, on the WAR tab.

- **Almost none of it is new.** The ladder, the campaign, the town and the
  squad roster have been accumulating this since v0.2; it had nowhere to be
  read. `meta/record.ts` is a *reader* — pure and total, so the whole record
  is asserted in tests instead of squinted at in a screenshot.
- **Four things were genuinely missing** and are now stored: when the war
  began, raids *launched* (a raid is not one squad, and clears are not
  attempts), and how many offline probes the garrison turned back or let
  through — which the four-entry defense log forgets almost immediately.
- **The standing line is a real chart**, sampled daily. Days nobody played are
  filled by interpolation, which isn't a guess: decay is linear, and decay is
  the only thing that moves standing while the game is closed. A season
  rollover is recorded as the step it is, not smeared across the days since.
- **It measures against zero, not the run minimum.** A chart that rescaled its
  own floor would draw a war spent at 20 points exactly like a war spent at
  2,000 — and standing is a distance above nothing.
- **Not gated on the Front Line.** Missions, research, sieges held and the
  heaviest assault turned back all happen before the ladder is offered.

## Current state — v1.9: the men who came back

**The loss line in a raid report was a number.** Now it has names attached to
it, and a price.

- **Three formations, not three slots.** The raid planner's squads are standing
  units with call signs — HAMMER, RONIN and TALON for the USA, a set per
  faction — and each one carries a file: raids, posts taken, men lost, and a
  rank.
- **GREEN → LINE → VETERAN → CADRE**, worth at most +15% health and damage. A
  rank is an edge, not a substitute for bringing enough people; the balance
  harness's per-faction `VETERANCY` matrix is what keeps it that way.
- **Experience lives in the men.** That single rule is the whole feature: a
  formation's file scales by its survival fraction every raid, so a squad that
  comes back whole keeps everything it learned, one that loses half its
  strength loses half of what it knew, and a wipe puts the name on a fresh set
  of replacements. It also means the rank pays for itself in the only currency
  that matters — veterans lose fewer men, and the men are the experience.
- **The sim can finally say who came back.** `SimConfig.mods.attacker` was
  battle-wide, so a wave entry now carries its squad and that squad's
  multiplier. A resolution reports per-formation returns, which is what puts
  `HAMMER 6/8 back · LN → VET` in the battle report.
- **Slots are explicit, and that is not a detail.** The launcher drops empty
  squads from the plan, so without an explicit slot the third formation would
  come home as the second and inherit a stranger's experience.

## Current state — v1.8: something to listen to

**The game had fourteen sound effects and no music at all.** It has a score
now — synthesized, like everything else here, because there are no audio assets
in this project and the artifact is one HTML file.

- **Three moods of one idea.** The same bleak interval set — minor pentatonic
  with the flat second where the fourth should be — played sparser or tighter.
  `QUIET` has no pulse at all: a room with a radio on. `PLANNING` adds a
  heartbeat every four beats. `BATTLE` is the same music with a pulse every
  other beat.
- **No seams.** A continuous detuned drone sits under everything and *slides*
  between moods rather than stopping and starting, so moving from the town into
  a siege doesn't click.
- **The score is content, not an asset.** `content/score.ts` decides what notes
  exist and when, and it's pure — so the musical decisions are tested:
  densities that rise with the situation, one voice per beat maximum, nothing
  subsonic or shrill, and a bar that plays the same way every time it comes
  round. `game/music.ts` is only the synth, scheduled on a WebAudio lookahead
  so the bed doesn't stagger when the main thread gets busy — which, during a
  siege, is always.
- **A real mixer.** Music and effects ride separate buses and are set
  independently, in five stops on a button (the touch kit has no slider and
  doesn't need one). A pre-v1.8 `SOUND: OFF` migrates to silence, not to a
  surprise soundtrack.

## Current state — v1.7: something to look at while it loads

**The first paint is no longer a black rectangle.** A boot card lives in
`index.html` itself — inline styles, no webfont, no image, no second request —
so it is on screen before any of the 420KB engine has been fetched, and it
comes down on the first rendered frame.

- **It fails honestly.** An inline timer, which still runs when the module is
  the thing that failed to load, swaps the card to `LINK FAILED — RELOAD TO
  RETRY`. A card that spins forever tells a player nothing.
- **Code splitting was measured, and mostly declined.** Phaser is 1.48MB of the
  1.75MB bundle; the game itself is 269KB. Deferring scenes off the critical
  path buys about **3%** for real load-order risk, so it isn't in here.
  Splitting the *engine* into its own chunk buys something real: its hash
  doesn't change between releases, so a returning player re-downloads 82KB of
  app instead of 422KB of gzip.
- **The single-file build is now a build.** `npm run build:single` produces the
  artifact from the real built page rather than a hand-maintained copy of it,
  so the boot card, the styles and the viewport meta can't drift from what the
  deployed site serves — and `scripts/e2e-boot.mjs` boots that file from
  `file://` and plays it. Nothing had ever tested that build before.

## Current state — v1.6: eight kinds of problem

**Tier 8 is no longer tier 2 with more hit points.** The Front Line generator
had three wall templates; it now has eight archetypes, and a shape decides its
own wall plan, gun count, economy and structure level:

| Shape | From | What it is |
|---|---|---|
| COMPOUND | 1 | Walled rectangle, two or three gates. The standard problem. |
| OPEN CAMP | 1 | Barely wired, thinly gunned. A breather, not a payday. |
| CORRIDOR | 1 | Two offset wall lines: one way in, and it is long. |
| STAR FORT | 2 | Diamond wall, two breaches, every approach enfiladed. |
| DISPERSED DEPOT | 3 | Stores in four corner pens with their own guns. Killing the post barely dents the score. |
| STRONGPOINTS | 3 | Four small pens, one holding the post. |
| KEEP | 4 | Two rings, opposite gates, everything covering everything. |
| BUNKER COMPLEX | 5 | No wire, few positions, each dug a level deeper. |

- **The three targets at any tier are always three different shapes.** A choice
  between identical problems is not a choice.
- **The shape is free; the layout still costs Intel.** Knowing you are looking
  at a bunker complex is the decision archetypes exist to create — knowing
  where its guns are is still recon.
- **The harness overturned the obvious bunker design.** "Few walls, many guns"
  was built as *more* guns dug a level deeper and measured **0% clears at tiers
  4 and 5**, with the doctrine ceiling behind the force. The cause is
  structural: with no wall line there is no breach to wait for, so every gun
  engages from the first second. An open base is harder at the *same* gun
  count. It ships at 0.65× guns, one level deeper — the fewest positions on the
  board, the best dug, and the hardest thing on it that can still be taken.

## Current state — v1.5: first contact

**The game no longer expects you to work it out.** A coach runs over the first
battle a commander ever fights, and says the three things that are opaque and
undiscoverable:

- **The wire is a route, not a barrier.** Attackers walk around it or break
  through it, whichever costs them less. That is the whole mechanic and
  nothing on screen says it.
- **Kills pay Command Points**, and CP is *this battle's* budget — field guns,
  mines, fire missions. It does not carry home.
- **What CP buys is temporary.** The gun you place mid-wave is gone when the
  siege ends; the emplacements you build in town are what holds the place
  while you are away.

It stays out of the way. Every line serves a dwell so it is never flashed past,
and the dwell also ends any hold — ignoring the coach costs you a few seconds
and never blocks progress on an action you were not going to take. A tap serves
the rest of a line, because reading fast should not be punished.

The **raid planner** explains its four tabs once, on first arrival. One-shot
screens are remembered per war, and **REPLAY BRIEFINGS** in settings makes them
first contact again — a first battle is not a good time to be taking notes.

## Current state — v1.4: three wars

**Three save slots, so trying another faction never costs you the one you
have.** Before this there was a single save and one destructive `NEW WAR`
button, which put four fifths of the content behind it.

- **The menu is the slot list.** Each row is a war: `1 · UNITED STATES` with
  its tier and league band on the right, or `EMPTY` with `NEW WAR`. Tap a war
  to resume it, tap an empty slot to start one there.
- **Slot 1 is the original storage key**, deliberately. Anyone already playing
  finds their war exactly where they left it, with nothing to migrate.
- **Erasing is its own mode and takes two taps.** `ERASE A WAR` flips the slot
  list into erase mode; the first tap on a war arms it, the second takes it —
  and takes exactly that one.
- A slot only counts as a war once a faction and difficulty are picked, so
  abandoning the faction screen leaves the slot empty rather than filling it
  with a husk.

## Current state — v1.3: the board

**Standing you have to keep standing on.** The tier says how far up the ladder
you climbed; standing says whether you are still there. It is the only number
in the game that falls on its own.

- **Five bands, and each one is a trade.** IRREGULARS → THE LINE → VANGUARD →
  SHOCK → IRON. A band multiplies ladder loot up to ×1.30 — and raises the
  level of the offline probes that come looking for you by up to two. Standing
  is visibility, not a trophy.
- **Silence costs.** Clearing a rung pays `18 + 7 × tier`; a failed raid,
  a breach, a lost counterattack all take. After 36 hours with nothing on the
  Front Line, standing bleeds 30 a day. A repelled probe moves the number but
  buys no quiet time: sitting behind a garrison is not playing.
- **Fourteen-day seasons that place on your peak.** At rollover the season
  closes and pays for the *best* band you touched, not the one you happened to
  be sitting in — a spike that decayed away still counts — then carries a
  quarter of the standing into the next one. Seasons and conditions are both
  counted from a fixed epoch, so the schedule is a function of the clock and
  not of what a save remembers.
- **A different front every day.** Six field conditions rotate daily. HARD RAIN
  softens their wire and pays 0.85×; DUG IN, FUEL CRISIS and ATTRITION each
  cost about nine points of clear rate and pay 1.3–1.45×. Every one is priced
  against what the balance harness actually measured
  (`npm run balance -- --conditions`), so no day is a free lunch.
- **BLACKOUT carries no modifiers at all.** Its cost is that no target can be
  scouted at any price: you plan against fog, and North Korea loses tunnel
  insertion entirely, because a gallery needs a layout to dig to. It is the one
  day that changes how you play rather than what the numbers are.

## Current state — v1.2: share codes

**Your base, as a string you can paste to a friend.** No server, no
accounts — the last piece of PvP-lite from the original plan, built the way
decision #2 said it would be.

- **A base is a code.** `SHARE MY BASE` in the `WAR` tab packs the wire, the
  emplacements and the command post into a ~70–300 character string. A
  realistic mid-game base with 49 walls and 6 emplacements comes out at 127
  characters, because walls are grouped by kind and delta-packed: a straight
  line, horizontal or vertical, costs about a byte a segment.
- **`RAID A CODE` fights the snapshot.** The code *is* the intel, so there is
  nothing to scout and no target to cycle. Your losses are permanent, exactly
  as on the ladder — but the Front Line does not move, nothing counterattacks,
  and a given code pays loot only the first time you beat it. It is a duel,
  not a mine.
- **Nothing here changes when they raid you.** They fight a copy of your
  layout. That is the honest shape of a no-server game, and the share screen
  says so.
- **Codes are versioned and checksummed.** A truncated paste, a mangled
  character, or a code from another version is refused with a reason a player
  can act on, rather than loading half a base.
- **A real text box.** Phaser draws text but cannot take any, and
  `window.prompt` on a phone is a system dialog that mangles a 300-character
  string. `src/game/textbox.ts` is a small DOM overlay styled to match the
  game, with a copy button and a paste field that behaves on mobile.

## Current state — v1.1: a front door

**The game now starts at a main menu instead of dropping you into a town.**

- **Main menu** with the alternate-history framing, then the choices that
  belong there: CONTINUE THE WAR (with the faction, operation, next mission,
  Front Line tier and victory count read off your save), NEW WAR (two taps —
  it erases a campaign and there is no undo), SETTINGS, and TRAINING RANGE.
- **One settings screen, two doors.** Sound, colourblind palette and
  fullscreen live in a single overlay opened from the menu or from the
  town's `SYS` tab; in-game it also carries save export/import and a MAIN
  MENU link. Preferences follow the device, the campaign file follows the
  campaign, and neither is duplicated in two places with two labels.
- **A way home.** `SYS → MAIN MENU` writes the campaign to disk and walks
  back to the front door. It is deliberately absent from a live battle: a
  siege in progress has consequences, and the way out of one is to fight it.

`scripts/e2e-menu.mjs` walks the whole loop — boot to menu, settings from
both sides, into the war, and back out to a menu that now offers CONTINUE —
which is how the first version was caught stacking a fresh settings page on
top of the old one every time a toggle redrew it.

## Current state — v1.0: the air layer

**Walls are irrelevant to a helicopter.** The last unchecked mechanic from
the GDD landed: air units that ignore the maze entirely, and the anti-air
mounts that are the only real answer to them.

- **Flying ignores the grid.** An air unit does no pathfinding at all — no
  walls, no blockers, no breaching. It runs straight at whatever its doctrine
  wants, shoots it, and everything you spent on the maze buys you nothing.
  Mines are buried and lobbed shells land on the ground, so neither reaches
  it; a wire-guided ATGM cannot track it either.
- **The answer is a gun that can elevate.** Every faction gets a permanent
  **AA mount** (FIM-92 Stinger Site, PGZ-95 Flak, ZSU-23, ZPU-4 quad,
  Skyguard 35mm) and a CP-priced **MANPADS team** for rotors that arrive
  mid-wave. Ordinary guns can point up — the damage table just prices that
  badly. Flak is devastating against air and nearly useless against anything
  else, so a mount is a real slot decision, not a free upgrade.
- **Every mount outranges every aircraft**, deliberately. The first tuning
  pass had the Reaper standing off beyond the shorter mounts and killing them
  for free, which makes AA a decoration rather than a decision.
- **Five aircraft, one per faction:** MQ-9 Reaper (patient, precise), WZ-10
  (rocket weight of fire), Ka-52 (armoured, slow-cycling), AN-2 Colt (cheap,
  quick, made of canvas), NH90 (mid-pack, comes home). All trained at the new
  **Airfield**, which also raises your manpower cap.
- **Both sides feel it.** The assault ladder sends rotors from level 4, the
  campaign's late missions put them over your wire, and generated Front Line
  compounds carry a dedicated air-defence launcher from tier 2 — so a raid
  flown on rotors stops being free exactly where the ladder starts asking
  for a plan.

**Measured, both directions** (`docs/BALANCE.md`, 3,450+ battles): an air
raid clears a tier-1 compound — which has no mount — 100% of the time for
14–19% losses; from tier 2 the losses roughly triple and the clears fall
away. On defense, a reference line with two mounts holds level 4 at 100% and
level 5 at 80–100% for the USA, UN, China and Russia; the KPA's cheap quads
sit one step below, which is what "cheapest kit in the war" is supposed to
cost. Without a mount, the same line loses at level 4 — a maze cannot shoot.

## v0.9: mobile-first

**The presentation layer was rebuilt around the phone.** Everything before
this shipped as a fixed 1280×768 canvas scaled to fit, which on a phone meant
10px text rendered at five CSS pixels. It now sizes itself to the real
viewport, in either orientation, and PC is simply the wide case:

- **A canvas that matches the device.** The drawing buffer is viewport ×
  devicePixelRatio (capped at 2×) displayed at CSS size, so type is crisp on
  retina screens instead of upscaled. Rotating the phone, the URL bar sliding
  away, or a desktop resize re-flows the whole game in one frame.
- **Two layouts, one game.** Portrait puts a status strip on top, the
  battlefield in the middle, and a collapsible drawer of 44px rows above a
  five-tab strip; landscape hands the board the full height and moves the
  panel to a right rail. Tapping the open tab collapses the drawer and gives
  the whole screen back to the battlefield.
- **A real board camera.** Pinch to zoom, drag to pan, double-tap to reframe,
  on-screen `+`/`−` keys for the discoverable version — and the town opens
  framed on what you have actually built rather than on empty grid. Wall
  tools switch the board to paint mode so a drag lays wire instead of panning.
- **Type and targets sized for thumbs.** Layout tokens are declared in CSS
  pixels and multiplied into device pixels once, so a 44px row is 44px of
  glass on every phone. Long labels are clipped by monospace arithmetic
  rather than overflowing into their own price tags.
- **Verified on the devices, not just the desktop.** The E2E harness now taps
  buttons *by label* through a live-button seam instead of by hard-coded
  pixels, and runs the whole first-run flow across six viewports — 360×740 up
  to 1440×900 — asserting no page errors and no object outside the two-camera
  partition on any screen.

Bugs the rewrite surfaced and fixed: panel rows never fired at all (a
button's `stopPropagation` aborts Phaser's scene-level pointer events, which
the deferred tap dispatch depended on); overlays were drawn twice, once at
board zoom, because they sat outside both camera layers; an open overlay was
destroyed rather than re-flowed when the viewport changed; and — because that
same swallowed pointer-up left the drag anchored to the previous gesture —
every second swipe snapped the drawer back to the top. Drags are now tracked
from the pointer's own press identity, carry a flick, and a modal owns the
gesture so nothing scrolls or pans behind it. `scripts/e2e-touch.mjs` drives
real touch events through CDP to keep all of that honest.

## v0.8: standing orders

**Your base now fights back while you're away.** Offline probe raids used to
meet the permanent layer alone; now the garrison executes the defense
doctrine you leave behind:

- **Three presets, one button** (the `ORD` slot in the town panel):
  **HOLDFAST** guns down breaches with your kill-earned Command Points,
  **COUNTERBATTERY** spends your *stocked ordnance* on massed attackers with
  mines in between, **TRIPWIRE** seeds the approach with charges and mans the
  inner line. All role-keyed — every faction executes the same orders through
  its own kit.
- **An honest handicap:** the duty officer works a 1-second command cycle
  with a hard per-battle action budget, reinforces *around* a breach (corking
  the hole is a live commander's move), and bills supplies upkeep per action.
  Ordnance fired offline is gone from your stock, exactly like raid fire
  support.
- **Measured, not promised:** the balance snapshot now carries HOLDFAST rows
  for all five factions — it lifts North Korea's mid-game probe floor from
  20% to 100% at L4 and still collapses at L6, while EARLY bases keep dying
  to armor no orders can answer. The full three-preset comparison runs on the
  NK section.
- **Fully replayable:** orders ride the battle config like everything else,
  so every defense-log replay re-issues them tick for tick, and the log names
  the doctrine that fought.

## v0.7: the blue line

The UN Coalition arrived as the fifth and final faction from the GDD,
built on a new engine mechanic that powers both sides of its kit:

- **UN COALITION — Operation Blue Line.** Hold the Tacoma evacuation corridor
  — the port, the rail spur, and the last open miles of I-5 — through six
  missions against the PLA push, with the last convoys loading behind you.
- **Sustainment auras**, the faction signature: the Engineer Revetment (22 CP)
  and the Engineer Corps HQ repair every structure and wall in radius *while
  the fight is on* — and on raids the Field Medic Team heals the squad around
  it. Healing is deterministic, additive, and capped: it out-heals one enemy
  gun, never two. Where you park the Engineer Corps HQ is the base-planning
  decision of the faction — the harness measures its aura turning the
  mid-game L4 assault from a 60% hold into 100%.
- **Master of none, by the numbers:** every UN gun is deliberately mid-pack —
  Peacekeeper MG posts, Milan ATGM posts, the fast-cycling AMOS twin mortar,
  a Gripen gun pass, and a 105mm battery whose only virtue is that it lands
  exactly where it was asked to. Wreck repairs run 20% of cost, the cheapest
  in the war.
- **Loss aversion measured:** the balance snapshot runs the UN raid force
  against its own control (medics swapped for riflemen) — medics cut tier-1
  manpower losses by ~18 points and lift tier-3 clears by ~13, and survivors
  actually come home.

## v0.6: the war underground

North Korea arrived as the fourth faction, and the first to change how
offense itself works:

- **KOREAN PEOPLE'S ARMY — Operation Silent Tunnels.** Hold the Humboldt Bay
  enclave, a sealift harbor dug into the redwood coast, through six missions
  against the US counteroffensive — the finale turns your own doctrine against
  you, with Rangers surfacing from captured galleries inside your wire.
- **Tunnel insertion**, the faction signature: on the Front Line, any squad can
  swap its entry sector for a **gallery head you site on the scouted map**
  (click to dig). The squad surfaces inside the enemy wire as one push after an
  8-second dig — walls, gates, and the whole maze bypassed — for 40 Fuel per
  gallery. Mouths are drawn in the replay; validation keeps them off walls and
  at least 4 cells from the command post.
- **EXPENDABLE**, the base-building identity: the cheapest kit in the war —
  builds cost ~10% less and finish ~15% faster, wreck repairs run 25% of cost,
  ambush teams at 20 CP and directional mines at 12 — but rock barricades carry
  145 HP, the Tunnel Complex HQ is the softest command post in the game, and
  the permanent-layer floor sits one ladder step below everyone else's.
- **The Koksan gun pit** outranges every emplacement in the game (10.5–11
  cells, with a real 3.5-cell dead zone up close), and the power roles are
  saturation rocketry: an MRL fire lane and the wide-scatter KN-09 salvo.
- The balance harness measures the thesis: tunnels turn tier-2 raids from a
  coin flip into a walkover and quintuple tier-4 clears; tunnels plus a KN-09
  fire plan open tier 5 entirely (0% → 32% with the fixed reference force).

## v0.5: the northern front

Russia arrived as the third faction, and the first shipped as a pure content
drop on the role pipeline (no plumbing changes):

- **RUSSIAN GROUND FORCES — Operation Iron Corridor.** Hold the Nome railhead, the
  Alaskan end of the ice-road corridor, through six missions against the US
  counteroffensive — then counter-raid with conscripts, motor rifle squads, UR
  demolition teams, RPG-29s, BTR-82As, and the T-72B3.
- **OVERBUILT**, the faction signature: everything carries ~25–30% more concrete —
  walls at 190 HP, bunkers, the command post — but town builds cost ~15% more, take
  30% longer, and wreck repairs run 42% of cumulative cost instead of 30%.
- **Artillery doctrine:** a BM-21 Grad rocket line instead of a gun run, and the
  TOS-1A thermobaric salvo — five huge fuel-air blasts. The balance harness confirms
  the faction thesis: Russia's late-game raids stall without preparation, and clear
  when a thermobaric fire plan hits the guns before the armor walks in.

## v0.4: the intel war

The depth patch: signals, doctrine, and fire support.

- **Intel is the third resource.** The Signals Station (both factions) generates it;
  scouting Front Line targets now costs Intel, not Supplies.
- **Research & doctrine** (`T`): nine projects in three branches — **FORTIFY** (wall HP,
  emplacement damage, cheaper field works), **STRIKE** (raid unit HP/damage, faster
  training), **LOGISTICS** (storage, generation, cheaper recon). One project at a time;
  it finishes while you're away. Effects are carried inside each battle's config, so
  replays of old battles keep their original math.
- **Pre-planned fire support on raids.** The same A-10 / 155mm (or MLRS / PLZ-05)
  charges you stock for defense can ride with a raid: set a fire plan per power —
  T+15/40/70 seconds, on the guns or on the command post — and the hands-off resolver
  executes it. Attacker-side ordnance pounds structures and walls, never your own
  units, and every replay re-fires the plan identically.
- **Operations map** (`M`): fight the next objective or replay held sectors at 35% pay.
- **Defeat forensics:** battle reports, replays, and the defense log name what landed
  the killing blow on your Command Center.
- **Presentation pass:** vehicles face their heading, tower barrels track targets,
  muzzle flashes, textured ground, synthesized battle SFX and radio chatter (zero audio
  assets), colorblind-safe hostile palette toggle, siege ×8 speed.
- Saves migrate (v5); missions you'd already cleared re-grant the new Signals
  requisition automatically.

## v0.3: pick your war

China is playable. The first screen now asks whose war you're fighting:

- **UNITED STATES — Operation Landfall.** Hold Coos Bay through the nine-mission
  campaign, then raid PLA Front Line bases. Fewer soldiers, better hardware.
- **PLA EXPEDITIONARY FORCE — Operation Eastern Tide.** Hold the Grays Harbor
  beachhead through six missions against Guard swarms, Ranger companies, engineer
  breach teams, Javelin overwatch, and Abrams spearheads — then counter-raid US
  firebases with militia tides, sappers, ZBD-04s, and the Type 99.
- **One pipeline, two wars:** every structure kind is a shared *role* (gun nest,
  anti-armor post, mortar, strafe tasking…), so the same gating, saves, unlock keys,
  and scenes serve both sides — factions are pure data behind `content/factions.ts`.
  China's kit answers different threats: shaped-charge HJ-8 posts because their armor
  problem is the M1 Abrams, MLRS ripples instead of an A-10, PLZ-05 saturation
  instead of precision 155s.
- **Balance harness:** `npm run balance` fights ~1,400 seeded battles headlessly in
  ~12 seconds — raid clear/destruction/loss matrices per tier and permanent-layer
  hold% per stage, for both factions ([`docs/BALANCE.md`](docs/BALANCE.md)). The
  first tuning pass shipped with it (real demolition for breachers, later mortars in
  low-tier firebases, cheaper PLA manpower, tougher PLA vehicles).
- Saves migrate: pre-v0.3 towns continue as USA. Resetting the base re-offers the
  faction choice.

## v0.2: the counterattack

Offense is in. After mission 5 grants counter-raid authority, the **FRONT LINE** opens:

- **Raise an army:** Barracks and Motor Pool with real training queues (they keep
  working while you're away) — Rangers, Combat Engineers, Javelin teams, Humvees, and
  the M1 Abrams, capped by manpower from facility levels. **Losses are permanent.**
- **Pick a target:** procedurally generated Chinese Front Line bases (three per tier,
  deterministic layouts from compound/star/corridor templates). Scout with Supplies to
  lift the fog, or raid blind.
- **Plan, don't drive:** split the army into three squads, each with an entry sector
  (eight around the map) and a doctrine — **Assault** the command post, **Hunt** the
  towers, or **Raze** the economy. Doctrines are real unit-AI programs in the sim.
- **Launch:** the raid resolves instantly and deterministically; loot per structure
  destroyed, tier progress for command posts. Then **watch the replay** — the config is
  the recording, at ×1–×8.
- **The line pushes back:** every second post you clear triggers a counterattack siege
  on *your* base, and while you're away the enemy runs **probe raids** against your
  standing defenses — capped, shielded after a breach, and fully replayable from the
  defense log.

## v0.1 "LANDFALL": the campaign

The first shareable build. **Operation Landfall** is a nine-mission defense campaign
fought on your persistent base at Coos Bay, from the first militia probe (**DIG IN**)
to the combined-arms finale (**LANDFALL**):

- **Radio-log missions:** each mission opens with a terse CASCADE transmission, ends
  with an after-action report (stats, bonus objective, requisitions), and headlines one
  threat — sappers void your maze at M3, grenadiers outrange your guns at M5, NK
  infiltrators surface from tunnel mouths *inside your wire* at M6, a Russian T-72
  detachment probes at M7.
- **Requisition progression:** you start with walls, supply depots, and M2 nests.
  Victories unlock the rest — field defenses, claymores, fuel economy, autocannons,
  mortars, air power, CC expansions — always one mission before you need it.
- **Bonus objectives** pay +50% (hold CC above 90%, lose no structures, keep the maze).
- **Standard or Hard** (+30% hostiles), committed at first run with the
  alternate-history framing up front.
- **The persistent town** (M2) underneath it all: real-time economy, build timers,
  offline accrual, wrecks and repairs, save export/import — and the SKIRMISH ladder
  unlocks after M2 as the endless farming track between story missions.

The core mechanics carry through: active TD defense with CP-bought field works and
commander powers, damage-type × armor counters, and weighted pathfinding where
*everything* you build is an obstacle with HP — attackers always do the math.

## Quickstart

```bash
npm install
npm run dev        # the game (faction pick → town → missions/raids loop)
                   # ?playground=1 sandbox maze lab · ?demo=1 scripted battle
                   # ?demo=town showcase base · ?demo=raid Front Line planner
                   # add &faction=china|russia|nk|un to demos for the other wars
npm test           # sim + meta suites (pathfinding, combat, siege, town,
                   # doctrines, warfare, factions, leagues, conditions,
                   # archetypes, the coach, the score, veterancy, the record,
                   # share codes, replay codes, day orders, determinism)
npm run balance    # headless balance matrices (add -- --md to rewrite docs/BALANCE.md,
                   # -- --conditions for the field-condition rotation alone,
                   # -- --shapes for the eight base archetypes,
                   # -- --vet [faction] for the veterancy ranks,
                   # -- --delay [faction] for the launch-delay patterns, or
                   # -- --gates [faction] for what a gated ring costs)
npm run build      # typecheck + production build (engine in its own chunk)
npm run build:single # one self-contained HTML file, for the artifact
npm run screenshot # headless screenshots into screenshots/ (desktop + phone)
node scripts/e2e-flow.mjs            # first-run flow, desktop
VIEWPORT=phone-portrait FACTION=nk \
  node scripts/e2e-flow.mjs          # …on a phone, as the KPA
node scripts/e2e-touch.mjs           # touch gestures: scroll, flick, tap-vs-drag
node scripts/e2e-menu.mjs            # menu → settings → war → back to menu
node scripts/e2e-share.mjs           # code out, code in, duel fought
node scripts/e2e-league.mjs          # standing overlay + a full condition rotation
node scripts/e2e-tutorial.mjs        # the coach: taught once, and never again
node scripts/e2e-boot.mjs            # boot card under throttling + the single file
node scripts/e2e-vet.mjs             # named formations, their files, and who came back
node scripts/e2e-record.mjs          # the service record, and that it never draws over itself
node scripts/e2e-vault.mjs           # a battle filed, copied out as a string, and played back in
node scripts/e2e-orders.mjs          # the day's orders, filled by actually playing
node scripts/e2e-delay.mjs           # the launch-delay picker, and the plan following it
node scripts/e2e-plan.mjs            # a plan written, fought, and found again on the way back
node scripts/e2e-gates.mjs           # a gate built in the yard and worked in the fight
```

`scripts/e2e-flow.mjs` taps buttons by label (through `window.lastline`)
rather than by pixel, so it runs unchanged on every viewport:
`phone-portrait`, `phone-landscape`, `small-portrait`, `tablet-portrait`,
`tablet-landscape`, `desktop`.

## Controls

**Town:** left-click uses the selected tool (buildings place per click, walls drag-paint);
click a structure in select mode to inspect/upgrade/move/sell/repair; right-click or
`ESC` returns to select; `SPACE` launches the next assault; `T` research; `M` operations
map; `F` Front Line. SFX and colorblind-palette toggles live in the utility row.

**Siege:**

| Control | Action |
|---|---|
| Left-click / drag | Use selected tool (walls drag-paint; guns place per click) |
| Right-click / `ESC` | Cancel tool |
| `1`–`5` | Build item (setup/prep: wall, M2, autocannon, mortar, AA mount · combat: MG, foxhole, claymore, HESCO, MANPADS) |
| `E` | Erase / refund (setup & prep only) |
| `Q` / `W` | Arm A-10 gun run / 155mm fire mission, then click the target |
| `SPACE` | Start assault / skip prep / return to base when it's over |
| `P` / `S` / `F` | Path visualization / sim speed ×1–×8 / hold (pause) |
| `R` | Restart (standalone battles only — town battles have consequences) |

The sandbox (`?playground=1`): `1/2/3` wall/M2/erase, `W` militia, `B` sapper,
`SPACE` mixed wave.

**Mobile (the primary target):** both orientations are first-class. Portrait
gives you a status strip, the battlefield, and a drawer of touch-sized rows
over a five-tab strip; landscape hands the board the full height and puts the
panel in a right rail. Pinch to zoom, drag to pan, double-tap to reframe, or
use the on-screen `+`/`−` keys; a wall tool turns a drag into painting.
Tapping the open tab collapses the drawer for a full-screen board, and
FULLSCREEN lives in the `SYS` tab. Tap an armed tool's row again to cancel it
— the touch stand-in for right-click/`ESC`.

## Project layout

```
docs/            Game design document, roadmap, locked decisions, balance snapshot
src/sim/         Pure-TS deterministic simulation (no Phaser imports):
                 fixed-tick engine, siege phase machine, weighted multi-goal A*,
                 combat resolution, structure levels, seeded PRNG, state hashing
src/content/     Data, not code: damage table, both factions' defenses, armies,
                 campaigns, base kits, league bands, the rotating field
                 conditions, the veterancy ranks, the daily contract pools,
                 and the faction switch (factions.ts)
src/meta/        The persistent layer: town state (timers, accrual, gating,
                 wrecks), the siege bridge, warfare/raids, the league ladder
                 (standing, decay, seasons, the standing line), the service
                 record, the replay vault, share and replay codes (over one
                 shared codec), the day's orders, versioned saves
src/game/        Phaser 3 presentation: responsive layout + board camera rig,
                 shared glyphs + BattleRenderer, Town/Siege/Briefing/Raid/
                 Replay scenes, touch UI kit, overlays, palette
src/tools/       The headless balance harness (npm run balance)
tests/           Vitest suites: pathfinding, engine, siege flow, town meta,
                 assault ladder, doctrines, warfare, factions, leagues,
                 field conditions, veterancy, the service record, share
                 codes, replay codes and the vault, day orders, determinism
scripts/         Playwright harnesses that drive the real build by button
                 label: first-run flow, menu, touch gestures, raids, share
                 codes, the league board and the condition rotation, the
                 coach, the boot card, and the squad roster
```

**Architecture rule:** `src/sim` never imports Phaser. Same seed + same commands ⇒
identical outcome (hash-tested), which is what makes replays, offline raid resolution,
and the balance harness possible.

## Deploying

`.github/workflows/deploy.yml` builds, tests, and publishes `dist/` to GitHub Pages on
every push to `main` (once Pages is set to "GitHub Actions" in the repo settings).
The build is fully static and relative-pathed — any static host works:
`npm run build && rsync dist/ somewhere`.
