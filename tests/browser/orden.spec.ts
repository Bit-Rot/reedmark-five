import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { newLinearRun } from '../../src/game.ts';

const slot = (page: Page, index: number) => page.locator(`[data-socket="${index}"]`);
const die = (page: Page, id: string) => page.locator(`button[data-die="${id}"]`);
const actor = (page: Page, id: string) => page.locator(`[data-actor="${id}"]`);

async function center(locator: Locator) {
  const box = await locator.boundingBox();
  if (!box) throw new Error('Cannot find drag position');
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

async function mouseDrag(page: Page, source: Locator, target: Locator) {
  const start = await center(source);
  const end = await center(target);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 8 });
  await page.mouse.up();
}

async function loadBattle(page: Page, bypass = false) {
  const state = newLinearRun('fixed', 231, 'orden');
  const combat = state.combat!;
  const owner = combat.enemies[0].id;
  combat.intents = combat.intents.map(intent => ({ owner: intent.owner, move: 'wait', value: 0 }));
  combat.intents[1] = { owner, move: 'hit', value: 8 };
  combat.intents[2] = { owner, move: 'wait', value: 0, hazard: { kind: 'lock', value: 0, position: 1 } };
  combat.intents[3] = { owner, move: 'wait', value: 0, hazard: { kind: 'pain', value: 2, dieId: 'd4', faces: [] } };
  for (const roll of combat.rolls) roll.slot = 'left';
  if (bypass) {
    combat.rolls[2].slot = 'top';
    state.dice[2].imprints.top = 'watch-plate';
  }
  await page.addInitScript(save => {
    if (!localStorage.getItem('reedmark:fixed:v1')) localStorage.setItem('reedmark:fixed:v1', JSON.stringify(save));
  }, state);
  await page.goto('/?character=orden&route=linear');
  await expect(page.locator('[data-world-die]')).toHaveCount(5);
}

test('Reroll locks held dice and Commit opens manual tap and drag play', async ({ page }) => {
  await loadBattle(page);
  const attacker = actor(page, 'gnat-a');
  await expect(attacker).toHaveAccessibleDescription(/8 Damage.*slot 2/i);
  await expect(page.locator('[data-actor-frame=gnat-a]').locator('.intent--hit .chip--hit')).toHaveText('8');
  await expect(page.locator('[data-actor-frame=gnat-a]').locator('.intent--hit .actor-hazard-target')).toHaveCount(0);
  await expect(page.locator('[data-actor-frame=gnat-a]').locator('.intent--hazard .actor-hazard-target')).toHaveText(['S2', 'D5']);
  await expect(slot(page, 1).locator('.hazard-chip')).toBeVisible();
  await expect(page.getByText('Enemy actions', { exact: true })).toHaveCount(0);

  await mouseDrag(page, die(page, 'd0'), slot(page, 4));
  await expect(slot(page, 4).locator(die(page, 'd0'))).toBeVisible();
  await mouseDrag(page, die(page, 'd2'), slot(page, 0));
  await mouseDrag(page, die(page, 'd0'), slot(page, 0));
  await expect(slot(page, 0).locator(die(page, 'd0'))).toBeVisible();
  await expect(slot(page, 4).locator(die(page, 'd2'))).toBeVisible();
  await mouseDrag(page, die(page, 'd2'), page.locator('#stage'));
  await expect(die(page, 'd2')).toHaveAttribute('data-world-die', 'd2');

  await die(page, 'd2').focus();
  await page.keyboard.press('2');
  await expect(slot(page, 1).locator(die(page, 'd2'))).toBeVisible();
  await die(page, 'd1').focus();
  await page.keyboard.press('4');
  await expect(slot(page, 3).locator(die(page, 'd1'))).toBeVisible();

  for (let count = 2; count > 0; count--) await page.getByRole('button', { name: `Reroll, ${count} left` }).click();
  await expect(page.getByRole('button', { name: 'Reroll, 0 left' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Commit dice' })).toBeEnabled();
  await page.reload();
  const lockedDie = slot(page, 1).locator(die(page, 'd2'));
  await expect(lockedDie).toHaveAttribute('aria-disabled', 'true');
  await expect(lockedDie).toContainText('Locked');
  await mouseDrag(page, lockedDie, slot(page, 4));
  await expect(lockedDie).toBeVisible();
  const loose = die(page, 'd4');
  await mouseDrag(page, loose, slot(page, 1));
  await expect(loose).toHaveAttribute('data-world-die', 'd4');
  await loose.focus();
  await page.keyboard.press('5');
  await expect(slot(page, 4).locator(loose)).toBeVisible();
  await loose.click();
  await expect(loose).toHaveAttribute('data-world-die', 'd4');
  await page.getByRole('button', { name: 'Commit dice' }).click();
  await expect(page.locator('[data-world-die]')).toHaveCount(0);
  await expect(slot(page, 1).locator(die(page, 'd2'))).toHaveAttribute('aria-disabled', 'true');

  await mouseDrag(page, die(page, 'd0'), slot(page, 4));
  await expect(slot(page, 0).locator(die(page, 'd0'))).toBeVisible();
  await die(page, 'd0').click();
  await expect(actor(page, 'gnat-b')).toHaveClass(/is-legal/);
  await actor(page, 'gnat-b').click();
  await expect(actor(page, 'gnat-b')).toHaveAccessibleName(/3 of 7 HP/);
  await expect(slot(page, 0).locator('.is-spent')).toBeVisible();

  await mouseDrag(page, die(page, 'd1'), actor(page, 'gnat-a'));
  await expect(actor(page, 'gnat-a')).toHaveAccessibleName(/3 of 7 HP/);
  await page.getByRole('button', { name: 'End turn' }).click();
  await expect(page.locator('[data-threat]')).toContainText('Turn 2');
  await expect(page.locator('[data-world-die]')).toHaveCount(5);
});

test('tap can hold, release, and play a die on a narrow phone', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 320, height: 568 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce',
  });
  try {
    const page = await context.newPage();
    await loadBattle(page);
    const attack = page.locator('[data-actor-frame=gnat-a]').locator('.intent--hit');
    await expect(attack).toBeVisible();
    const badge = (await attack.boundingBox())!;
    const enemy = (await actor(page, 'gnat-a').locator('.actor-caption').boundingBox())!;
    expect(badge.y + badge.height).toBeLessThan(enemy.y);
    expect(badge.x + badge.width).toBeLessThanOrEqual(320);

    await slot(page, 1).getByRole('button', { name: /slot 2/i }).tap();
    await expect(page.locator('.formation-hint')).toContainText(/slot 2/i);
    await page.getByRole('group', { name: 'Dice targeted by enemy abilities' })
      .getByRole('button', { name: /Die 5.*Pain/i }).tap();
    await expect(page.locator('.formation-hint')).toContainText(/Die 5.*Pain/i);

    const source = die(page, 'd2');
    await source.tap();
    await expect(slot(page, 0).locator(source)).toBeVisible();
    await source.tap();
    await expect(source).toHaveAttribute('data-world-die', 'd2');
    const start = await center(source);
    const end = await center(slot(page, 2));
    const session = await context.newCDPSession(page);
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [start] });
    for (let step = 1; step <= 6; step++) {
      const x = start.x + (end.x - start.x) * step / 6;
      const y = start.y + (end.y - start.y) * step / 6;
      await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y }] });
    }
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect(slot(page, 2).locator(source)).toHaveAccessibleName(/4 Block/);
    await session.detach();
    await page.getByRole('button', { name: 'Commit dice' }).tap();
    await expect(page.getByRole('button', { name: 'End turn' })).toBeVisible();
    await source.tap();
    await expect(slot(page, 2).locator('.is-spent')).toBeVisible();
    await expect(page.locator('[data-threat]')).toHaveAccessibleName(/4 Block/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
  } finally {
    await context.close();
  }
});

