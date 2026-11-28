import { CHARACTERS } from '../src/content.ts';
import { bossDue, explorationDistance } from '../src/campaign-map.ts';
import { currentRoom, newRun } from '../src/game.ts';
import type { Variant } from '../src/model.ts';
import { act, MAP_POLICIES, takeMapTurn, takeReward } from './policy.ts';
import type { MapPolicy } from './policy.ts';

const runs = Number(process.argv[2] ?? 96);
const variant: Variant = process.argv[3] === 'pool' ? 'pool' : 'fixed';
const selectedPolicy = process.argv[4] as MapPolicy | undefined;
const policies = variant === 'pool' ? ['cautious' as const] : MAP_POLICIES.filter(policy => !selectedPolicy || selectedPolicy === policy);

for (const hero of CHARACTERS.filter(hero => variant === 'fixed' || hero.id !== 'orden')) for (const policy of policies) {
  const reached = [0, 0, 0];
  const bossHp = [0, 0, 0];
  const bossGold = [0, 0, 0];
  const roomMix = new Map<string, number>();
  let wins = 0;
  let rounds = 0;
  let fights = 0;
  let repeats = 0;
  let waves = 0;
  let near = 0;
  let chestVisits = 0;

  for (let seed = 1; seed <= runs; seed++) {
    const state = newRun(variant, seed, hero.id);
    let lastEncounter = '';
    let seenCombat: typeof state.combat = null;
    let observedWave = 0;
    let steps = 0;
    while (!['victory', 'defeat'].includes(state.phase) && steps++ < 2500) {
      if (state.phase === 'map') {
        const map = state.map!;
        if (map.wave > observedWave) {
          observedWave = map.wave;
          waves++;
          const paths = explorationDistance(map);
          if (map.tiles.some(tile => tile.chest === map.wave - 1 && (paths.get(tile.id) ?? Infinity) <= 5)) near++;
        }
        if (bossDue(map)) {
          const index = Math.floor(map.turn / 16);
          reached[index]++;
          bossHp[index] += state.hp;
          bossGold[index] += state.gold;
        }
        if (!takeMapTurn(state, policy)) throw new Error('No legal exploration move at turn ' + map.turn);
        const room = currentRoom(state);
        const kind = room.type === 'battle' ? room.rank : room.type;
        roomMix.set(kind, (roomMix.get(kind) ?? 0) + 1);
        if (kind === 'treasure') chestVisits++;
        if (map.active?.kind === 'encounter') {
          if (map.active.id === lastEncounter) repeats++;
          lastEncounter = map.active.id;
        }
      } else if (state.phase === 'reward') takeReward(state);
      else {
        if (state.combat !== seenCombat) {
          fights++;
          seenCombat = state.combat;
        }
        rounds++;
        act(state);
      }
    }
    if (state.phase === 'victory') wins++;
    if (steps >= 2500) throw new Error('Run exceeded the action limit at seed ' + seed);
  }
  const avg = (sum: number, count: number) => (sum / Math.max(1, count)).toFixed(1);
  const mix = [...roomMix].sort(([left], [right]) => left.localeCompare(right)).map(([kind, count]) => kind + ' ' + avg(count, runs)).join(', ');
  console.log(variant + ' ' + hero.id + ' ' + policy + ' — ' + wins + '/' + runs + ' wins, ' + avg(rounds, fights) + ' rounds/fight, ' + repeats + ' consecutive repeats');
  if (variant === 'fixed') {
    console.log('  Rooms per run — ' + mix + ' · ' + near + '/' + waves + ' waves with reachable chest, ' + avg(chestVisits, waves) + ' chests taken/wave');
    console.log('  Boss entries — ' + reached.map((n, i) => (i + 1) + ' [' + n + ' reached, ' + avg(bossHp[i], n) + ' HP, ' + avg(bossGold[i], n) + ' gold]').join(' · '));
  }
}
