import './style.css';
import './face-ui.css';
import './campaign.css';
import './enemy.css';
import './formation.css';
import { loadEnemyArt } from './enemy-art.ts';
import { dieForIntent } from './enemy-roll.ts';
import { enemyDieChart, enemyHazardBadge, enemyHazardLabel, enemyIntentBadge } from './enemy-ui.ts';
import { EVENTS } from './campaign-content.ts';
import { campaignScreen } from './campaign-ui.ts';
import { cycleAt } from './campaign-map.ts';
import { CHARACTERS, DICE, FACE_IMAGE_PATHS, ITEMS, RELICS, ROOMS } from './content.ts';
import { actionPreview, baseRerolls, advance, canPlaceDie, canPlay, canTakeEventOffer, chooseOffer, commitRoll, currentRoom, endTurn, eventChoiceFor, explore, incoming, intentValues, isHasted, placeDie, restoreSave, unplaceDie, usesFormation,
  faceFor, facesFor, newLinearRun, newRun, offerTargets, play, previewDie, previewUpgrade, reroll, rollFace, setHold, startBoss, starterRelicFor } from './game.ts';
import { dieHazards, slotHazards, slotLocked } from './hazards.ts';
import { SLOTS } from './model.ts';
import type { Die, EnemyHazard, Face, Offer, Relic, Roll, Slot, State, Target, Variant } from './model.ts';
import { EFFECTS, faceImageUrl, loadEffectImages, loadFaceImages } from './effects.ts';
import { art, Battlefield } from './scene.ts';
import { UPGRADE_INFO, button, caption, chips, effectChip, effectIcon, element, faceEmblem, FaceTooltips, faceNet, faceText, helpOn, itemNet, positionFloater, upgradeLabel } from './ui.ts';

declare const __VARIANT__: Variant;

const requested = new URLSearchParams(location.search);
const variant = import.meta.env.DEV && requested.get('mode') === 'pool' ? 'pool' : __VARIANT__;
const linearFixture = import.meta.env.DEV && requested.get('route') === 'linear';
const makeRun = linearFixture ? newLinearRun : newRun;
const seedParam = requested.get('seed');
const seeded = seedParam !== null && /^\d{1,10}$/.test(seedParam);
const availableHeroes = CHARACTERS.filter(hero => variant === 'fixed' || hero.id !== 'orden');
const characterParam = availableHeroes.find(c => c.id === requested.get('character'))?.id;
const randomSeed = () => crypto.getRandomValues(new Uint32Array(1))[0];
const saveKey = `reedmark:${variant}:v1`;
const root = document.querySelector<HTMLElement>('#game')!;
const stage = document.querySelector<HTMLElement>('#stage')!;
const view = document.querySelector<HTMLElement>('#interface')!;
const announcer = document.querySelector<HTMLElement>('#announcer')!;
const label = variant === 'fixed' ? 'Fixed Five' : 'Dice Pool';
document.title = `Reedmark · ${label}`;
document.querySelector('main')!.setAttribute('aria-label', `Reedmark ${label}`);

/** True while the player has not yet picked a hero for a new run. */
let choosing = false;

function load(): State {
  if (seeded) return makeRun(variant, Number(seedParam), characterParam);
  try {
    const raw = localStorage.getItem(saveKey);
    if (raw !== null) {
      let parsed: unknown;
      try { parsed = JSON.parse(raw); } catch { parsed = null; }
      const data = restoreSave(parsed, variant, linearFixture);
      if (data) return data;
      if (variant === 'fixed' && !linearFixture) localStorage.removeItem(saveKey);
    }
  } catch {
    // The game can run even when browser storage is unavailable.
  }
  if (characterParam) return makeRun(variant, randomSeed(), characterParam);
  choosing = true;
  return makeRun(variant, randomSeed());
}

let state = load();
const ordered = () => usesFormation(state);
let selected: string | null = null;
let offerIndex: number | null = null;
let rewardDie: string | null = null;
let ledger: 'dice' | 'relics' | null = null;
/** The gear menu is open; `confirmingAbandon` is the second step of abandoning the run. */
let menu = false;
let confirmingAbandon = false;
let ledgerDie: string | null = null;
let rolling = false;
let animTimer = 0;
let suppressClickUntil = 0;
let board: Battlefield | undefined;

interface Drag {
  source: { kind: 'die'; id: string } | { kind: 'item'; index: number };
  pointer: number;
  x: number;
  y: number;
  started: boolean;
  ghost?: HTMLElement;
}
let drag: Drag | null = null;
let battleTap: { button: HTMLButtonElement; pointer: number; x: number; y: number } | null = null;
const battleTapActions = new Set(['die', 'target', 'reroll', 'commit', 'end', 'hazard-details', 'enemy-die']);

let inspection: { node: HTMLElement; anchor: HTMLElement } | null = null;
let inspectionPress: { anchor: HTMLElement; pointer: number; x: number; y: number; timer: number; opened: boolean } | null = null;
const tooltips = new FaceTooltips(root, () => rolling || !!drag?.started);

function save(): void {
  if (seeded || choosing) return;
  try {
    localStorage.setItem(saveKey, JSON.stringify(state));
  } catch {
    // Finishing a turn does not depend on saving.
  }
}
function tell(value: string): void { announcer.textContent = value; }
/** Dice have no player-facing name; they are told apart by their faces, and by number where a label is needed. */
function dieNumber(id: string): string { return '' + (state.dice.findIndex(die => die.id === id) + 1); }
function dieLabel(id: string): string { return `Die ${dieNumber(id)}`; }
function owned(id: string): Die { return state.dice.find(die => die.id === id)!; }
function current(id: string): Roll | undefined { return state.combat?.rolls.find(roll => roll.dieId === id); }

function meter(hp: number, max: number, extra = 0): HTMLElement {
  const bar = element('span', 'meter', element('span', 'meter-fill'));
  bar.style.setProperty('--fill', `${100 * hp / max}%`);
  if (extra) bar.style.setProperty('--loss', `${100 * extra / max}%`);
  return bar;
}

function hud(): HTMLElement {
  const rune = element('span', 'rune', '✧');
  const identity = element('div', 'identity', rune,
    element('div', '', element('span', 'wordmark', 'Reedmark'), caption(label)));
  const room = currentRoom(state);
  const path = element('div', 'map-track', caption(room.name));
  if (state.map) {
    if (!choosing) path.append(caption(`Cycle ${cycleAt(state.map.turn + Number(state.phase === 'map')) + 1} · ${state.map.turn}/48`));
  } else {
    const pips = element('div', 'path-pips');
    pips.setAttribute('aria-label', `Room ${state.room + 1} of ${ROOMS.length}`);
    ROOMS.forEach((entry, index) => {
      const type = entry.type === 'battle' ? entry.rank : entry.type;
      const dot = element('span', `path-pip path-pip--${type}${index === state.room ? ' is-current' : index < state.room ? ' is-past' : ''}`);
      dot.title = entry.name;
      pips.append(dot);
    });
    path.append(pips);
  }
  const health = element('div', 'health-hud', element('span', 'heart', '♥'), element('span', 'hero-hp', `${state.hp}`, element('small', '', ` / ${state.maxHp}`)));
  health.append(meter(state.hp, state.maxHp));
  const coin = element('img', 'gold-coin');
  coin.src = faceImageUrl('face-art/library/coin.webp');
  coin.alt = '';
  coin.draggable = false;
  const gold = element('div', 'gold-hud', coin, element('span', 'gold-amount', `${state.gold}`));
  gold.title = 'Gold';
  gold.setAttribute('aria-label', `${state.gold} gold`);
  const relic = choosing ? undefined : starterRelicFor(state);
  const frenzy = state.phase === 'battle' ? state.combat?.frenzy : undefined;
  const relicHud = relic ? element('span', 'relic-hud', effectChip('frenzy', frenzy ?? ''), relic.name) : null;
  if (relicHud && relic) {
    relicHud.title = relic.description;
    relicHud.setAttribute('role', 'img');
    relicHud.setAttribute('aria-label', `${relic.name}${frenzy === undefined ? '' : `, ${frenzy} Frenzy`}. ${relic.description}`);
  }
  const ownedRelics = state.relics?.length ?? 0;
  const relicsButton = ownedRelics && room.type !== 'shop'
    ? button('relic-hud relic-inventory-button', 'relic-ledger', 'View owned relics', effectIcon('frenzy'), String(ownedRelics))
    : null;
  const kit = button('icon-button', 'ledger', variant === 'pool' ? 'View dice bag' : 'View dice kit', '◫');
  const gear = button('icon-button', 'menu', 'Game menu', '⚙');
  return element('header', 'hud', identity, path, element('div', 'hud-right', element('div', 'hud-stats', health, element('div', 'gold-and-relics', gold, relicsButton), relicHud), kit, gear));
}

function targetFor(node: HTMLElement): Target {
  return { kind: node.dataset.targetKind as Target['kind'], id: node.dataset.targetId };
}

function burnChip(stacks: number): HTMLElement {
  const status = effectChip('burn', stacks);
  status.title = EFFECTS.burn.description;
  status.setAttribute('aria-label', `${stacks} Burn`);
  return status;
}

