// Named setups and the last session, kept in localStorage so the portable
// HTML file can reopen on the same key, tuning, view, and progression.

const KEY = 'fretboard-visualizer:setups:v1';

export interface NamedSetup {
  id: string;
  name: string;
  savedAt: number;
  app: unknown;
  progression: unknown;
}

interface Store {
  version: 1;
  last: { app: unknown; progression: unknown } | null;
  named: NamedSetup[];
}

const EMPTY: Store = { version: 1, last: null, named: [] };

function read(): Store {
  if (typeof localStorage === 'undefined') return EMPTY;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<Store>;
    if (!parsed || parsed.version !== 1) return EMPTY;
    return {
      version: 1,
      last: parsed.last ?? null,
      named: Array.isArray(parsed.named) ? parsed.named : [],
    };
  } catch {
    return EMPTY;
  }
}

function write(store: Store) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    /* private mode or a full disk — the session simply isn't remembered */
  }
}

export function loadStore(): Store {
  return read();
}

export function saveLast(app: unknown, progression: unknown) {
  const store = read();
  store.last = { app, progression };
  write(store);
}

export function saveNamed(name: string, app: unknown, progression: unknown): NamedSetup[] {
  const store = read();
  const setup: NamedSetup = {
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `s-${Date.now()}`,
    name: name.trim().slice(0, 40),
    savedAt: Date.now(),
    app,
    progression,
  };
  store.named = [setup, ...store.named].slice(0, 24);
  write(store);
  return store.named;
}

export function deleteNamed(id: string): NamedSetup[] {
  const store = read();
  store.named = store.named.filter((s) => s.id !== id);
  write(store);
  return store.named;
}
