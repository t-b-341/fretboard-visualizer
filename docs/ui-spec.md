# Fretboard Visualizer UI spec (v2)

## Purpose
A reference workspace for making music. One piece of material is shown on the grand staff, the neck and the keyboard at once, and stepped through in time so every change of position is visible. The tool shows and translates. Anything that makes a musical choice (Suggest, smooth voice leading) is labeled as a suggestion, explains itself, and is easy to override.

## Words used in the UI
- Material: what you are looking at. One of Scale, Chord, Progression.
- Step: one chord (or scale) in the sequence. A progression is a list of steps.
- Voicing: a specific way to play a chord on the neck (strings, frets). Never say "grip" in the UI; code may keep old names.
- Key: root + scale + mode.
- Names: Concert (sounding) or Standard (+1 semitone, for half-step-down tuning).
- Labels: Notes or Degrees.
- Suggest: generated chords. Always shows a reason per chord.

## Layout
Header: app title; tabs Workspace and Practice; Setups menu (name, save, load, delete, new, reset, copy link); Settings button (opens the drawer).

Workspace tab, two columns that stack on narrow screens:

Left: Material panel, top to bottom
1. Material type: Scale | Chord | Progression, with one line describing it.
2. Key: Root, Scale (family + mode), a readout of the scale's spelled notes, and a "Detect key from steps" button that lists ranked keys the current steps fit, each with a one-line reason and a Use button.
3. Add chord: one text field ("Gm7", "Eb/G", "A7") + Add; a palette of diatonic chords (I ii iii IV V vi vii°) colored by degree; a "7th chords" checkbox.
4. Suggest: style select (Jazz ii–V–I, Pop I–V–vi–IV, Free functional), "Borrowed and secondary chords" checkbox, Suggest button. Locked steps are kept; others are regenerated.
5. Voicing: shape All tones | Close | Drop-2; string set; ‹ voicing n of m ›; "Smooth voice leading (suggests voicings)" checkbox.
6. Compare with another scale (collapsed by default).
7. Only when Material = Scale: positions All | 3 per string | CAGED, and a fret range.

Right: main column, top to bottom
1. Steps strip: one chip per step (symbol, roman numeral, function tag T/SD/D, locked state, colored by root degree; dashed border if borrowed, gray if outside the key). Controls: ‹ Prev, Play, Next ›, Tempo, Loop, Export (MIDI file, tab text, copy tab). Under the chips: "Why:" line for the current step and "Next:" line describing each voice's motion to the next step. Buttons: Lock/Unlock this step, Reroll this step, Remove. "+ Add step" at the end.
2. View bar: checkboxes Staff, Neck, Keyboard (all on by default); Labels Notes|Degrees; Names Concert|Standard; "Intervals from…" (click a note to relabel everything as intervals from it; Escape clears); Show key (dim rest of the key); Voice motion (dashed rings and motion lines toward the next step).
3. Staff card (on top): grand staff with every step as a measure, the current step highlighted. Toggle Concert | Written in the card header. Written follows the instrument: guitar on treble, 6-string bass on bass.
4. Neck card: fretboard; "Pick notes (identify)" tool in the card header. While the tool is on, a result under the header names the chord: the chosen reading large (slash name, inversion, missing and extra tones) and up to two other readings smaller. Add as step appends that reading; Replace current step writes it over the selected step. Both leave the tool.
5. Keyboard card.
Each card shows a small legend of only what that card uses.

Settings drawer (slides in from the right):
- Start in: Last session | My default (root, scale, Names setting, instrument, tuning), with "Set from current". Reset and New also go to My default.
- Instrument: 6-string bass | 7-string | 8-string; tuning preset; each string; right/left hand.
- Neck: fret range shown; strings shown.
- Keyboard: span and start key.
- Sound: volume, mute, drone, click to hear, playback octave, beats per step.
- MIDI: output device and channel; input device; show played notes; sound played notes.
- Voice leading (advanced): the cost sliders and Reset.

Practice tab: one quiz. Reference views are hidden while a question is open.
- Question types: Name the note, Find every note, Intervals from a root (both directions), Ear intervals, Chord tones (the old Quiz view), Read from the staff.
- Where: strings, fret range. Spelling: either spelling, or spell in the current key.
- Session bar: answered, accuracy, median time; Heatmap toggle.
- MIDI input can answer name and reverse-interval questions.

## Rules
- One control per job. No duplicates.
- A control lives only where this spec puts it. To add or move a control, change this spec in the same commit.
- Controls for one material type or tab appear only there.
- Colors: role colors on the views (root, 3rd, 5th, 7th); degree colors on step chips and the palette.
- Keyboard shortcuts never fire while focus is on a button, input or select, and Enter never both runs a shortcut and clicks a focused button.

## Control map (old → new)

| Old | New home |
|---|---|
| Setup bar, Copy link | Header › Setups |
| Instrument, tuning, each string, hand | Settings › Instrument |
| From/To fret, Strings shown | Settings › Neck |
| Position window | Material › Scale fret range (also limits voicings) |
| All / 3-string / CAGED | Material › Scale positions |
| Root, family, mode | Material › Key |
| View Full scale / Triad / Chords | Material type Scale / Chord / Progression |
| Overlay a second scale | Material › Compare |
| Formula bar | Key readout; reading line becomes the step's Why |
| Builder root/quality/Show/Add/Hear | Material › Add chord field |
| Diatonic buttons + 7ths | Material › Add chord palette |
| Template / Random / Borrowed | Material › Suggest |
| Progression chips | Steps strip |
| Play/Stop/Tempo/Loop | Steps strip transport |
| Beats per chord, playback octave | Settings › Sound |
| Export .mid, Copy tab, Download .txt | Steps strip › Export |
| Voice leading checkbox | Material › Voicing › Smooth voice leading |
| Voice leading weights | Settings › Voice leading |
| All tones/One voicing + All tones/Close/Drop-2 + inversion + string set | Material › Voicing (one control) |
| Show on Fretboard/Keyboard/Both/Staff | View bar checkboxes |
| Keyboard span/start/octave | Settings › Keyboard |
| Notes/Degrees, Concert/Standard | View bar |
| Reference | View bar › Intervals from… |
| Role/Degree color, Color chords by root | Removed; fixed color rules above |
| Ghost key notes | View bar › Show key |
| Guide tones | View bar › Voice motion |
| Staff Concert/Written | Staff card header |
| Legend | Small legend per card |
| Identify view, Identify (progression bar) | Neck card › Pick notes tool |
| Send to builder | Add as step |
| Mute, volume, drone, click notes, octave | Settings › Sound |
| Play scale, Play chord | Steps transport |
| MIDI out/in | Settings › MIDI |
| Quiz view, Note quiz | Practice tab |

## Test hooks
Every area carries a data-testid so tests don't depend on layout:
app-header, tab-workspace, tab-practice, setups-menu, settings-button, settings-drawer, material-panel, material-type, key-panel, detect-key, add-chord, chord-palette, suggest-panel, voicing-panel, compare-panel, scale-positions, steps-strip, step-chip (one per step, with data-step-index), step-why, step-next, transport, view-bar, staff-card, neck-card, keyboard-card, identify-tool, practice-panel, quiz-prompt.

## Look
Dark theme. Ground #0f131a, panels #171c25, borders #222936, text #e8ecf2, muted #9aa4b2, accent #8f7bff. Role colors: root #ff6b6b, 3rd #ffc24b, 5th #5aa2ff, 7th #c38bff. Staff card is light (#f4f1ea) with dark ink. Font Inter; monospace JetBrains Mono for tab and readouts. Touch targets at least 36px.
