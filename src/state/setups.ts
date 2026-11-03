// Read the v1 localStorage document. v2 writes its own key; this reader stays
// so the old blob can still be parsed. mergeApp fills fields an older setup
// never stored.

const KEY = 'fretboard-visualizer:setups:v1';

interface NamedSetup {
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

export function loadStore(): Store {
  return read();
}
