import { CHAIN_AIMED, CHAIN_CURRENT, CHAIN_PINNED } from '../sim/killchain';
import type { StandingOrders } from '../sim/types';

/**
 * Standing orders (v0.8): the three defense doctrines a commander can leave
 * with the garrison. They spend the Command Points that kills earn during
 * OFFLINE sieges — probe raids resolve with these orders in force, so the
 * unattended base fights back the way its commander would have.
 *
 * All kinds are ROLE ids, so every faction executes the same orders through
 * its own catalog: HOLDFAST plugs breaches with the faction's field MG,
 * COUNTERBATTERY spends stocked ordnance on massed attackers, TRIPWIRE
 * mines the approach and mans the inner line. Thresholds hold a CP reserve;
 * prices, limits, and buildability are enforced by the engine exactly as
 * they are for a live player.
 */

export type StandingOrdersId = 'holdfast' | 'counterbattery' | 'tripwire';

export const STANDING_ORDER_IDS: StandingOrdersId[] = [
  'holdfast',
  'counterbattery',
  'tripwire',
];

export const STANDING_ORDERS: Record<StandingOrdersId, StandingOrders> = {
  /**
   * Meet them at the hole: field guns onto the breaches, air on the mass.
   *
   * Both guns go to the breach since M23 Phase 3c. The second went to the
   * post's approach before that, which is where a doctrine called "at the
   * hole" had no business putting it — and on kill chain 5, which aims three
   * units out as the 20x30 board did rather than six, that puts it beside the
   * post, inside the ring an assault clears first. Measured on the contested
   * band, that one rule took HOLDFAST below leaving no orders at all on a CC2
   * base (-7 held); at the breach it is +16 overall and positive on every
   * stage. See `HOLDFAST_INNER_LINE` for the version battles before chain 5
   * were fought with.
   *
   * The gun run goes onto the assault at the post since M23 Phase 5, and waits
   * for two to be there; `counterbattery` below says why. See
   * `HOLDFAST_AT_THE_HOLE` for the orders battles on chain 5 were fought with.
   */
  holdfast: {
    id: 'holdfast',
    maxActions: 3,
    rules: [
      { cpAtLeast: 40, action: 'deploy', kind: 'depmg', target: 'breach', minHostiles: 4, cooldownTicks: 300 },
      { cpAtLeast: 55, action: 'deploy', kind: 'foxhole', target: 'breach', minHostiles: 3, cooldownTicks: 260 },
      { cpAtLeast: 90, action: 'power', kind: 'a10', target: 'assault', minKnot: 2, minHostiles: 5, cooldownTicks: 400 },
    ],
  },
  /**
   * Ordnance first: stocked fire missions on the assault, mines in between.
   *
   * Until M23 Phase 5 its fire missions went onto the densest knot on the
   * board the moment they could be afforded, which is usually the column
   * still forming at the edge of the map, well out of reach of any gun. On
   * the contested band that made both of them stir battles rather than
   * decide them. Now each waits for the assault to reach the post: two in the
   * ring for the gun run, whose strip is narrow, and three for the barrage,
   * whose shells scatter. See `COUNTERBATTERY_ON_THE_MASS` for the orders
   * battles before chain 6 were fought with.
   */
  counterbattery: {
    id: 'counterbattery',
    maxActions: 6,
    rules: [
      { cpAtLeast: 45, action: 'power', kind: 'a10', target: 'assault', minKnot: 2, minHostiles: 4, cooldownTicks: 300 },
      { cpAtLeast: 28, action: 'deploy', kind: 'claymore', target: 'ccApproach', minHostiles: 2, cooldownTicks: 140 },
      { cpAtLeast: 70, action: 'power', kind: 'arty', target: 'assault', minKnot: 3, minHostiles: 5, cooldownTicks: 400 },
    ],
  },
  /** Refuse the interior: mines early and often, guns close-in late. */
  tripwire: {
    id: 'tripwire',
    maxActions: 5,
    rules: [
      { cpAtLeast: 16, action: 'deploy', kind: 'claymore', target: 'ccApproach', minHostiles: 1, cooldownTicks: 100 },
      { cpAtLeast: 45, action: 'deploy', kind: 'depmg', target: 'ccApproach', minHostiles: 3, cooldownTicks: 240 },
      { cpAtLeast: 70, action: 'deploy', kind: 'foxhole', target: 'breach', minHostiles: 3, cooldownTicks: 300 },
    ],
  },
};

