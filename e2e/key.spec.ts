import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { expect, test, type Page } from '@playwright/test';
import { neckLabels } from './helpers';

const appUrl = pathToFileURL(resolve(process.cwd(), 'fretboard-visualizer.html')).href;
const DOT = '\u00b7';

function failOnErrors(page: Page) {
  page.on('pageerror', (error) => {
    throw new Error(`pageerror: ${error.message}`);
  });
  page.on('console', (message) => {
    if (message.type() === 'error') throw new Error(`console error: ${message.text()}`);
  });
}

async function open(page: Page) {
  failOnErrors(page);
  await page.goto(appUrl);
  await page.locator('svg.fretboard').waitFor();
}

function root(page: Page) {
  return page.locator('#key-root');
}

function scale(page: Page) {
  return page.locator('#key-scale');
}

function readout(page: Page) {
  return page.locator('.key-readout');
}

/** startIn:myDefaultRoot:myDefaultMode:keyRoot:keyMode */
async function saved(page: Page): Promise<string> {
  return page.evaluate(() => {
    const raw = localStorage.getItem('fretboard-visualizer:setups:v2');
    if (!raw) return '';
    const data = JSON.parse(raw) as {
      last?: {
        material?: { key?: { rootPc?: number; modeKey?: string } };
        settings?: { startIn?: string; myDefault?: { rootPc?: number; modeKey?: string } | null };
      };
    };
    const last = data.last;
    const mine = last?.settings?.myDefault;
    return [
      last?.settings?.startIn ?? '',
      mine ? String(mine.rootPc) : '-',
      mine?.modeKey ?? '-',
      last?.material?.key?.rootPc ?? '-',
      last?.material?.key?.modeKey ?? '-',
    ].join(':');
  });
}

test('changing root and scale updates the readout and the neck', async ({ page }) => {
  await open(page);
  await expect(readout(page)).toHaveText(`Bb major ${DOT} Bb C D Eb F G A`);
  expect(await neckLabels(page)).toContainEqual({ string: 0, fret: 0, label: 'Bb' });

  await root(page).selectOption('4');
  await expect(readout(page)).toHaveText(`E major ${DOT} E F# G# A B C# D#`);
  let labels = await neckLabels(page);
  expect(labels.find((item) => item.string === 0 && item.fret === 0)).toBeUndefined();
  expect(labels.some((item) => item.label === 'F#')).toBe(true);
  expect(labels.some((item) => item.label === 'G#')).toBe(true);

  await scale(page).selectOption({ label: `Major ${DOT} Dorian` });
  await expect(readout(page)).toHaveText(`E Dorian ${DOT} E F# G A B C# D`);
  labels = await neckLabels(page);
  expect(labels.some((item) => item.label === 'G')).toBe(true);
  expect(labels.some((item) => item.label === 'G#')).toBe(false);

  await page.getByTestId('view-bar').getByRole('radio', { name: 'Standard', exact: true }).click();
  await expect(root(page)).toHaveValue('4');
  await expect(readout(page)).toHaveText(`F Dorian ${DOT} F G Ab Bb C D Eb`);
  labels = await neckLabels(page);
  expect(labels.some((item) => item.label === 'Ab')).toBe(true);
  expect(labels.some((item) => item.label === 'F#')).toBe(false);
});

test('Detect key lists Bb major first and Use applies it', async ({ page }) => {
  const store = {
    version: 2,
    last: {
      material: {
        key: { rootPc: 0, familyKey: 'major', modeKey: 'Ionian' },
        steps: [
          { id: 'cm7', chord: { rootPc: 0, quality: 'm7' } },
          { id: 'f7', chord: { rootPc: 5, quality: '7' } },
          { id: 'bb', chord: { rootPc: 10, quality: 'maj7' } },
        ],
      },
    },
    named: [],
  };
  failOnErrors(page);
  await page.addInitScript((payload) => {
    localStorage.setItem('fretboard-visualizer:setups:v2', payload);
  }, JSON.stringify(store));
  await page.goto(appUrl);
  await page.locator('svg.fretboard').waitFor();
  await expect(readout(page)).toContainText('C major');

  await page.getByRole('button', { name: 'Detect key from steps', exact: true }).click();
  const items = page.getByTestId('detect-key').getByRole('listitem');
  await expect(items).toHaveCount(3);
  await expect(items.first()).toContainText('Bb major');
  await expect(items.filter({ hasText: 'G minor' })).toHaveCount(1);

  await items.first().getByRole('button', { name: 'Use', exact: true }).click();
  await expect(readout(page)).toHaveText(`Bb major ${DOT} Bb C D Eb F G A`);
  await expect(root(page)).toHaveValue('10');
  expect(await neckLabels(page)).toContainEqual({ string: 0, fret: 0, label: 'Bb' });
});

test('My default reopens on the saved key after the key was changed', async ({ page }) => {
  await open(page);
  await root(page).selectOption('4');
  await scale(page).selectOption({ label: `Major ${DOT} Aeolian` });
  await expect(readout(page)).toHaveText(`E minor ${DOT} E F# G A B C D`);

  await page.getByTestId('settings-button').click();
  await page.getByRole('radio', { name: 'My default', exact: true }).check();
  await page.getByRole('button', { name: 'Set from current', exact: true }).click();
  await expect(page.locator('.default-summary')).toHaveText('E minor (Aeolian), Concert names, 7-string half step down');
  await expect.poll(() => saved(page)).toBe('default:4:Aeolian:4:Aeolian');

  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await root(page).selectOption('0');
  await scale(page).selectOption({ label: `Major ${DOT} Ionian` });
  await expect(readout(page)).toContainText('C major');
  await expect.poll(() => saved(page)).toBe('default:4:Aeolian:0:Ionian');

  await page.reload();
  await page.locator('svg.fretboard').waitFor();
  await expect(root(page)).toHaveValue('4');
  await expect(scale(page)).toHaveValue('major:Aeolian');
  await expect(readout(page)).toHaveText(`E minor ${DOT} E F# G A B C D`);
});

test('Last session reopens where you left off', async ({ page }) => {
  await open(page);
  await root(page).selectOption('2');
  await expect(readout(page)).toContainText('D major');
  await expect.poll(() => saved(page)).toBe('last:-:-:2:Ionian');

  await page.reload();
  await page.locator('svg.fretboard').waitFor();
  await expect(root(page)).toHaveValue('2');
  await expect(readout(page)).toContainText('D major');
});
