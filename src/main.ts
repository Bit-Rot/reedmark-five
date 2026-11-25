import './style.css';
import './face-ui.css';
import { CHARACTERS, DICE, FACE_IMAGE_PATHS, ITEMS, ROOMS } from './content.ts';
import { actionPreview, advance, canPlay, chooseOffer, commitRoll, endTurn, incoming, intentValues, isExerted, isSave,
  newRun, offerTargets, play, previewDie, reroll, rollFace, setHold } from './game.ts';
import type { Die, Face, Offer, Roll, State, Target, Variant } from './model.ts';
import { EFFECTS, faceImageUrl, loadEffectImages, loadFaceImages } from './effects.ts';
import { art, Battlefield } from './scene.ts';
import { button, caption, chips, effectChip, element, faceEmblem, FaceTooltips, faceNet, faceText, helpOn, itemNet, positionFloater } from './ui.ts';

declare const __VARIANT__: Variant;

const requested = new URLSearchParams(location.search);
const variant = import.meta.env.DEV && requested.get('mode') === 'pool' ? 'pool' : __VARIANT__;
const seedParam = requested.get('seed');
const seeded = seedParam !== null && /^\d{1,10}$/.test(seedParam);
const characterParam = CHARACTERS.find(c => c.id === requested.get('character'))?.id;
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
  if (seeded) return newRun(variant, Number(seedParam), characterParam);
  try {
    const data: unknown = JSON.parse(localStorage.getItem(saveKey) ?? 'null');
    if (isSave(data, variant)) return data;
  } catch {
    // The game can run even when browser storage is unavailable.
  }
  if (characterParam) return newRun(variant, randomSeed(), characterParam);
  choosing = true;
  return newRun(variant, randomSeed());
}

let state = load();
let selected: string | null = null;
let offerIndex: number | null = null;
let rewardDie: string | null = null;
let ledger = false;
/** The gear menu is open; `confirmingAbandon` is the second step of abandoning the run. */
let menu = false;
let confirmingAbandon = false;
let ledgerDie: string | null = null;
let rolling = false;
let animTimer = 0;
let suppressedClick: { x: number; y: number; until: number } | null = null;
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
let inspection: { node: HTMLElement; anchor: HTMLElement } | null = null;
const tooltips = new FaceTooltips(root, () => rolling || !!drag?.started);
const moveNames = { hit: EFFECTS.hit.name, guard: EFFECTS.guard.name, power: 'Power', wait: 'Wait' };
const moveIcons = { hit: 'hit', guard: 'guard', power: 'boost' } as const;

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
  const room = ROOMS[state.room];
  const path = element('div', 'map-track', caption(room.name));
  const pips = element('div', 'path-pips');
  pips.setAttribute('aria-label', `Room ${state.room + 1} of ${ROOMS.length}`);
  ROOMS.forEach((entry, index) => {
    const type = entry.type === 'battle' ? entry.rank : entry.type;
    const dot = element('span', `path-pip path-pip--${type}${index === state.room ? ' is-current' : index < state.room ? ' is-past' : ''}`);
    dot.title = entry.name;
    pips.append(dot);
  });
  path.append(pips);
  const health = element('div', 'health-hud', element('span', 'heart', '♥'), element('span', 'hero-hp', `${state.hp}`, element('small', '', ` / ${state.maxHp}`)));
  health.append(meter(state.hp, state.maxHp));
  const coin = element('img', 'gold-coin');
  coin.src = faceImageUrl('face-art/library/coin.webp');
  coin.alt = '';
  coin.draggable = false;
  const gold = element('div', 'gold-hud', coin, element('span', 'gold-amount', `${state.gold}`));
  gold.title = 'Gold';
  gold.setAttribute('aria-label', `${state.gold} gold`);
  const kit = button('icon-button', 'ledger', variant === 'pool' ? 'View dice bag' : 'View dice kit', '◫');
  const gear = button('icon-button', 'menu', 'Game menu', '⚙');
  return element('header', 'hud', identity, path, element('div', 'hud-right', element('div', 'hud-stats', health, gold), kit, gear));
}

