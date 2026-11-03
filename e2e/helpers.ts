import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { BrowserContext, Page } from '@playwright/test';

const appUrl = pathToFileURL(resolve(process.cwd(), 'fretboard-visualizer.html')).href;

export interface NeckLabel {
  string: number;
  fret: number;
  label: string;
}

declare global {
  interface Window {
    /** Frequencies of oscillators the built-in synth has started. */
    __played: number[];
    /** Fake MIDI input installed by `fakeMidi`. */
    __midi: { send: (bytes: number[]) => void };
  }
}

/**
 * Open the built HTML file. Any page error or console error fails the test,
 * including ones that happen after this function returns.
 */
export async function openApp(page: Page) {
  const fail = (message: string) => {
    throw new Error(message);
  };
  page.on('pageerror', (error) => {
    fail(`pageerror: ${error.message}`);
  });
  page.on('console', (message) => {
    if (message.type() === 'error') fail(`console error: ${message.text()}`);
  });
  await page.context().addInitScript(() => {
    try {
      localStorage.clear();
    } catch {
      // The blank document Playwright opens first has no storage.
    }
  });
  await page.goto(appUrl);
  await page.locator('svg.fretboard').waitFor();
}

interface NeckTarget {
  stringIndex: number;
  fret: number;
}

/**
 * Click the cell at `stringIndex` (0 = the lowest string) and `fret`.
 * The point comes from the fretboard's own string lines and fret numbers.
 */
export async function neckCell(page: Page, stringIndex: number, fret: number) {
  const handle = await page.locator('svg.fretboard').evaluateHandle((svg, target: NeckTarget) => {
    const strings = [...svg.querySelectorAll('line.string')]
      .map((line) => Number(line.getAttribute('y1')))
      .filter((y) => Number.isFinite(y))
      .sort((a, b) => b - a);
    const y = strings[target.stringIndex];
    if (y == null) throw new Error(`No string ${target.stringIndex} on the fretboard`);
    const fretLabel = [...svg.querySelectorAll('text.fret-number')].find(
      (node) => Number(node.textContent) === target.fret,
    );
    if (!fretLabel) throw new Error(`No fret ${target.fret} on the fretboard`);
    const x = Number(fretLabel.getAttribute('x'));
    let best: Element | null = null;
    let bestDist = Infinity;
    for (const group of svg.querySelectorAll('g')) {
      const circle = group.querySelector('circle');
      if (!circle) continue;
      const dx = Number(circle.getAttribute('cx')) - x;
      const dy = Number(circle.getAttribute('cy')) - y;
      const dist = Math.hypot(dx, dy);
      if (dist < bestDist) {
        bestDist = dist;
        best = group;
      }
    }
    if (!best || bestDist > 2) {
      throw new Error(`No fretboard cell at string ${target.stringIndex}, fret ${target.fret}`);
    }
    return best;
  }, { stringIndex, fret });
  const element = handle.asElement();
  if (!element) throw new Error(`No fretboard cell at string ${stringIndex}, fret ${fret}`);
  await element.click();
  await handle.dispose();
}

/** Note names (or degrees) drawn on fretboard cells, matched to string and fret. */
export async function neckLabels(page: Page): Promise<NeckLabel[]> {
  return page.locator('svg.fretboard').evaluate((svg) => {
    const strings = [...svg.querySelectorAll('line.string')]
      .map((line) => Number(line.getAttribute('y1')))
      .filter((y) => Number.isFinite(y))
      .sort((a, b) => b - a);
    const frets = [...svg.querySelectorAll('text.fret-number')].map((node) => ({
      fret: Number(node.textContent),
      x: Number(node.getAttribute('x')),
    }));
    return [...svg.querySelectorAll('text.note-label, text.practice-label')].map((node) => {
      const x = Number(node.getAttribute('x'));
      const y = Number(node.getAttribute('y'));
      let string = 0;
      for (let i = 1; i < strings.length; i++) {
        if (Math.abs(strings[i] - y) < Math.abs(strings[string] - y)) string = i;
      }
      let fret = frets[0];
      for (const candidate of frets) {
        if (Math.abs(candidate.x - x) < Math.abs(fret.x - x)) fret = candidate;
      }
      return { string, fret: fret.fret, label: (node.textContent ?? '').trim() };
    });
  });
}

/**
 * Replace `navigator.requestMIDIAccess` with one input named "Fake Keys".
 * `window.__midi.send(bytes)` delivers a message to that input.
 * Send note-on and note-off in separate ticks: React batches same-tick updates.
 * Call this before `openApp`.
 */
export async function fakeMidi(context: BrowserContext) {
  await context.addInitScript(() => {
    const input = {
      id: 'fake-keys',
      name: 'Fake Keys',
      state: 'connected',
      onmidimessage: null as ((event: { data?: ArrayLike<number> }) => void) | null,
    };
    const inputs = new Map<string, typeof input>([[input.id, input]]);
    const access = {
      outputs: new Map<string, { id: string; name: string; send: (data: number[]) => void }>(),
      inputs,
      onstatechange: null as ((event: unknown) => void) | null,
    };
    const nav = navigator as Navigator & {
      requestMIDIAccess?: (options?: { sysex?: boolean }) => Promise<typeof access>;
    };
    nav.requestMIDIAccess = () => Promise.resolve(access);
    window.__midi = {
      send(bytes: number[]) {
        const data = Array.from(bytes);
        input.onmidimessage?.({ data });
      },
    };
  });
}

/**
 * Record the frequency of every oscillator the page starts, as `window.__played`.
 * Call this before `openApp`.
 */
export async function recordSynth(context: BrowserContext) {
  await context.addInitScript(() => {
    const played: number[] = [];
    window.__played = played;
    const contexts = [window.AudioContext, window.webkitAudioContext].filter(
      (ctor): ctor is typeof AudioContext => typeof ctor === 'function',
    );
    for (const Ctor of contexts) {
      const original = Ctor.prototype.createOscillator;
      Ctor.prototype.createOscillator = function createOscillator(this: AudioContext) {
        const osc = original.call(this);
        const start = osc.start;
        osc.start = function startAt(this: OscillatorNode, ...args: Parameters<OscillatorNode['start']>) {
          played.push(osc.frequency.value);
          return start.apply(this, args);
        };
        return osc;
      };
    }
  });
}
