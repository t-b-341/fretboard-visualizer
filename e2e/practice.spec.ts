import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { expect, test, type Page } from '@playwright/test';
import { fakeMidi, openApp } from './helpers';

const appUrl = pathToFileURL(resolve(process.cwd(), 'fretboard-visualizer.html')).href;

const QUESTION_TYPES = [
  'Name the note',
  'Find every note',
  'Intervals from a root',
  'Ear intervals',
  'Chord tones',
  'Read from the staff',
] as const;

function failOnErrors(page: Page) {
  page.on('pageerror', (error) => {
    throw new Error(`pageerror: ${error.message}`);
  });
  page.on('console', (message) => {
    if (message.type() === 'error') throw new Error(`console error: ${message.text()}`);
  });
}

async function onlyTypes(page: Page, enabled: readonly string[]) {
  for (const name of QUESTION_TYPES) {
    const box = page.getByRole('checkbox', { name, exact: true });
    if (enabled.includes(name)) await box.check();
    else await box.uncheck();
  }
}

test('Enter does not close Practice or log an empty answer', async ({ page }) => {
  failOnErrors(page);
  await page.context().addInitScript(() => {
    try {
      localStorage.clear();
    } catch {
      // The first blank document has no storage.
    }
  });
  for (let i = 0; i < 10; i++) {
    await page.goto(appUrl);
    await page.locator('svg.fretboard').waitFor();
    await page.getByTestId('tab-practice').click();
    await expect(page.getByTestId('quiz-prompt')).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('practice-panel')).toBeVisible();
    await expect(page.getByTestId('tab-practice')).toHaveAttribute('aria-current', 'page');
    await expect(page.locator('[data-quiz-count]')).toHaveAttribute('data-quiz-count', '0');
    await expect(page.getByTestId('material-panel')).toHaveCount(0);
  }
  const raw = await page.evaluate(() => localStorage.getItem('fretboard-visualizer:quiz:v1'));
  expect(raw ?? '').not.toContain('"entries":[{');
});

test('a pad answer and Enter move to the next question', async ({ page }) => {
  await openApp(page);
  await page.getByTestId('tab-practice').click();
  await onlyTypes(page, ['Name the note']);
  const prompt = page.getByTestId('quiz-prompt');
  await expect(prompt).toHaveAttribute('data-question-type', 'nameNote');
  const id = await prompt.getAttribute('data-question-id');
  await page.locator('.quiz-pad button').first().click();
  await expect(prompt).toContainText(/Correct|Answer:/);
  await page.keyboard.press('Enter');
  await expect(prompt).not.toHaveAttribute('data-question-id', id ?? '');
  await expect(prompt).toHaveAttribute('data-question-type', 'nameNote');
  await expect(page.getByTestId('practice-panel')).toBeVisible();
});

test('a name question hides keyboard and neck note labels', async ({ page }) => {
  await openApp(page);
  await page.getByTestId('tab-practice').click();
  await onlyTypes(page, ['Name the note']);
  const prompt = page.getByTestId('quiz-prompt');
  await expect(prompt).toHaveAttribute('data-question-type', 'nameNote');
  await expect(prompt).toHaveText('Name this note.');
  const neck = page.getByTestId('neck-card');
  await expect(page.getByTestId('keyboard-card')).toHaveCount(0);
  await expect(page.locator('svg.keyboard')).toHaveCount(0);
  await expect(neck.locator('text.note-label')).toHaveCount(0);
  await expect(neck.locator('text.tuning-label')).toHaveCount(0);
  const marks = await neck.locator('text.practice-label').allTextContents();
  for (const mark of marks) expect(mark.trim()).not.toMatch(/^[A-G]/);
});