function targetFor(node: HTMLElement): Target {
  return { kind: node.dataset.targetKind as Target['kind'], id: node.dataset.targetId };
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
    ),
  ));
  world.append(self);
  const intents = intentValues(combat);
  for (const enemy of combat.enemies) {
    if (enemy.hp <= 0) continue;
    const target = button(`actor-target actor-target--enemy actor-target--${enemy.sprite}`, 'target', `${enemy.name} ${enemy.hp} of ${enemy.maxHp} HP`);
    target.dataset.actor = enemy.id;
    target.dataset.targetKind = 'enemy';
    target.dataset.targetId = enemy.id;
    target.dataset.focus = enemy.id;
    const enemyIntents = element('span', 'intents');
    for (const intent of intents.filter(intent => intent.owner === enemy.id)) {
      const value = intent.move === 'wait' ? '' : '' + intent.value;
      const token = intent.move === 'wait' ? '·' : effectChip(moveIcons[intent.move], value);
      const pip = element('span', `intent intent--${intent.move}`, token);
      pip.title = intent.move === 'wait' ? 'Wait' : `${value} ${moveNames[intent.move]}`;
      enemyIntents.append(pip);
    }
    target.append(enemyIntents, element('span', 'actor-caption',
      element('strong', '', enemy.name),
      meter(enemy.hp, enemy.maxHp),
      element('span', 'enemy-hp', `${enemy.hp}/${enemy.maxHp}`,
        enemy.guard ? effectChip('guard', enemy.guard) : null,
        enemy.seep ? effectChip('seep', enemy.seep) : null,
        enemy.vulnerable ? effectChip('vulnerable', enemy.vulnerable) : null,
        enemy.weak ? effectChip('weak', enemy.weak) : null,
      ),
    ));
    world.append(target);
  }
  combat.rolls.forEach(roll => {
    if (roll.held || roll.used) return;
    const die = owned(roll.dieId);
    const identity = DICE[die.template];
    const face = rollFace(state, roll);
    const dieButton = button(`stage-cube tone-${identity.tone}`, 'die', faceText(face), element('span', 'world-face', faceEmblem(face)));
    dieButton.dataset.worldDie = roll.dieId;
    dieButton.dataset.die = roll.dieId;
    dieButton.dataset.inspectDie = roll.dieId;
    helpOn(dieButton, face);
    dieButton.dataset.focus = roll.dieId;
    world.append(dieButton);
  });
  return world;
}

function tray(): HTMLElement | null {
  if (state.phase !== 'battle' || !state.combat) return null;
  const combat = state.combat;
  const rack = element('div', 'rack');
  rack.dataset.hold = 'true';
  rack.setAttribute('aria-label', 'Dice sockets');
  combat.rolls.forEach((roll, index) => {
    const slot = element('div', `socket${roll.held ? ' is-filled' : ''}${roll.used ? ' is-spent' : ''}`);
    slot.dataset.hold = 'true';
    if (!roll.held) {
      slot.append(element('span', 'socket-seal', '◇'));
    } else if (roll.used) {
      slot.append(element('span', 'socket-seal', '·'));
    } else {
      const die = owned(roll.dieId);
      const identity = DICE[die.template];
      const face = rollFace(state, roll);
      const seated = button(`seated tone-${identity.tone}`, 'die', faceText(face, roll.boost), chips(face, roll.boost));
      seated.dataset.die = roll.dieId;
      seated.dataset.inspectDie = roll.dieId;
      helpOn(seated, face, roll.boost);
      seated.dataset.focus = roll.dieId;
      if (combat.phase === 'play') {
        seated.dataset.targetKind = 'die';
        seated.dataset.targetId = roll.dieId;
      }
      slot.append(seated);
    }
    slot.dataset.socket = '' + index;
    rack.append(slot);
  });

  const predicted = incoming(combat);
  const damage = Math.max(0, predicted - combat.guard);
  const readout = element('div', 'threat',
    caption(`Turn ${combat.turn}`),
    element('span', 'threat-value', effectChip('hit', predicted), element('span', 'muted', ' / '), effectChip('guard', combat.guard)),
  );
  readout.setAttribute('aria-label', `Incoming ${predicted} Damage. ${combat.guard} Block. HP loss ${damage}.`);
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
  const panel = element('div', 'combat-tray', element('div', 'tray-controls', readout, commands), rack);
  panel.setAttribute('aria-busy', '' + rolling);
  return panel;
}

function describeOffer(offer: Offer): string {
  if (offer.kind === 'item') return ITEMS[offer.id].name;
  if (offer.kind === 'add') return 'New die';
  if (offer.kind === 'transform') return 'Transform a die';
  return offer.kind === 'heal' ? 'Rest' : 'Remove';
}

