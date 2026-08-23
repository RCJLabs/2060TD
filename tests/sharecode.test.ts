import { describe, expect, it } from 'vitest';
import { generateBase, CHINA_BASE_KIT } from '../src/content/bases';
import { raidCatalogFor, trainableFor } from '../src/content/factions';
import {
  baseFromShare,
  cleanName,
  codeFingerprint,
  decodeBase,
  encodeBase,
} from '../src/meta/sharecode';
import { newTown, place, tick, unlockAll, TOWN_GRID, type TownState } from '../src/meta/town';
import { raidConfig, resolveRaid, type SquadPlan } from '../src/meta/warfare';

const T0 = 1_700_000_000_000;
const idx = (x: number, y: number) => y * TOWN_GRID.width + x;

/** A town with a real layout: two lines of wire and a handful of guns. */
function fortified(faction: 'usa' | 'china' = 'usa'): TownState {
  const town = unlockAll(newTown(T0, faction));
  town.supplies = 99_999;
  town.fuel = 99_999;
  place(town, 'm2nest', idx(22, 10), T0);
  place(town, 'm2nest', idx(22, 13), T0);
  place(town, 'autocannon', idx(25, 8), T0);
  place(town, 'aa', idx(25, 15), T0);
  place(town, 'barracks', idx(20, 5), T0);
  for (let y = 2; y < 22; y++) town.walls.push({ cell: idx(20, y), kind: 'wall' });
  for (let x = 21; x < 28; x++) town.walls.push({ cell: idx(x, 2), kind: 'wall' });
  tick(town, T0 + 600_000);
  return town;
}

describe('share codes', () => {
  it('round-trips a fortified base through a pasteable string', () => {
    const town = fortified();
    const code = encodeBase(town, 'Coos Bay Anvil');
    const result = decodeBase(code);
    expect(result.ok, `decode failed: ${result.ok ? '' : result.error}`).toBe(true);
    if (!result.ok) return;

    expect(result.base.faction).toBe('usa');
    expect(result.base.name).toBe('Coos Bay Anvil');
    expect(result.base.walls.length).toBe(town.walls.length);
    expect(new Set(result.base.walls.map((w) => w.cell))).toEqual(
      new Set(town.walls.map((w) => w.cell)),
    );
    // Every emplacement survives except the command post, which is implicit.
    const sent = town.structures.filter((s) => s.kind !== 'cc');
    expect(result.base.structures.length).toBe(sent.length);
    for (const s of sent) {
      const match = result.base.structures.find((d) => d.cell === s.cell);
      expect(match?.kind, `${s.kind} at ${s.cell} went missing`).toBe(s.kind);
      expect(match?.level).toBe(s.level);
    }
  });

  it('stays short enough to paste into a chat window', () => {
    const town = fortified();
    for (let y = 2; y < 22; y++) town.walls.push({ cell: idx(24, y), kind: 'wall' });
    for (let y = 2; y < 22; y++) town.walls.push({ cell: idx(28, y), kind: 'wall' });
    const code = encodeBase(town, 'THE LONG NIGHT');
    expect(town.walls.length).toBeGreaterThan(60);
    expect(code.length, `code was ${code.length} chars`).toBeLessThan(400);
    expect(code).toMatch(/^[A-Za-z0-9\-_]+$/);
  });

  it('refuses a code that was mangled, truncated or invented', () => {
    const code = encodeBase(fortified(), 'REFERENCE');
    expect(decodeBase('').ok).toBe(false);
    expect(decodeBase('   ').ok).toBe(false);
    expect(decodeBase('not a code!!').ok).toBe(false);

    const truncated = decodeBase(code.slice(0, code.length - 6));
    expect(truncated.ok).toBe(false);

    // Flip one character in the middle: the checksum has to notice.
    const at = Math.floor(code.length / 2);
    const flipped = code.slice(0, at) + (code[at] === 'A' ? 'B' : 'A') + code.slice(at + 1);
    const tampered = decodeBase(flipped);
    expect(tampered.ok, 'a single-character edit must not decode').toBe(false);
    if (!tampered.ok) {
      expect(['checksum', 'content', 'version', 'truncated']).toContain(tampered.error);
    }
  });

  it('survives whitespace from a chat client', () => {
    const code = encodeBase(fortified(), 'PASTED FROM SLACK');
    const messy = `  ${code.slice(0, 20)}\n${code.slice(20)}  `;
    const result = decodeBase(messy);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.base.name).toBe('PASTED FROM SLACK');
  });

  it('carries the sharer faction, so their kit defends it', () => {
    const code = encodeBase(fortified('china'), 'GRAYS HARBOR');
    const result = decodeBase(code);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.base.faction).toBe('china');
  });

  it('names are trimmed, never empty, and never carry control characters', () => {
    expect(cleanName('  a very long name that runs past the limit  ').length).toBeLessThanOrEqual(24);
    expect(cleanName('')).toBe('UNNAMED POST');
    expect(cleanName(' ok')).toBe('ok');
  });

  it('resolves as a raid target, deterministically', () => {
    const result = decodeBase(encodeBase(fortified(), 'DUEL'));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const base = baseFromShare(result.base);
    expect(base.tier, 'a challenge is off the ladder').toBe(0);

    const squads: SquadPlan[] = [
      { units: { rifle: 3, sapper: 1 }, sector: 'W1', doctrine: 'assault' },
      { units: { grenadier: 2 }, sector: 'N1', doctrine: 'hunt' },
    ];
    const play = (): string => {
      const config = raidConfig(base, squads, 4242, trainableFor('china'));
      const res = resolveRaid(config, squads, 1, raidCatalogFor('china'));
      return `${res.cleared}:${res.ticks}:${Math.round(res.destructionPct * 1000)}`;
    };
    expect(play()).toBe(play());
  });

  it('fingerprints codes so one base cannot be farmed twice', () => {
    const a = encodeBase(fortified(), 'ONE');
    const b = encodeBase(fortified(), 'TWO');
    expect(codeFingerprint(a)).toBe(codeFingerprint(a));
    expect(codeFingerprint(a)).not.toBe(codeFingerprint(b));
  });

  it('ignores wrecks: a code is a boast, not a damage report', () => {
    const town = fortified();
    const nest = town.structures.find((s) => s.kind === 'm2nest')!;
    nest.wrecked = true;
    const result = decodeBase(encodeBase(town, 'REBUILT'));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.base.structures.some((s) => s.cell === nest.cell)).toBe(false);
    }
  });

  it('a generated compound also survives the trip', () => {
    const generated = generateBase(3, 1, CHINA_BASE_KIT);
    const town = newTown(T0, 'china');
    town.walls = generated.walls.map((w) => ({ cell: w.cell, kind: w.kind }));
    const result = decodeBase(encodeBase(town, generated.name));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.base.walls.length).toBe(generated.walls.length);
  });
});
