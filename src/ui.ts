import { DICE, ITEMS } from './content.ts';
import { EFFECTS, effectUrl, faceEffects, faceImageUrl } from './effects.ts';
import type { EffectKey } from './effects.ts';
import { effectiveParts, faceFor } from './game.ts';
import { FLAG_KINDS, SLOTS } from './model.ts';
import type { Die, Face, Part } from './model.ts';

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

function amount(part: Part): string {
  if (FLAG_KINDS.includes(part.kind)) return '';
  return `${part.value}${part.count && part.count > 1 ? `×${part.count}` : ''}`;
}

export function faceText(face: Face, boost = 0): string {
  const parts = effectiveParts(face, boost).map(part => `${amount(part)} ${EFFECTS[part.kind].name}`.trim()).join(', ');
  const text = face.target === 'all' ? `${parts}, all enemies` : parts;
  return face.salvage ? `${text}, reroll for ${face.salvage} Block` : text;
}

/** An effect icon; `image` (a face image path) replaces the effect's own icon when given. */
/** How each camp upgrade is shown to the player. */
export const UPGRADE_INFO: Record<string, { name: string; effect: EffectKey; text: string }> = {
  cantrip: { name: 'Cantrip', effect: 'cantrip', text: 'Fires by itself when rolled, and the die can still be played.' },
  selfShield: { name: 'Self shield', effect: 'guard', text: 'Also gain Block equal to the damage.' },
  inspired: { name: 'Inspired', effect: 'inspired', text: 'Doubled if the die played just before had more pips.' },
  growth: { name: 'Growth', effect: 'growth', text: 'Gains pips each time it is played, for the rest of the fight.' },
  weak: { name: 'Weak', effect: 'weak', text: 'Also makes the enemy Weak.' },
  vulnerable: { name: 'Vulnerable', effect: 'vulnerable', text: 'Also makes the enemy Vulnerable.' },
  cleave: { name: 'Cleave', effect: 'cleave', text: 'Hits every enemy, with no target to pick.' },
};

export function upgradeLabel(upgrade: { keyword: string; x?: number }): string {
  const info = UPGRADE_INFO[upgrade.keyword];
  return `${info?.name ?? upgrade.keyword}${upgrade.x !== undefined ? ` ${upgrade.x}` : ''}`;
}

export function effectIcon(kind: EffectKey, image?: string): HTMLElement {
  const url = image ? faceImageUrl(image) : effectUrl(kind);
  const effect = EFFECTS[kind];
  const node = element('span', `effect-icon effect-icon--${kind}`);
  node.style.setProperty('--effect-color', effect.color);
  node.setAttribute('aria-hidden', 'true');
  if (url) {
    const img = element('img');
    img.src = url;
    img.alt = '';
    img.draggable = false;
    node.append(img);
  } else {
    node.textContent = effect.symbol;
  }
  return node;
}

export function effectChip(kind: EffectKey, value: number | string, image?: string): HTMLElement {
  return element('span', `chip chip--${kind}`, effectIcon(kind, image), '' + value);
}

export function chips(face: Face, boost = 0): HTMLElement {
  const row = element('span', 'chips');
  effectiveParts(face, boost).forEach((part, i) => row.append(effectChip(part.kind, amount(part), i === 0 ? face.image : undefined)));
  if (face.target === 'all') row.append(effectChip('cleave', ''));
  if (face.salvage) row.append(effectChip('salvage', face.salvage));
  row.setAttribute('aria-hidden', 'true');
  return row;
}

export function faceEmblem(face: Face): HTMLElement {
  const [primary, ...rest] = face.parts;
  const emblem = element('span', 'face-emblem', effectIcon(primary.kind, face.image), element('span', 'face-amount', amount(primary)));
  const extra = element('span', 'face-extra');
  for (const part of rest) extra.append(effectChip(part.kind, amount(part)));
  if (face.target === 'all') extra.append(effectChip('cleave', ''));
  if (face.salvage) extra.append(effectChip('salvage', face.salvage));
  if (extra.childElementCount) emblem.append(extra);
  emblem.setAttribute('aria-hidden', 'true');
  return emblem;
}

interface FaceHint {
  face: Face;
  boost: number;
  before?: Face;
}

const hints = new WeakMap<HTMLElement, FaceHint>();

export function helpOn(node: HTMLElement, face: Face, boost = 0, before?: Face): void {
  node.dataset.faceHelp = 'true';
  hints.set(node, { face, boost, before });
}

const slotNames = { left: 'Left', center: 'Center', right: 'Right', far: 'Far right', top: 'Top', bottom: 'Bottom' };