function worldLayer(): HTMLElement {
  const world = element('div', 'world');
  const combat = state.combat;
  if (!combat || state.phase !== 'battle') return world;
  const heroName = CHARACTERS.find(c => c.id === state.character)?.name ?? 'Courier';
  const self = button('actor-target actor-target--self', 'target', heroName);
  self.dataset.actor = 'courier';
  self.dataset.targetKind = 'self';
  self.dataset.focus = 'courier';
  self.append(element('span', 'actor-caption', element('strong', '', heroName),
    element('span', 'actor-status',
      combat.guard ? effectChip('guard', combat.guard) : null,
      combat.ward ? effectChip('ward', combat.ward) : null,
      combat.burn ? burnChip(combat.burn) : null,
    ),
  ));
  world.append(self);
  const intents = intentValues(combat);
  const crowded = combat.enemies.filter(enemy => enemy.hp > 0).length > 2;
  world.toggleAttribute('data-enemy-crowd', crowded);
  for (const enemy of combat.enemies) {
    if (enemy.hp <= 0) continue;
    const duplicates = state.map ? combat.enemies.filter(other => other.name === enemy.name) : [];
    const name = duplicates.length > 1 ? `${enemy.name} ${duplicates.findIndex(other => other.id === enemy.id) + 1}` : enemy.name;
    const target = button(`actor-target actor-target--enemy actor-target--${enemy.sprite}`, 'target', `${name} ${enemy.hp} of ${enemy.maxHp} HP`);
    target.dataset.actor = enemy.id;
    target.dataset.targetKind = 'enemy';
    target.dataset.targetId = enemy.id;
    target.dataset.focus = enemy.id;
    const enemyIntents = element('span', 'intents');
    const badges = intents.flatMap((intent, index) => intent.owner === enemy.id
      ? [enemyIntentBadge(intent, dieNumber, name, index)] : []);
    enemyIntents.append(...badges);
    if (badges.length) target.dataset.intentDescription = badges.map(badge => badge.title).join('. ');
    target.append(element('span', 'actor-caption',
      element('strong', '', name),
      meter(enemy.hp, enemy.maxHp),
      element('span', 'enemy-hp', `${enemy.hp}/${enemy.maxHp}`,
        enemy.guard ? effectChip('guard', enemy.guard) : null,
        enemy.seep ? effectChip('seep', enemy.seep) : null,
        enemy.burn ? burnChip(enemy.burn) : null,
        enemy.vulnerable ? effectChip('vulnerable', enemy.vulnerable) : null,
        enemy.weak ? effectChip('weak', enemy.weak) : null,
      ),
    ));
    const actor = element('div', 'enemy-actor', target, enemyIntents);
    actor.dataset.actorFrame = enemy.id;
    world.append(actor);
  }
  combat.rolls.forEach(roll => {
    if (roll.held || roll.used) return;
    const die = owned(roll.dieId);
    const identity = DICE[die.template];
    const face = rollFace(state, roll);
    const position = state.relics?.length ? shopSlotLabel[roll.slot] : '';
    const hazards = ordered() ? dieHazards(combat, roll.dieId) : [];
    const dieButton = button(`stage-cube tone-${identity.tone}`, 'die', position ? `${faceText(face)}, ${position}` : faceText(face),
      element('span', 'world-face', faceEmblem(face)), ordered()
        ? element('span', 'cube-tag formation-die-tag', chips(face),
          hazards.length ? element('span', 'formation-die-hazards', ...hazards.map(hazardChip)) : null,
          position ? element('small', '', position) : null)
        : position ? element('span', 'cube-tag', position) : null);
    if (ordered()) dieButton.setAttribute('aria-description',
      ['Tap to hold, drag to arrange, or press a number from 1 to 5.', ...hazards.map(hazardLabel)].join(' '));
    dieButton.dataset.worldDie = roll.dieId;
    dieButton.dataset.die = roll.dieId;
    dieButton.dataset.inspectDie = roll.dieId;
    helpOn(dieButton, face);
    dieButton.dataset.focus = roll.dieId;
    world.append(dieButton);
  });
  return world;
}

const hazardLabel = (hazard: EnemyHazard) => enemyHazardLabel(hazard, dieLabel);
const hazardChip = (hazard: EnemyHazard) => enemyHazardBadge(hazard, dieLabel);

function hazardButton(hazard: EnemyHazard): HTMLButtonElement {
  const label = hazardLabel(hazard);
  const marker = button(ordered() ? 'formation-hazard-button' : 'enemy-hazard-button', 'hazard-details', label,
    'dieId' in hazard ? element('span', ordered() ? 'formation-die-target' : '', dieLabel(hazard.dieId)) : null,
    hazardChip(hazard));
  marker.title = label;
  if (ordered()) marker.dataset.focus = `hazard-${'position' in hazard ? hazard.position : hazard.dieId}-${hazard.kind}`;
  return marker;
}

function tray(): HTMLElement | null {
  if (state.phase !== 'battle' || !state.combat) return null;
  const combat = state.combat;
  const playing = combat.phase === 'play';
  const rack = element('div', ordered() ? 'rack formation-rack' : 'rack');
  if (!ordered()) rack.dataset.hold = 'true';
  rack.setAttribute('aria-label', 'Dice sockets');
  const rolls = ordered() ? combat.formation!.map(placement => placement ? current(placement.dieId) : undefined) : combat.rolls;
  rolls.forEach((roll, index) => {
    const held = !!roll?.held;
    const spent = !!roll?.used;
    const slot = element('div', `socket${held ? ' is-filled' : ''}${spent ? ' is-spent' : ''}`);
    const sealed = slotLocked(combat, index);
    const positionLocked = ordered() && !playing && combat.formation![index]?.locked;
    if (sealed) slot.classList.add(ordered() ? 'is-slot-locked' : 'enemy-sealed-slot');
    if (positionLocked) slot.classList.add('is-position-locked');
    if (!ordered()) slot.dataset.hold = 'true';
    if (!roll || !held || spent) {
      slot.append(element('span', 'socket-seal', spent ? '·' : '◇'));
    } else {
      const die = owned(roll.dieId);
      const identity = DICE[die.template];
      const face = rollFace(state, roll);
      const position = state.relics?.length ? shopSlotLabel[roll.slot] : '';
      const label = faceText(face, roll.boost);
      const repeats = ordered() && playing && isHasted(state, roll.dieId);
      const hazards = ordered() ? dieHazards(combat, roll.dieId) : [];
      const description = [label, position, repeats ? 'resolves twice' : '', ...hazards.map(hazardLabel)].filter(Boolean).join(', ');
      const seated = button(`seated tone-${identity.tone}`, 'die', description,
        chips(face, roll.boost),
        ordered() && (positionLocked || repeats || position || hazards.length) ? element('span', 'formation-die-meta',
          repeats ? element('small', 'formation-haste', '×2') : null,
          positionLocked ? element('small', 'formation-position-lock', 'Locked')
            : position ? element('small', 'slot-tag', position) : null,
          hazards.length ? element('span', 'formation-die-hazards', ...hazards.map(hazardChip)) : null)
          : position ? element('small', 'slot-tag', position) : null);
      seated.dataset.die = roll.dieId;
      seated.dataset.inspectDie = roll.dieId;
      helpOn(seated, face, roll.boost);
      seated.dataset.focus = roll.dieId;
      if (playing) {
        seated.dataset.targetKind = 'die';
        seated.dataset.targetId = roll.dieId;
        if (sealed && slotLocked(combat, index, face)) {
          seated.setAttribute('aria-disabled', 'true');
          seated.setAttribute('aria-description', 'This slot is sealed for this turn.');
        }
      } else if (positionLocked) {
        seated.setAttribute('aria-disabled', 'true');
        seated.setAttribute('aria-description', 'Reroll locked this die in its slot.');
      } else if (ordered()) {
        seated.setAttribute('aria-description', 'Tap to release, or drag or press a number from 1 to 5 to move.');
      }
      slot.append(seated);
    }
    if (!ordered()) {
      slot.dataset.socket = String(index);
      rack.append(slot);
      return;
    }
    const threats = slotHazards(combat, index);
    const cell = element('div', 'formation-cell', element('div', 'formation-cell-heading',
      element('span', 'formation-index', String(index + 1)), ...threats.map(hazardButton)), slot);
    cell.dataset.socket = String(index);
    cell.setAttribute('role', 'group');
    const status = spent ? 'spent' : playing ? 'committed' : positionLocked ? 'locked' : held ? 'held' : 'open';
    cell.setAttribute('aria-label', `Slot ${index + 1}, ${status}`);
    rack.append(cell);
  });

  const predicted = incoming(combat);
  const burn = combat.burn ?? 0;
  const damage = Math.max(0, predicted + burn - combat.guard);
  const readout = element('div', 'threat',
    caption(`Turn ${combat.turn}`),
    element('span', 'threat-value', effectChip('hit', predicted), burn ? burnChip(burn) : null,
      element('span', 'muted', ' / '), effectChip('guard', combat.guard)),
  );
  readout.setAttribute('aria-label', `Incoming ${predicted} Damage. ${burn ? `${burn} Burn. ` : ''}${combat.guard} Block. HP loss ${damage}.`);
  readout.dataset.threat = 'true';
  const commands = element('div', 'commands');
  if (combat.phase === 'roll') {
    const left = combat.rerolls;
    const re = button('control control--secondary', 'reroll', `Reroll, ${left} left`,
      element('span', '', '↻'), 'Reroll', element('kbd', '', '' + left));
    re.disabled = rolling || !left || combat.rolls.every(roll => roll.held);
    const lock = button('control control--primary', 'commit', 'Commit dice', 'Commit');
    lock.disabled = rolling;
    commands.append(re, lock);
  } else {
    commands.append(button('control control--primary', 'end', 'End turn', 'End turn',
      damage ? element('kbd', 'danger', `−${damage}`) : null));
  }
  const hint = ordered() ? element('p', 'formation-hint', playing
    ? 'Tap a die to play it. Choose a target or drag the die onto it.'
    : 'Tap or drag to arrange dice. Reroll or Commit locks them.') : null;
  const dieThreats = combat.rolls.flatMap(roll => dieHazards(combat, roll.dieId));
  const targeted = dieThreats.length
    ? element('div', ordered() ? 'formation-die-targets' : 'enemy-die-threats', ...dieThreats.map(hazardButton)) : null;
  if (targeted && ordered()) {
    targeted.setAttribute('role', 'group');
    targeted.setAttribute('aria-label', 'Dice targeted by enemy abilities');
  }
  const slotThreats = ordered() ? [] : combat.rolls.map((_, index) => slotHazards(combat, index));
  const rail = slotThreats.some(hazards => hazards.length) ? element('div', 'rack enemy-hazard-rail',
    ...slotThreats.map((hazards, index) => element('div', '',
      hazards.length ? element('span', 'enemy-hazard-index', String(index + 1)) : null,
      ...hazards.map(hazardButton)))) : null;
  const panel = element('div', ordered() ? 'combat-tray formation-tray' : 'combat-tray', element('div', 'tray-controls', readout, commands),
    targeted, rail, rack,
    hint ?? (rail || targeted ? element('p', 'enemy-hazard-hint') : null));
  panel.setAttribute('aria-busy', '' + rolling);
  return panel;
}