test('reverse prompts use pad names and interval questions hide the letter hint', async ({ page }) => {
  await openApp(page);
  await page.getByTestId('tab-practice').click();
  await onlyTypes(page, ['Intervals from a root']);
  const prompt = page.getByTestId('quiz-prompt');
  await expect(prompt).toHaveAttribute('data-question-type', /interval/);
  await expect(page.getByText('Letters, then b or #')).toHaveCount(0);
  const reverses: string[] = [];
  for (let i = 0; i < 16 && reverses.length < 3; i++) {
    const type = await prompt.getAttribute('data-question-type');
    const text = ((await prompt.textContent()) ?? '').trim();
    await expect(page.getByText('Letters, then b or #')).toHaveCount(0);
    if (type === 'intervalReverse') {
      reverses.push(text);
      expect(text).not.toMatch(/the \d/);
      await page.locator('svg.fretboard g.note-hit').first().click();
    } else {
      await page.locator('.quiz-pad button').first().click();
    }
    await expect(prompt).toContainText(/Correct|Answer:/);
    await page.keyboard.press('Enter');
    await expect(prompt).not.toContainText(/Correct|Answer:/);
  }
  expect(reverses.length).toBeGreaterThan(0);
});

test('a chord tone is answered by clicking the right cell', async ({ page }) => {
  await openApp(page);
  await page.getByTestId('tab-practice').click();
  await onlyTypes(page, ['Chord tones']);
  const prompt = page.getByTestId('quiz-prompt');
  await expect(prompt).toHaveAttribute('data-question-type', 'chordTone');
  await expect(prompt).toHaveText(/Find the .+ of /);
  const pc = Number(await prompt.getAttribute('data-target-pc'));
  const handle = await page.locator('svg.fretboard').evaluateHandle((svg, target: number) => {
    const group = [...svg.querySelectorAll('g[data-midi]')].find(
      (node) => Number(node.getAttribute('data-midi')) % 12 === target,
    );
    if (!group) throw new Error(`No neck cell for pitch class ${target}`);
    return group;
  }, pc);
  const element = handle.asElement();
  if (!element) throw new Error(`No neck cell for pitch class ${pc}`);
  await element.click();
  await handle.dispose();
  await expect(prompt).toContainText('Correct');
});

test('reload on #practice stays on Practice with the same settings', async ({ page }) => {
  failOnErrors(page);
  await page.goto(`${appUrl}#practice`);
  await page.locator('svg.fretboard').waitFor();
  await expect(page.getByTestId('practice-panel')).toBeVisible();
  await page.getByRole('checkbox', { name: 'Find every note', exact: true }).uncheck();
  await page.getByRole('checkbox', { name: 'Chord tones', exact: true }).check();
  await page.locator('#quiz-fret-min').fill('3');
  await page.getByRole('button', { name: 'Spell in the current key' }).click();
  await expect
    .poll(async () => page.evaluate(() => localStorage.getItem('fretboard-visualizer:setups:v2') ?? ''))
    .toContain('"findNote":false');
  await expect
    .poll(async () => page.evaluate(() => localStorage.getItem('fretboard-visualizer:setups:v2') ?? ''))
    .toContain('"chordTones":true');
  await page.reload();
  await expect(page).toHaveURL(/#practice/);
  await expect(page.getByTestId('practice-panel')).toBeVisible();
  await expect(page.getByTestId('material-panel')).toHaveCount(0);
  await expect(page.getByRole('checkbox', { name: 'Find every note', exact: true })).not.toBeChecked();
  await expect(page.getByRole('checkbox', { name: 'Chord tones', exact: true })).toBeChecked();
  await expect(page.locator('#quiz-fret-min')).toHaveValue('3');
  await expect(page.getByRole('button', { name: 'Spell in the current key' })).toHaveAttribute('aria-pressed', 'true');
});

test('a fake MIDI note answers a name question', async ({ page, context }) => {
  await fakeMidi(context);
  await openApp(page);
  await page.getByTestId('settings-button').click();
  await page.getByRole('button', { name: /Enable MIDI/ }).click();
  await page.getByRole('combobox', { name: 'Input' }).selectOption({ label: 'Fake Keys' });
  await page.keyboard.press('Escape');
  await page.getByTestId('tab-practice').click();
  await onlyTypes(page, ['Name the note']);
  const prompt = page.getByTestId('quiz-prompt');
  await expect(prompt).toHaveAttribute('data-question-type', 'nameNote');
  const midi = await page.locator('[data-testid="neck-card"] g[data-midi]').first().getAttribute('data-midi');
  expect(midi).toBeTruthy();
  await page.evaluate((note) => window.__midi.send([0x90, note, 100]), Number(midi));
  await expect(prompt).toContainText('Correct');
});