test('Bypass makes a sealed slot playable after Commit', async ({ page }) => {
  await loadBattle(page, true);
  const shield = die(page, 'd2');
  await shield.focus();
  await page.keyboard.press('2');
  await page.getByRole('button', { name: 'Commit dice' }).click();
  await expect(slot(page, 1).locator(shield)).toHaveAccessibleName('2 Block, Bypass');
  await expect(shield).toBeEnabled();
  await shield.click();
  await expect(slot(page, 1).locator('.is-spent')).toBeVisible();
  await expect(page.locator('[data-threat]')).toHaveAccessibleName(/2 Block/);
});

test('the hero picker enables formation only for Orden and preserves the other heroes’ fixed sockets', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Play Orden' })).toBeVisible();
  await expect(page.locator('.character-choice')).toHaveCount(4);
  for (const hero of ['moth', 'thief', 'barbarian']) {
    await page.goto(`/?seed=231&route=linear&character=${hero}`);
    await expect(page.locator('.combat-tray')).toBeVisible();
    await expect(page.locator('.formation-rack')).toHaveCount(0);
    await die(page, 'd2').focus();
    await page.keyboard.press('5');
    await expect(die(page, 'd2')).toHaveAttribute('data-world-die', 'd2');
    await die(page, 'd2').click();
    await expect(slot(page, 2).locator(die(page, 'd2'))).toBeVisible();
    await page.getByRole('button', { name: 'Reroll, 2 left' }).click();
    await page.getByRole('button', { name: 'Reroll, 1 left' }).click();
    await expect(page.getByRole('button', { name: 'End turn' })).toBeVisible();
  }
  await page.goto('/?seed=231&route=linear&character=orden');
  await expect(page.locator('.formation-rack')).toBeVisible();
  await page.getByRole('button', { name: 'Reroll, 2 left' }).click();
  await page.getByRole('button', { name: 'Reroll, 1 left' }).click();
  await expect(page.getByRole('button', { name: 'Commit dice' })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'End turn' })).toHaveCount(0);
  await page.goto('/?mode=pool');
  await expect(page.locator('.character-choice')).toHaveCount(3);
  await expect(page.getByRole('button', { name: 'Play Orden' })).toHaveCount(0);
});