function describeOffer(offer: Offer): string {
  if (offer.kind === 'item') return ITEMS[offer.id].name;
  if (offer.kind === 'relic') return RELICS[offer.id].name;
  if (offer.kind === 'faceCopy') return `${shopSlotLabel[offer.from]} → ${shopSlotLabel[offer.to]}`;
  if (offer.kind === 'gold') return `${offer.amount} gold`;
  if (offer.kind === 'restore') return `Heal ${offer.amount} HP`;
  if (offer.kind === 'add') return 'New die';
  if (offer.kind === 'transform') return 'Transform a die';
  if (offer.kind === 'upgrade') return `Upgrade: ${upgradeLabel(offer)}`;
  return offer.kind === 'heal' ? 'Rest' : 'Remove';
}

function shopRelicIcon(relic: Relic): HTMLElement {
  return effectIcon('frenzy', relic.image);
}

function offerBody(offer: Offer): HTMLElement {
  if (offer.kind === 'item') return itemNet(offer.id);
  if (offer.kind === 'relic') {
    const relic = RELICS[offer.id];
    return element('span', 'shop-relic-effect', shopRelicIcon(relic), element('span', '', relic.description));
  }
  if (offer.kind === 'faceCopy') return element('span', 'shop-copy-rule', 'Duplicate the source face onto the destination on one die.');
  if (offer.kind === 'upgrade') {
    const info = UPGRADE_INFO[offer.keyword];
    return element('span', 'upgrade-body', info ? effectIcon(info.effect) : null, element('span', '', info?.text ?? 'Add a keyword to a face.'));
  }
  if (offer.kind === 'add' || offer.kind === 'transform') return faceNet({ id: '', template: offer.id, imprints: {} });
  return element('span', 'offer-emblem', offer.kind === 'heal' ? '+10 ♥' : '−1 ◇');
}

function sheet(title: string, action: HTMLButtonElement): HTMLElement {
  const node = element('section', 'sheet', element('div', 'sheet-heading', element('h1', '', title), action));
  node.setAttribute('aria-label', title);
  return node;
}

function offerGrid(direct = false): HTMLElement {
  const grid = element('div', 'offer-grid');
  state.offers.forEach((entry, index) => {
    const kind = entry.kind === 'item' ? ITEMS[entry.id].rarity : entry.kind === 'add' ? 'New die' : entry.kind === 'upgrade' ? 'Face upgrade' : entry.kind;
    const card = button(`offer-card offer--${kind.toLowerCase().replace(' ', '-')}`, 'offer', describeOffer(entry),
      caption(kind), element('strong', '', describeOffer(entry)), offerBody(entry));
    card.dataset.index = '' + index;
    card.dataset.focus = `offer-${index}`;
    const unavailable = ['item', 'remove', 'transform', 'upgrade'].includes(entry.kind) && !offerTargets(state, entry).length;
    if (entry.kind === 'item') {
      card.dataset.inspectItem = entry.id;
      if (unavailable) card.setAttribute('aria-disabled', 'true');
    } else card.disabled = unavailable;
    if (direct && entry.kind === 'item' && !unavailable) {
      card.dataset.dragItem = '' + index;
      card.setAttribute('aria-pressed', '' + (offerIndex === index));
    }
    grid.append(card);
  });
  return grid;
}

type UpgradeOffer = Extract<Offer, { kind: 'upgrade' }>;

function selectedUpgrade(): UpgradeOffer | null {
  const offer = offerIndex === null ? undefined : state.offers[offerIndex];
  return offer?.kind === 'upgrade' ? offer : null;
}

const slotLabel: Record<Slot, string> = { left: 'Left', center: 'Center', right: 'Right', far: 'Far right', top: 'Top', bottom: 'Bottom' };

const shopSlotLabel = { ...slotLabel, center: 'Middle', far: 'Rightmost' };

function shopPrice(value: number): HTMLElement {
  const icon = element('img', 'gold-coin');
  icon.src = faceImageUrl('face-art/library/coin.webp');
  icon.alt = '';
  return element('span', 'shop-price', icon, String(value));
}

function renderShop(): HTMLElement {
  const leave = button('subtle', 'skip', 'Leave shop', 'Leave');
  const pane = sheet('Shop', leave);
  pane.classList.add('shop-sheet');
  const wallet = shopPrice(state.gold);
  wallet.setAttribute('aria-label', `${state.gold} gold available`);
  const owned = state.relics?.length
    ? button('subtle', 'relic-ledger', 'View owned relics', 'Owned relics')
    : null;
  const actions = element('div', 'shop-heading-actions', wallet, owned);
  leave.replaceWith(actions);
  actions.append(leave);
  const groups = [
    { kind: 'relic', title: 'Relics' },
    { kind: 'item', title: 'Items' },
    { kind: 'faceCopy', title: 'Face copy' },
  ] as const;
  for (const { kind, title } of groups) {
    const grid = element('div', 'shop-grid');
    for (const [index, offer] of state.offers.entries()) {
      if (offer.kind !== kind) continue;
      const price = offer.price ?? 0;
      const rarity = offer.kind === 'relic' ? RELICS[offer.id].rarity : offer.kind === 'item' ? ITEMS[offer.id].rarity : '';
      const name = describeOffer(offer);
      const label = offer.kind === 'faceCopy' ? `Face copy ${name}` : name;
      const card = button(`offer-card shop-offer shop-offer--${kind}`, 'offer', `${label}, ${price} gold`,
        element('span', 'shop-card-top', rarity ? caption(rarity) : null, shopPrice(price)),
        element('strong', '', name), offerBody(offer));
      if (offer.kind === 'relic') card.setAttribute('aria-description', RELICS[offer.id].description);
      card.dataset.index = '' + index;
      card.dataset.focus = `offer-${index}`;
      card.dataset.shopKind = kind;
      const unavailable = price > state.gold || (kind !== 'relic' && !offerTargets(state, offer).length);
      if (offer.kind === 'item') {
        card.dataset.inspectItem = offer.id;
        if (unavailable) card.setAttribute('aria-disabled', 'true');
      } else card.disabled = unavailable;
      grid.append(card);
    }
    const section = element('section', 'shop-section', element('h2', '', title));
    section.append(grid.childElementCount ? grid : element('p', 'menu-note', 'Sold out'));
    pane.append(section);
  }
  return element('div', 'overlay', pane);
}

/** Every die's faces; the ones the upgrade can go on are lit and clickable, and show the result. */
function renderUpgradePicker(offer: UpgradeOffer): HTMLElement {
  const event = currentRoom(state).type === 'event';
  const choice = event && offerIndex !== null ? eventChoiceFor(state, offerIndex) : undefined;
  const pane = sheet(describeOffer(offer), button('subtle', 'back', event ? 'Back to event' : 'Back to rewards', 'Back'));
  pane.classList.add('upgrade-sheet');
  pane.append(element('p', 'menu-note', [choice?.label, UPGRADE_INFO[offer.keyword]?.text, 'Choose a face to upgrade.'].filter(Boolean).join(' · ')));
  const kit = element('div', 'imprint-kit upgrade-kit');
  for (const die of state.dice) {
    const net = element('div', 'face-net');
    for (const slot of SLOTS) {
      const before = faceFor(die, slot);
      const after = previewUpgrade(die, slot, offer);
      const shown = after ?? before;
      const tile = button(`net-tile net-tile--${slot}${after ? ' is-upgradable' : ' is-locked'}`, 'upgrade-face',
        `${dieLabel(die.id)}, ${slotLabel[slot]}: ${faceText(shown)}`, faceEmblem(shown));
      tile.dataset.upgradeDie = die.id;
      tile.dataset.slot = slot;
      tile.dataset.focus = `upgrade-${die.id}-${slot}`;
      tile.disabled = !after;
      if (after) helpOn(tile, after, 0, before);
      net.append(tile);
    }
    const card = element('div', 'upgrade-die', net);
    card.dataset.inspectDie = die.id;
    kit.append(card);
  }
  pane.append(kit);
  return element('div', 'overlay', pane);
}

