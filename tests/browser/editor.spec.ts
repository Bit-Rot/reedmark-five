import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { FakeGitHub } from '../helpers/fake-github.ts';
import { fixtureFiles } from '../helpers/fixture-data.ts';

/** Serve the editor a fake GitHub seeded with a fixed fixture dataset. */
async function openEditor(page: Page) {
  const fake = new FakeGitHub(fixtureFiles());
  await page.addInitScript(() => {
    localStorage.setItem('fivedice-editor-token', 'test-token');
    localStorage.setItem('fivedice-editor-repo', JSON.stringify({ owner: 'o', repo: 'r', branch: 'main' }));
  });
  await page.route('https://api.github.com/**', async route => {
    const req = route.request();
    const res = await fake.fetch(req.url(), { method: req.method(), body: req.postData() ?? undefined });
    await route.fulfill({ status: res.status, body: await res.text(), headers: { 'access-control-allow-origin': '*' } });
  });
  await page.goto('/editor/');
  await expect(page.locator('#bar .status')).toContainText('o/r@main');
  return fake;
}

test('lists data, shows the T diagram, flags dangling references, and renames with propagation', async ({ page }) => {
  await openEditor(page);
  await page.locator('#nav button', { hasText: 'Faces' }).click();
  await expect(page.locator('#items li')).toHaveCount(7);

  await page.locator('#nav button', { hasText: 'Dice' }).click();
  await page.locator('#items button', { hasText: 'die_hammer' }).click();
  await expect(page.locator('.tdiagram .slot[data-slot]')).toHaveCount(6);
  await expect(page.locator('.slot[data-slot="top"] select')).not.toHaveClass(/missing/);

  // Deleting a face that a die still uses leaves a flagged dangling reference.
  await page.locator('#nav button', { hasText: 'Faces' }).click();
  await page.locator('#items button', { hasText: /^slash_block$/ }).click();
  await page.getByRole('button', { name: 'Delete' }).click();
  await page.getByRole('button', { name: /click again to delete anyway/ }).click();
  await page.locator('#nav button', { hasText: 'Dice' }).click();
  await page.locator('#items button', { hasText: 'die_hammer' }).click();
  await expect(page.locator('.slot[data-slot="top"] select')).toHaveClass(/missing/);
  await expect(page.locator('.issues .error').first()).toContainText('slash_block');

  await page.locator('#nav button', { hasText: 'Faces' }).click();
  await page.locator('#items button', { hasText: /^slash$/ }).click();
  await expect(page.locator('.usedby li').first()).toBeVisible();
  await page.locator('#id-input').fill('cut');
  await page.getByRole('button', { name: 'Rename' }).click();
  await expect(page.locator('#toast')).toContainText('Renamed');

  await page.locator('#nav button', { hasText: 'Dice' }).click();
  await page.locator('#items button', { hasText: 'die_sword' }).click();
  await expect(page.locator('.slot[data-slot="left"] select')).toHaveValue('cut');
  await expect(page.locator('#bar button.primary')).toBeEnabled();
});

test('saves all edits as one commit and regenerates the docs', async ({ page }) => {
  const fake = await openEditor(page);
  const before = fake.head;
  await page.locator('#nav button', { hasText: 'Faces' }).click();
  await page.locator('#items button', { hasText: /^stab$/ }).click();
  await page.locator('textarea').last().fill('hand-edited note');
  await page.locator('#bar button.primary').click();
  await page.getByRole('button', { name: 'Commit to GitHub' }).click();
  await expect(page.locator('#toast')).toContainText('Saved');
  expect(fake.head).not.toBe(before);
  expect(fake.commits.get(fake.head)!.parents).toEqual([before]);
  expect(fake.file('data/faces.json')).toContain('hand-edited note');
  expect(fake.file('docs/Dice Faces.md')).toContain('hand-edited note');
  await expect(page.locator('#bar button.primary')).toBeDisabled();
});

test('creates a new face and builds a die and an item that reference it', async ({ page }) => {
  await openEditor(page);
  await page.locator('#nav button', { hasText: 'Faces' }).click();
  await page.locator('.list-new input').fill('smite');
  await page.getByRole('button', { name: '+ New' }).click();
  await expect(page.locator('#id-input')).toHaveValue('smite');
  await page.getByRole('button', { name: '+ add keyword' }).click();
  await expect(page.locator('.image-field .face-image.none')).toBeVisible();

  await page.locator('#nav button', { hasText: 'Items' }).click();
  await page.locator('.list-new input').fill('holy_symbol');
  await page.getByRole('button', { name: '+ New' }).click();
  await page.getByRole('button', { name: '+ add effect' }).click();
  await expect(page.locator('.effect')).toHaveCount(1);
  await expect(page.locator('#items li').filter({ hasText: 'holy_symbol' })).toBeVisible();
});

test('faces show their images, and the picker searches the icon library and saves the choice', async ({ page }) => {
  const fake = await openEditor(page);
  await page.locator('#nav button', { hasText: 'Faces' }).click();
  // Every face in the data already has a library image, shown as a thumbnail in the list.
  await expect(page.locator('#items img.thumb')).toHaveCount(await page.locator('#items li').count());
  await page.locator('#items button', { hasText: /^slash$/ }).click();
  await expect(page.locator('.image-field img.face-image')).toBeVisible();
  await expect(page.locator('.image-field img.face-image')).toHaveJSProperty('complete', true);
  expect(await page.locator('.image-field img.face-image').evaluate((i: HTMLImageElement) => i.naturalWidth)).toBeGreaterThan(0);
  await expect(page.locator('.image-field .hint')).toContainText('face-art/library/sword.webp');

  await page.getByRole('button', { name: 'Change image…' }).click();
  const picker = page.locator('dialog.picker');
  await expect(picker).toBeVisible();
  expect(await picker.locator('.image-choice').count()).toBeGreaterThanOrEqual(100);
  await picker.locator('input[type=search]').fill('poison');
  await expect(picker.locator('.image-choice').first()).toContainText(/poison|venom|drop|fang|stinger|cauldron/i);
  await picker.locator('input[type=search]').fill('flame');
  await picker.locator('.image-choice[title="Flame (flame)"]').click();
  await expect(page.locator('.image-field .hint')).toContainText('face-art/library/flame.webp');

  await page.locator('#bar button.primary').click();
  await page.getByRole('button', { name: 'Commit to GitHub' }).click();
  await expect(page.locator('#toast')).toContainText('Saved');
  expect(fake.file('data/faces.json')).toContain('face-art/library/flame.webp');
  expect(fake.file('docs/Dice Faces.md')).toContain('../public/face-art/library/flame.webp');
});

test('the die diagram shows an image on each face', async ({ page }) => {
  await openEditor(page);
  await page.locator('#nav button', { hasText: 'Dice' }).click();
  await page.locator('#items button').first().click();
  await expect(page.locator('.tdiagram .slot-face img.thumb').first()).toBeVisible();
});

test('narrow screens show one pane at a time', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await openEditor(page);
  await page.locator('#nav button', { hasText: 'Faces' }).click();
  await expect(page.locator('#list')).toBeVisible();
  await expect(page.locator('#detail')).toBeHidden();
  await page.locator('#items button').first().click();
  await expect(page.locator('#detail')).toBeVisible();
  await expect(page.locator('#list')).toBeHidden();
  await page.getByRole('button', { name: '← Back' }).click();
  await expect(page.locator('#list')).toBeVisible();
});
