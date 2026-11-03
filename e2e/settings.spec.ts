import { expect, test, type Page } from '@playwright/test';
import { neckCell, neckLabels, openApp } from './helpers';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const appUrl = pathToFileURL(resolve(process.cwd(), 'fretboard-visualizer.html')).href;

function failOnErrors(page: Page) {
  page.on('pageerror', (error) => {
    throw new Error(`pageerror: ${error.message}`);
  });
  page.on('console', (message) => {
    if (message.type() === 'error') throw new Error(`console error: ${message.text()}`);
  });
}

async function openSettings(page: Page) {
  await page.getByTestId('settings-button').click();
  await expect(page.getByTestId('settings-drawer')).toBeVisible();
  return page.getByTestId('settings-drawer');
}

test('8-string redraws the neck and keeps the key', async ({ page }) => {
  await openApp(page);
  const root = page.locator('#key-root');
  await expect(root).toHaveValue('10');
  const drawer = await openSettings(page);
  await drawer.getByRole('button', { name: '8-string', exact: true }).click();
  await expect(page.locator('svg.fretboard line.string')).toHaveCount(8);
  await expect(root).toHaveValue('10');
});

test('Left hand mirrors the neck', async ({ page }) => {
  await openApp(page);
  const nutX = () => page.locator('svg.fretboard line.nut').getAttribute('x1').then((value) => Number(value));
  const before = await nutX();
  const drawer = await openSettings(page);
  await drawer.getByRole('button', { name: 'Left', exact: true }).click();
  const after = await nutX();
  expect(after).toBeGreaterThan(before);
});

test('Low 4 hides 3 strings', async ({ page }) => {
  await openApp(page);
  await expect(page.locator('svg.fretboard line.string')).toHaveCount(7);
  const drawer = await openSettings(page);
  await drawer.getByRole('button', { name: 'Low 4', exact: true }).click();
  await expect(page.locator('svg.fretboard line.string')).toHaveCount(4);
});

test('keyboard span changes the key count', async ({ page }) => {
  await openApp(page);
  const keys = page.locator('svg.keyboard rect.pkey-white, svg.keyboard rect.pkey-black');
  await expect(keys).toHaveCount(37);
  const drawer = await openSettings(page);
  await drawer.getByRole('button', { name: '1 octave', exact: true }).click();
  await expect(keys).toHaveCount(13);
  await drawer.getByRole('button', { name: '2 octaves', exact: true }).click();
  await expect(keys).toHaveCount(25);
  await drawer.getByRole('button', { name: '37 keys', exact: true }).click();
  await expect(keys).toHaveCount(37);
});

test('volume and mute persist after reload', async ({ page }) => {
  failOnErrors(page);
  await page.goto(appUrl);
  await page.locator('svg.fretboard').waitFor();
  const drawer = await openSettings(page);
  await drawer.getByRole('slider', { name: 'Volume' }).fill('15');
  await drawer.getByRole('button', { name: 'Mute', exact: true }).click();
  await expect(drawer.getByRole('button', { name: 'Muted', exact: true })).toBeVisible();
  await page.waitForTimeout(600);
  await page.reload();
  await page.locator('svg.fretboard').waitFor();
  const again = await openSettings(page);
  await expect(again.getByRole('slider', { name: 'Volume' })).toHaveValue('15');
  await expect(again.getByRole('button', { name: 'Muted', exact: true })).toBeVisible();
});

test('voice-leading Reset restores the defaults', async ({ page }) => {
  await openApp(page);
  const drawer = await openSettings(page);
  await drawer.getByRole('heading', { name: 'Voice leading (advanced)', exact: true }).click();
  const hand = drawer.getByRole('slider', { name: 'Hand shift', exact: true });
  await expect(hand).toHaveValue('0.8');
  await hand.fill('3');
  await expect(hand).toHaveValue('3');
  await drawer.getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(hand).toHaveValue('0.8');
});

