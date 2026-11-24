import { ROOMS } from '../src/content.ts';
import { newRun } from '../src/game.ts';
import type { Variant } from '../src/model.ts';
import { act, takeReward } from './policy.ts';

const runs = Number(process.argv[2] ?? 64);
for (const variant of ['fixed', 'pool'] as Variant[]) {
  const records = ROOMS.map(() => ({ seen: 0, turns: 0, damage: 0, defeatedHere: 0 }));
  const victories: { seed: number; hp: number }[] = [];
  for (let seed = 1; seed <= runs; seed++) {
    const s = newRun(variant, seed);
    let lastRoom = -1;
    for (let turns = 0; turns < 140 && (s.phase === 'reward' || s.phase === 'battle'); turns++) {
      if (s.phase === 'reward') {
        takeReward(s);
      } else {
        const record = records[s.room];
        if (s.room !== lastRoom) record.seen++;
        lastRoom = s.room;
        record.turns++;
        const hp = s.hp;
        act(s);
        record.damage += hp - s.hp;
      }
    }
    if (s.phase === 'victory') victories.push({ seed, hp: s.hp });
    if (s.phase === 'defeat') records[s.room].defeatedHere++;
  }
  console.log(variant, victories.length + '/' + runs, 'wins, mean remaining HP:', (victories.reduce((sum,r) => sum+r.hp,0) / Math.max(1,victories.length)).toFixed(1));
  console.log('Successful examples:', victories.filter(r => r.hp > 8).slice(0,7));
  ROOMS.forEach((room, index) => {
    const r = records[index];
    if (r.seen) console.log(`  ${room.name.padEnd(16)} ${(r.turns / r.seen).toFixed(1)} turns  ${(r.damage / r.seen).toFixed(1)} HP lost  ${r.defeatedHere} defeats`);
  });
}
