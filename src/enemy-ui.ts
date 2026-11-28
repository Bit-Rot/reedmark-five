import { enemyArtUrl, hazardArt } from './enemy-art.ts';
import type { EnemyArt } from './enemy-art.ts';
import { hazardDescription, intentHazards, isDieHazard } from './hazards.ts';
import { FORMATION_SIZE, SLOTS } from './model.ts';
import type { EnemyHazard, HazardSpec, Intent, IntentDie, IntentFace } from './model.ts';
import { button, element } from './ui.ts';

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

export function enemyIntentBadge(intent: Intent, dieNumber: (id: string) => string, name: string, index: number): HTMLButtonElement {
  const hazards = intentHazards(intent);
  const tile = button(`intent enemy-intent intent--${intent.move}${hazards.length ? ' intent--hazard' : ''}`, 'enemy-die', '');
  tile.dataset.index = String(index);
  tile.dataset.enemyName = name;
  tile.dataset.focus = `enemy-die-${index}`;
  tile.setAttribute('aria-haspopup', 'dialog');
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
  tile.setAttribute('aria-label', 'Inspect ' + name + ' die');
  tile.setAttribute('aria-description', tile.title);
  return tile;
}

function describeHazard(spec: HazardSpec): string {
  if (isDieHazard(spec)) {
    const count = spec.count ?? 2;
    if (spec.kind === 'pain') return `Give one eligible die ${spec.value} Pain for the fight. Playing it deals that much damage to you.`;
    const faces = `up to ${count} faces on one eligible die`;
    if (spec.kind === 'petrifyDice') return `Petrify ${faces} for the fight.`;
    return `Corrupt ${faces} for the fight. Rolling one deals ${spec.value} damage to you.`;
  }

  const count = spec.targeting === 'center' ? 1 : Math.min(spec.slots ?? 1, spec.targeting === 'edge' ? 2 : FORMATION_SIZE);
  const targets = spec.targeting === 'center' ? 'the center slot' : spec.targeting === 'edge'
    ? (count === 1 ? 'one random end slot' : 'both end slots')
    : (count === 1 ? 'one random slot' : `${count} random slots`);
  switch (spec.kind) {
    case 'trap': return `Trap ${targets}. Playing a die there deals ${spec.value} damage to you.`;
    case 'lock': return `Seal ${targets} for this turn.`;
    case 'drain': return `Drain ${spec.value} ${spec.value === 1 ? 'pip' : 'pips'} from ${targets}.`;
    case 'petrifyOnUse': return `Mark ${targets}. Playing a die there petrifies its used face for the fight.`;
    case 'corruptOnUse': return `Mark ${targets}. Playing a die there corrupts its used face. Rolling it later deals ${spec.value} damage to you.`;
  }
}

function describeFace([move, value, hazard]: IntentFace): string {
  const action = move === 'hit' ? `Deal ${value} damage.`
    : move === 'guard' ? `Gain ${value} block.`
    : move === 'power' ? `Gain ${value} Power, up to 2. Each point adds 1 damage to attacks.`
    : hazard ? '' : 'Do nothing.';
  return [action, hazard ? describeHazard(hazard) : ''].filter(Boolean).join(' ');
}

export function enemyDieChart(die: IntentDie, rolled: number | undefined): HTMLElement {
  const chart = element('div', 'face-net enemy-die-net');
  chart.setAttribute('role', 'group');
  chart.setAttribute('aria-label', 'Die faces at base value');
  const faceNames = ['Left', 'Center', 'Right', 'Far right', 'Top', 'Bottom'];
  const detail = element('p', 'enemy-face-detail');
  detail.setAttribute('aria-live', 'polite');
  const faces = die.faces.map(([move, value, hazard], index) => {
    const tile = element('button', `net-tile net-tile--${SLOTS[index]}`);
    tile.type = 'button';
    tile.setAttribute('aria-label', `${faceNames[index]} face. ${describeFace(die.faces[index])}${index === rolled ? ' Rolled this turn.' : ''}`);
    tile.setAttribute('aria-pressed', 'false');
    if (move !== 'wait' || !hazard) {
      tile.append(element('span', 'chip', icon(move), move === 'wait' ? 'Wait' : String(value)));
    }
    if (hazard) {
      const amount = hazard.kind === 'petrifyDice' || hazard.kind === 'corruptDice' ? hazard.count ?? 2 : hazard.value;
      tile.append(element('span', 'chip', icon(hazardArt(hazard)), amount ? String(amount) : ''));
    }
    if (index === rolled) tile.classList.add('is-rolled');
    tile.addEventListener('click', () => select(index));
    return tile;
  });
  function select(index: number): void {
    for (const [other, tile] of faces.entries()) tile.setAttribute('aria-pressed', String(other === index));
    detail.textContent = describeFace(die.faces[index]);
  }
  select(rolled ?? 0);
  chart.append(...faces);
  return element('div', '', chart, detail);
}
