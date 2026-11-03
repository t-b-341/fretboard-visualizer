// "My default" is the key, Names setting, instrument, and tuning a reset returns to.

import type { AppStateV2, MyDefault } from './types';
import { keyLabel, keySummary } from '../../music/keyLabel';
import { labelShift } from '../../music/notes';
import { defaultPresetForStrings, getPreset, TUNING_PRESETS } from '../../music/tunings';
import type { GuitarString } from '../../music/tunings';

function sameNotes(a: readonly GuitarString[], b: readonly GuitarString[]): boolean {
  return a.length === b.length && a.every((note, index) => note.pc === b[index].pc && note.octave === b[index].octave);
}

export function captureMyDefault(state: AppStateV2): MyDefault {
  const { numStrings, tuning } = state.settings.instrument;
  const matched = TUNING_PRESETS.find((preset) => preset.strings === numStrings && sameNotes(preset.notes, tuning));
  return {
    rootPc: state.material.key.rootPc,
    familyKey: state.material.key.familyKey,
    modeKey: state.material.key.modeKey,
    names: state.view.names,
    numStrings,
    tuningPresetId: matched?.id ?? defaultPresetForStrings(numStrings).id,
  };
}

export function formatMyDefault(mine: MyDefault): { summary: string; soundsAs: string | null } {
  const shift = labelShift(mine.names);
  const preset = getPreset(mine.tuningPresetId);
  const instrument = preset ? preset.name.replace(' \u00b7 ', ' ') : `${mine.numStrings}-string`;
  const names = mine.names === 'standard' ? 'Standard names' : 'Concert names';
  return {
    summary: `${keySummary(mine.rootPc, mine.modeKey, shift)}, ${names}, ${instrument}`,
    soundsAs: mine.names === 'standard' ? `Sounds as ${keyLabel(mine.rootPc, mine.modeKey, 0)}` : null,
  };
}
