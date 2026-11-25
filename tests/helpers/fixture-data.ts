import { serialiseAll } from '../../src/data/db.ts';
import { emptyDb } from '../../src/data/types.ts';
import type { Collections, Face, Keyword } from '../../src/data/types.ts';

/** A small fixed dataset for the editor's browser tests, so they do not depend on the live design data. */
export function fixtureDb(): Collections {
  const db = emptyDb();
  const kw = (id: string, valueKind: Keyword['valueKind'], ruleText: string): Keyword =>
    ({ id, valueKind, ruleText, category: 'Test', appliesTo: '', implemented: 'implemented', notes: '' });
  db.keywords.push(
    kw('damage', 'pips', 'damage N'), kw('block', 'pips', 'gain N block'), kw('selfShield', 'pips', 'also gain N block'),
    kw('poison', 'x', 'X stacks of poison'), kw('vulnerable', 'x', 'X stacks of vulnerable'), kw('weak', 'x', 'X stacks of weak'),
    kw('exert', 'none', 'blank until the end of next turn'), kw('cantrip', 'none', 'fires when it lands'),
  );
  const face = (id: string, targeting: Face['targeting'], keywords: Face['keywords'], image: string): Face =>
    ({ id, targeting, keywords, image: image ? `face-art/library/${image}.webp` : '', notes: '', status: 'active' });
  db.faces.push(
    face('blank', 'none', [], 'blank'),
    face('slash', 'singleEnemy', [{ keyword: 'damage' }], 'sword'),
    face('block', 'self', [{ keyword: 'block' }], 'shield'),
    face('stab', 'singleEnemy', [{ keyword: 'damage' }, { keyword: 'cantrip' }], 'dagger'),
    face('bash', 'singleEnemy', [{ keyword: 'damage' }, { keyword: 'exert' }, { keyword: 'vulnerable', x: 1 }], 'hammer'),
    face('slash_block', 'singleEnemy', [{ keyword: 'damage' }, { keyword: 'selfShield' }], 'sword_shield'),
    face('poison', 'singleEnemy', [{ keyword: 'damage' }, { keyword: 'poison', x: 1 }], 'drop'),
  );
  const six = (...faces: [string, number?][]) => faces.map(([f, pips]) => (pips === undefined ? { face: f } : { face: f, pips }));
  db.dice.push(
    { id: 'die_sword', name: 'Sword', tone: 'rust', notes: '', faces: six(['slash', 3], ['slash', 2], ['slash', 1], ['slash', 1], ['block', 1], ['block', 1]) },
    { id: 'die_hammer', name: 'Hammer', tone: 'sand', notes: '', faces: six(['bash', 2], ['bash', 2], ['slash_block', 1], ['slash_block', 1], ['blank'], ['blank']) },
    { id: 'die_dagger', name: 'Dagger', tone: 'jade', notes: '', faces: six(['stab', 1], ['stab', 1], ['stab', 1], ['stab', 1], ['blank'], ['blank']) },
  );
  db.characters.push({ id: 'barbarian', name: 'Barbarian', starterDice: ['die_sword', 'die_sword', 'die_hammer', 'die_dagger', 'die_dagger'], items: [], unlocks: [], notes: '' });
  return db;
}

export const fixtureFiles = (): Record<string, string> => serialiseAll(fixtureDb());
