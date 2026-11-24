import { DICE, ITEMS } from './content.ts';
import { effectiveParts, faceFor } from './game.ts';
import { SLOTS } from './model.ts';
import type { Die, Face, Part, Slot } from './model.ts';
import { names, symbols } from './scene.ts';

type Child = HTMLElement | string | null | undefined;

export function element<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', ...children: Child[]): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  for (const child of children) if (child !== null && child !== undefined) node.append(child);
  return node;
}

export function button(className: string, action: string, label: string, ...children: Child[]): HTMLButtonElement {
  const node = element('button', className, ...children);
  node.type = 'button';
  node.dataset.action = action;
  node.setAttribute('aria-label', label);
  node.dataset.focus = action;
  return node;
}

export function caption(value: string): HTMLElement {
  return element('span', 'eyebrow', value);
}

export function partText(part: Part): string {
  return `${part.count && part.count > 1 ? `${part.count} × ` : ''}${part.value} ${names[part.kind]}`;
}

export function faceText(face: Face, boost = 0): string {
  const parts = effectiveParts(face, boost).map(partText).join(', ');
  return face.salvage ? `${parts}, reroll +${face.salvage} Guard` : parts;
}

export function chips(face: Face, boost = 0): HTMLElement {
  const row = element('span', 'chips');
  for (const part of effectiveParts(face, boost)) {
    row.append(element('span', `chip chip--${part.kind}`,
      element('span', 'chip-symbol', symbols[part.kind]),
      '' + part.value + (part.count && part.count > 1 ? `×${part.count}` : ''),
    ));
  }
  if (face.salvage) row.append(element('span', 'chip chip--salvage', `↻${face.salvage}`));
  row.setAttribute('aria-hidden', 'true');
  return row;
}

export function faceNet(die: Die, result?: Die): HTMLElement {
  const grid = element('div', 'face-net');
  grid.setAttribute('aria-label', `${DICE[die.template].name} faces`);
  for (const slot of SLOTS) {
    const before = faceFor(die, slot);
    const after = result ? faceFor(result, slot) : before;
    const changed = (result?.imprints[slot] !== die.imprints[slot] || result?.template !== die.template)
      && !!result && JSON.stringify(before) !== JSON.stringify(after);
    const tile = element('div', `net-tile net-tile--${slot}${changed ? ' is-changed' : ''}`);
    tile.title = changed ? `${slot}: ${faceText(before)} → ${faceText(after)}` : `${slot}: ${faceText(after)}`;
    tile.append(chips(after));
    if (changed) tile.append(element('span', 'old-face', chips(before)));
    grid.append(tile);
  }
  return grid;
}

export function itemNet(itemId: string): HTMLElement {
  const item = ITEMS[itemId];
  const grid = element('div', 'face-net item-net');
  for (const slot of SLOTS) {
    const face = item.edits[slot];
    const tile = element('div', `net-tile net-tile--${slot}${face ? ' is-changed' : ''}`, face ? chips(face) : '·');
    tile.title = face ? `${slot}: ${faceText(face)}` : slot;
    grid.append(tile);
  }
  return grid;
}

export function imprintGlyph(slot: Slot): string {
  return ['◀', '●', '▶', '»', '▲', '▼'][SLOTS.indexOf(slot)];
}
