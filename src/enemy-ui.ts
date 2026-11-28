import { enemyArtUrl, hazardArt } from './enemy-art.ts';
import type { EnemyArt } from './enemy-art.ts';
import { hazardDescription, intentHazards } from './hazards.ts';
import type { EnemyHazard, Intent } from './model.ts';
import { element } from './ui.ts';

const moveNames = { hit: 'Damage', guard: 'Block', power: 'Power', wait: 'Wait' };
const symbols: Record<EnemyArt, string> = {
  hit: '✦', guard: '⬟', power: '◉', trap: '✥', lock: '▣', drain: '▾', stone: '◆', rot: '✢', wait: '·',
};

function icon(key: EnemyArt): HTMLElement {
  const url = enemyArtUrl(key);
  const glyph = element('span', 'enemy-die-icon');
  glyph.setAttribute('aria-hidden', 'true');
  if (!url) glyph.textContent = symbols[key];
  else {
    const image = element('img');
    image.alt = '';
    image.draggable = false;
    image.src = url;
    glyph.append(image);
  }
  return glyph;
}

export function enemyHazardLabel(hazard: EnemyHazard, label: (id: string) => string): string {
  return hazardDescription(hazard, 'dieId' in hazard ? label(hazard.dieId) : undefined);
}

export function enemyHazardBadge(hazard: EnemyHazard, dieLabel: (id: string) => string): HTMLElement {
  const amount = hazard.kind === 'petrifyDice' || hazard.kind === 'corruptDice' ? hazard.faces.length : hazard.value;
  const badge = element('span', 'chip hazard-chip enemy-hazard-chip', icon(hazardArt(hazard)), amount ? String(amount) : '');
  badge.title = enemyHazardLabel(hazard, dieLabel);
  badge.setAttribute('role', 'img');
  badge.setAttribute('aria-label', badge.title);
  return badge;
}

export function enemyIntentBadge(intent: Intent, dieNumber: (id: string) => string): HTMLElement {
  const hazards = intentHazards(intent);
  const tile = element('span', `intent enemy-intent intent--${intent.move}${hazards.length ? ' intent--hazard' : ''}`);
  const description: string[] = [];
  if (intent.move !== 'wait' || !hazards.length) {
    tile.append(element('span', `chip chip--${intent.move}`, icon(intent.move),
      intent.move === 'wait' ? '' : String(intent.value)));
    description.push(intent.move === 'wait' ? 'Wait' : `${intent.value} ${moveNames[intent.move]}`);
  }
  if (hazards.length) {
    const shown = new Map<string, EnemyHazard[]>();
    for (const hazard of hazards) {
      const key = hazard.kind + ':' + hazard.value;
      const group = shown.get(key) ?? [];
      group.push(hazard);
      shown.set(key, group);
      description.push(enemyHazardLabel(hazard, id => 'Die ' + dieNumber(id)));
    }
    for (const group of shown.values()) {
      const targets = group.map(hazard => 'position' in hazard ? 'S' + (hazard.position + 1) : 'D' + dieNumber(hazard.dieId));
      tile.append(element('span', 'enemy-hazard-targets', element('span', 'actor-hazard-target', targets.join(' ')),
        enemyHazardBadge(group[0], id => 'Die ' + dieNumber(id))));
    }
  }
  tile.title = description.join('. ');
  return tile;
}
