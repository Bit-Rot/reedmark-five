import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { explorationDistance, frontier } from '../../src/campaign-map.ts';
import { ITEMS, ROOMS } from '../../src/content.ts';
import { advance, commitRoll, currentRoom, endTurn, explore, newLinearRun as newRun, newRun as newCampaignRun, rollFace } from '../../src/game.ts';
import type { State, Variant } from '../../src/model.ts';
import { act, takeMapTurn, takeReward } from '../../scripts/policy.ts';
import type { Command } from '../../scripts/policy.ts';

async function center(locator: Locator) {
  const rect = await locator.boundingBox();
  if (!rect) throw new Error('Cannot find drag position');
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
}

async function drag(page: Page, source: Locator, target: Locator | { x: number; y: number }) {
  const from = await center(source);
  const to = 'x' in target ? target : await center(target);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 5 });
  await page.mouse.up();
}

const die = (page: Page, id: string) => page.locator(`button[data-die="${id}"]`);
const action = (page: Page, name: string) => page.locator(`button[data-action="${name}"]`);
const actor = (page: Page, id: string) => page.locator(`button[data-actor="${id}"]`);

test('desktop holds a 3D die, rejects an invalid drop, and plays a valid drop', async ({ page }) => {
  const fixture = newRun('fixed', 231);
  fixture.combat!.rolls[0].slot = 'right';
  fixture.combat!.rolls[1].slot = 'left';
  await saveFixture(page, fixture);
  await expect(page.locator('#stage canvas')).toBeVisible();
  await expect(page.locator('.intent')).toHaveCount(5);
  const hud = (await page.locator('.hud').boundingBox())!;
  for (const line of await page.locator('.intents').all()) {
    const bounds = (await line.boundingBox())!;
    expect(bounds.y).toBeGreaterThan(hud.y + hud.height);
  }
  await expect(page.locator('.stage-cube')).toHaveCount(5);
  await drag(page, die(page, 'd0'), page.locator('[data-socket="0"]'));
  await expect(page.locator('[data-socket="0"] [data-die="d0"]')).toBeVisible();
  await action(page, 'reroll').click();
  await expect(page.locator('[data-socket="0"] [data-die="d0"]')).toBeVisible();
  await action(page, 'commit').click();
  await drag(page, die(page, 'd0'), { x: 36, y: 659 });
  await expect(die(page, 'd0')).toBeVisible();
  await page.waitForTimeout(160);
  await drag(page, die(page, 'd0'), actor(page, 'courier'));
  await expect(page.locator('[data-socket="0"].is-spent')).toBeVisible();
  await expect(actor(page, 'courier').locator('.chip--guard')).toHaveText('1');
  const attack = page.locator('button.seated[aria-label*="Damage"]').first();
  await drag(page, attack, actor(page, 'gnat-a'));
  await expect(actor(page, 'gnat-a')).not.toContainText('7/7');
});

test('narrow touch layout supports holding and targeting dice without hover tooltips', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  const pool = newRun('pool', 231);
  const attacker = pool.combat!.rolls.find(roll => rollFace(pool, roll).target === 'enemy')!.dieId;
  await page.goto('/?route=linear&mode=pool&seed=231');
  await page.getByRole('button', { name: 'View dice bag' }).tap();
  await expect(page.locator('[data-action="inspect"]')).toHaveCount(10);
  await expect(page.getByText('5 remaining')).toBeVisible();
  await page.getByRole('button', { name: 'Close dice' }).tap();
  const tooltip = page.getByRole('tooltip');
  await die(page, attacker).tap();
  await expect(die(page, attacker)).toHaveClass(/seated/);
  await expect(tooltip).toHaveCount(0);
  await die(page, attacker).tap();
  await expect(die(page, attacker)).toHaveClass(/stage-cube/);
  await expect(tooltip).toHaveCount(0);
  await action(page, 'commit').tap();
  await die(page, attacker).tap();
  await expect(actor(page, 'gnat-a')).toHaveClass(/is-legal/);
  await expect(tooltip).toHaveCount(0);
  await actor(page, 'gnat-a').tap();
  await expect(actor(page, 'gnat-a')).not.toContainText('7/7');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  await context.close();
});

async function saveFixture(page: Page, state: State): Promise<void> {
  await page.addInitScript(save => {
    localStorage.setItem(`reedmark:${save.variant}:v1`, JSON.stringify(save));
  }, state);
  await page.goto('/?route=linear');
}