function offerBody(offer: Offer): HTMLElement {
  if (offer.kind === 'item') return itemNet(offer.id);
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
    const kind = entry.kind === 'item' ? ITEMS[entry.id].rarity : entry.kind === 'add' ? 'New die' : entry.kind;
    const card = button(`offer-card offer--${kind.toLowerCase().replace(' ', '-')}`, 'offer', describeOffer(entry),
      caption(kind), element('strong', '', describeOffer(entry)), offerBody(entry));
    card.dataset.index = '' + index;
    card.dataset.focus = `offer-${index}`;
    card.disabled = ['item', 'remove', 'transform'].includes(entry.kind) && !offerTargets(state, entry).length;
    if (direct && entry.kind === 'item') {
      card.dataset.dragItem = '' + index;
      card.setAttribute('aria-pressed', '' + (offerIndex === index));
    }
    grid.append(card);
  });
  return grid;
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

function fixedOfferSheet(): HTMLElement {
  const room = ROOMS[state.room];
  const pane = sheet(room.type === 'battle' ? 'Spoils' : room.name, button('subtle', 'skip', 'Skip reward', 'Skip'));
  pane.classList.add('fixed-spoils');
  const earned = goldBanner();
  if (earned) pane.append(earned);
  const kit = element('div', 'imprint-kit');
  for (const die of state.dice) {
    const name = dieLabel(die.id);
    const card = button('imprint-die', 'imprint-die', name, faceNet(die));
    card.dataset.imprintTarget = die.id;
    card.dataset.inspectDie = die.id;
    card.dataset.focus = `imprint-${die.id}`;
    card.setAttribute('aria-label', offerIndex === null ? name : `Imprint on ${name}`);
    kit.append(card);
  }
  pane.append(offerGrid(true), element('div', 'imprint-heading', caption('Imprint onto a die')), kit);
  return element('div', 'overlay', pane);
}

function renderOffers(): HTMLElement {
  if (variant === 'fixed') return fixedOfferSheet();
  const room = ROOMS[state.room];
  const offer = offerIndex === null ? undefined : state.offers[offerIndex];
  const title = offer ? describeOffer(offer) : room.type === 'battle' ? 'Spoils' : room.name;
  const pane = sheet(title, offer ? button('subtle', 'back', 'Back to rewards', 'Back') : button('subtle', 'skip', 'Skip reward', 'Skip'));
  const earned = offer ? null : goldBanner();
  if (earned) pane.append(earned);
  if (!offer) {
    pane.append(offerGrid());
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
    const verb = offer.kind === 'item' ? 'Imprint' : offer.kind === 'transform' ? 'Transform' : 'Remove';
    const confirm = button('control control--primary', 'take', verb, verb);
    confirm.disabled = !chosen;
    const detail = element('div', 'placement-detail');
    if (chosen) {
      const result = previewDie(state, offer, chosen);
      detail.append(faceNet(chosen, result ?? undefined));
    } else if (offer.kind !== 'remove') detail.append(offerBody(offer));
    pane.append(options, detail, element('div', 'sheet-footer', confirm));
  }
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
  pane.append(row, element('div', 'placement-detail', faceNet(displayed, undefined, true)));
  if (variant === 'pool' && remaining) {
    pane.append(element('div', 'ledger-counts', caption(`${remaining.length} remaining`), caption(`${state.dice.length} owned`)));
  }
  return element('div', 'overlay', pane);
}

