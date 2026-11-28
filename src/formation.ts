import { FORMATION_SIZE } from './model.ts';
import type { Face, Part } from './model.ts';

export function positionFace(face: Face, row: readonly (Face | null)[], index: number, threatened: boolean, canHaste: boolean): Face {
  const neighbors = [row[index - 1], row[index + 1]];
  const has = (kind: Part['kind']) => neighbors.some(other => other?.parts[0].kind === kind);
  const primary = face.parts[0].kind;
  const block = face.parts.some(part => part.kind === 'guard');
  const blockBonus = block ? neighbors.reduce((sum, other) =>
    sum + (other?.parts.find(part => part.kind === 'brace')?.value ?? 0), 0) : 0;
  let mainBonus = 0;
  const active = new Set<Part['kind']>();
  for (const part of face.parts) {
    switch (part.kind) {
      case 'anchor':
        if (index === 0 || index === FORMATION_SIZE - 1) active.add(part.kind);
        break;
      case 'centered':
        if (index === 2) active.add(part.kind);
        break;
      case 'neighborPair':
        if (has(primary)) active.add(part.kind);
        break;
      case 'flank':
        if (has('hit') && has('guard')) active.add(part.kind);
        break;
      case 'bypass':
        if (threatened) active.add(part.kind);
        continue;
      case 'haste':
        if (canHaste && neighbors[1] && neighbors[1].target !== 'none') active.add(part.kind);
        continue;
      case 'brace':
        if (neighbors.some(other => other?.parts.some(effect => effect.kind === 'guard'))) active.add(part.kind);
        continue;
    }
    if (active.has(part.kind)) mainBonus += part.value;
  }
  return { ...face, parts: face.parts.map((part, partIndex) => {
    const bonus = (partIndex === 0 ? mainBonus : 0) + (part.kind === 'guard' ? blockBonus : 0);
    if (bonus) return { ...part, value: part.value + bonus };
    return active.has(part.kind) ? { ...part, active: true } : part;
  }) };
}