function goldBanner(): HTMLElement | null {
  if (!state.lastGold) return null;
  const coin = element('img', 'gold-coin');
  coin.src = faceImageUrl('face-art/library/coin.webp');
  coin.alt = '';
  const banner = element('div', 'gold-banner', coin, element('span', '', `+${state.lastGold} gold`));
  banner.setAttribute('aria-label', `Earned ${state.lastGold} gold`);
  return banner;
}

function imprintCard(die: Die, action: 'imprint-die' | 'reward-die', label: string, after?: Die): HTMLButtonElement {
  const card = button('imprint-die', action, label, faceNet(die, after));
  card.dataset.inspectDie = die.id;
  return card;
}

function fixedOfferSheet(): HTMLElement {
  const chosen = selectedUpgrade();
  if (chosen) return renderUpgradePicker(chosen);
  const room = currentRoom(state);
  const bossReward = !!state.map && room.type === 'battle' && room.rank === 'boss';
  const pane = sheet(bossReward ? 'Boss spoils' : room.type === 'battle' ? 'Spoils' : room.name,
    button('subtle', 'skip', bossReward ? 'Return to map' : 'Skip reward', bossReward ? 'Continue' : 'Skip'));
  pane.classList.add('fixed-spoils');
  const earned = goldBanner();
  if (earned) pane.append(earned);
  const relicId = bossReward ? state.bossSpoils?.relic : undefined;
  if (relicId) {
    const relic = RELICS[relicId];
    pane.append(element('div', 'campaign-spoils', element('strong', '', relic.name),
      element('span', 'shop-relic-effect', shopRelicIcon(relic), element('span', '', relic.description)),
      element('p', 'menu-note', 'Your HP is fully restored.')));
  }
  if (!state.offers.length) {
    pane.append(element('p', 'menu-note', 'No items available.'));
    return element('div', 'overlay', pane);
  }
  const kit = element('div', 'imprint-kit');
  for (const die of state.dice) {
    const name = dieLabel(die.id);
    const card = imprintCard(die, 'imprint-die', offerIndex === null ? name : `Imprint on ${name}`);
    card.dataset.imprintTarget = die.id;
    card.dataset.focus = `imprint-${die.id}`;
    kit.append(card);
  }
  pane.append(element('p', 'reward-inspection-hint', 'Press and hold an item or die to inspect it.'),
    offerGrid(true), element('div', 'imprint-heading', caption('Imprint onto a die')), kit);
  return element('div', 'overlay', pane);
}

function renderEvent(): HTMLElement {
  const active = state.map?.active;
  if (active?.kind !== 'event') throw new Error('Missing active event');
  const event = EVENTS[active.id];
  const pane = sheet(event.name, button('subtle', 'skip', 'Leave event', 'Leave'));
  const grid = element('div', 'event-offers');
  for (const [index, offer] of state.offers.entries()) {
    const choice = eventChoiceFor(state, index);
    if (!choice) continue;
    const details = ['gold', 'restore'].includes(offer.kind) ? null
      : element('span', 'event-preview', describeOffer(offer));
    const card = button('offer-card', 'offer', choice.label, element('strong', '', choice.label), details);
    card.dataset.index = String(index);
    card.dataset.focus = 'event-' + index;
    if (offer.kind === 'item') {
      card.dataset.inspectItem = offer.id;
      if (!canTakeEventOffer(state, index)) {
        card.setAttribute('aria-disabled', 'true');
        const reason = (choice.gold ?? 0) > state.gold ? `You have ${state.gold} gold.`
          : (choice.hp ?? 0) >= state.hp ? `You have ${state.hp} HP. You must survive the cost.`
            : 'No die can take this imprint.';
        card.append(element('span', 'event-preview', reason));
      }
    } else card.disabled = !canTakeEventOffer(state, index);
    grid.append(card);
  }
  pane.append(element('p', 'event-copy', event.description), grid);
  return element('div', 'overlay', pane);
}

function renderEventImprint(index: number, offer: Extract<Offer, { kind: 'item' }>): HTMLElement {
  const choice = eventChoiceFor(state, index)!;
  const name = describeOffer(offer);
  const pane = sheet(name, button('subtle', 'back', 'Back to event', 'Back'));
  const item = button('offer-card event-imprint-item', 'inspect-reward', 'Inspect ' + name, itemNet(offer.id));
  item.dataset.inspectItem = offer.id;

  const candidates = offerTargets(state, offer);
  const chosen = candidates.find(die => die.id === rewardDie);
  const kit = element('div', 'imprint-kit');
  for (const die of candidates) {
    const label = dieLabel(die.id);
    const selected = die === chosen;
    const after = selected ? previewDie(state, offer, die) : null;
    const card = imprintCard(die, 'reward-die', label, after ?? undefined);
    card.prepend(element('strong', '', label));
    card.dataset.id = die.id;
    card.dataset.focus = 'reward-' + die.id;
    card.setAttribute('aria-pressed', String(selected));
    card.classList.toggle('is-previewing', selected);
    kit.append(card);
  }

  const label = choice.hp ? `Imprint for ${choice.hp} HP` : choice.gold ? `Imprint for ${choice.gold} gold` : 'Imprint';
  const confirm = button('control control--primary', 'take', label, label);
  confirm.disabled = !chosen || !canTakeEventOffer(state, index);
  pane.append(item, element('div', 'imprint-heading', caption('Imprint onto a die')), kit,
    element('div', 'sheet-footer', confirm));
  pane.classList.add('event-imprint');
  return element('div', 'overlay', pane);
}

function renderTreasure(): HTMLElement {
  const active = state.map?.active;
  if (active?.kind !== 'treasure') throw new Error('Missing treasure');
  const pane = sheet('Treasure', button('subtle', 'skip', 'Return to map', 'Continue'));
  pane.append(element('p', 'gold-banner', `+${active.gold} gold`));
  if (active.relic) {
    const relic = RELICS[active.relic];
    pane.append(element('div', 'campaign-spoils', element('strong', '', relic.name),
      element('span', 'shop-relic-effect', shopRelicIcon(relic), element('span', '', relic.description))));
  }
  return element('div', 'overlay', pane);
}

function renderOffers(): HTMLElement {
  const room = currentRoom(state);
  const shopping = room.type === 'shop';
  const offer = offerIndex === null ? undefined : state.offers[offerIndex];
  if (shopping && !offer) return renderShop();
  if (room.type === 'treasure') return renderTreasure();
  if (room.type === 'event') {
    if (offerIndex === null || !offer) return renderEvent();
    if (offer.kind === 'item') return renderEventImprint(offerIndex, offer);
  }
  if (!shopping && room.type !== 'event' && variant === 'fixed') return fixedOfferSheet();
  const chosen = selectedUpgrade();
  if (chosen) return renderUpgradePicker(chosen);
  const title = offer ? describeOffer(offer) : room.type === 'battle' ? 'Spoils' : room.name;
  const pane = sheet(title, offer
    ? button('subtle', 'back', shopping ? 'Back to shop' : room.type === 'event' ? 'Back to event' : 'Back to rewards', 'Back')
    : button('subtle', 'skip', 'Skip reward', 'Skip'));
  const earned = offer ? null : goldBanner();
  if (earned) pane.append(earned);
  if (!offer) {
    const dice = element('div', 'die-picker reward-owned-dice');
    for (const die of state.dice) {
      const pick = button(`picker tone-${DICE[die.template].tone}`, 'inspect-reward', `Inspect ${dieLabel(die.id)}`, dieNumber(die.id));
      pick.dataset.inspectDie = die.id;
      dice.append(pick);
    }
    pane.append(element('p', 'reward-inspection-hint', 'Press and hold an item or die to inspect it.'),
      offerGrid(), element('div', 'imprint-heading', caption('Owned dice')), dice);
  } else {
    const candidates = offerTargets(state, offer);
    const options = element('div', 'die-picker');
    for (const die of candidates) {
      const entry = DICE[die.template];
      const picker = button(`picker tone-${entry.tone}${rewardDie === die.id ? ' is-selected' : ''}`, 'reward-die',
        dieLabel(die.id), element('span', '', '◇'), dieNumber(die.id));
      picker.dataset.id = die.id;
      picker.dataset.inspectDie = die.id;
      picker.dataset.focus = `reward-${die.id}`;
      options.append(picker);
    }
    const chosen = candidates.find(die => die.id === rewardDie);
    const verb = offer.kind === 'faceCopy' ? 'Copy face' : offer.kind === 'item' ? 'Imprint' : offer.kind === 'transform' ? 'Transform' : 'Remove';
    const price = shopping && 'price' in offer ? offer.price : undefined;
    const label = price === undefined ? verb : `${verb} for ${price} gold`;
    const confirm = button('control control--primary', 'take', label, verb, price === undefined ? null : shopPrice(price));
    confirm.disabled = !chosen || (price !== undefined && price > state.gold);
    const detail = element('div', 'placement-detail');
    if (chosen) {
      const result = previewDie(state, offer, chosen);
      detail.append(faceNet(chosen, result ?? undefined, shopping));
    } else if (offer.kind !== 'remove') detail.append(offerBody(offer));
    const event = offerIndex === null ? undefined : eventChoiceFor(state, offerIndex);
    if (event) pane.append(element('p', 'menu-note', event.label));
    if (shopping || event) pane.append(element('p', 'menu-note', 'Choose a die to preview the change.'));
    pane.append(options, detail, element('div', 'sheet-footer', confirm));
  }
  return element('div', 'overlay', pane);
}

