import type { RefObject } from 'react';

export function AppHeader({
  tab,
  drawerOpen,
  settingsRef,
  onOpenSettings,
}: {
  tab: 'workspace' | 'practice';
  drawerOpen: boolean;
  settingsRef: RefObject<HTMLButtonElement>;
  onOpenSettings: () => void;
}) {
  return (
    <header className="app-header" data-testid="app-header">
      <h1>Fretboard Visualizer</h1>
      <nav className="app-tabs" aria-label="Sections">
        <a href="#workspace" data-testid="tab-workspace" aria-current={tab === 'workspace' ? 'page' : undefined}>
          Workspace
        </a>
        <a href="#practice" data-testid="tab-practice" aria-current={tab === 'practice' ? 'page' : undefined}>
          Practice
        </a>
      </nav>
      <button type="button" className="header-button" data-testid="setups-menu">
        Setups
      </button>
      <button
        type="button"
        className="header-button"
        data-testid="settings-button"
        ref={settingsRef}
        aria-expanded={drawerOpen}
        aria-controls="settings-drawer"
        onClick={onOpenSettings}
      >
        Settings
      </button>
    </header>
  );
}