function renderSelect(): HTMLElement {
  const choices = CHARACTERS.map(hero => {
    const choice = button('control character-choice', 'character', `Play ${hero.name}`, element('strong', '', hero.name), element('small', '', `${hero.starterDice.length} starter dice`));
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
  const score = won ? `${state.hp} HP left` : ROOMS[state.room].name;
  return element('div', 'overlay', element('section', 'sheet ending',
    element('div', 'end-mark', won ? '✧' : '◇'),
    element('h1', '', won ? 'Passage clear' : 'Run ended'),
    caption(score), state.gold ? caption(`${state.gold} gold`) : null, button('control control--primary', 'new', 'New run', 'New run')));
}

function positionWorld(): void {
  if (!board) return;
  for (const actor of view.querySelectorAll<HTMLElement>('[data-actor]')) {
    const id = actor.dataset.actor!;
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
  else if (ledger) view.append(renderLedger());
  else if (state.phase === 'reward') view.append(renderOffers());
  else if (state.phase === 'victory' || state.phase === 'defeat') view.append(renderEnding());
  if (art('courier')) stage.dataset.illustrated = 'true';
  board?.setActors(combat?.enemies ?? []);
  board?.syncDice(fighting && combat ? combat.rolls.map(roll => ({
    die: owned(roll.dieId), slot: roll.slot, shown: !roll.held && !roll.used, exerted: isExerted(state, roll.dieId),
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
  for (const node of view.querySelectorAll<HTMLElement>('[data-target-kind]')) {
    node.classList.toggle('is-legal', !!id && !ledger && !menu && canPlay(state, id, targetFor(node)));
  }
  for (const node of view.querySelectorAll<HTMLElement>('[data-die]')) {
    node.classList.toggle('is-selected', !!id && node.dataset.die === id);
    if (node.dataset.die === id && !drag?.started) node.setAttribute('aria-pressed', 'true');
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
    if (old.vulnerable !== next.vulnerable) labels.push(`⚠ +${next.vulnerable - old.vulnerable}`);
    if (old.weak !== next.weak) labels.push(`▾ +${next.weak - old.weak}`);
  } else if (target.kind === 'die') {
    const old = existing.rolls.find(roll => roll.dieId === target.id)!;
    const next = playResult.rolls.find(roll => roll.dieId === target.id)!;
    labels.push(`✚ +${next.boost - old.boost}`);
  }
  if (existing.guard !== playResult.guard) labels.push(`⬟ +${playResult.guard - existing.guard}`);
  if (existing.ward !== playResult.ward) labels.push(`◒ +${playResult.ward - existing.ward}`);
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
  if (lead && state.combat) board?.tossIntents(intentValues(state.combat));
  render(new Set(ids), lead);
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
    tell(`Turn ${combat.turn}. ${incoming(combat)} incoming. ${combat.events.join('. ')}`.trim());
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
  if (!play(state, id, target)) return;
  tell(`Played ${faceText(playedFace)}.`);
  transition('battle', state.combat?.turn ?? 0);
  const amount = hits ? `−${hits}` : seep ? `◈ +${seep}` : guard ? `⬟ +${guard}` : '';
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

function openInspection(anchor: HTMLElement, keyboard = false): void {
  const id = anchor.dataset.inspectDie;
  if (!id) return;
  const die = state.dice.find(die => die.id === id);
  if (!die) return;
  closeInspection();
  tooltips.hide();
  const close = button('subtle', 'close-inspection', 'Close die layout', 'Close');
  close.addEventListener('click', () => closeInspection(true));
  const panel = element('section', 'die-inspection',
    element('div', 'inspect-heading', element('h2', '', 'Die faces'), close),
    faceNet(die, undefined, true),
  );
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', `${dieLabel(die.id)} layout`);
  root.append(panel);
  positionFloater(panel, anchor.getBoundingClientRect(), true);
  inspection = { node: panel, anchor };
  anchor.setAttribute('aria-expanded', 'true');
  if (keyboard) panel.querySelector<HTMLElement>('[data-face-help]')?.focus({ preventScroll: true });
}

root.addEventListener('contextmenu', event => {
  const anchor = (event.target as HTMLElement).closest<HTMLElement>('[data-inspect-die]');
  if (!anchor) return;
  event.preventDefault();
  if (!rolling && !drag?.started) openInspection(anchor);
});

document.addEventListener('pointerdown', event => {
  if (event.button === 0 && inspection && !inspection.node.contains(event.target as Node)) closeInspection();
});
window.addEventListener('resize', () => closeInspection());

/** The target of a face that has nothing to aim, or null when the player must choose one. */
function automaticTarget(face: Face): Target | null {
  if (face.target === 'self') return { kind: 'self' };
  if (face.target === 'all') return { kind: 'all' };
  return null;
}

/** Commits the roll once nothing more can change: the last reroll is spent, or every die is held. */
function autoCommit(): boolean {
  const combat = state.combat;
  if (rolling || state.phase !== 'battle' || !combat || combat.phase !== 'roll') return false;
  if (combat.rerolls > 0 && !combat.rolls.every(roll => roll.held)) return false;
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
      if (!autoCommit()) render();
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
  ledger = false;
  clearSave();
  if (seeded) {
    state = newRun(variant, Number(seedParam), state.character);
    transition('victory', 0);
  } else {
    choosing = true;
    state = newRun(variant, randomSeed(), state.character);
    render();
  }
}

function abandonRun(): void {
  menu = false;
  confirmingAbandon = false;
  tell('Run abandoned.');
  restart();
}

view.addEventListener('click', event => {
  if (suppressedClick && performance.now() < suppressedClick.until && event.detail > 0
    && Math.hypot(event.clientX - suppressedClick.x, event.clientY - suppressedClick.y) < 3) return;
  const node = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-action]');
  if (!node || node.disabled) return;
  const action = node.dataset.action;
  const turn = state.combat?.turn ?? 0;

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
  if (action === 'ledger') {
    ledger = !ledger;
    ledgerDie = state.dice[0].id;
    selected = null;
    render();
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
    state = newRun(variant, randomSeed(), node.dataset.id);
    choosing = false;
    offerIndex = null;
    rewardDie = null;
    transition('victory', 0);
    return;
  }
  if (rolling || ledger) return;

  if (action === 'die') toggleDie(node.dataset.die!);
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
    if (offer.kind === 'add' || offer.kind === 'heal') {
      if (chooseOffer(state, index)) {
        offerIndex = null;
        transition('reward', 0);
      }
    } else if (variant === 'fixed' && offer.kind === 'item') {
      offerIndex = offerIndex === index ? null : index;
      render();
      if (offerIndex !== null && event.detail === 0) view.querySelector<HTMLElement>('[data-imprint-target]')?.focus();
    } else {
      offerIndex = index;
      rewardDie = null;
      render();
      view.querySelector<HTMLButtonElement>('[data-action="reward-die"]')?.focus();
    }
  } else if (action === 'imprint-die') {
    if (offerIndex !== null) finishImprint(offerIndex, node.dataset.imprintTarget!);
    else openInspection(node, event.detail === 0);
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
  const item = element.closest<HTMLElement>('[data-drag-item]');
  const id = element.closest<HTMLElement>('[data-die]')?.dataset.die;
  let source: Drag['source'];
  if (item && state.phase === 'reward') source = { kind: 'item', index: Number(item.dataset.dragItem) };
  else if (id && current(id) && !current(id)?.used) source = { kind: 'die', id };
  else return;
  drag = { source, pointer: event.pointerId, x: event.clientX, y: event.clientY, started: false };
});

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
  if (previous?.source.kind === 'item') paintImprint(offerIndex, null);
  return previous;
}

document.addEventListener('pointerup', event => {
  if (drag?.pointer !== event.pointerId) return;
  const ready = clearDrag();
  if (!ready?.started) return;
  suppressedClick = { x: event.clientX, y: event.clientY, until: performance.now() + 100 };
  if (ready.source.kind === 'item') {
    const id = imprintAt(event.clientX, event.clientY);
    if (id) finishImprint(ready.source.index, id);
    return;
  }
  const id = ready.source.id;
  if (state.combat?.phase === 'roll') {
    const drop = document.elementsFromPoint(event.clientX, event.clientY);
    const inRack = drop.some(node => node.closest('[data-hold]'));
    const inStage = drop.includes(stage) && event.clientY < (view.querySelector('.combat-tray')?.getBoundingClientRect().top ?? innerHeight);
    if ((inRack || inStage) && setHold(state, id, inRack)) save();
    if (!autoCommit()) render();
  } else {
    const target = pointTarget(event.clientX, event.clientY, id);
    if (target) apply(id, targetFor(target));
    else paintTargets(selected);
  }
});

document.addEventListener('pointercancel', () => { clearDrag(); paintTargets(selected); });
view.addEventListener('pointerleave', () => { if (!drag) paintedClear(); });
window.addEventListener('blur', () => { clearDrag(); paintTargets(selected); });
view.addEventListener('focusin', event => {
  if (!(event.target instanceof HTMLElement)) return;
  const imprintTarget = event.target.closest<HTMLElement>('[data-imprint-target]');
  if (imprintTarget?.matches(':focus-visible') && offerIndex !== null) paintImprint(offerIndex, imprintTarget.dataset.imprintTarget!);
  const target = event.target.closest<HTMLElement>('[data-target-kind]');
  if (selected && target) paintTargets(selected, target);
});
document.addEventListener('keydown', event => {
  if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
    const anchor = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-inspect-die]') : null;
    if (anchor && !rolling) {
      event.preventDefault();
      openInspection(anchor, true);
    }
    return;
  }
  if (event.key !== 'Escape') return;
  tooltips.hide();
  if (inspection) { closeInspection(true); return; }
  if (menu) { menu = false; confirmingAbandon = false; render(); }
  else if (ledger) { ledger = false; render(); }
  else if (offerIndex !== null) { offerIndex = null; rewardDie = null; render(); }
  else { selected = null; clearDrag(); paintTargets(null); }
});

await Promise.all([loadEffectImages(), loadFaceImages(FACE_IMAGE_PATHS)]);
board = new Battlefield(stage, positionWorld);
save();
if (!choosing && state.phase === 'battle' && state.combat?.phase === 'roll' && state.combat.turn === 1 && state.combat.rerolls === 2) {
  animateRoll(state.combat.rolls.filter(roll => !roll.held).map(roll => roll.dieId), true);
} else {
  render();
  autoCommit();
}
