import { mkdirSync, readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { neckCell, openApp } from './helpers';

/** Buttons that repeat on purpose: one chip per step, and one control per list item. */
const REPEATED_BUTTONS = new Set(['step-chip']);

function specHooks(): string[] {
  const spec = readFileSync(new URL('../docs/ui-spec.md', import.meta.url), 'utf8');
  const section = spec.split('## Test hooks')[1] ?? '';
  const line = section.split('\n').find((row) => row.includes('app-header'));
  if (!line) throw new Error('docs/ui-spec.md has no Test hooks list');
  const cleaned = line.replace(/\([^)]*\)/g, '');
  return cleaned
    .split(',')
    .map((part) => part.trim().split(/\s/)[0].replace(/\.$/, ''))
    .filter((id) => id.includes('-'));
}

async function addSymbol(page: Page, symbol: string) {
  const input = page.getByRole('textbox', { name: 'Chord symbol' });
  await input.fill(symbol);
  await input.press('Enter');
}

test('the closed workspace stays within the control budget', async ({ page }) => {
  await openApp(page);
  const controls = await visibleControls(page);
  console.log(`visible workspace controls: ${controls.length}`);
  expect(controls.length, controls.map((item) => item.desc).join('\n')).toBeLessThanOrEqual(45);
});

test('workspace buttons do not share an accessible name', async ({ page }) => {
  await openApp(page);
  const controls = await visibleControls(page);
  const names = new Map<string, string[]>();
  for (const item of controls) {
    if (item.tag !== 'BUTTON') continue;
    if (item.testId && REPEATED_BUTTONS.has(item.testId)) continue;
    const list = names.get(item.name) ?? [];
    list.push(item.desc);
    names.set(item.name, list);
  }
  const dupes = [...names.entries()].filter(([, owners]) => owners.length > 1);
  expect(dupes, dupes.map(([name, owners]) => `${name}: ${owners.join(' | ')}`).join('\n')).toEqual([]);
});

test('every spec hook is on the page it belongs to', async ({ page }) => {
  await openApp(page);
  const hooks = specHooks();
  expect(hooks).toContain('app-header');
  expect(hooks).toContain('quiz-prompt');

  const later = new Set(['settings-drawer', 'step-chip', 'practice-panel', 'quiz-prompt']);
  for (const id of hooks) {
    if (later.has(id)) continue;
    await expect(page.getByTestId(id), id).toBeVisible();
  }

  await addSymbol(page, 'C');
  await expect(page.getByTestId('step-chip')).toBeVisible();
  await expect(page.getByTestId('step-chip')).toHaveAttribute('data-step-index', '0');

  await page.getByTestId('settings-button').click();
  await expect(page.getByTestId('settings-drawer')).toBeVisible();
  await page.getByRole('button', { name: 'Close' }).click();
  await expect(page.getByTestId('settings-drawer')).toHaveCount(0);

  await page.getByTestId('tab-practice').click();
  await expect(page.getByTestId('practice-panel')).toBeVisible();
  await expect(page.getByTestId('quiz-prompt')).toBeVisible();
});

test('inputs, selects, and icon buttons have accessible names', async ({ page }) => {
  await openApp(page);
  const missing = await page.evaluate(() => {
    function shown(el: Element): boolean {
      const details = el.closest('details');
      if (details && !details.open && !el.closest('summary')) return false;
      if (typeof el.checkVisibility === 'function' && !el.checkVisibility()) return false;
      const style = getComputedStyle(el);
      const box = el.getBoundingClientRect();
      return style.visibility !== 'hidden' && style.display !== 'none' && box.width > 0 && box.height > 0;
    }

    function nameOf(el: Element): string {
      const labelledBy = el.getAttribute('aria-labelledby');
      if (labelledBy) {
        const text = labelledBy
          .split(/\s+/)
          .map((id) => document.getElementById(id)?.textContent ?? '')
          .join(' ')
          .trim();
        if (text) return text;
      }
      const aria = el.getAttribute('aria-label')?.trim();
      if (aria) return aria;
      if (el.id) {
        const label = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
        const text = label?.textContent?.trim();
        if (text) return text;
      }
      const wrap = el.closest('label');
      if (wrap) {
        const clone = wrap.cloneNode(true) as HTMLElement;
        clone.querySelectorAll('input, select, textarea, button').forEach((node) => node.remove());
        const text = clone.textContent?.replace(/\s+/g, ' ').trim();
        if (text) return text;
      }
      const own = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
      if (own) return own;
      return el.getAttribute('title')?.trim() ?? '';
    }

    const problems: string[] = [];
    for (const el of document.querySelectorAll('input, select, textarea, button')) {
      if (!shown(el)) continue;
      const tag = el.tagName;
      const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
      const iconOnly = tag === 'BUTTON' && !/\p{L}|\p{N}/u.test(text);
      if (tag !== 'BUTTON' || iconOnly) {
        if (!nameOf(el)) {
          const id = el.getAttribute('data-testid') ?? text ?? el.id ?? 'unnamed';
          problems.push(`${tag} ${id}`);
        }
      }
    }
    return problems;
  });
  expect(missing).toEqual([]);
});