test('hover and right click show illustrated faces and their in-game definitions', async ({ page }) => {
  const state = newRun('fixed', 231);
  state.combat!.rolls[4].slot = 'left';
  await saveFixture(page, state);
  await die(page, 'd4').hover();
  const tooltip = page.getByRole('tooltip');
  await expect(tooltip).toContainText('3 Damage, 1 Vulnerable, Exert');
  await expect(tooltip).toContainText('The target takes 50% more damage');
  await expect(tooltip.locator('dt')).toHaveText([/Damage/, /Vulnerable/, /Exert/]);
  await expect(die(page, 'd4')).not.toHaveAttribute('title', /.+/);

  await die(page, 'd2').click({ button: 'right' });
  const layout = page.getByRole('dialog', { name: 'Die 3 layout' });
  await expect(layout).toBeVisible();
  await expect(layout.locator('.net-tile img')).not.toHaveCount(0);
  await expect(layout.locator('.net-tile')).toHaveCount(6);
  await layout.locator('[data-slot="left"]').hover();
  await expect(tooltip).toContainText('4 Block');
  await expect(tooltip).toContainText('Absorbs incoming damage');
  const hintBounds = (await tooltip.boundingBox())!;
  const layoutBounds = (await layout.boundingBox())!;
  expect(hintBounds.x).toBeGreaterThan(layoutBounds.x + layoutBounds.width);
  await page.keyboard.press('Escape');
  await expect(layout).toHaveCount(0);
  await expect(page.locator('.stage-cube')).toHaveCount(5);
  await die(page, 'd4').focus();
  await expect(tooltip).toContainText('3 Damage, 1 Vulnerable, Exert');
  await page.keyboard.press('Shift+F10');
  await expect(page.getByRole('dialog', { name: 'Die 5 layout' })).toBeVisible();
});

test('Fixed Five keeps every die visible and applies an item directly on drop', async ({ page }) => {
  const state = newRun('fixed', 231);
  state.phase = 'reward';
  state.offers = [{ kind: 'item', id: 'sea' }, { kind: 'item', id: 'moss' }, { kind: 'item', id: 'nick' }];
  await saveFixture(page, state);
  const item = page.getByRole('button', { name: 'Sea Thread' });
  const target = page.locator('[data-imprint-target="d0"]');
  await expect(page.locator('[data-imprint-target]')).toHaveCount(5);
  await expect(target.locator('.net-tile')).toHaveCount(6);
  await drag(page, item, { x: 28, y: 650 });
  await expect(page.getByRole('heading', { name: 'Spoils' })).toBeVisible();

  const from = await center(item);
  const to = await center(target);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 6 });
  await expect(target).toHaveClass(/is-previewing/);
  await expect(target.locator('.net-tile.is-changed')).toHaveCount(2);
  await page.mouse.up();

  await expect(page.locator('#interface')).toHaveAttribute('data-phase', 'battle');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('reedmark:fixed:v1')!)) as State;
  expect(saved.dice[0].imprints).toEqual({ top: 'sea', bottom: 'sea' });
  expect(saved.dice[1].imprints).toEqual({});
  expect(saved.room).toBe(1);
});

test('Fixed Five accepts a tap on an item and a tap on its destination', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true, hasTouch: true, reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  const state = newRun('fixed', 231);
  state.phase = 'reward';
  state.offers = [{ kind: 'item', id: 'sea' }, { kind: 'item', id: 'moss' }, { kind: 'item', id: 'nick' }];
  await saveFixture(page, state);
  await page.getByRole('button', { name: 'Sea Thread' }).tap();
  await page.getByRole('button', { name: 'Imprint on Die 1' }).tap();
  await expect(page.locator('#interface')).toHaveAttribute('data-phase', 'battle');
  await context.close();
});

async function perform(page: Page, command: Command): Promise<void> {
  if (command.action === 'explore') {
    await page.locator('button[data-tile="' + command.id + '"]').click();
  } else if (command.action === 'boss') {
    await action(page, 'start-boss').click();
  } else if (command.action === 'hold') {
    await die(page, command.id).click();
  } else if (command.action === 'place') {
    await drag(page, die(page, command.id), page.locator(`[data-socket="${command.position}"]`));
  } else if (command.action === 'play') {
    await die(page, command.id).click();
    const target = command.target;
    // Self and all-enemy faces are used the moment they are clicked; only aimed faces need a second click.
    if (target.kind === 'enemy') await actor(page, target.id!).click();
    else if (target.kind === 'die') await die(page, target.id!).click();
  } else if (command.action === 'take') {
    await page.locator(`button[data-action="offer"][data-index="${command.index}"]`).click();
    if (command.id && command.slot) {
      await page.locator(`button[data-action="upgrade-face"][data-upgrade-die="${command.id}"][data-slot="${command.slot}"]`).click();
    } else if (command.id) {
      const direct = page.locator(`button[data-imprint-target="${command.id}"]`);
      if (await direct.count()) await direct.click();
      else {
        await page.locator(`button[data-action="reward-die"][data-id="${command.id}"]`).click();
        await action(page, 'take').click();
      }
    }
  } else if (command.action === 'commit') {
    // The page commits by itself after the last available reroll.
    if (await action(page, 'commit').count()) await action(page, 'commit').click();
  } else {
    await action(page, command.action).click();
  }
}

for (const variant of ['fixed', 'pool'] as Variant[]) {
  test(`mirrors a complete ${variant} run through the browser UI`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`/?route=linear&mode=${variant}&seed=1`);
    const s: State = newRun(variant, 1);
    await expect(page.locator('#interface')).toHaveAttribute('data-variant', variant);
    for (let n = 0; n < 140 && (s.phase === 'battle' || s.phase === 'reward'); n++) {
      const commands: Command[] = [];
      if (s.phase === 'battle') act(s, commands);
      else takeReward(s, commands);
      for (const command of commands) await perform(page, command);
      await expect(page.locator('#interface')).toHaveAttribute('data-phase', s.phase);
    }
    // How the run ends depends on balance; the page must agree with the engine either way.
    expect(['victory', 'defeat']).toContain(s.phase);
    await expect(page.getByRole('heading', { name: s.phase === 'victory' ? 'Passage clear' : 'Run ended' })).toBeVisible();
    if (s.phase === 'victory') await expect(page.getByText(`${s.hp} HP left`)).toBeVisible();
    expect(errors).toEqual([]);
  });
}

