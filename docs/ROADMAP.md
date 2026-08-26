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

- [ ] **The v0.6 watch items, still open.** The EARLY L2→L3 cliff on all sides
      (armor arrives before anti-armor requisitions), China MID vs L5+ (Javelin
      overwatch), and NK MID vs L4+ (everything kills sentry nests). They have
      been carried in `docs/BALANCE.md` for eleven releases and they are the
      same problem this milestone is about.

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

- [ ] **NEXT, and specified rather than started.** Two candidate answers, and
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

      The second is the one to try. Measure before committing either way.

---

## Working agreements

- The sim stays Phaser-free and deterministic; every feature lands with sim tests first.
- Balance numbers are provisional until M5's harness; resist hand-tuning before it exists.
- Each milestone is pushed to the repo in a runnable state with green tests.
