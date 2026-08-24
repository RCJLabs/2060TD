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

## M11 — v1.21 "Even Odds": faction parity, and an answer to air *(planned)*

M10 fixed how a raid is *decided*. This one is about who is doing the raiding,
because the same reference force on the same ladder does not remotely produce
the same war depending on which flag it flies. Measured after v1.20, at roughly
equal manpower (27–28 MP) against each faction's own opposite number:

    faction   ground raid   MP lost   air raid   MP lost
    USA              86.8      66.4       86.8      50.0
    China            74.6      76.2       65.0      54.6
    UN               64.6      72.6       86.8      50.2
    Russia           52.2      81.2       58.8      55.6
    NK               29.4      90.6       52.8      69.6

Two findings, and neither is a tuning nit.

**A 57-point spread is not asymmetry, it is a difficulty setting nobody was
told about.** §4 of the GDD says the factions are five full kits differing in
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

- [ ] **Close the faction spread, hardest first.** NK at 29.4 with 90.6%
      losses is the priority and is also unmeasurable where it matters: T3, T4
      and T5 all sit at 0%, and a multiplier is invisible at the floor — the
      same artifact the first veterancy table hit. The reference plan has to
      come off the floor before any of its numbers mean anything.

- [ ] **Russia, which v1.20 moved.** It came out ~10 points easier because it
      was the hardest faction and the gun trade helps a struggling force more
      than the watch hurts it. That was left deliberately rather than tuned
      back in the same release that caused it; it belongs in a parity pass.

- [ ] **The v0.6 watch items, still open.** The EARLY L2→L3 cliff on all sides
      (armor arrives before anti-armor requisitions), China MID vs L5+ (Javelin
      overwatch), and NK MID vs L4+ (everything kills sentry nests). They have
      been carried in `docs/BALANCE.md` for eleven releases and they are the
      same problem this milestone is about.

- [ ] **A harness that can fail.** `e2e-raid.mjs` clicks fixed pixel
      coordinates and asserts only "no page errors", so it has been launching
      raids with ZERO units assigned and passing. Found while writing
      `e2e-garrison.mjs`, which taps by label and checks what it mustered
      before it presses go. Every harness that drives a flow should assert the
      flow happened, not merely that nothing threw.

**The bar, same as the last three milestones:** parity means the SPREAD closes
without the mean moving much, and it has to be a trade — a faction that reads
as a swarm should still lose more men to win the same fight. Flattening all
five into the same numbers would pass the test and fail the design.

---

## Working agreements

- The sim stays Phaser-free and deterministic; every feature lands with sim tests first.
- Balance numbers are provisional until M5's harness; resist hand-tuning before it exists.
- Each milestone is pushed to the repo in a runnable state with green tests.