test('a fresh run asks for a hero and starts with that hero\'s dice', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/?route=linear');
  await expect(page.getByRole('heading', { name: 'Choose your hero' })).toBeVisible();
  await expect(page.locator('.character-choice')).toHaveCount(4);
  await page.getByRole('button', { name: 'Play Thief' }).click();
  await expect(page.locator('#interface')).toHaveAttribute('data-phase', 'battle');
  await expect(page.locator('.stage-cube')).toHaveCount(5);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('reedmark:fixed:v1')!)) as State;
  expect(saved.character).toBe('thief');
  expect(saved.dice.map(d => d.template)).toEqual(['die_dagger', 'die_dagger', 'die_dodge', 'die_dodge', 'die_kris']);
  expect(errors).toEqual([]);
});

test('vulnerable stacks show on the enemy and exert blanks the die next turn', async ({ page }) => {
  const state = newRun('fixed', 231);
  state.combat!.rolls[4].slot = 'left';
  await saveFixture(page, state);
  await action(page, 'commit').click();
  await die(page, 'd4').click();
  await actor(page, 'gnat-a').click();
  await expect(actor(page, 'gnat-a').locator('.chip--vulnerable')).toContainText('1');
  await expect(page.locator('[data-socket="4"].is-spent')).toBeVisible();
  await action(page, 'end').click();
  await expect(page.locator('#interface')).toHaveAttribute('data-phase', 'battle');
  await expect(actor(page, 'gnat-a').locator('.chip--vulnerable')).toHaveCount(0);
  await action(page, 'commit').click();
  await expect(page.locator('button.seated[aria-label*="Blank"]')).toHaveCount(1);
});

test('picking a hero works right away even with animations enabled', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'no-preference' });
  const page = await context.newPage();
  await page.goto('/?route=linear');
  await page.getByRole('button', { name: 'Play Barbarian' }).click();
  await expect(page.locator('#interface')).toHaveAttribute('data-phase', 'battle');
  await expect(page.locator('.stage-cube')).toHaveCount(5);
  await context.close();
});

test('each face is drawn with the image chosen for its face in the data', async ({ page }) => {
  const state = newRun('fixed', 231);
  state.combat!.rolls[0].slot = 'left';
  state.combat!.rolls[2].slot = 'right';
  await saveFixture(page, state);
  await expect(page.locator('#stage canvas')).toBeVisible();
  await action(page, 'commit').click();
  // The seated chips and the die layout use the face image, not the generic effect icon.
  await expect(page.locator('button.seated[data-die="d0"] img')).toHaveAttribute('src', /face-art\/library\/sword\.webp$/);
  await expect(page.locator('button.seated[data-die="d2"] img')).toHaveAttribute('src', /face-art\/library\/shield\.webp$/);
  await die(page, 'd2').click({ button: 'right' });
  const layout = page.getByRole('dialog', { name: 'Die 3 layout' });
  await expect(layout.locator('.net-tile img').first()).toHaveAttribute('src', /face-art\/library\/shield\.webp$/);
});

test('an exerted die shows the blank face image', async ({ page }) => {
  const state = newRun('fixed', 231);
  state.combat!.rolls[4].slot = 'left';
  await saveFixture(page, state);
  await action(page, 'commit').click();
  await die(page, 'd4').click();
  await actor(page, 'gnat-a').click();
  await action(page, 'end').click();
  await action(page, 'commit').click();
  await expect(page.locator('button.seated[data-die="d4"] img')).toHaveAttribute('src', /face-art\/library\/blank\.webp$/);
});

test('the HUD shows gold, and a won fight pays gold on the spoils screen', async ({ page }) => {
  const state = newRun('fixed', 231);
  const c = state.combat!;
  c.enemies.forEach(e => { e.hp = 1; });
  c.rolls[0].slot = 'left';
  c.rolls[1].slot = 'left';
  await saveFixture(page, state);
  await expect(page.locator('.gold-hud')).toContainText('0');
  await action(page, 'commit').click();
  await die(page, 'd0').click();
  await actor(page, 'gnat-a').click();
  await die(page, 'd1').click();
  await actor(page, 'gnat-b').click();
  await expect(page.getByRole('heading', { name: 'Spoils' })).toBeVisible();
  const banner = page.locator('.gold-banner');
  await expect(banner).toBeVisible();
  const earned = Number((await banner.innerText()).replace(/\D/g, ''));
  expect(earned).toBeGreaterThanOrEqual(10);
  expect(earned).toBeLessThanOrEqual(20);
  await expect(page.locator('.gold-hud .gold-amount')).toHaveText(`${earned}`);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('reedmark:fixed:v1')!)) as State;
  expect(saved.gold).toBe(earned);
});