export const STANDING_ORDER_LABEL: Record<StandingOrdersId, string> = {
  holdfast: 'HOLDFAST',
  counterbattery: 'COUNTERBATTERY',
  tripwire: 'TRIPWIRE',
};

/**
 * HOLDFAST as it stood from v0.8 until M23 Phase 3c: its second gun on the
 * post's approach. Frozen for the battles fought with it.
 *
 * A replay code carries its orders as a preset id and the reader rebuilds the
 * rules from here, so a battle fought on kill chain 4 or older has to get back
 * the doctrine it was actually fought under, or a probe the log says was held
 * re-fights as one that fell.
 */
const HOLDFAST_INNER_LINE: StandingOrders = {
  id: 'holdfast',
  maxActions: 3,
  rules: [
    { cpAtLeast: 40, action: 'deploy', kind: 'depmg', target: 'breach', minHostiles: 4, cooldownTicks: 300 },
    { cpAtLeast: 55, action: 'deploy', kind: 'foxhole', target: 'ccApproach', minHostiles: 3, cooldownTicks: 260 },
    { cpAtLeast: 90, action: 'power', kind: 'a10', target: 'densest', minHostiles: 5, cooldownTicks: 400 },
  ],
};

/**
 * HOLDFAST from M23 Phase 3c until Phase 5: both guns at the breach, and the
 * gun run on the densest knot on the board. Frozen for the battles fought on
 * kill chain 5.
 */
const HOLDFAST_AT_THE_HOLE: StandingOrders = {
  id: 'holdfast',
  maxActions: 3,
  rules: [
    { cpAtLeast: 40, action: 'deploy', kind: 'depmg', target: 'breach', minHostiles: 4, cooldownTicks: 300 },
    { cpAtLeast: 55, action: 'deploy', kind: 'foxhole', target: 'breach', minHostiles: 3, cooldownTicks: 260 },
    { cpAtLeast: 90, action: 'power', kind: 'a10', target: 'densest', minHostiles: 5, cooldownTicks: 400 },
  ],
};

/**
 * COUNTERBATTERY as it stood from v0.8 until M23 Phase 5: both fire missions
 * on the densest knot on the board, the moment they could be afforded.
 * Frozen for the battles fought with it.
 */
const COUNTERBATTERY_ON_THE_MASS: StandingOrders = {
  id: 'counterbattery',
  maxActions: 6,
  rules: [
    { cpAtLeast: 45, action: 'power', kind: 'a10', target: 'densest', minHostiles: 4, cooldownTicks: 300 },
    { cpAtLeast: 28, action: 'deploy', kind: 'claymore', target: 'ccApproach', minHostiles: 2, cooldownTicks: 140 },
    { cpAtLeast: 70, action: 'power', kind: 'arty', target: 'densest', minHostiles: 5, cooldownTicks: 400 },
  ],
};

/**
 * The orders a battle on this kill chain fights with. Absent means a battle
 * fought today.
 */
export function standingOrdersFor(
  id: StandingOrdersId | null | undefined,
  killChainVersion: number = CHAIN_CURRENT,
): StandingOrders | undefined {
  if (!id) return undefined;
  if (id === 'holdfast' && killChainVersion < CHAIN_AIMED) return HOLDFAST_INNER_LINE;
  if (id === 'holdfast' && killChainVersion < CHAIN_PINNED) return HOLDFAST_AT_THE_HOLE;
  if (id === 'counterbattery' && killChainVersion < CHAIN_PINNED) return COUNTERBATTERY_ON_THE_MASS;
  return STANDING_ORDERS[id];
}

export function isStandingOrdersId(value: unknown): value is StandingOrdersId {
  return (
    typeof value === 'string' && (STANDING_ORDER_IDS as string[]).includes(value)
  );
}