function renderRelics(): HTMLElement {
  const pane = sheet('Relics', button('subtle', 'relic-ledger', 'Close relics', 'Close'));
  const starter = starterRelicFor(state);
  const relics = [...(starter ? [starter] : []), ...(state.relics ?? []).map(id => RELICS[id])];
  const list = element('ul', 'owned-relics');
  for (const relic of relics) {
    list.append(element('li', '', shopRelicIcon(relic),
      element('div', '', element('strong', '', relic.name), caption(relic.rarity), element('p', '', relic.description))));
  }
  pane.append(list);
  return element('div', 'overlay', pane);
}

function renderLedger(): HTMLElement {
  const pane = sheet(variant === 'pool' ? 'Dice bag' : 'Dice kit', button('subtle', 'ledger', 'Close dice', 'Close'));
  const remaining = state.combat?.bag;
  const drawn = new Set(state.combat?.rolls.filter(roll => !roll.used).map(roll => roll.dieId));
  const order = variant === 'pool' && remaining ? [...state.dice].sort((a, b) => {
    const category = (id: string) => remaining.includes(id) ? 0 : drawn.has(id) ? 1 : 2;
    return category(a.id) - category(b.id);
  }) : state.dice;
  const row = element('div', 'die-picker');
  for (const die of order) {
    const entry = DICE[die.template];
    const status = variant === 'fixed' || !remaining ? '' : remaining.includes(die.id) ? '◇' : drawn.has(die.id) ? '◈' : '·';
    const pick = button(`picker tone-${entry.tone}${ledgerDie === die.id ? ' is-selected' : ''}`, 'inspect', dieLabel(die.id), status, dieNumber(die.id));
    pick.dataset.id = die.id;
    pick.dataset.inspectDie = die.id;
    pick.dataset.focus = `inspect-${die.id}`;
    row.append(pick);
  }
  const displayed = state.dice.find(die => die.id === ledgerDie) ?? order[0];
  pane.append(row, element('div', 'placement-detail', faceNet(displayed, undefined, true, state.phase === 'battle' ? state : undefined)));
  if (variant === 'pool' && remaining) {
    pane.append(element('div', 'ledger-counts', caption(`${remaining.length} remaining`), caption(`${state.dice.length} owned`)));
  }
  return element('div', 'overlay', pane);
}

function renderSelect(): HTMLElement {
  const choices = availableHeroes.map(hero => {
    const choice = button('control character-choice', 'character', `Play ${hero.name}`, element('strong', '', hero.name), element('small', '', hero.id === 'orden' ? 'Arrange dice in slots' : hero.starterRelic?.name ?? `${hero.starterDice.length} starter dice`));
    choice.dataset.id = hero.id;
    return choice;
  });
  return element('div', 'overlay', element('section', 'sheet select',
    element('h1', '', 'Choose your hero'), caption('Five dice to start'), element('div', 'character-list', ...choices)));
}

function renderMenu(): HTMLElement {
  const pane = sheet('Menu', button('subtle', 'menu', 'Close menu', 'Close'));
  pane.classList.add('menu-sheet');
  if (confirmingAbandon) {
    pane.append(
      element('p', 'menu-note', 'Abandon this run? Your progress will be lost.'),
      element('div', 'menu-actions',
        button('control control--danger', 'abandon-confirm', 'Confirm abandon run', 'Yes, abandon'),
        button('control', 'abandon-cancel', 'Keep playing', 'Keep playing')),
    );
  } else {
    pane.append(element('div', 'menu-actions', button('control control--danger', 'abandon', 'Abandon run', 'Abandon run')));
  }
  return element('div', 'overlay', pane);
}

function renderEnding(): HTMLElement {
  const won = state.phase === 'victory';
  const score = won ? `${state.hp} HP left` : currentRoom(state).name;
  const spoils = won ? state.bossSpoils : undefined;
  const item = spoils?.item ? ITEMS[spoils.item] : undefined;
  const relic = spoils?.relic ? RELICS[spoils.relic] : undefined;
  const itemCard = item ? button('offer-card boss-item', 'inspect-reward', `Inspect ${item.name}`,
    caption('Rare item'), element('strong', '', item.name)) : null;
  if (itemCard && spoils?.item) itemCard.dataset.inspectItem = spoils.item;
  const relicCard = relic ? element('div', 'offer-card boss-relic', caption('Rare relic'), element('strong', '', relic.name),
    element('span', 'shop-relic-effect', shopRelicIcon(relic), element('span', '', relic.description))) : null;
  const loot = itemCard || relicCard ? element('section', 'boss-spoils', element('h2', '', 'Boss spoils'),
    element('div', 'boss-loot', itemCard, relicCard)) : null;
  return element('div', 'overlay', element('section', 'sheet ending',
    element('div', 'end-mark', won ? '✧' : '◇'),
    element('h1', '', won ? 'Passage clear' : 'Run ended'),
    caption(score), state.gold ? caption(`${state.gold} gold`) : null, loot, button('control control--primary', 'new', 'New run', 'New run')));
}

function positionWorld(): void {
  if (!board) return;
  for (const actor of view.querySelectorAll<HTMLElement>('[data-actor-frame], .actor-target--self')) {
    const id = (actor.dataset.actorFrame ?? actor.dataset.actor)!;
    const center = board.actorPoint(id, 'center');
    const captionPoint = board.actorPoint(id, 'label');
    const intentPoint = board.actorPoint(id, 'intent');
    if (!center || !captionPoint || !intentPoint) continue;
    actor.style.setProperty('--x', `${center.x}px`);
    actor.style.setProperty('--y', `${center.y}px`);
    actor.style.setProperty('--caption-y', `${captionPoint.y - center.y}px`);
    actor.style.setProperty('--intent-y', `${intentPoint.y - center.y}px`);
  }
  for (const node of view.querySelectorAll<HTMLElement>('[data-world-die]')) {
    const point = board.diePoint(node.dataset.worldDie!);
    if (!point) continue;
    node.style.setProperty('--x', `${point.x}px`);
    node.style.setProperty('--y', `${point.y}px`);
  }
}

function render(animate: ReadonlySet<string> = new Set(), lead = 0): void {
  const focused = document.activeElement instanceof HTMLElement ? document.activeElement.dataset.focus : null;
  view.toggleAttribute('data-orden', !choosing && ordered());
  closeInspection();
  tooltips.hide();
  if (choosing) {
    view.dataset.phase = 'select';
    view.dataset.variant = variant;
    view.replaceChildren(hud(), renderSelect());
    board?.setActors([]);
    board?.syncDice([], animate, lead);
    return;
  }
  const combat = state.combat;
  const fighting = state.phase === 'battle';
  view.dataset.phase = state.phase;
  view.dataset.rolling = '' + rolling;
  view.dataset.variant = variant;
  view.replaceChildren(hud(), worldLayer());
  const shelf = tray();
  if (shelf) view.append(shelf);
  if (menu) view.append(renderMenu());
  else if (ledger) view.append(ledger === 'relics' ? renderRelics() : renderLedger());
  else if (state.phase === 'map' && state.map) view.append(campaignScreen(state.map));
  else if (state.phase === 'reward') view.append(renderOffers());
  else if (state.phase === 'victory' || state.phase === 'defeat') view.append(renderEnding());
  if (art('courier')) stage.dataset.illustrated = 'true';
  board?.setActors(combat?.enemies ?? []);
  board?.syncDice(fighting && combat ? combat.rolls.map(roll => ({
    die: owned(roll.dieId), faces: facesFor(owned(roll.dieId), state), slot: roll.slot, shown: !roll.held && !roll.used,
  })) : [], animate, lead);
  positionWorld();
  paintTargets(selected);
  paintImprint(offerIndex, null);
  if (focused) [...view.querySelectorAll<HTMLElement>('[data-focus]')].find(node => node.dataset.focus === focused)?.focus({ preventScroll: true });
}

function paintedClear(): void {
  view.querySelectorAll('.impact-preview').forEach(node => node.remove());
  view.querySelectorAll('.is-aimed').forEach(node => node.classList.remove('is-aimed'));
}

