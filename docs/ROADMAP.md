# 2060TD — Roadmap

Milestones are scoped as focused build-sessions, not calendar time. Each milestone ends in a
committed, runnable state. Versions: v0.1 is the first shareable build (M3).

---

## M0 — Foundation ✅ *(this session)*

Prove the riskiest mechanic (weighted maze pathfinding) inside a deterministic sim, with docs
and tooling in place.

- [x] Design docs: `GDD.md`, `ROADMAP.md`, `DECISIONS.md`
- [x] Scaffold: Vite + TypeScript (strict) + Phaser 3 + Vitest + ESLint, README
- [x] Sim core: fixed-tick engine (20 tps), seeded PRNG, grid with wall HP, command queue
- [x] Weighted A*: wall traversal cost = `wallHP / unitWallDPS`; around-vs-through behavior
- [x] Runners (walker + breacher profiles), turret (deterministic targeting), HQ leak counting
- [x] Tests: PRNG, pathfinding behavior, engine behavior, determinism state-hash
- [x] Maze playground scene: paint/erase walls, place turrets, spawn runners, live path
      visualization, HUD, sim speed toggle, `?demo=1` scripted setup
- [x] Verified: `npm test`, `npm run build`, Playwright screenshot

## M1 — Siege vertical slice ✅

The active TD battle became a real game: **HOLD THE LINE**, five authored waves at the
Coos Bay perimeter.

- [x] Wave system: authored wave definitions (composition, spacing, entry rows), inbound
      wave preview in the INTEL panel during setup/prep
- [x] Command Point economy: passive + per-kill income, phase-gated costs (Supplies for
      the permanent layer, CP for field defenses/powers), repair-all pricing
- [x] 4 USA field defenses: deployable MG, rifle foxhole, claymore field, HESCO barricade
- [x] 3 USA emplacements: M2 nest, 25mm autocannon, 120mm mortar (splash, min range,
      target-leading lobbed shells)
- [x] 6 China attacker types: militia, rifle squad, sapper, grenadier (stands off and
      shells defenses), ZBD IFV, Type 99 — plus demolition of *any* blocking structure
      (gun lines are obstacles with HP, not hard walls)
- [x] Damage-type × armor-class combat table; hitscan weapons + deterministic mortar
      projectiles
- [x] Command Center entity (2×2, perimeter assault), win/lose flow, between-wave prep
      window with repair and re-mazing
- [x] Battle HUD: CP bar, phase banner, build palettes per phase, power buttons with
      cooldowns, INTEL/SITREP blocks, victory/defeat overlay
- [x] Render polish: interpolation, per-damage-type tracers, shells in flight, AoE rings,
      strafe fx, ghost previews with range rings, power target previews

Carried to M2: unspent-CP → salvage conversion on victory (needs the persistent town
economy to matter), weapon line-of-sight rules (decide vs keep lob-over-walls), hit-flash
on damaged targets.

## M2 — Town & economy ✅

The persistent base between battles: the game is now a loop, not a mission.

- [x] Carried from M1: unspent-CP → salvage Supplies on victory (2:1); impact hit
      flashes; line-of-sight **decided**: no LoS checks — mortars/grenades lob, direct
      fire is abstracted (revisit only if playtests demand it)
- [x] TownScene build mode: place/move buildings (rotate dropped — square footprints,
      no facing), wall drag-painting, 2×2 footprint rules, sell/repair, selection cards
- [x] Resources: Supplies + Fuel, per-minute generation, storage caps (CC base + bunkers)
- [x] Build/upgrade timers with Engineering Bay speed-ups; CC level gates counts and
      structure levels (emplacements included — leveled stats flow into the siege)
- [x] USA building set v1: Command Center L1–3, Supply/Fuel Depots, Storage Bunker,
      Engineering Bay (Barracks & Motor Pool deferred to M4 where army production exists)
- [x] Save/load: versioned JSON in localStorage + export/import file, reset with confirm
- [x] Offline resource accrual on load (8h cap), build timers complete while away,
      "while you were gone" report
- [x] Siege entry: assaults hit your *actual* town — buildings are big demolishable
      obstacles, walls lost in battle stay lost, setup-bought guns join the town,
      destroyed structures come back wrecked (repair 30% of cumulative cost)
- [x] Assault ladder (pre-campaign): deterministic difficulty generator — 3 waves at L1,
      grenadiers at L2, armor + Type 99 from L3, scaling counts beyond; victory loot +
      defeat penalty (raiders take 15% of stores)
- [x] Ordnance stock: power charges bought with Fuel in town, consumed per cast in battle

Carried to M3: a proper battle-report/defense-log screen (current: overlay + banner).

## M3 — v0.1 "Landfall": defense campaign ✅ → **first shareable build**

- [x] 9 USA campaign missions with authored waves and a difficulty curve (DIG IN →
      LANDFALL), fought on the player's persistent base; NK infiltrators surface from
      in-map tunnel mouths at M6, a Russian T-72 detachment probes at M7
- [x] Radio-log briefings (BriefingScene, line-by-line reveal) + after-action battle
      report (debrief text, stats, bonus objective result, salvage, requisition notes).
      A mission-select MAP screen is deferred to M6 polish — flow is linear NEXT MISSION
- [x] Tutorialization through mission design: each mission headlines one threat and
      unlocks the answer to the next (no modal tutorial)
- [x] Unlock flow: buildings, emplacements, field defenses, powers, and CC tiers gated
      by mission progress; locked buttons name the mission that grants them; SKIRMISH
      ladder unlocks after M2 as the farming track
- [x] Difficulty options: Standard / Hard (+30% hostiles), committed at first run
- [x] First-run experience: alternate-history framing + content stance, difficulty pick;
      pause (HOLD [F]) in battles; bonus objectives (+50% reward)
- [x] Deploy story: GitHub Pages workflow (`.github/workflows/deploy.yml`) — builds,
      tests, and publishes `dist/` on push to main once Pages is enabled for the repo

Carried to M4: mission-select map screen (M6), replaying cleared missions.

## M4 — v0.2: offense + the Front Line ✅

The other half of the game: the counterattack.

- [x] AI base generator: three layout templates (compound, star, corridor) + seeded
      mutation, tier-scaled towers/levels/loot, fully deterministic per (tier, variant)
- [x] Scouting flow (Supplies cost pre-M6 Intel): unscouted targets are fogged;
      scouting persists per target
- [x] Raid planner: three squads with entry sectors (8 around the map), doctrines
      (Assault / Hunt Defenses / Raze Economy — real unit-AI programs in the sim),
      fixed per-squad launch stagger. Power auto-trigger rules deferred to M6 —
      raids ship without commander powers for now
- [x] Hands-off auto-resolve through the sim; loot per destroyed structure (caches pay
      Supplies, dumps pay Fuel, the command post pays big); losses are permanent
- [x] Replay viewer: ×1–×8 + skip-to-end, no-input playback of the exact battle
      (the config IS the recording); last raid kept on the save
- [x] Front Line ladder v1: tiers advance every 3 command posts; every 2nd cleared
      post triggers a counterattack siege on YOUR base before the next raid
- [x] Offline probe raids: 3-hour cadence capped at 3, loss caps (≤10% held / 15%
      breached), 12h shield after a breach, defense log with watchable replays —
      structures are never wrecked offline, walls lost stay lost
- [x] Army management: Barracks + Motor Pool with 5-deep training queues (run while
      offline), five USA units (Ranger, Engineer, Javelin, Humvee, Abrams), manpower
      cap from facility levels

Carried to M5: raid commander powers with auto-trigger rules; mission-select map (M6);
replaying cleared missions.

## M5 — v0.3: China playable *(~2–3 sessions)* ✅

- [x] Faction content pipeline proven: China as pure data (buildings, emplacements, units,
      field defenses, powers, signature mechanic)
      — *kinds are shared ROLE ids ('m2nest' = gun-nest role, 'a10' = strafe role…), so gating,
      unlock keys, saves, and scenes needed zero plumbing changes; `content/factions.ts` is the
      only switch (defense/raid catalogs, campaign, rosters, base kits, town names, flavor).
      China's kit: Type 88 nests, shaped-charge HJ-8 posts (their war is anti-Abrams), PP-87
      mortars, MLRS ripple + PLZ-05 saturation, and the M1 assault roster made trainable.*
- [x] China campaign arc "Eastern Tide"
      — *six missions (BEACHHEAD → THE TIDE BREAKS) holding Grays Harbor against Guard swarms,
      Ranger teams, engineer breaches, Javelin overwatch, and Abrams spearheads; grants the same
      16 requisition keys as Landfall. USA wave filler `guardsman` added (not trainable).*
- [x] Faction select at new-game
      — *two-step intro: pick your war, then the difficulty commitment; every scene reads
      catalogs/labels through the faction layer; save schema v4 stores the faction (older saves
      migrate to USA). Attacker rendering is allegiance-colored now (your units olive, theirs
      crimson) with shapes by role.*
- [x] **Headless balance harness**: batch-run raids/sieges, win-rate + time-to-kill matrices,
      first real balance pass
      — *`npm run balance [-- --md]` (tsx): 1,380 seeded battles in ~12s → raid clear/destruction/
      manpower-loss by tier for both factions + permanent-layer hold% matrices; snapshot in
      docs/BALANCE.md. Pass 1 outcomes: deliberate demolition now uses the breacher stat vs
      non-CC structures; USA firebases delay mortars to tier 3; HJ-8/Type 88 hit harder; PLA
      manpower runs cheaper and vehicles tank level-2 gun lines. Deferred to M6: raid commander
      powers with auto-trigger rules, mission-select map, replaying cleared missions.*

## M6 — v0.4: depth & polish *(~2–3 sessions)* ✅

- [x] Intel as a resource + Radar Station; research tech tree
      — *Signals Station ('radar' role, both factions) generates Intel; scouting now costs
      Intel. Nine-doctrine research board (FORTIFY/STRIKE/LOGISTICS × 3 tiers, one project
      at a time, offline completion). Effects ride INSIDE SimConfig as deterministic
      multipliers, so old replays keep their original math; meta effects (storage, rates,
      training time, scout discounts) apply where the numbers live. Save v5 backfills the
      new requisition key into cleared campaigns.*
- [x] Raid commander powers with pre-planned fire missions *(deferred from M5)*
      — *the town's ordnance stock rides on raids: per-power fire plans (T+15/40/70 →
      GUNS or CC) resolve in-sim via config-carried auto-rules — replays re-fire them
      identically. Attacker-side powers strike structures and walls, never your own units,
      and cost charges, not CP.*
- [x] Mission-select map + replaying cleared missions *(deferred from M5)*
      — *OPS MAP overlay: fight the next objective or replay held sectors at 35% pay.*
- [x] Vector art pass: silhouettes, palette enforcement
      — *vehicles and fire teams face their heading, tower barrels track their last target,
      muzzle flashes, deterministic ground texture (scrub/mud/rubble), radar dish glyph.
      Atlas pipeline deferred — Graphics-drawn vectors still carry the aesthetic fine.*
- [x] Audio: radio-chatter UI feedback, battle SFX
      — *a zero-asset WebAudio synth kit: throttled gunfire ticks, explosions, breaches,
      radio blips on briefing lines, research chimes, victory/defeat stingers. Master mute
      persists per device. A sparse score remains open for a future pass.*
- [x] Replay polish, defeat forensics
      — *the sim records what landed the killing blow on the CC; battle reports, replay
      end cards, and the defense log all name it ("BREACHED (M1 ABRAMS)"). Fixed-camera
      design keeps kill-cams out; the cause line is the intended forensic.*
- [x] QoL: hotkeys, colorblind-safe accents, speed controls
      — *T research, M ops map, siege ×8 speed, colorblind palette toggle (hostile crimson
      → violet, persisted per device), SFX toggle, tighter town panel.*
- [x] Balance pass 2 with harness
      — *harness gained doctrine-ceiling variants (Strike+fire plan raids, Fortify defense).
      Found and fixed a real inversion: huge-alpha HJ-8s and an AT coverage hole made
      +12% weapon damage LOSE fights (kill-order roulette on which post survived); HJ-8s
      now trade alpha for cadence and the reference base overlaps its arcs. FORTIFY is
      strictly non-negative everywhere; snapshot in docs/BALANCE.md.*

## M7 — v0.5+: expansion *(ongoing, one drop per release)*

- [x] Russia faction + "Iron Corridor" arc (Overbuilt mechanic, thermobarics) *(v0.5)*
      — *third playable faction, pure content drop on the role pipeline: PKM bunkers,
      2A72 cannon bunkers, Podnos mortars, concrete slab walls (190 hp), Grad rocket
      line + TOS-1A thermobaric salvo. OVERBUILT: ~25–30% more HP on everything,
      paid for with builds that cost ~15% more, run 30% longer, and wrecks that cost
      42% to restore (vs 30%). Six-mission IRON CORRIDOR arc holds the Nome railhead
      against the US counteroffensive (URAL / KREPOST ACTUAL radio voice). Raid army:
      conscripts, motor rifles, UR demo teams (80 wall dps), RPG-29s, BTR-82A, T-72B3.
      Balance identity verified in the harness: Russia's late game runs through the
      fire plan — shell the guns with thermobarics, then walk the armor in.*
- [x] North Korea faction + "Silent Tunnels" arc (tunnel network bypassing mazes) *(v0.6)*
      — *fourth playable faction, and the first with an offense-side mechanic: raid
      squads can insert through TUNNELS, surfacing as one push inside the enemy wire
      after an 8s dig (40 Fuel per gallery, mouths ride SimConfig.reservedCells so
      replays re-dig them, siting validated against margins/walls/a 4-cell CC
      standoff). Kit is EXPENDABLE: cheapest everything (builds −10% cost, −15%
      time, wrecks restore at 25%), softest CC (1350), rock barricades at 145 hp —
      paid back by the Koksan gun pit outranging every emplacement in the game
      (10.5–11 reach, 3.5 dead zone) and saturation rocketry (MRL fire lane, KN-09
      salvo). Six-mission SILENT TUNNELS arc holds the Humboldt Bay enclave
      (CHOLLIMA / ENCLAVE ACTUAL voice); the finale turns the mechanic on the
      player — US Rangers surface from captured galleries inside the wire. Raid
      army: light infantry, infiltrators, tunnel sappers (70 wall dps), RPG-7s,
      Chonma-ho. Harness identity: tunnels turn tier 2 into a walkover and 5× the
      tier-4 clears; tunnels + KN-09 plan opens tier 5 (0% → 32%).*
- [x] UN Coalition faction + "Blue Line" arc (sustainment auras, engineering) *(v0.7)*
      — *fifth and final GDD faction, built on a new two-sided engine mechanic:
      sustainment auras. On defense the Engineer Revetment (22 CP field work) and
      the Engineer Corps HQ (the economy building you now place tactically) repair
      structures AND walls in radius mid-fight; on offense the Field Medic Team is
      the only unit in the war that heals other units. Healing is deterministic,
      additive, capped per target — tuned to out-heal one gun, never two. The kit
      is deliberately mid-pack everywhere (Peacekeeper MG posts, Milan ATGMs, the
      fast AMOS twin mortar, Gripen gun pass, precision 105mm battery with 0.9
      scatter); wreck repairs run 20%, cheapest in the war. Six-mission BLUE LINE
      arc holds the Tacoma evacuation corridor against the PLA (AEGIS / CORRIDOR
      ACTUAL voice) — the UN fights the China front, like the USA. Raid army:
      peacekeepers, medics, engineer breach teams, NLAWs, VAB, Leopard 1A5.
      Harness identity vs its own no-medic control: −18 points of tier-1 losses,
      +13 points of tier-3 clears; the Engineer Corps HQ aura turns the MID L4
      assault from a 60% hold into 100%.*
- [x] Air layer: air units + AA emplacements *(v1.0)*
      — *AttackerProfile.air: flying units skip pathfinding entirely (no walls, no
      blockers, no breaching) and run straight at their doctrine target. Weapon.targets
      picks the layer; the engine defaults hitscan guns to BOTH layers and keeps lobbed
      ordnance and wire-guided shaped charges on the ground, so a line with no flak is
      bad at air rather than helpless. New 'air' armor class and 'flak' damage type:
      flak is devastating against air and near-useless against everything else, which
      is what makes a mount a slot decision. Every faction gets a permanent AA mount, a
      CP-priced MANPADS team (baseline-unlocked, so rotors are never unanswerable to a
      commander who is present), an aircraft, and the Airfield that trains it. Every
      mount deliberately outranges every aircraft — the first pass let the Reaper stand
      off and kill the short mounts for free. Generated compounds carry a dedicated
      air-only launcher from tier 2 (additive, never replacing a gun, and level 1, so
      air cover is not a quiet ground-defence buff). Harness: air raids clear an
      uncovered tier-1 compound 100% for 14-19% losses and bleed 58-100% from tier 3;
      two mounts restore the L4 hold to 100% for four of five factions.*
- [x] Offline defense doctrines — STANDING ORDERS (preset CP-spending policy) *(v0.8)*
      — *SimConfig.standingOrders: a defender CP policy the engine executes during
      combat, so offline probes fight back with the Command Points their kills earn.
      Three role-keyed presets (HOLDFAST breach guns / COUNTERBATTERY stocked
      ordnance / TRIPWIRE mines) picked from the town panel and carried in the
      config, so every defense-log replay re-issues them identically. Handicapped
      to stay below live play: 1s command cadence, hard per-battle action budget,
      no corking breaches, supplies upkeep per action, real ordnance consumption.
      Harness: HOLDFAST rows for all five factions + a three-preset comparison on
      NK — lifts the NK MID floor L4 20%→100%, still collapses at L6; EARLY bases
      keep losing to armor no orders can answer.*
- [x] Mobile-first presentation rewrite *(v0.9)*
      — *the fixed 1280×768 `Scale.FIT` canvas is gone. `src/game/layout.ts` computes
      every rect and type token from the live viewport (design values in CSS px,
      multiplied into device px once); `main.ts` runs a DPR rig (buffer = viewport ×
      min(dpr, 2), `zoom = 1/dpr`) so type is crisp instead of upscaled;
      `BoardView` is a two-camera rig (world camera in the board rect + fixed HUD
      camera, partitioned by container) with pinch-zoom, drag-pan, double-tap-to-fit,
      on-screen +/− keys and a paint mode for wall tools; `ui.ts` is a touch kit
      (44px rows, tabbed drawer in portrait / right rail in landscape, pooled
      drag-scrolling rows); `overlay.ts` flows full-screen screens that survive a
      rotation. Every scene migrated. Three latent bugs fell out: panel rows never
      fired (a button's `stopPropagation` aborts Phaser's scene-level pointer
      events), overlays rendered twice because they sat outside both camera layers,
      and a viewport change destroyed an open overlay instead of re-flowing it. The
      E2E harness now taps by label through a live-button seam and runs the whole
      first-run flow across six viewports, asserting no strays outside the camera
      partition. A follow-up pass fixed touch scrolling: the same swallowed
      pointer-up left each drag anchored to the previous gesture, so every second
      swipe snapped the drawer to the top. Drags now key off the pointer's own
      press identity, anchor on `downY`, carry a flick, retire on a frame tick
      rather than on an event a row can eat, and a modal owns the gesture so
      nothing scrolls or pans behind it. Rows scrolled clear of the list also
      stop taking input. scripts/e2e-touch.mjs drives real touch events through
      CDP over all of it.*
- [x] Front end: main menu, shared settings screen, in-game route back *(v1.1)*
      — *MenuScene is the boot scene for a real session (demos still open on the screen
      they exist to show). It reads the save rather than owning it: CONTINUE resumes the
      town, NEW WAR clears the file and lets TownScene run its own faction pick, so there
      is still exactly one code path for starting a campaign. game/settingsOverlay.ts is
      one settings screen with two doors — the menu and the town's SYS tab — carrying
      save export/import and the MAIN MENU link only in-game. Deliberately not offered
      inside a live siege. scripts/e2e-menu.mjs walks the loop and caught the first
      version stacking a new settings page over the old one on every toggle.*
- [x] Share-code PvP-lite: export base as code, friends raid the snapshot *(v1.2)*
      — *meta/sharecode.ts packs a layout into a pasteable string: format byte, faction,
      command-post level, name, emplacements, then walls grouped by kind and
      delta-packed, with a two-byte FNV checksum. A 49-wall base is 127 characters, so
      it survives a chat window. Codes are versioned and validated on the way back in —
      truncation, a flipped character, an unknown kind or trailing junk are all refused
      with a reason. A decoded base becomes a tier-0 target: no scouting (the code is
      the intel), no ladder movement, no counterattack, real permanent losses, and a
      per-code ledger so a friend's base pays loot once. game/textbox.ts is a DOM text
      overlay because Phaser cannot take text input and window.prompt mangles a long
      string on a phone. scripts/e2e-share.mjs copies a code out of the game, pastes a
      damaged one (refused), then the real one, and fights the duel.*
- [x] Leagues, rotating events on the Front Line *(v1.3)*
      — *content/leagues.ts is the board: five bands, a standing ledger, a 36h decay grace
      and a 14-day season, all counted from a fixed epoch so the schedule is a function of
      the clock and not of what a save remembers. A band multiplies ladder loot AND raises
      the level of the probes that come looking — standing is visibility, not a trophy.
      Seasons place on the PEAK band reached, so a spike that decayed away still pays.
      content/conditions.ts rotates six field conditions daily; each is a trade priced
      against the measured swing in the balance harness (a new FIELD CONDITIONS matrix,
      `npm run balance -- --conditions`), and BLACKOUT deliberately carries no sim modifiers
      at all — its cost is that no target can be scouted at any price. meta/ladder.ts charges
      decay against a cursor that only advances by the time it actually billed, so settling
      on every load, redraw and scene change costs exactly what settling once would.
      scripts/e2e-league.mjs drives Playwright's clock through a whole rotation and asserts
      the blackout day from what the game says, not from a date copied into a test.*

---

## M8 — v1.4+: the depth pass *(in progress)*

M0–M7 built every mechanic the original plan named. This milestone is the
audit that followed: what the game is short of is depth, not breadth, so
there is deliberately no sixth faction here.

- [x] **Multiple save slots** *(v1.4)* — *three wars at once. Before this there
      was one save, so starting a war as another faction meant erasing the one
      you had, which put four fifths of the content behind a destructive
      button. Slot 1 IS the original storage key, so nobody loses a war to the
      upgrade. The menu is the slot list; erasing takes two taps and takes
      exactly one war. Found and fixed a real bug on the way: TownScene caches
      its town across scene.start, so switching slots would have shown the
      wrong war.*
- [x] **First-contact tutorial** *(v1.5)* — *a coach over the first battle a
      commander ever fights, saying the three things that are opaque and not
      discoverable by poking: the wire is a ROUTE, kills pay a budget, and that
      budget dies with the siege. content/tutorial.ts is the script and the
      cursor; game/coach.ts is only the plate it sits on. Two rules the cursor
      enforces — a line is never flashed past (every step serves a dwell), and
      a step never traps anyone (the dwell also ends the hold, so ignoring the
      coach costs seconds, not progress). The planner explains its four tabs
      once on first arrival. One-shot screens are recorded per war and
      REPLAY BRIEFINGS in settings makes them first contact again.*
- [x] **Deep Front Line** *(v1.6)* — *eight archetypes instead of three wall
      templates, each a different question rather than the same one louder:
      COMPOUND, OPEN CAMP, CORRIDOR, STAR FORT, DISPERSED DEPOT, STRONGPOINTS,
      KEEP, BUNKER COMPLEX. A shape sets its own wall plan, gun count, economy
      and structure level, unlocks with depth, and the three targets at any
      tier are always three DIFFERENT shapes — a choice between identical
      problems is not a choice. The shape is free intel; the layout still costs
      Intel. A new ARCHETYPES matrix in the balance harness enforces the design
      rule (spread, and no walls at a tier where a shape is offered) and
      overturned the obvious bunker design — see docs/BALANCE.md.*
- [x] **Music and a real mixer** *(v1.8)* — *the last M6 line item that never
      landed. There are no audio assets in this project and the artifact is one
      HTML file, so the score is synthesized like the SFX are — which makes it
      a CONTENT problem rather than an asset problem. content/score.ts decides
      what notes exist and when (pure, and therefore tested: densities, ranges,
      one voice a beat, a bar that plays the same way every time it comes
      round); game/music.ts is only the synth, on a WebAudio lookahead so the
      bed does not stagger when the main thread gets busy during a siege.
      Three moods of one idea — the same bleak interval set played sparser or
      tighter — and the drone slides between them rather than restarting, so a
      scene change has no seam. Music and effects ride separate buses, mixed
      separately in five stops on a button, and a pre-v1.8 SOUND: OFF migrates
      to silence rather than to a surprise soundtrack.*
- [x] **Veterancy and named squads** *(v1.9)* — *the three raid slots stop
      being scratch space and become three standing formations with call signs
      and files: HAMMER, RONIN, TALON for the USA, and a set per faction.
      GREEN → LINE → VETERAN → CADRE, worth at most +15% health and damage, so
      a rank is an edge and never a substitute for bringing enough people. One
      rule carries the whole feature: experience lives in the men, so it walks
      out with the ones who don't come back — a squad's file scales by its
      survival fraction every raid, and a wipe puts the name on a fresh set of
      replacements. The sim needed two things for it: SimConfig.mods.attacker
      was battle-wide, so WaveEntry now carries a per-squad `vet` multiplier
      and a `squad` stamp, which also means a resolution can finally say who
      came back rather than only how many. The plan carries an explicit slot,
      because the launcher drops empty squads and SQD3 must not come home as
      SQD2 and inherit a stranger's experience. A VETERANCY matrix per faction
      keeps it honest: from GREEN to CADRE the share of the force that walks
      home rises for all five, while the clear rate barely moves.*
- [x] **Service record** *(v1.10)* — *the war's own file, on the WAR tab.
      Almost none of it is new state: the ladder, the campaign, the town and
      the squad roster have been accumulating this since v0.2 and it simply
      had nowhere to be read, so meta/record.ts is a READER — pure, total, and
      asserted in tests rather than squinted at. Four counters were genuinely
      missing and had to be stored (when the war began, raids LAUNCHED as
      opposed to won, and what the garrison did while nobody was watching,
      which the four-entry defense log forgets). The standing line is a real
      chart: a daily sample, with unplayed days filled by interpolation —
      which is not a guess, because decay is linear and decay is the only
      thing that moves standing while nobody is playing. It measures against
      zero rather than the run minimum, so a war spent at 20 points does not
      draw like a war spent at 2,000. Season rollovers are recorded as the
      step they are rather than smeared across the days since. The record is
      deliberately NOT gated on the Front Line: most of what it counts happens
      before the ladder is offered.*
- [x] **Replay vault + replay codes** *(v1.11)* — *the last ten hands-off
      battles, kept watchable, each one a string you can hand to somebody
      else. The sim is deterministic, so a battle IS its config: there is no
      frame log and nothing to desync, and a code is verifiable by re-running
      it and comparing state hashes, which is exactly what the tests do.
      Entries are stored AS codes rather than configs — six times smaller, and
      it turns three problems into one: reading the vault off disk is the same
      checksummed decode as reading a paste, copying a battle out is free, and
      a corrupt entry is refused at load instead of crashing a replay three
      taps later. Kind names ride in a dictionary rather than a fixed byte
      table, because this game adds units every release across five factions
      and a fixed table cannot be reordered without silently reinterpreting
      every code already shared. Live sieges are deliberately excluded: what
      the commander places during one is a command the config never held, so
      a "replay" of it would be a battle nobody fought.*
- [x] **Daily contracts** *(v1.12)* — *three DAY ORDERS a day off the same
      fixed epoch as the condition rotation, so still no server and no way for
      two saves to disagree about what today asks. One per CATEGORY — the
      front, the wire, the yard — so the day always has something for whatever
      the commander happens to be doing, and three pools of different sizes
      (5, 4, 6) mean the exact triple does not come round for sixty days;
      one pool of fifteen would repeat every fifteen and pin each order to the
      same weekday forever. Only the PROGRESS is stored, with the day it
      belongs to, so a stale sheet is replaced rather than credited against
      orders it never saw. Two design calls worth naming: an order PAYS ITSELF
      the instant it is filled rather than waiting to be claimed — this is a
      game built to be left alone for a day, and a reward that expires because
      nobody tapped it punishes exactly that — and orders never pay STANDING,
      because standing is the one number that falls on its own and a daily
      faucet of it would quietly undo the whole board. Goals are flat and the
      payout scales with the commander's band instead, so a deep-ladder
      commander runs the same errand for wages worth their afternoon.*
- [x] **Boot screen and code splitting** *(v1.7)* — *the page painted nothing
      until 420KB of engine had been fetched, parsed and booted. A boot card
      now lives in index.html itself — inline styles, no fonts, no images, no
      second request — so it is on screen at the FIRST paint, and comes down on
      the first rendered frame. An inline timer, which still runs when the
      module is what failed, turns a card that would spin forever into one that
      says so.*
      *Code splitting was measured and mostly declined: Phaser is 1.48MB of the
      1.75MB bundle and the game itself is 269KB, so deferring scenes off the
      critical path buys about 3% for real load-order risk. Splitting the
      ENGINE into its own chunk buys something real instead — its hash does not
      change between releases, so a returning player re-downloads 82KB of app
      rather than 422KB of gzip.*
      *`npm run build:single` plus scripts/single-file.mjs now produce the
      artifact from the real built page rather than a hand-written copy of it,
      and scripts/e2e-boot.mjs throttles to 1 Mbit/s to prove the card is up
      while the engine is genuinely still arriving — then boots the single file
      from file:// and plays it. Nothing anywhere had tested that build before.*
- [x] **Make the panel wrap** *(v1.13)* — *rows and headings were one line
      each, cut off with an ellipsis worked out from a monospace character
      width. Both workarounds it forced are gone: the raid planner drew the
      shape's name and its tag as two heading rows, and the day's condition as
      two more, purely because one row could not hold a phrase — each pair is
      now one row that reads as one statement. Heights are MEASURED in two
      passes: the first sets every label's text and wrap width and reads back
      the height it renders at, the second places the rows once each line's
      tallest is known. A predicted height is the same guess that put this
      project's overlay bugs on screen twice, and here it would be worse — a
      row short by a line does not overlap prose, it overlaps a tap target.
      Buttons gained a measured API (setWrap/labelHeight/subWidth) and their
      text blocks are now top-anchored and centred by measurement rather than
      pinned by their middle. The four content caps stay as EDITORIAL bounds
      at 64 characters rather than structural ones at 26, and `short` fields
      stay tight because an abbreviation that takes two lines is not an
      abbreviation. Proved on real content: a squad row loaded with five kinds
      grows from 28px to 43px instead of being truncated, and e2e-touch sweeps
      every row on screen for spill.*

### Original-plan gaps found by the M8 audit

Three things the GDD promised that were never built. All three are now closed:

- [x] **Per-squad launch delay** *(v1.15)* — GDD 5.6 gives each squad "an entry
      point, a launch delay (0–60s), and a doctrine". The delay was derived from
      squad index and shown read-only; it is now a picker with seven stops
      (0/6/12/20/30/45/60), and the first three ARE the old fixed stagger, so the
      default plan is expressible in the picker's own vocabulary and every plan
      written before this release re-fights exactly the battle it recorded.
      *`--delay` says it is a real trade and says what kind: widening the stagger
      brings more men home and clears fewer bases, and how much that costs is
      the faction — the USA trickles for free, NK must arrive all at once or
      not at all. Holding a formation costs the attacker nothing but wall-clock,
      because a raided garrison gets no CP and never repairs; the fix is the
      v0.8 standing-orders trickle on raided bases, filed rather than bolted on.*
- [x] **Restore the last raid plan** *(v1.16)* — GDD 5.6: "the plan is saved
      with the replay, so you can iterate on a failed plan directly". The
      planner reset to three empty formations on every entry; it now opens on
      the last plan launched. The plan is FILED, not reconstructed from the
      replay: a saved raid is its config, but a config is a list of men with
      arrival ticks, and the decisions above it are only recoverable by
      inference. Two things are re-checked instead of trusted, because both
      move between raids — the men (units refill in slot order, capped by
      what is actually in the yard) and the galleries (a mouth sited on one
      base may be a wall on the next; the ordered delay survives the dropped
      hole, because the clock is a separate decision from the ground).
      NEW PLAN throws it away.
- [x] **Gates** *(v1.17)* — GDD 5.2 listed them; nothing was buildable and the
      sim had no such tile. The stated function ("let defenders through, close
      against attackers") describes a game where friendly units walk, and none
      do here — so the GDD line was rewritten rather than implemented. What
      shipped is the version that fits: a wall the commander opens and closes
      mid-siege for CP. Closed it is a wall; open it is a hole, and A* re-costs
      on the swing, so opening one pulls the assault toward it. It will not
      close on somebody standing in the gateway, battles begin with every gate
      shut, and a destroyed gate is a permanent hole.
      *The price moved because of a measurement: gates were meant to pay for
      themselves in HP, and `--gates` showed 48 doors in a ring moving the
      clear rate by one point, because attackers route rather than breach. So
      a gate costs two segments of the wall allowance instead — ring length is
      something the player feels, and it is the honest thing to charge for a
      hole in your own wall.*

Still open, and not a code gap: the game's **name** is provisional. The GDD
carries the candidates.

---

## M9 — v1.19 "The Ground": mechanical terrain on a topographic sheet

The owner's read on the board was "too simplistic and also complicated at the
same time" — two layers failing in opposite directions. Twenty-two structure
kinds shared four rectangles, so *text* carried all the identification, and the
density that resulted read as clutter rather than detail.

- [x] **The ground is mechanical** *(v1.19)* — *elevation, water, woodland and
      roads, generated from a seed and read by the sim. Water is impassable and
      feeds the existing `blocked` set; road and slope are a movement-cost term
      in the weighted A* that was already there; canopy is a damage multiplier;
      height is reach. Every effect is a flat multiplier, because there are no
      line-of-sight checks in this sim and terrain did not reopen that.*

      *Three things this had to get right, each a way to silently corrupt a
      battle fought months ago. Terrain draws from its OWN rng — the engine's
      stream is consumed in tick order and sharing it would shift every later
      roll. The engine never calls `Grid.obstacleHpAt`, it builds its own
      pathView, so ground wired only into Grid would pass its unit tests and be
      invisible in play. And A* prices a step at 1/speed, so a road cheaper than
      that breaks admissibility — and because closed nodes are never reopened,
      the failure is a silently wrong path rather than a crash.*

      *The mockup proposed +40% reach on high ground and the harness refused it:
      the clear rate fell 33 points, and switching that one term off put terrain
      within 0.4 points of flat. It ships at +15%. That is the third time this
      project has measured the same thing — a raid is decided by gun coverage,
      not by route length or wall HP.*

- [x] **Silhouettes** *(v1.19)* — *23 structure kinds and 34 attacker kinds
      redrawn as counters on the sheet: shape is the role, colour is the
      allegiance, and everything gets a paper knockout so it sits ON a busy
      topographic ground rather than competing with it. Both `CC` labels came
      off the board, because a command post with a mast on it can say what it
      is. Two defects fixed on the way: `aaSite` had no case at all and fell
      through to a default dot on every ladder base ever generated, and
      `airfield` drew at a quarter of the ground it reserves because it was
      missing from all three of presentation's separate "big kind" tables.
      Those tables are gone — the footprint is read off the structure.*

- [x] **No format bumps, no losses** *(v1.19)* — *a save gains one optional
      number and the schema stays 6. Neither codec bumped: `decodeReplay` had no
      trailing-byte check at all and `decodeBase`'s runs after the body, so an
      appended block is invisible to old codes. That matters more than it
      sounds, because the vault stores codes and silently drops what stops
      decoding — a bump would have emptied every commander's shelf. The two
      formats answer the same question opposite ways on purpose: a replay is a
      RECORD, so one without terrain re-fights the flat field it was fought on;
      a share code is a BASE, and a base has to sit on something, so an old one
      derives its ground from its own walls.*

---

## M10 — v1.20 "The Garrison": what a wall line is finally worth

Three releases running, the harness reported the same finding: **a raid is decided by gun
coverage, not by route length or wall HP.** Field conditions found it, gates found it,
terrain found it again. This milestone went looking for the cause instead of working
around it, and the cause turned out to be worse than the symptom.

- [x] **The diagnosis** *(v1.20)* — *a raid charged nothing for time. `raidConfig` set
      `cpPerSecond: 0` and `cpCap: 1`, so the defending base's economy never ran, and the
      standing-orders evaluator bailed on the attacker side, so nothing it might have
      bought could ever have been spent. A Front Line post was a diorama. Since route
      length and wall HP can only ever spend the attacker's TIME, and time was free, the
      whole fortification layer was priced at zero. Measured, it was worse than zero:
      stripping EVERY wall out of a generated base made it EASIER to hold — 86.7 clear
      with the wall line against 81.5 without, over 900 raids a row. The maze's one real
      effect was steering raiders AROUND the guns.*

- [x] **The gun trade** *(v1.20)* — *standing gun damage on a raided post is ×0.8, and
      that alone takes the wall line from −5.2 to +8.6 with the clear rate unmoved. Weaker
      guns let attackers live longer in the open, so a wall that holds a force in a
      corridor under fire finally outweighs a maze that routes them past the shooting. A
      post can have guns everywhere all the time, or fewer guns and a wall line that means
      something; this moves a fifth of the first into the second.*

- [x] **The garrison** *(v1.20)* — *the base wakes up: asleep at the line, banking CP at
      the 1.2/s every siege already runs on, spending it standing guns up on the densest
      knot of attackers it can see. `ccApproach` and `breach` both measured
      indistinguishable from no garrison at all — a last stand at the objective is too
      late, and by then the corridor has been walked for free. Deploy-only, and that is
      correctness rather than taste: the engine reads `playerSide` to decide whether an
      impact lands on units or structures, so a garrison fire mission would shell its own
      base.*

- [x] **Two fixes, separated** *(v1.20)* — *the first read of this credited the garrison
      with the wall line, because it moved the garrison and the gun trade together. An
      isolating 2×2 shows the trade did that alone and the watch is slightly negative on
      that axis. What the watch earns is the CLOCK: over 1200 raids a cell, a 60-second
      launch stagger costs 5.1 points unwatched and 8.3 watched. The test file moves one
      thing at a time for the same reason, and the earlier draft is the argument for it —
      it passed with the garrison deleted.*

- [x] **No format bumps again** *(v1.20)* — *the garrison rides the same append trick
      terrain used, and only its posture id and action ceiling travel: rules come from the
      reader's own table, so a code can never carry a doctrine that has drifted. One
      ordering hazard handled — the terrain block is written whenever a garrison is, or a
      flat battle with a watch on it would write garrison bytes where the reader looks for
      terrain and read them as a version and a seed.*

---

## M11 — v1.21 "Even Odds": faction parity, and an answer to air *(shipped)*

**What this milestone set out to do, and what it turned out to be.** It opened
on the table below and a plan to close a 57-point faction spread. Almost none
of that number survived contact. The spread was 34.6 once every faction was
measured at its own signature line rather than everyone walking up to the wire;
the "T3-T5 collapse" underneath it was three separate artifacts of how it was
being measured; and the one real content defect the milestone found — two
Front Line kits differing by 34 clear-rate points — was not in the table at all
and had never had an instrument pointed at it in eleven releases.

So this shipped as a release about the instruments. Four new harness tables
(`--deal`, `--pressure`, `--kits`, `--plans`), each of which exists because a
finding was invisible to the ones that came before it; two content fixes that
those tables justified (the ladder creep and the kit levelling); one deal
rewritten to see the faction; and two corrections to claims earlier releases
had made on evidence that could not carry them. The items below are in the
order they were found, and several of them are records of being wrong.

*The table this milestone opened on, kept because the entries under it are
arguments with it:* measured after v1.20, at roughly equal manpower (27–28 MP)
against each faction's own opposite number:

    faction   ground raid   MP lost   air raid   MP lost
    USA              86.8      66.4       86.8      50.0
    China            74.6      76.2       65.0      54.6
    UN               64.6      72.6       86.8      50.2
    Russia           52.2      81.2       58.8      55.6
    NK               29.4      90.6       52.8      69.6

Two findings, and neither is a tuning nit.

**A 57-point spread is not asymmetry, it is a difficulty setting nobody was
told about.** *(Wrong twice over, and both corrections are below: the KPA's
29.4 was measuring a reference plan with no tunnels on it, and the ordering of
this table is worth up to 15 points of plan quality rather than faction.)* §4 of the GDD says the factions are five full kits differing in
style, with elite-vs-swarm as the clearest balance axis — not that picking the
KPA signs you up for a third of the USA's clear rate and 90% casualties. This
is the ladder being broken, not the swarm being flavourful.

**Air is the dominant doctrine almost everywhere, and v1.20 widened the gap.**
Air clears as often or more often than ground for four factions of five, and
costs far fewer men in every single case — UN goes 64.6 → 86.8 while losses
fall from 72.6% to 50.2%. The garrison cannot answer it: `manpads` is stocked
in the reserve but no doctrine calls for it, because a standing-order rule has
no way to ask "is anything in the air?". That was a deliberate deferral in
v1.20 with a note saying the balance pass would decide. It has.

- [ ] **A rule can ask what it is shooting at.** `StandingOrderRule` gains a
      target-class predicate so a garrison can put MANPADS up when, and only
      when, there is something in the air to put it up against. Without this an
      AA order against a ground raid burns one of three actions for nothing,
      which is why the reserve currently has a kind nothing calls for.

- [ ] **Then re-measure air against ground.** The claim to test is that air
      buys SPEED and SURVIVAL rather than a higher clear rate — arrive before
      the reserve, lose fewer men, but no better odds against a post that
      expects you. If AA closes the clear-rate gap and leaves the casualty gap,
      that is the right shape and the work is done.

- [x] **Measure like-for-like first, because the plain rows are not**
      *(v1.21)* — *the RAID tables walk every faction's reference force up to
      the wire the same way, which flatters the factions whose plan IS that and
      buries the ones built to do something else. The KPA reads 29.4 walking
      in and 52.2 through a tunnel, a 22.8-point swing, and its own GDD entry
      says "the maze doesn't matter if you're under it" — so 29.4 was
      measuring a mistake rather than a faction. `--parity` runs each faction
      at its own signature line. The spread is 34.6 points, not the 57 the
      mismatched rows suggested:*

          faction   mean   lost%   line
          USA       86.8      81   ground
          China     74.6      88   ground
          UN        64.6      79   ground
          Russia    52.2      90   ground
          NK        52.2      85   tunnel

      *Two things fall out. The KPA is NOT uniquely broken — it ties Russia,
      which is the faction v1.20's gun trade moved UP by ten points and which
      was worse before that. And every faction clears 100% at T1 and T2: the
      entire spread lives at T3-T5, so this is a SCALING problem rather than a
      faction-identity one. Whatever closes it has to act on the deep ladder
      without touching the shallow end.*

- [x] **Measure which term causes the T3-T5 collapse** *(v1.21, `--deal`)* —
      *none of the three candidates I had listed. Three things, and the
      instrument was one of them:*

      1. ***The seed decides almost nothing.** A raid with no fire plan draws
         from the engine's stream exactly once per unit — a ±3-8% speed roll
         at spawn. Measured: 45% of the 75 (faction, tier, variant) matchups
         return a byte-identical outcome across 20 different seeds, and one
         cell held the same result for 200. The seed does reach the sim
         (different hashes at every checkpoint, 11 units on the field), so
         this is wash-out and not a plumbing fault. Twenty seeds is nineteen
         copies.*
      2. ***So clear% is not a probability.** 66 of 75 matchups land on
         exactly 0% or exactly 100% — 88% fully decided. The number is a
         count of winnable matchups wearing a percent sign, moving in steps
         of 6.7 points on a 15-cell mean. Half the "34.6-point spread" is
         five matchups flipping.*
      3. ***And therefore the DEAL is the whole game.** `archetypeFor` picks
         a rung's three targets from one hardcoded shuffle that never sees
         the faction, and `TARGETS_PER_TIER` is 3, so every player of every
         faction meets the same three shapes at a rung forever. What that
         shuffle actually deals:*

             T1   camp, compound, corridor          dealt 100  pool 100   +0
             T2   compound, star, corridor          dealt  93  pool  95   -2
             T3   compound, camp, corridor          dealt  82  pool  74   +8
             T4   compound, corridor, keep          dealt  36  pool  35   +1
             T5   compound, bunker, strongpoints    dealt  22  pool  36  -14

      *Four of the eight shapes ever appear. `compound` is dealt on all five
      rungs, `corridor` on four. **`depot` is never dealt at any tier** — a
      whole archetype, with its own wall plan and its own economy override,
      that no player will ever see. And T5 deals the two hardest shapes in
      the game together, to everyone, which is why China reads 0% there
      against a pool mean of 8% and read 100% one rung earlier against a pool
      mean of 33%. Neither number is about the China kit.*

      *`bases.ts` already states the principle this breaks — "a choice between
      identical problems is not a choice" — and then enforces only half of it.
      The deal guarantees three distinct SILHOUETTES and says nothing about
      three distinct DIFFICULTIES, so three shapes that are all impossible
      pass the check.*

- [x] **The ladder is one cliff, not a curve** *(v1.21, `--deal`)* — *the same
      pass, measuring every shape at every rung rather than the dealt three:*

          T1 100  ->  T2 95  ->  T3 74  ->  T4 35  ->  T5 36
                  -5        -21        -39        +1

      *T3→T4 adds a structure level AND a tower; T4→T5 adds nothing but the
      bunker archetype entering the pool. So **T4 comes out harder than T5**,
      and a player who grinds past the wall at T4 finds the next rung
      easier. The whole ladder's difficulty is one step. Isolating the two
      terms on the same generated bases — demote every level, or delete one
      gun — priced them at -16 and -12 of that -39, the rest being the keep
      archetype entering the pool.*

- [x] **Make the upgrade creep instead of land** *(v1.21, `upgradeShareFor`)* —
      *a base's guns used to all step to the next level on the same rung. Now
      a third of the line stands at the ceiling on the first rung of a band,
      two thirds on the second, all of it on the third — the same ceiling,
      spread over three rungs. `towerSpots` is ordered best-position-first, so
      the guns already upgraded are the ones covering the key ground, which a
      raider can read off the board.*

          before  T1 100  ->  T2 95  ->  T3 74  ->  T4 35  ->  T5 36
          after   T1 100  ->  T2 95  ->  T3 74  ->  T4 48  ->  T5 46
                          -5        -21        -26        -2

      *The cliff drops from -39 to -26 and no rung goes back up. T1-T3 do not
      move at all, which is the control working: below the first level step
      there is no level to be one back from.*

      *Two things this cost, both worth writing down rather than discovering
      later. **It overlaps `GARRISON_GUN_TRADE`** — both reduce effective
      standing gun strength on deep bases, so the trade's margin has shrunk
      from the ~12.5 clear-rate points v1.20 measured to about 2.6. The wall
      line itself is fine (+7.6, against the +6.7 that shipped); what has gone
      is the attribution, and `tests/garrison.test.ts` now asserts what is true
      on this content in place of a v1.19 snapshot it can no longer reproduce.
      **And T4→T5 is still nearly flat at -2.** Smoothing the gun count to
      `round(2.5 + tier * 0.6)` gives T5 the gun it never gets and a proper
      -16 step — and drops the wall line from +7.6 to +0.8, because more guns
      means the maze goes back to steering raiders AROUND them, which is
      exactly the v1.19 defect v1.20 was built to fix. Measured, reverted,
      recorded: **whatever fills the T4→T5 rung, it cannot be another gun.***

- [x] **Re-measure parity after the creep** *(v1.21)* — *the rung fix on its
      own, with the deal untouched, narrows the spread and lifts the two
      factions that needed it:*

          faction   before   after
          USA         86.8    86.8
          China       74.6    74.2
          UN          64.6    71.8
          NK          52.2    58.8
          Russia      52.2    54.2
          SPREAD      34.6    32.6

      *Modest, and it moves the bottom rather than the top, which is the shape
      a parity fix should have.*

- [x] **A faction-blind deal cannot grade a rung — done again with the faction
      in hand** *(v1.21, `--pressure`)* — *the ordering is per faction now,
      printed by the harness as a paste-ready literal so the numbers reach
      content without being hand-copied. Each faction's three targets sit
      close to its own pool mean (USA -0.7, Russia +2.9, NK +1.4, UN -1.7,
      China -6.9), and all eight shapes reach a player somewhere.*

      ***And parity got worse, on purpose.** 32.6 out to 40.6 — but read the
      rows, not the spread:*

          before (blind deal)        after (per faction)
          USA     86.8               USA     98.6
          China   74.2               Russia  65.6
          UN      71.8               UN      63.8
          NK      58.8               China   63.6
          Russia  54.2               NK      58.0

      *A smear across 32.6 points became one outlier and a cluster inside 7.6.
      The old deal was accidentally handing the USA hard shapes and the KPA
      easy ones, and that was masking the real state of things: measured
      against its own pool the USA reference force clears ~92% while everyone
      else sits at 39-53%. **The spread is one faction, not five.** That is a
      far better problem to have than the one the number used to describe.*

- [x] **The USA is the outlier — and the first half of why was never measured**
      *(v1.21, `--kits`)* — *it decomposes into two terms, and the first one had
      no instrument at all until now.*

      ***The two fronts were not the same fight.** There are exactly two base
      kits: the PLA post the USA and the UN raid, and the US firebase China,
      Russia and the KPA raid. Every force against BOTH, forced shapes so the
      deal could not move it, structures swapped rather than attackers:*

          force    vs PLA post   vs US firebase   gap
          USA          92.2           62.1      +30.1
          CHINA        93.0           52.7      +40.2
          RUSSIA       81.6           50.4      +31.3
          NK           48.4           18.8      +29.7
          UN           57.4           19.1      +38.3

      *34 points softer for all five. Whoever picked a faction on that side of
      the map was playing on easy and had not chosen to — and no amount of deal
      or ladder work could have reached it.*

      *It sat in two of three gun slots; the basic slot was already even at
      0.91x. Weighted by effective damage against the armour the reference
      plans field, times covered ground: area denial 2.80x, anti-armor 2.00x.
      The generator fills every second slot with area denial and every third
      with anti-armor, so three of five guns on a deep base were worth half.
      Also the GDD contradicting itself — §4.2 gives China "rapid-fire
      anti-swarm emplacements" and the QLZ fired slower than the US
      autocannon.*

      *Fixed in RATE and REACH rather than damage, because a heavier shell
      would have made them precision weapons, which is the other kit's
      identity. Swept against the table rather than derived:*

          worst kit gap   40.2  ->  10.9      (mean +34 -> -1.7)
          parity spread   40.6  ->  26.4      narrowest it has been
          USA             98.6  ->  79.6      and it has a ladder again
          China, Russia, NK unchanged — the other kit was not touched

- [x] **The UN is the floor — and the demolition hypothesis was wrong**
      *(v1.21, `--plans`)* — *it was pre-registered, which is the only reason
      it could be refuted cleanly. The UN sits at parity on HP (x1.04) and
      slightly ABOVE the others on gun damage (x0.95), short only on
      demolition: wallDps needs x1.84 and hqDps x1.59 to reach the mean of the
      other four. Moving each to that mean, one at a time:*

          wallDps x1.84 (to the mean)      -0.8
          hqDps   x1.59 (to the mean)      +0.4
          both                             -1.2
          CONTROL gun damage x1.18         +5.1
          CONTROL hp x1.18                 +5.9
          the medics swapped for rifles    -3.5

      *Nothing. And the levers ARE connected — x100 wallDps is +9.8 and x0.01
      is -3.9 — so both stats simply saturate, and the UN is already past the
      useful range of them. Closing a deficit that is real as a number and
      irrelevant as a cause would have achieved exactly nothing.*

      ***Why they saturate: attackers essentially never breach.** Instrumenting
      the battles, 1.0% of a base's walls fall to the UN and 1.5% to the USA.
      `wallDps` is very nearly a dead stat on the whole roster, and the wall
      mechanism is ROUTING rather than demolition. Worth remembering next time
      a wall question comes up.*

- [x] **The plan is worth up to 15 points, and it reorders the table**
      *(v1.21, `--plans`)* — *chasing the UN found something larger. The five
      reference plans were written by hand one at a time and are not equally
      good: every one sits 4-19 points below what its own roster can do at the
      same manpower. Applying ONE recipe to all five barely moves the spread
      (26.6 -> 27.0) and completely reorders it:*

          faction   reference   one recipe   best
          CHINA        62.1        77.1      77.1
          RUSSIA       60.4        72.1      72.1
          NK           64.6        64.6      64.6
          USA          61.3        61.7      61.7
          UN           43.8        55.0      55.0

      *Neither set is wrong; both are one person's idea of a sane force. What
      is wrong is reading either as a measurement of the FACTION — and
      `--parity` has been read that way for several releases, including by me
      an hour before writing this.*

      ***So the "USA is the outlier" reading above needs its caveat.** The KIT
      half of that finding stands untouched: `--kits` holds the force fixed and
      swaps only the fortifications, so plan quality cancels exactly within
      each row, and every row showed the same +30 to +40. What does not stand
      is the faction ranking that came with it. On best-plan the USA is FOURTH
      at 61.7, not the runaway leader. The kit fix was justified on its own
      evidence; the parity ordering was not yet measurable.*

      *The harness now reports both plans and the gap between them. Read BEST
      as the faction and the gap as the error bar that belongs on every
      cross-faction number.*

- [x] **Where the UN's clock goes** *(v1.21, `--structure`)* — *split at the
      moment the command post first takes damage, and the approach turns out
      not to be the problem at all:*

          force   arrived%   approach   alive on arrival   fight at post   total
          USA         68.2        619                3.2             716    1176
          UN          54.2        777                3.7            1245    1596

      *The UN arrives 26% later with MORE of its force intact and then takes
      **74% longer to finish the objective**. No raid on either side ever hits
      the 6000-tick cap, so this is uniformly slower fighting rather than a few
      stragglers.*

- [x] **What kills a command post, and the flag nobody chose** *(v1.21)* —
      *two channels, neither of them obvious. Ranged fire goes through
      `DAMAGE_MULT`, which discounts hard against a structure: smallArms 0.15,
      flak 0.1, kinetic 0.5, shaped 0.8, explosive 1.0. Melee (`hqDps`) ignores
      the table entirely but only fires when a unit is ADJACENT
      (`engine.ts:1324`), which in practice only the heavy manages — it lands
      60-84% of the killing blows.*

      *That makes the heavy's damage type one of the largest single numbers in
      the game, and it reads as flavour text. Swapping only that flag:*

          faction   fires       shipping   all explosive   all kinetic   swing
          USA       explosive       51.6            51.6          41.1   +10.4
          CHINA     explosive       52.6            52.6          35.9   +16.7
          RUSSIA    kinetic         50.5            62.5          50.5   +12.0
          NK        kinetic         55.7            59.4          55.7    +3.6
          UN        kinetic         29.7            37.0          29.7    +7.3

      *Three factions pay an undocumented tax of up to 16.7 points on a field
      that looks like tank trivia. **It is not the UN's answer** — the UN is
      last under every uniform setting — it is a fairness defect of its own.*

      *And one that looked obvious and was wrong: the USA Ranger does 22 hqDps
      where every other faction's basic infantry does 8-16, as much melee as
      the UN's TANK. Giving the Peacekeeper the Ranger's figure is worth -0.4,
      because the infantry mostly never reach the post to spend it. The control
      — the same +10 handed to a medic, which closes on nothing — moved 0.0.*

- [ ] **Decide the heavy's damage type deliberately.** Three factions are
      halved against the one structure every raid has to kill, and nobody
      picked that. Normalising to explosive gives Russia +12.0, the KPA +3.6
      and the UN +7.3 and would need a re-tune of the ladder underneath it;
      normalising to kinetic costs the USA 10.4 and China 16.7. A third option
      is to keep the split and *price* it — the flag is a real faction
      identity, it is simply an unpriced one. Whichever way, `--plans` says the
      faction ordering is not yet a reliable target, so settle the plans first.

- [x] **A raid is one unit** *(v1.21, `--carry`)* — *the largest finding of
      this milestone, arrived at while chasing the UN, and it reframes
      everything above it. Silencing one unit kind at a time — both damage
      channels, everything else held — measures what each actually DELIVERS
      rather than what its stat line advertises:*

          USA  baseline 51.6      UN  baseline 29.7
            abrams  -44.3           leo1        -16.1
            humvee   -4.2           nlaw         -6.3
            javelin  -1.0           vab          -5.7
            engineer -1.0           peacekeeper  -1.0
            ranger   -0.0           unmedic      -0.0
                                    unsapper     -0.0

      *Across all five:*

          faction   carry unit   its MP   raid is   dead weight
          USA       abrams            8      86%    16 of 27 MP
          CHINA     type99            7      87%    12 of 28 MP
          RUSSIA    t72               7      63%    11 of 27 MP
          NK        chonma            5      46%    18 of 27 MP
          UN        leo1              6      53%    12 of 27 MP

      ***One tank is 46-87% of a raid, and 11-18 of every 27 manpower delivers
      nothing measurable.*** *Three USA Ranger squads move the outcome by zero.
      So do the UN's medics and its breach team.*

      *The mechanism is the one `--structure` found: ending a raid means killing
      the command post, ranged fire is discounted hard against structures, and
      melee only fires when a unit is ADJACENT. The heavy is the only thing that
      reliably survives to get there and hits hard when it does.*

      *This is what the UN's floor is. Delivered per manpower the Abrams is
      worth 5.53 and the Leopard 2.69 — the same 2x that `--kits` and
      `--structure` each found from a different direction, arriving here as the
      bottom line. It also explains why `--plans` reorders the table so
      violently: an armour-forward plan is not a better idea, it is the ONLY
      idea, and the reference plans differ mainly in how much manpower they
      waste before finding it.*

---

## M12 — v1.22 "The Escort": a raid stops being one unit *(shipped)*

M11 ended by measuring that a raid was 46-87% one tank, with 11-18 of every 27
manpower delivering nothing at all — which meant the raid planner, with its
squads, sectors, doctrines, launch delays and veterancy, was decoration around
whether the heavy was brought. This milestone is that finding acted on.

It is a short one and most of it is measurement, again: four candidate levers
priced before one was chosen, and then four more priced before an item was
closed *without* a change. The single content edit is ten numbers.

- [x] **Decide whether a raid should be one unit** *(v1.22)* — *the design
      question, put to the owner with the options measured rather than
      described. Answer: ship the trade.*
      *The three directions that were on the table:*

      - **Make infantry able to hurt a command post.** The discount on ranged
        fire vs structures (smallArms 0.15) is what makes escorts inert. A
        demolition charge, a satchel, or simply a better structure multiplier
        on a dedicated breacher would give the other 60% of a force a job.
      - **Make the heavy killable enough to need escorts.** If the tank were
        not near-guaranteed to arrive, the escort would be earning something.
        The garrison (v1.20) was the first move in this direction and it is
        not yet enough.
      - **Or accept it and say so** — a raid is a tank delivery problem, and
        the planner should stop pretending otherwise.

      Whichever way: `--carry` is the instrument, and no unit stat should be
      tuned until this is settled, because a buff to something that never
      reaches the post buys nothing. That cost three separate measurements to
      learn this milestone.

      **The four obvious levers were measured first, and three of them do not
      work.** Mean clear rate and mean carry share across all five factions:

          option                          clear   carry
          shipping                         40.3     67%
          1a breachers can blow the post   40.5     67%
          1b smallArms vs structure x2.3   40.3     67%
          2a heavy HP x0.7                 34.2     62%
          2b anti-armor tower x1.6         34.5     67%

      *1b was a **disconnected lever** and would have been reported as a false
      negative without the check: **no unit in any reference plan fires
      smallArms.** The types in play are explosive, shaped, kinetic and NONE, so
      the rifle-versus-building multiplier was never going to matter. 1a moves
      nothing because breachers never survive to the post — x100 on their melee
      is worth -1.0. And both halves of direction 2 lower the carry share only
      by making the game harder, which is a difficulty change wearing a
      design's clothes.*

      *Escort melee saturates the same way every other stat in this game does:
      x10 on the non-heavy units is worth +3.1 to the USA and +0.5 to the UN,
      while x100 is worth +8.8 and +14.1. Their binding constraint is TIME ON
      TARGET, not damage rate — so no amount of damage fixes an escort that is
      not there.*

- [ ] **The one measured option that is a trade: move power out of the heavy
      and into the ranged infantry.** The AT teams (javelin, NLAW, RPG, RPG-7,
      grenadier) fire `shaped` or `explosive` — 0.8 and 1.0 against a structure
      — so unlike the riflemen they can already hurt a post from a standoff,
      and they are the second-largest contributor in every plan. Cutting the
      heavy's anti-structure output and giving it to them:

          heavy / AT-inf   clear   carry   per faction (USA CN RU NK UN)
          x1.0 / x1.0       40.3     67%   86% 87% 63% 46% 53%
          x0.8 / x1.5       40.2     51%   86% 79% 30% 19% 38%
          x0.7 / x2.0       45.6     42%   79% 62% 18% 11% 40%
          x0.6 / x2.5       47.2     35%   65% 56% 13% 11% 30%

      **x0.8 / x1.5 is the trade point** — the clear rate moves 0.1 while the
      carry share falls 16 points, which is the same bar v1.20's gun trade was
      held to. Past it the game simply gets easier.

      **But it is a partial fix and the caveat matters: the USA does not move
      at all** (86% → 86%). Its escorts are inert in a way the others' are not
      — two Javelin teams deliver -1.0 at baseline, so half again of nearly
      nothing is still nearly nothing. Whatever ships here needs a second step
      aimed at the Abrams specifically, or the USA keeps playing a different
      game from everybody else.

- [x] **Shipped the trade** *(v1.22)* — *heavy anti-structure ×0.8 on both
      channels, ranged infantry weapon damage ×1.5, applied to all five rosters
      as ten content edits. Measured against the prediction:*

          clear rate      40.3  ->  40.2      (a trade, not a spike)
          heavy share      67%  ->   50%
          parity spread   26.4  ->   27.0     (undisturbed)

      *It landed for three factions and not for two. The AT arm's share of a
      raid, per faction: **Russia 55%, the KPA 62%, the UN 36%** — from bit
      parts to genuine second carries. **The USA 8% and China 9%, unchanged.***

      ***And the reason is not what the earlier caveat guessed.** It is not that
      their infantry cannot contribute: those two raids simply succeed on the
      tank alone, so removing the escort changes nothing. Redundancy, not
      incapacity. Normalising the heavies' damage type was measured as the
      candidate fix and is not one — it costs the USA 11.7 clear points and
      leaves the Javelin at 8%, while costing China 21.8. Fixing it means making
      the heavy insufficient on its own, which is direction 2 and a separate
      decision.*

- [x] **The USA and China still win on the tank alone — and that is the design
      working, not failing** *(v1.22)* — *closed without a change, which took
      more measuring than changing it would have.*

      *Four routes were tried and none moved the USA off 86%: heavy HP ×0.7
      (-6 clear points, carry barely moves), anti-armor tower ×1.6 (-6, carry
      unchanged), normalising the heavies' damage type (-11.7 USA and -21.8
      China, Javelin still 8%), and thickening the command post ×1.4 to ×2.2
      (-3 to -10, USA at 86% at every setting). A lever that immovable is
      pointing at the wrong term.*

      *It was. Measuring each force WITHOUT its heavy:*

          faction   full   no heavy   escort force is   bodies   HP    anti-struct
          USA       49.0        8.3               17%        8   805           199
          CHINA     52.6       11.5               22%       12   935           183
          UN        29.2       17.2               59%        9   985           146
          RUSSIA    47.9       31.3               65%       10  1035           182
          NK        20.3       16.1               79%       17  1120           254

      *The USA's escorts have the second-highest anti-structure output in the
      game and the fewest bodies and the least hit points. They fail on
      SURVIVAL, not on output — escort HP ×1.3 takes the escort-only clear rate
      from 8.3 to 20.3 and ×2.0 takes it to 43.2, while doubling their damage
      only reaches 29.2. They have the guns; they do not live to fire them.*

      ***So the fix would be a buff to the strongest faction, and it would erase
      the faction.*** *GDD §4.1 gives the USA "few, expensive, excellent" and
      "low unit counts, **every loss hurts**". Eight escort bodies at 805 hit
      points dying before the objective IS that sentence, expressed in the sim.
      §4.2 gives China "**individually fragile units**", and China's escorts are
      the thinnest per body in the game at 78. Both are on-identity.*

      *The v1.22 trade landed for exactly the three factions whose rosters are
      built to sustain a second arm, and did not move the two whose stated
      design is that they cannot. That is the correct outcome and the item
      closes here. What would have been wrong is the change: it would have
      raised the top faction, narrowed nothing, and deleted a weakness the GDD
      names twice.*

- [x] **What the wall line is actually worth, and what v1.20 could not have
      known** *(v1.21)* — *v1.20 shipped on a clear-rate reading: the wall line
      worth -5.2 at full gun strength and +7.3 after `GARRISON_GUN_TRADE`. The
      seed finding above says that instrument cannot resolve a 7-point effect —
      a 15-cell near-binary mean moves in steps of 6.7 — and read per faction on
      current content it gives +1.4 for the USA, -8.8 for China and -11.2 for
      the KPA. The wall line was never resolved either way. The test asserting
      its sign was asserting noise, which is exactly why it broke on every
      content change this milestone made.*

      *Both headline assertions moved onto continuous measures, where the
      mechanism is visible and stable. A wall spends the attacker's TIME:
      ticks-to-first-loss says walls buy between +4.9% and +13.2%, same sign
      for every faction, garrison on or off. The gun trade buys the attacker
      survival, and DESTR% sees that where a clear flag cannot. Each still
      moves one thing and each fails when that thing is removed.*

      *A footnote with teeth: the first draft of the tick measure watched
      `structures.length`, which RISES when the garrison deploys a reserve, so
      it ran straight past the loss and credited reinforcements to the wall.
      It reported +8% where the truth was +0%. Tracking the structures standing
      at the start fixes it.*

- [ ] **Reverted first attempt, kept for the record.** *What a faction-blind
      band established before it was thrown away.*

      *The change: give each archetype a `pressure` (1-8, ordered to the
      measured `--deal` ranking, averaged over the rungs where the shape can
      actually be dealt), rank a rung's pool by it, cut it into three bands and
      draw one target from each. On the numbers it was reporting it looked
      right — the dealt mean tracked the pool at every rung (+0, +1, +4, +3, +1
      against the old +0, -2, +8, +1, **-14**), seven of eight shapes entered
      the rotation instead of four, and the depot finally got dealt.*

      *Then parity said no. **USA went to 100.0 at every rung and the spread
      widened from 32.6 to 42.0** — the opposite of the milestone's whole
      point. The cause is structural rather than a bad constant: `pressure` is
      one number averaged across five factions, and the shapes do not order
      the same way for each of them. `compound` at T5 measures 100 for the USA
      and 7 for China. So a "middle band" shape is a real fight for one
      faction and a walkover for another, and no single ordering can hand all
      five a graded choice.*

      *Which leaves the fix specified: **the deal has to see the faction.**
      `archetypeFor(tier, variant)` would take one, `targetFor` already holds a
      town that knows it, and nothing in the codecs breaks — share codes and
      replay codes both carry the layout cell by cell rather than
      `(tier, variant)`, and scouting keys are per-town. The cost is a
      per-faction pressure table: 40 measured numbers living in content, which
      is exactly the fragile thing the single scalar was chosen to avoid.
      Worth doing anyway — a front line that offers a KPA player and a USA
      player the same three targets is not really offering either of them a
      choice.*

      *Two things to carry into that attempt. `--deal` reports the mean over
      all five factions, so it CANNOT see this failure — read `--parity`
      before believing a deal change. And `tests/garrison.test.ts` builds its
      fixture from whatever the deal offers, so a deal change breaks a
      mechanic test that has not moved; when the deal is next touched, that
      fixture should force its archetypes instead.*

- [ ] **Russia, which v1.20 moved.** It came out ~10 points easier because it
      was the hardest faction and the gun trade helps a struggling force more
      than the watch hurts it. That was left deliberately rather than tuned
      back in the same release that caused it; it belongs in a parity pass.

- [ ] **The v0.6 watch items — now EXPLAINED, still open.** The EARLY L2→L3
      cliff on all sides (armor arrives before anti-armor requisitions), China
      MID vs L5+ (Javelin overwatch), and NK MID vs L4+ (everything kills
      sentry nests). Carried in `docs/BALANCE.md` for eleven releases as three
      separate content notes; M23 Phase 2's `--cliff` says they are one
      structural fact wearing three costumes. Every 0%/100% row sums to exactly
      100 across "the defence held" and "the attack cleared SUPPRESS", so the
      gate and the objective are the same event and the row can only be a step.
      The cliff is not that armour outpaces anti-armour at L3 — it is that
      nothing in the chain can catch an attack once the gate falls. Three
      releases of tuning the content either side of it were treating a
      symptom.

- [x] **A rule can ask what it is shooting at** *(v1.21)* — *`hostiles: 'air'
      | 'ground' | 'any'` on a standing-order rule, so the garrison holds its
      AA order until there is something to point it at. `manpads` is finally
      called for. It works and it is the right shape, but the balance pass
      says it is infrastructure rather than the fix: one MANPADS moves air's
      edge over ground by 1.4 to 7.0 points, against edges as large as +23.4.*

- [ ] **Air is a SHADOW of the ground spread, so parity comes first.** The two
      factions with a big air edge are exactly the two with the weakest ground
      game — NK +23.4 on a 29.4 ground clear, UN +19.2 on 64.6 — while USA and
      China now sit NEGATIVE (-7.0, -12.2) because their ground game is
      strong. Tuning AA harder would punish the two factions that do not have
      the problem. Fix the ground spread and re-read this table; do not tune
      air against it first. This reorders the milestone.

- [x] **A suite that can fail, and does not fail for the wrong reason**
      *(v1.21)* — *four harnesses fixed, and the class of bug behind all of
      them was the same: a tap followed by a fixed sleep followed by a read.
      Alone the sleep was long enough; run straight after a neighbour on a
      loaded box it was not, so the read came back with the value from BEFORE
      the tap and the harness reported its own timing as the game's behaviour.*

      *`e2e-raid` was the worst of them and failed the other way — it clicked
      fixed pixel COORDINATES and asserted only "no page errors", so it had
      been launching raids with zero units assigned and printing OK. Rewritten
      to tap by label and to assert each step: nothing committed at the start,
      units actually committed, LAUNCH live rather than merely present, a
      report that accounts for the force, and footage that runs. Verified by
      breaking the muster on purpose — six of eight checks fail where the old
      harness printed OK.*

      *`e2e-delay` now waits for the picker's CAPTION to move instead of
      sleeping 320ms, which is both faster and immune to load. `e2e-orders`
      waits for the raid REPORT instead of sleeping 2500ms. `e2e-terrain`'s
      last check was the interesting one: it slept four seconds and asked
      whether the word WAVE was on screen, which is not the claim in its own
      name. It now waits for the first wave to RESOLVE — a force that cannot
      cross the water never finishes wave one, so progress past it is the
      actual test — on a 120s deadline sized from measurement, after the same
      battle on the same box was watched taking 20s on one run and 50s on the
      next.*

      *The rule going forward: never sleep and then read. Wait for the state
      the check needs, on a deadline generous enough that only a real fault
      reaches it.*

---

## M13 — v1.23 "The Roll": make the seed matter *(shipped)*

M11 and M12 both ended by noticing that the instrument was the problem. This milestone
pointed the instrument at itself.

`npm run balance -- --seed` fights each matchup twelve times and asks how often they all
agree. On v1.22 the answer was **86%** — and in **54%** of matchups the identical force
walked back every time. The only thing the seed reliably changed was how long a battle
took. So `clearPct` in every table was a count of matchups tipped rather than a
probability, twelve releases of tuning had been read off a measure with 6.7-point steps,
and re-fighting a base was pointless, which quietly hollowed out the league, the day
orders and the ladder.

- [x] **An instrument that can see the seed** *(v1.23, `--seed`)* — *the baseline, and a
      corroboration of v1.22 from a new direction: the USA and China, whose raids succeed
      on the tank alone, were the most decided at 93% and 95%; the three with a real
      second arm sat at 80–83%.*

- [x] **Four shapes priced, one shipped** *(v1.23)* — *twelve candidates, each on the same
      8 seeds and 200 matchups, each built so its expected multiplier is exactly 1 — a roll
      whose mean drifts is a difficulty change wearing a variance costume and the tables
      could not tell them apart.*

          MODEL                  DECIDED   SAME HOME   CLEAR vs FLAT
          no rolls (v1.22)          88%        56%          —
          damage ±50%               77%        42%        +0.4
          miss 25%    <- shipped    64%        30%        +1.1
          miss 40%                  65%        24%        +2.1
          glance 40% at x0.3        69%        31%        +0.6
          aim slack 6               78%        37%        +2.2
          miss 25% + slack 1.5      70%        31%        +1.9

      ***A fine spread washes out*** *— ±50% on every shot barely moves the verdict,
      because many small independent rolls average to their mean inside one engagement.
      Variance has to be COARSE to survive to the outcome.*

      ***The zero matters, not just the variance*** *— the glance and the miss above have
      almost the same variance (0.327 against 0.333) and land five points apart, because a
      shot that does nothing lets a unit at 1hp live and a shot that half-lands does not.*

      ***Aiming loosely is a difficulty change, not a variance one*** *— +2.2 clear for a
      thin fall in DECIDED, and stacked on the winner it UNDID six points of it. Spreading
      fire across a force averages the damage instead of concentrating it, so nobody
      crosses a threshold early. Measured, lost, and the mechanism deleted with it.*

      *25% is an optimum rather than a floor: 30% and 40% both buy less resolution for more
      drift, because past a point a battle stops being uncertain and starts being long.*

- [x] **Shipped behind a frozen version** *(v1.23)* — *`combatVersion` on `SimConfig`, its
      own RNG stream, and version 0 meaning exactly the sim that never rolled. Replay codes
      carry the block on the v1.19 pattern with no FORMAT bump, so no vault is emptied and
      a battle recorded flat stays flat. The replay tests found the gap before the codec
      closed it — four failures the moment raids started rolling, every one of them a
      replay re-fighting a battle that never happened.*

- [x] **A duel is a puzzle, so it is pinned** *(v1.23)* — *a challenge pins its rolls to
      the pasted code's fingerprint. `town.duels` records the challenges you have SOLVED,
      and the existing rule already strips the weather and the bonus so the plan is what
      differs between attempts; rolls that varied per attempt would put the luck straight
      back in and "beaten" would stop meaning solved. The ladder, seeded from the clock,
      varies.*

- [x] **Re-read, deliberately not re-tuned** *(v1.23)* — *every spread narrowed without a
      single content change:*

          parity spread     27.0 -> 25.6
          two-kit gap       13.5 -> 12.0
          best-plan spread  20.4 -> 18.3
          mean clear        58.3 -> 59.7

      *The mean rising ~1 point is the threshold asymmetry the pricing predicted: a raid
      needs its heavy to reach the post, so noise in the fire trying to stop it helps the
      attacker slightly more often than it hurts. The ladder's IMPOSSIBLE rungs mostly
      stopped being impossible — four exact zeros in the parity table became one.*

      ***Nothing was tuned in the same release that changed the measure.*** *Doing both at
      once is how a milestone ends up unable to say which half did the work, and this
      project has recorded that mistake before.*

- [ ] **The parity pass, now that there is something to measure with.** The spread is 25.6
      points and China's T4 is still an exact zero. Every open balance item below this line
      was written against a measure with 6.7-point steps and should be re-read before any
      of it is acted on — including the T3–T5 items, the air table, and the eleven-release
      L2→L3 cliff.

- [ ] **Decide whether the +1 belongs to the attacker.** The mean rose because variance is
      asymmetric around a threshold. That is a real finding about the shape of a raid, not
      an artifact, and it is either a small difficulty gift to be taken back or evidence
      that the post should be harder to reach than to kill. It has not been decided.

---

---

## M14 — v1.24 "The Objective": a raid declares what it came for *(shipped)*

M11 measured that a raid was 46-87% one tank. M12 moved that for three factions and
could not move it for two. M13 gave the instrument resolution. This milestone is the
design change all three kept pointing at: a raid had exactly one ending that counted,
and everything the player keeps read that one boolean.

The material economy already knew better — a failed raid razes a third of the post and
comes home with about half a win's loot, and the command post is only 40% of the
lootable value on the board. Partial success existed; only PROGRESS did not.

- [x] **An instrument, and the measurement that had a veto** *(v1.24, `--objective`)* —
      *named objectives only help if a force built for one is genuinely bad at another.
      Three forces per faction at the same 27 manpower, each under all three doctrines,
      scored against all three candidate objectives:*

          NK                 TAKE POST   SPIKE GUNS   RAID STORES
          FOOT / HUNT             72.2         84.7           0.0
          FOOT / RAZE              5.6          0.0          86.1
          MIXED / RAZE            36.1         16.7          83.3
          ARMOUR / ASSAULT        36.1         13.9          16.7

      ***DISTINCT WINNERS 15 of 15.*** *A specialist lands 83-86% on its own objective
      and 0-25% on the others; a generalist is mediocre at all three. The mechanism was
      already in the damage model rather than invented for this: melee ignores
      `DAMAGE_MULT` so infantry can kill a command post, while ranged fire is discounted
      hard against structures so the same infantry cannot kill a tower. China's
      barracks-only force takes posts 13.9% of the time while destroying exactly zero
      emplacements.*

- [x] **A raid stops when it has what it came for** *(v1.24)* — *the quota is a share of
      what the base is HOLDING, fixed at tick zero. 0.65 was swept rather than chosen:
      at 0.5 the lesser objectives are nearly free for the right force.*

          when the guns objective is met, over 96 raids
          ticks   post 1692   guns  653
          home    post 1.54   guns 3.00

      *Pulling out on the quota nearly doubles the men who walk back. That is the whole
      trade — you keep the army you spent.*

- [x] **Only the post moves the Front Line** *(v1.24)* — *so the ladder is protected by
      construction. Spiking the guns pays 40% of a clear in standing; raiding the stores
      pays a 1.5x loot premium and nothing on the board either way. Priced on standing
      per MAN LOST, because men are the limiting resource:*

          faction   POST    GUNS   ratio
          USA      22.56    9.64   2.34x
          CHINA    19.46   10.13   1.92x
          RUSSIA    9.69    5.33   1.82x
          NK        6.02    4.03   1.49x
          UN        6.12    4.08   1.50x

      *Taking the post is the efficient climb in all five. The FIRST run of that said
      the KPA was inverted, because it assumed armour/assault was the post force — the
      objective table had already said the KPA takes posts best with a HUNT force.*

- [ ] **ASSAULT is still weakly dominated for three factions, and the obvious fix is
      not it.** With objectives, ASSAULT finally has a REASON to exist — there is now an
      ending that only cares about the post — and it is the best post-taker for the USA
      and China. For Russia, the KPA and the UN it is not: their best post forces are
      ARMOUR/RAZE and MIXED/HUNT.

      *The fix that looked obvious was priced and REJECTED. GDD §2.2 has always called
      this doctrine "Beeline HQ" and it never beelined — it halts for whatever comes
      into reach, exactly as HUNT and RAZE do, only without preferring anything. Making
      it fire on the move gave enormous gains to armour-only forces:*

          ARMOUR/ASSAULT taking a post   before   after
          RUSSIA                           59.7    88.9
          NK                               36.1    80.6
          UN                               54.2    77.8

      ***And it was still the wrong change.*** *On the plans players actually send it
      made three factions worse, the parity spread went 25.6 -> 30.8, and it deleted a
      mechanic specified and tested since M2 — "a ranged attacker stops to destroy a
      defensive structure, then moves on". Two of the three test failures were that one
      mechanic. The lesson is the one the armour-only row keeps teaching: a force nobody
      sends is not evidence about the game.*

      *What is left untested is the other option: REMOVE the doctrine and let TAKE THE
      POST be the objective rather than a posture. That is a content and codec change
      and it belongs in its own pass.*

- [ ] **The parity spread, still.** 25.6 points and China's T4 is still an exact zero.
      Nothing in this milestone was tuned for it, deliberately — two releases running now
      that the measure changed, which is a pattern to be suspicious of. The next
      milestone should be the parity pass, with the reference plans re-derived: `--plans`
      says a plan is worth up to 13.7 points and the plans predate both the roll and the
      objective.

---

**The bar, same as the last three milestones:** parity means the SPREAD closes
without the mean moving much, and it has to be a trade — a faction that reads
as a swarm should still lose more men to win the same fight. Flattening all
five into the same numbers would pass the test and fail the design.

---

## M15 — v1.25 "The Yardstick": measure against a plan somebody would actually play

### What shipped

- [x] **Auras take the best rate in range, not the sum.** Searching the plan space
      found an exploit before it found a stale plan. Healing summed over every source,
      so a ball of N medics healed itself at N×(N−1)×rate: at the same 26 manpower,
      thirteen UN medics cleared posts 79.2% of the time with 78% walking home while
      thirteen PEACEKEEPERS — three times the melee each — cleared 4.2%. Nineteen-fold,
      from replacing the entire fighting force with the unit that barely fights.
      Best-source keeps what the medic is for (one medic still heals at full rate;
      2 medics 16.7% → 15.3%) and kills only the stacking (13 medics 79.2% → 9.7%).

- [x] **`--derive` is honest about the winner's curse.** Finalists were validated on
      seeds that overlapped the ones that selected them. Selection now draws 0–99 and
      validation 1000+, with the gap reported as its own CURSE column — the KPA's
      apparent +30.0 was really +25.8. Sampling is also stratified by headcount, because
      a manpower band admits combinatorially more cheap-unit compositions than expensive
      ones and a uniform sample was nearly all large forces. That is the wrong end:
      clear rate FALLS with headcount for every faction holding a real heavy (China 100%
      at 3–5 bodies against 25.6% at 18+). The USA's gain went +8.3 → +21.7 once
      three-Abrams forces were in the sample at all.

- [x] **The reference plans are derived, not written.** The hand-authored plans lost by
      20.0 to 36.7 points on held-out battles — more than the parity spread the tables
      built on them were being read for. Two things they had backwards: concentration
      beats spread (a raid is a race to the post, not an attrition contest), and one
      doctrine beats three (splitting assault/hunt/raze arrives under strength).

- [x] **Parity, read on plans that are current.** The spread closed from 25.6 to 17.2
      and the ordering changed: **the UN was never the floor.** It sat last at 53.4
      because its plan was the worst of the five — its derived winner gained the most of
      any faction, +36.7 — and it is third at 83.4 played properly. M11's "UN is the
      floor" reading, and what it drove, was an artifact. The KPA is the real floor.

### The ladder does not climb, and it is not a knob

`--deal` on current plans reads **T1 99 → T2 99 → T3 94 → T4 62 → T5 53**: two free
rungs and then a 32-point wall. Twelve configurations of the tower schedule were
measured against it and **none of them improves the curve**:

| change | T1→T2 | T2→T3 | T3→T4 | T4→T5 | wall line | parity |
| --- | --- | --- | --- | --- | --- | --- |
| v1.24 baseline | -0 | -5 | -32 | -9 | +6.0 | 25.6 |
| derived plans (shipped) | -0 | -5 | -32 | -9 | +6.0 | **17.2** |
| smoothed tower count | -0 | -6 | -20 | -37 | **-0.6** | — |
| level ceiling 1,1,2,2,2 | -0 | -29 | -8 | -9 | +5.8 | — |
| level ceiling 1,1,2,2,3 | -0 | -29 | -8 | -31 | +6.2 | — |
| level ceiling 1,2,2,3,3 | -7 | -22 | -41 | +2 | +7.2 | — |
| linear gun level 1.0→1.8 | -0 | -4 | -40 | -5 | +6.2 | — |
| linear gun level 1.0→2.0 | -0 | -8 | -43 | -5 | +6.6 | — |
| linear gun level 1.0→2.4 | -0 | -9 | -50 | +0 | +7.0 | — |
| linear gun level 1.0→2.8 | -0 | -15 | -48 | -2 | +7.4 | — |
| anti-armour from T1 | -2 | -2 | -32 | -9 | **+7.4** | **14.8** |
| … + area denial moved to T3 | **+1** | -6 | -32 | -9 | +7.4 | 14.0 |
| linear 1.0→2.0 + anti-armour T1 | -2 | -6 | -43 | -5 | +8.0 | 17.6 |

Four things this establishes, none of them a knob:

1. **A level step is worth about −30 clear points wherever it lands.** Moving the
   ceiling relocates the cliff, it does not remove it. Three levels across five rungs
   is too coarse to be a curve.
2. **The two halves of the level progression are phase-locked and it is a landmine.**
   `upgradeShareFor` cycles on `(tier − 1) % 3` against a ceiling that steps every 3.
   Move the ceiling alone and the AVERAGE gun level goes non-monotonic — a ceiling of
   1,1,2,2,2 gives averages 1.00, 1.00, 2.00, 1.33, 1.67, and T3 outguns T4. Anyone
   touching one must touch both, or express them as one average and derive the pair.
3. **Guns cannot be the lever; levels can.** Every level row holds the v1.20 wall line
   (+5.8 to +7.4). The gun-count smoothing that `bases.ts` itself proposes takes it
   from +6.0 to **−0.6** and erases what v1.20 shipped for. A base can be built UP
   without the maze ceasing to matter; it cannot be built WIDER.
4. **A finer progression quantises to nothing on a small post.**
   `floor(towerCount × share)` with four guns and a 0.20 share upgrades zero of them,
   which is why no linear ramp moved T1→T2 at all.

**Why the shallow rungs are free — the one mechanical answer found.** `towerKind`
gated the anti-armour tower behind `tier >= 3`, so a T1/T2 post fields only
`towers[0]`, which is smallArms, and smallArms against heavy armour is ×0.2. Three
HMG towers do about 20 dps to an Abrams; an ATGM tower does 52.9, eight times as much.
A tank did not fight through the first two rungs, it drove through them — **at any
force size**. Scaling the raid down to what a T1 town can field (`manpowerCap` starts
at 6) does not help: at 11 MP one Abrams and one Javelin still clear T1 and T2 at 100%,
while Russia's 12 MP of APCs — no heavy armour — reads 89/50/24/7/4. The rungs are free
for ARMOUR specifically, which is also why every plan `--derive` finds is built on it.

Ungating it pays real dividends — parity 17.2 → 14.8, wall line +6.0 → +7.4 — and was
still **not shipped**, because `tests/archetypes.test.ts` correctly refuses it: anti-
armour at T3 was the *only* thing tier 3 added over tier 2 for a four-gun compound, so
moving it makes T3 an empty rung. Every attempt to give T3 something back was worse:
moving area denial up makes T1→T2 climb (+1), and the linear progression makes T3→T4
worse (−43). **The rung schedule needs a kind to add at every step, and there are not
enough kinds.** That is a content change, not a tuning change.

- [x] **The T3→T4 cliff was two shapes and a half-integer.** Decomposing the −32: every
      shape loses 4–18 points at T4 except **star (87 → 12)** and **strongpoints
      (96 → 43)** — and those are the only two shapes carrying a 1.10 tower multiplier.
      `round(4 × 1.1)` is 4 and `round(5 × 1.1)` is 6, so a 10% bonus became 0% at T3
      and +20% at T4, and those two shapes gained TWO guns on a rung where everything
      else gained one. Holding every shape to one gun per rung (`towerCountFor`, with
      the deferred gun handed back at T5 rather than dropped) fixes it at the source:

          rung           T1→T2   T2→T3   T3→T4   T4→T5
          before            -0      -5     -32      -9
          after             -0      -5     -20     -20

      star T4 12 → 53, strongpoints T4 43 → 80, parity spread 17.2 → **15.0**, and the
      v1.20 wall line unmoved at +6.0. Two even steps where there was a wall and a
      shrug. This supersedes the "L2→L3 cliff carried since v0.6" item.

- [ ] **The shallow rungs are still free** — T1→T2 −0 and T2→T3 −5 are untouched by any
      of the above, and the cause is known and documented (anti-armour gated to tier 3;
      a tank is immune below it). Fixing it needs a rung schedule with a kind to add at
      every step, which is content, not tuning.

- [ ] **Layout variance is half the difficulty and the deal cannot see it.** Shape
      explains only 38–64% of the variance in clear rate; within one shape and one tier,
      the three dealt layouts range from 0% to 100% (USA `compound` at T4:
      `100 100 100 100 100 100 100 0`). `DEAL_ORDER` bands the three targets by SHAPE,
      which is the variable that explains less of it. Scouting is the existing answer to
      "which of these three is the hard one", so this is not wrong so much as
      unmeasured — but a rung whose three targets are 0/50/100 by accident is not the
      graded choice the deal claims to offer.

### Air is a tax, and the search will not pay it

`--derive-air` runs the same search over the whole roster with one constraint — the
force must contain something flown. Given that free hand, **four of five factions put
in exactly one aircraft**, the minimum the constraint allows, and spend the rest on
ground. Compared like with like, both held-out on the same generator:

| | best ground plan | best plan containing air | what flying costs |
| --- | --- | --- | --- |
| USA | 83.3 | 73.3 (`2xabrams 2xranger 1xreaper`) | **−10.0** |
| CHINA | 85.8 | 93.3 (`3xtype99 1xwz10`) | **+7.5** |
| RUSSIA | 89.2 | 82.5 (`5xbtr 1xka52 1xrpg`) | −6.7 |
| KPA | 67.5 | 65.0 (`1xan2 16xnkrifle 3xtunneler`) | −2.5 |
| UN | 83.3 | 72.5 (`3xnh90 3xvab`) | **−10.8** |

The v1.0 air thesis — two squads of rotors and a ground tail — is dominated everywhere
it was measured: the shipped air plans lose to the search by up to +16.7, and the plans
that beat them are ground plans with one aircraft bolted on. Only China's WZ-10 pays
for itself, and the per-manpower table says why: it carries 35.0 HP, 4.3 hqDps and 4.5
weapon dps per point of manpower against the Reaper's 25.0 / 3.0 / 3.7. Every air unit
also has `wallDps` 0, so none of them can open a line.

- [ ] **Price the air roster against the WZ-10, or accept air as a specialist.** The
      Reaper and the NH90 are the two worst buys in the game per manpower and belong to
      the two factions air costs the most (−10.0 and −10.8). Either they come up to the
      WZ-10's line, or the air thesis is rewritten as "one aircraft supports a ground
      force" — which is what the search actually plays. This wants its own measured
      pass with a thesis, not a stat nudge.

- [ ] **ASSAULT is still weakly dominated** for Russia, the KPA and the UN — carried
      from M14. Removing the doctrine remains the untested option.

---

## M16 — v1.26 "Thumb": it stops being a page

The read that started this was "it feels like it was ported to mobile", and the
first job was to find out what that meant. The layout has been mobile-first
since v0.9 — portrait drawer, landscape rail, 44px rows — so the answer was
never the layout. It was the INTERACTION, and most of it turned out to be
measurable.

`scripts/e2e-mobile.mjs` measures four things across three phone viewports,
using the button and text probes earlier harnesses already exposed: a target
smaller than a fingertip, two targets close enough that the wrong one fires,
a primary action outside the thumb arc, and text cut off by the strip drawn
over it. The thresholds are platform guidelines rather than inventions — 44×44
is Apple's minimum, 8px is where adjacent targets start sharing a fingertip,
and the bottom third is what a thumb reaches without the hand shifting grip.

### What it found

| | before | after |
| --- | --- | --- |
| last row ↔ navigation tab | **0.0px** | hit area clipped to the list |
| every tab strip's gap | 6px | 8px |
| safe-area insets | never read | plumbed through every rect |
| `LAUNCH RAID` | 52% up | 9% |
| `CONFIRM` | 54% up | 9% |
| landscape tab strip | 76% up | 7% |

- [x] **A mis-tap across a mode boundary.** Row hit areas were clipped on their
      MIDPOINT, so up to half a row stayed live after scrolling out of the list,
      sitting over the tab strip below. A thumb aimed at the last row changed
      tab instead. Buttons take a hit clip now, and the probe reports the
      CLIPPED rect — "is this big enough" reads the drawn box, "do these
      overlap" reads the live one, and an audit that conflates them is wrong
      twice.
- [x] **`viewport-fit=cover` with nothing inset.** Asked for edge-to-edge since
      v0.9 and never read `env(safe-area-inset-*)`, so status text drew behind
      the notch and the tab strip behind the home indicator. They are CSS
      environment variables rather than properties, so the only way to read
      them is to put them on an element and measure it.
- [x] **Nothing was in reach.** The launch button was pinned to the bottom of
      the BOARD — the middle of a portrait phone — and CONFIRM had the same
      defect, hidden because it only exists mid-placement. The audit now drives
      a screen into a state before measuring it; the controls that matter most
      are usually the ones that appear mid-interaction.
- [x] **The phone never answered the finger.** No `navigator.vibrate` anywhere.
      Five patterns chosen by meaning, fired on the DOWN, and `deny` is two
      pulses because a single pulse of any length reads as success. Disabled
      buttons fire it — the first feedback they have ever given, and a dead
      control was previously indistinguishable from a missed tap.
- [x] **Rows carried no silhouette.** The game has drawn one for every structure
      since v1.19 and showed them only on the board, so the drawer stayed a
      spreadsheet. Rows read `drawStructureGlyph`, the same function the board
      uses, rather than a second set of shapes that would drift from it.
- [x] **It could not go on a home screen.** No manifest, no worker. Both now,
      with the worker discovering its own assets out of `index.html` at install
      — caching only the shell looks right and leaves the FIRST visit with an
      offline-capable page and no engine to run, because a worker registers
      after the page has already fetched its chunks.

### What was deliberately not done

- [x] **Carry a row from the drawer onto the map (v1.29).** Placing was two
      taps: arm the tool in the drawer, then aim on the board. A drag that
      starts on a row's SILHOUETTE and ends on the map now does both in one
      stroke.

      The silhouette, not the row, and that is the entire design. In portrait
      the drawer sits BELOW the board, so dragging a row onto the map and
      scrolling the list are the same stroke in the same direction — no amount
      of slop, velocity or direction tells them apart, because they ARE the
      same gesture. A dedicated grab area does, and the obvious one is the
      picture of the thing being carried. It is proved by its own revert
      probe: making the whole row draggable passes the carry check and fails
      "the same drag from the label scrolls instead".

      The press hand-off this needed is one method, `BoardView.adopt`, and it
      is written as the single sanctioned exception to the rule that the board
      refuses any press that did not start inside it. Ownership MOVES rather
      than being shared: the panel gives up its drag, kills its flick, and
      spends the row's press before the board takes it, so the lift over the
      map cannot also fire the row it started from. It is refused outside
      `placeMode` rather than silently starting a pan.

      One thing it got wrong first, and it is a nice illustration of why a tap
      and a carry are different verbs: `onPick` called `setTool`, and `setTool`
      treats re-selecting the armed tool as "put it down". Right for a tap on
      the row, wrong for a carry — dragging the thing already in your hand is
      still a carry — and the toggle turned `placeMode` off, so the board
      refused the press and the drag ended with nothing aimed.
- [x] **A drawer that behaves like one (v1.27).** Through v1.26 the only way to
      collapse it was to re-tap the ACTIVE tab — a real gesture with nothing on
      screen to suggest it, which is as good as no gesture. It has a grab
      handle now: drag to resize, release to snap to shut/half/full, tap to
      toggle. The drawer's height stopped being a boolean and became a share,
      so a drag has intermediate values to land on.

      Three things this got wrong first, all caught by measuring rather than
      by looking:

      - The test seam reported `layoutOf(scene)`, which RECOMPUTES a layout
        from defaults — so it read a half-open drawer however the real one was
        sitting, and the harness measured a constant. It reports the layout the
        panel was actually given now.
      - Making the share a fraction of the REMAINING room rather than of the
        safe height silently shrank the drawer by 115px the moment the handle
        took its 44, which cost the SYS tab its last row and broke `e2e-touch`.
      - The board could be dragged down to 22px. It has a 120px floor now —
        this is a map game, and a drawer that can cover the board is a way to
        lose the thing you are playing on.

      And one wrong check: "two drags of the same length end at the same
      height" fails on CORRECT behaviour, because two equal drags from
      different starting heights land on different detents. The honest property
      is that a nudge too small to reach the next detent springs back exactly.

- [x] **Swipe between tabs, and a row's secondary action (v1.28).** The rest
      of #4. A horizontal swipe across the drawer steps the tab strip, and a
      long press on a build row opens a spec card.

      The swipe needed an axis lock, because the same finger scrolls the list
      vertically: the direction is decided ONCE, early, from travel since the
      press began rather than since the last frame, and vertical wins ties and
      near-ties 1.4:1 — a scroll that keeps changing tab is worse than a swipe
      that has to be deliberate. It is portrait-only. In landscape the panel is
      a vertical rail with its tabs stacked at the bottom, and a horizontal
      drag across it is a drag OFF the rail onto the map; shipping it in both
      orientations changed tab whenever anyone dragged out of the rail, which
      `e2e-gesture` caught.

      The spec card is the larger half, and it closes a gap that had been open
      since M2: **nothing in the game showed what a structure does.** The build
      list gave a name, a price and a count, and range, rate of fire, what a
      weapon shreds and what it bounces off lived in the content files and on
      no screen anywhere. Four emplacements at four prices, and the only way to
      compare them was to buy one. Every number on the card is derived from the
      catalog the engine fights with, so a balance pass moves the card too.

      Two things it got wrong first:

      - It read the price off the sim profile alone, so it announced **NOT
        BUILDABLE** over a supply depot — a structure's cost is in two places
        and neither is a superset of the other. Field defences carry
        `supplyCost`/`cpCost` on the profile; everything the yard builds is
        priced per level in the town meta. Reading both also got the card the
        only answer to what an economy building is FOR, which was likewise on
        no screen: what it produces per minute.
      - It used the default 0.86 scrim. This is the densest card in the game,
        and the drawer rows behind it drew boxes straight through the stat
        block. Opaque now, like the first-run card: something you READ has
        nothing behind it worth seeing.

- [x] **A press that ended somewhere else stays ended (v1.28).** Found while
      pinning the long press, and older than it: Phaser emits a scene-level
      pointer-up only once its pass over the objects under the finger runs to
      the end, and a button's own up handler calls `stopPropagation`, which
      aborts that pass. So a drag that started on a row and ended over a
      DIFFERENT row left the first one believing it was still held — and the
      next scene-level up anywhere measured the NEW pointer's travel (a tap:
      zero) and fired the stale row. Measured firing a row's action two
      gestures and five seconds after the finger that started it had gone.
      Buttons match the release to the press that claimed it by `downTime`
      now, so a stale flag is inert rather than dangerous.

- [x] **A finger on a coasting list stops it (v1.29).** `stopFling` ran on the
      first pointer MOVE of a new press, so a press that never moved never
      caught the coast: rows kept sliding under the thumb put down to stop
      them, and the release fired whatever had slid into place.

      The obvious fix is the one the code already warned against — a touch
      release synthesises a compatibility mouse-down, so stopping on the press
      killed every flick at the moment of the lift. Two things make it safe
      now. It is checked per FRAME rather than from a handler, because a press
      landing on a row never reaches a scene-level down at all (`makeButton`
      calls `stopPropagation`, which aborts Phaser's down pass) and that is
      where nearly every press in a list lands. And `wasTouch` tells the two
      apart: touch events set it, mouse events clear it. A mouse-only machine
      has no synthetic events and is let through; a hybrid gives up only
      "click without moving stops the coast", and a mouse that moves takes the
      MOVE path anyway.

      The press is also SPENT. Stopping the scroll while letting the release
      through would be worse than not stopping it, because the row that slid
      under the thumb is not the row anybody was reaching for — every phone
      works this way, and the second half needed its own revert probe to prove
      it, since removing it leaves the first half passing.

      One check in the pair was flaky before it was trusted: it read the coast
      once, 60ms after the lift, and missed a slow frame about one run in
      three — the same shape as the `e2e-gates` flake. It polls for the coast
      now and lands the finger the moment it exists.

      And it broke a check in `e2e-touch` that turned out to be measuring the
      bug. "A second swipe continues instead of jumping" drove a 20px second
      swipe — under the drag slop plus rounding, so it only ever registered
      because the FIRST swipe's flick was still coasting and compounded into
      it. The moment a finger started stopping the coast, the compounding went
      away and the check failed on correct behaviour. It drives a real 60px
      swipe now. The guard it was written for — the list snapping BACK toward
      the top on a fresh touch — is untouched and strictly more sensitive.

      Worth recording separately: that failure was NOT caught by the gate run
      before the commit, which ran `e2e-touch` and saw it pass. It reproduces
      every time at that commit. A harness that passes once is not a harness
      that passes.
- [x] **Muster rows carry the counter they will be (v1.29).** Build rows have
      had a silhouette since v1.26 and the raid planner stayed a spreadsheet,
      for a structural reason: the drawing was a private method on
      BattleRenderer taking a live sim entity, and there is no unit to draw
      before the raid is launched. It is `drawAttackerGlyph` in `glyphs.ts`
      now, beside the structures', taking a kind and a cell like its sibling.

      The move was verified as a MOVE: the screenshot pass was run before and
      after and diffed byte-for-byte. Six of 173 shots differed — and the same
      six differ between two runs of identical code, because they carry live
      resource counters. 167 identical is the real result.

      The extraction also unblocked the attacker half of the spec card. An
      attacker's card asks different questions from a defence's, and the
      difference is the point: nobody wonders how far a rifleman shoots, they
      wonder what he can get through, how long he takes to get there, and what
      losing him costs. So it leads with the two demolition rates, the walk,
      and `cpValue` — the number that reads backwards, because every unit you
      send is Command Points you hand the defender when it dies.

      One thing this exposed. **A disabled row refused the press before it
      could become a hold**, which quietly made two claims false at once: the
      build list's locked rows advertised a card that could never open, and
      every muster row in a town without the barracks to train it was equally
      mute. Reading about something you cannot afford or have not unlocked is
      exactly when you want to. Disabled controls take the press for the hold
      alone now; the release still refuses, so nothing can tap.

      One change is kept without a check behind it and marked as such in the
      code: `release` checks ownership before disarming the hold timer.
      Reverting it changes nothing observable, but the alternative — any tap
      anywhere cancelling a hold in progress — is only safe by accident. `drawAttackerBody` is a private method on
      BattleRenderer taking a live sim entity; extracting it into a shared
      glyph the way structures have one is its own change.

### Two things this milestone taught about its own instrument

**An audit that only looks at idle screens is blind to the controls that
matter.** CONFIRM was 54% up the screen for five releases and no measurement
could see it, because it only exists while something is aimed.

**Three of the audit's checks were lying when first written**, and were fixed
before any result was trusted: it flagged normal mid-scroll rows as clipped,
counted masked-away text as text running off the screen, and judged "the last
row clears the strip" from 1120 of 1309 because a fixed number of wheel ticks
never reached the stop. A harness that reports the list working as a defect is
worse than no harness. Every fix in the table above was verified to fail the
audit when reverted.

**And one about a flaky test.** `e2e-gates` had a tap that fired about half the
time, which looked like a dropped board tap and would have undermined every
direct-manipulation plan resting on board taps. The harness's own comment had
the answer: a swing is priced in CP, CP accrues while the shooting goes on, and
the check waited a flat 800ms and hoped. The game was never dropping anything.

---

## M17 — v1.30 "Look Like The Thing"

The owner's read was "the units don't look like what they are — just circles
and stuff", and a contact sheet of the whole roster proved it in one picture:
**thirty-four kinds resolved to nine shapes**, and four of the nine were discs.
Three plain circles for the mobs, five identical donuts for the riflemen, five
identical diamonds for the sappers, five identical disc-and-stub for the
anti-tank teams, five identical lollipops for everything that flies. A roster
where a rifleman, an engineer and a Javelin team differ by a dot is one you
read by hovering, not by looking.

- [x] **An instrument that shows the set as a set (`npm run sheet`).** Every
      silhouette side by side at the three sizes the game actually draws them —
      a drawer row, a board counter, a card hero. This is the only view in
      which "nine shapes" is visible at all; from inside a battle two kinds are
      ever on screen at once and each one looks fine.

      The glyphs are pure functions of a Phaser Graphics and call ten of its
      methods, so the sheet stands a Canvas2D shim in its place and renders in
      the browser Vite is already serving — same code, same numbers, no new
      dependency to draw a picture of the drawing code.

      **It lied twice before it was trusted**, and both lies flattered the
      work. It filled the background with `COLORS.paper`, which does not
      exist — `css(undefined)` is black, so three passes were judged against a
      ground the game never draws, which makes a cream knockout look crisp and
      hides a dark wing completely. And it drew at 26/44/96px, none of which
      the game uses; a row hands the glyph ~46px, so shapes were being tuned at
      half the size they ship at. It draws on `bgField` and `bgPanel` now, at
      the real sizes, half the sheet on each.

- [x] **Silhouettes that read as the thing.** Twelve shapes, built from
      primitives rather than per-case pixels: a person is shoulders BEHIND a
      helmet (put the body around the head and the outline is a domino, which
      is what the first attempt drew); a weapon that overhangs backwards is an
      anti-tank tube and one that does not is a rifle; wheels and tracks stand
      PROUD of the hull, because inset they are drawn over and a tank is a
      plain box again. A mob is three figures, because the count is the
      identity. The Ka-52 gets its coaxial pair, the An-2 its second wing, the
      Reaper its long thin drone wings, the infiltrator an outline instead of
      a fill — the only hollow counter on the sheet.

- [x] **The knockout follows the surface.** The paper halo lifts a counter off
      a busy topographic sheet. On the drawer's dark panel it does the exact
      opposite: it paints a cream chip and the silhouette becomes a hole in it,
      which is why the muster read as a row of bright tiles. Both glyph
      functions take `onDark` now: no knockout, and the ink inverts, so a row
      icon is light-on-dark like everything else in the drawer while the board
      keeps its paper.

### The balance pass, and what it overturned

Two new instruments, one corrected belief, and a measured negative result.

- [x] **`--rungs`: what each rung DEMANDS.** Every ladder table in the harness
      fought all five rungs with the same reference plan — and that plan is a
      mature army. The USA's is three Abrams and a Javelin, 27 manpower, which
      needs a barracks and most of a motor pool. Against a tier-1 firebase it
      clears 100%. So does tier 2. The step between them was therefore reported
      as **-0**, and "the shallow rungs are free" has been carried as a balance
      defect since M15.

      **A clear rate pinned at 100 cannot show a step.** The metric saturates
      and two rungs that differ by a real amount both report the ceiling. No
      player fights that way either: the tier advances on clears and the town
      grows alongside it. So this sweeps a manpower budget per rung and reports
      the smallest force that clears half the time, holding the reference
      composition and moving only the SIZE.

      It lied once first. Resizing by scaling each unit count and rounding
      cannot express anything between one Abrams and two — `round(1 * k)` is 1
      for every k from 0.5 to 1.5 — so eleven of twenty-five cells reported the
      same number because they were fighting the identical force. It deals
      units out of the reference one at a time now.

      **What it found, stable across 3x the seeds:**

      | | T1 | T2 | T3 | T4 | T5 | |
      | --- | --- | --- | --- | --- | --- | --- |
      | USA | 11 | 11 | 22 | **11** | 22 | T4 asks LESS than T3 |
      | China | 8 | 18 | 22 | 22 | 27 | one flat rung |
      | Russia | 6 | 9 | 18 | 21 | 33 | monotone |
      | KPA | 8 | 14 | 14 | 22 | 33 | one flat rung |
      | UN | 9 | 9 | 18 | 18 | 27 | two flat rungs |

      So the documented item was **half wrong**: T1→T2 is not free — it costs
      +3 to +10 for three factions. The real defect is that **the USA's rung 4
      is easier than its rung 3**, and that Russia is the only faction whose
      ladder climbs at every step.

- [x] **`--dealorder`: rank the shapes where the ranking discriminates.**
      `DEAL_ORDER` decides which shape is dealt as "the heavy fight" at every
      rung, and it was derived from the reference plan — which for the USA
      clears nearly everything. Four shapes tied at 100%, and the ranking
      between them was a coin-flip wearing a number. `DEAL_ORDER_NEUTRAL`
      already said so in its own comment and worked around it instead of
      re-measuring. With a force sized to half-clear, the shapes separate:
      `corridor` is the USA's second-hardest target and was ranked 6th of 8;
      `keep` is a formality and was ranked 4th.

- [ ] **NEGATIVE RESULT: the deal cannot fix the ladder without costing
      parity, because it is the same lever.** Both candidate changes were
      measured and neither shipped:

      | | parity spread |
      | --- | --- |
      | shipped ordering | **15.0** |
      | re-derived ordering | 17.8 |
      | re-derived + a floor that rises with the rung | 24.8 |

      The floor-trim does what it was built to do — the USA's backwards rung
      disappears (11-11-22-27-27) and the UN becomes fully monotone — and it
      costs nearly ten points of the metric this project has led on for four
      milestones. The re-derived ordering is *more correct* in isolation and
      still costs 2.8, because the old ordering's noise happened to sit at a
      better parity point.

      Four floor settings were tried and every one leaves Russia with a rung
      that goes backwards, in a different place each time (-6 at T5, -9 at T4,
      -12 at T5). A defect that MOVES when an unrelated knob turns is a defect
      in the shapes near Russia's band boundaries, not in the knob.

      **The ladder defect is real and the deal is the wrong lever for it** —
      as long as the deal is only a shape. Eight shapes cannot give both a wide
      spread within a rung and a monotone climb between rungs. Done in M18
      below, by making the deal name the ground as well.

---

## M18 — v1.31 "The Deal Names The Ground"

The negative result above said the deal could not fix the ladder without
costing parity, because both were steered by the same lever: which shape lands
in which difficulty band. That was true of the deal it described. It stopped
being true once the deal could name the LAYOUT too.

The generator drew the layout from `variant` — the slot index — so a rung's
three targets were a shape band and a difficulty lottery on top of it. Shape
explains well under half the variance in clear rate and layout explains most of
the rest, so the lottery was the larger term. Decoupling the two turns the deal
from a coarse lever into a real tuning surface: a target is a (shape, layout)
PAIR, the layout pool is wide, and a pair can be chosen to land on a NUMBER
instead of in a band.

- [x] **`--layouts`: select the deal against measurement.** Measures clear rate
      for every (faction, tier, shape, layout) at the faction's own reference
      plan — the force parity is measured with — and picks the three pairs per
      rung that land closest to a target curve: 100 / 95 / 85 / 70 / 55 across
      the rungs, three targets spread ±15 around each. The same curve for every
      faction, which is what makes parity and the ladder stop competing: both
      are satisfied by construction rather than traded off.

      Two things it needed before the answer was trustworthy. Six seeds
      quantises clear rate to steps of 17 points and the selection then fits to
      that grid — picking a pair because six coin flips landed on 83 is
      overfitting to the seeds, not measuring a target; it uses twelve. And
      selecting on difficulty alone collapses the roster, because `compound`,
      `camp` and `corridor` have the widest layout ranges and can hit any
      target, so the other five shapes stop being dealt at all. A penalty under
      half a quantum for a shape the faction has already met fixes it: all
      eight now reach every faction, most of them on several rungs.

- [x] **The result.**

      | | before | after |
      | --- | --- | --- |
      | **parity spread** | 15.0 | **5.8** |
      | USA rung demand | 11-11-22-**11**-22 | 6-11-22-27-27 |
      | KPA rung demand | 8-14-14-22-33 | 8-14-18-22-27 |
      | shapes dealt per faction | 6 of 8 | 8 of 8 |

      5.8 is the best parity this project has measured — M15 brought it from
      25.6 to 17.2 and it has sat at 15 since. The USA's backwards rung is
      gone, the KPA's ladder is now even (+6 +4 +4 +5), and four of five
      factions climb at every step.

      Still open: China keeps one rung that goes backwards (T2→T3), and the USA
      and UN each flatten at the top. The selection targets a rung's MEAN and
      three targets can hit a mean from either side, so a rung can be built
      right and still sit a step out of line. Tightening that wants the curve
      expressed per slot rather than per rung.

- [x] **And the tables that were reading the wrong deal.** Every coverage table
      in `--deal` read `archetypeFor`, which is now only the fallback, so they
      described a deal the game had stopped using. Same class of mistake as a
      harness reporting a flow it never drove. The footer under the pool-mean
      ladder also claimed a defect it could not see — it measures a fixed
      mature force, so its early rungs saturate — and now says so and points at
      `--rungs`.

---

## M19 — v1.32 "The Whole Triple"

M18 left the selection greedy: fill slot 0 with the closest pair, then slot 1
from what is left, then slot 2. Its own closing note said what that costs — a
rung can be built right and still sit a step out of line — and it was worse
than that. Greedy does not just miss a target, it *takes the pair another slot
needed*. China's T3 wanted 70 / 85 / 100 and got 58 / 92 / 100, because the
pair spent on the hard slot was the one the middle slot had no substitute for.

- [x] **Search the triple, not the slot.** About ninety candidate pairs per
      rung, and only the best pair per (shape, target) can ever be in a winning
      triple, so the candidate set trims to eight per slot before the search
      starts. Exhaustive over distinct-shape triples is then a few hundred
      thousand combinations and runs instantly. Cost is squared error against
      the three targets, with the coverage penalty folded into the same score
      instead of applied as a separate sort key.

      | | parity spread |
      | --- | --- |
      | M17 shipped (deal = shape only) | 15.0 |
      | M18 greedy over (shape, layout) | 5.8 |
      | **M19 exhaustive over the triple** | **4.2** |

- [x] **A steeper curve was tried and rejected — measured, not argued.**
      100 / 93 / 80 / 62 / 42 separates the last two rungs on the budget grid
      and costs parity: 5.8 → 8.6, on seeds the selection never saw. The reason
      is worth keeping: at a 40% clear rate the same seed noise is a much larger
      share of the number, so the five factions spread out under it. The gentle
      curve keeps every rung in the band where the measurement is steady. Both
      the harness and `DEAL_TABLE`'s header carry that number now, so the next
      person to reach for a steeper top finds out it was already priced.

- [x] **The instrument was inventing steps.** `RUNG_BUDGETS` jumped 27 → 33, so
      every rung whose true demand sat between them reported as one or the
      other, and four of five factions read "flat at the top" while their clear
      rates were plainly separating. On a grid that is roughly 20% apart at the
      bottom and 10% at the top:

      ```
      USA     6  11  22  25  27     +5 +11  +3  +2   monotone
      CHINA   8  18  11  28  28    +10  -7 +17   ·
      RUSSIA  6   6  21  27  30      ·  +15  +6  +3
      NK      8  14  14  22  28     +6   ·   +8  +6
      UN      6   9  18  24  27     +3  +9   +6  +3   monotone
      ```

      **The USA and the UN are fully monotone.** M18 recorded them as flattening
      at the top; that was the grid, not the ladder. A measurement cannot be
      read finer than the axis it was taken on, and this one had been reported
      to two milestones as if it could.

- [x] **Still open, and now correctly attributed.** China goes backwards at
      T2→T3 and flat at T4→T5; Russia is flat at T1→T2; the KPA is flat at
      T2→T3. These are content limits, not selection failures — for China at T3
      no (shape, layout) in the pool sits near the 80 target at all, so no
      choice among them can put the rung where the curve wants it. Fixing them
      means widening the layout pool or the shape roster, which is a content
      milestone rather than a tuning one.

- [x] **The snapshot stops lying about its own version.** `docs/BALANCE.md`'s
      title was a string literal reading `v1.25`, so six releases of tables
      measured on other builds were published under a version they were not
      measured at. It reads `package.json` now. Its commentary block had the
      same problem one level down — the terrain bullet still quoted "6.6 points
      under FLAT" against a table now reading 2.0 — so the block says what it is
      (a log of what was learned when, not a caption on the current numbers) and
      the bullet names the reading rule instead of a figure that re-measures
      every run.

- [ ] **NEW: air measures badly, and the table saying so cannot be trusted
      yet.** Re-measuring `--md` on the new deal put the air thesis and an air
      defect in the same place. The thesis holds — AA on the board costs every
      faction's air force clear rate, which is what the air layer was built to
      be true. The defect looked like a 32-point spread in what flying is worth,
      from +6.4 (the USA) to -26.2 (Russia).

      **M20 below found that number was measured against an unfair control and
      corrected it.** Four of the five air plans fly 3-4 MP MORE than the ground
      reference they were compared with, and the one that is matched is the one
      that measured worst. Read against a manpower-matched control the spread is
      26.8, no faction's air beats its own ground, and the interesting question
      turns out to be a different one entirely. The numbers in the table above
      are superseded; keep them only as the record of what a confounded control
      reports.

---

## M20 — v1.33 "Air Fights A Different Ladder"

The question this milestone was filed to answer was "price the air roster the
way `--parity` prices the ground". Three instrument defects had to be fixed
before the table could be read at all, and once it could be read the answer was
not about the roster.

- [x] **The control was not the same size as the thing it controlled.**
      `AIR_RAID_PLANS` is documented as "roughly the same manpower, flown", and
      `roughly` had never been checked. It is not true:

      | | ground reference | air plan | air surplus |
      | --- | --- | --- | --- |
      | USA | 27 | 30 | +3 |
      | China | 26 | 30 | +4 |
      | Russia | 27 | 27 | **0** |
      | KPA | 26 | 29 | +3 |
      | UN | 27 | 30 | +3 |

      Russia is the only faction not flying a bigger force than its control, and
      Russia is the one that measured worst — so the edge column was reporting
      budget as well as doctrine, in exactly the direction that made the finding
      look bigger. Rather than re-cut five hand-written plans (unit costs
      quantise; an exact match is not always reachable while keeping the shape),
      the control moves: `GROUND =N` is the reference dealt to the air plan's
      budget by `planAtBudget`, the routine `--rungs` already sizes forces with.

      The two rows where the budgets already agree are a free check on the sizer
      every run — Russia's `GROUND` and `GROUND =27` must be identical, and they
      are, to the digit.

      Corrected, no faction's air beats its own ground: the USA's +6.4 is +0.6
      and China's +5.0 is -2.0. Both apparent wins were the surplus.

- [x] **MP LOST% was counting heads.** `deployed` and `returned` on a
      `SquadReturn` are unit counts, so a 7-MP Ka-52 and a 1-MP conscript
      weighed the same. Ground rosters field similar mixes and the proxy held
      there; air does not, and a three-airframe force read as catastrophic for
      losing what a nine-body force shrugs off — the opposite of what "air buys
      survival" is trying to test. `raidRows` had always done it correctly off
      `res.deployed` and `res.losses`; five later tables each re-implemented it
      by hand and each got heads. Extracted as `manpowerFlow`.

      Verified by its own negative control: Russia's ground plan is nine BTRs at
      3 MP each, where heads and manpower must agree, and its number does not
      move. Everything with a mixed roster does — the USA's ground row went
      47 to 39, its air row 58/65 to 45/55.

      What that fixes: the survival half of the air thesis. Air still loses more
      manpower than matched ground for four of five factions, so the claim is
      still false — but now it is false by a margin the table earned.

- [x] **"AIR no AA" never removed the AA.** Every generated ladder base BUILDS
      `aaSite` mounts and no row here took them off; the control removed the
      GARRISON'S reactive air-defence order, the rule that stands up `manpads`.
      The rows read MOUNTS and +MANPADS now. They said `no AA` and `+AA` for
      four releases, which is a claim the table never made.

- [x] **`--wing`: what air costs, ceiling-free.** `--air` reads a fixed force
      against the ladder, so it saturates — the same defect that made the
      fixed-force ladder tables useless until `--rungs` replaced them. This asks
      `--rungs`' question of the wing: the smallest manpower that clears half
      the time, dealt once in the ground reference's shape and once in the air
      plan's.

      Two things it had to get right first. A budget too small to buy one
      airframe deals a plan of pure ground tail and would report the tail's
      price as air's — Russia is where that bites, since the Ka-52 costs 7 and
      the cheapest rung is 6 — so any dealt plan with nothing flown is skipped.
      And the first run came out reading 12/12/28/12/38 across one faction's
      five rungs, which is not a shape any demand curve has: a 50% threshold off
      24 battles is a coin flip at the boundary and `budgetToClear` STOPS at the
      first crossing, so a fluke low is never corrected from above. Twenty seeds
      and a confirm rule — demand is monotone in budget, so a crossing that
      immediately un-crosses was noise — fixed four of the five.

- [x] **The fifth did not fix, because it was not noise.** The USA still read
      T3 at 38 MP and T4 at 12. Probed directly, a 12-MP air force clears T4
      62% of the time and T3 0%. So it was measured per dealt target, at one
      fixed budget, and the answer is the milestone:

      | USA, 24 MP | ground | air |
      | --- | --- | --- |
      | T3 corridor | 45 | 50 |
      | T3 camp | 60 | **0** |
      | T3 depot | **100** | **5** |
      | T4 star | 45 | **100** |
      | T4 keep | 35 | **100** |
      | T5 star | 5 | **70** |

      The two targets air cannot take at all are the two the ground force finds
      easiest. Walls and overlapping arcs are what make a rung hard on foot and
      neither exists for an aircraft; what is left is the flight in, and the
      shapes with the fewest walls are the ones that spread their mounts and
      their command post over the most ground.

      Across all five factions, **39 of the 75 dealt targets — 52% — move by 30
      or more clear-rate points depending on whether you walked or flew**, and
      for four of five the MEANS are close (USA 62/65, China 71/76, KPA 73/63,
      UN 65/62). Russia is the exception at 65/44 and is the one faction whose
      air is also simply weaker.

- [x] **So the answer is not the roster.** The deal is selected against ground
      difficulty — `--layouts` does exactly that, deliberately and by
      measurement, and it should, because almost every raid is a ground raid.
      Air experiences that same deal as a scrambled ladder. An air player is not
      climbing a harder ladder; they are climbing an incoherent one, and the
      game tells them the shape for free (GDD §5) while telling them nothing
      about what it means to an aircraft.

- [x] **NEXT, and specified rather than started.** Two candidate answers, and
      they are not the same game:

      1. **Select the deal against both ladders.** `--layouts` gains a second
         objective so a rung's three targets span air difficulty as well as
         ground. Cheapest, and it costs some of the 4.2-point ground parity that
         took three milestones to earn.
      2. **Say which targets suit an aircraft.** The shape is already free
         information; make its air read free too. Then choosing to fly stops
         being a lottery and becomes the tactical read the air layer was
         supposed to be. More work, better game, and it does not touch a number
         that is currently right.

      The second is the one to try. Measure before committing either way. Done
      in M21 below — and it measured, and it shipped.

---

## M21 — v1.34 "The Approach"

M20 ended on an information problem: half the targets a player is dealt are a
materially different proposition flown, the shape is free knowledge, and the
game said nothing about what that shape means to an aircraft. This is the
missing sentence.

- [x] **A rule, not a table.** The cheap version is a lookup on (tier, slot,
      faction), and it would be worthless the moment a share code or a duel puts
      a base in front of you no table has seen. `src/meta/airread.ts` computes
      from a layout and a catalog, so a pasted base reads exactly like a ladder
      rung.

      The mechanic it models is the one `updateAirAttacker` implements: an
      aircraft ignores the grid, flies a straight line, and hovers. Walls, gates
      and the maze — everything that makes a rung hard on foot — do not exist
      for it. What is left is the flight in. So for every gun that can elevate,
      take the length of the run in that falls inside its envelope, divide by
      the speed of the slowest airframe, multiply by its damage per second.
      DPS-seconds absorbed getting there.

- [x] **It had to beat what the player already has, and the bar was the shape.**
      `--airread` scores it against the measured air clear rate on all 75 dealt
      targets. The shape's own mean is the incumbent — scored on the very rows
      it was fitted to, which flatters it — and the read wins anyway:

      | predictor | r | r² |
      | --- | --- | --- |
      | **TRANSIT DPS-seconds** | **−0.71** | **0.50** |
      | OVERHEAD flak over the post | −0.41 | 0.17 |
      | OVERHEAD + TRANSIT | −0.68 | 0.46 |
      | SHAPE alone (flattered) | +0.46 | 0.21 |

      And it wins for every faction separately (−0.78 / −0.66 / −0.90 / −0.63 /
      −0.54 against the shape's +0.51 / +0.42 / +0.38 / +0.60 / +0.42), which is
      what rules out a predictor carried by one roster.

- [x] **The term that sounded right and did not ship.** OVERHEAD — flak covering
      the command post, where an aircraft has to hover while it works — is the
      obvious dominant term and it is not. On a generated base it is very nearly
      binary: either a mount covers the post or one does not. It scores −0.41
      alone and makes the combination WORSE than transit by itself. A term that
      cannot vary cannot predict. It is still measured in `--airread` so the
      table keeps saying why it is absent.

- [x] **Bands derived, not chosen.** A player cannot read DPS-seconds and three
      words is the target list's whole budget, so the cuts are the TERCILES of
      the measured population — they cannot be nudged to flatter the result.
      What each third then clears at, flown, at 24 MP:

      | | transit | targets | mean air clear% |
      | --- | --- | --- | --- |
      | CLEAR RUN | under 27 | 25 | 91.0 |
      | CONTESTED | 27 to 95 | 25 | 76.8 |
      | HEAVY FLAK | over 95 | 25 | **18.4** |

      The information is concentrated at the bottom. CLEAR and CONTESTED are 14
      points apart and both mean "this will probably work"; HEAVY is a cliff,
      and it is the thing a player needed telling. The raw figure ships beside
      the band because the band alone cannot rank two posts that both read
      CONTESTED — and ranking the three on offer is the decision the front line
      actually presents.

- [x] **Free, like the shape.** Air defence is the one thing a post cannot hide,
      and a read that cost Intel would leave flying the lottery it was. Gated
      only on the commander having an airfield or an airframe: a panel line that
      describes a decision you cannot make is a line that has not earned its
      place.

- [x] **Two things this turned up on the way.** The demo raid town called itself
      "a mustered mid-game town" and had never owned an aircraft, which is why
      nothing in the harness had ever exercised the air layer — it has a strip
      and an airframe now. And `PanelRow.sub` was being dropped on the floor by
      heading rows without a word: the target tab's league row has carried
      `LOOT ×1.15` since v1.3 and never once shown it. Headings render their sub
      now, which is how it appears in this release's screenshots.

- [ ] **What is still not answered.** The read is validated as a property of a
      TARGET, over the three sectors the reference air plans launch from. Air
      transit is strongly directional — the same post is cheap from one edge and
      dear from another — so the natural next step is a per-sector read on the
      squad's own entry point, which would make the sector picker matter for air
      in a way it never has. It is not shipped because it is not measured: the
      formula would be the same one on a narrower input, and this project does
      not ship the untested half of a validated instrument.

---

# The overhaul programme — M22 to M31

*Written 2026-09-18, from an audit of v1.34 rather than from memory of what was
shipped. Everything below is a MULTI-PHASE overhaul, not a tuning pass. The
sequencing warning is at the bottom and it is not optional: M22 invalidates every
matrix in `docs/BALANCE.md`, and M24, M25 and M26 all re-tune on top of it.*

**What the audit found.** 46,410 lines: `src/game` 11.7k, `tests` 9.2k, `scripts`
6.7k, `content` 6.9k, `meta` 4.9k, `tools` 3.6k, `sim` 3.3k. 38 attacker kinds,
20 structures, 18 campaign missions, 8 archetypes, 9 buildings, 9 research nodes,
5 factions. The bundle is 1.48 MB of Phaser against 352 KB of game — 81% of the
download is an engine whose textures, physics and scene graph this project does
not use.

Four findings drive the whole programme:

1. **One unit is 99-100% of a raid.** `--carry` silences each unit kind in turn:
   USA `abrams` 99%, China `type99` 100%, Russia `btr` 100%, UN `vab` 100%. Only
   the KPA differs, at 13%, because tunnels changed the SHAPE of the problem
   rather than the size of the numbers. It has got WORSE — v1.21 measured 46-87%
   — because M15 re-derived the reference plans to be optimal and the optimum
   converged on heavies. **GDD pillar 2, "your plan is your skill", is currently
   false.**
2. **The action pillar is the least-built half.** A live siege is five field
   defence kinds, two commander powers and gates. There are three code paths into
   one: a campaign mission, a counterattack, a skirmish. Every probe resolves
   offline. "Defense is the action game" describes about a tenth of the code.
3. **Five factions that measure the same.** Parity at 4.2 points took three
   milestones and is a real achievement — and it means the kits now differ in
   stats and one mechanic each. What was meant to differ in STYLE has been
   successfully tuned into differing in almost nothing.
4. **The ladder's bottom half is free.** `T1->T2 -0`, `T2->T3 -5`, then -20/-20.

---

## M22 — v1.41 "The Kill Chain": rebuild what winning a battle IS

**The one that has to go first.** The command post is an HP sponge that only
adjacency meaningfully damages: `DAMAGE_MULT` discounts ranged fire hard against
`structure` (smallArms 0.15, flak 0.1, kinetic 0.5, explosive 1.0) and `hqDps`
only fires when a unit is adjacent. So the only thing that ends a raid is a unit
that survives to touch the post, and everything else in the roster is escort. A
buff to an escort buys nothing — measurably, exactly nothing.

Replace the sponge with a **staged objective**: cut the wire, suppress the
covering guns, set the charge, hold the ground while it burns. Each stage wants a
different unit. Breachers open, suppression keeps heads down, the heavy still
matters and can no longer solo four stages, and a force with no infantry stalls
at stage one.

- [x] **Phase 1 — an instrument that attributes PROGRESS, not kills.**
      `npm run balance -- --chain`. Four stages read off today's sponge, so the
      baseline stays comparable once the model ships.

      **There is no chain.** Measured, three of the four stages are not gates at
      all:

      | faction | BRCH | GUNS | CHRG | BURN | stalls at |
      |---|---|---|---|---|---|
      | USA | 30 | 98 | 92 | 84 | BURN (−8) |
      | China | 36 | 98 | 90 | 86 | CHARGE (−9) |
      | Russia | 12 | 99 | 97 | 79 | BURN (−18) |
      | KPA | 70 | 98 | 66 | 63 | CHARGE (−32) |
      | UN | 5 | 97 | 84 | 78 | CHARGE (−13) |

      Covering guns die in 97-99% of raids — suppression is not a stage, it is
      a formality. BREACH is low and means nothing today, which the instrument
      had to learn the hard way: the first draft called it WIRE and read it as
      "got in", then reported every faction failing to get in while burning the
      post four times in five. A wall line steers, it does not block (GDD
      §5.3), so a force that walks around the wire breaks none and is inside
      anyway. That column is where M22's difference will show.

      And per unit, the sponge is confirmed in the sharpest terms yet:

      | faction | unit | MP | BRCH | GUNS | CHRG | BURN |
      |---|---|---|---|---|---|---|
      | USA | abrams | 8 | 21 | 64 | **91** | **84** |
      | USA | javelin | 3 | −1 | 1 | 3 | 7 |
      | China | type99 | 7 | 23 | 88 | **90** | **86** |
      | China | militia | 1 | 0 | 0 | 0 | 0 |
      | China | sapper | 2 | 0 | 0 | 0 | 0 |
      | Russia | btr | 3 | 0 | **99** | **97** | 79 |
      | KPA | tunneler | 2 | 0 | 0 | 15 | 13 |
      | KPA | infiltrator | 1 | 0 | 0 | −1 | −3 |
      | UN | vab | 3 | 0 | **97** | 84 | 78 |

      Two of China's three unit kinds move NOTHING at any stage — not a little,
      zero. The KPA's infiltrator scores negative, meaning the raid is very
      slightly better off with it silent. Read precisely: this is the damage
      channel only, so a zero says a unit's damage buys nothing, not that its
      body does — it still soaks. That is the strongest form of the M22 thesis
      and the bar Phase 3 has to clear.
- [x] **Phase 2 — the stage model in the engine, behind `KILL_CHAIN_VERSION`.**
      `src/sim/killchain.ts`. Version 0 is the sponge, frozen: the 531 tests
      that predate this release pass untouched, and `tests/killchain.test.ts`
      pins that naming version 0 hashes identically to naming nothing.

      The model, with every constant measured rather than chosen — shares
      30/15/55 of the bar, a 4-cell cover radius, a crew of 2, a 20-second fuse:

      | stage | bar | paid in | who is good at it |
      |---|---|---|---|
      | BREACH | 1.00→0.70 | `wallDps`, plus shells | sappers 60-80 over heavies 22-35 |
      | SUPPRESS | gate at 0.70 | every gun within 4 cells down | anything with reach |
      | CHARGE | 0.70→0.55 | `hqDps`, **two bodies minimum** | cheap infantry per manpower |
      | BURN | 0.55→0.00 | a 20s clock, while held | whatever survives |

      **The headline finding is how raids were actually being won.** Wiring the
      stages in dropped the reference expeditions to 11.3% clear, and no
      constant moved it — four of five factions scored EXACTLY ZERO under every
      variant swept. The cause was not balance. Explosive does 1.0 against
      `structure`, so three tanks parked at range four shelled the post down
      without ever entering the base; the chain clamps standoff fire at the
      breach floor, and the AI then stood there shelling a bar that could not
      move, because `updateAttackers` stops a unit that has a target in reach.
      Dropping the opened post from the target list — you bombard the bunker
      open, then somebody walks in — took the same constants from 11.3% to
      49.4%. **A win condition nobody designed had been carrying the game for
      twenty-two milestones, and only a model that took it away could find it.**

      What the model bought, on the five reference plans:

      | | BRCH | GUNS | CHRG | BURN | stalls at |
      |---|---|---|---|---|---|
      | USA | 87 | 80 | 70 | 69 | CHARGE (−9) |
      | China | 88 | 84 | 64 | 64 | CHARGE (−20) |
      | Russia | 91 | 73 | 68 | 63 | GUNS (−18) |
      | KPA | 66 | 64 | 61 | 59 | CHARGE (−3) |
      | UN | 79 | 74 | 56 | 56 | CHARGE (−18) |

      - **Suppression is a stage now.** 97-99% of raids passed it on the sponge;
        64-84% pass it here. A radius of 6 asks for 3.2 guns dead on average, 4
        for 1.22 and 3 for 0.53 — six was a shape tax that cost Russia 31 points
        more than anyone else, which is why the shipped radius is 4.
      - **The stages became monotone.** The sponge scored BREACH 5-36 UNDER BURN
        78-86, which is incoherent on its face. These fall in order.
      - **Parity improved without being tuned for.** Clear rate spread across the
        five factions goes from 23 points to 13. Asking for four capabilities
        suits five rosters better than asking for one.
      - **DUG IN's inverted sign is fixed.** The v1.40 finding — thicker wire
        RAISING destruction — is gone, because wire is now stage one and nothing
        past it can be done at range. The same +45% costs a raid 42% of its
        progress (0.67 stages against 0.39), and at a stronger force it is a
        50-point swing in clear rate. `tests/conditions.test.ts` asserts the
        direction rather than recording a defect.

      **What it did NOT buy, stated plainly: the heavy is still the best unit to
      bring.** A new instrument, `npm run balance -- --mix [version]`, prices six
      compositions at one manpower budget, roles picked from each roster by stat:

      | | 3 HEAVY | 2H+BRCH | 2H+GUN | 2H+BODY | 1H+MIX | 0 HEAVY |
      |---|---|---|---|---|---|---|
      | sponge, USA | **81** | 70 | 72 | 70 | 55 | 17 |
      | chain, USA | **59** | 55 | 56 | 56 | 28 | 6 |
      | sponge, Russia | **53** | 39 | 53 | 38 | 33 | 11 |
      | chain, Russia | 33 | 27 | **38** | 23 | 14 | 5 |

      The chain narrows the heavy's lead (USA −9 to −3) and flips Russia to
      2H+GUN, but the shape of the answer is the same under both. **The binding
      constraint is not what wins at the post, it is who survives the approach**:
      small arms do 1.0 against `none` and 0.2 against `heavy`, so a squad of
      engineers is wiped out at tick 703 having moved the bar from 1.00 to 0.97.
      The chain gives infantry a job; the armour table still denies them the
      chance to do it. That is Phase 3 and Phase 4's problem and it now has a
      number attached.

      **Two instrument defects found and fixed**, both of which had been quietly
      distorting Phase 1's table:

      - `silence()` zeroed `hqDps` and the weapon but NOT `wallDps`, so every
        demolition unit read as contributing nothing. Phase 1's "the KPA
        tunneler moves 13-15 points" was an artifact: corrected, it owns BREACH
        at 62-67. China's sapper is still ~0 on the sponge and +4 on the chain,
        which is small but is the first time a support unit has shown anything.
      - The first staged run reported BURN at 0% for every faction while the
        post's bar reached 0.000 in every raid that set a charge. `liveStage` is
        read before the burn is applied, so on the tick the post fell it read
        `burn`, the engine stopped, and the high-water mark never reached 4. A
        re-tune against that readout would have been a re-tune against nothing.

      Two rules were added because a test failed and the failure was right:
      **an aircraft is not a body on the ground** (two gunships shelled a post
      open, counted as crew and burned it down with no demolition and no
      infantry anywhere in the force), and **the burn backs off rather than
      resetting** when the ground is lost.

      Legible where it is fought: the siege SITREP names the live stage
      (`POST — COVERED BY 2 GUNS`, `CHARGE SETTING — 1/2 ON IT`) and a repulsed
      raid's report says which stage it stalled at.
- [x] **Phase 3 — re-derive all five reference plans against it.** The bar: carry
      at or under 50%, and every roster slot delivering something measurable.
      **Half met, and the half that is not is a content finding rather than a
      plan one.**

      **The search could not express the answer.** `--derive` capped a
      composition at THREE unit kinds. The kill chain has four stages, each
      wanting a different unit, so the search was structurally incapable of
      proposing the force the model was built to reward — it would have
      reported "nothing beat the reference" and the reason would have been the
      instrument. Lifted to four, which roughly doubles the space (USA 472
      compositions to 757, China 2360 to 6216).

      **`--carry` now measures presence, not just damage.** SILENCED zeroes
      every damage stat and leaves the body. REPLACED takes the kind OUT and
      spends its manpower on the rest of the plan, in the proportions the plan
      already had — the planning question, and the one the bar is set on. The
      two channels diverge enormously: China's Type 99 reads 64 silenced and 42
      replaced. A single-kind plan cannot answer REPLACED at all, which is the
      monoculture problem stated in one column.

      **What combined arms costs, which is what the phase turned on.** A new
      ladder in `--derive` reports the best HELD-OUT plan at each number of unit
      kinds instead of one argmax, because an argmax cannot price a trade:

      | | REF | 1 KIND | 2 KINDS | 3 KINDS | 4 KINDS |
      |---|---|---|---|---|---|
      | USA | 77.5 | 74.2 | 77.5 | 75.0 | 64.2 |
      | China | 65.8 | 15.8 | 74.2 | **82.5** | 76.7 |
      | Russia | 66.7 | 79.2 | 69.2 | 76.7 | 71.7 |
      | KPA | 68.3 | 45.0 | 75.8 | 74.2 | 67.5 |
      | UN | 69.2 | 69.2 | 66.7 | **66.7** | 57.5 |

      **Mixing is nearly free.** Every faction has a three-kind plan within 2.5
      points of its best concentrated one, and two GAIN by it. Adopted:

      | faction | plan | was | is |
      |---|---|---|---|
      | USA | 2×abrams 2×humvee 1×javelin | 77.5 | 75.0 |
      | China | 2×grenadier 1×militia 3×type99 | 65.8 | **82.5** |
      | Russia | 6×btr 3×demoteam 1×rpg | 66.7 | **76.7** |
      | KPA | 12×nkrifle 2×rpg7 5×tunneler | 68.3 | **74.2** |
      | UN | 7×vab 1×unsapper 1×nlaw | 69.2 | 66.7 |

      Read the units: a **sapper's** successor, a **demolition team**, an
      **RPG**, an **NLAW**. Kinds that measured zero for twenty-two milestones
      are in the optimum now. And every faction stalls at the same stage —
      CHARGE, the bodies-on-the-objective gate — which is what a designed
      bottleneck looks like, against a sponge where the columns did not even
      fall in order.

      **The bar, honestly.** Carry: USA 59% → **41%**, Russia n/a → **6%**, KPA
      18% → **42%** — three of five under 50, and Russia essentially carry-free.
      China 32% → **61%** and the UN n/a → **71%** fail, and no plan fixes them:
      dropping one Type 99 costs China 16-35 points across six measured
      alternatives, and dropping two VABs costs the UN 7-14 across seven. Those
      two rosters put 21 of 26 manpower's worth of value in one unit. **That is
      a content fact, and the bar cannot be met by choosing a plan** — handed to
      Phase 4 with the numbers.

      **A defect in the search, found by disagreeing with itself.** Raising the
      sample from 150 to 260 — a strict SUPERSET of the same seeded stream —
      moved the USA's three-kind winner from 75.0 DOWN to 65.8. More candidates
      cannot make the true best worse, so the screen must have promoted worse
      candidates above the real winner and evicted it before it was ever
      deep-scored. The finalist cut per bucket went 6 to 10, and the chosen
      plans were each verified directly on the held-out battles rather than
      trusted from the search's own report.

      One more thing that cost five points and would have been invisible:
      `--derive` round-robins units into sectors in ROSTER order, so a plan
      transcribed in a different key order is a different battle. The emitted
      source says so; a hand-written literal does not.
- [x] **Phase 4 — re-tune the ladder.** `docs/BALANCE.md` regenerated against
      the chain. **Measured, explained, and NOT tuned — the reasons are below
      and the second one is the important one.**

      **The defence half was still on the sponge.** `defenseMatrix` builds its
      `SimConfig` by hand rather than through `battleConfig` and was never told
      about the chain, so every DEFENSE, FORTIFY, HOLDFAST and AA row would
      have been measured against an HP-sponge post while the game shipped four
      staged gates. The comment on that config predicted this exact failure
      when `combatVersion` was added in v1.23 — "the one place that would
      quietly keep measuring the sim as it was" — and it fired again, a whole
      milestone later. Fixed before the snapshot was taken.

      **What the chain did to the ladder:**

      | | sponge | chain | |
      |---|---|---|---|
      | parity spread | 23.0 | **18.8** | closed 4.2 |
      | parity mean | 83.8 | **68.2** | the ladder got much harder |
      | ceiling | China 95.0 | KPA 77.6 | the order inverted |
      | floor | KPA 72.0 | USA / UN 58.8 | |

      T5 is the wall: 8 / 32 / 12 / 72 / 0 across the five factions. A rung
      four of five clear under a third of the time, and one clears never, is
      not a curve.

      **The defence rows split, and the split is the design working.** Bare
      rows drifted DOWN a few points (China MID L3 35 → 15, KPA 25 → 10): the
      chain pays for bodies and the AI's assault waves are mass. Every WITH AA
      COVER row jumped two to three ladder levels — China's MID line went
      85/0/0/0 to 100/100/100/70, the KPA's 65/0/0/0 to 100/95/95/20. The
      cause is the suppression gate: the row's mounts are DUAL-PURPOSE flak
      (`targets: 'both'`), one of them sited 2.24 cells from the post centre,
      inside the 4-cell cover radius. A tough, long-ranged gun beside the post
      is now a gate rather than just damage, and it is worth three rungs.

      **A wrong cause, published and then corrected.** The jump was first
      attributed to air-only mounts being counted as cover, and a fix shipped
      saying so. Re-running with the fix in place reproduced all fourteen moved
      rows EXACTLY — it explained nothing. The rule is still right (a Stinger
      pit cannot suppress infantry standing on the post) but it is LATENT: no
      row in the snapshot exercises an air-only mount, which is why nothing
      moved, and `tests/killchain.test.ts` now carries the only thing that
      exercises it.

      **Why no tuning.** Three levers present themselves — the gun ladder for
      the 15-point mean drop, the T5 rung, and the cover radius for the AA
      effect — and all three are the same mistake M33 already made and
      measured: scaling the gun ladder by frontage overshot so badly that a
      +45% wall condition measured no difference at all. The numbers here are
      one snapshot old against a combat model four phases old. A re-tune wants
      a stable target, and the honest state is that M22 rebuilt what winning
      is and has not yet been played. Recorded, handed to the next balance
      milestone with the three levers named.

      **One debt could not be paid and should not be pretended away.** The
      campaign side is unmeasurable headlessly: 33 missions across five
      factions were run under both models and returned 0% hold under each,
      because `newTown()` is an empty yard and a campaign mission is a
      player-in-the-loop prep phase the harness cannot play. The defence-floor
      tables are the proxy, and they are in the snapshot. Whether the campaign
      curve moved is a playtest question.

## M23 — "Live Fire": make defence the game the GDD claims

Three times the verbs. Commander abilities on real cooldowns rather than stocked
charges; unit-level orders (hold, fall back, focus fire); a prep phase that is a
puzzle and not a countdown; wave modifiers a player reads and answers;
repositioning field defences mid-wave at a cost. And change WHEN a siege happens
— an offline probe should be offerable as "defend this live, right now, for a
premium", which converts idle attrition into sessions.

- [x] **Phase 1 — a pressure-curve instrument.** `npm run balance -- --siege`.
      One row per (base, level): post integrity at the end of each wave, the
      first wave that moves it, the wave that moves it most, and the lowest
      integrity reached in a run that was WON — the only number that can say a
      win was earned rather than collected.

      **It is not an action game yet, and the numbers are not close.**

      | | |
      |---|---|
      | LIVE WAVES | **28%** — the share of waves that move the margin at all |
      | NEVER IN DOUBT | **69%** of rows that were won never dropped below 90% integrity in ANY seed |

      Seven waves in ten are watched rather than played: the attack never
      reaches the one thing that decides the battle. And where the defender
      wins, it usually wins untouched. A typical row reads `100 100 100 100 99`
      — four waves of nothing, then a scratch.

      **It also found a hang that v1.41 shipped.** 18% of reference sieges
      deadlocked: 0% on the sponge, 18% on the chain, every one of them a
      single attacker in state `assaulting` with the bar pinned at the breach
      floor. The crew minimum means one attacker can never take a post; once
      every gun that could reach it is dead it can never be killed either; and
      a wave ends only when the attackers do. In a live siege that is a player
      watching one immortal tank stand on their command post until the tick
      cap.

      Fixed as `CHAIN_CURRENT = 2` — a new version rather than an edit,
      because v1.41 had shipped and the freeze stops being a formality the
      moment a build reaches a player. An assault that has achieved nothing
      for 90 seconds is spent and withdraws. "Achieved nothing" is the whole
      board standing still — no damage to the post, nothing destroyed, nobody
      killed — rather than the bar alone, because a bar pinned at the
      suppression gate while the rest of the force works through the covering
      guns is an assault in progress.

      **The fix had a second half that only appeared once the first landed.** A
      lone AIRCRAFT deadlocks identically, and for a reason M22 introduced
      itself: "an aircraft is not a body on the ground" keeps it out of the
      holder count, so a clock gated on holders never started for the one
      attacker that is hardest to shoot down. The quorum counts anyone who
      reached the objective; only the crew minimum counts boots. Stalls now
      0/180 on both models.

      **And a number in `BALANCE.md` was wrong because of it.** `defenseMatrix`
      reads anything that is not a victory as "did not hold", so every
      deadlock has been filed as a defeat: `NK MID (CC2)` at level 3 read 0%
      hold when all eight seeds were stalemates with the post at 70%. The
      re-measured snapshot moved exactly those rows — that cell 10 → 85, and
      `NK LATE (CC3)` levels 4-6 from 0/0/0 to 100/100/85.

      **What the rule costs, held to one variable.** Same seeds, same plans,
      chain v1 against v2 across the USA raid ladder: CLEAR% and DESTR% come
      back IDENTICAL in all five tiers and only MP LOST% moves — T2 27 → 73,
      T4 66 → 75. That is the whole of it. An assault that stalls was never
      going to clear and had already done its damage, so the only question
      the rule answers is whether the force pinned at the wire walks home,
      and the answer is no. Worth saying plainly because "withdraws" is the
      fiction and a write-off is the mechanic: the stats credit the defender
      with the kills, which for a defender who has just destroyed an assault
      on their own command post is close enough to true to be worth the
      simplicity, and a 46-point swing in what a half-failed raid costs is
      the price of it.
- [x] **Phase 2 — the verb set, one at a time.** Each measured against clear rate
      AND against how often the player's input changed the outcome. A verb that
      does not move the second number is decoration.

      **The second number now exists: `npm run balance -- --leverage`.** Same
      board, same seed, same attack, the defender's policy the only variable —
      doing nothing, against each of the three shipped standing-orders presets
      with a stocked magazine. Checked before it was believed: the NONE column
      reproduces `--siege`'s HELD in all 45 rows, and the magazine that rides
      with the policies is inert without one (pinned in `standingOrders.test.ts`
      after the probe agreed on 200/200 battles), so the columns really do
      differ by one thing.

      | | |
      |---|---|
      | FLIPPED | **8%** of battles had a verdict that depended on the policy |
      | NO VERB HELPS | **82%** of rows came back identical under all four |

      **The shape of it matters more than the number. Leverage lives in one
      band and nowhere else.** Of 45 rows, 37 are decided before the battle
      starts: every EARLY (CC1) row is 100% at level 2 and 0% at levels 3-4
      under every policy, and every LATE (CC3) row is 100% under every policy.
      Seven of the eight rows that move at all are MID (CC2) at level 3 or 4.
      That is Phase 1's LIVE WAVES 28% seen from the other side — most sieges
      are settled by the permanent layer before the player has a say, so a
      fifth verb added to the same battles would read zero for the same reason
      the first four do.

      **And the verb set is not weak, it is one verb.** On every row that moves,
      HOLDFAST is best or tied best, and on three of them it is the difference
      between a row that cannot be won and one that nearly cannot be lost —
      CHINA, NK and UN at MID (CC2) level 4 go 0% to 95%, 75% and 100%. On
      those same rows COUNTERBATTERY and TRIPWIRE score exactly 0%. Across the
      whole table neither ever moves a row by more than two battles in twenty,
      in either direction, which at 20 seeds is the noise floor M13 set. Same
      CP, same magazine, same battle: one preset decides it and two are
      decoration. That is a content finding about the presets, not an argument
      for more verbs.

      **Then: WHY are those 37 rows decided? Two hypotheses, both refuted, and a
      shipped hang behind them.**

      The first was a rich-get-richer CP loop — a defence being overrun earns
      least exactly when it needs most, since CP comes from kills. `--spend`
      says no. Every losing row ends the battle sitting on a FULL 150 CP bank,
      having spent 48-66 on exactly three actions. It is not starved; it is not
      idle either. It always acts, always three times, always at the same price,
      whether the base is winning comfortably or being overrun. The defender's
      play is a fixed opening, not a response.

      The second was that the action budget binds, `maxActions: 3` being the
      only thing stopping a defender who dies rich. `npm run balance -- --budget`
      sweeps it to 3, 6, 12 and unlimited. The ten dead EARLY (CC1) rows stay at
      **0% at every one of them**, landing 11-17 actions and still losing 20/20.
      So the constraint is IMPACT, not opportunity, and that is the finding: the
      defender gets to act, can afford to act, and acting more does not help.

      **The sweep also found an inversion, which turned out to be a hang.** UN
      LATE (CC3) level 4 read 100% at cap 3 and 40% at cap 12 — playing more
      lost the battle. It was not balance: DEFEAT is 0 at every budget, and
      those were timeouts. Traced to a lone gunship holding a bar oscillating
      between 0.7031 and 0.7094 of maximum for thirty thousand ticks, either
      side of the 0.70 breach floor, because the UN's own repair aura kept
      lifting the post back over the line that M22 tests LIVE to decide whether
      standoff fire may target it. Fixed as `CHAIN_CURRENT = 3`: the breach
      latches. Both inversions gone, 178 of the 180 cells in the sweep
      byte-identical across the fix.

      **Worth saying plainly: every instrument in the repo was blind to it,
      including the two built to hunt exactly this.** `--siege` and `--leverage`
      read the same before and after, because a defender only reaches the bug by
      taking more than the three actions HOLDFAST allows, and nothing had ever
      let one. v1.41.1's "stalls now 0/180 on both models" was measured with no
      defender policy at all. It was true, and it was not the claim it looked
      like.

      **And the regenerated snapshot moved nothing — zero of 901 table rows.**
      Which is the same fact from the other end: no shipped configuration can
      reach the hang, because the most generous preset in the game allows six
      actions and it takes more than that. A defect can be real, severe, and
      completely invisible to every table you own, all at once.

      **Then the table the phase exists for: `npm run balance -- --verbs`.** One
      rule at a time, everything else held fixed — same budget, same hostile
      threshold, same cooldown, `cpAtLeast` set to the thing's own price so
      every verb acts the moment it can afford to. Scoped to MID (CC2) levels
      3-4, because a verb measured on a row that cannot move reads zero for a
      reason that is not about the verb.

      | verb | HELD vs nothing |
      |---|---|
      | `foxhole -> ccApproach` | **+32** |
      | `depmg -> ccApproach` | **+31** |
      | `foxhole -> breach` | +6 |
      | `depmg -> breach` | +4 |
      | `claymore -> ccApproach` | +2 |
      | `a10 -> densest` | +0 |
      | `arty -> densest` | **-3** |

      **The verb barely matters; the AIM does.** A gun at the approach is worth
      +31. The same gun at the breach is worth +4. A mine on the same cell is
      +2, and the two fire missions are nothing and worse than nothing. That is
      the kill chain's own doing and it is geometric: SUPPRESS gates the post on
      every live gun within `coverRadius`, so a deployed WEAPON inside that
      radius adds a gate the attacker must clear, and everything else merely
      does damage. Since M22 the defence's only real lever is adding gates.

      **Which makes two of the three shipped presets pre-chain artifacts.**
      COUNTERBATTERY is all damage — A-10, claymore, artillery — and scores
      exactly +0. TRIPWIRE scores -1 while OWNING the +31 verb, and that is the
      third finding: rules are evaluated in list order and every action spends
      one of `maxActions`, so a cheap rule at the top with a short cooldown
      starves everything below it. TRIPWIRE's claymore sits first at
      `cpAtLeast: 16` on a 100-tick cooldown and eats all five actions before
      `depmg -> ccApproach` ever fires. Delete that one rule, change nothing
      else, and the preset goes **65% to 100% on the same action budget.**

      **The uncomfortable part, and what Phase 3 has to decide.** The one verb
      that works is worth so much that aiming it correctly ends the question —
      a single correctly-placed gun takes these rows to 97-100%. So the answer
      to "how often did the player's input change the outcome" is: one move
      changes everything and the rest change nothing, which is not a verb set
      with depth. Repairing TRIPWIRE to 100% would flatten the game further,
      not improve it, so it is deliberately NOT done here. The options are to
      make the gate cheaper to clear, to give the damage verbs a job the chain
      can see, or to make rule ORDER a thing the player chooses rather than a
      trap — and that is a design call, not a tuning one.

      **Two candidate fixes priced, both rejected, and the rejection is the
      finding.** `npm run balance -- --orders`, MID (CC2) levels 3-4.

      | preset | shipped | fairShare | perWave |
      |---|---|---|---|
      | HOLDFAST | 97% | **74%** | 100% |
      | COUNTERBATTERY | 66% | 66% | **93%** |
      | TRIPWIRE | 65% | 86% | **100%** |

      `fairShare` — no rule may take more than its share of the budget — fixes
      TRIPWIRE and BREAKS HOLDFAST, because HOLDFAST's whole strength was
      placing the SAME good verb three times. It punishes the correctly
      ordered preset to rescue the wrong one, which is levelling rather than
      fixing. `perWave` makes all three strong and is therefore not a fix
      either: it turns the defence dominant rather than making the battles
      close. Both stay in the type, defaulted off and pinned inert by a test,
      because the instrument that priced them is what Phase 3 will reach for.

      **And it exposed a flaw in Phase 1's own headline.** LIVE WAVES measures
      post damage, so it falls both when the attack never arrives AND when the
      defence is dominant — `perWave` raises hold rate and lowers LIVE in every
      row. It cannot be read alone. What "close" needs is hold% near 50 AND
      LIVE high, and nothing measured so far produces both.

      **Which is the real answer to the whole phase: the ladder has no
      contested band.** Parsed straight out of `BALANCE.md`, counting levels
      where a defence row lands between 5% and 95%:

      | contested levels in the row | rows |
      |---|---|
      | 0 | 6 of 15 (40%) |
      | 1 | 8 of 15 (53%) |
      | 3 | 1 of 15 (7%) |

      **93% of defence rows are step functions** — `100 | 85 | 0 | 0 | 0 | 0` —
      one level of contest and then a cliff. Exactly one row in fifteen is a
      ramp (`USA MID: 100 100 100 90 75 10`), and it is the exception that
      proves the shape is achievable. No verb set can matter where the
      difficulty curve has no slope, which is why every lever priced in this
      phase moved rows between 0% and 100% without ever producing a battle that
      was close. Phase 3's first job is a contested band; the verbs get
      re-judged against it afterwards, not before.
- [x] **Phase 3a — WHERE the contested band is, measured.** Two sweeps, and
      the first one failed usefully.

      `npm run balance -- --band` prices every chain constant that could make
      CHARGE and BURN decide a battle: burn length 20→90s, burn decay, crew
      minimum, and cover radius. **CONTESTED sits at 12% for every one of
      them.** Identical results across a whole sweep is a structural cause, not
      a plateau — the second time that rule has paid this milestone.

      The cover-radius candidate is worth recording because its MECHANISM
      worked and its outcome did not. `coverRadius` 4 is the same as a deployed
      gun's weapon range, so the guns that gate SUPPRESS and the guns that can
      reach the post are one set by construction: clearing the gate
      necessarily removes everything that could contest the burn. Shrinking it
      to 2 moves PASSED GATE 44% → 51% and THEN TOOK IT 83% → 73%, so the last
      two stages really did become load bearing — and CONTESTED does not move
      at all, because the two effects cancel. A lever can be right about the
      mechanism and worth nothing.

      `npm run balance -- --slope` dials attacker HP CONTINUOUSLY through the
      place a row flips, which separates the two remaining explanations:

      ```
      UN    MID (CC2) L4 | 100 | 85 | 40 | 15 |  0 |  0 |  0 |  0
      CHINA MID (CC2) L3 | 100 |100 |100 |100 | 85 | 70 | 50 | 30
      USA   MID (CC2) L4 | 100 |100 |100 |100 | 90 | 75 | 65 | 15
                    0.6x  0.7x 0.8x 0.9x  1x  1.1x 1.2x 1.4x
      ```

      **The battle is not bimodal.** Difficulty is continuous and the contested
      band is real, reachable and about 0.7x-1.0x of attacker HP wide. The step
      function is therefore neither the chain's nor variance's: **one integer
      level of the assault ladder is a bigger jump than the whole band.** And
      the stages sit outside it — EARLY (CC1) still loses level 3 at 0.6x,
      forty percent weaker attackers, while LATE (CC3) still wins level 4 at
      1.4x.

      So the fix is the assault ladder's granularity and the spacing of the
      reference stages, both of which are content. Every chain constant was
      the wrong place to look, and three sweeps were needed to be sure of it.
- [x] **Phase 3c — the ladder is LONGER, and that is the fix.** The ramp alone
      was half of it; the other half was arithmetic. A six-rung ladder spanning
      this difficulty range has a floor of +33% per rung even when perfectly
      uniform, and flattening it while holding the mean forces level 1 up by
      54% — which is not a probing attack any more. Both costs vanish if the
      ladder simply has more rungs, and `assaultLevel` turned out never to have
      been capped: it starts at 1, increments on a win, and `buildAssault`
      takes any number. The six levels were only ever what the tables sampled.

      So growth drops 0.18 → 0.09 with new waves ramping in at 0.15/0.10:

      ```
      L1  24        L5  50 (+9%)    L9   85 (+8%)
      L2  30 (+25%) L6  58 (+16%)   L10 100 (+18%)
      L3  37 (+23%) L7  69 (+19%)   L11 110 (+10%)
      L4  46 (+24%) L8  79 (+14%)   L12 116 (+5%)
      ```

      Worst step **+25%**, comfortably inside the 43% band; level 1 untouched
      at its original size; the old level 6 arrives at level 11.

      | | before | after |
      |---|---|---|
      | contested levels per row | 0.73 | **2.20** |
      | rows with 2 or more | 1 of 15 | **10 of 15** |
      | worst step | +67% | **+25%** |

      **And the metric had to be rebuilt to see it.** `--band` samples fixed
      level NUMBERS, so stretching the ladder slid the sample out from under it
      — it read 3% contested and 82% mean hold, which looks like a catastrophic
      regression and is an artifact of measuring levels 2-5 that now hold a
      third of what they used to. `--rungs` counts contested levels across the
      WHOLE ladder instead, which is what a player climbs through and is
      invariant to how many rungs it takes.

      Saved towns are rescaled on load by `rescaleLadder` (old 4 → new 9,
      derived from the curves rather than chosen) and stamped with
      `ladderVersion`, so a war in progress keeps facing the assault it had
      earned. The counterattack path, which borrows the assault ladder for a
      raid tier, goes through the same rescale.

      **EARLY (CC1) has no contested rung, and `--width` says why.** The
      contested band is not one number — it is a property of the BASE:

      | stage | mean band width |
      |---|---|
      | EARLY (CC1) | **+22%** |
      | MID (CC2) | +95% |
      | LATE (CC3) | +59% |

      v1.42 sized rungs at +25% against a board-wide ~43%, which fits MID and
      LATE and cannot fit EARLY. Four of five EARLY rows have no measurable
      band at all. The suspect was the reference layout, and both halves of it
      were checked rather than assumed: the base already fields CC1's WHOLE gun
      allowance (two nests and an autocannon, three guns), and doubling its
      maze from 16 wall segments to 32 moves level 4 not one point, at any
      attacker strength from 0.6x to 1.4x.

      So three guns cannot hold a level-4 assault however they are arranged,
      and a three-gun base has too little variance for its outcome to be in
      doubt at all. That is not a bug to fix with a rung size or a layout. It
      is a question nobody has answered: **is CC1 supposed to be contested?**
      A defensible reading is no — it is the onboarding stage, you win easily
      and then must upgrade, and contested play starts at CC2 where the band is
      +95% wide. If that is the intent then EARLY's flat rows are correct and
      should stop being counted as step functions. If it is not, CC1 needs more
      than three guns, which is a pacing decision about the opening hours.
- [ ] **Phase 3b — the ramp alone, superseded by 3c. Kept for the record.**
      Waves 4, 5 and 6 unlock at levels 2, 3 and 4 and used to arrive at full
      size, which is where the +67% and +58% steps came from — not from
      `scaleCount`, which is a gentle +18%. A newly unlocked wave now arrives
      at 40% and reaches full strength two levels later, so the lesson it
      teaches still lands on schedule and only the size of the step changes.

      | | before | after |
      |---|---|---|
      | CONTESTED rows | 12% | **17%** |
      | MEAN HOLD | 64% | **71%** |
      | THEN TOOK IT | 83% | 74% |
      | worst step, units fielded | +67% | +55% |

      **It works and it is not enough, and the second number says why.** Mean
      hold moved seven points, so this did not only re-shape the curve, it
      lowered it — a real difficulty change that wants compensating at the top
      of the ladder before anything ships.

      And the ramp family has a measured CEILING. Searching start and increment
      for the flattest ladder that still reaches full strength by level 6 gives
      +55% at best; flatter shapes exist (+39%) but leave the gunship wave
      permanently at a third strength, which is not a level 6. The structural
      reason is that three waves unlock in three consecutive levels, so every
      early level adds a whole new thing. Getting under the band's ~43% width
      needs the unlocks SPREAD (waves at 2, 4, 6) or the ladder LENGTHENED —
      both of which change what a level means in the meta, and neither of which
      should be decided at the end of a session.

      Left on the branch with its evidence and deliberately not merged: `main`
      keeps v1.41.2's ladder until the compensating pass is done and the
      snapshot regenerated.
- [x] **Phase 3c — build the contested band FIRST, then re-judge the verbs
      against it.** `npm run balance -- --cliff` says exactly where the step
      function comes from, and it is not where Phase 2 guessed.

      Every row that reads 0% or 100% sums to exactly 100 across "held" and
      "the attack passed SUPPRESS" — in those battles, clearing the gate and
      taking the base are the SAME EVENT. Every contested row sums to more,
      because the attack got through the gate and died afterwards. So the game
      has two regimes and a seam:

      | regime | passed SUPPRESS | then took it | held |
      |---|---|---|---|
      | the gate holds | 0% | — | 100% |
      | the gate falls, the rest is a formality | 100% | **100%** | 0% |
      | the seam | 25-90% | **0-40%** | 85-95% |

      The fix is NOT to soften SUPPRESS, which was the obvious reading and the
      wrong one: softening it just moves rows from the first regime to the
      second. It is to make CHARGE and BURN decide battles that SUPPRESS
      currently decides — passing the gate should be routine and holding the
      post should be hard, which is also the fiction the chain was written for.
      Every row where "then took it" is 100% is a battle whose last two stages
      are scenery.

      Then, and only then, the verbs get re-judged: a defender action is worth
      measuring once there is a band for it to land in.

      **The re-judgment (v1.45.3).** The band exists now. The longer ladder and
      the 10x15 board leave 23 (faction, base, level) cells that the permanent
      layer alone holds between 5% and 95% of the time: EARLY 5, MID 10, LATE 8.
      `--verbs` measures on exactly those, by stage, and counts the battles each
      rule changed in each direction on the same seeds. It found two defects
      before it found a verdict.

      **The A-10 had never hit anything.** Cast 920 times on the band, both of
      its charges in every battle, and not one kill in 460 battles differed
      from never casting it. A standing order laid the gun run where the
      densest knot of attackers WAS, and the strike landed later: half a second
      for the gun run's first pass, a second and a half for the first shell. In
      half a second an infantry file walks most of a cell, and the gun run's
      strip reaches less than half a cell either side of its aim, so it came
      down where the file had been. The order also counted aircraft into the
      knot, which both strikes pass beneath by design.

      **And three of the duty officer's distances were still cells.** The radius
      a cluster is counted within, for standing orders and the raid fire plan,
      and how far out from the post a `ccApproach` gun goes, were literals in
      the engine rather than catalog fields, so M34's inventory walked past
      them. On 10x15 each reached twice as far as written. A "cluster" was any
      two attackers within six units, and the approach gun went down six units
      out instead of three.

      Both are fixed as kill chain 5 (`CHAIN_AIMED`): version 4 with an aim.
      Its fire missions lead the knot by the rule a mortar already fires by,
      and count only the ground force, and its distances are units. Version 4
      stays frozen for every v1.45 battle. The regenerated snapshot says it is
      what it claims to be. All 48 defence rows with no orders in them read
      exactly as v1.45.2's did, and the raid tables, whose fire plans and
      garrisons aim by the same radius, moved by 1.1 points of clear rate on
      average, inside the noise.

      **The verdict, on chain 5.** Held-rate change against no orders; the last
      column is battles changed toward a hold and toward a loss.

      | one rule, alone | HELD | EARLY | MID | LATE | changed |
      |---|---|---|---|---|---|
      | `depmg -> ccApproach` | **+26** | +45 | +22 | +19 | +161 −42 |
      | `foxhole -> breach` | **+25** | +0 | +33 | +29 | +123 −10 |
      | `depmg -> densest` | +21 | +44 | +17 | +11 | +132 −36 |
      | `depmg -> breach` | +20 | +0 | +23 | +29 | +106 −13 |
      | `claymore -> ccApproach` | +13 | +1 | +20 | +13 | +88 −27 |
      | `foxhole -> ccApproach` | +13 | +44 | **−7** | +20 | +123 −61 |
      | `arty -> densest` | +4 | +10 | −1 | +6 | +81 −64 |
      | `a10 -> densest` | +3 | +15 | +4 | −6 | +63 −49 |

      **A gun decides battles; damage stirs them.** Every rule that stands up a
      gun wins between two and twelve battles for each one it loses, wherever
      it is aimed. The fire missions land now, and they change about one battle
      in four, nearly as often each way: +81 −64 for the barrage, +63 −49 for
      the gun run. A net that small on a gross that large is what changing
      verdicts at random gives, and the table does not star it. That is the
      chain's doing. A battle is decided at the gate, and killing a few of the
      men walking up to it moves no gate. Phase 2's second option, giving the
      damage verbs a job the chain can see, is still open, and it is the real
      work left here. The aim was only the first problem.

      **The fix exposed a trap in HOLDFAST.** Chain 4's six-unit reach put
      HOLDFAST's second gun in the corridor between a MID base's two wall lines,
      on the route in, by accident, and it was worth a lot there. At three units
      it goes beside the post. That is inside the ring an assault clears first,
      since M34's crews started hunting the guns covering the post, and on MID
      that one rule is −7, worse than no orders at all. So HOLDFAST's second gun
      goes to the breach too, which is what its own banner always said it did
      ("guns down breaches"). The old rule is kept for the battles fought with
      it. A replay rebuilds a preset from its id, so `standingOrdersFor` answers
      by the kill chain the battle was fought on.

      | preset | HELD | EARLY | MID | LATE |
      |---|---|---|---|---|
      | HOLDFAST | **+16** | **+17** | +11 | +22 |
      | COUNTERBATTERY | +13 | +7 | +18 | +12 |
      | TRIPWIRE | **+22** | +3 | **+26** | **+29** |
      | *HOLDFAST before 3c, chain 5* | *+10* | *+41* | *−7* | *+11* |
      | *HOLDFAST on chain 4* | *+30* | *+43* | *+23* | *+31* |

      **One preset is no longer the answer.** On chain 4 HOLDFAST was the best
      preset on every stage, and worth about twice either of the others
      overall. Now each is positive on
      every stage, HOLDFAST is the best of the three on an EARLY base and
      TRIPWIRE on MID and LATE, and best and worst are nine points apart rather
      than nineteen. COUNTERBATTERY is best nowhere, which is the damage verbs'
      finding again, seen through a preset.

      **TRIPWIRE's ordering trap is still there, and still kept on purpose.**
      Its claymore still spends the budget before its gun gets a turn. Without
      it TRIPWIRE goes from +22 to +38, +45 on EARLY and +50 on MID, which
      would make it the answer on two stages of three. That is the flattening
      Phase 2 refused, measured on a band this time rather than on two levels.
      Its third option still stands: make rule order the player's to choose.
- [x] **Phase 4 — live-defend offers, and a defeat state that costs something
      memorable.** The last probe of an absence is no longer resolved. It is
      held back and OFFERED, with a thirty-minute window, and the two answers
      are deliberately different battles.

      The meta was the easy half and mostly already existed. `applySiegeOutcome`
      has always WRECKED every structure that did not survive a played siege,
      while `runOfflineProbes` takes a flat slice of the stockpile and wrecks
      nothing — the memorable defeat was sitting there needing to be connected,
      not invented. Declining resolves the probe exactly as never being offered
      would have, and an offer walked away from lands at the same price on the
      next sweep, so there is no penalty for a player who cannot play right now.

      **The first version was wrong, and measurement is what said so.** Eight
      seeds, two reference towns:

      | battle | thin (2 guns) | full (CC2, 6 guns + wire) |
      |---|---|---|
      | probe, 2 waves | L1-6 100%, L8 88%, L16 38% | **100% at every level 1-24** |
      | full assault | L1-2 100%, L3 13%, L4+ 0% | L4 100%, L5 88%, L6 75%, L8+ 0% |

      A probe is the first two waves of its rung with the defender economy
      switched OFF — `startingCp: 0, cpPerSecond: 0`. Offering that as a live
      battle was wrong twice over: the player has no CP, so no verbs at all,
      nothing to do but watch; and a built town holds it regardless. An offer
      you cannot lose and cannot act in is not a decision, it is a chore that
      pays.

      So standing to fight is a DIFFERENT battle from letting them probe, and
      the fiction is the mechanic: a probe is what they send when nobody is
      home, and meeting them at the wire is what makes them commit. Same rung,
      same seed, the whole assault, the town's own siege economy — which the
      same table puts at 100/88/75/0 across levels 4/5/6/8 with nobody acting.
      That is Phase 3c's contested band, which is the point: the offer lands
      the player in the one place on the curve where what they do decides it.

      The bounty is half a skirmish's loot at the same level, derived from
      `assaultLoot` so the two cannot drift. Half because a skirmish is a fight
      you went looking for and this one came to you — the real reward for
      holding is the 15% of the stockpile a breach would have cost.

      **What it cost to find**: the first version passed its whole unit suite
      and an eleven-check E2E harness. Both were asking whether the loop
      closed, and it did. Neither could ask whether the battle was worth
      fighting, because that is a question about a distribution and every test
      in the repo runs one battle at a time. The sweep took twenty minutes and
      changed the design.
- [x] **Phase 5 — a job for the damage verbs (v1.47.0).** Phase 3c left the fire
      missions stirring battles rather than deciding them: on the contested band the A-10
      and the barrage each changed about a battle in four, nearly as often each way. The
      brief was a job the chain can SEE, judged on the same table by the same rule.
      `npm run balance -- --pins` prices the answer in two halves, because the first thing
      it found was that there were two.

      **Half of it was never the chain. It was when the duty officer called the strike.**
      A fire mission went the moment it could be afforded, onto the densest knot on the
      board, which is usually the column still forming at the edge of the map, out of reach
      of every gun. 3c's other aim, the post itself, fired at the same moment: all 32 gun
      runs sampled came down with the nearest attacker nine to eleven cells away, on an
      empty post. So a standing order can now aim at the **assault**, the densest knot of
      ground attackers inside the post's cover ring, and only while there is one, and it
      can wait for a knot of a given size (`minKnot`). On chain 5, damage and nothing else:

      | one rule, chain 5 | HELD | EARLY | MID | LATE | changed |
      |---|---|---|---|---|---|
      | `a10 -> densest` (3c) | +3 | +15 | +4 | −6 | +63 −49 |
      | `a10 -> assault`, 2 in the ring | +6 | +1 | +10 | +5 | **+47 −19** |
      | `arty -> densest` (3c) | +4 | +10 | −1 | +6 | +81 −64 |
      | `arty -> assault`, 3 in the ring | +9 | +27 | +5 | +4 | **+57 −14** |

      Both are starred now. Nearly every disciplined strike lands during BREACH, on the
      first knot to reach the post, and killing the crew that is digging at it is something
      the chain counts.

      **The other half is kill chain 6: a fire mission pins what it lands on.** A pinned
      unit does not move, shoot, dig or hold for eight seconds, so it moves no stage of the
      chain: no demolition at BREACH, no fire at the guns holding SUPPRESS shut, no crew at
      CHARGE, nobody holding while the post BURNS.

      | the gun run on the assault | HELD | MID | LATE | changed |
      |---|---|---|---|---|
      | no pin (chain 5) | +6 | +10 | +5 | +47 −19 |
      | pin 8s, infantry and light vehicles | +7 | +12 | +6 | +52 −18 |
      | pin 8s, heavies only | +12 | +19 | +11 | +70 −14 |
      | **pin 8s, every ground unit (chain 6)** | **+13** | **+21** | **+11** | **+74 −13** |
      | pin 5s, every ground unit | +11 | +18 | +9 | +66 −16 |
      | pin 12s, every ground unit | +15 | +23 | +13 | +80 −13 |

      EARLY reads +1 in every row, which is the cost the last paragraph comes back to.

      **The pin is almost all in the tanks.** The naive picture of suppression is infantry
      going to ground, and pinning only infantry and light vehicles buys one point. A
      strike that kills a rifleman leaves a tank standing, so for a tank the pin is the
      only thing a fire mission does, and a tank is what shells the guns from standoff and
      holds the post while it burns. Nor is
      eight seconds a number tuned to a target: five and twelve are starred too. The barrage
      gains less, +9 with or without the pin, having one charge and scattering its shells.

      The verdict, by 3c's rule: the gun run on the assault wins 74 battles for every 13 it
      loses, the barrage 57 for 14. The best guns still decide more, +20 to +26, and should:
      a gun stays and a strike is spent.

      **HOLDFAST's gun run waits for the assault now. COUNTERBATTERY keeps its aim, and the
      reason is the finding.**

      | preset, chain 6 | HELD | EARLY | MID | LATE | changed |
      |---|---|---|---|---|---|
      | HOLDFAST | **+22** | +1 | +26 | **+32** | +118 −15 |
      | *HOLDFAST, gun run on the mass* | *+12* | *+7* | *+9* | *+20* | *+98 −41* |
      | COUNTERBATTERY | +15 | +7 | +19 | +16 | +103 −34 |
      | *COUNTERBATTERY, fire on the assault* | *+13* | *+3* | *+18* | *+13* | *+95 −36* |
      | TRIPWIRE | +22 | +3 | +26 | +29 | +130 −28 |

      Re-aimed, COUNTERBATTERY got no better, and nor did four other versions of it tried
      alongside: all between +12 and +16. Its claymore is the middle rule of three, cheap
      and on a short cooldown, and while a fire mission waits for the post the claymore
      spends the CP and the action budget the strike was going to need. That is TRIPWIRE's
      ordering trap in a second preset, and it is now the whole of what this phase leaves
      open. Rule order still means "evaluated first", not "funded first". Making it mean
      priority, or the player's to choose as Phase 2 proposed, is the next piece of work,
      and it needs a replay code that can carry an order.

      **What the re-aim cost HOLDFAST is EARLY.** 3c's HOLDFAST read +17 on an EARLY base.
      The pin took its old orders to +7 there, and the re-aim to +1: on a CC1 base the
      gun run on the column did more than the gun run on the post, which reaches it late.
      MID and LATE rose by 17 and 12 and the preset by 10 overall, but EARLY is now a stage
      no preset does much for, which in 3c it was not. The whole ladder says the same: in
      the snapshot's HOLDFAST tables the contested EARLY cell fell in four factions of five,
      the USA's level 3 from 70 to 25, while MID and LATE cells rose by as much as 45 (the
      UN's MID level 8, 25 to 70). One MID cell fell, Russia's level 9, from 95 to 65. Of
      the snapshot's 52 tables those five and the KPA's COUNTERBATTERY table moved, and
      nothing else did.

      Pinned units wear four short red strokes closing on them, and the fire tab says what a
      strike does. Chain 5, and HOLDFAST's orders on it, are frozen for the battles fought
      with them. Bare defence rows and raid rows cannot meet a pin, since nothing in them
      calls a fire mission on the attack, so they read exactly as v1.46.0's did.
- [x] **Phase 6 — rule order, measured where the orders fight (v1.49.1).** Phase 5
      handed on rule order: TRIPWIRE and COUNTERBATTERY lose a gun or a strike to a
      cheaper rule that spends first, and making order mean priority, or the player's
      to choose, was to be the next piece of work. Measured first, it was not, and
      the measuring found what was.

      **As the engine stands, order means nothing.** `npm run balance -- --order`
      fights every order of each preset's three rules on the contested band, 23
      cells at 20 seeds. The list only says which rule is looked at first in a given
      second, and a cheap rule anywhere in it spends while a dearer one saves up.
      TRIPWIRE's six orders fight the same battles seed for seed, and HOLDFAST's
      and COUNTERBATTERY's are within a point of each other.

      **Made to mean funding, it means one answer.** A `priority` flag makes the
      list a priority: a rule that wants to act and is short of its reserve holds
      back every rule below it, and a rule keeps an action in hand for each rule
      above it that has not acted yet. The shipped orders fight almost exactly as
      they do without it, HOLDFAST 67% held against 68 and the other two unchanged.
      But TRIPWIRE with its gun first holds 88%, +42 over no orders, and it is the
      best order on every stage but EARLY and against every faction, while the
      other two presets' orders stay within three points of each other. Letting
      the player choose would hand them that one configuration: the flattening
      Phases 2 and 3c refused, with a menu in front of it.

      **And none of that is the battle standing orders fight.** Every M23 phase
      judged the orders on the ladder's sieges, which start with 40 to 80 CP and
      earn 1.2 a second. The orders never fight one. A live siege is the
      commander's, and the one battle the garrison fights for them is the offline
      probe: the rung's first two waves with the defender's economy off, so every
      CP is one a kill earned. `--probes` fights the instruments on those, and
      `--probe-held` reads them straight, every faction, 8 seeds, levels 1-8 (a
      probe comes at the town's rung, capped at one past the front line's tier,
      plus league pressure of up to two):

      | a probe, per battle | HOLDFAST | COUNTERBATTERY | TRIPWIRE |
      |---|---|---|---|
      | probes held against no orders, of 2,000 | ±0 | +1 | ±0 |
      | orders carried out | 0 | 1.4 | 2.4 |
      | strikes called | 0 | 0 | — |
      | upkeep | 0 | 22 supplies | 37 supplies |
      | billed as the town's losses, EARLY (CC1), before this phase | 0 | 2.3% of the stockpile | 2.7% |

      Every reference base, and EARLY cut to two guns, holds every probe at
      levels 1 to 8, 10 and 12 against every faction. EARLY cut to one gun is the
      only base that ever loses one: to North Korea from level 5, Russia from 8 and
      China at 12. There no preset moves the verdict by more than a seed in eight.
      HOLDFAST never acts: its guns answer a breach and its gun run an assault on
      the post, and a probe makes neither. COUNTERBATTERY never calls a strike,
      and what it does in a probe is lay its claymore. Bar that one probe in 2,000,
      no preset changes how a probe ends, so there is nothing for funding first to
      fund.

      **What the measuring found instead was a bill.** A held probe bills 3% of the
      stockpile for every structure lost, capped at 10%, and it counted every
      structure the battle lost: the garrison's own mines going off, and the guns
      it bought with CP. A played siege never counted those, because field
      defences expire with the battle, and now a probe does not either. Before
      this, the two presets that lay mines made a held probe cost MORE than leaving
      no orders at all, 2.3% and 2.7% of an EARLY town's stockpile a probe, and 3.7%
      on one gun, for mines doing their job. `--probe-held` prints the old bill
      beside the new one; every structure those presets lost was their own.

      **What it hands on.** Rule order is not made the player's. `priority` stays
      in the type, inert and pinned by a test, with the instruments that priced
      it, as `fairShare` and `perWave` did. Standing orders now cost their upkeep
      and change no probe, so what they are FOR is the open question. Probes are
      easy on purpose, since Phase 4 made the live offer the contested battle, and
      a doctrine that cannot change an easy battle can only charge for it. Retire
      them, make them free, or give the probe something they can change: that is a
      design call, and it replaces rule order as the item M23 hands on.

## M24 — "The Settlement": from nine buildings to a base builder

Nine building kinds and nine research nodes in three linear tracks of three is
not a base-building game. Add **adjacency** (a fuel depot beside a motorpool cuts
training time), **districts** with identity, **production chains** instead of flat
accrual, **power and logistics as a constraint** so layout is an economic decision
and not only a maze decision, and **persistent battle damage** so a bad defence
costs a week of throughput.

- [x] **Phase 1 — an economy instrument (v1.49.2).** Where does a player's time and
      supply actually go? Nothing has ever pointed a harness at the town.

      **The plan, before the instrument.** `npm run balance -- --economy`, read off
      the real town functions (`caps`, `ratesPerMinute`, `tick`, `place`, `upgrade`,
      `startResearch`) rather than a model of them. STAGES has no player in it: a
      Command Center level with its whole allowance built, and what it makes, keeps
      and costs, beside what the battles pay. A PLAYED FORTNIGHT has one: a
      commander who checks in at a fixed cadence across sixteen waking hours and,
      in each ten-minute session, buys production, then storage, then intel, then
      the Command Center, then everything else, the cheapest first within a tier.
      Three things the survey said, for it to confirm or refute: storage fills in
      about half an hour where the GDD promises eight hours banked; the whole CC3
      town costs about two hours of its own production; and pay landed on top of
      the storage cap is cut back to it by the next frame's `tick`. All three held.

      **Storage holds half an hour.** Every stage, built out:

      | stage | makes a minute | stores | full from empty | an 8-hour absence keeps |
      |---|---|---|---|---|
      | CC1 | 80 supplies, 8 fuel | 2,000 S, 600 F | 25 min (S), 75 min (F) | 5% of the supplies, 16% of the fuel |
      | CC2 | 210 S, 28 F, 7 intel | 6,000 S, 1,750 F, 400 I | 29 / 63 / 57 min | 6%, 13% |
      | CC3 | 440 S, 66 F, 11 I | 14,600 S, 4,150 F, 660 I | 33 / 63 / 60 min | 7%, 13% |

      Eight hours of production is fourteen to nineteen times the supplies any
      stage can store, where the GDD promises "default 8h of production banked". An
      absence banks no more supplies after its first half hour and no more fuel
      after its first hour, and the eight-hour offline window never binds before
      storage does.

      **The whole town is a day's work.** In the played fortnight:

      | a session every | all bought (CC3, every piece at level 3) | all nine techs | supplies lost to a full store |
      |---|---|---|---|
      | 30 min | 4 h | 4 h | 99% |
      | 2 h | 12 h | 10 h | 99% |
      | 8 h (three a day) | 2.0 days | 1.7 days | 99% |
      | once a day | 6.0 days | 5.0 days | 33%, and 66% past the 8-hour window |

      By the end of the first day an engaged commander has bought everything the
      town sells: 49,000 supplies at a two-hour cadence, 32% of it on the military
      facilities, 29% on production, 12% on storage, 22% on guns and 6% on the
      Command Center. From then on nothing is left to buy, and 98% of everything
      the depots make over a fortnight is made after the last purchase. The one
      standing sink the instrument leaves out is the army, and it does not change
      the picture: CC3's manpower cap is 66, and a whole army of the dearest units
      costs about 4,000 supplies, nine minutes of CC3's production. Russia builds
      a little slower (fourteen hours at two-hourly sessions) and North Korea a
      little faster; the shape is the same for all five.

      **The battles pay minutes.** A siege held at level 8 is 1,450 supplies: 18
      minutes of CC1's production, 7 of CC2's, 3 of CC3's. (Corrected in Phase 2:
      1,450 is the bonus alone. A siege also pays for every wave it holds, which
      is more again, so the whole of it is 3,250: 41, 15 and 7 minutes. Still
      minutes.) A day of three orders
      is 8 minutes of CC2's, a tier-5 post razed to the ground 9. Once the town is
      bought, loot is a number on a screen, because there is nothing to spend it
      on.

      **And a full store kept none of it.** Raid loot, the day's orders and a
      season placement are paid on top of the storage cap, and `tick`'s own comment
      says that is where they should land. But the town screen ticks every frame,
      and `tick` set each stock to the lesser of the cap and the stock plus what
      was produced, so the next frame cut anything above the cap back to it. A CC3
      town paid a day's orders at its cap kept none of the 1,350 supplies. Fixed:
      production fills to the cap and no further, and what is above it stays until
      it is spent. (A siege's loot is still clamped to the cap on purpose, as it
      always was.) The town screen says FULL beside a full store, where it quoted
      a rate nothing was being added at.

      **What Phase 1 hands on.** The town economy has no sink past its first day,
      and production outruns storage by an order of magnitude at every stage. Phase
      2's adjacency and power would make layout an economic decision inside an
      economy that has nothing left to decide by the second day: a depot placed
      well would fill a full store faster. So whatever makes layout matter has to
      come with something that is still worth buying on day five, or with rates and
      caps that make a player choose, or it changes nothing a player feels.

      The gate: 23 of 24, with one batch flake in `e2e-drawer`, the silhouette
      dragged onto the map under load, which passed alone and three more times.
- [x] **Phase 2 — production in hours (v1.50.0).** Inserted ahead of adjacency and power,
      because Phase 1 said those change nothing a player feels until the numbers
      under them do. The owner took both halves of the recommendation: rates and
      caps that make a player choose, and lasting battle damage to give them
      repairs to spend on.

      **The plan, before the build.** Three parts.

      *One number, derived rather than picked.* Every production rate becomes a
      twentieth of what it was: the rate at which the storage the town already
      sells holds the eight hours the GDD promises. A built CC1 would fill its
      supplies in 8.3 hours, CC2 in 9.5, CC3 in 11, where they fill in 25, 29 and 33
      minutes now. Every storage bunker is needed to get there: at CC3 two of them
      hold 7.9 hours and the third takes it to 11. Costs, caps, loot, the day's
      orders and every battle stay exactly as they are, so nothing the balance
      harness has measured moves. The instrument, run in advance with the rates
      divided, puts the whole town at 2.7 days for a commander who checks in every
      two hours (12 hours now), 3.0 days at three sessions a day, and 9 at one; a
      siege held at level 8 pays an hour of CC3's production and six of CC1's,
      where it pays three and eighteen minutes.

      Rates are stated per hour, three times the old per-minute numbers: a
      twentieth of 40 a minute is 2 a minute, and "+240/h" reads where "+4/min"
      would not. Divided by 30 or 40, the town would last 4 or 5 days, but past a
      twentieth a full store holds more than the eight hours an absence accrues: at
      a thirtieth the second CC2 bunker and the third CC3 one would store nothing a
      player could fill, and at a fortieth a commander who plays once a day never
      finishes the town inside a season.

      *The damage that lasts is the wreck.* Before building lasting damage, what
      a battle actually leaves was measured: live sieges fought headless against
      the three reference defences at levels across their band, with the damage on
      every surviving gun priced as a share of its wreck repair. The survivors carry
      almost nothing out: 0-7 supplies of damage at EARLY, 0-52 at MID, 14-411 at
      LATE. The wrecks are the bill, up to 267 supplies at MID and about 1,400 at
      LATE, where a held siege at the contested levels loses most of its guns. Guns
      in this game come through a siege nearly whole or not at all.

      So lasting damage already exists, and it is cheap only because production is.
      Persisting partial damage on top of it is not built: it would be the smaller
      share, and it would need the in-battle repair repriced first. That repair
      charges 0.04 supplies an HP, about a tenth of what a wreck costs per HP. If
      damage lasted, repairing it at the start of any siege would cost almost
      nothing and the town's price would never be paid.

      What is built is the wreck bill in plain sight. The battle's banner says what
      it paid and what it broke, and the base tab repairs every wreck at once.

      *The instrument prices a defence.* `--economy` reads in hours, and gains WHAT A
      DEFENCE COSTS: each reference defence fought headless through its band, with
      what a hold pays, what its wrecks cost to repair, and what a loss costs, all in
      hours of that stage's production.

      **What it does not do.** Built out, CC3 makes about 32,000 supplies a day and
      only the war spends them: repairs, the army and ordnance. Something to buy
      after day three is what adjacency, power, chains and districts are for. This
      phase is what makes their prices mean anything.

      **The record.** All three parts held, and one of Phase 1's numbers did not.

      *Storage holds a night.* Built out, CC1 makes 240 supplies an hour and fills
      in 8.3 hours, CC2 makes 630 and fills in 9.5, and CC3 makes 1,320 and fills
      in 11.1. Fuel fills in 21-25 hours and intel in 19-20. An eight-hour absence
      keeps everything it made at every stage, where it kept 5-7% of the supplies.

      *The town takes three days.* In the played fortnight, all of it is bought in
      2.6 days at a session every half hour or every hour, 2.7 at two hours, 3.0 at
      four or eight, and 9.0 at one a day. All nine techs take 2.0-3.0 days, and 8
      at one a day. The other factions land within half a day of the USA: Russia
      takes 3.1 days at two-hourly sessions, North Korea 2.4.

      *The battles pay hours, and Phase 1 undercounted them.* Its WHAT THE BATTLES
      PAY read a siege's bonus and left out the pay for every wave held, which is
      more than the bonus: a siege held at level 8 pays 3,250 supplies, not 1,450.
      That was still minutes then, so the finding stood. Now it is 13.5 hours of
      CC1's production and 2.5 of CC3's. A level-15 hold pays 5,350, which is 4.1
      hours of CC3's. A day of three orders pays 1,630: 6.8 hours of CC1's, 1.2 of
      CC3's. A tier-5 post razed to the ground pays 1,975.

      *A siege pays several times what it breaks.* WHAT A DEFENCE COSTS, USA, 12
      seeds a level, on flat ground with nobody acting:

      | defence | holds every time / never | a hold pays (S+F) | its wrecks (S+F) | net, hours of the stage |
      |---|---|---|---|---|
      | EARLY (CC1) | level 2 / 4 | 1,875+180 at 3 | 36+0 | 7.7 |
      | MID (CC2) | 6 / 10 | 3,250-3,850 at 7-9 | 161-258 | 4.9-5.7 |
      | LATE (CC3) | 11 / 23 | 4,750-7,750 at 12-22 | about 1,200+250 | 2.7-4.9 |

      At LATE a held siege loses most of its guns, and the repairs are still a
      sixth to a quarter of what it pays. A loss at LATE pays for the waves it held
      (2,000-3,100), wrecks 1,230+252, and costs 15% of the store. Russia's repairs
      cost 1.6 times the USA's, because its concrete is dear to rebuild, and the
      UN's two thirds.

      *Partial damage, measured again on the instrument's flat ground,* is 5-9% of
      what a siege costs a defence to repair across its band, and 0-8% at the
      levels where it is contested. It is a real share only where LATE holds
      easily, at levels 3-9: a quarter to three quarters of a bill of 100-300
      supplies. So not building it holds.

      **What it hands on.** The fortnight has no battles in it, and at every cadence
      of more than one session a day it still makes 83-86% of its supplies after
      the last purchase. After day three only the war
      spends, and the war pays several times what it breaks. That surplus is what
      adjacency, power, chains and districts have to give a player something to
      buy with.

      The gate: 24 of 24, clean, on the first batch.
- [x] **Phase 3 — adjacency and power (v1.51.0).** Alone, these turn layout into two
      overlapping optimisation problems: the maze and the grid.

      **The plan, before the build.** Today a building does the same job wherever
      it stands, so layout is only a maze question. Two rules make it an economic
      one as well, and both work on the same cells the maze needs.

      *What the board has room for.* All buildings are one cell on the 10x15
      board. Behind the reference defences, and not counting the one cell the
      attack needs to reach the post, EARLY leaves plenty of room for CC1's five
      economy buildings. MID leaves about 25 cells for CC2's twelve. LATE leaves 22
      for CC3's sixteen. The allowance fits comfortably at CC1, easily at CC2 and
      only just at CC3, so the puzzle gets harder as the town grows. A player who
      lays more of the 60-segment wire allowance than LATE's 20 has less room
      behind it and pushes buildings forward into the maze.

      *Power.* A cell is powered if it is within 2 of the Command Center (5x5
      around the post), or within a working Generator's reach: 1 at level 1, 2 at
      level 2, 3 at level 3. Producers (the depots and the Signals Station) make
      half as much without power. Nothing else needs it: bunkers, facilities,
      the Engineering Bay, guns and walls work anywhere. The Generator is new: one
      cell, 0/1/2 allowed at CC1/CC2/CC3, 250 S + 60 F to build, and 600+150 and
      1,300+350 to upgrade. In a siege it is an obstacle and a target like any
      other building, so wrecking it darkens its whole reach until it is
      repaired. At CC1 the post alone powers everything the stage allows. Behind
      LATE the post reaches 10 usable cells, so two generators are what power
      the rest.

      *Adjacency.* Neighbours are the four cells sharing an edge. Each rule is one
      line on the building's card, and the ghost shows its effect while you aim:
      - A Supply or Fuel Depot makes 25% more for each Storage Bunker beside it, up
        to two.
      - The Signals Station makes 50% more intel beside a Generator.
      - A Barracks trains infantry for 25% less beside a Supply Depot.
      - A Motor Pool or Airfield trains for 25% less beside a Fuel Depot. This is
        the milestone's own example, made a price rather than a time, because
        training takes seconds and time is not what is scarce.
      - A wreck beside the Engineering Bay repairs for half.

      *What it leaves alone.* The battle. Nothing here changes a config, so no
      replay, harness row or balance table moves; the buildings were already
      obstacles and targets. And no rule switches anything off: the worst an
      existing town sees is half production from producers standing out of
      reach, which a generator or a free move fixes.

      *The instrument.* THE YARD in `--economy`. At each stage the reference
      defence stands, and the stage's economy allowance is laid behind it three
      ways: naively (nearest the post, the fortnight commander's rule), by a
      local search for the best yard, and at random, many times, every draw
      legal and leaving a way in. It reports output as a share of the unboosted
      rate, generators used, and cells left for the maze. The played fortnight is
      re-run with the naive yard and the best one. The best yard is also fought
      through the reference band, for what its buildings do to the maze and what
      it loses to wrecks on a hold.

      *The bar.* The best yard makes clearly more than the naive one at CC3 (a
      quarter more supplies or better), so layout is worth thinking about. It
      fits behind every reference defence without closing the way in, or the
      rules ask for more room than the board has. And it costs the defence
      nothing it measurably holds.

      *What it does not do.* A good yard finishes the town sooner and makes more
      after it, so the surplus Phase 2 handed on gets bigger, not smaller. The
      rules are about where things go, not about what the surplus is spent on.
      Phase 4 has to be the sink.

      **The record.** The yard does what the plan asked of it. The instrument also
      found something about the maze that matters more than the yard does.

      *Where things stand is worth about a third.* THE YARD, USA, on flat ground,
      each stage's whole economy laid out on its reference defence (output as a
      share of the rate before the yard, supplies/fuel/intel):

      | stage | cells behind the lines | pieces | nearest the post | random, median | best behind the lines | best anywhere |
      |---|---|---|---|---|---|---|
      | CC1 | 36 | 5 | 125 / 100 / — | 50% | 125 / 125 / — | 125 / 125 / — |
      | CC2 | 25 | 13 | 117 / 100 / 100 | 59% | 133 / 138 / 152 | 125 / 138 / 152 |
      | CC3 | 23 | 18 | 106 / 109 / 52 | 75% | 138 / 125 / 152 | 125 / 142 / 152 |

      At CC3 the best yard behind the lines makes 30% more supplies than the
      same buildings nearest the post, 15% more fuel, and three times the
      intel; nearest the post leaves the Signals Station out of reach. A random
      yard makes half to three quarters of the rate, because most of the board
      is unpowered. The search found as much behind the lines as anywhere, so
      the rules do not pay a player to leave the lines. Every stage's allowance
      fits behind its defence with a way in left open, at CC3 18 buildings in 23
      cells, and three of the four facilities stand beside their depot. The
      five factions come out the same, because the rules and the rates are
      shared.

      *The fortnight by placement.* A commander who puts each purchase on the
      cell that makes the most buys the whole town in 2.5 days at two-hourly
      sessions, against 3.0 for one who puts it nearest the post, and makes 23%
      more supplies over the fortnight (616,000 against 500,000). At one session
      a day it is 9 days against 10. Nearest the post is 3.0 days where v1.50 was
      2.7, because the generators add a tenth to the town's price.

      *The maze, and a blind spot.* Each best yard was fought through its
      defence's band with nobody acting, beside the defence alone and the
      economy nearest the post. The table gives held %, with the yard's own
      wrecks on a hold, in supplies:

      | USA | alone | nearest the post | best behind the lines | best anywhere |
      |---|---|---|---|---|
      | MID, level 8 | 67% | 42% (2,805) | 100% (1,470) | 83% (2,955) |
      | LATE, level 15 | 25% | 100% (7,960) | 92% (3,225) | 50% (7,740) |
      | LATE, level 19 | 8% | 100% (8,220) | 83% (3,225) | 0% |
      | LATE, level 20 | 0% | 100% (8,220) | 67% (3,225) | 8% (7,740) |

      For the three factions fought (USA, Russia, the UN), the best yard behind
      the lines never holds less than the defence alone at any level, usually
      holds more, and runs a third to a half of the repair bill of the economy
      nearest the post. The yard anywhere is worse on both counts. It pushes
      buildings forward into the maze, where they are wrecked on every hold
      and change which way the attack goes.

      The bigger number is the second column. Where the economy stands decides
      what the defence holds more than any rule in this phase does. Nearest the
      post it is erratic. At CC1 and CC2 it can break a defence that holds:
      Russia's MID goes from 92% to 0% at level 7, and the UN's from 100% to 17%
      at level 6. At CC3 it walls the post in and holds to the top of the band
      for all three factions, where the defence alone breaks, at 5,500-13,400
      supplies of wrecks a hold. Every contested band in `docs/BALANCE.md` is the
      permanent layer alone. A real town is not that, and nothing had measured
      how far apart the two are. That is the next balance question, not this
      phase's: the yard makes it no worse, and a good yard makes it steadier.

      **What it hands on.** Two things. The surplus Phase 2 handed on is bigger
      now, by about a fifth for a commander who lays out well, and Phase 4 is
      still the sink. And the reference defences need an economy on the board
      before the defence tables describe a town anyone plays.

      The gate: 24 of 24, clean, on the first batch.
- [x] **Phase 4 — chains and districts.** The tech tree becomes a graph rather
      than three ladders. *(4a shipped in v1.52.0; 4b, districts, set aside by
      the week at war in v1.52.1.)*

      **The plan, before the build.** Two things are handed on. Phases 2 and 3
      left a surplus that only the war spends: after day three a good CC3 yard
      makes about 41,000 supplies a day, and the war spends perhaps a third of
      that. And research is nine techs, 990 intel, finished by day two or three.
      Phase 4 is in two steps, and this step is 4a: chains, and the graph.

      *Chains: the surplus becomes what is short.* After the build-out, supplies
      are what piles up. Fuel runs short for a commander who raids in vehicles,
      and intel is what scouting and research both want. Two new buildings turn
      the one into the others. The **Refinery** makes fuel and the **Intel
      Bureau** makes intel, each out of the town's supply production:
      120/240/400 supplies an hour in, by level, for 16/34/60 fuel or 6/13/24
      intel out. A converter never draws on the stockpile. It diverts production,
      so on a full store it runs on what would have been thrown away, and it
      idles while the store it fills is full rather than burn supplies into it.
      Both need power, like the producers. One of each is allowed from CC2, and
      research unlocks them: the Refinery with Deep Stockpiles, the Bureau with
      Signals Intercepts. The LOGISTICS doctrine builds the works.

      *The graph: something worth the surplus.* The nine techs stay as they are.
      Six more go on top, a fourth and fifth tier for each branch, and each needs
      a tech from another branch as well as its own, so the tree stops being three
      ladders:
      - FORTIFY 4, *Layered Defence* (Rapid Entrenchment + Signals Intercepts):
        walls +15% more HP, weapons +8% more.
      - FORTIFY 5, *Kill Zones* (Layered Defence + Rapid Mobilization): weapons
        +10% more, CP a further 10% cheaper.
      - STRIKE 4, *Veteran Cadres* (Rapid Mobilization + Interlocking Fire): raid
        units +12% more HP.
      - STRIKE 5, *Deep Strike* (Veteran Cadres + Forward Logistics): raid units
        +12% more damage, and one more charge of each ordnance in stock.
      - LOGISTICS 4, *Field Engineering* (Forward Logistics + Interlocking Fire):
        wreck repairs 30% cheaper.
      - LOGISTICS 5, *Strategic Reserve* (Field Engineering + Marksmanship
        Doctrine): converters make 25% more from the same supplies, and storage
        +20% more.

      They cost intel, supplies and fuel, 400 intel and 6,000-8,000 supplies at
      tier 4 and 800 intel and 16,000-20,000 supplies at tier 5, and take 4 and
      10 hours to research. The battle multipliers stay in the config the way the
      nine always have, rounded to the thousandths a replay code carries, so a
      replay rebuilds them exactly.

      *The bar.* The graph is still being bought a week after the build-out for a
      commander who only builds (the fortnight has no war in it, so a
      commander at war takes longer). The supplies made with nothing to buy
      fall well below Phase 3's 83-86%. The full FORTIFY and STRIKE doctrines are
      measured in the harness beside the three-tier ones they extend, and a
      tier's worth of multiplier moves a band by about half a level, the way the
      first tiers do. A converter on a full store turns waste into intel or fuel,
      and one on a store that is filling costs exactly what it diverts.

      *4b, districts, comes after this is measured.* Phase 3's adjacency already
      pulls buildings into clusters, and CC3 now has 20 economy pieces for 23
      cells behind the lines. A third spatial rule has to earn that room, and
      what 4a leaves unspent is what it would be judged against.

      **The record, 4a (v1.52.0).** The works and the graph are built as planned,
      except for three things the instrument corrected, one lever the plan did not
      have, and a bar that is half met. What 4a found about the surplus is where
      4b has to start.

      *The top tier did not fit the stores.* The plan priced tier 5 at 800 intel
      and 16,000-20,000 supplies. A built-out CC3 town holds 660 intel (its one
      Signals Station at level 3) and 17,520 supplies with Deep Stockpiles, which
      every tier-5 tech needs on the way. The first fortnight bought the nine and
      the three tier-4 techs and never finished. Tier 5 now costs 600 intel and
      12,000-14,000 supplies. A test prices every tech against a built-out CC3
      town's stores, counting only the storage research its own prerequisites
      bring.

      *The works come with CC3, not CC2.* At CC2 the two works at level 2 take
      480 of the 630 supplies an hour a built town makes, 76%, while the town is
      still being bought. Their two cells also crowded the CC2 yard into the
      maze. With them in it, the best yard behind the lines held less than the
      defence alone at one MID level for all three factions fought: Russia 0%
      at level 9 against 50%, the UN 17% at level 8 against 42%, the USA 58%
      against 67%. At CC3 only, the MID yard is Phase 3's again (Russia 75%, the
      UN 83%, the USA 100% at those levels). At CC3 the yard takes 20 pieces in
      23 cells behind the lines. Its rates are unchanged, one fewer facility
      stands beside its depot (2 of 4), and it holds more than the defence alone
      at every level measured. At the top of the USA's band it holds less than
      Phase 3's yard did (58% at level 19 against 83%).

      *A lever: standing the works down.* At level 3 at CC3 the works take 61% of
      what the producers make, as long as their stores have room. On a full
      supply store that costs nothing, which is the case the plan was written
      for. On a filling one it is a price, and a commander saving supplies could
      only stop paying it by selling the works. Either one can be stood down
      from its card now, and set back to work. A stood-down works draws as a
      building not yet working. THE WORKS, in the economy report, puts them
      against the producers: at CC3 they add 30% to the fuel and 73% to the
      intel, and 38% and 91% with Strategic Reserve.

      *The graph is bought about three days after the build-out, not a week.* A
      PLAYED FORTNIGHT, USA (the five factions share the economy), the commander
      who builds nearest the post, as the report prints it:

      | every | all bought | the nine | the graph | made after the build-out | made with nothing to buy | lost to a full store | converted |
      |---|---|---|---|---|---|---|---|
      | 30 min | 3.0 d | 2.0 d | 5.5 d | 82% | 66% | 62% | 9% |
      | 2 h | 3.0 d | 2.1 d | 5.6 d | 83% | 66% | 61% | 11% |
      | 8 h | 3.3 d | 3.0 d | 6.3 d | 82% | 63% | 63% | 8% |
      | 24 h | 10.0 d | 8.0 d | never | 30% | 0% | 3% | 6% |

      "Made after the build-out" is how Phase 3 read "made with nothing to buy"
      (83-86%). The new column counts the graph as something to buy. A commander
      who builds for the yard is a little ahead: the graph on day 5.0-6.0, and
      66-71% made with nothing to buy, out of a fifth more.

      The bar asked for the graph to still be being bought a week after the
      build-out, and for "made with nothing to buy" to fall well below 83-86%.
      It falls to 63-66%: below, not well below. The graph is done 2.5-3 days
      after the build-out. What paces it is the research timers. The stores
      bound the prices, one Signals Station bounds the intel, and that leaves
      time as the only lever, so stretching it was measured. For the commander
      who builds for the yard, tier 4 at 12 hours and tier 5 at 42 put the graph
      on day 10-11, a week after the build-out, with 37-44% made with nothing to
      buy. It was not shipped. GDD 2.3 keeps
      timers to hours, and a research timer measured in days is the lever a
      game without a shop has no reason to pull. The plan's four and ten hours
      stand: an afternoon and a night.

      *The works run on what research spends, and here research is all that
      spends.* With no war in the fortnight, the fuel and intel stores fill and
      the works idle. So they convert 8-11% of the supplies the town makes,
      55,000 over the fortnight at two-hourly sessions for 5,000 fuel and 1,500
      intel, and 61-63% is still lost to a full store. The graph is now the
      biggest thing the town buys, 62,000 of the 122,000 supplies spent, and
      that is still an eighth of what the town makes. It is the war that spends
      fuel and intel, and the fortnight has none.

      *In battle the top tiers move about as far as the first.* THE GRAPH IN
      BATTLE (`npm run balance -- --graph`), with the multipliers read from the
      techs as shipped. Defence is the levels of L1-L20 each reference defence
      holds (a level held half the time counts a half), meaned over the three.
      Raids are the tiers of T1-T5 the reference force clears:

      | | defence, tiers 1-3 | defence, tiers 4-5 on top | raid, tiers 1-3 and the fire plan | raid, tiers 4-5 on top |
      |---|---|---|---|---|
      | USA | +0.77 | +0.85 | +0.72 | +0.51 |
      | China | +0.90 | +0.90 | +0.41 | +0.32 |
      | Russia | +0.77 | +0.40 | +0.43 | +0.14 |
      | KPA | +0.60 | +0.75 | +0.32 | +0.09 |
      | UN | +0.73 | +1.52 | +0.94 | +0.53 |

      FORTIFY's top two tiers move a defence about as far as the three below
      them, +0.88 levels on average against +0.75: about half a level a tier.
      STRIKE's move a raid less than the first three with their fire plan, and
      least where the force already clears T4 (Russia, the KPA). The raid table
      stops at T5, so the more a force clears, the less a multiplier can show.
      The first version of this table read where each row crossed 50%, and
      was dropped: the late defence's hold curve is not monotone past L10. Deep
      Strike's extra charge is not in the table. A third call inside one raid
      moved nothing, because a raid that clears is over in about a minute,
      before either power is off cooldown. The charge is one more raid's fire
      plan between restocks.

      **What it hands on.** 4b, districts, was to be judged against what 4a
      leaves unspent. In a fortnight without a war that is most of it: 61-63% of
      what a town makes is lost to a full store. Neither the graph nor the works
      can touch that, because nothing in the fortnight spends fuel or intel but
      research. The war is what spends them, and the war is the one thing the
      economy instrument does not have, as the economy was the one thing the
      battle harness did not have (Phase 3). A fortnight at war comes before 4b,
      or 4b is judged against a town nobody plays.

      The gate: 23 of 24 on the first batch. `e2e-drawer` failed and passed
      alone, and the failure was this phase's. It lands a finger on a coasting
      build list at four spots and needs one of them to be a row that can be
      pressed, and the two research-locked works lengthened the run of locked
      rows past that spread. It lands at six spots now, and the second batch
      was 24 of 24.

      **A week at war, before 4b (the plan).** Every economy reading so far has
      had a commander who never fights. What 4b would be judged against depends
      on whether the war spends the surplus, so that is measured first, as an
      instrument, with no change to the game.

      *The town.* The stage where the surplus is: CC3, built out, the LATE
      reference defence standing and the economy laid out behind the lines by
      the yard search, on the ground the game itself would fit under that
      layout (`fitTerrainSeed`). The nine techs are done and the graph is not,
      the stores start full, and the faction's harness raid force stands
      trained.

      *The commander.* A week of ten-minute sessions at a fixed cadence from
      07:00 to 23:00, everything through the real functions:
      - the probes an absence owes (`runOfflineProbes`), and the defence the
        last one offers, fought with nobody acting;
      - a counterattack when one is owed, fought the same way;
      - a raid a session on the Front Line with the harness's force for the
        faction: the rung's three targets in turn, each scouted the first time,
        the research multipliers, today's conditions, the ladder's payout, and
        the harness's fire plan (an A-10 on the guns at 15 seconds, a barrage
        on the post at 40); the losses retrained at once, and the charges
        restocked to the cap;
      - every wreck repaired and every wall that fell rebuilt before the
        session ends, and the graph bought as the builder buys it.

      A second row adds a skirmish a session at the town's assault level,
      fought with nobody acting, climbing when it holds.

      *The books.* Production, what the works convert and what a full store
      loses, as the fortnight books them, and every action's net effect on the
      three stores. So the war's income (loot, bounties, the day's orders,
      placements) and its costs (training, charges, repairs, walls, scouting,
      probes, defeats) are each a line.

      *The rule.* If a full store loses under a quarter of what the town makes
      at war, the war is the sink and M24 closes without districts: a third
      layout rule would be solving a problem the war already solves. If it
      loses nearly as much as without the war (61-63%), districts are judged
      against this table and not the peaceful one, beside M25's supply and
      attrition as the other place a sink could come from.

      **The record: a week at war (v1.52.1).** The war does not spend the
      surplus. On the way, the instrument found two ways a siege was destroying
      stockpile that nothing meant it to, and both are fixed.

      *Two siege bugs.* Every battle result ends by clamping the stores to the
      storage cap. That clamp exists so a siege's pay cannot lift a store past
      the cap, and it did two more things. It read the caps the town was left
      with, after the battle's wrecks, so a bunker or Signals Station wrecked
      in a siege took everything it was holding with it, in a siege the town
      won as much as one it lost, and nothing said so. At war, for the USA
      with the skirmish ladder, that burned 28,000 supplies, 8,300 fuel and
      4,900 intel in the week: 58% of the intel the town made. And it cut back
      whatever already stood above the cap, raid loot and the day's orders
      included, which the 2026-09-24 decision says stay until spent. The
      clamp now reads the caps the battle began with, and never takes a store
      below what it held going in. A defeat still takes its 15%.

      *The war pays for itself.* A WEEK AT WAR (`npm run balance -- --war`),
      supplies lost to a full store and the war's net a day (every action but
      research), at two- and eight-hourly sessions:

      | | peace | raids | raids and skirmishes |
      |---|---|---|---|
      | USA, 2 h | 70% | 72%, +2,558 | 53%, −3,475 |
      | USA, 8 h | 70% | 75%, +4,056 | 56%, −3,995 |
      | China, 2 h | 70% | 68%, +2,197 | 59%, −1,113 |
      | China, 8 h | 70% | 58%, −4,284 | 44%, −8,789 |
      | Russia, 2 h | 70% | 73%, +4,070 | 54%, −2,919 |
      | Russia, 8 h | 70% | 75%, +3,577 | 47%, −7,229 |
      | KPA, 2 h | 70% | 68%, +83 | 59%, −2,423 |
      | KPA, 8 h | 70% | 65%, −1,438 | 56%, −4,480 |
      | UN, 2 h | 70% | 70%, +1,442 | 60%, −1,197 |
      | UN, 8 h | 70% | 67%, −814 | 57%, −4,184 |

      Where it goes, with raids and skirmishes every two hours: raids bring in
      6,500-16,000 supplies a day, and their losses cost 3,000-7,300 to
      retrain, so a raid pays for itself and then some. Skirmishes pay
      3,600-8,800 net of their defeats, and counterattacks 1,800-2,900. What
      the war spends is repairs: 12,000-22,000 supplies a day, and 2,300-4,000
      fuel. Scouting and research are all that spend intel, and a full store
      still loses two thirds of it. At one session a day, 63% of what the town
      makes is lost past the eight-hour cap before a store is even full, and
      the war changes little.

      *The rule.* A full store losing under a quarter at war would have made
      the war the sink. The fullest commander measured, raiding every session
      and climbing the skirmish ladder until a defeat, still loses 44-60%,
      against 70% in peace. So the war is not the sink, and districts would not
      be one either: a third layout rule changes what the buildings make, not
      what the town spends. 4b is set aside. The sink belongs to M25, whose
      supply and attrition is a cost of holding ground that grows with what a
      commander tries to hold, and this table is what it is judged against.

      *Where it departs from the plan.* A third commander, who never fights,
      plays the same town and week, so the peace row is read directly rather
      than borrowed from the fortnight. The skirmish commander stops for the
      day after a defeat: the first run fought its frontier every session,
      lost three in four, and repaired the town 44,800 supplies a day, which no
      player does. And the wrecks are repaired after every siege rather than at
      the session's end, because the first run retrained its losses before
      repairing, and a wrecked barracks trains nothing.

      The gate: 23 of 24 on the first batch. `e2e-drawer` failed again and
      passed alone, the same failure v1.52.0 treated with six landing spots:
      under load, the four locked rows the works now make in the build list
      could cover every landing one coast offered. Reproduced one run in four
      under load. Each attempt now changes its flick as well as its landing,
      up to ten, and it passed eight of eight under the same load and 24 of
      24 in the second batch.

## M25 — "The Theater": give the war a map

"Front line, tier 3" is an abstraction with no geography. Replace it with a
territorial campaign map: nodes held and lost, supply lines that can be cut, an
enemy running its own offensives while the player is away, fronts that move. This
is what turns "grind the ladder" into "there is a war on and I am losing the
north", and it is where an endgame can live.

- [x] **Phase 1 — the map as pure data over the existing ladder.** Tiers become
      distance from the front. No new sim. *(v1.53.0)*

      **The plan, before the build.** Today the Front Line is one number. The
      town holds a rung (`frontline.tier`), three posts are dealt for it, one
      per difficulty band (slot 0 the heavy fight, slot 2 the one most
      commanders take), and any three wins move the rung. Nothing about it is a
      place. Phase 1 gives it one, and changes nothing else.

      *A theater per faction, on real ground.* Each faction's war runs from its
      own base, which is already a real place, toward the enemy's stronghold
      along a real road. The five fit together: the USA pushes north up
      Highway 101 from Coos Bay to the PLA beachhead at Grays Harbor, which is
      China's base, and China pushes east from it toward Joint Base
      Lewis-McChord. Russia follows the Iditarod out of Nome and the Yukon
      toward Fairbanks, the KPA comes down the Redwood Coast from Humboldt Bay
      toward Santa Rosa, and the UN drives west from Tacoma to the same
      beachhead the USA is driving on. A theater is twelve named towns and
      the stronghold, a thirteenth column.

      *Tiers become distance from the front.* A column's depth is the tier:
      the first town past the base is tier 1, the stronghold tier 13, and a
      ladder that runs past it goes on as the stronghold's rear. Each column is
      three sectors, one per lane, and each lane is one of the deal's bands,
      so a theater's lanes have characters: the Oregon coast's heavy fight is
      always on Highway 101, and its soft one in the Coast Range. The posts are
      the ones the ladder already deals (`targetFor(town, variant)`, with the
      lane's slot as the variant), so no battle changes and no replay moves.

      *The rule stays the ladder's.* Any three wins at the front take the
      column, as any three wins took the rung, repeats allowed. The map is
      derived from `frontline.tier` and `wins` and adds nothing to the save:
      columns behind the front are held, the front column is contested with
      its three pushes shown, and the rest is enemy ground. Which sectors a
      commander holds only needs to be state once something can take one back,
      and that is Phase 2.

      *What the player sees.* A THEATER map: the lanes running up the page
      from the base toward the stronghold, the columns around the front with
      their towns named, held ground inked and enemy ground in tone, and the
      three front posts beneath it, each with its lane, town, band and shape,
      and a button that opens the raid planner on it. The Front Line row and
      the planner name the front's town beside the tier, and the planner's
      target row names its lane.

      *The bar.* Every raid target, config and replay is what it was: a sector
      resolves to the same `generateBase` call the ladder made. Old saves need
      nothing, since nothing is stored. The map reads on a phone at portrait
      width and on a desktop. The e2e harnesses that find rows by FRONT LINE
      and TARGET still find them.

      **The record (v1.53.0).** Built as planned, and the bar is met: the 678
      unit tests (eight of them new) pass, and so do the 24 e2e harnesses,
      none of which needed a change.

      *Where it lives.* The five theaters are data in `content/theaters.ts`:
      a home, twelve towns, a stronghold and three named lanes, each lane
      holding one of the deal's slots. `meta/theater.ts` derives the map from
      the rung and its wins, two columns behind the front and three ahead, and
      `sectorOf(town, variant)` puts a dealt post in its town and lane. It
      resolves the post through `targetFor`, so a sector's post is the
      ladder's by construction, and a test holds the two to the same base for
      every faction and slot. No file under `src/sim` changed, nor the bases,
      nor the deal, and the save gained nothing.

      *What the player sees.* The WAR tab's Front Line row reads FRONT LINE —
      LINCOLN CITY (T5), and a THEATER row under it, or G, opens the map. The
      lanes run up the page toward the stronghold. Held ground is in tone,
      enemy ground is in thin ink, and the front is outlined with each
      sector's shape written in it (CMPD, BUNKER, CAMP). The red line under it
      carries three marks for the pushes. Beneath the map are the three front
      posts, lane and town, band and shape, and SCOUTED where the town has
      paid for the layout. Choosing one opens the planner aimed at that post.
      The planner has a THEATER MAP row of its own, which re-aims it, and its
      target row names the lane: TARGET 3/3 · THE COAST RANGE. A demo board
      can open the map but not raid from it, and while a counterattack is owed
      its posts cannot be chosen, just as the Front Line row cannot start a
      raid then. It was read at 412 px portrait (the USA and the KPA) and at
      1440 px (the USA and the UN).

      *One line in the raid report changed its words.* It said "Front Line:
      2/3 to next tier". It now says "2/3 to take LINCOLN CITY", and a third
      win says LINCOLN CITY TAKEN · the front moves to TILLAMOOK.

      *What it hands on.* The map is a function of the rung, and Phase 2 is
      where it stops being one. Enemy agency means a sector can be lost behind
      the front, so held ground has to become state: `theaterView` is the seam,
      and it becomes a read of stored columns. The lanes have characters only
      through the bands the deal already had. Giving a lane its own ground (a
      beach lane's posts on sand) would move battles, so it waits for the
      harness. And the ladder runs past the stronghold as its rear, a name
      that holds until Phase 4 decides what reaching it means.
- [x] **Phase 2 — enemy agency.** An AI that takes territory back offline, so the
      map moves without the player. *(v1.54.0)*

      **The plan, before the build.** Phase 1 drew the Front Line as ground
      and read all of it off the rung. Phase 2 lets the enemy take some of it
      back, so held ground becomes state.

      *What the survey found.* The enemy already does three things while the
      player is away, and none of them can carry this. Offline probes hit the
      town, but a probe is two waves with the defender's economy switched
      off, which GDD 5.7 calls unloseable for a built town: ground tied to a
      breached probe would move for a weak town and never for a strong one.
      Counterattacks follow the player's own wins, and wait for the player to
      fight them. Standing decay is the one that fits. Thirty-six hours after
      the last thing done on the Front Line, the board starts forgetting the
      commander, a fixed amount a day, because sitting behind a garrison is
      not playing. The week at war says who that reaches: a commander raiding
      every two or eight hours climbs from the first rung to the sixth in a
      week, and one who raids once a day reaches the third.

      *The enemy strikes back when the front goes quiet.* On decay's clock:
      36 hours after the last raid, counterattack or defence fought in
      person, the enemy retakes one sector, and a day later a second. Two is
      the most one quiet spell costs, and any of those actions starts the
      clock again. A commander who raids every day never loses ground.

      *Where it strikes.* Always the town directly behind the front, the last
      one taken, and it goes for the roads. It takes the sector of a lane
      that still reaches the front, down its main road first (the heavy lane,
      then the middle, then the light), and only when every road is cut does
      it take what is left of that town. At the first rung there is nothing
      behind the front but the base, and the base is never taken.

      *What a lost sector does.* It cuts its lane: the front post in that lane
      cannot be raided until the sector is retaken. Any three wins still take
      the front's town, through whichever lanes are open. When all three
      sectors of the town behind the front are lost, the front falls back to
      it: the rung goes down one and its pushes start again from none. Since
      one quiet spell takes at most two, one absence can never push the front
      back from a town that was whole; it takes a second quiet spell with the
      first losses left standing.

      *Retaking.* A lost sector is a target, and its post is the one the
      ladder dealt at that tier and lane: the same base, and scouted if it
      was scouted then. A raid that takes it retakes the sector, and reopens
      the lane if nothing else cuts it. It pays loot and standing like taking
      a post at that tier, it counts toward counterattacks like any post, and
      it moves no pushes at the front.

      *What is stored.* Two optional fields on the Front Line: the lost
      sectors (tier, lane, and when), and how far the enemy's clock has been
      charged. A file from before has lost nothing, and its clock starts at
      the load that upgrades it, so no absence before the update is charged.

      *What the player sees.* The map marks the lost sectors and the roads
      they cut, and says how long the front has been quiet and when the enemy
      strikes. Under it, a front post in a cut lane says where its road is
      cut, and each lost sector has a RETAKE button that opens the planner on
      it. The planner's targets are the open front posts, then the retakes.
      Coming back, a banner says what the enemy retook and whether the front
      fell back.

      *The bar.* A commander who raids daily loses nothing. The week at war,
      run at one, two, three and seven days between sessions, with the enemy
      striking and without, measures ground lost and retaken and the rung
      reached. The enemy should slow a commander who is away for days and
      never undo more than one quiet spell's worth at a time. No battle
      changes, since every post is one the ladder already deals. Old saves
      load, and the e2e harnesses pass unchanged.

      **The record (v1.54.0).** Built as planned. The measurement kept every
      number, and it found what the strikes cost and who pays.

      *Where it lives.* The rules are `meta/strikes.ts`, pure and on an
      explicit clock like the decay. `tick()` charges the enemy's clock
      through the ladder's settlement, which now reports the strikes that
      landed. So does anything that ends a quiet spell, before it ends it, so
      a strike already due is never forgotten, and a raid lands what its
      planning owed before it moves the front. A raid on a lost sector's post
      retakes it: `applyRaidResult` reads the base's tier and slot, and a
      post the ground moved out from under pays like any post and moves
      nothing. Scouting a sector to retake is priced at its own tier. Twenty-
      one new tests cover the clock, the targeting, the fall-back, retaking,
      the map and the save.

      *What the player sees.* THE FRONT WENT QUIET — THE PLA RETOOK HIGHWAY
      101 AT NEWPORT, CUTTING ITS ROAD, on the town screen, or THE FRONT FELL
      BACK when it did. The THEATER row counts what is lost, or warns of a
      strike due within 12 hours. The map strikes lost sectors out in red and
      breaks their roads, writes CUT on the front posts they cut off, and
      says how long the front has been quiet and when the enemy strikes. A
      front post in a cut lane says where its road is cut, and each loss has
      a RETAKE button. The planner's targets are the open front posts, then
      the retakes (TARGET 3/3 · RETAKE THE COAST RANGE AT YACHATS), and it
      re-aims itself when the map moves under it. Its report says what a
      retake did: THE BEACHES AT NEWPORT RETAKEN, and whether the road is
      open. Read at 412 px portrait and 1440 px.

      *The measurement.* The week at war now plays any rhythm: a session
      every so many days, up to three raids in one, with a commander who
      pushes (retakes only when no road reaches the front) or holds (retakes
      everything first), and the enemy's clock running or stopped. Its own
      table did not move by a number. THE ENEMY STRIKES BACK (`npm run balance
      -- --front`): the same CC3 town raiding for four weeks, up to three
      raids a session at the easiest open post, and the rung it ends on with
      no strikes, then with them, pushing / holding:

      | every | USA | China | Russia | KPA | UN |
      |---|---|---|---|---|---|
      | day | 9: 9 / 9 | 11: 11 / 11 | 6: 6 / 6 | 8: 8 / 8 | 8: 8 / 6 |
      | 2 days | 8: 6 / 6 | 7: 6 / 6 | 6: 6 / 6 | 6: 6 / 5 | 6: 6 / 6 |
      | 3 days | 6: 3 / 5 | 6: 3 / 5 | 6: 3 / 5 | 6: 3 / 4 | 6: 3 / 4 |
      | 7 days | 5: 3 / 3 | 5: 3 / 3 | 5: 3 / 3 | 4: 3 / 3 | 4: 2 / 3 |

      A commander who raids every day loses nothing, but for the UN, whose
      force is not always retrained by the next day: a day without a raid can
      make 36 quiet hours, and it lost one sector in four weeks pushing and
      three holding. Every other day, about one raid in three goes to
      retaking, and it costs up to two rungs a month (the USA), or nothing
      (Russia, the UN). The retakes are easier posts than the front's and pay
      like them.
      Every three days or weekly it costs one to three rungs. The front falls
      back only for a commander who leaves losses standing: pushing at a
      three-day rhythm, it fell back four times in four weeks for every
      faction; holding, it never did, but once for the KPA, whose force was
      not always ready to retake everything.

      *One experiment, not taken.* The enemy strikes the heavy lane first.
      For the USA, striking the light one first, the road most commanders
      use, ends every run on the same rung: what the strikes cost is how many
      land, not where. So the order stays the one the map can explain, down
      the enemy's main road.

      *The gate.* 699 unit tests, 21 of them new, and the 24 e2e harnesses,
      none of which needed a change. A retake was also launched through the
      planner in the browser: a small force stalled at CHARGE and left the
      sector lost, and the whole yard took it back, reported THE COAST RANGE AT
      FLORENCE RETAKEN · its road to the front is open, paid standing as a
      tier-2 post and left the pushes at the front where they were.

      *What it hands on.* Holding ground now takes playing, and costs a
      commander who is away a raid in three. Phase 3 is where holding ground
      costs supplies, and it will read against the same table: a cost that
      grows with what a commander holds is one a daily commander pays too.
- [x] **Phase 3 — supply and attrition.** Holding ground costs; overextending
      punishes. *(v1.55.0)*

      **The plan, before the build.** Two things are handed on. M24 left a
      surplus: a built CC3 town makes about 46,000 supplies a day, and even a
      commander at war every session loses 44-60% of it to a full store,
      against 70% in peace. Its record said the sink belongs here, as a cost
      of holding ground that grows with what a commander holds. And Phase 2
      made held ground state: towns behind the front are held a sector at a
      time, and the enemy can take one back.

      *What the survey found.* Production is a rate the depots make and the
      stores bank, capped at eight hours offline. The works already divert
      supplies from production, never from the stockpile, and slow down
      rather than overdraw it. Built out, CC1 makes 240 supplies an hour, CC2
      630 and CC3 1,320, about 1,900 with the yard and the research. The
      Front Line opens at mission 5 with CC2 on the table, and CC3 comes with
      mission 7. The week at war's commander reaches the sixth rung in a week
      and the ninth to eleventh in four.

      *Holding ground costs supplies.* Every sector held behind the front
      takes supplies an hour from what the depots make: five for each rung of
      its town's distance from home, so a whole town at the fifth rung takes
      75 an hour and the line to a front at the sixth rung takes 225. The
      front itself costs nothing until it is taken, and a lost sector costs
      nothing, since the enemy is feeding it. The line is fed before the
      works take their share and never from the stockpile, as the works are.
      A line grows with the square of its depth, so a front as deep as a town
      can feed is: CC1's at the sixth rung, CC2's at the ninth, and CC3's at
      the thirteenth, the enemy's stronghold, or the sixteenth with the yard
      and the research. On a full store most of it is what would have been
      lost: the sink, where M24 left one.

      *Overextending punishes.* When the depots make less than the line takes,
      the front is short, and it goes hungry at the share it is short by:
      fully unfed, the enemy retakes a sector a day, and half fed, one every
      two days. It strikes as Phase 2's enemy does, at the town behind the
      front, cutting roads first and taking the whole town only when every
      road is cut, when the front falls back to it. Each loss lightens the
      line, so an overextended front shrinks to what the town can feed. A
      front fed again forgets its hunger, so a depot wrecked in a siege and
      repaired inside a day costs nothing.

      *What is stored.* Two optional fields on the Front Line, the hunger and
      how far its clock has been charged, which start at the load that
      upgrades a file.

      *What the player sees.* The map shows the line: what it takes an hour
      against what the depots make, and each held town's share. When it is
      short it says so, and how soon the front loses ground. The status strip
      shows the supplies rate after the line, and the line's draw beside it.
      A works card that is short says whether the front took the difference.
      A hungry front's loss is bannered like a quiet one's, and the THEATER
      row says SHORT.

      *The bar.* The week at war, rerun with the line fed: supplies lost to a
      full store should fall for a deep front and hardly move at the first
      rungs. A week begun from a front eight rungs deep measures the sink
      where it is meant to work. The Phase 2 table, rerun, shows no built
      town short at the depths it reaches. No battle changes. Old saves load
      and the e2e harnesses pass unchanged.

      **The record (v1.55.0).** Built as planned, at five supplies a rung, and
      the bar is met.

      *Where it lives.* `meta/supply.ts` prices the line and charges the
      hunger, pure and on an explicit clock like the strikes. The accrual,
      the supplies rate and the works' cards all feed the line first and
      give the works what is left, and the accrual books what the line took.
      `tick()` charges the hunger through the whole absence, not the eight-
      hour window: the line is a rate, and it runs whether or not anyone is
      banking the rest. A hungry front's loss is a strike like a quiet
      front's, tagged with its cause, and the town banners it as THE FRONT
      WENT SHORT OF SUPPLY. Fourteen new tests.

      *What the player sees.* Each held town on the map says what it takes
      an hour to hold, under its name, and a line under the map says what
      the whole line takes of what the depots make, or, in red, that the
      front is short and when it loses ground. The status strip reads
      SUPPLIES 600/2000 (+270/h · FRONT −225). The THEATER row says SHORT,
      and a works card that is short says whether the front took the
      difference. Read at 412 px portrait and 1440 px.

      *The measurement.* THE SUPPLY LINE (`npm run balance -- --supply`): the
      week at war's commanders for a week, from the first rung as the week at
      war starts and from the eighth, a month or so into a war. What the line
      took of production, and what a full store still lost, at two-hourly
      sessions:

      | | line, from 1st | full store lost | line, from 8th | full store lost |
      |---|---|---|---|---|
      | peace | 0% | 70% | 20% | 50% |
      | raids | 10-14% | 57-63% | 22-36% | 38-47% |
      | raids and skirmishes | 10-14% | 40-52% | 22-36% | 24-39% |

      Before this phase the week at war's raids lost 58-75% at two- and
      eight-hourly sessions, and with skirmishes 44-60%. Every faction reads
      within these ranges.
      Eight-hourly the line takes 4-6% from the first rung and 20-25% from
      the eighth. Once a day it takes at most 8%, because a day's absence
      only accrues eight hours of what the depots make and the line is fed
      out of those. No line went short in any run, and THE ENEMY STRIKES
      BACK, rerun for four weeks, did not move by a number: a built CC3
      town feeds a front sixteen rungs deep, and no commander the instrument
      plays gets past the eleventh.

      *What the numbers mean.* The line is the sink M24 left, and it grows
      as planned: a tenth of what the depots make while the front is young,
      a fifth or more at the eighth rung, over half past the twelfth. The
      hunger is a guardrail rather than a pace: it binds a town that is not
      built for its front (CC1 past the sixth rung, CC2 past the ninth, CC3
      without its yard past the thirteenth), and a front shrinks to what
      its depots can feed.

      *The gate.* 713 unit tests, and the 24 e2e harnesses, none of which
      needed a change.

      *What it hands on.* Phase 4 is the endgame, and the line has already
      put the enemy's stronghold at the thirteenth rung where a CC3 town
      without its yard runs out of supply: reaching the capital asks for the
      whole economy.
- [x] **Phase 4 — the endgame.** The front reaches their capital, or yours.
      *(4a shipped in v1.56.0, 4b in v1.57.0, 4c in v1.58.0.)*

      **The plan, before the build.** Three phases made the Front Line a road
      with a far end, and nothing happens at the far end yet. The stronghold
      at the thirteenth rung is taken like any town, the map calls what lies
      past it the stronghold's rear, and the enemy can push the front back
      to the first town and no further. This phase decides what reaching the
      enemy's capital means, and what the enemy reaching yours means. Four of
      its choices were the commander's, asked before the plan: the war goes
      on after it is won, the enemy can reach your capital but not end the
      war there, the capital is taken by its three roads and then a citadel,
      and the deep rungs are smoothed first.

      *What the survey found.* The capital is reachable, but only just, and
      the climb to it was never tuned. Past rung 5 the deal is rung 5's
      pairs with the layouts moved on, guns stop growing at rung 10 and
      levels at rung 7, and loot and standing keep rising. THE DEEP LADDER
      (`npm run balance -- --deep`), the manpower a force of each faction's
      reference shape needs to take a rung half the time, against the 66 a
      built CC3 town can field (two barracks, a motor pool and an airfield
      at level 3; research adds none):

      | | T5 | T7 | T9 | T11 | T13 |
      |---|---|---|---|---|---|
      | USA | 25 | 47 | 64 | 53 | 64 |
      | China | 28 | 38 | 42 | 48 | 54 |
      | Russia | 27 | 38 | 59 | 54 | 48 |
      | KPA | 25 | 34 | 60 | 60 | 54 |
      | UN | 28 | 48 | over 66 | 60 | 54 |

      The reference forces are 25-27 men, which is what rung 5 was tuned
      for. The ninth rung is a spike that the UN cannot field enough to
      pass, and the curve goes down as often as up. Played daily for ten
      weeks with the reference force, the war instrument's USA stalls at the
      ninth rung and Russia's at the sixth, and of those three only China
      reaches the stronghold, in about six weeks. So the phase is three
      steps, each shipped on its own.

      *4a, the approach: the deep rungs, tuned.* Rows for rungs 6 to 13 are
      selected by the same search that chose rungs 1 to 5: three (shape,
      layout) pairs a rung, one per band, fifteen points apart, distinct
      shapes, with the nudge toward shapes the faction has not met. It
      measures them against a force that grows with the rung, which rungs 1
      to 5 never needed: the reference shape resized to a budget that climbs
      four men a rung from the reference's 26 at rung 5 to 58 at rung 13, and
      each rung's middle post chosen to clear 55% at its budget. A commander
      who grows the army four men a rung keeps rung 5's odds all the way up.
      Past the stronghold, the rear keeps rung 13's pairs with the layouts
      moving on, as today. The bar: THE DEEP LADDER climbs for every faction
      with no rung above what a built town fields, rungs 1 to 5 do not move,
      and the war instrument's commander, growing its force by the same
      curve, reaches the stronghold.

      *4b, the capital, and a war won.* The stronghold is not taken by any
      three wins. Each of its three roads has to fall once (a second win in
      a lane already taken pays, and counts for nothing more), and then the
      citadel comes into range: the enemy's headquarters, a fourth target
      and a new shape dealt nowhere else, two rings and positions dug a
      level deeper around the largest post on the board and the richest
      stores. It is tuned so the whole army can take it: about 62 of the 66
      men a built town fields, clearing about half the time. Taking it wins
      the war. The war is marked won on a victory screen, on the service
      record and in the war menu (1 · UNITED STATES · WON DAY 43), and it
      pays like the top band's season placement. Nothing resets. The front
      moves into the enemy's rear, and the ladder goes on for loot and
      standing until the supply line cannot feed it, the sixteenth rung for
      a built CC3 town. A fall-back from the stronghold loses its roads, as
      any fall-back loses its pushes. What is stored: the roads taken, and
      when the war was won.

      *4c, or yours: the last stand.* When a strike lands on a front already
      at the first town, with nothing behind it but the base, in a war whose
      front has been deeper, the enemy marches on your capital. It is
      announced like the live-defence offer and answered the same two ways:
      stand and fight it with the town's siege economy, or leave it to the
      garrison, which fights the whole assault rather than a probe's two
      waves, and can lose. Held, the enemy is thrown back, with a bounty and
      standing. Lost, the capital is sacked: every building that fell is
      wrecked, as in any played siege, a larger share of the stockpile than
      a defeat's goes with it, and standing, and the service record says
      SACKED. The war goes on from the first town. Its level is measured to
      land where the commander's play decides it, as the offer's was. It
      takes long neglect to get there: from the sixth rung, fifteen sectors
      lost and one strike more, eight quiet spells with nothing retaken.

      *What M28 gets.* A won war is a state with a date, which is what a
      prestige reset needs to start from.

      **The record, 4a (v1.56.0).** The deep rungs are tuned as planned, and
      the bar is met. Measuring it found one rule the plan did not have: a
      town the depots cannot feed holds.

      *Where it lives.* The deal table has thirteen rows a faction now, one
      for each rung to the stronghold. `--deeplayouts` chose rungs 6 to 13
      with the search that chose 1 to 5, against each faction's reference
      shape resized to `deepBudget`: the reference's own 25 to 27 men, and
      four more for each rung past the fifth. Rungs 1 to 5 are untouched,
      and the rear keeps rung 13's shapes with the layouts moving on. The
      rule is `canFeedNext` in `meta/supply.ts`, which the raid result asks
      before a third push takes a town. `--deep` runs twelve seeds a post
      now, not six, and `--reach` plays the war instrument's town daily for
      ten weeks with each force. Five new tests: four for the deal, one for
      the rule.

      *The measurement.* THE DEEP LADDER, rerun on the new rows: the
      manpower a force of each faction's reference shape needs to take a
      rung half the time, and the budget the rows were chosen at:

      | | T5 | T6 | T7 | T8 | T9 | T10 | T11 | T12 | T13 |
      |---|---|---|---|---|---|---|---|---|---|
      | USA | 28 | 31 | 34 | 36 | 42 | 47 | 47 | 53 | 53 |
      | China | 28 | 31 | 34 | 42 | 48 | 48 | 48 | 54 | 60 |
      | Russia | 27 | 31 | 38 | 48 | 48 | 48 | 54 | 59 | 59 |
      | KPA | 28 | 28 | 34 | 38 | 42 | 54 | 54 | 54 | 54 |
      | UN | 28 | 34 | 34 | 42 | 54 | 60 | 54 | 60 | 60 |
      | budget | 26 | 30 | 34 | 38 | 42 | 46 | 50 | 54 | 58 |

      Every faction climbs, and no rung asks more than 60 of the 66 men a
      built town fields. The survey's spikes are gone: the USA's ninth rung
      asked 64 men and asks 42, and the UN's asked more than a town can
      field and asks 54. Demand runs at the budget or a step of the grid
      above it, because a row picked as the best fit of many flatters itself
      on the seeds it was picked on, and at the top the grid steps six men
      at a time. The UN runs furthest ahead of its budget, a step or two from
      the ninth rung, and dips once, at the eleventh. The T5 column reads a
      step higher than the survey's for the USA and the KPA only because
      twelve seeds a post are not six: rungs 1 to 5 deal exactly what they
      did.

      THE ROAD TO THE CAPITAL (`npm run balance -- --reach`): the town of the
      week at war, raiding daily for ten weeks, up to three raids a session
      at the easiest open post, and pushing to answer strikes. The day it
      first reached a rung, and the rung it ended on, with the force grown
      four men a rung and with the reference force throughout:

      | | grown: T9 | T11 | T13 | ended | reference: T9 | ended |
      |---|---|---|---|---|---|---|
      | USA | day 8 | day 10 | day 12 | 16 | day 31 | 9 |
      | China | day 8 | day 10 | day 12 | 16 | day 16 | 9 |
      | Russia | day 8 | day 10 | day 12 | 16 | day 13 | 9 |
      | KPA | day 11 | day 13 | day 15 | 16 | day 55 | 10 |
      | UN | day 8 | day 10 | day 12 | 16 | day 13 | 9 |

      An army grown four men a rung reaches the stronghold in twelve to
      fifteen days. One kept at the reference force stops at the ninth or
      tenth rung, China's too, which reached the stronghold in six weeks on
      rung 5's pairs.

      *One rule the plan did not have.* The first grown run did not stop at
      the stronghold. The commanders went on to the 27th to 34th rung in ten
      weeks, and hunger never caught them: three raids a day take a town a
      day, and a front wholly unfed loses a sector a day. The plan put the
      end of the enemy's rear where the supply line runs out (4b), so that
      rule came forward. The third push at the front takes its town only if
      the depots could feed the line with it in. If they could not, the win
      pays like any win and counts on the record and the board, and the
      pushes hold at two until the depots make more. The depths Phase 3
      measured are where a front stops now, not where it starts to starve,
      and every grown commander stops at the sixteenth rung, where a built
      CC3 town with its yard runs out. Hunger is left for a town whose
      production falls, a wrecked depot or a save from before. The map says
      so in red while the front is at the ceiling: THE DEPOTS CANNOT FEED
      CANNON BEACH: TAKING IT WOULD PUT THE LINE AT 420 AN HOUR, AND THEY
      MAKE 330. IT HOLDS UNTIL THEY MAKE MORE. The raid report says the town
      holds and why. Read at 412 px portrait and 1440 px, and a raid played
      in the browser held as the unit test does: REEDSPORT HOLDS · the
      depots cannot feed the line with it: 15 an hour, and they make 0. A
      town with no depots at all cannot take the first town.

      *Two things about the instrument.* The grown commander keeps its
      training queues full, re-queuing each minute between raids, because a
      facility queues five at a time and a growing force outran a commander
      who queues once a raid: the KPA stalled at the ninth rung on it. The
      week at war's commander still queues once a raid, and its tables were
      read that way. And the UN's rows at rungs 6 and 8 to 12 were chosen
      from a pool of 36 layouts rather than 12, because the twelve held no
      UN post near the targets: its sixth rung was picked at 0/8/33 and is
      33/50/58 now, and its demand there fell from 42 men to 34. Russia's
      heavy posts at rungs 8 and 12 sit low, 8% and 17% at their budgets,
      the nearest a triple of distinct shapes came.

      *The other tables.* THE ENEMY STRIKES BACK, rerun, fights the
      reference force throughout, which the deep rungs no longer promise to
      carry. A commander who raids daily ends four weeks at the seventh to
      ninth rung, where the Phase 2 table ranged from the sixth to the
      eleventh, and what the strikes cost reads as it did: nothing daily but
      a sector or two for the UN, up to two rungs a month every other day,
      and a front pushed at a three-day rhythm falls back to the third rung.
      THE SUPPLY LINE's commanders get a rung or two deeper in a week, so
      the line takes a little more: 13-17% of production from the first rung
      at two-hourly sessions, and 27-32% from the eighth, where a full store
      then loses 34-45%. No front went short in either. The week at war's
      USA, at two-hourly sessions, clears 24 raids of 63 and reaches the
      ninth rung, where it cleared 17 and reached the sixth.

      *The gate.* 718 unit tests, five of them new, and two older ones that
      take a town now give it the depots to feed it. The 24 e2e harnesses
      passed unchanged, on the first batch.

      *What it hands on.* 4b: the stronghold becomes the enemy's capital,
      three roads and a citadel. A grown army gets there in twelve to
      fifteen days, and the citadel is to be tuned for about 62 of the 66
      men a built town fields. The rule already ends the enemy's rear at the
      sixteenth rung, as the plan meant to, but it also puts taking the
      stronghold at 1,365 supplies an hour, which a CC3 town without its
      yard does not make. 4b decides whether the citadel's fall waits on the
      depots too, or wins the war and leaves the front where it stands.

      **The record, 4b (v1.57.0).** The capital is built as planned, and the
      war can be won. The citadel departs from the plan where the
      measurement made it, and the question 4a handed on is answered: the
      citadel's fall wins the war whether or not the depots can feed the
      stronghold.

      *Where it lives.* `meta/capital.ts` holds the rules: the roads, the
      citadel in range, the war won and what it pays, and the repair of the
      two new fields off disk. The raid result hands it any win at the front
      while the front is at the stronghold. The citadel is `CITADEL` in
      `content/bases.ts`, a shape of its own outside the eight the deal draws
      from, and the target list puts it first once it is in range.
      `--citadel` chooses it, and the war instrument's commander takes the
      roads it has not taken, lightest first, and then the citadel with the
      whole army. Twenty new tests.

      *The rules, as built.* A road falls once: a second win on it pays like
      any post and is on the record, and counts for nothing more. At the
      stronghold its pushes are its roads, so the map's three marks and the
      planner's count read them. With all three taken the citadel is in
      range. Its first fall dates the war won and pays 4,000 supplies, 700
      fuel and 400 intel, IRON's placement. If the depots can feed the
      stronghold, the front moves on into the enemy's rear. If not, the war
      is won all the same and the front holds at the stronghold with its
      roads until they can, when the citadel's next fall takes it, paying
      and dating nothing twice. A front that falls back from the stronghold
      loses its roads. A war won stays won, and a front pushed back to the
      stronghold takes it again by its roads and its citadel.

      *The citadel.* The plan's citadel is two rings and positions dug a
      level deeper around the largest post on the board and the richest
      stores. As built, it is the keep's two rings with the inner gate always
      at the back, so a raid comes in through the outer gate and walks all
      the way round the post under the guns between the rings. Every gun
      stands at the full level, where the capital's other posts stand a third
      of theirs there. It holds eleven stores, where the richest post dealt
      at the capital holds seven. The post itself is no larger than theirs:
      levels stop at 3, and every post has reached it by rung 7.

      *The first departure: its strength is the faction's.* Raided at one
      strength by each faction's reference shape at 62 men, the USA's and
      China's forces, tank columns that drive at the post, took nearly every
      layout every time, and the UN's, which rides in armour, took none at
      any size of army. No choice of layout could put all five near half,
      and past about 1.2 times the baseline no more guns fit on the board. So
      `--citadel` searches the guns and the layout together, per faction, and
      raids every candidate again on fresh seeds. Outcomes are close to all
      or nothing per layout, so the pick is the one nearest half on both sets
      of seeds whose rate climbs with the force. Each faction's citadel, and
      what the reference shape does against it on a third set, the men it
      actually fields in brackets where they differ:

      | | guns | 54 men | 58 | 62 | 66 |
      |---|---|---|---|---|---|
      | USA | 8 | 0% (53) | 21% (56) | 71% (61) | 96% (64) |
      | China | 11 | 4% | 13% | 50% | 54% |
      | Russia | 8 | 8% | 42% | 67% | 96% (65) |
      | KPA | 8 | 21% | 38% | 58% | 75% |
      | UN | 5 | 25% | 58% (57) | 38% | 92% |

      Every citadel is taken 38-71% of the time by 61 or 62 men, and more
      often by the whole army, as the plan wanted. The UN's has five guns and
      China's eleven because the armies differ, and they are fighting five
      different enemies' headquarters, as the deal has always been the
      faction's.

      *The second: the war is won when the citadel falls.* Waiting on the
      depots would have made the war's end a question of the economy rather
      than the army, and the rule that a town the depots cannot feed holds
      already keeps the rear shut until they can.

      *Old files.* A file at the stronghold from before holds pushes won
      under the old rule: they are kept as roads, the lightest lanes first.
      A file already past the stronghold took it by any three wins: its war
      is marked won, dated to when it was last played, and paid nothing, as
      the rule it was taken under paid nothing.

      *What the player sees.* The map marks each road into the stronghold
      TAKEN as it falls, and draws the citadel as a walled row of its own
      past the stronghold: TAKE ALL THREE ROADS FIRST, IN RANGE, or FALLEN.
      The subtitle counts the roads, the rules say how the stronghold is
      taken once it is in view, and the citadel's button leads the list. The
      planner opens on the citadel when it is in range. The report says
      which road fell, or that it had fallen already, or THE CITADEL AT
      GRAYS HARBOR FALLS · THE WAR IS WON · the front moves into GRAYS
      HARBOR REAR 1, and the raid that won the war goes on to a victory
      screen: what the war paid, and that it goes on. The service record
      gives the day it was won, the war menu's row reads WON DAY 1 · T14,
      and the WAR tab's record row says WON. Read at 412 px portrait and
      1440 px, with a citadel raid played in the browser from the map through
      the victory to the menu.

      *The measurement.* THE ROAD TO THE CAPITAL, rerun with the commander
      taking the roads and then the citadel: the grown army wins the war on
      day 13 (China, Russia, the UN), 14 (the USA) or 16 (the KPA), a day
      or two after reaching the stronghold, and ends at the sixteenth rung
      as before. The reference force never reaches the stronghold.

      *The gate.* 738 unit tests, twenty of them new, and the 24 e2e
      harnesses, which passed unchanged on the first batch.

      *What it hands on.* 4c, the last stand at your own capital. And a won
      war is a state with a date, which is what M28 needs.

      **The record, 4c (v1.58.0).** The last stand is built as planned, and
      it cannot end the war. The plan left its level to measurement, and the
      measurement made the level the faction's.

      *Where it lives.* `meta/laststand.ts`: the march, the offer, the
      garrison's battle, the record and the repair off disk. The strikes
      sound the march: a quiet spell's strike that finds the front at the
      first town, with nothing behind it to take, in a war whose front has
      been deeper, marches on the capital instead of landing nowhere. How
      deep the war has gone is stored only once the front falls back from it
      (`deepest`), so most files carry nothing new; storing it always had
      put a field in every save, which three round-trip tests caught. The
      town folds the battle as it folds any played siege. Sixteen new tests.

      *The rules, as built.* One march waits at a time, so a quiet spell
      sounds at most one. It is offered as the live defence is, for thirty
      minutes from when the commander next sees it: DEFEND, the whole
      assault with the town's siege economy behind them, or GARRISON, the
      same battle fought headless under the standing orders, which can lose
      it. Walking away, or walking out of a defence mid-battle, is GARRISON
      on the next load. Held, it pays a skirmish's whole loot at its level,
      where a live defence pays half, and 50 standing. Lost, the capital is
      sacked: the fold wrecks every building that fell, 40% of the supplies,
      fuel and intel go, where a defeat takes 15%, standing falls by 100,
      the probe shield goes up, and the war log counts the sack and dates
      it. Fought in person it restarts the quiet clock; fought by the
      garrison it does not, and its battle is filed in the vault, as a
      probe's is. The front stays at the first town either way.

      *The level.* The plan said the level is measured to land where the
      commander's play decides it, as the offer's was: the contested band,
      where the permanent defences alone hold the whole assault some of the
      time. `npm run balance -- --laststand` scans every level from 1 to 22
      for each faction's reference town of each size with nobody acting,
      and takes the lowest held within fifteen points of half, or failing
      that the level held nearest half. The lowest, because the curves
      plateau and then fall off a cliff, and the level nearest half on
      twenty seeds is as often the one on the lip. What each town holds at
      its level, with nobody acting and then under the three shipped
      standing orders, which is the garrison's battle:

      | | CC1 | CC2 | CC3 |
      |---|---|---|---|
      | USA | L3: 20% · 25-50% | L8: 65% · 80-100% | L12: 65% · 90-95% |
      | China | L3: 80% · 80-85% | L7: 40% · 55-70% | L11: 55% · 65-90% |
      | Russia | L3: 95% · 95-100% | L9: 55% · 65-70% | L18: 75% · 80-95% |
      | KPA | L3: 30% · 25-35% | L7: 5% · 20-25% | L10: 55% · 90-100% |
      | UN | L3: 50% · 40-50% | L7: 40% · 65-100% | L11: 70% · 85-100% |

      A CC1 town's band is one level wide, level 3, for all five. The levels
      differ by faction because each faces a different enemy's assault:
      Russia's CC3 town holds three quarters of level 18, and the KPA's none
      of level 12. Three picks stand at a cliff with no plateau before it:
      the KPA's CC2 town holds level 6 every time and level 7 once in
      twenty, the UN's CC3 holds 70% of level 11 and 10% of level 12, and
      Russia's CC3 75% of level 18 and 15% of level 19. The garrison holds
      more than nobody does, which is what standing orders are for, and a
      commander at the console, with the CP to spend, can hold more again.

      *What the player sees.* On the load that finds a march it leads the
      banners: THE PLA IS MARCHING ON COOS BAY — LEVEL 3. DEFEND IT YOURSELF
      OR LEAVE IT TO THE GARRISON. [SPACE], and SPACE defends. The WAR tab
      leads with THE CAPITAL and its clock, the THEATER row says LAST STAND,
      and at the first town of a war that has been deeper the map's clock
      says when the enemy marches on the capital. The offer says what each
      answer is and, in red, what a sack costs. The result is bannered:
      COOS BAY HELD — LEVEL 3 THROWN BACK FROM THE GATES, or THE GARRISON
      FOUGHT IT. COOS BAY IS SACKED, with what it took and the wrecks to
      repair. The defence log names a LAST STAND, HELD or SACKED, and the
      service record counts them: Last stands at the capital: 0 held ·
      SACKED once, last on day 1. Read at 412 px portrait and 1440 px: the
      offer, the garrison's sack, the record, and a defence launched as LAST
      STAND — LEVEL 3 and walked out of, which the garrison fought on the
      next load.

      *The gate.* 754 unit tests, sixteen of them new, and one older test of
      the war log's repaired shape now expects the two new counters. The 24
      e2e harnesses passed unchanged, on the first batch.

      *What M25 hands on.* M25 is done. The Front Line is a road with an end
      at both ends: the enemy's capital, which wins the war, and yours, which
      a long neglect can see sacked but never lose. A war won and a capital
      sacked are both states with dates on the service record, and M28's
      prestige needs one of them to start from. M26's asymmetry can now make
      the five wars different games on the same map.

## M26 — "Asymmetry": factions become different games

4.2-point parity means it is now SAFE to diverge. Give each faction a different
verb rather than a different number: asymmetric win conditions, a unique resource,
a board rule of its own. The KPA already points the way — it is the only faction
whose carry is 13% instead of 100%, because tunnels changed the shape of the
problem.

- [x] **Phase 1 — one mechanic per faction, prototyped in the harness** before a
      line of UI exists for it. *(Shipped in v1.59.0, every rule dormant.)*

      **The plan, before the build.** The commander chose four of the five
      mechanics before this plan was written. Each is the signature that
      GDD §4 gave its faction and that was never built: the USA's Rapid
      Response, China's Production Surge, Russia's Overbuilt and the UN's
      Mandate. The KPA keeps the one it already has, the tunnel.

      *What the survey found.* The five kits are one kit dressed five ways.
      Every town builds the same eight structure kinds under its own names:
      a machine-gun nest, an autocannon, a MANPADS team, an AA site, a
      mortar, a deployable gun, a foxhole and a claymore. Every town calls
      the same two fire missions, a gun run and a barrage. The rosters
      differ only in price and role. Of the four signatures, only the tunnel
      is a mechanic. Russia's Overbuilt is just fifteen per cent added to
      the price of its buildings (`OVERBUILT_COST`), and Rapid Response,
      Production Surge and the Mandate do not exist at all. The week at war
      shows what this does to a turn. Raiding and skirmishing every two
      hours, all five factions spend the day on the same things in about
      the same proportions. Per day, repairs cost 14-23k supplies, raids
      earn 9-18k and training costs 3-7k. Research costs 8,902 for all five,
      because there is one research graph.

      *The four rules.*

      USA, Rapid Response. A field defence that survives the wave it was
      placed in pays back half its CP, once, at the end of that wave. This
      covers the foxhole, the gun, the mine and the Stinger team, whether
      the commander placed it or the standing orders did. The refunded CP
      can be spent in the next wave. So the US defence is the one that
      deploys early and often, and places field works where they will
      survive. This is a sim rule, applied at the end of a wave.

      China, Production Surge. For thirty minutes after any battle the
      commander fights, every training line runs at double speed. That
      means a raid, a skirmish, a defence stood, a counterattack, a last
      stand or a mission. A unit already in training when the surge starts
      finishes sooner, and a unit queued during the surge takes half the
      time. The Chinese turn is the one that fights, refills and fights
      again. This is a town rule, and nothing changes in battle.

      Russia, Overbuilt. An emplacement that is destroyed burns on as a hulk
      for up to fifteen seconds. The hulk has a quarter of the emplacement's
      HP, which burns down to nothing over those fifteen seconds. It fires
      at a quarter of the emplacement's damage, still blocks the path, and
      still covers the post. The attackers can shoot or demolish it sooner.
      Either way, it counts as destroyed from the moment it first fell, and
      it is a wreck in the town afterwards. The Russian defence is the one
      whose line cannot be broken in one place all at once. This is a sim
      rule, applied when a structure dies. The fifteen per cent extra
      Russia pays for its concrete stays.

      UN, Mandate. Before each defence, the commander picks one of three
      mandates for that battle:
      - Defensive works: walls 30% sturdier.
      - Rapid deployment: field defences, HESCOs and fire missions 25%
        cheaper in CP.
      - Humanitarian shield: a post 30% harder to take. Its bar is 30%
        longer, so the breach and the charge each take 30% more. The burn
        runs on a clock and does not change.

      The town keeps a standing mandate. The garrison fights under it when
      the commander is away, and a live defence offers it first. The UN's
      defence is the one that reads the attack before it comes. The first
      two mandates use the same multipliers research already sets, so they
      reach the sim through the mods every town battle carries. Only the
      post's multiplier is new.

      KPA, the tunnel. Unchanged. The KPA is already the one faction whose
      turn differs, because its best raid goes under the maze. The parity
      table already reads the KPA through a tunnel.

      *How they are keyed.* A replay is a record of a battle, so it has to
      re-fight under the rule it was fought under, even after a re-tune. The
      three sim rules therefore ride the config with their numbers, just as
      the standing orders ride as an id and the chain as a version.
      `SimConfig.rules` carries the refund's share, the hulk's seconds and
      strength, and the post's HP multiplier, and it is absent from every
      battle fought before. The rules are attached from the town's faction
      at `battleConfig`, the one seam every town battle comes through. The
      replay code appends them as a block at the end, as it did for
      terrain, the watch, the rolls, the chain and the cell size. The surge
      is town state: a time stored on the save.

      *What Phase 1 builds, and what it does not.* Phase 1 builds the four
      rules with their tests, and measures each one on and off in the
      harness:
      - the refund and the hulks on the defence tables across the contested
        band;
      - each mandate alone, and the best of the three picked per battle;
      - the surge's effect on how long a raid's losses take to retrain, and
        on how many raids a session then fits.

      None of the rules is switched on in the game, because none has any UI
      yet. A hulk drawn as a live gun, or a refund the player cannot see, is
      a rule nobody can play. Each rule is switched on together with its UI
      in Phase 3, once its numbers have held parity.

      **What Phase 1 found.** The four rules are built and tested, and each
      was measured on and off. Two new readings do the measuring:
      `npm run balance -- --signatures [seeds] [faction]` for the three
      defence rules, and `--surge` for China. The defence rules are read as
      LEVELS HELD: the sum of a base's hold rate over every rung of the
      ladder. A base that holds rungs 1-7 always and rung 8 half the time
      holds 7.5 levels, and a rule's worth is the levels it adds.

      Each reference base was read four ways, 20 seeds a rung, scanning up
      the ladder until two rungs in a row are lost every time:
      - with nobody acting;
      - under HOLDFAST;
      - under two commanders written for this reading, who spend CP on
        field defences as it comes in, up to six a wave: one on the post's
        approach, behind the fight (POST), and one around the latest breach
        (WIRE).

      The spenders exist because HOLDFAST acts only three times a battle,
      at the breach, so CP is never what it runs short of. Against HOLDFAST,
      neither a refund nor a cheaper field defence could show.

      *Corrected in Phase 2.* This record first reported spenders with no
      budget of actions, and those readings were wrong. A quarter of their
      battles never ended. Gunships the town's guns could no longer reach
      hovered over a post they could not take, the spender fed them a field
      gun every few seconds, and the churn kept resetting the stall clock
      that withdraws a spent assault, until the harness's tick cap counted
      the battle lost. The first reading took that for a finding, that field
      defences fill in a mature maze and make it worse, and the finding was
      the harness's. The spenders now stop at six a wave, the table reports
      any battle that times out, and the figures below are the
      re-measurement.

      What each rule adds, in levels held at CC1 / CC2 / CC3:

      | | nobody acting | HOLDFAST | POST | WIRE |
      |---|---|---|---|---|
      | USA, Rapid Response | 0 / 0 / 0 | 0 / 0 / 0 | 0 / +0.50 / +0.20 | 0 / 0 / 0 |
      | Russia, Overbuilt | +0.05 / +0.40 / +1.00 | 0 / +0.25 / +1.30 | 0 / +0.40 / +1.25 | +0.05 / +0.35 / +1.95 |
      | UN, defensive works | 0 / −0.05 / +0.60 | 0 / −0.25 / −0.50 | 0 / −0.70 / −0.25 | 0 / −0.05 / −0.10 |
      | UN, rapid deployment | 0 / 0 / 0 | 0 / 0 / 0 | +0.15 / +1.85 / +0.15 | 0 / 0 / 0 |
      | UN, humanitarian shield | 0 / +0.50 / +0.30 | 0 / +0.20 / +0.30 | −0.10 / +0.15 / +0.70 | 0 / +0.05 / +0.65 |
      | UN, best of the three per battle | 0 / +0.50 / +0.95 | 0 / +0.50 / +1.30 | +0.75 / +3.60 / +2.60 | 0 / +0.30 / +1.65 |

      Overbuilt works wherever there is a line to hold. About three
      emplacements a battle burn on as hulks, and it is worth a level or
      more at CC3. Rapid Response pays only a commander who deploys behind
      the fight: 188 CP back a battle on the approach, 7 at the breach, and
      nothing for the standing orders as written. Even behind the fight it
      is worth half a level at CC2 and a fifth of one at CC3. The mandates
      each work where they should: the walls where the maze holds the fight,
      the post where the enemy reaches it. Picking the right mandate for
      each attack is worth up to three and a half levels. Rapid deployment
      only pays when someone spends CP, and then only on the approach.

      And a fact about the battle layer rather than any rule. Spent on the
      approach, six a wave, field defences are the best line at every size
      and for every faction. They carry a CC1 base from 2-3 levels to about
      6 (the UN's to 8.5), and a CC3 base from 10-18 levels to 16-22. The
      UN's CC2 base, 6.65 levels with nobody acting, holds 19.90, with three
      of its battles timing out.

      China's surge was built first as the plan had it, double speed, and
      measured almost inert. A Chinese unit trains in 8 to 60 seconds, so a
      raid's losses refill in a median 50 seconds, or 30 with the surge. A
      week at war with three raids a session came out identical either way:
      27 raids a day, rung 9. Nothing in this economy waits on training
      time. What limits a refill is its price, and China spends about 27k
      supplies a day on it at that pace. The commander chose to keep the
      trigger and the window and change what the surge buys: for half an
      hour after a battle the commander fights, training costs half.
      Measured that way:

      | the week at war, a session every 2 h | training, supplies a day | the war's net, supplies / fuel a day |
      |---|---|---|
      | one raid a session | 7,307 → 3,562 | 4,653 / −1,650 → 8,383 / −670 |
      | three raids a session | 27k → 13k | 12k / 284 → 25k / 3,932 |
      | raids and skirmishes | 7,307 → 3,562 | 1,811 / −3,006 → 4,649 / −2,065 |

      The instrument's commander raids on a fixed cadence, so the cheaper
      refill shows as surplus rather than as more raids. Turning that
      surplus into a different turn is Phase 2's question.

      *The parity the raid table never saw.* The raid parity table reads
      8.0 points today, and none of the four rules touches a raid. The
      defence side has never had a parity reading, and it is not close. With
      nobody acting, the CC3 bases hold:
      - Russia 17.70 levels;
      - the USA 15.90;
      - the UN 10.95;
      - China 10.75;
      - the KPA 9.95.

      That is 7.75 levels between the best and the worst, and it is 2.40
      at CC2 and 0.75 at CC1. The largest defence rule goes to the faction
      already on top, so the CC3 spread becomes 8.75 levels with each
      faction's own rule on. Phase 3 has two parities to hold, and the
      defence one starts wide.

      *The gate.* 779 unit tests, 25 of them new: the refund, the hulk's
      lifecycle, the post's HP, the rules block in replay codes, the rules
      attached at `battleConfig`, the mandate on top of research, the surge's
      price and window, and the save. Every rule stays off in the game
      (`signaturesLive`), so no battle a player fights has changed. The 24
      e2e harnesses passed unchanged.
- [x] **Phase 2 — measure the right thing.** Not parity in odds, which is already
      won, but DIVERGENCE in how a turn is spent. *(Shipped in v1.60.0.)*

      *The plan.* A turn is what a commander does with a session, and the
      week at war already plays sessions. Phase 2 reads the shape of each
      faction's turn from those sessions, compared as shares:
      - battles fought per session, by kind;
      - supplies spent, by use;
      - CP spent in a defence, by verb.

      A faction's divergence is the distance between its shares and the
      mean of the other four's. Today every faction but the KPA sits close
      to that mean. The bar is that each faction's rule moves its own turn
      along its own axis:
      - US defences spend more CP on field works;
      - China fits more raids into a session;
      - Russia's unchanged defence holds higher, so its commander climbs the
        skirmish ladder further;
      - the UN's turn follows the attacks it meets.

      The stronger test is a matrix of commanders. Each faction plays each
      faction's line for a week, and a real asymmetry is one where every
      faction does best on its own line and pays for playing another's.
      Phase 2 settles its instrument after reading Phase 1's numbers.

      **The plan, before the build.** Phase 1's numbers settle two things
      about the instrument.

      *First, the week at war cannot yet play any of the four rules the way
      a commander would.*
      - Its defences are fought with nobody acting. No CP is ever spent, so
        neither a refund nor a cheaper field defence can show.
      - Nobody picks a mandate.
      - Its KPA raids walk in, although the KPA's best raid goes under the
        maze.
      - It raids once a session, so a cheaper refill can only ever show as
        surplus.

      So its commander learns four things, each already an option in
      another instrument:
      - In every defence it fights (the live defence, the counterattack and
        the skirmish), it spends CP by its faction's best line at CC3, from
        Phase 1's table. That is the spender at the breach (WIRE) for four
        factions, and HOLDFAST for the KPA, whose base the spender makes
        worse.
      - The UN picks the mandate each attack calls for. Each defence is
        fought three ways and the best is kept: the ceiling of a commander
        who reads the attack before it comes.
      - The KPA raids through a tunnel wherever the tunnel planner finds
        one.
      - It raids up to three times a session, each once the force is whole
        again.

      It is the same commander for all five. What differs is what each
      faction's kit and rule make of it, and the line Phase 1 measured as
      its best.

      *Second, the reading.* THE TURN plays that commander's week for each
      faction, with the signatures off and on, and reads the shape of the
      turn as three sets of shares:
      - the battles it fought, by kind: raids, skirmishes, defences and
        counterattacks;
      - the supplies it spent, by use: repairs, wire, training, charges and
        research;
      - the supplies it earned, by source: raids, skirmishes and defences.

      A faction's divergence on each set is the total-variation distance
      between its shares and the mean of the other four factions' shares.
      It is the part of the faction's turn that would have to move for it
      to look like theirs, from 0 to 1. The table gives all three and their
      mean, off and on, and names each faction's largest move. Alongside
      those, it reports what the turn got for it: the rung, the skirmish
      level, the CP a defence spent and got back, and the war's net.

      *And THE FIT: the matrix of commanders in the one place it can be
      played honestly.* The UN's line needs mandates, and the KPA's needs
      tunnels. No other faction has either, so a full five-by-five matrix
      of lines would mostly compare factions with nothing. What every
      faction can be given is every defence rule. THE FIT puts each of the
      three defence rules on each faction's MID and LATE bases, under that
      faction's own defence line, and reads the levels each rule adds. A
      rule that fits its faction adds more to its owner than to anyone
      else. A rule that adds the same to everyone is a number, not a verb.

      The bar for Phase 2 is the instrument, not a result: THE TURN and THE
      FIT built, and their first reading recorded with the signatures off
      and on. Phase 3 re-tunes against them.

      **What Phase 2 found.** Both readings are built: THE TURN
      (`npm run balance -- --turn`) and THE FIT (`--fit [seeds]`). Before
      they said anything about the factions, building them found two things
      wrong with the harness.

      *The harness, first.* One was Phase 1's spender, which had no budget
      of actions. Its stalemates read as losses, and Phase 1's record above
      is corrected. The other was the week at war's training queue. Its
      commander queues a raid's losses once, and a queue holds five. A raid
      that cost Russia six BTRs, or the UN seven VABs, all trained at one
      motor pool, or cost the KPA more of its nineteen men than two barracks
      could queue, left the force short at the next raid. So Russia, the KPA
      and the UN fought 1.9 battles a session to the USA's and China's 3.6.
      That looked like a difference in the kits' tempo, and it was the
      harness. THE TURN's commander keeps its queues full, as a player does,
      and then all five fight 3.6 to 3.7 battles a session. The week at war
      itself still queues once a raid, as its tables were read.

      *The commander* is the plan's, except for its CP. With the spender
      corrected, spending on the post's approach is the best line at CC3 for
      every faction, so all five spend there, six a wave.

      *THE TURN: the shape*, as shares of the turn, signatures off → on:

      | | battles raid/skirmish/defence/counter | spent repair/wire/train/charges/research | earned raid/skirmish/defence |
      |---|---|---|---|
      | USA | 83/9/3/5 → same | 35/0/47/0/18 → same | 77/14/9 → same |
      | China | 83/9/3/5 → same | 37/0/48/0/16 → 48/0/31/0/21 | 88/6/6 → 94/0/6 |
      | Russia | 81/10/3/6 → same | 44/0/43/0/13 → 43/0/44/0/13 | 83/10/6 → 88/5/7 |
      | KPA | 80/9/3/7 → same | 39/0/43/0/19 → same | 84/6/10 → same |
      | UN | 82/10/3/6 → 80/11/3/6 | 27/0/54/0/19 → 32/0/50/0/17 | 98/2/1 → 95/1/4 |

      Each faction's divergence, the mean of its three distances from the
      other four:
      - the USA: 0.05 → 0.07;
      - China: 0.02 → 0.08;
      - Russia: 0.05 → 0.02;
      - the KPA: 0.04 → 0.03;
      - the UN: 0.09 → 0.07.

      And what the turn got for it, signatures on against off:
      - China's war nets 16k supplies a day instead of 7k.
      - Russia's skirmish ladder climbs to level 42 instead of 39.
      - The UN's climbs to 38 instead of 31, holding 20 skirmishes of 26
        instead of 15 of 22.
      - The USA's defences get 61 CP back each, and no battle's result
        changes.

      So the five turns are nearly the same turn. At most 9% of any
      faction's turn would have to move to match the other four. The rules
      change what a turn gets far more than what it is. Only China's changes
      how a turn is spent: training falls 17 points of the spend. Russia's
      and the UN's rules take their defences further up the ladder, and
      leave their turns looking more like everyone else's. Rapid Response,
      at CC3, changes nothing that the week can see.

      *THE FIT*, the levels each defence rule adds to each faction's CC2 /
      CC3 base, all spending on the approach (the owner's cell in bold):

      | | Rapid Response | Overbuilt | Mandate, best of three |
      |---|---|---|---|
      | USA | **+0.50 / +0.20** | +0.30 / +0.40 | +3.15 / +2.35 |
      | China | +0.50 / +0.45 | +0.40 / +0.80 | +1.75 / +2.75 |
      | Russia | 0.00 / +0.55 | **+0.40 / +1.25** | +1.70 / +3.00 |
      | KPA | +0.05 / −0.25 | +0.05 / +1.15 | +0.70 / +1.75 |
      | UN | +0.80 / 0.00 | +0.20 / +1.45 | **+3.60 / +2.60** |

      Only the Mandate fits its owner outright, and a pick per battle is
      worth two to three levels to anyone. Overbuilt adds the same to Russia
      and the UN, both heavy on emplacements, and least to the USA. Rapid
      Response adds more to China and the UN than to the USA. As built, it
      is a number, not the USA's verb.

      *What Phase 2 hands on.* Phase 3 was to re-tune the rules to hold
      parity while the playstyles separate. The measurement says the
      playstyles have not separated, and that the parity to hold is wider
      than the raid table ever showed. Spending on the approach, the line a
      commander who spends CP actually plays, the five CC2 bases hold from
      9.70 levels (the KPA) to 19.90 (the UN), and the CC3 bases from 16.25
      to 22.35, 7.35 apart with each faction's rule on. Three of the four
      rules change outcomes rather than decisions, and one fits the wrong
      faction. Phase 3 now has both instruments to re-tune against: the
      defence tables for parity, and THE TURN and THE FIT for whether the
      rules make five different games.

      *The gate.* No rule or number in the game changed, so the 779 unit
      tests are the same ones. The instruments are tools: THE TURN and THE
      FIT, the week at war's four new options for its commander, the
      spender's budget, and a timeout count in the defence tables. The 24
      e2e harnesses passed unchanged.
- [x] **Phase 3 — re-tune to hold 4.2 while the playstyles separate.**

      *The plan.* There are two parities to hold, and a third place to
      check:
      - The raid table. It measured 8.0 points in the last snapshot, and
        none of the four rules touches a raid.
      - The defence side, which three of the four rules move: the DEFENSE
        tables, the contested band, the last stand's level and the probes.
      - The campaign's missions, which are fought through the same seam.

      Tuning uses each rule's own numbers first: the refund's share, the
      hulk's strength and seconds, the mandates' sizes and the surge's
      minutes. Faction stats are adjusted only if those are not enough.
      Then each rule gets its UI and is switched on:
      - a hulk that is drawn as burning;
      - the CP a surviving field defence returns, shown on the board;
      - the mandate chosen in the defence offer and set in the WAR tab;
      - the surge's clock on the training lines.

      **The plan, before the build.** Phase 2 handed on two problems, and
      the commander settled both before this plan was written.

      *The USA gets a kit, not a refund.* The five field kits are one kit:
      the same four kinds at 12 to 26 CP with nearly the same numbers. So
      no rule that works through field defences can fit one faction more
      than another; the fit has to come from something only that faction
      has. The new rule sweep (`npm run balance -- --rule`) put a number on
      both halves of the question:
      - The refund cannot be tuned into mattering. Even refunding the full
        price, it adds +0.20 / −0.10 levels to the USA's CC2 / CC3 bases,
        which is inside the noise.
      - Fewer, bigger field defences at the same CP value can matter a
        great deal. At 1.5 times the HP, the damage and the price, the
        USA's bases gain +3.7 / +4.2 levels. At 2.5 times they gain about
        nine.

      So Rapid Response becomes "few, expensive, excellent", as GDD §4 has
      the USA. The USA's field defences are its own: each one has more HP
      and damage, and costs more than that makes it worth, so that the kit
      holds parity. The refund stays, rewarding the commander for keeping
      them alive. Like the other sim rules, the kit rides the config with
      its numbers (`Signature.elite`: a scale on HP and damage, and a scale
      on price). That keeps it dormant with the others until they switch
      on, and a replay re-fights with the kit it was fought with. Only the
      USA has the kit, so it fits the USA by construction.

      *Parity is held, not closed.* The defence side was never at parity,
      and closing it is a milestone of its own. Phase 3 holds it: switching
      the rules on must never widen the gap between the best and the worst
      faction. The gap is read on the defence tables with nobody acting,
      under HOLDFAST and spending on the approach, at every command-post
      size, with half a level allowed for noise.

      Holding it has a consequence the rules' own sizes cannot meet by
      themselves. Where a faction already leads, any gain from its rule
      widens the gap, however small the rule:
      - Russia leads at CC3 with nobody acting (17.70 levels), under
        HOLDFAST (18.85) and when spending on the approach (22.35), and it
        leads at CC2 with nobody acting. The hulk adds up to +1.30 levels
        there.
      - The UN leads at CC1 and CC2 when spending on the approach (19.90
        levels at CC2, 5.65 clear of the USA). Rapid deployment adds +1.85
        there.

      A hulk small enough to add nothing is a rule nobody would notice. So
      a leader's rule carries its own offset, riding its signature in the
      same way: Russia's emplacements are trimmed by exactly as much as
      the hulks give back (`DefenderMods.emplacementHp`). The concrete goes
      into the burning. The UN's rapid deployment is sized down to what its
      lead leaves room for. Every mandate is held as a standing choice.
      Picking the right one for each attack, fought three ways and the best
      kept, is the skill above it, and is reported rather than held: that
      ceiling is what the verb rewards. Raid parity needs no work, because
      no rule touches a raid, and a re-run of the parity table confirms it.

      *The phase is two steps, each shipped on its own.*
      - **3a: the rules reshaped and tuned, still dormant.** The elite kit
        and the emplacement trim join the sim, with the replay block
        extended, tests first. The tuning is read by THE HOLD, a table of
        every faction's defence with its whole rule on and off, at every
        size and under every commander, with the gap each rule leaves and
        any reading where it widens. THE TURN and THE FIT are read again on
        the tuned rules. Then comes what the rules touch downstream: the
        last stand's levels, the probes and the missions.
      - **3b: the UI, and the rules switched on.** A burning hulk, the CP a
        field defence returns, the mandate in the WAR tab and in the defence
        offers, and the surge's clock on the training lines. Then
        `signaturesLive` goes on, and the harness's defence configs attach
        the rules as `battleConfig` does.

      **What 3a found.** *(Shipped in v1.61.0, every rule still dormant.)*
      The USA's kit, Russia's trim and the UN's lighter rapid deployment are
      in the sim, riding the config. Replay codes carry all three, as bits
      8, 16 and 32 of the rules block. Two instruments do the tuning: THE
      HOLD (`npm run balance -- --hold [seeds]`), and the rule sweep
      (`--rule <rule> <values> <factions> [seeds]`), which reads one rule
      at several sizes.

      *Tuning each rule.*
      - **The USA's kit** is 1.3 times the HP and damage at twice the price.
        At 1.5 times, it took the USA past Russia at CC3 when spending on
        the approach, the reading Russia leads, and widened the gap. The
        price barely moves the kit's worth in the harness, because a
        commander who stops at six a wave rarely runs short of CP. What the
        price does is make a survivor worth keeping: with half back, a field
        defence that lives through its wave has cost what the standard one
        does.
      - **Russia's trim** is 0.875. Untrimmed, the hulk adds up to 2.00
        levels where Russia leads. Trimmed, it adds between −0.45 and +0.15
        on every reading, inside the noise. Russia defends as well as it
        did, and differently.
      - **The UN's rapid deployment could not be sized down, and is lighter
        instead.** A cut in price alone added 1.30 to 1.75 levels to the
        UN's CC2 base spending CP, the reading it already leads by five and
        a half, at any size from 5% off to 25% (40 seeds). So the mandate
        now costs 25% less and leaves its field defences 20% lighter. That
        is neutral where the UN leads, and a mistake at CC3, where it costs
        nearly a level: a choice rather than a buff.
      - **The default mandate is now the humanitarian shield.** It is the
        one mandate that measured a little better almost everywhere and
        worse nowhere. Defensive works ranges from nearly a level better to
        nearly three worse, so it is a choice for a commander who knows
        their maze.

      *THE HOLD, at 20 seeds*: the gap between the best and the worst
      faction, each reading's rules off → on (the widest any standing
      mandate leaves):

      | | CC1 | CC2 | CC3 |
      |---|---|---|---|
      | nobody acting | 0.75 → 0.60 | 2.40 → 1.95 | 7.75 → 7.55 |
      | HOLDFAST | 0.75 → 0.55 | 2.80 → 2.75 | 7.50 → 7.65 |
      | spending on the approach | 2.60 → 3.00 | 10.20 → 10.35 | 6.10 → 5.80 |

      Held: no gap widens by more than half a level, the noise at 20 seeds.
      The closest is CC1 spending CP (+0.40), where rapid deployment adds a
      little to a reading the UN leads. With nobody acting, Russia's trim
      narrows the gap at every size. The UN's best mandate per attack
      reaches 23.10 levels at CC2 and 23.00 at CC3, three levels above any
      standing choice. That is the ceiling of a commander who reads every
      attack, and it is reported, not held.

      *THE FIT, on the whole rules*: the levels each adds to each faction's
      CC2 / CC3 base, all spending on the approach:

      | | Rapid Response | Overbuilt | Mandate, best of three |
      |---|---|---|---|
      | USA | **+2.50 / +1.05** | −0.20 / −0.40 | +3.15 / +2.10 |
      | China | +0.15 / +2.55 | −0.25 / +0.35 | +1.65 / +2.70 |
      | Russia | −1.20 / +2.70 | **+0.15 / −0.75** | +1.60 / +1.85 |
      | KPA | 0.00 / +1.45 | +0.05 / +0.20 | +0.65 / +1.65 |
      | UN | −0.20 / +2.05 | −1.00 / −0.10 | **+3.20 / +2.20** |

      Rapid Response now fits the USA first of the five, 3.55 levels over
      both bases, and the Mandate fits the UN first, 5.40. Overbuilt is a
      wash for everyone, and that is how it was built: the trim that holds
      parity cancels what the hulk adds. It changes how Russia defends, not
      how well.

      *THE TURN, on the tuned rules:*
      - The USA's defences spend 623 CP instead of 328 and get 126 back,
        and its skirmish ladder climbs to level 36 instead of 32.
      - China's training falls 17 points of its spending.
      - Russia ends the week at the same level, 39, as without its rule.
      - The UN climbs to 38 instead of 31.

      The five turns' divergence from the others is still small, from 0.02
      to 0.09. The rules separate what the factions' defences can do more
      than how their turns are spent. China's surge is the one rule that
      moves a turn's spending.

      *What 3b inherits.* The rules are tuned and held. What they touch
      downstream is read when they switch on, since until then no battle a
      player fights has them: the last stand's levels, which the permanent
      layer sets, the probes, which the garrison fights, and the campaign's
      missions.

      *The gate.* 786 unit tests, seven of them new: the kit's HP, damage,
      price and refund, the trim and a trimmed hulk, the lighter field
      defences, and the three new bits in replay codes. The 24 e2e
      harnesses passed unchanged.

      **What 3b found.** *(Shipped in v1.62.0. The rules are on, and M26 is
      done.)*

      *The UI.* Each rule has the line it needed to be played:
      - A hulk is drawn as the wreck it is, with flames over it and its own
        bar burning down from the hulk's HP.
      - A field defence that lives through its wave has its refund lettered
        over it as the wave ends. The deploy tab prices each field defence
        at what it costs in this battle, so the USA's read twice the price.
      - The UN's mandate is a row under STANDING ORDERS in the WAR tab, and
        a tap moves it to the next, with a banner saying what that one
        does. Both defence offers, the live defence and the last stand,
        open with it: the mandate both answers will fight under and what it
        does, changed there for this defence and the ones after it.
      - China's training tab shows the surge while it runs, with a clock
        ("PRODUCTION SURGE — TRAINING HALF PRICE · 23:41 LEFT"), and prices
        every line at the moment rather than at the town's last tick.
      - Russia's emplacement cards say what Overbuilt does to them, and
        read the trimmed HP.

      *The switch.* `signaturesLive()` is on. What a battle carries of its
      faction's rule is one function now, `battleRules`. `battleConfig`
      calls it for every town battle, and the balance harness for every
      defence battle, so the harness measures the battle the game fights.
      An instrument that reads a rule on and off names its rules outright
      (`{}` for none), and `--no-signatures` measures any table, the
      snapshot included, as the game stood before.

      *What moved downstream*, each read with the rules off and on:
      - **The snapshot**, regenerated. Measured without the rules it is
        v1.47.0's, row for row, so nothing between v1.47.0 and v1.61.0 had
        moved a table. With them, 16 defence rows and 4 mission cells moved,
        all of them the three factions whose rules act in battle: the USA's
        HOLDFAST table (its garrison's field defences cost twice as much),
        and Russia's and the UN's tables and missions. China's and the
        KPA's tables and every raid row read as they did, so raid parity
        is untouched, as the plan expected.
        - Russia, nobody acting: CC1 holds 80% of level 3 (95% before), and
          CC2 25% of level 9 (55%). The trim costs a little more than the
          hulk gives back at the edge of the band; over the whole ladder it
          is the −0.45 levels THE HOLD read.
        - The UN, under the shield: CC2 holds 65% of level 7 (40%) and 50%
          of level 8 (25%); CC3 85% of level 11 (70%). With the Engineer
          Corps HQ on the line, CC2 holds 95% of levels 7 and 8 (75%).
        - The campaign, on the base it allows by then: the UN's M6 THE
          MANDATE HOLDS 13% → 33%, its M5 88% → 98%, Russia's M6 73% → 65%.
          None moved by the table's alarm of 24 points.
      - **The last stand**, re-read with the rules: the same level for every
        faction and size but one. Russia's CC3 town holds 75% to 95% of
        every level from 13 to 18 and almost none of 19, so no level is
        near half, and the one nearest it moved from 18 to 16. It holds
        75% of level 16 with nobody acting, as it held 75% of level 18
        before. Russia's CC3 last stand is level 16 now. The UN's CC2 holds
        65% of its level 7, from 40%, the edge of the band. Russia's CC2
        holds 25% of level 9, from 55%, which is still the level nearest
        half.
      - **The probes**: every hold rate is the same (`--probe-held`, 8
        seeds, five bases, levels 1 to 12). The USA's garrison buys fewer,
        dearer field defences: across the five factions, TRIPWIRE carries
        out 2.14 orders a probe instead of 2.43, and its upkeep falls with
        them. No bill changes.
      - **The tutorial.** Its CP lesson waited for 20 CP and then said
        "spend some", but under the USA's kit the cheapest field gun costs
        30. The lesson waits for 20 or a field gun's price now, whichever
        is more.

      *The gate.* 789 unit tests, three of them new: the refund is announced
      where it stands, the switch is on (and with it off nothing rides),
      and the CP lesson waits for a field gun. Two tests measure the game
      without the rules and say so: the probe bill's liveness case, where
      the USA's garrison buys one mine where it bought three and none goes
      off, and the replay code's no-rules case. The 24 e2e harnesses passed
      on the first run. A browser pass over each new control, since no
      harness reaches them: the UN's mandate row cycles and is saved, and
      the offer's changes it and lays the offer out again; a USA defence
      prices its field kit at twice and letters +20 CP over a foxhole that
      lived through its wave; a Russian defence draws its fallen nests as
      burning wrecks with their own bars, for the second or three the
      assault takes to finish them off.

## M27 — "The Other Commander": asynchronous PvP for real

Share codes are a boast with no consequences. Make them a system: matchmaking by
standing, revenge raids against whoever hit you, a defence log that names an
opponent, seasonal ladders with resets, and a base genuinely fought by other
people overnight. The sim is deterministic and already replay-coded, so the hard
part is done.

- [ ] **Phase 1 — ghost raids.** Your base, their force, resolved locally,
      results exchanged by code.
- [ ] **Phase 2 — a thin server (or peer exchange)** for matchmaking and standing.
- [ ] **Phase 3 — seasons, revenge, leaderboards.**

## M28 — "Command Cadre": progression with a ceiling worth climbing

The campaign ends at 18 missions and then it is skirmish forever. Add named
officers with traits who level and can die, doctrine trees that make a run
distinct, unit upgrade paths, and a prestige reset that carries something forward.
Veterancy already proved this project can build "pays in survivors, not in wins";
this extends it into a reason for run #4.

- [ ] **Phase 1 — officers as a save layer**, reaching the sim through the mod
      hooks that already exist.
- [ ] **Phase 2 — doctrine trees** replacing the 3x3 research ladder.
- [ ] **Phase 3 — prestige and the meta-currency it feeds.**

## M29 — "After Action": make the sim explain itself

A raid is a replay you watch. It should be a report you read: where men were lost
on the map, what killed them by damage type, which squad stalled and for how long,
and a COUNTERFACTUAL re-sim — "the same raid with one more breacher" — which a
deterministic engine can do for free. This is the cheapest way to make the
planning half feel like skill, because it teaches.

- [ ] **Phase 1 — surface what already exists.** `res.losses` carries per-kind
      death attribution and nothing shows it.
- [ ] **Phase 2 — a spatial heat map** over the board.
- [ ] **Phase 3 — the counterfactual.** Re-run with one substitution, diff the
      outcome, show both.

## M30 — "Render": stop paying 1.48 MB for a Graphics list

**Done (v1.49.0), and it took both exits, one after the other.** The UI went
to the DOM (Phases 1 and 2), and once the board was all Phaser drew, a stage
of the game's own replaced it (Phase 3). The download went from 502 kB
gzipped to 178, and a phone-speed boot from 1.65 s to 0.53.

Phaser is 81% of the download and this game uses none of its texture, physics or
scene-graph strengths — every frame re-walks and re-batches an immediate-mode
command list, and `ui.ts` is 1,562 lines of hand-rolled hit testing because there
is no DOM. Two coherent exits: drop Phaser for a small custom Canvas2D/WebGL
renderer, or keep Phaser for the BOARD only and move the entire UI to DOM and CSS.

**Take the second.** Lower risk, bigger immediate win, and it makes accessible
text and real input handling free.

**What the survey found, before any code (v1.45.3).**

| | |
|---|---|
| Phaser | 1,482 kB, 340 kB gzipped |
| the game itself | 383 kB, 124 kB gzipped |
| the canvas UI kit | `ui.ts` 1,723 lines, `overlay.ts` 537 |

Two components carry almost the whole UI. `Panel` is the rail in landscape and
the drawer in portrait: tabs, pooled rows, drag-scroll with a fling, tab swipes,
long press, carrying a row onto the board, row icons, the status strip. Five
scenes use it. `Overlay` is the scrim, masthead, scrolling body and footer that
every briefing, report, log and menu is printed on: 20 constructions across
seven files, and the front door is nothing else. Around them sit a handful of
loose buttons and texts: the status line, banners, the coach's plate.

The harnesses never touch a Phaser object. All 24 address the UI through
`window.lastline` — buttons, texts and text rects by label and rect, the
drawer's scroll, layout and tab — so a DOM implementation that answers the same
seam keeps the whole gate as its acceptance test. And there is precedent: the
share-code box has been DOM laid over the canvas since v1.2.

**The plan: port by COMPONENT, not by scene, behind one flag.** Every overlay
in the game is one class with one API, and so is every panel. A DOM version of
each that honours the same API converts every scene's copy at once, and leaves
the call sites alone until Phase 2 deletes the canvas versions. Porting scene by
scene would mean two implementations of the same component live in one scene.

The flag is `?ui=dom`, or `VITE_UI=dom` when the dev server starts, so
`VITE_UI=dom npm run e2e` runs the whole gate against the DOM UI without editing
a harness. The default stays canvas until every harness passes both ways.

- [x] **Phase 1 — the DOM UI behind the flag (v1.45.4-v1.46.0).**
  - [x] **1a — the kit (v1.45.4).** A UI layer over the canvas. `Ink`, a
        Canvas2D stand-in for the dozen Graphics calls the glyphs make, so an
        icon in a DOM row is drawn by the same code as the board. The seam: DOM
        buttons and text answer `liveButtons`, `liveTexts` and `liveTextRects`.

        The glyphs take `Ink` now, which a Phaser Graphics satisfies as it
        stands, and `glyphs.ts` no longer imports Phaser at all. The canvas
        stand-in has one semantic that needed care: Phaser keeps a path built by
        `beginPath` apart from its one-shot shapes, and a canvas has a single
        current path, so a circle drawn mid-path would have erased the path.
        It records the path and replays it; a unit test holds that, and draws
        every glyph in the game through it.
  - [x] **1b — `DomOverlay` (v1.45.4).** The menu, briefings, settings, the spec
        cards and Town's overlays. The front door is the first screen that is
        all DOM.

        Same API, same geometry from the same `Layout`: every call site goes
        through `createOverlay` and cannot tell which kit it got. The body
        scrolls natively. Side by side the two front doors are the same page to
        within a few pixels — the DOM's text lines are a little taller — and
        report the same buttons and text to the harness.

        **The first full gate against it: 22 of 24.** Both failures were real,
        and one was not the overlay's at all:

        - **A tap on a DOM button also pressed the canvas under it.** Phaser
          listens for touches and mouse buttons on the WINDOW, and hit-tests
          the canvas for every press it hears, wherever it landed. The canvas
          overlay never met this because its scrim was the topmost canvas
          object and took the press. A DOM overlay leaves the drawer beneath it
          exposed, so closing a spec card changed tab in the same tap. The layer
          now stops presses before they reach the window. This is the rule
          every later phase inherits: DOM over Phaser is two UIs hearing one
          finger unless one of them is told not to.
        - **A touch's compatibility mouse events landed on the canvas** once the
          tap had closed the overlay they were aimed at. A DOM press cancels
          them.
        - **A harness selector became ambiguous.** `text=CLOSE` meant the share
          box's button when the overlay under it was canvas; with a DOM overlay
          there are two. The box is tagged and the harnesses say which.

        With those fixed: 24 of 24 on the canvas UI, and 23 of 24 on the DOM
        overlay, the other a batch flake in `e2e-build` that passed alone and
        three times more.

        Found on the way: the front door's five faction marks were spread across
        a column wider than a 360px phone's card, and the outer two were cut in
        half. They were in the canvas kit too — the DOM drew the same bug.
  - [x] **1c — `DomPanel` (v1.45.5).** Native scrolling replaces the
        hand-rolled drag and fling. The drawer handle, tab swipe, long press and
        carry-to-board are the real work, the carry most of all: a touch that
        starts on a DOM row belongs to that row, so it has to be handed to the
        board on purpose.

        Same geometry, same rows, and every scene gets one from `createPanel`.
        Side by side in the town the two drawers report the same tabs, rows,
        rectangles, states and scroll range to the harness, to the pixel. Rows
        are handed over every frame as before and diffed: the two-pass layout
        only runs, and an icon is only redrawn, when what a row shows changes.

        The carry is the one new mechanism. A row's silhouette opts out of
        native scrolling, so a drag that starts on it comes to the panel, which
        scrolls the list by hand while the finger is inside it and, once it
        leaves toward the board, hands `onPick` a `CarryPointer` with a
        `follow` hook. The board subscribes to that instead of to Phaser's
        input, because it will never hear a touch that began on a DOM row.

        What the harnesses found, in the order they found it:

        - **A touch's click goes to whatever its release uncovered.** Tapping a
          spec card's CLOSE removed the card, and the browser delivered the
          click to the OPS tab now under the finger — with no pointer detail on
          it, which the button had been reading as the keyboard. DOM buttons
          answer Enter and Space on the key now, and ignore clicks entirely.
        - **The browser stops a coast before the page sees the press that
          stopped it**, so the panel read a list already at rest and the finger
          that caught a flick armed the row under it. A coast is read from the
          last 120ms instead of the current frame.
        - **Nothing says how fast a thrown list is going when the finger
          lifts.** A touch the browser scrolls for gets no pointerup, and the
          platform's coast does not move the list on every frame the game
          draws. The lift is read from the touch, the speed from the last tenth
          of a second, and a press anywhere else stops the coast, as the canvas
          panel's does.
        - **One harness was testing the canvas panel's physics.** The drawer's
          flick had been tuned so the coast would stop on a row the showcase
          town can afford, and native momentum stopped it on a locked one every
          time. It now tries up to four landing spots and judges only the
          attempt that found a row that can be pressed.

        The gate: 23 of 24 with the flag on and 23 of 24 with it off, each with
        one batch flake that passed alone.

        **And one build did not ship.** v1.45.4's commit swept in this panel's
        file, written ahead and imported by nothing, which named exports that
        did not exist yet. CI's typecheck failed and nothing deployed until a
        commit adding them followed ten minutes later.
  - [x] **1d — the loose pieces**: status strip, banners, coach plate, free
        buttons.

        Four free buttons — the town's CONFIRM and CANCEL, the siege's primary
        action, the raid's LAUNCH — come from `createButton`. Four texts over
        the board — the banner, the raid's hint and recon notice, HOLDING —
        come from `createLabel`. The coach picks its plate by the flag. In the
        DOM all of them hang from a per-scene host above the panel and below
        the overlays, which goes when its scene does, since a DOM node, unlike
        a Phaser object, does not die with the scene that made it. The status
        strip was already the panel's.

        The host reports every text in it to the harness, as one source. The
        first cut had each label register itself and the free buttons register
        nothing, so `e2e-raid` read the planner with no LAUNCH RAID on it and
        found no units committed: the text was on screen and not in the list.
        One source per host is one place to forget, not one per piece.

        With 1d the DOM UI is the whole UI: under the flag, the canvas draws
        the board and nothing else. The gate: **24 of 24 with the flag on and
        24 of 24 with it off**, the first clean pair of the milestone.
  - [x] **1e — flip the default (v1.46.0)**, once every harness passes with the
        flag on. They did, both ways, so the DOM is the UI now and
        `?ui=canvas` is the way back, kept one release while the DOM kit meets
        devices the harnesses never ran on. The unit suite has no window and
        keeps the canvas answer.
- [x] **Phase 2 — retire `ui.ts`, `overlay.ts` and the gesture layer (v1.48.0).**
      The canvas kit is gone, and the flag with it: `?ui=canvas` stopped meaning
      anything once v1.47 had been out without anyone needing it. Deleted: the
      canvas `Panel` and its hand-rolled drag, fling, swipe and carry, which is
      the gesture layer the title means; the canvas `Overlay`; the canvas button
      and labels; the coach's canvas plate; `dom/flag.ts`. What `ui.ts` held that
      was not the kit moved beside what uses it. The harness probes went to
      `probe.ts`, and `createPanel`, `createButton` and `createLabel` went to the
      DOM modules they build, which lost their last `container` argument too:
      every one of the 31 call sites that passed one passed a thing the DOM
      ignored. `overlay.ts`'s API went into `dom/overlay.ts`, which had been
      importing its own interface from the module that imported it.

      | | before | after |
      |---|---|---|
      | the game's own code, built | 419 kB, 135 kB gzipped | 395 kB, 128 kB gzipped |
      | TypeScript under `src/` | 41,041 lines | 38,951 lines |

      Phaser itself is untouched, 1,482 kB and 340 kB gzipped, and is now the
      whole of the question Phase 3 asks.

      **Deleting it found one thing Phase 1 had missed, and one it had left.**
      The replay's closing verdict, COMMAND POST DESTROYED and the rest, was
      still Phaser text in the board's HUD container: 1d ported the loose
      pieces it found by the kit's factories, and this one never went through
      a factory. It is a scene label now, which also means it follows a
      rotation where the canvas one stayed where it was drawn. And with it
      gone the HUD container held nothing, so the second camera that drew it
      went too. Every frame since v0.9 had two camera passes, one for the
      board and one for the HUD over it, and since v1.46 the second had been
      walking the scene to draw an empty container over the whole screen.

      **And looking at that verdict found a bug every harness had passed for
      two releases.** Moved into the DOM it came out one word to a line. A
      scene label hangs from a host that is a point at the canvas's origin,
      and a label left to wrap wraps against the width it has, which is none.
      Canvas text only wraps when it is given a width, so a label now keeps
      its lines as written until it is given one. The raid's RECON REQUIRED
      notice and its hints had been set that way since v1.46 made the DOM the
      default. Every check read their words and none read their shape.
      `e2e-raid` reads the shape now, on the recon notice and on the verdict,
      and fails with the old wrapping restored: 58x176 and 151x202, against
      210x44 and 376x72. The verdict is also set in ink for a win, where the
      pre-ink palette's olive had become a pale tone that read as nothing.

      The strays check stays, with one layer: anything on the canvas belongs
      to the board's world now, or the text probe would file it as screen text.

      The gate: 23 of 24 with one batch flake in `e2e-defend`, which passed
      alone and four more times, then 24 of 24, and 24 of 24 again on the
      final tree with the two new checks in. `e2e-all` now prints what a
      flaked attempt said, because this one left nothing to tell it from a
      rare real failure.
- [x] **Phase 3 — revisit Phaser (v1.49.0).** Phaser is gone. The board is
      drawn by `src/game/stage/`, 1,651 lines of Canvas2D that do what the game
      used Phaser for and nothing else, and the game has no runtime
      dependencies at all.

      **Measured first, on v1.48.0.** A preview build in headless Chromium,
      phone-sized, five runs each, the median:

      | | |
      |---|---|
      | Phaser's share of the download | 340 of 468 kB gzipped, 73% |
      | parsing and running Phaser alone | 170 ms; 620 ms at 4x CPU slowdown |
      | the whole boot, to the first frame | 441 ms; 1,640 ms at 4x |
      | the game's own script in a siege frame | 1.3 ms; 4.0 ms at 4x |

      On a phone-class CPU the engine is 38% of the boot before a byte of it
      has come over a network. What it does for that is now a short list: one
      camera per board (viewport, zoom, centre); one container; Graphics
      command lists using 21 kinds of call, nearly all of them `Ink` already;
      one image, the baked sheet; two styles of text, the raid's sector labels
      and the battle's shouts; pointer input with a two-finger pinch and the
      wheel; keys by name; fullscreen and resize; and a scene lifecycle of
      init, create and update with four events. No tweens, physics, masks,
      depth sorting, sprites, loader or audio: the game never used them.

      **The decision: replace it with a stage of our own**, Canvas2D, that does
      that list and nothing more. The bar, set before the first line:

      - every harness passes, and the scenes look the same side by side;
      - a frame costs no more than it does under Phaser, in the same browser;
      - the download and the boot fall by what Phaser weighs.

      If the frame bar fails, the stage caches the static layers and tries
      again; if it still fails, Phaser stays and this entry says why.

      - [x] **3a — the stage.** `Game`, `Scene`, `Graphics`, `Container`,
            `Image`, `Text`, `Camera`, input and an emitter, under
            `src/game/stage/`, with 19 unit tests: the command lists, the
            camera's arithmetic, what a container owns, where text says it
            is, the order a scene lives in, the names keys go by, and the
            image's resampled copy. The names and the behaviour are Phaser's
            wherever the game leaned on them. Three places differ on purpose:

            - **Presses are heard on the canvas alone**, with the pointer
              captured, so a press on the DOM never reaches the board. Phaser
              listened on the window and hit-tested every press wherever it
              landed, which is why Phase 1 had the DOM layer stop presses on
              their way up. That code is deleted.
            - **Text is set with `fillText` every frame**, under the camera,
              where Phaser set it on a canvas of its own and drew that as a
              picture. The shouts were a picture scaled up, and soft;
              they are sharp now at every zoom, and so are the raid's sector
              labels. Lines are measured the way Phaser measured them, from
              the ink of a sample, because a line height of 1.2 ems put the
              sector labels five device px off.
            - **The canvas is transparent.** It is painted edge to edge every
              frame, so an opaque one would have been the obvious choice, but
              on an opaque canvas Chrome sets text with subpixel antialiasing:
              the newest shout on the page came out with its fill fattened
              over its outline and fringed blue and orange. Found in a
              magnified side-by-side, not by any harness.
      - [x] **3b — the port.** 23 files changed their imports and very little
            else. The baked ground became an `Image` of a plain canvas; the
            demos' timer loop became an option of the game.
      - [x] **3c — the gate.** 24 of 24, the first run on the stage and again
            on the final tree. Side by side, the SAME battle in both builds:
            a paused clock stepped the same way from the same load, so a
            difference is the drawing and not the moment. Siege, town, raid
            and a Russian siege at six moments: 1.1–1.7% of pixels differ
            faintly, which is antialiasing along edges, and at most 0.15%
            strongly. The strong ones are one column at the board's outer
            frame, where WebGL and Canvas2D round an edge differently, and
            the shouts, which are sharper.
      - [x] **3d — the dependency goes.** `package.json` has no
            `dependencies`, the vendor chunk is gone, the build is one chunk,
            and `build:single` stops if a second one ever appears.

      **What it bought.** `npm run perf`, a phone-sized headless Chromium,
      each boot the median of five:

      | | v1.48, Phaser | v1.49, the stage |
      |---|---|---|
      | download | 1,897 kB, 502 kB gzipped | 467 kB, 178 kB gzipped |
      | boot to the first frame | 454 ms; 1,653 ms at 4x | 133 ms; 534 ms at 4x |
      | the same, Phaser without WebGL | 303 ms; 1,138 ms at 4x | |

      The second boot row is Phaser at its lightest: this container has no
      GPU, so the shipped build's WebGL starts on a software emulation of one,
      which a phone does not pay for. The stage boots in under half of even
      that.

      **The frame bar failed first, and the fallback written into it passed
      it.** Measured properly — both builds painting with Canvas2D, rounds
      taken in turn, the median — the stage came out behind: 534 ms of main
      thread a second in a siege to Phaser's 292, and 23 frames a second to
      37 with the CPU slowed 4x. It was the ground. The stage drew the baked
      sheet smoothed, as Phaser's WebGL did; Phaser's Canvas renderer drew it
      unsmoothed, which is cheap, and makes a dot screen shimmer as it pans.
      Drawing it smoothed at a phone's fit zoom is about four milliseconds of
      software resampling a frame here, for a picture that never changes. So the image keeps a copy resampled to the scale and
      the fraction of a pixel it is drawn at, and draws that one to one: at
      rest, the same pixels; while the board pans, the copy to the nearest
      pixel, made again when the pan stops; through a pinch, the sheet
      itself, and never a copy bigger than two canvases.

      Five more rounds, on the final build:

      | a frame, both on Canvas2D | Phaser | the stage |
      |---|---|---|
      | siege: main thread a second | 339 ms | 325 ms |
      | siege: paint, script a frame | 3.99, 0.97 ms | 4.00, 0.83 ms |
      | siege at 4x | 33 fps | 40 fps |
      | town: main thread a second | 270 ms | 232 ms |
      | town: paint, script a frame | 3.19, 0.73 ms | 2.69, 0.57 ms |
      | town at 4x | 45 fps | 52 fps |

      Level at full speed in a siege — a second session had it 312 to 292,
      the other way, and this machine's runs vary that much — and ahead
      everywhere else, with the ground smoothed.

      **Two instruments were wrong before the bar could be read.** The first
      frame figures compared the stage with Phaser as shipped, which here is
      WebGL on the software GPU: 34 frames a second in a siege where its own
      Canvas renderer holds 60, which made the stage look far better than it
      was. And they came from Chrome's performance counters, which leave out a
      canvas's paint: a canvas drawn from a timer is painted in a task they do
      not count, and in this game that is most of a frame. They reported
      1.9 ms where a trace found 8. `npm run perf` reads a trace now, takes
      `--no-webgl` to hold an old build to Phaser's Canvas renderer, and says
      in its header which comparisons mean something.

      **Found on the way.** The demos' timer waited a sixtieth of a second
      after each frame's work instead of from its start, so a demo slowed
      down as its frames got dearer; it keeps time the way Phaser's did now.
      And `npm run sheet`, the silhouette contact sheet, had not run since
      v1.46: the DOM's own canvases made its screenshot ambiguous, and with
      that fixed the DOM layer covered the sheet with the front door. It
      hides the layer, and draws the glyphs with the `CanvasInk` the drawer's
      rows use, where it had a shim of its own for Phaser's Graphics.

## M31 — "Materiel": the total art and audio pass

The topographic sheet and the twelve silhouette families are good and coherent.
What is missing is everything that sells IMPACT: no muzzle flash, no tracers with
weight, no craters that persist, no smoke, no shake, no destruction states. Audio
is a mixer and some music — no positional combat mix, no reactive score, no radio
chatter with texture.

- [ ] **Phase 1 — an impact vocabulary.** Hit, kill, breach, structure loss; each
      with one visual and one sound, and nothing shipped without both.
- [ ] **Phase 2 — persistent battlefield scarring.** Craters, wreckage, burn
      marks. The board should look like the battle happened on it.
- [ ] **Phase 3 — reactive score and a positional mix.**

## M32 — "Ink": the screentone graphic-novel pass

**Taken first, by owner decision.** Everything M22 through M31 is about what the
game IS; this is about what it looks like, and the owner asked for the look to
change before the systems do. It touches no rule, no number and no table, which
is exactly why it can jump the queue: nothing below has to be re-tuned because of
it, and M31's impact vocabulary now has a language to be drawn in.

The direction was chosen from mockups, narrowing three times — ten art
directions, five comic families, five screentone screens — and what survived is
a black-and-white page shaded with adhesive tone sheets, with one red on it.

The substitution that makes it structural rather than decorative: v1.19 said what
ground you were looking at with HUE and spent its whole value budget doing it,
which is why every silhouette needed a cream knockout to survive being drawn on
top of it. This says it with TONE DENSITY, so the ground is always at least 60%
paper by area and the value budget is free for the things that matter.

- [x] **Phase 1 — the ink palette and the page.** `tone.ts` for the screens,
      `ground.ts` re-baked onto a Canvas2D texture so tone can be a real pattern
      fill. The legend is the sim's own ground classes: open t20, rough t40,
      steep t60, woodland hatched, water cross-hatched, road bare paper.
- [x] **Phase 2 — the objects.** Structures are architecture: v1.19's paper halo
      inverted into an ink keyline, mass filled with paper, hostile structures
      solid. Units are counters: yours outlined, theirs a solid silhouette on a
      paper pad.
- [x] **Phase 3 — the page.** The rail stops being the table the map lies on and
      becomes a panel on the same page. Three control states and no more:
      knockout, disabled, resting.
- [x] **Phase 4 — the kinetics.** Radial focus lines converging on a breach, speed
      lines behind moving armour, an outlined starburst with an alarm core. What
      a particle system would do, done the way the page does it.
- [x] **Phase 5 — verify and ship.** Screenshots read back as images at phone and
      desktop, all 22 harnesses, docs.
- [x] **Phase 6 — the five armies, and the front door.** A mark per faction, drawn
      in the ink vocabulary, on every war slot and every pick. The front door takes
      the knockout masthead it had been skipping since v1.4.

- [x] **Phase 7 — the display face.** Barlow Condensed for every label, mono for
      every figure. Filed as blocked on M30 one release earlier and it was not:
      the trade was never network-versus-nothing, it was 45 KB of inlined woff2
      against a 1.8 MB single-file build. Two weights of the latin subset ship as
      data URIs, so the PWA is still offline and the single file still fetches
      nothing — and the inliner grew an assertion for that, because it had just
      silently stopped being true.
- [x] **Phase 8 — the breach is worth a panel.** A comic does not draw an
      explosion, it LETTERS one, and that was the most recognisable thing the
      direction was still missing. Three families of sound word — a breach, a
      building going, a shell landing — pooled into the world container so they
      pan and zoom with the board. Heavy events got long enough to read (0.4s to
      0.7s), armour got speed lines gated on measured movement rather than on a
      unit kind, and `punch()` got a real cut: it had been ramping ink to nothing
      over a third of its life, which is 300ms spent at exactly the mid grey this
      palette refuses. Found in a magnified frame, which needed an instrument —
      `npm run catch` keeps only the frames where the game is saying something
      that matches a pattern.
- [x] **Phase 9 — the page starts before the game does.** Everything outside the
      canvas was a release behind: a dark boot card, a dark body, a dark
      theme-colour painting the notch around a white game, a manifest still
      describing a topographic sheet, and four launcher icons still olive on
      cream. The icons got a generator, because hand-made binaries are exactly
      what drifts and nothing in the repo could have told you they had. The
      display face moved inline into `index.html`: as a bundled stylesheet it
      was render-blocking in production and JS-injected in dev, so the boot card
      — which paints before any module runs — showed the fallback in dev and the
      real face in production, and no screenshot could tell the difference.

---

## M33 — v1.40 "Portrait": a board a phone can read

**Shipped.** Asked for directly: *"rework the world to be a perfect fit on a phone.
This is a phone game first and foremost."*

The complaint reads as letterboxing and is not. Measured, the world already filled
78–90% of its rect on every device. What was wrong is SCALE: **32 cells across a
390px phone is a 12px cell**, and a 12px cell cannot carry a silhouette, a level
pip or a fingertip.

It took an instrument to see which lever moved it. `npm run fit` scores a candidate
grid against the real board rect on six devices, and its answer was that **neither
lever works alone**:

| | drawer open | drawer shut |
|---|---|---|
| 32x24 (shipped) | 11.3px | 11.3px |
| 20x30 | 10.9px | **18.0px** |

The shipped grid is unfixable by layout — width binds at 360/32 whatever the drawer
does. A portrait grid is unfixable by itself — the drawer refits the board and takes
back everything the grid gave. Both, together, clear the bar on every phone.

- [x] **The drawer slides over the map instead of zooming it.** The board took its
      fit zoom from whatever rect the drawer had left it, so every drag rescaled the
      world under the finger — 19.7px to 7.7px through one drag, measured against the
      previous build. Fit zoom now comes from the rect a SHUT drawer would leave.
- [x] **The sim learns which edge the attack comes from.** `spawnEdge`, absent
      meaning west, so an archived battle re-fights the battle it recorded rather
      than a rotated one.
- [x] **Codecs carry the edge without a FORMAT bump.** Verified rather than asserted:
      the same battle encoded by a v1.39 worktree and by this build produces one
      identical 927-character string.
- [x] **Base plans move into approach space** — `u` is depth, `v` is across — and 184
      generated bases fingerprint identically across the refactor, which
      `archetypes.test.ts` could not have caught because it pins same-input-same-output
      and a consistent shift satisfies that perfectly well.
- [x] **The world turns: 20x30, attacked from the north.** Depth 32 → 30, across 24 →
      20, cells 768 → 600. Depth is what decides a raid; the axis that lost four cells
      is the one nobody walks along.
- [x] **A saved war rotates rather than scrambles.** Transpose plus a two-cell slide —
      the map that carries the old command post to the new one. Anything off the
      vanished corner walks to the nearest free legal cell rather than being destroyed.
      Share codes get the same treatment through the same code.
- [x] **The page follows.** The entry strip draws along the spawn edge with its arrows
      pointing into the board; the view holds its BOTTOM edge as the drawer rises, so
      a base at the foot of a portrait board stays on screen while its build drawer is
      open; the landscape rail takes a little more of the width a portrait world
      cannot use.
- [x] **Re-tune.** Every raid matrix was measured on a 32-cell approach.

### Open, and handed to M22 — answered in v1.41

**The faction spread reopened, and this is the big one.** M11 and M15 each spent
a release closing it; v1.39 measured 4.2 points between best and worst faction
at their own best line. v1.40 measures **23.0**:

| faction | v1.39 | v1.40 |
|---|---|---|
| UNITED STATES | 80.6 | 88.2 |
| PLA EXPEDITIONARY | 78.6 | **95.0** |
| RUSSIAN GROUND | 82.6 | 83.4 |
| KOREAN PEOPLE'S (tunnel) | 78.4 | **72.0** |
| UN COALITION | 81.8 | 80.4 |

China gained 16.4 and the KPA lost 6.4. The obvious worry — that the turn broke
the tunnel mechanic, whose margins were authored against the old board — was
checked and ruled out: 55.8% of the portrait board is still a legal gallery
site, which is where it was. So this is five kits meeting a differently-shaped
problem, not one kit losing its tool.

It is not closed here on purpose. Re-closing a faction spread is what M11 and
M15 each were, and M22 re-tunes on top of a rebuilt combat model — closing it
against the current one means closing it twice. The number is recorded so the
next balance milestone starts from it rather than rediscovering it.

**DUG IN raises destruction instead of lowering it.** A condition that thickens
walls 45% and guns 20% measures 0.420 against a bare 0.405, and the sign holds
at 18 and at 90 runs. Destruction counts structures rather than walls, so it is
not the wall multiplier inflating its own denominator: the reading is that
thicker wire buys breach time the defender can no longer convert into kills,
and a force that gets through anyway has longer inside to raze.
`tests/conditions.test.ts` records the number and asserts only what still holds.

**The residual difficulty shift, and the tuning that was NOT done.** Turning the
board moved the ladder, and the obvious correction was rejected by measurement.
Guns are laid along the entry line, so the reading was that a rung is worth guns
PER CELL of a line that went from 24 cells to 20 — but scaling the count by the
frontage overshot badly, taking a keep from 79.6 mean to 100.0 and leaving tier
4 such a walkover that a +45% wall condition measured no difference at all. One
gun is worth more than the coverage effect. The gun ladder is therefore left
exactly where six releases of tuning put it, and the only generator change that
ships is `ringFit`, which is a correctness fix: a ring wider than the line is
not a bigger ring, it is a ring with holes in its tips.

What that leaves, against v1.39, is SPREAD rather than a shift — which is the
bar this kind of change has to clear:

| shape | v1.39 | v1.40 |
|---|---|---|
| COMPOUND | 100.0 | 93.4 |
| OPEN CAMP | 99.0 | 92.0 |
| CORRIDOR | 94.4 | 81.6 |
| STAR FORT | 77.0 | 76.0 |
| DISPERSED DEPOT | 93.4 | 83.8 |
| STRONGPOINTS | 94.6 | 86.8 |
| KEEP | 79.6 | 90.8 |
| BUNKER COMPLEX | 61.6 | 68.8 |

Mean −2.2 points, from −12.8 (corridor) to +11.2 (keep). Closing the per-shape
gaps is work of the kind M15 spent a release on, and M22 re-tunes on top of the
combat model anyway — doing it now is doing it twice. Worth carrying forward:
**a keep swings 43 points on one gun**, which is a fragility worth naming
whatever the board is.

#### What M22 did with these three

Recorded here rather than left dangling, because a section headed "handed to"
a milestone that has since shipped is a section that stops being read.

- **The faction spread: partly closed, 23.0 → 18.8**, and re-ordered rather
  than compressed. China fell from the ceiling (95.0) to mid (72.0) and the
  KPA rose from the floor (72.0) to the ceiling (77.6); the USA fell furthest,
  88.2 → 58.8. The chain did that without being aimed at it — asking for four
  capabilities suits five different rosters better than asking for one. Still
  open, and now with a companion: the parity MEAN fell 83.8 → 68.2 and tier 5
  sits at 8/32/12/72/0, which is a wall rather than a curve.
- **DUG IN's inverted sign: FIXED, and the chain is what fixed it.** Thicker
  wire used only to buy breach time the defender could not convert, because
  the post could be shot down from standoff whether or not the wire was cut.
  Wire is stage one of four now and nothing past it can be done at range, so
  the same +45% costs a raid 42% of its progress — 0.67 stages against 0.39 —
  and 50 points of clear rate at a stronger force. `tests/conditions.test.ts`
  asserts the direction instead of recording a defect.
- **The keep's 43-point swing on one gun: still open, and now understood.**
  M22 found the mechanism while explaining something else: a tough,
  long-ranged, dual-purpose gun sited inside the post's 4-cell cover radius is
  a SUPPRESSION GATE, not just damage, and the defence rows price that at two
  to three ladder levels. A keep concentrates exactly such guns around its
  post. Whether three rungs from one building is the intended weight is the
  open question; the cover radius is the lever.

### What it cost the harnesses

Seven E2E harnesses failed, and only two of them were finding anything real. Five
carried their own copy of the grid's dimensions, or a box of coordinates drawn
around where the base used to sit, and all five reported "no free cell in view" —
which reads like a camera bug and was arithmetic. They ask the board now, through a
`grid()` seam. The other two were honest: a sideways drag cannot prove the board
pans when the portrait world's width is the axis with slack, and map marginalia is
not static text running off the screen.

---

## M34 — v1.45 "Thumb Scale": a board you never have to zoom

Picked from a brainstorm of five phone overhauls, as the one that improves the game
that exists today without changing a rule. M33 made the board READABLE on a phone;
this makes it TOUCHABLE. They are different bars: a silhouette reads at 18px, a thumb
needs about 44.

**What `npm run fit` says** — CSS px per cell with the whole board in view, and rows
still visible above the drawer at rest:

| grid | 360 wide | 390 | 412 | 430 | rows in view, drawer at rest |
|---|---|---|---|---|---|
| 20x30 (shipped) | 18.0 | 19.5 | 20.6 | 21.5 | 18-19 of 30 |
| 10x15 | 36.0 | 39.0 | 41.2 | 43.0 | 9-10 of 15 |
| 9x14 | 40.0 | 43.3 | 45.8 | 47.8 | 8-9 of 14 |
| 8x12 | 45.0 | 48.8 | 51.5 | 53.8 | 7-8 of 12 |

Checked twice: a second, independent instrument written for this milestone agreed
with `fit.mjs` to the decimal, and it had itself been checked against the live board
camera at 0.0% off on six viewports. It was then deleted, because it duplicated an
instrument M33 already shipped.

**Two findings that shape the milestone, both before any design work:**

1. **No grid that keeps this game reaches 44px on every phone.** Width binds in
   portrait, so the 360-wide phone decides for everyone: 10 columns is 36px there
   whatever else changes.
2. **The drawer hides a third of the board at every grid size.** Rows in view drop to
   about 60% with the drawer at rest, for every shape in the table. A smaller grid
   alone does not make the board visible — it is half the fix, and the drawer is the
   other half. That is M33's finding again, one level down.

**The size is 10x15, and discreteness chose it rather than pixels.** Things that are
already one cell cannot shrink — a wall, a gun — so a smaller board is more crowded,
and the question is by how much. A fully built CC3 base, walls scaled with length:

| grid | scale | a 2x2 becomes | built at full CC3 |
|---|---|---|---|
| 20x30 | 1 | 2x2 | 33% |
| 10x15 | 1/2 | **1x1 exactly** | 59% |
| 8x12 | 2/5 | 1x1 (rounded) | **80%** |

8x12 clears 44px on every phone and is not a board a maxed base fits on, once the
spawn lane and a legal path are counted. 9x14 is not a uniform scale of 20x30 at all
(20 → 9 is 0.45, 30 → 14 is 0.47), so distance along the approach and across it would
mean different things. 10x15 is the only candidate that is a clean half: every 2x2
building becomes exactly one cell, a saved town downsamples 2:1, and nothing rounds.
It lands at 36-43px — twice today's cell on every phone, and short of 44 by the width
of the smallest screen. Placement is aim-then-confirm, which absorbs a near miss, and
Phase 7 holds that assumption to a real test rather than leaving it assumed.

**The principle: a similarity transform, not a redesign.** Every length halves —
ranges, splash, cover radius, aura and trigger radii, strike strips, spawn positions.
Every speed halves too, in cells per second, so a unit crosses the board in exactly the
time it does today: waves, prep and the battle's length are unchanged. Wall budgets
halve, because walls work as LINES across the approach and a line is half as many
segments. The game should play as it does now, drawn twice as big. What it cannot
preserve is the one-cell things, and **balance is judged as drift from v1.43**, which
is the cost of discreteness and nothing else. *Phase 4 measured this principle, and it
does not hold. See Phase 4.*

**The architecture is one parameter.** The engine takes its catalog once, in its
constructor, and all 29 reads of a range, speed or radius go through it. So
`SimConfig.cellSize` — absent meaning 1, meaning today — scales the catalog once at
construction, and the catalog's numbers become physical units that never change. A
replay minted before M34 has no field and re-fights exactly the battle it recorded.
It is the pattern `TERRAIN_VERSION`, `CHAIN_CURRENT` and `spawnEdge` already follow.

- [x] **Phase 1 — an instrument.** `npm run fit` now marks the touch floor beside the
      readability one. The table above is its output.
- [x] **Phase 2 — `cellSize` in the engine, inert at 1.** `sim/scale.ts` divides
      ranges, splash, trigger, heal and aura radii, speeds, `coverRadius`, strike
      geometry and `AIR_STANDOFF`, and a 2x2 becomes one cell. At 1 it returns the
      catalog it was handed — the same object, so a pre-M34 battle re-fights on its
      own numbers by construction rather than by arithmetic.

      Three things the tests turned up. Upgrade levels merge SHALLOWLY onto a base
      profile, so a level's weapon replaces the base weapon outright; an unscaled
      override would have put every levelled gun back at its big-board reach. The
      terrain generator's avoidance set took the Command Center as a literal 2x2.
      And the determinism test's liveness check failed on its first run, correctly:
      the bare yard's post fell by tick 1500, so half its checkpoints were comparing
      two dead battles. It runs on a garrisoned town now.

      A classification walk over every shipped catalog fails on any numeric field
      declared neither a distance nor not one — a radius added next year cannot slip
      past the scaler. And the claim the milestone rests on is pinned directly: at
      cell size 2 a unit covers the same ground in the same time.
- [x] **Phase 3 — content stops assuming a width, through one rule.** Spawn positions,
      base plans and saved towns all have to move from a 20-wide board to a 10-wide
      one, and they can share a single mapping. The centre-preserving map for a
      column, `round((c + 0.5) / 2 - 0.5)`, is exactly `floor(c / 2)` for every
      integer — checked, not assumed — so content stays authored in today's
      coordinates as PHYSICAL positions, the way the catalog stays in physical units,
      and a board of cell size 2 maps position `p` to cell `floor(p / 2)`. A pair
      mirrored about the BOARD's axis stays mirrored, exactly. That is narrower than
      this entry first claimed — "symmetric spawn pairs stay symmetric" — and a test
      caught it: the waves pair their columns about column 10, half a cell right of
      a 20-wide line's true centre, so odd pairs map exactly centred (7/13 → 3/6) and
      even ones a unit right (8/12 → 4/6). And a 10-wide board has no centre column,
      so the 1x1 post lands a unit left of the axis today's 2x2 straddles. What the
      rule cannot do at all is put two things in one cell: two guns in one 2x2 block
      collide, and every place that maps a plan has to say what happens then. Terrain
      gets a new version sized to the board; version 1 stays frozen for the battles
      fought on it. Wall budgets 50/80/120 → 25/40/60.

      Done as `sim/board.ts`. `coarsenConfig` maps a config onto a board `factor`
      times coarser by that rule. A block is wall when at least half of it is wall:
      that keeps a solid line solid, never closes an opening, and is exactly
      mirror-symmetric. The rejected alternatives each changed what a base IS —
      "any wall" sealed the EARLY base's gap, "all wall" erased every one-thick
      line. Half-or-more's costs run one way: a gap across a block edge comes out
      twice as wide, and a piece of wall that leaves less than half a block in every
      block it touches disappears. A lone cell always does, and so does a two-cell
      stub across a block edge. Two claims on one cell, the post and the lane are
      REPORTED, never dropped silently. Terrain and the town's wall-budget constants
      belong with the boards themselves, so they move to Phase 5.
- [x] **Phase 4 — the similarity check, and the go/no-go.** The balance harness runs
      identical matchups at `cellSize` 1 on 20x30 and 2 on 10x15, plans downsampled,
      and reports the drift in every table. Inside the noise floor, the transform is
      sound and the milestone proceeds. Outside it, the drift is named — crowding is
      the prime suspect — before anything moves.

      **Verdict: outside it, by eight times. 10x15 is not today's game drawn bigger.**
      `npm run balance -- --similar` fights every cell of the defence matrix four
      ways. FINE is the published seeds. NULL is fresh seeds on the same board — the
      noise floor, measured rather than assumed. COARSE is the plan mapped to 10x15.
      REFINED is the coarse plan put back on the fine grid. So the drift splits into
      what the MAPPING did to the plan and what the GRID did to the battle, one
      variable each. Before anything was trusted, the FINE pass reproduced the
      published v1.43 tables, 180 cells of 180.

      | step | what changed | mean shift | drift per cell | × noise | rows whose 50% level moved |
      |---|---|---|---|---|---|
      | NULL | the seeds | +0.4 | 1.3 | — | 0 of 15 |
      | MAPPING | the plan | +1.8 | 4.9 | 3.7× | 5 of 15 |
      | GRID | the board | +7.0 | 8.7 | 6.6× | 5 of 15 |
      | TOTAL | both | +8.8 | 10.7 | 8.2× | 8 of 15 |

      Hold% points. The split is approximate in one known way. A refined wall is a
      solid 2x2 block, twice the thickness of today's one-cell line, and a refined
      one-cell gun sits half a cell from where it was.

      **Crowding, the prime suspect, is not what moved it.** The mapped fixtures come
      out with LESS wall, not more: 16 → 5, 30 → 8 and 46 → 18 segments. Half-or-more
      trims line ends and dissolves MID's serpentine stubs, and LATE loses an
      autocannon to the post's cell. Those are the mapping's costs, and they are
      named.

      The bigger half is the grid, and one battle shows it (NK, MID, level 9). On
      10x15 the defence held 17 of 20; with the same coarse plan on the fine grid, it
      held 0 of 20. Frozen at the stall, four Abrams stand on the perimeter cell north
      of the post. The nearest covering gun is 2.24 cells away, and a tank's range is
      now 2.0. On today's board the same tanks stand 3.61 from it, with a range of 4.
      The post cannot pass SUPPRESS while that gun lives, and nothing tells the tanks to
      go and kill it. Ninety seconds later the stall rule wipes them — twice in that
      battle. On a board of half-cells, three things land on knife-edges: where the
      post's centre is, which cell an attacker stops on, and a gun's range against
      the cover radius. The nest holding that post shut sits at exactly 2.00, the
      cover radius.

      Two structural fixes were tried and both failed. Strict cover (a gun exactly at
      the radius stops covering) collapsed LATE instead: NK LATE level 11 went from
      100 on the coarse board to 5, against 40 today. A 2x2 post on the coarse board
      made MID more defender-favoured, not less: NK MID level 8 went to 95, against
      80 coarse and 10 today. A rule whose result turns on `<` versus `<=` is sitting
      on a quantisation boundary.

      **A worry this raised about the shipped game, and its answer.** 43.7% of the
      matrix's defender wins on today's board include a stall wipe-out. Every one of
      them fired with nobody else alive, and none removed more than one unit on the
      ground. 90% came at CHARGE, and what they removed was mostly aircraft. On
      today's board the rule is cleanup, not a defence.

      **A candidate, measured: kill chain v4** (`CHAIN_ENGAGE`, not current). It is
      version 3 plus one behaviour: a crew on a covered post, with no covering gun in
      its reach, goes after the nearest one. That is the chain's own design line — "a
      gun that can reach the post covers it, and the answer is to kill the gun" —
      made into behaviour. On the coarse board it does what it is for. Stall
      wipe-outs in defender wins fall from 34.6% to 22.7%, and every row becomes
      monotonic. Under v3, NK MID rose 20 and 25 points between levels, and all five
      LATE rows held 100% through level 12. What v4 does not do is restore similarity:
      it is still 8.3× noise, now toward the attacker (mean shift −9.9). Where each
      row first drops below 50% held:

      | | EARLY (CC1) | MID (CC2) | LATE (CC3) |
      |---|---|---|---|
      | today, v3 | L3-4 | L7-10 | L11 to past L12 |
      | 10x15, v3 | unchanged | mostly +2; UN never falls, NK −1 | all past L12 |
      | 10x15, v4 | unchanged | 0 to −3 | −2 to −4 |

      On today's board v4 moves 4 of 15 of those levels by one, three of them toward
      the attacker, and leaves EARLY alone.

      **What this means.** This milestone was picked on a premise: it improves
      today's game without changing a rule. That premise does not hold. On 10x15 the
      difficulty ladder moves about two levels at MID and LATE, by a different amount
      in every row, and the kill chain needs a new rule to stay sane. A 10x15 game can
      be built — v4 makes its curves monotonic, which is what a re-tune needs to fit.
      But it would be a new game, not a port. It needs bases authored for the new
      board, a ladder re-tuned rather than drift-corrected, and saved towns migrated,
      and choosing that is a design decision rather than a measurement. One phase does
      not depend on the choice. The drawer (Phase 6) hides a third of the board at
      every grid size, and because the width binds in portrait, a 20x30 board and a
      10x15 board stand exactly as tall on screen. **Phases 5, 7 and 8 wait on that
      decision.**
- [x] **The decision (2026-09-23): build it, as a redesign.** Phase 4 said a 10x15
      board is a different game; the owner chose to build that game. First, the
      three reference bases were drawn FOR the board rather than mapped onto it
      (`npm run balance -- --native`): the same lines with the same openings in
      the same order, the same guns in the same roles, and the same number of
      guns covering the post, none of them on the cover radius's knife-edge.
      Fought against today's published rows, seeded cell for cell:

      | where a row first holds under half | EARLY | MID | LATE |
      |---|---|---|---|
      | today, 20x30, chain v3 | L3-4 | L7-10 | L11 to past L12 |
      | native 10x15, chain v3 | L3-4 | plateaus at 40-55% and never falls | mostly past L12 |
      | native 10x15, chain v4 | L3-4, unchanged | 1-3 levels sooner, a cliff at L7 | 1-2 sooner |

      On v3 the bases are held by the stall rule rather than the guns: 54% of
      defender wins include a stall wipe-out, and the plateau is that rule
      catching crews stuck on a covered post. So the new board fights **chain
      v4**, and v4's constants stay open until it ships. The re-tune starts at
      MID, where v4 is harder than today and steeper.

      Drawn content is also what the rest of the move needs. The eight
      generator plans, the terrain and the assault spawns are authored at 20x30
      precision, and the mapping rule cannot carry a one-cell line or a
      two-cell gap. Replays do not need the old generator, because a replay
      code IS its config, layout included; terrain does need its old version,
      because a config carries only a terrain seed.

- [x] **Phase 5 — the boards move.** `TOWN_GRID` and the raid map to 10x15;
      `gridVersion` 2; saved towns downsample 2:1 on load. That is lossy where two guns
      shared a 2x2 block, and whatever does not fit is refunded rather than dropped.
      Generated bases, share codes and replay codes carry their grid, as M33's did.

      Done as each piece made board-agnostic while the game is still on 20x30,
      identical there, and then one flip:
      1. Replay codes carry `cellSize`; share codes already carry the grid.
      2. The UI draws footprints, ranges, radii and strike geometry from the
         catalog as the board scales it, not as it is written.
      3. Terrain version 2, sized to the board; version 1 frozen.
      4. The eight generator plans drawn for a 15-deep, 10-wide approach.
      5. Assault spawns, missions and the garrison checked for board
         coordinates.
      6. The town: grid version 2, wall budgets 25/40/60, placement, the demo
         towns.
      7. Saved towns migrate by the one rule. What collides walks to the
         nearest free cell, as M33's did; walls past the new budget are
         refunded.
      8. The flip: `TOWN_GRID` and `MAP_W`/`MAP_H` to 10x15 at cell size 2,
         `CHAIN_CURRENT` to 4.

      **Done.** Three things turned up that no single piece had shown:
      - **The raid planner drew the wrong ground.** Its preview asked for the
        terrain without the base's buildings, so all 60 bases sampled previewed a
        different river from the one the raid was fought on, about 53 cells apart.
        It was wrong on 20x30 too, and shipped alone as v1.44.1.
      - **Terrain version 1 is a slope written in cells.** The same tilt over half
        as many cells made 15.6% of the board steep, against 6.1%. Version 2
        divides the tilt and the valley by the cell size.
      - **The generator sealed its own bases** once a wall line was one cell
        thick at two units a cell. On the first try, 81 of 84 keeps had no way in,
        and the coarser board also exposed an older bug in the camp's stubs that
        had sealed a third of camps on 20x30. Walls now go down first. A one-cell
        gap between two walls is kept clear as a walkway, with the cells in front
        of and behind it where the wall runs on. Nothing is built on the post's
        four neighbours, and the stores go last, with a ring to fall back on.
        Every shape has a way in on 81 to 84 of 84 sampled bases, with the guns
        and stores it had.

      Saved towns move by the one rule. A block of the new board is wall when half
      of it was, and a building that lands on a taken cell walks to the nearest
      free one. Every wall that does not come across is refunded: merged into a
      block with another, or past the new budget of 25/40/60 by CC level.
- [x] **Phase 6 — the drawer gets what the board leaves.** Its resting height is sized
      from the grid instead of a fixed 42%, never less than the handle and the tabs, so
      the whole board is in view at rest. Target: 15 of 15 rows.

      **Done on today's 20x30, since it never depended on the grid.** The drawer
      opens onto `DRAWER_REST`: the room the world leaves below itself at the fit
      zoom. It is never less than two rows of list, because a drawer with less is a
      strip you cannot compare two options in, and never more than HALF. It is a
      name rather than a share, resolved on every layout, because the right height
      depends on the world's shape as well as the phone's, and a rotation or a URL
      bar has to re-measure it. HALF and FULL stay as drag detents, and a tap on the
      handle toggles between rest and shut. Rows in view, from `npm run fit`, before
      and after:

      | viewport | cell | drawer at 42% | at rest |
      |---|---|---|---|
      | small Android 360x800 | 18.0px | 18 of 30 | **30 of 30** |
      | iPhone 13 390x844 | 19.5px | 18 | **30** |
      | Pixel 7 412x915 | 20.6px | 19 | **30** |
      | iPhone 15 Pro Max 430x932 | 21.5px | 18 | **30** |
      | iPad portrait | 35.0px | 15 | 28 |
      | iPhone 13 from the home screen | 19.5px | 15 | 26 |
      | iPhone 13 in a Safari tab | 17.6px | 14 | 24 |
      | small Android in Chrome | 17.3px | 14 | 24 |

      Full-screen phones show the whole board. Elsewhere the world leaves less than
      two rows of list below it, and the drawer rests on its floor. In a browser tab
      or on a tablet the world fills the height outright; on a notched phone from
      the home screen it leaves 42px. That still shows 24-28 rows where the old
      drawer showed 14-15, and one tap on the handle shows all 30. The last three rows of the table are new. Every earlier row was
      a whole screen, which is only what the game gets in fullscreen, so the
      instrument now also measures phones as they are actually held. It emulates
      the notch through the game's own inset probe, and checks the game saw it.
      The first attempt didn't, and measured a notch of zero.

      **Two defects in the handle, both older than this phase, found by holding the
      finger still.** The handle converted a finger's pixels to a share using the
      height the drawer can travel, and `computeLayout` multiplied the share back by
      the safe height, about 17% more. So the drawer jumped on the first pixel of a
      drag and then ran ahead of the finger: on the build before this phase, a 120px
      drag moved it 208px. And the list claimed its press by testing the press point
      against the list rect as it was NOW. A handle drag had already grown the
      drawer by then, so the list's top slid up past the finger and read the press
      as its own: the same 120px drag scrolled the list 372px. Every check
      `e2e-drawer` had asked where a drag LANDED, and a release snaps to a detent,
      which is right however far off the drag was. Both are now checked mid-drag,
      and both checks were seen failing on the old build first.

      The instrument had a defect of its own too. It rebuilt the shut board from
      the list height, so in landscape it took the rail's list for a drawer, and
      reported a desktop at 45px a cell and 18 rows of 30. It is 26.7px and all 30.
- [x] **Phase 7 — the ~330 hard-coded cells**, across 25 test, harness and tool files,
      move onto the board's own seams. Plus the milestone's acceptance test: on the
      360-wide phone, at fit zoom, place on a named cell first try with a real touch.

      **Done.** Seventeen test files moved onto the new board. Where the old
      geometry was the point they were halved, so the same ground is tested. The
      balance harness measures the game as played: each reference base carries the
      board it is drawn on, the 10x15 bases are the reference set, and the 20x30
      ones stay as fixtures for `--similar` and `--native`. Those two measure
      against v1.44's tables, frozen in the harness because the snapshot moves on,
      and `--similar` still reproduces them 180 of 180 cells.

      **The acceptance test is `e2e-thumb`.** On a 360-wide phone with the drawer
      at rest, the whole board is in view, 150 of 150 cells at 36.0px. One touch a
      quarter of a cell off centre, then CONFIRM, builds on the cell the test named
      before it looked at anything. The same touch moved three quarters of a cell
      builds on the neighbour, and the test was seen failing on that before it was
      trusted. It is the first harness that could fail that way: every other one
      placed by scanning for whatever free cell was on screen.

      Also found on the way:
      - **Two rows of the snapshot measured nothing.** The engine skips a layout
        piece that does not fit, without a word. The Engineer Corps HQ was a 2x2
        on the last row of the 20x30 board from v1.40 on, and the AA cover's
        forward mount stood on MID's inner wall. The harness now refuses any
        reference layout that does not land, and both rows are redrawn.
      - **The town demo died on load.** Seed 4242's river runs under the
        showcase's second depot on this board. Every showcase placement now
        throws with its reason instead of failing quietly.
      - **Chain v3 reported itself as v4** from the flip on: it named its version
        as `CHAIN_CURRENT`. A test now checks that every model is filed under its
        own version.
      - **Three harnesses wrote cells for boards the game had left.** The share
        harness had been scattering a 32-wide wall line across the 20-wide board
        since v1.40.
      - **The wheel and the pinch had never zoomed about the point under them.**
        Both read their anchor back through a camera matrix that Phaser rebuilds
        only at the next render, so every notch slid the view. Six notches at the
        middle of a portrait phone slid it 127 world px. On the 20x30 world that
        still left room to pan. On 10x15 it pinned the camera in a corner, and the
        gesture harness's pan check failed. Both now anchor on the rig's own
        centre and zoom, and the harness checks the anchor itself: 0.3 px.
      - **The yard's wire order asked for twice the wire.** LAY TWENTY WALL
        counted segments, and a segment is two units now, so twenty was four
        fifths of a CC1 town's whole budget. It is LAY TEN WALL: the same length.
- [x] **Phase 8 — re-tune from the drift report, regenerate the snapshot, ship.**

      **The ladder, not the chain.** On the board as flipped, the defence rows
      first held under half 1.13 levels sooner than v1.44's, and MID fell off a
      cliff. The third heavy, at level 7, took three factions' MID from holding
      every seed to holding one or none. Chain v4 is why: a heavy that reaches a
      covered post now kills what holds it shut. MID's only covering gun is a
      mortar, which cannot fire at what stands next to it. But the chain decides
      raids too, and the raid tables had not drifted, so a chain made kinder to
      defenders would have bought the defence rows back with the Front Line's top
      rungs. The assault ladder is fought by town defence and nothing else.
      `--retune` priced twelve ladders against where v1.44's rows first held
      under half:

      | ladder | mean shift | mean \|shift\| | EARLY | MID | LATE | contested per row |
      |---|---|---|---|---|---|---|
      | v1.44's, on 10x15 | −1.13 | 1.13 | −0.20 | −1.80 | −1.40 | 1.60 |
      | a heavy every 3 levels | −0.67 | 0.67 | −0.20 | −1.20 | −0.60 | 1.47 |
      | +7% a level | −1.00 | 1.00 | −0.20 | −2.00 | −0.80 | 1.60 |
      | a heavy every 3, +7% | −0.33 | 0.60 | −0.20 | −1.00 | +0.20 | 1.67 |
      | a heavy every 4 | −0.40 | 0.40 | −0.20 | −1.00 | 0.00 | 1.40 |
      | a heavy every 4, +6% | +0.13 | 0.53 | −0.20 | −0.20 | +0.80 | 1.80 |
      | **a heavy every 4, +7% (shipped)** | **−0.07** | **0.33** | −0.20 | −0.40 | +0.40 | 1.53 |

      v1.44 had 1.67 contested levels per row. In the shipped ladder every row
      lands within one level of v1.44's, ten of fifteen exactly, and none rises.
      Rotors were not the problem: every three levels instead of two left MID
      exactly where it was. EARLY's −0.20 is the USA's alone, at level 3, and no
      ladder priced here moved it.

      **The deal was chosen again.** A layout index names a different base now,
      so `--layouts` re-selected every rung's three (shape, layout) pairs against
      the same curve, 100/95/85/70/55. Parity at each faction's best line went
      from 18.8 points of spread to 8.0. The keep now reaches three factions of
      five. At T4 and T5 Russia's reference force clears it 0-8% on 22 of its 24
      layouts and the UN's on all 24, so the selection does not deal it to them.
      *Redesigned in v1.45.2; see the follow-up below.*

      Shipped as v1.45.0, with `docs/BALANCE.md` regenerated. `--native`
      reproduces its bare defence tables 180 of 180 cells.

      **Decided (v1.45.2): a wall segment still costs what it did.** A segment is
      two units of wire now, and the budget halved with it, so a line across the
      approach costs half the Supplies: a full CC3 budget of the USA's plain wall
      is 600 where it was 1200. The migration's refund assumes that price, and
      the harness does not see it, because its defence rows are the permanent
      layer with nothing spent. The owner kept the price: cheaper wire is the
      new board's, and nothing measured says it needs taking back.
- [x] **Follow-up (v1.45.1) — the campaign, which nothing had measured.** The
      balance harness has always priced the assault ladder and never a mission, so
      Phase 8 re-tuned the one and could not see the other. `--missions` fights every
      mission against the three reference bases, permanent layer alone, and holds it
      up against v1.44's campaign, frozen before anything moved. The base a campaign
      allows at a mission, by the command post level unlocked by then, is the one it
      was tuned in.

      Every mission that brings heavies had drifted toward the attacker, by about
      forty points at that base, and not one mission without heavies moved. That is
      the ladder's finding again. No single thinning rule served all five campaigns:
      halving each wave's heavies left NK's missions 40 points short, and a finale's
      four tanks wanted to be two for one faction and one for another. So each mission
      was fitted like the deal (`--missions fit`), choosing WHICH heavies stay, and
      every one of them landed on two:

      | mission (MID) | heavies | v1.44 | on 10x15 as written | now |
      |---|---|---|---|---|
      | USA M7 ARMOR PROBE | 3 → 2 | 95 | 43 | 95 |
      | China M5 ARMOR SPEARHEAD | 3 → 2 | 55 | 0 | 70 |
      | China M6 THE TIDE BREAKS | 4 → 2 | 15 | 0 | 10 |
      | Russia M5 STEEL ON STEEL | 3 → 2 | 95 | 53 | 98 |
      | Russia M6 THE CORRIDOR HOLDS | 4 → 2 | 68 | 0 | 73 |
      | NK M5 UP THE 101 | 3 → 2 | 75 | 0 | 55 |
      | NK M6 DAYLIGHT | 4 → 2 | 35 | 0 | 30 |
      | UN M5 ARMOR ON THE FIVE | 3 → 2 | 90 | 0 | 88 |
      | UN M6 THE MANDATE HOLDS | 4 → 2 | 13 | 0 | 13 |

      Forty seeds a side. Picking the nearest of up to sixteen options flatters the
      pick, so the choices were fought again on forty seeds they were not chosen on:
      mean shift +0.1, mean |shift| 7.7, the largest UN M6 at +23. Across all 33
      missions the campaign is now 0.6 points off v1.44 on average.

      **One cell is left, and it is not the tanks.** LANDFALL, the USA's finale,
      fought with CC2 instead of the CC3 unlocked two missions earlier, holds 0%
      where it held 88%. With no heavies at all it holds 15%, so no armour fit can
      reach it. Its own base, CC3, holds 90% against 100%, and it is left as it is.
      The campaign is now a table in `docs/BALANCE.md`, which it had never been.
- [x] **Follow-up (v1.45.2) — the keep, which two factions could not take.**
      The owner chose a redesign over dealing Russia and the UN seven shapes.
      Their raids on the keep never passed the first stage of the kill chain:
      108 and 132 of 144 failed at BREACH, with the force dead and 2.8 and 4.9
      guns still standing. So it was not the post. The walls were not it either:
      a second inner gate changed nothing, and a wider outer gate or no inner ring
      barely moved Russia and left the UN at zero. The split was by doctrine. The
      three reference forces that HUNT guns (Russia, UN, KPA) cleared it 7, 0 and
      11 times in 144, and the two that go for the post (USA, China) 54 and 58.

      The 20x30 keep stood its guns around a wide ring, at its corners and axis
      points twelve units apart. The 10x15 redraw had to keep one-column side
      corridors clear, so every gun went into the bands in front of and behind
      the post, inside every other gun's arc, and a raid that hunts guns met all
      of them at once. Fewer guns was a blunt lever: at 1.0x instead of 1.2x
      Russia cleared 36 and the UN still 6, and at 0.8x the UN reached 20 only as
      the USA reached 96. Spreading them is the precise one. Now one gun
      stands in each corner of the two bands and the rest in outworks a row
      outside the outer ring. That is the same number of guns, and it seats them
      all: the old spots came up short on 180 of 840 keeps.

      | T4-T5, of 144 | Russia | UN | KPA | China | USA |
      |---|---|---|---|---|---|
      | guns in the bands | 7 | 0 | 11 | 58 | 54 |
      | guns spread | 54 | 12 | 58 | 86 | 59 |

      For Russia, the UN and the KPA it is still the third hardest of the eight
      shapes. The deal was chosen again, and the keep is dealt to all five
      factions: Russia at T4 on a layout it clears 58%, the UN at T4 on one it
      clears 67%. Every faction meets all eight shapes again.
- [ ] **Later, and optional — landscape rotates the VIEW, not the sim.** A deep board
      in a short screen is 27px in phone landscape; the same board turned sideways is
      41px. The sim keeps its edge; only the camera turns.

**Risks, named before they are met.** A maxed base goes from 33% to 59% of the board,
and whether it still leaves a legal path is a measurement, not an assumption. Saved-town
migration is lossy by construction. And the open CC1 question — whether the onboarding
stage is meant to be contested — gets harder on a coarser board, not easier.

---

## Sequencing — and the one rule that is not negotiable

**M32 is done and out of the way.** It was taken first at the owner's request and
changes no number, so nothing below inherits anything from it except a language
to draw in.

**M22 next.** The carry defect invalidates the entire planning half and every
balance table in the repo. Then **M23**, because the action pillar is the
least-built half of a game whose FIRST design pillar it is. Then **M30**, the
cheapest large win, which also unblocks the UI surface that M23 and M29 both need.

*M22 and M23 are done as planned (v1.45.3), except M23 Phase 5: the damage verbs
still need a job the kill chain can see, and that is a design problem where the
rest of the milestone was a measurement one. It can go before or after M30.
Nothing in M30 changes a number it would be judged on.*

*M30 Phase 1 shipped in v1.46.0: the UI is DOM by default. Phase 2 deletes the
canvas kit once v1.46 has been out a release without anyone needing
`?ui=canvas`.*

*M23 Phase 5 shipped in v1.47.0, so every phase M23 was written with is done. What
it hands on is rule order: TRIPWIRE and now COUNTERBATTERY both lose a strike or a
gun to a cheaper rule that spends first. It is a standing-orders question with a
replay-format half, and it can go before or after M30 Phase 2.*

*M30 Phase 2 shipped in v1.48.0: the canvas UI kit is deleted. Phase 3, whether
Phaser still earns its 340 kB gzipped for a board, is a measurement before it is
a decision, and rule order is the other open item.*

*M30 Phase 3 shipped in v1.49.0: it did not, and the stage replaced it, so M30
is done. Rule order, which M23 handed on, is the open item.*

*M23 Phase 6 (v1.49.1) measured rule order where standing orders fight, the
offline probe, and no order of any preset changes one. It is not made the
player's. What it found instead, probes billing a town for the garrison's own
mines, is fixed. What standing orders are for is the open item now.*

*M24 Phase 1 (v1.49.2) pointed the first harness at the town: storage holds half
an hour of production, the whole town is bought within the first day, and a full
store kept none of what the battles paid, which is fixed. Phase 2 inherits an
economy with nothing to buy on day two, and has to answer that before adjacency
and power can matter.*

*M24 Phase 2 (v1.50.0) cut production to a twentieth, so a store holds a night,
the town takes three days, and a siege pays hours. The damage that lasts turned
out to be the wreck, which already existed; it is now priced where the player can
see it. What is left is a surplus after day three that only the war spends, and
filling it is Phase 3's job: adjacency and power.*

*M24 Phase 3 (v1.51.0) made layout an economic decision: power from the post and
from generators, and neighbours that feed each other. A good yard makes a third
more and defends no worse. It also showed that where a town's economy stands moves
what its defence holds by more than any rule does, and the defence tables measure
the permanent layer alone. Phase 4 (chains and districts) is still the sink for the
surplus, and a defence table with an economy on the board is the balance question
it hands on.*

*M24 Phase 4a (v1.52.0) built the works, which turn supply production into fuel and
intel, and made research a graph, with two tiers on each branch that need a tech
from another branch. The graph is bought about three days after the town, and its
top tiers move a defence about as far as the first ones did. The week the plan
wanted would have taken timers measured in days, and GDD 2.3 refuses those. In a
fortnight with no war, most of what the town makes is still lost to a full store,
because only the war spends fuel and intel. A fortnight at war is the measurement
4b needs first.*

*The week at war (v1.52.1) measured it: the war pays for itself. Raids more than
repay their losses, and even a commander who raids and skirmishes every session
loses 44-60% of what the town makes to a full store, against 70% in peace. So
districts are set aside, and M24 is done. The sink belongs to M25's supply and
attrition. Two siege bugs were fixed on the way: a wrecked bunker burned what
it held, and a siege cut back loot that stood above the cap.*

*M25 Phase 1 (v1.53.0) gave the Front Line a place. Each faction's war runs up a
real road from its base toward the enemy's stronghold, twelve towns and three
lanes, and the rung is how far up it the front has been pushed. The map is
derived from the rung and adds nothing to the save, so no battle moved. Phase 2,
enemy agency, is where held ground has to become state.*

*M25 Phase 2 (v1.54.0) made it state. When the front is quiet for 36 hours, the
enemy retakes a sector of the town behind it, and a day later a second, cutting
roads to the front; losses left standing can push the front back. A commander who
raids daily loses nothing, and one away for days loses a raid in three to
retaking. Phase 3, supply and attrition, reads against the same table.*

*M25 Phase 3 (v1.55.0) made holding ground cost supplies: five an hour for each
rung of a held sector's distance from home, out of what the depots make. It is
the sink M24 left: a tenth of production while the front is young and a fifth or
more at the eighth rung, and a full store at war loses 24-47% there instead of
44-75%. A front its town cannot feed loses ground until it can. Phase 4, the
endgame, is what is left.*

*M25 Phase 4a (v1.56.0) tuned the climb to the stronghold. Rungs 6 to 13 are
chosen for an army that grows four men a rung: one that does reaches the
stronghold in twelve to fifteen days of daily raiding, and one that does not
stops near the ninth rung. A town the depots cannot feed holds, so the road ends
where the supply line does. 4b, the capital and a war won, is next.*

*M25 Phase 4b (v1.57.0) made the war winnable. The stronghold falls to its three
roads and then its citadel, whose strength is each faction's, tuned so the whole
army takes it about half the time; its fall wins the war, dated and paid, and the
war goes on into the enemy's rear. A grown army wins in thirteen to sixteen days.
4c, the last stand at your own capital, is what is left of M25.*

*M25 Phase 4c (v1.58.0) finished it. A front pushed back to the first town, in a
war that has been deeper, and left quiet again, brings the enemy to the capital: a
last stand, offered like a live defence, fought in person or by the garrison at a
level measured to be contested for the town's faction and size. Lost, the capital
is sacked, and the war goes on. M25 is done.*

**Do M22 before any content overhaul.** M24, M25 and M26 all re-tune on top of the
combat model. Tuning them against the sponge and then again against the kill chain
is doing the same work twice, and this project has already learned that lesson in
a smaller costume — see the M19 entry on a grid that could not resolve the step it
was being read for.

---

## Working agreements

- The sim stays free of anything that draws, and deterministic; every feature lands with sim tests first.
- Balance numbers are provisional until M5's harness; resist hand-tuning before it exists.
- Each milestone is pushed to the repo in a runnable state with green tests.
- The 24 E2E harnesses gate every release with `npm run e2e`, which runs them
  in sequence and **re-runs a failure once, alone, before calling it anything**
  — the rule that came out of the v1.41.2 gate, where two batches on the same
  commit failed different harnesses and none failed twice. A flake is reported
  loudly and passes the gate; a real failure fails twice and does not. Since
  v1.48 a flake also prints what its failed attempt said: the v1.48 gate's one
  flake left nothing behind to tell it from a rare real failure.
- Sixteen of those harnesses poll for the UI to STOP CHANGING rather than
  sleeping a constant (v1.42). The six gesture-driven ones keep their sleeps on
  purpose: their waits are part of the test — a list has to still be COASTING
  when the next touch lands — so a settle-poll there would buy false passes
  rather than fewer false failures. `e2e-drawer` is the one that still flakes,
  and that is the accepted residual rather than an oversight.
