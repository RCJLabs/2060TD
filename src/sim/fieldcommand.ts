/**
 * Field command's numbers (M35 Phase 2): what a commander pays to move, sell
 * and upgrade a field defence in a battle, and how far an aimed barrage may
 * open or close.
 *
 * In the sim rather than in a config because a hands-off battle never uses
 * them: only a live commander and the balance tool's orders do. If a replay of
 * a live siege ever keeps its commands, these become a versioned rule like the
 * kill chain's, so a re-tune does not re-fight an archived battle.
 */
export const FIELD_COMMAND = {
  /** A move costs this share of the defence's price... */
  moveShare: 0.5,
  /** ...and puts it out of action this long while it is set up again. */
  moveSeconds: 3,
  /** A sale pays back this share of what it cost, by the health it has left. */
  sellShare: 0.5,
  /** The one upgrade costs this share of the defence's price... */
  upgradeShare: 1,
  /** ...and multiplies its health... */
  upgradeHp: 1.5,
  /** ...and its damage. */
  upgradeDamage: 1.4,
  /** An aimed barrage lands across this share of its spread at the tightest... */
  areaMin: 0.5,
  /** ...and this share at the widest. */
  areaMax: 2,
  /**
   * The instruments' orders call a field defence stranded when the rest of the
   * defence has been firing this long since it last did.
   */
  idleSeconds: 10,
} as const;