function paintTargets(id: string | null, pointed?: HTMLElement): void {
  paintedClear();
  const roll = id ? current(id) : undefined;
  const fullHealthStrike = roll && rollFace(state, roll).parts.some(part => part.kind === 'fullHealth');
  for (const node of view.querySelectorAll<HTMLElement>('[data-target-kind]')) {
    const target = targetFor(node);
    const legal = !!id && !ledger && !menu && canPlay(state, id, target);
    node.classList.toggle('is-legal', legal);
    const doubled = legal && fullHealthStrike && target.kind === 'enemy'
      && state.combat?.enemies.some(enemy => enemy.id === target.id && enemy.hp === enemy.maxHp);
    node.toggleAttribute('data-full-health-bonus', !!doubled);
    const telegraph = node.dataset.intentDescription;
    const description = [telegraph, doubled ? 'Double damage against this target' : ''].filter(Boolean).join('. ');
    if (description) node.setAttribute('aria-description', description);
    else if (!ordered() || target.kind !== 'die') node.removeAttribute('aria-description');
  }
  for (const node of view.querySelectorAll<HTMLElement>('[data-die]')) {
    node.classList.toggle('is-selected', !!id && node.dataset.die === id);
    if (ordered() && state.combat?.phase === 'roll') node.setAttribute('aria-pressed', String(!!current(node.dataset.die!)?.held));
    else if (node.dataset.die === id && !drag?.started) node.setAttribute('aria-pressed', 'true');
    else node.removeAttribute('aria-pressed');
  }
  if (!id || !pointed || !pointed.classList.contains('is-legal') || !state.combat) return;
  const target = targetFor(pointed);
  const playResult = actionPreview(state, id, target);
  if (!playResult) return;
  const existing = state.combat;
  const labels: string[] = [];
  if (target.kind === 'enemy') {
    const old = existing.enemies.find(enemy => enemy.id === target.id)!;
    const next = playResult.enemies.find(enemy => enemy.id === target.id)!;
    if (old.hp !== next.hp) labels.push(next.hp === 0 ? '✦ KO' : `♥ −${old.hp - next.hp}`);
    if (old.guard !== next.guard) labels.push(`⬟ −${old.guard - next.guard}`);
    if (old.seep !== next.seep) labels.push(`◈ +${next.seep - old.seep}`);
    if (old.burn !== next.burn) labels.push(`♨ +${(next.burn ?? 0) - (old.burn ?? 0)} Burn`);
    if (old.vulnerable !== next.vulnerable) labels.push(`⚠ +${next.vulnerable - old.vulnerable}`);
    if (old.weak !== next.weak) labels.push(`▾ +${next.weak - old.weak}`);
  } else if (target.kind === 'die') {
    const old = existing.rolls.find(roll => roll.dieId === target.id)!;
    const next = playResult.rolls.find(roll => roll.dieId === target.id)!;
    labels.push(`✚ +${next.boost - old.boost}`);
  }
  if (existing.guard !== playResult.guard) labels.push(`⬟ ${playResult.guard > existing.guard ? '+' : '−'}${Math.abs(playResult.guard - existing.guard)}`);
  if (existing.ward !== playResult.ward) labels.push(`◒ +${playResult.ward - existing.ward}`);
  const burnChange = (playResult.burn ?? 0) - (existing.burn ?? 0);
  if (burnChange) labels.push(`♨ ${burnChange > 0 ? '+' : '−'}${Math.abs(burnChange)} Self Burn`);
  if (existing.frenzy !== playResult.frenzy) labels.push(`ϟ −${(existing.frenzy ?? 0) - (playResult.frenzy ?? 0)} Frenzy`);
  if (state.hp !== playResult.playerHp) labels.push(`♥ ${playResult.playerHp > state.hp ? '+' : '−'}${Math.abs(playResult.playerHp - state.hp)}`);
  const swing = incoming(existing) - incoming(playResult);
  if (swing) labels.push(`✦ −${swing} incoming`);
  pointed.classList.add('is-aimed');
  if (labels.length) pointed.append(element('span', 'impact-preview', labels.join('  ·  ')));
}

function animateRoll(ids: string[], newTurn = false): void {
  clearTimeout(animTimer);
  const motion = board?.motion.matches;
  rolling = !motion && !!ids.length && stage.dataset.fallback !== 'true';
  const lead = rolling && newTurn ? 260 : 0;
  render(new Set(ids), lead);
  if (lead && state.combat) board?.tossIntents(intentValues(state.combat).filter(intent => intent.active));
  if (rolling) {
    animTimer = window.setTimeout(() => {
      rolling = false;
      render();
      autoCommit();
    }, 835 + lead);
  } else {
    autoCommit();
  }
}

function transition(before: State['phase'], oldTurn: number): void {
  selected = null;
  save();
  const combat = state.combat;
  if (state.phase === 'battle' && combat && (before !== 'battle' || oldTurn !== combat.turn)) {
    tell(`Turn ${combat.turn}. ${incoming(combat) + (combat.burn ?? 0)} incoming. ${combat.events.join('. ')}`.trim());
    animateRoll(combat.rolls.map(roll => roll.dieId), true);
  } else {
    render();
  }
}

function apply(id: string, target: Target): void {
  const combat = state.combat;
  const forecast = actionPreview(state, id, target);
  const roll = current(id);
  if (!combat || !forecast || !roll) return;
  const playedFace = rollFace(state, roll);
  const actor = target.kind === 'self' ? 'courier' : target.id;
  const point = target.kind === 'die' || target.kind === 'all' ? null : board?.actorPoint(actor!, 'center');
  const old = combat.enemies.find(enemy => target.kind === 'enemy' && enemy.id === target.id);
  const after = forecast.enemies.find(enemy => old?.id === enemy.id);
  const hits = old && after ? old.hp - after.hp + old.guard - after.guard : 0;
  const guard = forecast.guard - combat.guard;
  const seep = old && after ? after.seep - old.seep : 0;
  const burn = old && after ? (after.burn ?? 0) - (old.burn ?? 0) : 0;
  const healed = forecast.playerHp - state.hp;
  if (!play(state, id, target)) return;
  tell(`Played ${faceText(playedFace)}.`);
  transition('battle', state.combat?.turn ?? 0);
  const amount = hits ? `−${hits}` : seep ? `◈ +${seep}` : burn ? `♨ +${burn}` : guard ? `⬟ +${guard}` : healed ? `♥ +${healed}` : '';
  if (point && amount && !board?.motion.matches) {
    const effect = element('span', 'impact-fx', amount);
    effect.style.left = `${point.x}px`;
    effect.style.top = `${point.y}px`;
    effect.dataset.tone = hits ? 'strike' : seep ? 'seep' : 'guard';
    view.parentElement!.append(effect);
    window.setTimeout(() => effect.remove(), 660);
  }
}

function paintImprint(index: number | null, dieId: string | null): void {
  if (variant !== 'fixed' || state.phase !== 'reward') return;
  const offer = index === null ? undefined : state.offers[index];
  for (const card of view.querySelectorAll<HTMLElement>('[data-imprint-target]')) {
    const target = card.dataset.imprintTarget!;
    const preview = offer?.kind === 'item' && target === dieId ? offer.id : '';
    card.classList.toggle('is-ready', offer?.kind === 'item');
    card.classList.toggle('is-previewing', !!preview);
    if ((card.dataset.preview ?? '') === preview) continue;
    const die = owned(target);
    const after = preview && offer ? previewDie(state, offer, die) : null;
    card.querySelector('.face-net')?.replaceWith(faceNet(die, after ?? undefined));
    card.dataset.preview = preview;
  }
}

function imprintAt(x: number, y: number): string | null {
  for (const node of document.elementsFromPoint(x, y)) {
    const card = node.closest<HTMLElement>('[data-imprint-target]');
    if (card) return card.dataset.imprintTarget!;
  }
  return null;
}

function finishImprint(index: number, id: string): void {
  if (!chooseOffer(state, index, id)) return;
  offerIndex = null;
  transition('reward', 0);
}

function closeInspection(returnFocus = false): void {
  if (!inspection) return;
  const { node, anchor } = inspection;
  inspection = null;
  tooltips.hide();
  node.remove();
  anchor.removeAttribute('aria-expanded');
  if (returnFocus && anchor.isConnected) anchor.focus({ preventScroll: true });
}

const INSPECT_TARGET = '[data-inspect-item], [data-inspect-die]';

function inspectAnchor(target: EventTarget | null): HTMLElement | null {
  return target instanceof Element ? target.closest<HTMLElement>(INSPECT_TARGET) : null;
}

function openInspection(anchor: HTMLElement, keyboard = false): void {
  const itemId = anchor.dataset.inspectItem;
  const die = state.dice.find(entry => entry.id === anchor.dataset.inspectDie);
  const battle = state.phase === 'battle' && !itemId;
  let title: string;
  let heading: string;
  let net: HTMLElement;
  if (itemId) {
    title = heading = ITEMS[itemId].name;
    net = itemNet(itemId, true);
  } else if (die) {
    title = dieLabel(die.id) + ' layout';
    heading = battle ? 'Die faces' : dieLabel(die.id) + ' faces';
    net = faceNet(die, undefined, true, battle ? state : undefined);
  } else return;

  const panel = battle ? element('section', 'die-inspection') : element('dialog', 'die-inspection reward-inspection');
  showInspection(panel, anchor, title, heading, net, battle ? 'Close die layout' : 'Close inspection');
  if (keyboard) panel.querySelector<HTMLElement>('[data-face-help]')?.focus({ preventScroll: true });
}

function openEnemyDie(anchor: HTMLButtonElement): void {
  const room = currentRoom(state);
  const combat = state.combat;
  if (room.type !== 'battle' || !combat) return;
  const index = Number(anchor.dataset.index);
  const die = dieForIntent(room, combat, index, !!state.map);
  if (!die) return;
  const face = combat.intents[index].dieRoll?.face;
  const chart = enemyDieChart(die, face !== undefined && die.faces[face] ? face : undefined);
  const currentIntent = element('p', 'enemy-current-intent', 'This turn', element('span', '', anchor.title));
  const title = anchor.dataset.enemyName + ' die';
  showInspection(element('dialog', 'die-inspection enemy-die-inspection'), anchor, title, title,
    element('div', '', currentIntent, chart), 'Close enemy die');
}

