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
- [ ] **Phase 3c — build the contested band FIRST, then re-judge the verbs
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

## M24 — "The Settlement": from nine buildings to a base builder

Nine building kinds and nine research nodes in three linear tracks of three is
not a base-building game. Add **adjacency** (a fuel depot beside a motorpool cuts
training time), **districts** with identity, **production chains** instead of flat
accrual, **power and logistics as a constraint** so layout is an economic decision
and not only a maze decision, and **persistent battle damage** so a bad defence
costs a week of throughput.

- [ ] **Phase 1 — an economy instrument.** Where does a player's time and supply
      actually go? Nothing has ever pointed a harness at the town.
- [ ] **Phase 2 — adjacency and power.** Alone, these turn layout into two
      overlapping optimisation problems: the maze and the grid.
- [ ] **Phase 3 — chains and districts.** The tech tree becomes a graph rather
      than three ladders.

## M25 — "The Theater": give the war a map

"Front line, tier 3" is an abstraction with no geography. Replace it with a
territorial campaign map: nodes held and lost, supply lines that can be cut, an
enemy running its own offensives while the player is away, fronts that move. This
is what turns "grind the ladder" into "there is a war on and I am losing the
north", and it is where an endgame can live.

- [ ] **Phase 1 — the map as pure data over the existing ladder.** Tiers become
      distance from the front. No new sim.
- [ ] **Phase 2 — enemy agency.** An AI that takes territory back offline, so the
      map moves without the player.
- [ ] **Phase 3 — supply and attrition.** Holding ground costs; overextending
      punishes.
- [ ] **Phase 4 — the endgame.** The front reaches their capital, or yours.

## M26 — "Asymmetry": factions become different games

4.2-point parity means it is now SAFE to diverge. Give each faction a different
verb rather than a different number: asymmetric win conditions, a unique resource,
a board rule of its own. The KPA already points the way — it is the only faction
whose carry is 13% instead of 100%, because tunnels changed the shape of the
problem.

- [ ] **Phase 1 — one mechanic per faction, prototyped in the harness** before a
      line of UI exists for it.
- [ ] **Phase 2 — measure the right thing.** Not parity in odds, which is already
      won, but DIVERGENCE in how a turn is spent.
- [ ] **Phase 3 — re-tune to hold 4.2 while the playstyles separate.**

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

Phaser is 81% of the download and this game uses none of its texture, physics or
scene-graph strengths — every frame re-walks and re-batches an immediate-mode
command list, and `ui.ts` is 1,562 lines of hand-rolled hit testing because there
is no DOM. Two coherent exits: drop Phaser for a small custom Canvas2D/WebGL
renderer, or keep Phaser for the BOARD only and move the entire UI to DOM and CSS.

**Take the second.** Lower risk, bigger immediate win, and it makes accessible
text and real input handling free.

- [ ] **Phase 1 — a DOM panel behind a flag**, one scene at a time.
- [ ] **Phase 2 — retire `ui.ts`, `overlay.ts` and the gesture layer.**
- [ ] **Phase 3 — revisit Phaser** once the board is the only thing using it.

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

## M34 — "Thumb Scale": a board you never have to zoom

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
is the cost of discreteness and nothing else.

**The architecture is one parameter.** The engine takes its catalog once, in its
constructor, and all 29 reads of a range, speed or radius go through it. So
`SimConfig.cellSize` — absent meaning 1, meaning today — scales the catalog once at
construction, and the catalog's numbers become physical units that never change. A
replay minted before M34 has no field and re-fights exactly the battle it recorded.
It is the pattern `TERRAIN_VERSION`, `CHAIN_CURRENT` and `spawnEdge` already follow.

- [x] **Phase 1 — an instrument.** `npm run fit` now marks the touch floor beside the
      readability one. The table above is its output.
- [ ] **Phase 2 — `cellSize` in the engine, inert at 1.** Scales ranges, splash,
      trigger, heal and aura radii, speeds, `coverRadius`, strike geometry,
      `AIR_STANDOFF`, and footprints (2 → 1). At 1 every determinism checkpoint must
      hash identically to v1.43, with a liveness assertion beside each, because a hash
      that agrees because nothing happened is not a passing test.
- [ ] **Phase 3 — content stops assuming a width.** Spawn positions become fractions of
      the line (they are hard-coded 3-17 on a 20-wide one today). Terrain gets a new
      version with its features sized to the board; version 1 stays frozen for the
      battles that were fought on it. Wall budgets 50/80/120 → 25/40/60.
- [ ] **Phase 4 — the similarity check, and the go/no-go.** The balance harness runs
      identical matchups at `cellSize` 1 on 20x30 and 2 on 10x15, plans downsampled,
      and reports the drift in every table. Inside the noise floor, the transform is
      sound and the milestone proceeds. Outside it, the drift is named — crowding is
      the prime suspect — before anything moves.
- [ ] **Phase 5 — the boards move.** `TOWN_GRID` and the raid map to 10x15;
      `gridVersion` 2; saved towns downsample 2:1 on load. That is lossy where two guns
      shared a 2x2 block, and whatever does not fit is refunded rather than dropped.
      Generated bases, share codes and replay codes carry their grid, as M33's did.
- [ ] **Phase 6 — the drawer gets what the board leaves.** Its resting height is sized
      from the grid instead of a fixed 42%, never less than the handle and the tabs, so
      the whole board is in view at rest. Target: 15 of 15 rows.
- [ ] **Phase 7 — the ~330 hard-coded cells**, across 25 test, harness and tool files,
      move onto the board's own seams. Plus the milestone's acceptance test: on the
      360-wide phone, at fit zoom, place on a named cell first try with a real touch.
- [ ] **Phase 8 — re-tune from the drift report, regenerate the snapshot, ship.**
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

**Do M22 before any content overhaul.** M24, M25 and M26 all re-tune on top of the
combat model. Tuning them against the sponge and then again against the kill chain
is doing the same work twice, and this project has already learned that lesson in
a smaller costume — see the M19 entry on a grid that could not resolve the step it
was being read for.

---

## Working agreements

- The sim stays Phaser-free and deterministic; every feature lands with sim tests first.
- Balance numbers are provisional until M5's harness; resist hand-tuning before it exists.
- Each milestone is pushed to the repo in a runnable state with green tests.
- The 22 E2E harnesses gate every release with `npm run e2e`, which runs them
  in sequence and **re-runs a failure once, alone, before calling it anything**
  — the rule that came out of the v1.41.2 gate, where two batches on the same
  commit failed different harnesses and none failed twice. A flake is reported
  loudly and passes the gate; a real failure fails twice and does not.
- Sixteen of those harnesses poll for the UI to STOP CHANGING rather than
  sleeping a constant (v1.42). The six gesture-driven ones keep their sleeps on
  purpose: their waits are part of the test — a list has to still be COASTING
  when the next touch lands — so a settle-poll there would buy false passes
  rather than fewer false failures. `e2e-drawer` is the one that still flakes,
  and that is the accepted residual rather than an oversight.