test('the gear opens a menu where a run can be abandoned after confirming', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/?route=linear&character=thief');
  await expect(page.locator('#interface')).toHaveAttribute('data-phase', 'battle');
  await expect(page.locator('.hud-right [data-action="ledger"]')).toBeVisible();
  const gear = page.locator('.hud-right [data-action="menu"]');
  await expect(gear).toBeVisible();
  await gear.click();
  const menu = page.getByRole('region', { name: 'Menu' });
  await expect(menu).toBeVisible();
  // Closing the menu leaves the run untouched.
  await menu.getByRole('button', { name: 'Close menu' }).click();
  await expect(menu).toHaveCount(0);
  await expect(page.locator('.stage-cube')).toHaveCount(5);
  await page.keyboard.press('Escape');

  await gear.click();
  await page.getByRole('button', { name: 'Abandon run' }).click();
  await expect(page.getByText('Abandon this run?')).toBeVisible();
  await page.getByRole('button', { name: 'Keep playing' }).click();
  await expect(page.getByRole('button', { name: 'Abandon run' })).toBeVisible();
  await page.getByRole('button', { name: 'Abandon run' }).click();
  await page.getByRole('button', { name: 'Confirm abandon run' }).click();
  await expect(page.getByRole('heading', { name: 'Choose your hero' })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('reedmark:fixed:v1'))).toBeNull();
  // Reloading does not bring the abandoned run back.
  await page.goto('/?route=linear');
  await expect(page.getByRole('heading', { name: 'Choose your hero' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('abandoning a seeded run restarts the same seed', async ({ page }) => {
  await page.goto('/?route=linear&seed=231');
  await expect(page.locator('#interface')).toHaveAttribute('data-phase', 'battle');
  await action(page, 'commit').click();
  await page.locator('[data-action="menu"]').click();
  await page.getByRole('button', { name: 'Abandon run' }).click();
  await page.getByRole('button', { name: 'Confirm abandon run' }).click();
  await expect(page.locator('#interface')).toHaveAttribute('data-phase', 'battle');
  await expect(action(page, 'commit')).toBeVisible();
});


test('dice names are never shown or announced; they are code names only', async ({ page }) => {
  await page.goto('/?route=linear&character=thief&seed=11');
  await expect(page.locator('#interface')).toHaveAttribute('data-phase', 'battle');
  const names = /Dagger|Dodge|Kris|Sword|Hammer/;
  expect(await page.locator('#interface').innerText()).not.toMatch(names);
  const labels = await page.locator('[aria-label]').evaluateAll(nodes => nodes.map(n => n.getAttribute('aria-label') ?? ''));
  for (const label of labels) expect(label).not.toMatch(names);
  await action(page, 'commit').click();
  expect(await page.locator('#interface').innerText()).not.toMatch(names);
  await page.locator('[data-action="ledger"]').click();
  expect(await page.locator('#interface').innerText()).not.toMatch(names);
});

test('the roll commits by itself after the second reroll', async ({ page }) => {
  await page.goto('/?route=linear&seed=231');
  await expect(action(page, 'reroll')).toHaveAccessibleName('Reroll, 2 left');
  await action(page, 'reroll').click();
  await expect(action(page, 'commit')).toBeVisible();
  await expect(action(page, 'reroll')).toHaveAccessibleName('Reroll, 1 left');
  await action(page, 'reroll').click();
  await expect(action(page, 'end')).toBeVisible();
  await expect(action(page, 'commit')).toHaveCount(0);
});

test('all dice can be held and released before manually committing', async ({ page }) => {
  await page.goto('/?route=linear&seed=231');
  for (const id of ['d0', 'd1', 'd2', 'd3']) await die(page, id).click();
  await drag(page, die(page, 'd4'), page.locator('[data-socket="4"]'));
  await expect(page.locator('.seated')).toHaveCount(5);
  await expect(action(page, 'commit')).toBeEnabled();
  await expect(action(page, 'reroll')).toBeDisabled();
  await expect(action(page, 'end')).toHaveCount(0);
  await page.waitForTimeout(120); // The drag release must not become a tap on the seated die.
  await die(page, 'd4').click();
  await expect(page.locator('.seated')).toHaveCount(4);
  await expect(action(page, 'reroll')).toBeEnabled();
  await action(page, 'commit').click();
  await expect(action(page, 'end')).toBeVisible();
});

test('clicking a self-target die uses it at once, with no target to pick', async ({ page }) => {
  const state = newRun('fixed', 231);
  state.combat!.rolls[2].slot = 'right';
  await saveFixture(page, state);
  await action(page, 'commit').click();
  await expect(actor(page, 'courier').locator('.chip--guard')).toHaveCount(0);
  await die(page, 'd2').click();
  await expect(actor(page, 'courier').locator('.chip--guard')).toContainText('1');
  await expect(page.locator('[data-socket="2"].is-spent')).toBeVisible();
});

test('an aimed die still waits for a target after being clicked', async ({ page }) => {
  const state = newRun('fixed', 231);
  state.combat!.rolls[0].slot = 'left';
  await saveFixture(page, state);
  await action(page, 'commit').click();
  await die(page, 'd0').click();
  await expect(page.locator('[data-socket="0"].is-spent')).toHaveCount(0);
  await expect(actor(page, 'gnat-a')).toHaveClass(/is-legal/);
  await actor(page, 'gnat-a').click();
  await expect(page.locator('[data-socket="0"].is-spent')).toBeVisible();
});


function campFixture(): State {
  const state = newRun('fixed', 231);
  state.room = 4;
  state.phase = 'reward';
  state.combat = null;
  advance(state); // the camp
  state.offers = [{ kind: 'heal' }, { kind: 'upgrade', keyword: 'cleave' }];
  return state;
}

test('the camp offers a face upgrade; picking it, then a face, adds the keyword and moves on', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await saveFixture(page, campFixture());
  await expect(page.getByRole('heading', { name: 'Camp' })).toBeVisible();
  const card = page.getByRole('button', { name: 'Upgrade: Cleave' });
  await expect(card).toBeVisible();
  await expect(card).toContainText('Hits every enemy');
  await expect(page.getByRole('button', { name: /Rest/ })).toBeVisible();
  await card.click();
  await expect(page.getByRole('heading', { name: 'Upgrade: Cleave' })).toBeVisible();
  // Only faces that can be cleaved (damage faces) are lit; blocks and blanks are locked.
  const lit = page.locator('.net-tile.is-upgradable');
  expect(await lit.count()).toBeGreaterThan(0);
  expect(await page.locator('.net-tile.is-locked').count()).toBeGreaterThan(0);
  await expect(page.locator('.net-tile.is-locked').first()).toBeDisabled();
  const first = lit.first();
  const dieId = await first.getAttribute('data-upgrade-die');
  const slot = await first.getAttribute('data-slot');
  await first.click();
  await expect(page.getByRole('heading', { name: 'Shop', exact: true })).toBeVisible();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('reedmark:fixed:v1')!)) as State;
  expect(ROOMS[saved.room].type).toBe('shop');
  const die = saved.dice.find(d => d.id === dieId)!;
  expect(die.upgrades?.[slot as 'left']).toEqual([{ keyword: 'cleave' }]);
  expect(saved.dice.reduce((n, d) => n + Object.values(d.upgrades ?? {}).flat().length, 0)).toBe(1);
  expect(errors).toEqual([]);
});