test('scale positions and the fret range show only for Scale, and dim notes outside the range', async ({ page }) => {
  await openApp(page);
  const positions = page.getByTestId('scale-positions');
  await expect(positions).toBeVisible();
  await positions.locator('summary').click();
  await expect(positions.getByRole('button', { name: 'All', exact: true })).toBeVisible();
  await expect(positions.getByRole('button', { name: '3 per string', exact: true })).toBeVisible();
  await expect(positions.getByRole('button', { name: 'CAGED', exact: true })).toBeVisible();
  await expect(page.locator('svg.fretboard .outside-window')).toHaveCount(0);

  await positions.getByRole('checkbox', { name: 'Fret range', exact: true }).check();
  await expect(page.locator('svg.fretboard .outside-window').first()).toBeVisible();

  await page.getByRole('radio', { name: 'Chord', exact: true }).click();
  await expect(page.getByTestId('scale-positions')).toHaveCount(0);

  await page.getByRole('radio', { name: 'Scale', exact: true }).click();
  await expect(page.getByTestId('scale-positions')).toBeVisible();
  await expect(page.locator('svg.fretboard .outside-window').first()).toBeVisible();
});

test('compare legend shows only while the overlay is on', async ({ page }) => {
  await openApp(page);
  await expect(page.locator('.card-legend')).toHaveCount(0);
  await page.getByTestId('compare-panel').locator('summary').click();
  await page.getByRole('checkbox', { name: 'Overlay a second scale', exact: true }).check();
  await expect(page.getByTestId('staff-card').locator('.card-legend')).toBeVisible();
  await expect(page.getByTestId('neck-card').locator('.card-legend')).toBeVisible();
  await expect(page.getByTestId('keyboard-card').locator('.card-legend')).toBeVisible();
  await page.getByRole('checkbox', { name: 'Overlay a second scale', exact: true }).uncheck();
  await expect(page.locator('.card-legend')).toHaveCount(0);
});

test('Intervals from relabels G as 2 and Escape restores the name', async ({ page }) => {
  await openApp(page);
  const before = await neckLabels(page);
  const f = before.find((item) => item.label === 'F');
  const g = before.find((item) => item.label === 'G');
  expect(f).toBeTruthy();
  expect(g).toBeTruthy();
  await page.getByRole('button', { name: 'Intervals from…', exact: true }).click();
  await neckCell(page, f!.string, f!.fret);
  await expect(page.getByText('Intervals from F', { exact: false })).toBeVisible();
  const during = await neckLabels(page);
  const relabeled = during.find((item) => item.string === g!.string && item.fret === g!.fret);
  expect(relabeled?.label).toBe('2');
  await page.locator('h1').click();
  await page.keyboard.press('Escape');
  const after = await neckLabels(page);
  const restored = after.find((item) => item.string === g!.string && item.fret === g!.fret);
  expect(restored?.label).toBe('G');
});

test('a named setup loads back after other changes', async ({ page }) => {
  await openApp(page);
  await page.getByTestId('setups-menu').click();
  await page.getByLabel('Setup name').fill('Studio');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Load', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.locator('#key-root').selectOption('2');
  await expect(page.locator('#key-root')).toHaveValue('2');
  await page.getByTestId('setups-menu').click();
  await page.getByRole('button', { name: 'Load', exact: true }).click();
  await expect(page.locator('#key-root')).toHaveValue('10');
});

test('Copy link restores key, instrument, and steps on a fresh page', async ({ page }) => {
  await openApp(page);
  await page.locator('#key-root').selectOption('2');
  const drawer = await openSettings(page);
  await drawer.getByRole('button', { name: '8-string', exact: true }).click();
  await page.keyboard.press('Escape');
  await page.getByLabel('Chord symbol').fill('Gm7');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.getByTestId('step-chip')).toContainText('Gm7');

  await page.getByTestId('setups-menu').click();
  await page.getByRole('button', { name: 'Copy link', exact: true }).click();
  const shared = page.url();
  expect(shared).toContain('k=2');

  const fresh = await page.context().newPage();
  failOnErrors(fresh);
  await fresh.goto(shared);
  await fresh.locator('svg.fretboard').waitFor();
  await expect(fresh.locator('#key-root')).toHaveValue('2');
  await expect(fresh.locator('svg.fretboard line.string')).toHaveCount(8);
  await expect(fresh.getByTestId('step-chip')).toContainText('Gm7');
});

test('the page has no Legacy controls', async ({ page }) => {
  await openApp(page);
  await expect(page.getByText('Legacy', { exact: false })).toHaveCount(0);
  await openSettings(page);
  await expect(page.getByText('Legacy', { exact: false })).toHaveCount(0);
});