function showInspection(panel: HTMLElement, anchor: HTMLElement, title: string, heading: string, content: HTMLElement, closeLabel: string): void {
  closeInspection();
  tooltips.hide();
  const close = button('subtle', 'close-inspection', closeLabel, 'Close');
  close.addEventListener('click', () => closeInspection(true));
  panel.append(element('div', 'inspect-heading', element('h2', '', heading), close), content);
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', title);
  root.append(panel);
  inspection = { node: panel, anchor };
  anchor.setAttribute('aria-expanded', 'true');

  if (panel instanceof HTMLDialogElement) {
    panel.addEventListener('cancel', event => {
      event.preventDefault();
      closeInspection(true);
    });
    panel.addEventListener('click', event => {
      if (event.target === panel) closeInspection(true);
    });
    panel.showModal();
    close.focus({ preventScroll: true });
  } else positionFloater(panel, anchor.getBoundingClientRect(), true);
}

function cancelInspectionPress(): void {
  if (inspectionPress) window.clearTimeout(inspectionPress.timer);
  inspectionPress = null;
}

root.addEventListener('pointerdown', event => {
  if ((state.phase !== 'reward' && state.phase !== 'victory')
    || !event.isPrimary || event.button !== 0 || (event.pointerType !== 'touch' && event.pointerType !== 'pen')) return;
  const anchor = inspectAnchor(event.target);
  if (!anchor) return;
  cancelInspectionPress();
  const press = { anchor, pointer: event.pointerId, x: event.clientX, y: event.clientY, timer: 0, opened: false };
  press.timer = window.setTimeout(() => {
    if (!anchor.isConnected || drag?.started) return;
    press.opened = true;
    clearDrag();
    openInspection(anchor);
  }, 460);
  inspectionPress = press;
});

document.addEventListener('pointermove', event => {
  const press = inspectionPress;
  if (press?.pointer === event.pointerId && !press.opened && Math.hypot(event.clientX - press.x, event.clientY - press.y) > 6) {
    cancelInspectionPress();
  }
}, true);

function endInspectionPress(event: PointerEvent): void {
  const press = inspectionPress;
  if (press?.pointer !== event.pointerId) return;
  cancelInspectionPress();
  if (press.opened) suppressClickUntil = performance.now() + 400;
}
document.addEventListener('pointerup', endInspectionPress, true);
document.addEventListener('pointercancel', endInspectionPress, true);

root.addEventListener('contextmenu', event => {
  const anchor = inspectAnchor(event.target);
  if (!anchor) return;
  event.preventDefault();
  if (state.phase !== 'battle' && event.pointerType === 'touch') return;
  if (!rolling && !drag?.started && inspection?.anchor !== anchor) openInspection(anchor);
});

document.addEventListener('pointerdown', event => {
  if (event.isPrimary && event.button === 0) suppressClickUntil = 0;
  if (event.button === 0 && inspection && !inspection.node.contains(event.target as Node)) closeInspection();
});
window.addEventListener('resize', () => {
  cancelInspectionPress();
  if (!(inspection?.node instanceof HTMLDialogElement)) closeInspection();
});

/** The target of a face that has nothing to aim, or null when the player must choose one. */
function automaticTarget(face: Face): Target | null {
  if (face.target === 'self') return { kind: 'self' };
  if (face.target === 'all') return { kind: 'all' };
  return null;
}

/** Commits only when the last available reroll is spent. */
function autoCommit(): boolean {
  const combat = state.combat;
  if (ordered() || rolling || state.phase !== 'battle' || !combat || combat.phase !== 'roll') return false;
  if (combat.rerolls > 0) return false;
  const turn = combat.turn;
  if (!commitRoll(state)) return false;
  tell('Dice committed.');
  transition('battle', turn);
  return true;
}

function toggleDie(id: string): void {
  const combat = state.combat;
  const roll = current(id);
  if (!combat || !roll || roll.used) return;
  if (combat.phase === 'roll') {
    if (setHold(state, id, !roll.held)) {
      save();
      render();
    }
  } else if (selected && selected !== id && canPlay(state, selected, { kind: 'die', id })) {
    apply(selected, { kind: 'die', id });
  } else {
    // Faces that need no aiming (self or all enemies) are used the moment they are chosen.
    const aim = automaticTarget(rollFace(state, roll));
    if (aim && canPlay(state, id, aim)) {
      selected = null;
      apply(id, aim);
    } else {
      selected = selected === id ? null : id;
      paintTargets(selected);
    }
  }
}

function clearSave(): void {
  try {
    localStorage.removeItem(saveKey);
  } catch {
    // Nothing to clear when storage is unavailable.
  }
}

/** Leave the current run and go back to hero select (or restart the seeded run). */
function restart(): void {
  clearTimeout(animTimer);
  rolling = false;
  offerIndex = null;
  rewardDie = null;
  selected = null;
  ledger = null;
  clearSave();
  if (seeded) {
    state = makeRun(variant, Number(seedParam), state.character);
    transition('victory', 0);
  } else {
    choosing = true;
    state = makeRun(variant, randomSeed(), state.character);
    render();
  }
}

function abandonRun(): void {
  menu = false;
  confirmingAbandon = false;
  tell('Run abandoned.');
  restart();
}

// Touch can retarget the release click when a long press opens the preview.
document.addEventListener('click', event => {
  if (event.detail === 0 || performance.now() >= suppressClickUntil) return;
  event.preventDefault();
  event.stopPropagation();
}, true);

view.addEventListener('click', event => {
  const node = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-action]');
  if (!node || node.disabled || node.getAttribute('aria-disabled') === 'true') return;
  const action = node.dataset.action;
  const turn = state.combat?.turn ?? 0;

  if (action === 'hazard-details') {
    const hint = view.querySelector(ordered() ? '.formation-hint' : '.enemy-hazard-hint');
    if (hint) hint.textContent = node.title;
    tell(node.title);
    return;
  }
  if (action === 'menu') {
    menu = !menu;
    confirmingAbandon = false;
    selected = null;
    render();
    return;
  }
  if (action === 'abandon' || action === 'abandon-cancel') {
    confirmingAbandon = action === 'abandon';
    render();
    return;
  }
  if (action === 'abandon-confirm') {
    abandonRun();
    return;
  }
  if (menu) return;
  if (action === 'ledger' || action === 'relic-ledger') {
    const panel = action === 'relic-ledger' ? 'relics' : 'dice';
    ledger = ledger === panel ? null : panel;
    ledgerDie = state.dice[0].id;
    selected = null;
    render();
    return;
  }
  if (action === 'inspect-reward') {
    openInspection(node, event.detail === 0);
    return;
  }
  if (action === 'inspect') {
    ledgerDie = node.dataset.id!;
    render();
    return;
  }
  if (action === 'character') {
    clearTimeout(animTimer);
    rolling = false;
    state = makeRun(variant, randomSeed(), node.dataset.id);
    choosing = false;
    offerIndex = null;
    rewardDie = null;
    transition('victory', 0);
    return;
  }
  if (rolling || ledger) return;
  if (action === 'enemy-die') {
    openEnemyDie(node);
    return;
  }

  if (action === 'explore-tile' && explore(state, node.dataset.tile!)) {
    transition('map', 0);
  } else if (action === 'start-boss' && startBoss(state)) {
    transition('map', 0);
  } else if (action === 'die') toggleDie(node.dataset.die!);
  else if (action === 'target' && selected) apply(selected, targetFor(node));
  else if (action === 'reroll') {
    const active = state.combat?.rolls.filter(roll => !roll.held).map(roll => roll.dieId) ?? [];
    if (reroll(state)) {
      save();
      tell(`Rerolled ${active.length} dice. ${state.combat?.events.join('. ') ?? ''}`.trim());
      animateRoll(active);
    }
  } else if (action === 'commit' && commitRoll(state)) {
    tell('Dice committed.');
    transition('battle', turn);
  } else if (action === 'end' && endTurn(state)) {
    transition('battle', turn);
  } else if (action === 'offer') {
    const index = Number(node.dataset.index);
    const offer = state.offers[index];
    if (!offer) return;
    if (offer.kind === 'relic') {
      if (chooseOffer(state, index)) {
        offerIndex = null;
        tell(`${currentRoom(state).type === 'shop' ? 'Bought' : 'Gained'} ${describeOffer(offer)}.`);
        transition('reward', 0);
      }
    } else if (offer.kind === 'add' || offer.kind === 'heal' || offer.kind === 'gold' || offer.kind === 'restore') {
      if (chooseOffer(state, index)) {
        offerIndex = null;
        transition('reward', 0);
      }
    } else if (offer.kind === 'upgrade') {
      offerIndex = index;
      rewardDie = null;
      render();
      view.querySelector<HTMLElement>('.net-tile.is-upgradable')?.focus();
    } else if (variant === 'fixed' && offer.kind === 'item' && !['shop', 'event'].includes(currentRoom(state).type)) {
      offerIndex = offerIndex === index ? null : index;
      render();
      if (offerIndex !== null && event.detail === 0) view.querySelector<HTMLElement>('[data-imprint-target]')?.focus();
    } else {
      offerIndex = index;
      rewardDie = null;
      render();
      view.querySelector<HTMLButtonElement>('[data-action="reward-die"]')?.focus({ preventScroll: true });
    }
  } else if (action === 'imprint-die') {
    if (offerIndex !== null) finishImprint(offerIndex, node.dataset.imprintTarget!);
    else openInspection(node, event.detail === 0);
  } else if (action === 'upgrade-face') {
    if (offerIndex !== null && chooseOffer(state, offerIndex, node.dataset.upgradeDie, node.dataset.slot as Slot)) {
      offerIndex = null;
      transition('reward', 0);
    }
  } else if (action === 'reward-die') {
    rewardDie = node.dataset.id!;
    render();
  } else if (action === 'take' && offerIndex !== null && rewardDie && chooseOffer(state, offerIndex, rewardDie)) {
    offerIndex = null;
    rewardDie = null;
    transition('reward', 0);
  } else if (action === 'back') {
    offerIndex = null;
    rewardDie = null;
    render();
  } else if (action === 'skip' && advance(state)) {
    offerIndex = null;
    transition('reward', 0);
  } else if (action === 'new') {
    restart();
  }
});

