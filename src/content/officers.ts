import type { Doctrine } from '../sim/types';
import type { FactionId } from './factions';

/**
 * Officers (M28 Phase 1): the one soldier in a squad whose experience does not
 * walk out with the others.
 *
 * A squad's rank is held by its men and bleeds away with every one lost, which
 * is why so few ever reach VETERAN. Its officer is promoted from the ranks the
 * first time the squad reaches LINE, and keeps every lesson for as long as
 * anyone from the squad comes home: an officer falls with a squad that is wiped
 * out, the moment its rank resets too.
 *
 * Each is best at one doctrine. Sent in on it, the squad fights harder, by about
 * a rank step at each grade; on other orders, by about a third of that. The edge
 * multiplies the squad's rank multiplier, the one per-squad number the sim has,
 * so it is stamped on the wave at launch like the rank and no battle rule moves.
 */

export type GradeId = 'lt' | 'cpt' | 'maj';

export interface Grade {
  id: GradeId;
  /** Full name for headings. */
  name: string;
  /** Three characters or fewer: sits in a row's sub. */
  short: string;
  /** Experience floor: the lowest that reads as this grade. */
  at: number;
  /** The squad's multiplier when it is sent in on the officer's doctrine. */
  on: number;
  /** …and on any other. */
  off: number;
}

export const GRADES: Grade[] = [
  { id: 'lt', name: 'LIEUTENANT', short: 'LT', at: 0, on: 1.04, off: 1.01 },
  { id: 'cpt', name: 'CAPTAIN', short: 'CPT', at: 120, on: 1.07, off: 1.02 },
  { id: 'maj', name: 'MAJOR', short: 'MAJ', at: 360, on: 1.1, off: 1.03 },
];

/** Experience an officer can hold: past MAJOR it is only the file's. */
export const OFFICER_XP_CAP = 9999;

export function gradeFor(xp: number): Grade {
  let found = GRADES[0]!;
  for (const grade of GRADES) {
    if (xp >= grade.at) found = grade;
  }
  return found;
}

/** The next grade up, or null at MAJOR. */
export function nextGrade(xp: number): Grade | null {
  return GRADES.find((g) => g.at > xp) ?? null;
}

export interface Officer {
  name: string;
  /** The doctrine this officer is best at. */
  doctrine: Doctrine;
  /** Experience: every lesson of every raid the officer came back from. */
  xp: number;
  /** Raids led. */
  raids: number;
  /** Raids led that did what they were sent to do. */
  clears: number;
  /** When the officer took command (epoch ms). */
  since: number;
}

/** An officer who fell, as the service record remembers them. */
export interface FallenOfficer {
  name: string;
  doctrine: Doctrine;
  /** Experience at the fall, so the grade can be read back. */
  xp: number;
  /** The squad the officer led. */
  slot: number;
  raids: number;
  clears: number;
  since: number;
  /** When the officer fell (epoch ms), and where. */
  fell: number;
  where: string;
}

/**
 * What an officer is worth to the squad on `doctrine`: the grade's edge on the
 * officer's own doctrine and a third of it on any other. One for a squad with
 * nobody in command.
 */
export function officerEdge(officer: Officer | undefined, doctrine: Doctrine): number {
  if (!officer) return 1;
  const grade = gradeFor(officer.xp);
  return officer.doctrine === doctrine ? grade.on : grade.off;
}

/**
 * Surnames, twelve a side, each dealt with an initial: a war promotes a dozen
 * or two officers, and the name of one who fell is not dealt again while the
 * service record still remembers it.
 */
export const OFFICER_NAMES: Record<FactionId, string[]> = {
  usa: ['MILLER', 'REYES', 'OKAFOR', 'KOWALSKI', 'NGUYEN', 'HARLAN', 'DUBOIS', 'CARVER', 'SATO', 'BRENNAN', 'IBARRA', 'LINDQVIST'],
  china: ['WANG', 'LI', 'ZHANG', 'LIU', 'CHEN', 'YANG', 'ZHAO', 'HUANG', 'ZHOU', 'WU', 'XU', 'SUN'],
  russia: ['VOLKOV', 'SOKOLOV', 'MOROZOV', 'PETROV', 'ORLOV', 'BELOV', 'KOZLOV', 'ZAITSEV', 'LEBEDEV', 'NOVIKOV', 'POPOV', 'GROMOV'],
  nk: ['KIM', 'RI', 'PAK', 'CHOE', 'JONG', 'KANG', 'JO', 'YUN', 'JANG', 'HAN', 'SIN', 'MUN'],
  un: ['HALVORSEN', 'MBEKI', 'SILVA', 'DUPONT', 'KAUR', 'OKONKWO', 'JANSSEN', 'MORENO', 'ACHEBE', 'NOVAK', 'TANAKA', 'FERREIRA'],
};

const DOCTRINES: Doctrine[] = ['assault', 'hunt', 'raze'];
const INITIALS = 'ABCDEFGHJKLMNPRSTVWY';

/**
 * The next officer a war promotes: a name and a doctrine, from a seed the war
 * owns (when it began, and how many it has promoted). The same war deals the
 * same officers in the same order. A name in `taken` (the living, and the
 * fallen the record keeps) is passed over.
 */
export function dealOfficer(
  faction: FactionId,
  seed: number,
  taken: readonly string[],
): { name: string; doctrine: Doctrine } {
  let hash = 0x811c9dc5;
  for (let shift = 0; shift < 32; shift += 8) {
    hash = Math.imul(hash ^ ((seed >>> shift) & 0xff), 0x01000193) >>> 0;
  }
  const names = OFFICER_NAMES[faction];
  const doctrine = DOCTRINES[hash % DOCTRINES.length]!;
  const pick = Math.floor(hash / DOCTRINES.length);
  const count = names.length * INITIALS.length;
  for (let i = 0; i < count; i++) {
    const at = (pick + i * 7) % count;
    const name = `${INITIALS[at % INITIALS.length]}. ${names[Math.floor(at / INITIALS.length) % names.length]}`;
    if (!taken.includes(name)) return { name, doctrine };
  }
  return { name: names[pick % names.length]!, doctrine };
}
