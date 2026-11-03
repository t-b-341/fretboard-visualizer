import { expect, test, type Page } from '@playwright/test';
import { buildChord } from '../src/music/chords';
import { midiOf } from '../src/music/fretboard';
import { chordWrittenNotes } from '../src/music/staff';
import { defaultPresetForStrings } from '../src/music/tunings';
import { neckLabels, openApp } from './helpers';

const tuning = defaultPresetForStrings(7).notes;

async function addSymbol(page: Page, symbol: string) {
  const input = page.getByRole('textbox', { name: 'Chord symbol' });
  await input.fill(symbol);
  await input.press('Enter');
}

async function staffMidis(page: Page): Promise<number[]> {
  const label = await page.locator('svg.staff').getAttribute('aria-label');
  const match = /MIDI\s+((?:\d+\s*)+)/.exec(label ?? '');
  if (!match) throw new Error(`Staff label has no MIDI notes: ${label}`);
  return match[1]
    .trim()
    .split(/\s+/)
    .map(Number)
    .sort((a, b) => a - b);
}

async function keyboardMidis(page: Page): Promise<number[]> {
  const midis = await page.locator('svg.keyboard [data-midi]').evaluateAll((nodes) =>
    nodes.map((node) => Number(node.getAttribute('data-midi'))),
  );
  return midis.sort((a, b) => a - b);
}

function tabFrets(text: string): (number | null)[] {
  return text
    .split('\n')
    .filter((line) => line.includes('|'))
    .map((line) => {
      const cell = line.slice(line.indexOf('|') + 1).trim();
      const match = /^(\d+)/.exec(cell);
      return match ? Number(match[1]) : null;
    });
}

function motion(from: number[], to: number[]): number {
  let sum = 0;
  for (let index = 0; index < Math.min(from.length, to.length); index++) sum += Math.abs(from[index] - to[index]);
  return sum;
}

/** Neck, staff, keyboard, and tab for the voicing on screen. */
async function views(page: Page) {
  const neck = await neckLabels(page);
  const staff = await staffMidis(page);
  const keys = await keyboardMidis(page);
  const tab = tabFrets(await page.getByLabel('Tab preview').innerText());
  const neckMidis = neck.map((note) => midiOf(tuning[note.string], note.fret)).sort((a, b) => a - b);
  expect(neck).toHaveLength(4);
  expect(staff).toEqual(neckMidis);
  expect(keys).toEqual(neckMidis);
  for (const note of neck) {
    expect(tab[tuning.length - 1 - note.string]).toBe(note.fret);
  }
  return {
    staff: staff.join(','),
    neck: neck
      .map((note) => `${note.string}:${note.fret}`)
      .sort()
      .join(','),
    keys: keys.join(','),
  };
}

test('one voicing drives the neck, staff, keyboard, and tab', async ({ page }) => {
  await openApp(page);
  for (const symbol of ['Cm7', 'F7', 'Bbmaj7']) await addSymbol(page, symbol);
  const panel = page.getByTestId('voicing-panel');
  await panel.getByRole('radio', { name: 'Drop-2' }).click();
  await panel.getByRole('combobox', { name: 'String set' }).selectOption('2');
  await expect(panel.getByRole('combobox', { name: 'String set' })).toHaveValue('2');

  const chips = page.getByTestId('step-chip');
  await chips.nth(2).click();
  await views(page);

  const smooth = panel.getByRole('checkbox', { name: 'Smooth voice leading (suggests voicings)' });
  await smooth.uncheck();
  const plain: number[][] = [];
  for (let index = 0; index < 3; index++) {
    await chips.nth(index).click();
    plain.push(await staffMidis(page));
  }
  await smooth.check();
  const led: number[][] = [];
  for (let index = 0; index < 3; index++) {
    await chips.nth(index).click();
    led.push(await staffMidis(page));
  }
  for (let index = 1; index < 3; index++) {
    expect(motion(led[index - 1], led[index])).toBeLessThanOrEqual(motion(plain[index - 1], plain[index]));
  }

  await chips.nth(2).click();
  const before = await views(page);
  await panel.getByRole('button', { name: 'Next voicing' }).click();
  const next = await views(page);
  expect(next.staff).not.toBe(before.staff);
  expect(next.neck).not.toBe(before.neck);
  expect(next.keys).not.toBe(before.keys);

  await panel.getByRole('radio', { name: 'Close' }).click();
  const close = await views(page);
  expect(close.staff).not.toBe(next.staff);
  expect(close.neck).not.toBe(next.neck);
  expect(close.keys).not.toBe(next.keys);

  await panel.getByRole('radio', { name: 'All tones' }).click();
  const root = chordWrittenNotes(buildChord(10, 'maj7'))
    .map((note) => note.midi)
    .sort((a, b) => a - b);
  expect(await staffMidis(page)).toEqual(root);
  const copy = page.getByRole('button', { name: 'Copy tab' });
  await expect(copy).toBeDisabled();
  await expect(copy.locator('xpath=..')).toHaveAttribute('title', /voicing/i);

  const visible = await page.evaluate(() => {
    const parts: string[] = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
      const parent = node.parentElement;
      const hidden =
        parent?.closest('details:not([open])') != null ||
        (parent != null && getComputedStyle(parent).display === 'none');
      if (!hidden) parts.push(node.textContent ?? '');
      node = walker.nextNode();
    }
    return parts.join('\n');
  });
  expect(visible.toLowerCase()).not.toContain('grip');
});
