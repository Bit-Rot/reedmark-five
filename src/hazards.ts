import { FORMATION_SIZE, SLOTS } from './model.ts';
import type { Combat, DieHazard, EnemyHazard, Face, FaceHazard, HazardSpec, Part, Roll, Slot, SlotHazard } from './model.ts';

export function isDieHazard(spec: HazardSpec): spec is Extract<HazardSpec, { kind: DieHazard['kind'] }> {
  return spec.kind === 'petrifyDice' || spec.kind === 'corruptDice' || spec.kind === 'pain';
}

/** Choose distinct slots for a single enemy face. Each target is saved on its intent. */
export function planHazards(spec: HazardSpec, dieIds: readonly string[], pick: (length: number) => number, combat: Combat): EnemyHazard[] {
  if (!isDieHazard(spec)) {
    const positions = spec.targeting === 'center' ? [Math.floor(FORMATION_SIZE / 2)]
      : spec.targeting === 'edge' ? [0, FORMATION_SIZE - 1] : Array.from({ length: FORMATION_SIZE }, (_, index) => index);
    const targets: EnemyHazard[] = [];
    const count = Math.min(spec.slots ?? 1, positions.length);
    for (let i = 0; i < count; i++) {
      const [position] = positions.splice(positions.length === 1 ? 0 : pick(positions.length), 1);
      targets.push({ kind: spec.kind, value: spec.value, position });
    }
    return targets;
  }
  const hazard = planHazard(spec, dieIds, pick, combat);
  return hazard ? [hazard] : [];
}

export const intentHazards = (intent: Combat['intents'][number]): readonly EnemyHazard[] =>
  intent.hazards ?? (intent.hazard ? [intent.hazard] : []);

/** Store the choice on the intent so its target survives rerolls and reloads. */
export function planHazard(spec: HazardSpec, dieIds: readonly string[], pick: (length: number) => number, combat: Combat): EnemyHazard | undefined {
  if (!isDieHazard(spec)) {
    const position = spec.targeting === 'center' ? Math.floor(FORMATION_SIZE / 2)
      : spec.targeting === 'edge' ? pick(2) * (FORMATION_SIZE - 1) : pick(FORMATION_SIZE);
    return { kind: spec.kind, value: spec.value, position };
  }

  const targets = dieIds.map(dieId => ({ dieId, open: SLOTS.filter(slot => !faceHazard(combat, dieId, slot)) }));
  const eligible = targets.filter(target => spec.kind === 'pain'
    ? painValue(combat, target.dieId) < spec.value && target.open.length > 0
    : target.open.length > 0);
  if (!eligible.length) return undefined;
  const { dieId, open } = eligible[pick(eligible.length)];
  const faces: Slot[] = [];
  if (spec.kind !== 'pain') {
    const count = Math.min(spec.count ?? 2, open.length);
    for (let face = 0; face < count; face++) faces.push(open.splice(pick(open.length), 1)[0]);
  }
  return { kind: spec.kind, value: spec.value, dieId, faces };
}

function activeHazards(combat: Combat): EnemyHazard[] {
  const living = new Set(combat.enemies.filter(enemy => enemy.hp > 0).map(enemy => enemy.id));
  return combat.intents.flatMap(intent => living.has(intent.owner) ? intentHazards(intent) : []);
}

export function slotHazards(combat: Combat, index: number, face?: Face): SlotHazard[] {
  if (index < 0 || face?.parts.some(({ kind }: { kind: string }) => kind === 'bypass')) return [];
  return activeHazards(combat).filter((hazard): hazard is SlotHazard =>
    'position' in hazard && hazard.position === index);
}

export function dieHazards(combat: Combat, dieId: string): DieHazard[] {
  return activeHazards(combat).filter((hazard): hazard is DieHazard => 'dieId' in hazard && hazard.dieId === dieId);
}

export function slotLocked(combat: Combat, index: number, face?: Face): boolean {
  return slotHazards(combat, index, face).some(hazard => hazard.kind === 'lock');
}

export function slotPipPenalty(combat: Combat, index: number, face?: Face): number {
  return slotHazards(combat, index, face).reduce((sum, hazard) => sum + (hazard.kind === 'drain' ? hazard.value : 0), 0);
}