export function faceNet(die: Die, result?: Die, interactive = false): HTMLElement {
  const grid = element('div', 'face-net');
  grid.setAttribute('aria-label', 'Die faces');
  for (const slot of SLOTS) {
    const before = faceFor(die, slot);
    const after = result ? faceFor(result, slot) : before;
    const changed = !!result && JSON.stringify(before) !== JSON.stringify(after);
    const tile = element('span', `net-tile net-tile--${slot}${changed ? ' is-changed' : ''}`, faceEmblem(after));
    tile.dataset.slot = slot;
    tile.setAttribute('aria-label', `${slotNames[slot]}, ${faceText(after)}`);
    if (interactive) tile.tabIndex = 0;
    helpOn(tile, after, 0, changed ? before : undefined);
    grid.append(tile);
  }
  return grid;
}

export function itemNet(itemId: string): HTMLElement {
  const item = ITEMS[itemId];
  const grid = element('div', 'face-net item-net');
  for (const slot of SLOTS) {
    const face = item.edits[slot];
    const tile = element('span', `net-tile net-tile--${slot}${face ? ' is-changed' : ' is-empty'}`, face ? faceEmblem(face) : '·');
    tile.dataset.slot = slot;
    if (face) {
      tile.setAttribute('aria-label', `${slotNames[slot]}, ${faceText(face)}`);
      helpOn(tile, face);
    } else tile.setAttribute('aria-hidden', 'true');
    grid.append(tile);
  }
  return grid;
}

function hintAt(target: EventTarget | null): HTMLElement | null {
  return target instanceof Element ? target.closest<HTMLElement>('[data-face-help]') : null;
}

export class FaceTooltips {
  private active: HTMLElement | null = null;
  private panel = element('aside', 'face-tooltip');

  constructor(private root: HTMLElement, private suppressed: () => boolean) {
    this.panel.id = 'reedmark-face-tooltip';
    this.panel.setAttribute('role', 'tooltip');
    root.addEventListener('pointerover', event => {
      if (event.pointerType !== 'touch') this.show(hintAt(event.target));
    });
    root.addEventListener('pointerout', event => {
      if (event.pointerType !== 'touch' && hintAt(event.target) !== hintAt(event.relatedTarget)) {
        this.show(hintAt(event.relatedTarget));
      }
    });
    root.addEventListener('focusin', event => this.show(hintAt(event.target)));
    root.addEventListener('focusout', event => {
      if (hintAt(event.target) !== hintAt(event.relatedTarget)) this.show(hintAt(event.relatedTarget));
    });
    root.addEventListener('click', event => {
      const focus = hintAt(event.target);
      if (!focus || focus.classList.contains('net-tile')) this.show(focus);
    });
    root.addEventListener('scroll', () => this.hide(), { capture: true, passive: true });
    window.addEventListener('resize', () => this.hide(), { passive: true });
    window.addEventListener('blur', () => this.hide());
  }

  hide(): void {
    this.active?.removeAttribute('aria-describedby');
    this.active = null;
    this.panel.remove();
  }

  private show(anchor: HTMLElement | null): void {
    if (!anchor || !anchor.isConnected || this.suppressed()) {
      this.hide();
      return;
    }
    if (this.active === anchor) return;
    this.hide();
    const hint = hints.get(anchor);
    if (!hint) return;
    const { face, boost, before } = hint;
    const definitions = element('dl', 'effect-definitions');
    for (const kind of faceEffects(face)) {
      const effect = EFFECTS[kind];
      definitions.append(element('div', 'effect-definition',
        element('dt', '', effectIcon(kind), effect.name), element('dd', '', effect.description)));
    }
    this.panel.replaceChildren(
      element('strong', 'face-tooltip-heading', faceText(face, boost)),
      ...(before ? [element('p', 'face-tooltip-before', `Before · ${faceText(before)}`)] : []),
      definitions,
    );
    this.root.append(this.panel);
    this.active = anchor;
    anchor.setAttribute('aria-describedby', this.panel.id);
    const layout = anchor.closest('.die-inspection');
    if (layout) {
      const card = layout.getBoundingClientRect();
      const { width, height } = this.panel.getBoundingClientRect();
      const gutter = 10;
      const x = card.right + width + 2 * gutter <= innerWidth ? card.right + gutter
        : card.left >= width + 2 * gutter ? card.left - width - gutter : null;
      if (x !== null) {
        const top = Math.max(gutter, Math.min(card.top, innerHeight - height - gutter));
        this.panel.style.left = `${x}px`;
        this.panel.style.top = `${top}px`;
        return;
      }
      positionFloater(this.panel, card, true);
      return;
    }
    positionFloater(this.panel, anchor.getBoundingClientRect(), true);
  }
}

export function positionFloater(panel: HTMLElement, anchor: DOMRect, above = false): void {
  const bounds = panel.getBoundingClientRect();
  const margin = 10;
  const x = Math.max(margin, Math.min(innerWidth - bounds.width - margin, anchor.left + (anchor.width - bounds.width) / 2));
  const top = anchor.top - bounds.height - margin;
  const bottom = anchor.bottom + margin;
  const y = above && top >= margin ? top : bottom + bounds.height <= innerHeight - margin ? bottom
    : top >= margin ? top : Math.max(margin, innerHeight - bounds.height - margin);
  panel.style.left = `${x}px`;
  panel.style.top = `${y}px`;
}