view.addEventListener('pointerdown', event => {
  if (rolling || ledger || menu || event.button !== 0 || drag) return;
  const element = event.target as HTMLElement;
  if (ordered() && state.phase === 'battle' && event.isPrimary && event.pointerType === 'touch') {
    const button = element.closest<HTMLButtonElement>('button[data-action]');
    if (button && battleTapActions.has(button.dataset.action!)) {
      battleTap = { button, pointer: event.pointerId, x: event.clientX, y: event.clientY };
    }
  }
  const item = element.closest<HTMLElement>('[data-drag-item]');
  const dieButton = element.closest<HTMLElement>('[data-die]');
  const id = dieButton?.dataset.die;
  let source: Drag['source'];
  if (item && state.phase === 'reward') source = { kind: 'item', index: Number(item.dataset.dragItem) };
  else if (id && current(id) && !current(id)?.used && dieButton.getAttribute('aria-disabled') !== 'true') source = { kind: 'die', id };
  else return;
  drag = { source, pointer: event.pointerId, x: event.clientX, y: event.clientY, started: false };
});

function formationSlotAt(x: number, y: number, id: string): HTMLElement | undefined {
  return document.elementsFromPoint(x, y).map(node => node.closest<HTMLElement>('[data-socket]'))
    .find(node => node && canPlaceDie(state, id, Number(node.dataset.socket))) ?? undefined;
}

function arrangeDie(id: string, index: number): void {
  if (!placeDie(state, id, index)) return;
  save();
  tell(`Placed ${dieLabel(id)} in slot ${index + 1}.`);
  render();
}

function pointTarget(x: number, y: number, id: string): HTMLElement | undefined {
  return document.elementsFromPoint(x, y).map(node => node.closest<HTMLElement>('[data-target-kind]'))
    .find(node => node && canPlay(state, id, targetFor(node))) ?? undefined;
}

document.addEventListener('pointermove', event => {
  if (!drag || drag.pointer !== event.pointerId) {
    if (selected && !drag) paintTargets(selected, pointTarget(event.clientX, event.clientY, selected));
    if (variant === 'fixed' && offerIndex !== null && !drag && event.pointerType !== 'touch') paintImprint(offerIndex, imprintAt(event.clientX, event.clientY));
    return;
  }
  if (!drag.started && Math.hypot(event.clientX - drag.x, event.clientY - drag.y) > 6) {
    const source = drag.source;
    if (source.kind === 'item') {
      const offer = state.offers[source.index];
      if (offer.kind !== 'item') return;
      drag.ghost = element('div', 'drag-ghost item-drag-ghost', element('strong', '', ITEMS[offer.id].name), itemNet(offer.id));
    } else {
      const roll = current(source.id)!;
      const identity = DICE[owned(source.id).template];
      drag.ghost = element('div', `drag-ghost tone-${identity.tone}`, chips(rollFace(state, roll), roll.boost));
    }
    drag.started = true;
    tooltips.hide();
    closeInspection();
    view.setPointerCapture(event.pointerId);
    document.body.append(drag.ghost);
    view.dataset.dragging = 'true';
  }
  if (!drag.started) return;
  drag.ghost!.style.transform = `translate(${event.clientX}px, ${event.clientY}px) translate(-50%, -50%)`;
  if (drag.source.kind === 'item') {
    paintImprint(drag.source.index, imprintAt(event.clientX, event.clientY));
  } else if (ordered() && state.combat?.phase === 'roll') {
    view.querySelector('.formation-drop')?.classList.remove('formation-drop');
    formationSlotAt(event.clientX, event.clientY, drag.source.id)?.classList.add('formation-drop');
  } else {
    const isRack = document.elementsFromPoint(event.clientX, event.clientY).some(node => node.closest('[data-hold]'));
    view.dataset.overRack = '' + isRack;
    paintTargets(drag.source.id, pointTarget(event.clientX, event.clientY, drag.source.id));
  }
});

function clearDrag(): Drag | null {
  const previous = drag;
  drag?.ghost?.remove();
  drag = null;
  delete view.dataset.dragging;
  delete view.dataset.overRack;
  view.querySelector('.formation-drop')?.classList.remove('formation-drop');
  if (previous?.source.kind === 'item') paintImprint(offerIndex, null);
  return previous;
}

document.addEventListener('pointerup', event => {
  const ready = drag?.pointer === event.pointerId ? clearDrag() : null;
  const tap = battleTap?.pointer === event.pointerId ? battleTap : null;
  if (tap) battleTap = null;
  if (!ready?.started) {
    // Chromium can omit the synthesized click on the first touch after a drag.
    if (tap?.button.isConnected && tap.button.contains(event.target as Node)
      && Math.hypot(event.clientX - tap.x, event.clientY - tap.y) <= 6) {
      tap.button.click();
      suppressClickUntil = performance.now() + 100;
    }
    return;
  }
  suppressClickUntil = performance.now() + 100;
  if (ready.source.kind === 'item') {
    const id = imprintAt(event.clientX, event.clientY);
    if (id) finishImprint(ready.source.index, id);
    return;
  }
  const id = ready.source.id;
  const finishDrop = (change: () => void) => {
    // Keep the pressed die mounted until the browser has dispatched touchend.
    if (ordered() && event.pointerType === 'touch') window.requestAnimationFrame(change);
    else change();
  };
  if (state.combat?.phase === 'roll') {
    const drop = document.elementsFromPoint(event.clientX, event.clientY);
    const inStage = drop.includes(stage) && event.clientY < (view.querySelector('.combat-tray')?.getBoundingClientRect().top ?? innerHeight);
    if (ordered()) {
      const slot = formationSlotAt(event.clientX, event.clientY, id);
      if (slot) {
        const index = Number(slot.dataset.socket);
        finishDrop(() => arrangeDie(id, index));
      } else if (inStage) {
        finishDrop(() => {
          if (!unplaceDie(state, id)) return;
          save();
          tell(`Released ${dieLabel(id)}.`);
          render();
        });
      }
    } else {
      const inRack = drop.some(node => node.closest('[data-hold]'));
      if ((inRack || inStage) && setHold(state, id, inRack)) save();
      render();
    }
  } else {
    const target = pointTarget(event.clientX, event.clientY, id);
    if (target) finishDrop(() => apply(id, targetFor(target)));
    else paintTargets(selected);
  }
});

document.addEventListener('pointercancel', () => { battleTap = null; clearDrag(); paintTargets(selected); });
view.addEventListener('pointerleave', () => { if (!drag) paintedClear(); });
window.addEventListener('blur', () => { battleTap = null; cancelInspectionPress(); clearDrag(); paintTargets(selected); });
view.addEventListener('focusin', event => {
  if (!(event.target instanceof HTMLElement)) return;
  const imprintTarget = event.target.closest<HTMLElement>('[data-imprint-target]');
  if (imprintTarget?.matches(':focus-visible') && offerIndex !== null) paintImprint(offerIndex, imprintTarget.dataset.imprintTarget!);
  const target = event.target.closest<HTMLElement>('[data-target-kind]');
  if (selected && target) paintTargets(selected, target);
});
document.addEventListener('keydown', event => {
  if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
    const anchor = inspectAnchor(event.target);
    if (anchor && !rolling) {
      event.preventDefault();
      openInspection(anchor, true);
    }
    return;
  }
  if (ordered() && state.combat?.phase === 'roll' && !rolling && !menu && !ledger && !inspection && !drag && /^[1-5]$/.test(event.key)) {
    const id = (document.activeElement as HTMLElement | null)?.dataset.die;
    if (id) {
      event.preventDefault();
      arrangeDie(id, Number(event.key) - 1);
    }
    return;
  }
  if (event.key !== 'Escape') return;
  tooltips.hide();
  if (inspection) { event.preventDefault(); closeInspection(true); return; }
  if (menu) { menu = false; confirmingAbandon = false; render(); }
  else if (ledger) { ledger = null; render(); }
  else if (offerIndex !== null) { offerIndex = null; rewardDie = null; render(); }
  else { selected = null; clearDrag(); paintTargets(null); }
});

await Promise.all([loadEffectImages(), loadFaceImages(FACE_IMAGE_PATHS), loadEnemyArt()]);
board = new Battlefield(stage, positionWorld);
save();
if (!choosing && state.phase === 'battle' && state.combat?.phase === 'roll' && state.combat.turn === 1 && state.combat.rerolls === baseRerolls(variant)) {
  animateRoll(state.combat.rolls.filter(roll => !roll.held).map(roll => roll.dieId), true);
} else {
  render();
  autoCommit();
}
