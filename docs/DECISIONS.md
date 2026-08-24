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
