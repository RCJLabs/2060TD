import { describe, expect, it } from 'vitest';
import { readLines, signalsOf } from '../src/meta/intel';
import type { WaveRead } from '../src/sim/types';

/**
 * The read of the next wave as the INTEL tab words it (M35 Phase 1): what is
 * coming and down which lane for every commander, and with a Signals Station
 * standing, when each group arrives and what it is going for.
 */

const NAMES: Record<string, string> = { militia: 'Militia', rifle: 'Rifle Squad', type99: 'Type 99' };
const nameOf = (kind: string): string => NAMES[kind] ?? kind;

const READ: WaveRead = {
  index: 2,
  groups: [
    { kind: 'militia', count: 14, lane: 0, arrives: 0, doctrine: 'hunt' },
    { kind: 'rifle', count: 3, lane: 1, arrives: 12, doctrine: 'hunt' },
    { kind: 'type99', count: 1, lane: 2, arrives: 31, doctrine: 'hunt' },
  ],
};

const texts = (read: WaveRead, signals: 'up' | 'down' | 'none'): string[] =>
  readLines(read, signals, nameOf).map((l) => l.text);

describe('the read of a wave', () => {
  it('says what is coming and down which lane to every commander', () => {
    for (const signals of ['up', 'down', 'none'] as const) {
      const lines = texts(READ, signals).join('\n');
      expect(lines).toContain('WEST');
      expect(lines).toContain('14× MILITIA');
      expect(lines).toContain('CENTRE');
      expect(lines).toContain('3× RIFLE SQUAD');
      expect(lines).toContain('EAST');
      expect(lines).toContain('1× TYPE 99');
    }
  });

  it('says when and for what only while a Signals Station stands', () => {
    const up = texts(READ, 'up');
    expect(up.find((t) => t.includes('MILITIA'))).toMatch(/\+0s.*GUNS/);
    expect(up.find((t) => t.includes('TYPE 99'))).toMatch(/\+31s.*GUNS/);
    for (const signals of ['down', 'none'] as const) {
      const lines = texts(READ, signals);
      expect(lines.some((t) => /\+\d+s|GUNS|POST|ECONOMY/.test(t)), signals).toBe(false);
    }
    // And says why the rest is missing: never built, or burned in this siege.
    expect(texts(READ, 'none').some((t) => t.includes('NO SIGNALS STATION'))).toBe(true);
    expect(texts(READ, 'down').some((t) => t.includes('SIGNALS DOWN'))).toBe(true);
    expect(texts(READ, 'up').some((t) => t.includes('SIGNALS'))).toBe(false);
  });

  it('names each purpose', () => {
    const one = (doctrine: 'assault' | 'hunt' | 'raze'): string =>
      texts({ index: 1, groups: [{ kind: 'rifle', count: 2, lane: 1, arrives: 4, doctrine }] }, 'up').join('\n');
    expect(one('assault')).toContain('THE POST');
    expect(one('hunt')).toContain('THE GUNS');
    expect(one('raze')).toContain('THE ECONOMY');
  });

  it('names a modifier and its numbers to every commander', () => {
    const cases: [WaveRead, RegExp][] = [
      [{ ...READ, modifier: 'night', mods: { range: 0.75 } }, /NIGHT.*75%/],
      [{ ...READ, modifier: 'jammed', mods: { jammed: true } }, /JAMMED.*NO POWERS/],
      [{ ...READ, modifier: 'fast', mods: { speed: 1.3, hp: 0.8 } }, /FAST COLUMN.*\+30%.*−20%/],
      [{ ...READ, modifier: 'veterans' }, /VETERANS/],
    ];
    for (const [read, says] of cases) {
      for (const signals of ['up', 'none'] as const) {
        expect(texts(read, signals).some((t) => says.test(t)), `${read.modifier} ${signals}`).toBe(true);
      }
    }
    expect(texts(READ, 'up').some((t) => /NIGHT|JAMMED|FAST|VETERANS/.test(t))).toBe(false);
  });

  it('gives each line its own id', () => {
    const lines = readLines({ ...READ, modifier: 'night', mods: { range: 0.75 } }, 'none', nameOf);
    expect(new Set(lines.map((l) => l.id)).size).toBe(lines.length);
  });
});

describe('the Signals Station', () => {
  const radar = (hp: number, inert = false) => ({ profile: { kind: 'radar' }, hp, inert });
  const gun = { profile: { kind: 'm2nest' }, hp: 100, inert: false };

  it('is up while one stands and works, down once the last is lost, and none if the town never had one', () => {
    expect(signalsOf([gun, radar(300)], true)).toBe('up');
    expect(signalsOf([gun, radar(0)], true)).toBe('down');
    // A wrecked station, or one still being built, is on the board and reads nothing.
    expect(signalsOf([gun, radar(120, true)], true)).toBe('down');
    expect(signalsOf([gun], true)).toBe('down');
    expect(signalsOf([gun], false)).toBe('none');
  });
});