export function painValue(combat: Combat, dieId: string): number {
  return combat.pain?.[dieId] ?? 0;
}

export function playHazardDamage(combat: Combat, index: number, dieId: string, face?: Face): number {
  return slotHazards(combat, index, face).reduce((sum, hazard) => sum + (hazard.kind === 'trap' ? hazard.value : 0), painValue(combat, dieId));
}

export function faceHazard(combat: Combat, dieId: string, slot: Slot): FaceHazard | undefined {
  return combat.faceHazards?.[dieId]?.[slot];
}

function setFaceHazard(combat: Combat, dieId: string, slot: Slot, hazard: FaceHazard): void {
  const faces = ((combat.faceHazards ??= {})[dieId] ??= {});
  faces[slot] ??= hazard;
}

export function applySlotAfterUse(combat: Combat, index: number, roll: Roll,
  hazards: readonly SlotHazard[] = slotHazards(combat, index)): void {
  const corruption = Math.max(0, ...hazards.filter(hazard => hazard.kind === 'corruptOnUse').map(hazard => hazard.value));
  if (corruption) setFaceHazard(combat, roll.dieId, roll.slot, { kind: 'corrupted', value: corruption });
  else if (hazards.some(hazard => hazard.kind === 'petrifyOnUse')) {
    setFaceHazard(combat, roll.dieId, roll.slot, { kind: 'petrified' });
  }
}

export function applyDirectHazard(combat: Combat, hazard: EnemyHazard): void {
  if (!('dieId' in hazard)) return;
  if (hazard.kind === 'pain') {
    (combat.pain ??= {})[hazard.dieId] = Math.max(painValue(combat, hazard.dieId), hazard.value);
    return;
  }
  const effect: FaceHazard = hazard.kind === 'petrifyDice' ? { kind: 'petrified' } : { kind: 'corrupted', value: hazard.value };
  for (const slot of hazard.faces) setFaceHazard(combat, hazard.dieId, slot, effect);
}

const names: Record<EnemyHazard['kind'], string> = {
  trap: 'Trap',
  lock: 'Seal',
  drain: 'Drain',
  petrifyOnUse: 'Petrify on use',
  corruptOnUse: 'Corrupt on use',
  petrifyDice: 'Petrify',
  corruptDice: 'Corrupt',
  pain: 'Pain',
};

const icons: Record<EnemyHazard['kind'], Part['kind']> = {
  trap: 'selfDamage',
  lock: 'petrified',
  drain: 'weak',
  petrifyOnUse: 'petrified',
  corruptOnUse: 'selfDamage',
  petrifyDice: 'petrified',
  corruptDice: 'selfDamage',
  pain: 'pain',
};

export const hazardName = (hazard: EnemyHazard): string => names[hazard.kind];
export const hazardEffect = (hazard: EnemyHazard): Part['kind'] => icons[hazard.kind];

const faceNames: Record<Slot, string> = {
  left: 'Left', center: 'Mid', top: 'Top', bottom: 'Bottom', right: 'Right', far: 'Rightmost',
};

export function hazardDescription(hazard: EnemyHazard, dieLabel = 'target die'): string {
  if ('position' in hazard) {
    const target = `Slot ${hazard.position + 1}`;
    switch (hazard.kind) {
      case 'trap': return `Playing ${target} deals ${hazard.value} damage to you.`;
      case 'lock': return `${target} cannot be played this turn.`;
      case 'drain': return `${target} loses ${hazard.value} ${hazard.value === 1 ? 'pip' : 'pips'}.`;
      case 'petrifyOnUse': return `Playing ${target} petrifies the used face for the fight.`;
      case 'corruptOnUse': return `Playing ${target} corrupts the used face. Rolling it later deals ${hazard.value} damage to you.`;
    }
  } else {
    const faces = hazard.faces.map(slot => faceNames[slot]).join(', ');
    switch (hazard.kind) {
      case 'petrifyDice': return `After this turn, petrify ${dieLabel} faces ${faces} for the fight.`;
      case 'corruptDice': return `After this turn, corrupt ${dieLabel} faces ${faces}. Rolling one deals ${hazard.value} damage to you.`;
      case 'pain': return `After this turn, give ${dieLabel} ${hazard.value} Pain for the fight. Take that damage whenever you play it.`;
    }
  }
}
