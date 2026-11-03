import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { expect, test, type Page } from '@playwright/test';
import { openApp } from './helpers';

const appUrl = pathToFileURL(resolve(process.cwd(), 'fretboard-visualizer.html')).href;

function failOnErrors(page: Page) {
  page.on('pageerror', (error) => {
    throw new Error(`pageerror: ${error.message}`);
  });
  page.on('console', (message) => {
    if (message.type() === 'error') throw new Error(`console error: ${message.text()}`);
  });
}

const WORKSPACE_HOOKS = [
  'app-header',
  'tab-workspace',
  'tab-practice',
  'setups-menu',
  'settings-button',
  'material-panel',
  'material-type',
  'key-panel',
  'detect-key',
  'add-chord',
  'chord-palette',
  'suggest-panel',
  'voicing-panel',
  'compare-panel',
  'scale-positions',
  'steps-strip',
  'view-bar',
  'staff-card',
  'neck-card',
  'keyboard-card',
];

test('exposes the workspace, drawer, and practice hooks', async ({ page }) => {
  await openApp(page);
  for (const id of WORKSPACE_HOOKS) {
    await expect(page.getByTestId(id)).toBeVisible();
  }

  await page.getByTestId('settings-button').click();
  const drawer = page.getByTestId('settings-drawer');
  await expect(drawer).toBeVisible();
  for (const name of ['Start in', 'Instrument', 'Neck', 'Keyboard', 'Sound', 'MIDI', 'Voice leading (advanced)']) {
    await expect(drawer.getByRole('heading', { name, exact: true })).toBeVisible();
  }
  await page.keyboard.press('Escape');

  await page.getByTestId('tab-practice').click();
  await expect(page.getByTestId('practice-panel')).toBeVisible();
  await expect(page.getByTestId('quiz-prompt')).toBeVisible();
  await expect(page.getByTestId('material-panel')).toHaveCount(0);
});

test('staff, neck, and keyboard checkboxes hide and show their cards', async ({ page }) => {
  await openApp(page);
  await expect(page.getByTestId('staff-card')).toBeVisible();
  await expect(page.locator('svg.staff')).toBeVisible();

  const cards = [
    ['Staff', 'staff-card'],
    ['Neck', 'neck-card'],
    ['Keyboard', 'keyboard-card'],
  ] as const;
  for (const [label, id] of cards) {
    const box = page.getByRole('checkbox', { name: label, exact: true });
    await expect(box).toBeChecked();
    await box.uncheck();
    await expect(page.getByTestId(id)).toHaveCount(0);
    await box.check();
    await expect(page.getByTestId(id)).toBeVisible();
  }
});

test('the hash selects Practice and Workspace', async ({ page }) => {
  failOnErrors(page);
  await page.goto(`${appUrl}#practice`);
  await expect(page.getByTestId('practice-panel')).toBeVisible();
  await expect(page.getByTestId('tab-practice')).toHaveAttribute('aria-current', 'page');

  await page.getByTestId('tab-workspace').click();
  await expect(page).toHaveURL(/#workspace/);
  await expect(page.getByTestId('material-panel')).toBeVisible();
  await expect(page.getByTestId('tab-workspace')).toHaveAttribute('aria-current', 'page');
  await expect(page.getByTestId('staff-card')).toBeVisible();

  await page.getByTestId('tab-practice').click();
  await expect(page).toHaveURL(/#practice/);
  await expect(page.getByTestId('practice-panel')).toBeVisible();
});

test('the drawer opens, closes on Escape, and returns focus', async ({ page }) => {
  await openApp(page);
  const settings = page.getByTestId('settings-button');
  await settings.click();
  const drawer = page.getByTestId('settings-drawer');
  const close = page.getByRole('button', { name: 'Close', exact: true });
  await expect(drawer).toBeVisible();
  await expect(close).toBeFocused();

  await page.keyboard.press('Escape');
  await expect(drawer).toHaveCount(0);
  await expect(settings).toBeFocused();

  await settings.click();
  await expect(close).toBeFocused();
  await close.click();
  await expect(drawer).toHaveCount(0);
  await expect(settings).toBeFocused();

  await settings.click();
  await page.locator('.drawer-backdrop').click({ position: { x: 8, y: 8 } });
  await expect(drawer).toHaveCount(0);
  await expect(settings).toBeFocused();
});

test('a hand-written v1 setup loads its key and progression', async ({ page }) => {
  const store = {
    version: 1,
    last: {
      app: { rootPc: 2, familyKey: 'major', modeKey: 'Ionian', viewMode: 'chord' },
      progression: {
        chords: [
          { rootPc: 2, quality: 'maj' },
          { rootPc: 7, quality: 'maj' },
          { rootPc: 9, quality: 'maj' },
        ],
      },
    },
    named: [],
  };
  failOnErrors(page);
  await page.addInitScript((payload) => {
    localStorage.setItem('fretboard-visualizer:setups:v1', payload);
  }, JSON.stringify(store));
  await page.goto(appUrl);
  await expect(page.getByTestId('neck-card')).toBeVisible();

  await expect(page.getByRole('radio', { name: 'Progression', exact: true })).toHaveAttribute('aria-checked', 'true');
  const root = page.locator('.field').filter({ has: page.locator('label', { hasText: /^Root$/ }) }).locator('select');
  await expect(root).toHaveValue('2');

  const chips = page.getByTestId('step-chip');
  await expect(chips).toHaveCount(3);
  await expect(chips.nth(0)).toHaveAttribute('data-step-index', '0');
  await expect(chips.nth(0)).toContainText('D');
  await expect(chips.nth(0)).toContainText('I');
  await expect(chips.nth(1)).toContainText('G');
  await expect(chips.nth(1)).toContainText('IV');
  await expect(chips.nth(2)).toContainText('A');
  await expect(chips.nth(2)).toContainText('V');
  await expect(chips.nth(0)).toHaveAttribute('aria-current', 'step');

  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(chips.nth(1)).toHaveAttribute('aria-current', 'step');
  await page.getByRole('button', { name: 'Prev', exact: true }).click();
  await expect(chips.nth(0)).toHaveAttribute('aria-current', 'step');
});

test('saves the material type and restores it', async ({ page }) => {
  failOnErrors(page);
  await page.goto(appUrl);
  await page.getByRole('radio', { name: 'Chord', exact: true }).click();
  await expect.poll(async () => page.evaluate(() => localStorage.getItem('fretboard-visualizer:setups:v2') ?? '')).toContain(
    '"type":"chord"',
  );
  await page.reload();
  await expect(page.getByRole('radio', { name: 'Chord', exact: true })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByTestId('scale-positions')).toHaveCount(0);
});