test('a phone width does not scroll the page sideways', async ({ page }) => {
  await openApp(page);
  await page.setViewportSize({ width: 390, height: 844 });
  const result = await page.evaluate(() => {
    const cards = ['neck-card', 'keyboard-card']
      .map((id) => document.querySelector(`[data-testid="${id}"]`))
      .filter((node): node is Element => node !== null);
    const insideCard = (el: Element) => cards.some((card) => card.contains(el));
    const doc = document.scrollingElement ?? document.documentElement;
    const extra: string[] = [];
    for (const el of document.querySelectorAll('body *')) {
      const overflow = getComputedStyle(el).overflowX;
      if (overflow !== 'auto' && overflow !== 'scroll') continue;
      if (el.scrollWidth <= el.clientWidth + 1) continue;
      if (insideCard(el)) continue;
      extra.push(el.getAttribute('data-testid') || el.className.toString().slice(0, 80) || el.tagName);
    }
    return {
      pageScrolls: doc.scrollWidth > doc.clientWidth + 1,
      scrollWidth: doc.scrollWidth,
      clientWidth: doc.clientWidth,
      extra,
    };
  });
  expect(result.extra, JSON.stringify(result)).toEqual([]);
  expect(result.pageScrolls, JSON.stringify(result)).toBe(false);
});

test('a full session runs without console errors', async ({ page }) => {
  await openApp(page);

  await page.locator('#key-root').selectOption({ label: 'C' });
  await expect(page.locator('.key-readout')).toContainText('C');

  for (const symbol of ['Cm7', 'F7', 'Bbmaj7']) await addSymbol(page, symbol);
  await expect(page.getByTestId('step-chip')).toHaveCount(3);
  await page.getByRole('radio', { name: 'Drop-2' }).click();
  await expect(page.getByRole('radio', { name: 'Drop-2' })).toHaveAttribute('aria-checked', 'true');

  mkdirSync('docs/screenshots', { recursive: true });
  await page.screenshot({ path: 'docs/screenshots/workspace.png', fullPage: true });

  const transport = page.getByTestId('transport');
  await transport.getByRole('spinbutton', { name: 'Tempo' }).fill('240');
  await transport.getByRole('button', { name: 'Play' }).click();
  const seen = new Set<number>();
  await expect
    .poll(async () => {
      const value = await page
        .locator('[data-testid="step-chip"][aria-current="step"]')
        .getAttribute('data-step-index');
      seen.add(Number(value));
      return seen.size;
    })
    .toBeGreaterThanOrEqual(2);
  await transport.getByRole('button', { name: 'Stop' }).click();

  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Download tab (.txt)' }).click();
  expect((await download).suggestedFilename()).toMatch(/\.txt$/);

  await page.getByTestId('identify-tool').click();
  await neckCell(page, 0, 4);
  await neckCell(page, 1, 3);
  await neckCell(page, 2, 1);
  await expect(page.getByTestId('identify-primary').locator('.identify-name')).toHaveText('D');
  await page.getByRole('button', { name: 'Add as step' }).click();
  await expect(page.getByTestId('step-chip')).toHaveCount(4);

  await page.getByTestId('tab-practice').click();
  await expect(page.getByTestId('quiz-prompt')).toBeVisible();
  for (const name of ['Find every note', 'Intervals from a root', 'Ear intervals', 'Chord tones', 'Read from the staff']) {
    await page.getByRole('checkbox', { name, exact: true }).uncheck();
  }
  await page.getByRole('checkbox', { name: 'Name the note', exact: true }).check();
  await expect(page.getByTestId('quiz-prompt')).toHaveAttribute('data-question-type', 'nameNote');
  await expect(page.locator('.quiz-pad button').first()).toBeVisible();
  mkdirSync('docs/screenshots', { recursive: true });
  await page.screenshot({ path: 'docs/screenshots/practice.png', fullPage: true });
  for (let n = 0; n < 3; n++) {
    const id = await page.getByTestId('quiz-prompt').getAttribute('data-question-id');
    await page.locator('.quiz-pad button').first().click();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('quiz-prompt')).not.toHaveAttribute('data-question-id', id ?? '');
  }

  await page.getByTestId('settings-button').click();
  await expect(page.getByTestId('settings-drawer')).toBeVisible();
  await page.getByRole('button', { name: 'Close' }).click();
  await expect(page.getByTestId('settings-drawer')).toHaveCount(0);
});

interface VisibleControl {
  tag: string;
  name: string;
  testId: string | null;
  desc: string;
}

async function visibleControls(page: Page): Promise<VisibleControl[]> {
  return page.evaluate(() => {
    function shown(el: Element): boolean {
      const details = el.closest('details');
      if (details && !details.open && !el.closest('summary')) return false;
      if (typeof el.checkVisibility === 'function' && !el.checkVisibility()) return false;
      const style = getComputedStyle(el);
      const box = el.getBoundingClientRect();
      return style.visibility !== 'hidden' && style.display !== 'none' && box.width > 0 && box.height > 0;
    }

    function nameOf(el: Element): string {
      const labelledBy = el.getAttribute('aria-labelledby');
      if (labelledBy) {
        const text = labelledBy
          .split(/\s+/)
          .map((id) => document.getElementById(id)?.textContent ?? '')
          .join(' ')
          .trim();
        if (text) return text;
      }
      const aria = el.getAttribute('aria-label')?.trim();
      if (aria) return aria;
      if (el.id) {
        const label = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
        const text = label?.textContent?.trim();
        if (text) return text;
      }
      const wrap = el.closest('label');
      if (wrap) {
        const clone = wrap.cloneNode(true) as HTMLElement;
        clone.querySelectorAll('input, select, textarea, button').forEach((node) => node.remove());
        const text = clone.textContent?.replace(/\s+/g, ' ').trim();
        if (text) return text;
      }
      const own = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
      if (own) return own;
      return el.getAttribute('title')?.trim() ?? '';
    }

    const found: VisibleControl[] = [];
    for (const el of document.querySelectorAll('button, input, select, textarea, a[href]')) {
      if (!shown(el)) continue;
      const name = nameOf(el);
      const testId = el.getAttribute('data-testid');
      found.push({
        tag: el.tagName,
        name,
        testId,
        desc: `${el.tagName} "${name}" ${testId ?? ''}`.trim(),
      });
    }
    return found;
  });
}