test('backing out of the upgrade picker keeps the camp offers', async ({ page }) => {
  await saveFixture(page, campFixture());
  await page.getByRole('button', { name: 'Upgrade: Cleave' }).click();
  await page.getByRole('button', { name: 'Back to rewards' }).click();
  await expect(page.getByRole('button', { name: 'Upgrade: Cleave' })).toBeVisible();
  await page.getByRole('button', { name: 'Upgrade: Cleave' }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Upgrade: Cleave' })).toBeVisible();
});

test('a cleave-upgraded die is used with a single click and hits every enemy', async ({ page }) => {
  const state = newRun('fixed', 231);
  state.dice[0].upgrades = { left: [{ keyword: 'cleave' }] };
  state.combat!.rolls[0].slot = 'left';
  await saveFixture(page, state);
  await action(page, 'commit').click();
  await die(page, 'd0').click();
  await expect(page.locator('[data-socket="0"].is-spent')).toBeVisible();
  await expect(actor(page, 'gnat-a')).not.toContainText('7/7');
  await expect(actor(page, 'gnat-b')).not.toContainText('7/7');
});

test('Moth shows Lampheart, changes live face values, and shows exhausted slots in the die layout', async ({ page }) => {
  const state = newRun('fixed', 231, 'moth');
  const combat = state.combat!;
  combat.intents = combat.intents.map((intent, index) => ({ ...intent, move: index === 0 ? 'hit' : 'wait', value: index === 0 ? 2 : 0 }));
  combat.rolls[0].slot = 'top';
  combat.rolls[1].slot = 'far';
  combat.rolls[2].slot = 'left';
  combat.rolls[4].slot = 'left';
  state.dice[0].imprints.top = 'shed-silk';
  state.dice[1].imprints.far = 'hush-bell';
  await saveFixture(page, state);
  await expect(page.getByRole('img', { name: /Lampheart, 0 Frenzy/ })).toBeVisible();
  await action(page, 'commit').click();
  await expect(die(page, 'd4')).toHaveAccessibleName(/3 Damage/);
  await die(page, 'd2').click();
  await expect(actor(page, 'courier').locator('.chip--burn')).toHaveText('1');
  await expect(die(page, 'd4')).toHaveAccessibleName(/6 Damage/);
  await die(page, 'd0').click();
  await expect(die(page, 'd1')).toHaveAccessibleName(/4 Block/);
  await die(page, 'd1').hover();
  await expect(page.getByRole('tooltip')).toContainText('if you have already exhausted a face this turn');
  await action(page, 'end').click();
  await expect(page.getByRole('img', { name: /Lampheart, 2 Frenzy/ })).toBeVisible();
  await die(page, 'd0').click({ button: 'right' });
  const layout = page.getByRole('dialog', { name: 'Die 1 layout' });
  await expect(layout.locator('[data-slot="top"]')).toHaveAttribute('aria-label', 'Top, Blank');
});

test('sequencing badges and target bonuses follow the plays made in combat', async ({ page }) => {
  const state = newRun('fixed', 231, 'moth');
  const combat = state.combat!;
  for (const enemy of combat.enemies) enemy.hp = enemy.maxHp = 24;
  const slots = ['right', 'right', 'right', 'bottom', 'left'] as const;
  slots.forEach((slot, index) => { combat.rolls[index].slot = slot; });
  state.dice[1].imprints.right = 'reed-splint';
  state.dice[2].imprints.right = 'rattle-comb';
  state.dice[3].imprints.bottom = 'kiln-latch';
  state.dice[4].imprints.left = 'scorch-husk';
  await saveFixture(page, state);
  await action(page, 'commit').click();

  const pair = die(page, 'd1').locator('.chip--pair');
  await expect(pair).not.toHaveClass(/is-ready/);
  await die(page, 'd0').click();
  await actor(page, 'gnat-a').click();
  await expect(pair).toHaveClass(/is-ready/);
  await expect(pair).toContainText('×2');
  await die(page, 'd1').click();
  await actor(page, 'gnat-a').click();
  const trio = die(page, 'd2').locator('.chip--trio');
  await expect(trio).toHaveClass(/is-ready/);
  await expect(trio).toContainText('×3');

  await die(page, 'd4').click();
  await expect(actor(page, 'gnat-b')).toHaveAttribute('data-full-health-bonus', '');
  await expect(actor(page, 'gnat-a')).not.toHaveAttribute('data-full-health-bonus');
  await actor(page, 'gnat-b').click();
  await expect(actor(page, 'gnat-b')).toContainText('16/24');
  await expect(die(page, 'd3')).toHaveAccessibleName(/4 Block, Echo/);
});

test('the shop sells relics and previews a face copy without ending the visit', async ({ page }) => {
  const state = newRun('fixed', 231, 'moth');
  state.phase = 'reward';
  state.room = ROOMS.findIndex(room => room.type === 'shop') - 1;
  state.gold = 75;
  expect(advance(state)).toBe(true);
  await saveFixture(page, state);
  const relics = page.locator('[data-shop-kind="relic"]');
  const items = page.locator('[data-shop-kind="item"]');
  const copy = page.locator('[data-shop-kind="faceCopy"]');
  await expect(page.getByRole('heading', { name: 'Shop', exact: true })).toBeVisible();
  await expect(relics).toHaveCount(3);
  await expect(items).toHaveCount(3);
  await expect(copy).toHaveCount(1);
  const boughtName = await relics.first().locator('strong').innerText();
  await relics.first().click();
  await expect(page.locator('.gold-amount')).toHaveText('39');
  await expect(relics).toHaveCount(2);
  await expect(relics.first()).toBeDisabled();
  await page.getByRole('button', { name: 'View owned relics' }).click();
  await expect(page.locator('.owned-relics')).toContainText(boughtName);
  await expect(page.locator('.owned-relics')).toContainText('Lampheart');
  await page.getByRole('button', { name: 'Close relics' }).click();
  await copy.click();
  await expect(page.getByRole('button', { name: 'Copy face for 23 gold' })).toBeDisabled();
  await action(page, 'reward-die').first().click();
  await expect(page.locator('.placement-detail .is-changed')).toHaveCount(1);
  await page.getByRole('button', { name: 'Copy face for 23 gold' }).click();
  await expect(page.locator('.gold-amount')).toHaveText('16');
  await expect(copy).toHaveCount(0);
  await expect(items.first()).toBeDisabled();
  await page.getByRole('button', { name: 'Leave shop' }).click();
  await expect(page.locator('#interface')).toHaveAttribute('data-phase', 'battle');
  await expect(page.getByRole('button', { name: 'View owned relics' })).toBeVisible();
  await expect(page.locator('.stage-cube .cube-tag')).toHaveCount(5);
});

test('mobile long press opens one face layout for the reward item or owned die', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce',
  });
  await using cleanup = { [Symbol.asyncDispose]: () => context.close() };
  const page = await context.newPage();
  const touch = await context.newCDPSession(page);
  const state = newRun('fixed', 231, 'moth');
  state.phase = 'reward';
  state.offers = [{ kind: 'item', id: 'wick-wrap' }, { kind: 'item', id: 'molt-plate' }, { kind: 'item', id: 'cinder-needle' }];
  await saveFixture(page, state);
  const item = page.getByRole('button', { name: 'Molt Plate' });
  const target = page.locator('[data-imprint-target="d4"]');
  const dialog = page.getByRole('dialog');
  async function longPress(locator: Locator) {
    const point = await center(locator);
    await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
    await expect(dialog).toBeVisible();
    await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect(dialog).toBeVisible();
  }

  const net = dialog.locator('.face-net');
  const tooltip = dialog.getByRole('tooltip');
  await longPress(item);
  await expect(dialog).toHaveAccessibleName('Molt Plate');
  await expect(net).toHaveCount(1);
  await expect(net.locator('.net-tile')).toHaveCount(6);
  await expect(net.locator('.net-tile.is-changed')).toHaveCount(2);
  await expect(dialog.getByRole('button')).toHaveCount(1);
  await net.locator('[data-slot="bottom"]').tap();
  await expect(tooltip).toContainText('Add 1 damage or Block for each blank on this die');
  await net.locator('[data-slot="center"]').tap();
  await expect(tooltip).toContainText('if the die you just played this turn applied Burn');
  await dialog.getByRole('button', { name: 'Close inspection' }).tap();
  await expect(item).toHaveAttribute('aria-pressed', 'false');

  const currentFaces = await target.locator('.net-tile').evaluateAll(tiles => tiles.map(tile => tile.getAttribute('aria-label')));
  await item.tap();
  await expect(item).toHaveAttribute('aria-pressed', 'true');
  await longPress(target);
  await expect(dialog).toHaveAccessibleName('Die 5 layout');
  await expect(net).toHaveCount(1);
  await expect(net.locator('.net-tile')).toHaveCount(6);
  await expect(dialog.getByRole('button')).toHaveCount(1);
  expect(await net.locator('.net-tile').evaluateAll(tiles => tiles.map(tile => tile.getAttribute('aria-label')))).toEqual(currentFaces);
  await net.locator('[data-slot="left"]').tap();
  await expect(tooltip).toBeVisible();
  await dialog.getByRole('button', { name: 'Close inspection' }).tap();
  await expect(item).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#interface')).toHaveAttribute('data-phase', 'reward');
  await target.tap();
  await expect(page.locator('#interface')).toHaveAttribute('data-phase', 'battle');
});

