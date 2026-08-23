/**
 * The first-contact coach (v1.5): what a commander is told the first time
 * they fight a siege.
 *
 * Three things are opaque on a first run and none of them are discoverable by
 * poking: that the wire is a ROUTE rather than a barrier, that kills pay a
 * budget which only exists during this battle, and that the field guns bought
 * with it die when the siege does. The script says those three things, in the
 * order the battle raises them, and then gets out of the way.
 *
 * Steps are data and their conditions are pure predicates over a projection of
 * the engine, so the whole script is testable without a browser. Nothing here
 * knows about Phaser, and nothing here is faction-specific — the text uses
 * roles ("a field gun"), never a faction's part numbers.
 */

/** What a step gets to look at. A projection of the live battle. */
export interface CoachState {
  phase: string;
  /** Index of the current or just-cleared wave; -1 before the assault. */
  waveIndex: number;
  cp: number;
  kills: number;
  /** Field defenses the PLAYER placed during combat, this battle. */
  deployed: number;
  /** Fire missions the player called, this battle. */
  casts: number;
}

export interface CoachStep {
  id: string;
  /** One radio-log line. It sits over the board, so keep it short. */
  text: string;
  /** Advance when this goes true. */
  done: (s: CoachState) => boolean;
  /**
   * Hold the simulation while this step is up. Used only where reading the
   * line matters more than the seconds it costs — never during a wave the
   * player is already fighting.
   */
  hold?: boolean;
  /** Seconds before the step may advance, so a line is not flashed past. */
  dwell?: number;
  /** Open this panel tab when the step appears, so the thing named is visible. */
  tab?: string;
}

const battleOver = (s: CoachState): boolean => s.phase === 'victory' || s.phase === 'defeat';

/**
 * Every step also ends when the battle does: a player who ignores the coach
 * and simply fights must never be left with a stale line on their screen, and
 * a step that waits for an action they never take must never stall the script.
 */
export const FIRST_SIEGE: CoachStep[] = [
  {
    id: 'wire',
    text:
      'FORTIFY. The wire is not decoration — it is the route.\n' +
      'They walk around it, or break through it, whichever costs them less.',
    hold: true,
    dwell: 5,
    done: (s) => s.phase !== 'setup',
  },
  {
    id: 'commence',
    text: 'Lay wall while it is quiet. COMMENCE when you are ready for them.',
    dwell: 2,
    done: (s) => s.phase !== 'setup',
  },
  {
    id: 'watch',
    // Purely an observation prompt, so it advances on the clock rather than on
    // a kill: a first wave can take a long minute to walk in and die, and the
    // Command Point lesson behind this must not wait on that.
    text: 'Contact. Watch the line they take — that is the maze you just built.',
    dwell: 6,
    done: () => true,
  },
  {
    id: 'cp',
    text:
      'Kills pay Command Points. CP is this battle’s budget and nothing else:\n' +
      'field guns, mines, fire missions. It does not carry home.',
    hold: true,
    dwell: 5,
    done: (s) => s.cp >= 20 || battleOver(s),
  },
  {
    id: 'deploy',
    text: 'Spend some. DEPLOY, pick a field gun, then tap the ground in their path.',
    tab: 'deploy',
    dwell: 2,
    done: (s) => s.deployed >= 1 || s.casts >= 1 || battleOver(s),
  },
  {
    id: 'temporary',
    text:
      'That gun is gone when the siege ends. The emplacements you build in town\n' +
      'are what holds this place while you are away.',
    dwell: 5,
    done: battleOver,
  },
  {
    id: 'held',
    text:
      'Sector held. That is the loop: build the maze, spend the day’s CP,\n' +
      'keep the command post standing.',
    dwell: 6,
    done: () => false, // the runner retires the last step on its dwell
  },
];

/**
 * The step cursor. Pure on purpose: the rules about when a line may advance
 * and when the battle waits are the part worth testing, and they should not
 * need a browser to exercise.
 */
export class CoachRunner {
  private index = 0;
  private elapsed = 0;
  private finished = false;

  constructor(private readonly script: CoachStep[]) {
    if (script.length === 0) this.finished = true;
  }

  get done(): boolean {
    return this.finished;
  }

  get step(): CoachStep | null {
    return this.finished ? null : (this.script[this.index] ?? null);
  }

  /** A tap serves the rest of the dwell: reading fast should not be punished. */
  skipDwell(): void {
    this.elapsed = Math.max(this.elapsed, this.step?.dwell ?? 0);
  }

  /**
   * Advance the script by `dtSeconds`.
   *
   * `hold` is true only while a step that asked for it is still inside its
   * dwell — so the hold always ends on a clock, never on a condition. A player
   * who ignores the coach loses a few seconds and is never stuck waiting to be
   * released by an action they were not going to take.
   *
   * `changed` marks the frame a new step opened, for a view to redraw on.
   */
  update(state: CoachState, dtSeconds: number): { hold: boolean; changed: boolean } {
    const step = this.step;
    if (!step) {
      this.finished = true;
      return { hold: false, changed: false };
    }
    this.elapsed += dtSeconds;
    const served = this.elapsed >= (step.dwell ?? 0);
    // The last step has nothing left to wait for: its dwell IS its condition.
    const last = this.index === this.script.length - 1;
    if (served && (last || step.done(state))) {
      this.index++;
      this.elapsed = 0;
      if (this.index >= this.script.length) this.finished = true;
      return { hold: false, changed: true };
    }
    return { hold: step.hold === true && !served, changed: false };
  }
}

/** One-shot screens, keyed so a save remembers which have been read. */
export const COACH_KEYS = {
  firstSiege: 'siege1',
  raidPlanner: 'raid1',
} as const;

export type CoachKey = (typeof COACH_KEYS)[keyof typeof COACH_KEYS];
