import { CHARACTERS, ROOMS } from '../src/content.ts';
import { newRun } from '../src/game.ts';
import type { Variant } from '../src/model.ts';
import { act, takeReward } from './policy.ts';

/** Simulates runs with the scripted policy and reports how each room plays. Usage: node scripts/balance.ts [runs] [fixed|pool] */
const runs = Number(process.argv[2] ?? 64);
const only = process.argv[3];
for (const variant of (['fixed', 'pool'] as Variant[]).filter(v => !only || v === only)) {
  for (const hero of CHARACTERS) {
    const records = ROOMS.map(() => ({ seen: 0, turns: 0, damage: 0, untouched: 0, defeatedHere: 0, gold: 0 }));
    const victories: { seed: number; hp: number }[] = [];
    let gold = 0;
    for (let seed = 1; seed <= runs; seed++) {
      const s = newRun(variant, seed, hero.id);
      let lastRoom = -1;
      let roomStartHp = s.hp;
      for (let turns = 0; turns < 140 && (s.phase === 'reward' || s.phase === 'battle'); turns++) {
        if (s.phase === 'reward') {
          takeReward(s);
        } else {
          const record = records[s.room];
          if (s.room !== lastRoom) {
            record.seen++;
            roomStartHp = s.hp;
          }
          lastRoom = s.room;
          record.turns++;
          const hp = s.hp;
          const room = s.room;
          act(s);
          record.damage += hp - s.hp;
          // A fight is "untouched" when it ends (reward or victory) with the same HP it began with.
          if (s.phase !== 'battle' && s.phase !== 'defeat' && s.hp === roomStartHp) records[room].untouched++;
        }
      }
      if (s.phase === 'victory') victories.push({ seed, hp: s.hp });
      if (s.phase === 'defeat') records[s.room].defeatedHere++;
      gold += s.gold;
    }
    const mean = victories.reduce((sum, r) => sum + r.hp, 0) / Math.max(1, victories.length);
    console.log(`${variant} ${hero.id}: ${victories.length}/${runs} wins, mean remaining HP ${mean.toFixed(1)}, mean gold ${(gold / runs).toFixed(0)}`);
    ROOMS.forEach((room, index) => {
      const r = records[index];
      if (!r.seen) return;
      const flawless = Math.round(100 * r.untouched / r.seen);
      console.log(`  ${room.name.padEnd(14)} ${(r.turns / r.seen).toFixed(1)} turns  ${(r.damage / r.seen).toFixed(1)} HP lost  ${String(flawless).padStart(3)}% flawless  ${r.defeatedHere} defeats`);
    });
  }
}
