import { expect, test } from '@playwright/test';

test('an intent opens that enemy die on a narrow touch screen', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 320, height: 568 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce',
  });
  try {
    const page = await context.newPage();
    await page.goto('/?seed=231&character=moth');
    await page.locator('button[data-kind=normal]').first().tap();
    const intent = page.getByRole('button', { name: 'Inspect Mire Gnat die' });
    const intentDescription = await intent.getAttribute('aria-description');
    await intent.tap();

    const dialog = page.getByRole('dialog');
    const chart = dialog.getByRole('group', { name: 'Die faces at base value' });
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('.enemy-current-intent')).toContainText(intentDescription!);
    await expect(chart.getByRole('button')).toHaveCount(6);
    const rolled = chart.getByRole('button', { name: /rolled this turn/i });
    await expect(rolled).toHaveAttribute('aria-pressed', 'true');
    await expect(chart.getByRole('button', { name: /^Top face\./ })).toBeVisible();

    const trap = chart.getByRole('button', { name: /^Top face.*trap.*playing a die there/i });
    await trap.tap();
    await expect(trap).toHaveAttribute('aria-pressed', 'true');
    await expect(dialog.locator('.enemy-face-detail')).toContainText(/playing a die there deals \d damage/i);
    await expect(rolled).toHaveClass(/is-rolled/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);

    await dialog.getByRole('button', { name: 'Close enemy die' }).tap();
    await expect(dialog).toHaveCount(0);
    await expect(intent).toBeFocused();
  } finally {
    await context.close();
  }
});

test('legacy fights expose each die separately through the keyboard', async ({ page }) => {
  await page.goto('/?seed=231&character=moth&route=linear');
  const intents = page.locator('[data-actor-frame=gnat-a]').getByRole('button', { name: /^Inspect Mire Gnat(?: 1)? die$/ });
  await expect(intents).toHaveCount(2);
  await intents.first().focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: /^Mire Gnat(?: 1)? die$/ });
  const leftFace = dialog.getByRole('button', { name: /^Left face\./ });
  await expect(leftFace).toHaveAccessibleName(/deal 2 damage/i);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(intents.first()).toBeFocused();

  await intents.last().focus();
  await page.keyboard.press('Space');
  await expect(leftFace).toHaveAccessibleName(/do nothing/i);
  await expect(dialog.getByRole('button', { name: 'Close enemy die' })).toBeFocused();
});