test('rare boss spoils are inspectable on the immediate victory screen', async ({ page }) => {
  const state = newRun('fixed', 231);
  state.phase = 'reward';
  state.room = ROOMS.length - 2;
  expect(advance(state)).toBe(true);
  state.combat!.enemies[0].hp = 1;
  state.combat!.rolls[0].slot = 'left';
  await saveFixture(page, state);
  await action(page, 'commit').click();
  await die(page, 'd0').click();
  await actor(page, 'bellroot').click();
  await expect(page.getByRole('heading', { name: 'Passage clear' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Boss spoils' })).toBeVisible();
  await expect(page.locator('.boss-relic')).toContainText('Rare relic');
  await page.locator('.boss-item').click();
  await expect(page.getByRole('dialog')).toBeVisible();
});

test('the campaign map supports keyboard exploration and discards an old Fixed Five save', async ({ page }) => {
  const obsolete = newRun('fixed', 231);
  await page.addInitScript(save => localStorage.setItem('reedmark:fixed:v1', JSON.stringify(save)), obsolete);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Choose your hero' })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('reedmark:fixed:v1'))).toBeNull();
  await page.getByRole('button', { name: 'Play Moth' }).click();
  await expect(page.getByRole('heading', { name: 'Explore Reedmark' })).toBeVisible();
  await expect(page.locator('.campaign-hex')).toHaveCount(127);
  await expect(page.locator('[data-action="explore-tile"]')).toHaveCount(6);
  const start = page.getByRole('img', { name: 'Start, already explored at 0, 0, your position' });
  await expect(start).toBeVisible();
  await expect(start.getByText('Start', { exact: true })).toBeVisible();
  await expect(start.getByText('Cleared', { exact: true })).toBeVisible();
  await start.click();
  const mountains = page.getByRole('img', { name: /^Mountain, impassable/ });
  await expect(mountains).toHaveCount(6);
  await mountains.first().click();
  await expect(page.locator('.campaign-hex[data-kind="event"] .map-question').first()).toHaveText('?');
  await expect(page.locator('.map-track')).toContainText('0/48');
  await expect(page.locator('.campaign-timer')).toHaveText('Boss in 16 turns');
  await expect(page.locator('.campaign-hex[data-kind="unknown"]').first()).toHaveAccessibleName(/Unrevealed/);
  const normal = page.locator('button[data-kind="normal"]').first();
  await normal.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#interface')).toHaveAttribute('data-phase', 'battle');
  await expect(page.locator('.map-track')).toContainText('1/48');
});

test('touching a chest detour preserves the revealed map and payout across reload', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  try {
    const page = await context.newPage();
    const state = newCampaignRun('fixed', 231, 'moth');
    const map = state.map!;
    function resolveFixtureRoom() {
      if (state.phase === 'battle') {
        state.combat!.intents = [];
        for (const enemy of state.combat!.enemies) enemy.seep = enemy.hp;
        expect(commitRoll(state) && endTurn(state)).toBe(true);
      }
      expect(advance(state)).toBe(true);
    }
    while (map.turn < 4) {
      expect(explore(state, [...frontier(map)][0])).toBe(true);
      resolveFixtureRoom();
    }
    await page.addInitScript(save => {
      if (!localStorage.getItem('reedmark:fixed:v1')) localStorage.setItem('reedmark:fixed:v1', JSON.stringify(save));
    }, state);
    await page.goto('/');
    await expect(page.locator('[data-kind="treasure"]')).toHaveCount(3);
    await expect(page.locator('button[data-kind="treasure"]')).toHaveCount(0);

    while (!map.tiles.some(tile => frontier(map).has(tile.id) && tile.chest !== undefined)) {
      const reachable = frontier(map);
      const costs = explorationDistance(map);
      const chest = map.tiles.filter(tile => tile.chest !== undefined).sort((a, b) => costs.get(a.id)! - costs.get(b.id)!)[0];
      const toChest = explorationDistance({ ...map, tiles: map.tiles.map(tile => ({ ...tile, visited: tile.id === chest.id })) });
      const step = map.tiles.find(tile => reachable.has(tile.id) && toChest.get(tile.id) === costs.get(chest.id)! - 1)!;
      expect(explore(state, step.id)).toBe(true);
      resolveFixtureRoom();
    }
    await page.evaluate(save => localStorage.setItem('reedmark:fixed:v1', JSON.stringify(save)), state);
    await page.reload();
    await expect(page.locator('[data-kind="treasure"]')).toHaveCount(3);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
    await page.getByRole('button', { name: 'Zoom out' }).tap();
    await page.getByRole('button', { name: 'Center on your position' }).tap();
    const chest = page.locator('button[data-kind="treasure"]').first();
    expect((await chest.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await chest.tap();
    await expect(page.getByRole('heading', { name: 'Treasure', exact: true })).toBeVisible();
    const gold = await page.locator('.gold-amount').innerText();
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Treasure', exact: true })).toBeVisible();
    await expect(page.locator('.gold-amount')).toHaveText(gold);
    await page.getByRole('button', { name: 'Return to map' }).tap();
    await expect(page.locator('[data-kind="treasure"]')).toHaveCount(2);
  } finally {
    await context.close();
  }
});

for (const [event, hero, hpCost, goldCost, confirmLabel] of [
  ['satchel', 'moth', 0, 0, 'Imprint'],
  ['bargain', 'thief', 6, 0, 'Imprint for 6 HP'],
  ['marker', 'barbarian', 0, 12, 'Imprint for 12 gold'],
] as const) {
  test(`mobile can preview and confirm the ${event} event imprint`, async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 320, height: 568 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce',
    });
    await using cleanup = { [Symbol.asyncDispose]: () => context.close() };
    const page = await context.newPage();
    const state = newCampaignRun('fixed', 19, hero);
    state.gold = 12;
    const map = state.map!;
    map.eventBag = [event];
    const tile = map.tiles.find(tile => tile.kind === 'event' && frontier(map).has(tile.id))!;
    expect(explore(state, tile.id)).toBe(true);
    const index = state.offers.findIndex(offer => offer.kind === 'item');
    const offer = state.offers[index];
    if (offer?.kind !== 'item') throw new Error('Expected an item reward');
    const item = ITEMS[offer.id];
    const readSave = () => page.evaluate(() => JSON.parse(localStorage.getItem('reedmark:fixed:v1')!) as State);
    await page.addInitScript(save => {
      if (!localStorage.getItem('reedmark:fixed:v1')) localStorage.setItem('reedmark:fixed:v1', JSON.stringify(save));
    }, state);
    await page.goto('/');
    const eventOffer = page.locator(`[data-action="offer"][data-index="${index}"]`);
    const dieCard = page.getByRole('button', { name: 'Die 2', exact: true });
    const imprint = page.getByRole('button', { name: confirmLabel, exact: true });
    await eventOffer.tap();
    await expect(imprint).toBeDisabled();
    await expect(dieCard.locator('.net-tile')).toHaveCount(6);
    await page.getByRole('button', { name: 'Inspect ' + item.name }).tap();
    const inspection = page.getByRole('dialog', { name: item.name });
    await expect(inspection.locator('.face-net')).toHaveCount(1);
    await inspection.getByRole('button', { name: 'Close inspection' }).tap();
    await dieCard.tap();
    await expect(dieCard).toHaveAttribute('aria-pressed', 'true');
    await expect(dieCard.locator('.is-changed').first()).toBeVisible();
    await expect(imprint).toBeEnabled();

    await page.getByRole('button', { name: 'Back to event' }).tap();
    const before = await readSave();
    expect(before.hp).toBe(state.hp);
    expect(before.gold).toBe(state.gold);
    expect(before.dice[1].imprints).toEqual({});
    await eventOffer.tap();
    await expect(imprint).toBeDisabled();
    await dieCard.tap();
    await imprint.tap();
    await expect(page.locator('#interface')).toHaveAttribute('data-phase', 'map');

    await page.reload();
    await expect(page.locator('#interface')).toHaveAttribute('data-phase', 'map');
    const after = await readSave();
    expect(after.hp).toBe(state.hp - hpCost);
    expect(after.gold).toBe(state.gold - goldCost);
    expect(after.dice[1].imprints).toEqual(Object.fromEntries(Object.keys(item.edits).map(slot => [slot, offer.id])));
    expect(after.dice[0].imprints).toEqual({});
  });
}

test('plays a complete Fixed Five campaign through the browser and all three bosses', async ({ page }) => {
  test.setTimeout(360_000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  const state = newCampaignRun('fixed', 1, 'thief');
  await page.goto('/?seed=1&character=thief');
  const bosses: string[] = [];
  for (let step = 0; step < 600 && !['victory', 'defeat'].includes(state.phase); step++) {
    const commands: Command[] = [];
    if (state.phase === 'map') {
      expect(takeMapTurn(state, 'treasure', commands)).toBe(true);
      if (commands[0]?.action === 'boss') bosses.push(currentRoom(state).name);
    } else if (state.phase === 'battle') act(state, commands);
    else takeReward(state, commands);
    for (const command of commands) await perform(page, command);
    await expect(page.locator('#interface')).toHaveAttribute('data-phase', state.phase);
  }
  expect(bosses).toEqual(['Bellroot', 'Floodgate Keeper', 'Stormwing Matriarch']);
  expect(state.phase).toBe('victory');
  await expect(page.getByRole('heading', { name: 'Passage clear' })).toBeVisible();
  await expect(page.locator('.boss-relic')).toBeVisible();
  expect(errors).toEqual([]);
});
