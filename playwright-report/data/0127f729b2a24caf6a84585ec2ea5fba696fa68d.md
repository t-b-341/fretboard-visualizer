# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: staff.spec.ts >> both clefs paint, sit on their own staff, and do not overlap
- Location: e2e\staff.spec.ts:68:1

# Error details

```
Error: treble and bass clefs overlap

expect(received).toBe(expected) // Object.is equality

Expected: 0
Received: 44
```

# Page snapshot

```yaml
- generic [ref=f1e3]:
  - banner [ref=f1e4]:
    - heading "Fretboard Visualizer" [level=1] [ref=f1e5]
    - paragraph [ref=f1e6]: 6-string bass, 7/8-string guitar, keyboard & staff · scales, modes & diatonic triads
  - generic [ref=f1e7]:
    - generic [ref=f1e8]: Setups
    - textbox "Name this setup" [ref=f1e9]
    - button "Save" [disabled] [ref=f1e10]
    - combobox "Saved setups" [ref=f1e11]:
      - option "No saved setups" [selected]
    - button "Load" [disabled] [ref=f1e12]
    - button "Delete" [disabled] [ref=f1e13]
    - button "Reset" [ref=f1e14] [cursor=pointer]
  - generic [ref=f1e15]:
    - generic [ref=f1e16]:
      - generic [ref=f1e17]: Instrument
      - group "Number of strings" [ref=f1e18]:
        - button "6-string bass" [ref=f1e19] [cursor=pointer]
        - button "7-string" [ref=f1e20] [cursor=pointer]
        - button "8-string" [ref=f1e21] [cursor=pointer]
      - generic [ref=f1e22]:
        - generic [ref=f1e23]: Tuning
        - combobox [ref=f1e24]:
          - option "7-string · half step down" [selected]
          - option "7-string · standard"
      - generic [ref=f1e25]:
        - generic [ref=f1e26]: Strings (low → high)
        - generic [ref=f1e27]:
          - generic [ref=f1e28]:
            - generic [ref=f1e29]: "1"
            - combobox [ref=f1e30]:
              - option "C"
              - option "Db"
              - option "D"
              - option "Eb"
              - option "E"
              - option "F"
              - option "Gb"
              - option "G"
              - option "Ab"
              - option "A"
              - option "Bb" [selected]
              - option "B"
          - generic [ref=f1e31]:
            - generic [ref=f1e32]: "2"
            - combobox [ref=f1e33]:
              - option "C"
              - option "Db"
              - option "D"
              - option "Eb" [selected]
              - option "E"
              - option "F"
              - option "Gb"
              - option "G"
              - option "Ab"
              - option "A"
              - option "Bb"
              - option "B"
          - generic [ref=f1e34]:
            - generic [ref=f1e35]: "3"
            - combobox [ref=f1e36]:
              - option "C"
              - option "Db"
              - option "D"
              - option "Eb"
              - option "E"
              - option "F"
              - option "Gb"
              - option "G"
              - option "Ab" [selected]
              - option "A"
              - option "Bb"
              - option "B"
          - generic [ref=f1e37]:
            - generic [ref=f1e38]: "4"
            - combobox [ref=f1e39]:
              - option "C"
              - option "Db" [selected]
              - option "D"
              - option "Eb"
              - option "E"
              - option "F"
              - option "Gb"
              - option "G"
              - option "Ab"
              - option "A"
              - option "Bb"
              - option "B"
          - generic [ref=f1e40]:
            - generic [ref=f1e41]: "5"
            - combobox [ref=f1e42]:
              - option "C"
              - option "Db"
              - option "D"
              - option "Eb"
              - option "E"
              - option "F"
              - option "Gb" [selected]
              - option "G"
              - option "Ab"
              - option "A"
              - option "Bb"
              - option "B"
          - generic [ref=f1e43]:
            - generic [ref=f1e44]: "6"
            - combobox [ref=f1e45]:
              - option "C"
              - option "Db"
              - option "D"
              - option "Eb"
              - option "E"
              - option "F"
              - option "Gb"
              - option "G"
              - option "Ab"
              - option "A"
              - option "Bb" [selected]
              - option "B"
          - generic [ref=f1e46]:
            - generic [ref=f1e47]: "7"
            - combobox [ref=f1e48]:
              - option "C"
              - option "Db"
              - option "D"
              - option "Eb" [selected]
              - option "E"
              - option "F"
              - option "Gb"
              - option "G"
              - option "Ab"
              - option "A"
              - option "Bb"
              - option "B"
      - generic [ref=f1e49]:
        - generic [ref=f1e50]: Frets
        - spinbutton [ref=f1e51]: "24"
      - button "Copy link" [ref=f1e53] [cursor=pointer]
    - generic [ref=f1e54]:
      - generic [ref=f1e55]: Neck
      - generic [ref=f1e56]:
        - generic [ref=f1e57]: Hand
        - group "Fretboard handedness" [ref=f1e58]:
          - button "Right" [ref=f1e59] [cursor=pointer]
          - button "Left" [ref=f1e60] [cursor=pointer]
      - generic [ref=f1e61]:
        - generic [ref=f1e62]:
          - generic [ref=f1e63]: From fret
          - spinbutton [ref=f1e64]: "0"
        - generic [ref=f1e65]:
          - generic [ref=f1e66]: To fret
          - spinbutton [ref=f1e67]: "24"
      - generic [ref=f1e68]:
        - checkbox "Position window" [ref=f1e69]
        - text: Position window
      - generic [ref=f1e70]:
        - generic [ref=f1e71]:
          - generic [ref=f1e72]: From
          - spinbutton "Position window from" [ref=f1e73]: "5"
        - generic [ref=f1e74]:
          - generic [ref=f1e75]: To
          - spinbutton "Position window to" [ref=f1e76]: "8"
      - generic [ref=f1e77]:
        - generic [ref=f1e78]: Strings shown
        - generic [ref=f1e79]:
          - button "All" [ref=f1e80] [cursor=pointer]
          - button "Low 4" [ref=f1e81] [cursor=pointer]
          - button "High 4" [ref=f1e82] [cursor=pointer]
        - generic [ref=f1e83]:
          - button "1" [ref=f1e84] [cursor=pointer]
          - button "2" [ref=f1e85] [cursor=pointer]
          - button "3" [ref=f1e86] [cursor=pointer]
          - button "4" [ref=f1e87] [cursor=pointer]
          - button "5" [ref=f1e88] [cursor=pointer]
          - button "6" [ref=f1e89] [cursor=pointer]
          - button "7" [ref=f1e90] [cursor=pointer]
      - generic [ref=f1e91]:
        - generic [ref=f1e92]: Position
        - group "Position box" [ref=f1e93]:
          - button "All" [ref=f1e94] [cursor=pointer]
          - button "3/string" [ref=f1e95] [cursor=pointer]
          - button "CAGED" [ref=f1e96] [cursor=pointer]
    - generic [ref=f1e97]:
      - generic [ref=f1e98]: Key & Scale
      - generic [ref=f1e99]:
        - generic [ref=f1e100]: Root
        - combobox [ref=f1e101]:
          - option "C"
          - option "Db"
          - option "D"
          - option "Eb"
          - option "E"
          - option "F"
          - option "Gb"
          - option "G"
          - option "Ab"
          - option "A"
          - option "Bb" [selected]
          - option "B"
      - generic [ref=f1e102]:
        - generic [ref=f1e103]: Scale family
        - combobox [ref=f1e104]:
          - option "Major" [selected]
          - option "Melodic Minor"
          - option "Harmonic Minor"
          - option "Harmonic Major"
          - option "Pentatonic"
          - option "Blues"
          - option "Diminished"
          - option "Whole Tone"
      - generic [ref=f1e105]:
        - generic [ref=f1e106]: Mode
        - combobox [ref=f1e107]:
          - option "Ionian (Major)" [selected]
          - option "Dorian"
          - option "Phrygian"
          - option "Lydian"
          - option "Mixolydian"
          - option "Aeolian (Natural Minor)"
          - option "Locrian"
    - generic [ref=f1e108]:
      - generic [ref=f1e109]: Compare
      - generic [ref=f1e110]:
        - checkbox "Overlay a second scale" [ref=f1e111]
        - text: Overlay a second scale
    - generic [ref=f1e112]:
      - generic [ref=f1e113]: Display
      - generic [ref=f1e114]:
        - generic [ref=f1e115]: Show on
        - group "Instrument view" [ref=f1e116]:
          - button "Fretboard" [ref=f1e117] [cursor=pointer]
          - button "Keyboard" [ref=f1e118] [cursor=pointer]
          - button "Both" [ref=f1e119] [cursor=pointer]
          - button "Staff" [active] [pressed] [ref=f1e120] [cursor=pointer]
      - generic [ref=f1e121]:
        - generic [ref=f1e122]: Keyboard
        - group "Keyboard span" [ref=f1e123]:
          - button "1 oct" [ref=f1e124] [cursor=pointer]
          - button "2 oct" [ref=f1e125] [cursor=pointer]
          - button "37 keys" [ref=f1e126] [cursor=pointer]
      - generic [ref=f1e127]:
        - 'generic "Lowest key when both MPK Mini Plus octave buttons are pressed (center). Same numbering as the sound octave: 4 is middle C." [ref=f1e128]': Start key
        - 'combobox "Lowest key when both MPK Mini Plus octave buttons are pressed (center). Same numbering as the sound octave: 4 is middle C." [ref=f1e129]':
          - option "C1"
          - option "C2"
          - option "C3" [selected]
          - option "C4"
      - generic [ref=f1e130]:
        - generic "Matches the octave buttons on the controller" [ref=f1e131]: Octave
        - group "Controller octave" [ref=f1e132]:
          - button "Octave down" [ref=f1e133] [cursor=pointer]: −
          - generic [ref=f1e134]: "0"
          - button "Octave up" [ref=f1e135] [cursor=pointer]: +
        - generic [ref=f1e136]: C3–C6
      - generic [ref=f1e137]:
        - generic [ref=f1e138]: View
        - generic [ref=f1e139]:
          - group "View mode" [ref=f1e140]:
            - button "Full scale" [ref=f1e141] [cursor=pointer]
            - button "Triad" [ref=f1e142] [cursor=pointer]
            - button "Chords" [ref=f1e143] [cursor=pointer]
            - button "Identify" [ref=f1e144] [cursor=pointer]
            - button "Quiz" [ref=f1e145] [cursor=pointer]
          - group "Note quiz" [ref=f1e146]:
            - button "Note quiz" [ref=f1e147] [cursor=pointer]
    - generic [ref=f1e148]:
      - generic [ref=f1e149]: Labels
      - generic [ref=f1e150]:
        - generic [ref=f1e151]: Show
        - group "Label content" [ref=f1e152]:
          - button "Notes" [ref=f1e153] [cursor=pointer]
          - button "Degrees" [ref=f1e154] [cursor=pointer]
      - generic [ref=f1e155]:
        - generic [ref=f1e156]: Tuning reference
        - generic [ref=f1e157]:
          - group "Label pitch reference" [ref=f1e158]:
            - button "Concert" [ref=f1e159] [cursor=pointer]
            - button "Standard" [ref=f1e160] [cursor=pointer]
          - group "Interval reference" [ref=f1e161]:
            - button "Reference" [ref=f1e162] [cursor=pointer]
      - generic [ref=f1e163]:
        - generic [ref=f1e164]: Color
        - generic [ref=f1e165]:
          - group "Note color" [ref=f1e166]:
            - button "Role" [ref=f1e167] [cursor=pointer]
            - button "Degree" [ref=f1e168] [cursor=pointer]
          - generic [ref=f1e169]:
            - checkbox "Color chords by root" [checked] [ref=f1e170]
            - text: Color chords by root
  - generic [ref=f1e171]:
    - generic [ref=f1e172]: Sound
    - button "Mute" [ref=f1e173] [cursor=pointer]
    - generic [ref=f1e174]:
      - text: Volume
      - slider "Volume" [ref=f1e175] [cursor=pointer]: "50"
    - button "Drone" [ref=f1e176] [cursor=pointer]
    - generic [ref=f1e177]:
      - checkbox "Click notes" [checked] [ref=f1e178]
      - text: Click notes
    - generic [ref=f1e179]:
      - text: Octave
      - combobox "Octave" [ref=f1e180]:
        - option "2"
        - option "3"
        - option "4" [selected]
        - option "5"
        - option "6"
    - generic [ref=f1e181]:
      - text: Tempo
      - spinbutton "Tempo" [ref=f1e182]: "120"
    - button "▶ Play scale" [ref=f1e184] [cursor=pointer]
    - button "▶ Play chord" [ref=f1e185] [cursor=pointer]
    - button "■ Stop" [ref=f1e186] [cursor=pointer]
    - button "Enable MIDI…" [ref=f1e188] [cursor=pointer]
  - generic [ref=f1e189]:
    - generic [ref=f1e190]:
      - generic [ref=f1e191]: Chords & progressions
      - generic [ref=f1e192]: "Key centre: Bb"
      - generic [ref=f1e193]: Shows in the “Chords” view.
    - generic [ref=f1e194]:
      - generic [ref=f1e195]: Build
      - generic [ref=f1e196]:
        - text: Root
        - combobox "Root" [ref=f1e197]:
          - option "C"
          - option "Db"
          - option "D"
          - option "Eb"
          - option "E"
          - option "F"
          - option "Gb"
          - option "G"
          - option "Ab"
          - option "A"
          - option "Bb" [selected]
          - option "B"
      - generic [ref=f1e198]:
        - text: Quality
        - combobox "Quality" [ref=f1e199]:
          - option "maj — major" [selected]
          - option "m — minor"
          - option "° — diminished"
          - option "+ — augmented"
          - option "sus2 — suspended 2nd"
          - option "sus4 — suspended 4th"
          - option "6 — major 6th"
          - option "m6 — minor 6th"
          - option "6/9 — six-nine"
          - option "maj7 — major 7th"
          - option "7 — dominant 7th"
          - option "m7 — minor 7th"
          - option "m7♭5 — half-diminished 7th"
          - option "°7 — diminished 7th"
          - option "m(maj7) — minor-major 7th"
          - option "maj9 — major 9th"
          - option "9 — dominant 9th"
          - option "m9 — minor 9th"
          - option "add9 — added 9th"
          - option "m(add9) — minor added 9th"
          - option "m11 — minor 11th"
          - option "maj9♯11 — major 9th ♯11 (lydian)"
          - option "13 — dominant 13th"
          - option "maj13 — major 13th"
          - option "m13 — minor 13th"
          - option "7♭5 — dominant 7th ♭5"
          - option "7♯5 — dominant 7th ♯5"
          - option "7♭9 — dominant 7th ♭9"
          - option "7♯9 — dominant 7th ♯9"
          - option "7♯11 — dominant 7th ♯11"
          - option "7alt — altered dominant"
      - button "Show" [ref=f1e200] [cursor=pointer]
      - button "Add →" [ref=f1e201] [cursor=pointer]
      - button "▶ Hear" [ref=f1e202] [cursor=pointer]
      - button "Identify" [ref=f1e203] [cursor=pointer]
    - generic [ref=f1e204]:
      - generic [ref=f1e205]: Diatonic
      - generic [ref=f1e206]:
        - button "I" [ref=f1e207] [cursor=pointer]
        - button "ii" [ref=f1e208] [cursor=pointer]
        - button "iii" [ref=f1e209] [cursor=pointer]
        - button "IV" [ref=f1e210] [cursor=pointer]
        - button "V" [ref=f1e211] [cursor=pointer]
        - button "vi" [ref=f1e212] [cursor=pointer]
        - button "vii°" [ref=f1e213] [cursor=pointer]
      - generic [ref=f1e214]:
        - checkbox "7th chords" [ref=f1e215]
        - text: 7th chords
    - generic [ref=f1e216]:
      - generic [ref=f1e217]: Generate
      - combobox [ref=f1e218]:
        - option "Pop · I–V–vi–IV" [selected]
        - option "50s / doo-wop · I–vi–IV–V"
        - option "Pachelbel · I–V–vi–iii–IV–I–IV–V"
        - option "Jazz ii–V–I · ii7–V7–Imaj7"
        - option "12-bar blues · I7–IV7–V7 (dominant)"
        - option "Andalusian (minor) · i–♭VII–♭VI–V"
        - option "Secondary dominant · I–V7/V–V7–I"
      - button "Use template" [ref=f1e219] [cursor=pointer]
      - button "Random" [ref=f1e220] [cursor=pointer]
      - generic [ref=f1e221]:
        - checkbox "Borrowed / secondary" [ref=f1e222]
        - text: Borrowed / secondary
    - generic [ref=f1e223]: No chords yet — add some above or generate a progression.
    - generic [ref=f1e225]:
      - generic [ref=f1e226]:
        - text: Tempo
        - spinbutton "Tempo" [ref=f1e227]: "100"
      - generic [ref=f1e228]:
        - text: Beats/chord
        - combobox "Beats/chord" [ref=f1e229]:
          - option "1"
          - option "2" [selected]
          - option "4"
      - generic [ref=f1e230]:
        - text: Octave
        - combobox "Octave" [ref=f1e231]:
          - option "2"
          - option "3"
          - option "4" [selected]
          - option "5"
          - option "6"
      - generic [ref=f1e232]:
        - checkbox "Loop" [checked] [ref=f1e233]
        - text: Loop
      - generic "Play and export each chord as the next grip in a smooth path. Off uses a root-position stack in the selected octave." [ref=f1e234]:
        - checkbox "Voice leading" [checked] [ref=f1e235]
        - text: Voice leading
      - button "▶ Play" [disabled] [ref=f1e237]
      - button "■ Stop" [ref=f1e238] [cursor=pointer]
      - button "Clear" [disabled] [ref=f1e239]
      - button "⤓ Export .mid" [disabled] [ref=f1e240]
      - generic [ref=f1e242]:
        - checkbox "Ghost key notes" [checked] [ref=f1e243]
        - text: Ghost key notes
      - generic "Keep the chord on the neck and mark its 3rd and 7th. A line shows their shortest step from the previous chord." [ref=f1e244]:
        - checkbox "Guide tones" [ref=f1e245]
        - text: Guide tones
    - group [ref=f1e246]:
      - generic "Voice leading weights" [ref=f1e247] [cursor=pointer]
  - generic "Scale and harmony reading" [ref=f1e248]:
    - generic [ref=f1e249]:
      - generic [ref=f1e250]: Scale
      - generic [ref=f1e251]: "1"
      - generic [ref=f1e252]: "2"
      - generic [ref=f1e253]: "3"
      - generic "The 4th (Eb) falls to D." [ref=f1e254]: "4"
      - generic [ref=f1e255]: "5"
      - generic [ref=f1e256]: "6"
      - generic "The 7th (A) rises to Bb." [ref=f1e257]: "7"
    - generic [ref=f1e258]:
      - generic [ref=f1e259]: Notes
      - generic [ref=f1e260]: Bb
      - generic [ref=f1e261]: C
      - generic [ref=f1e262]: D
      - generic [ref=f1e263]: Eb
      - generic [ref=f1e264]: F
      - generic [ref=f1e265]: G
      - generic [ref=f1e266]: A
    - paragraph [ref=f1e267]: Bb major.
    - paragraph [ref=f1e268]: The 4th (Eb) falls to D. The 7th (A) rises to Bb.
  - generic [ref=f1e269]:
    - group "Fretboard diagram" [ref=f1e271]:
      - generic [ref=f1e287]: Bb
      - generic [ref=f1e288]: Eb
      - generic [ref=f1e289]: Ab
      - generic [ref=f1e290]: Db
      - generic [ref=f1e291]: Gb
      - generic [ref=f1e292]: Bb
      - generic [ref=f1e293]: Eb
      - generic [ref=f1e294]: "0"
      - generic [ref=f1e295]: "1"
      - generic [ref=f1e296]: "2"
      - generic [ref=f1e297]: "3"
      - generic [ref=f1e298]: "4"
      - generic [ref=f1e299]: "5"
      - generic [ref=f1e300]: "6"
      - generic [ref=f1e301]: "7"
      - generic [ref=f1e302]: "8"
      - generic [ref=f1e303]: "9"
      - generic [ref=f1e304]: "10"
      - generic [ref=f1e305]: "11"
      - generic [ref=f1e306]: "12"
      - generic [ref=f1e307]: "13"
      - generic [ref=f1e308]: "14"
      - generic [ref=f1e309]: "15"
      - generic [ref=f1e310]: "16"
      - generic [ref=f1e311]: "17"
      - generic [ref=f1e312]: "18"
      - generic [ref=f1e313]: "19"
      - generic [ref=f1e314]: "20"
      - generic [ref=f1e315]: "21"
      - generic [ref=f1e316]: "22"
      - generic [ref=f1e317]: "23"
      - generic [ref=f1e318]: "24"
      - generic [ref=f1e319] [cursor=pointer]: Bb
      - generic [ref=f1e321] [cursor=pointer]: C
      - generic [ref=f1e323] [cursor=pointer]: D
      - generic [ref=f1e325] [cursor=pointer]: Eb
      - generic [ref=f1e327] [cursor=pointer]: F
      - generic [ref=f1e329] [cursor=pointer]: G
      - generic [ref=f1e331] [cursor=pointer]: A
      - generic [ref=f1e333] [cursor=pointer]: Bb
      - generic [ref=f1e335] [cursor=pointer]: C
      - generic [ref=f1e337] [cursor=pointer]: D
      - generic [ref=f1e339] [cursor=pointer]: Eb
      - generic [ref=f1e341] [cursor=pointer]: F
      - generic [ref=f1e343] [cursor=pointer]: G
      - generic [ref=f1e345] [cursor=pointer]: A
      - generic [ref=f1e347] [cursor=pointer]: Bb
      - generic [ref=f1e349] [cursor=pointer]: Eb
      - generic [ref=f1e351] [cursor=pointer]: F
      - generic [ref=f1e353] [cursor=pointer]: G
      - generic [ref=f1e355] [cursor=pointer]: A
      - generic [ref=f1e357] [cursor=pointer]: Bb
      - generic [ref=f1e359] [cursor=pointer]: C
      - generic [ref=f1e361] [cursor=pointer]: D
      - generic [ref=f1e363] [cursor=pointer]: Eb
      - generic [ref=f1e365] [cursor=pointer]: F
      - generic [ref=f1e367] [cursor=pointer]: G
      - generic [ref=f1e369] [cursor=pointer]: A
      - generic [ref=f1e371] [cursor=pointer]: Bb
      - generic [ref=f1e373] [cursor=pointer]: C
      - generic [ref=f1e375] [cursor=pointer]: D
      - generic [ref=f1e377] [cursor=pointer]: Eb
      - generic [ref=f1e379] [cursor=pointer]: A
      - generic [ref=f1e381] [cursor=pointer]: Bb
      - generic [ref=f1e383] [cursor=pointer]: C
      - generic [ref=f1e385] [cursor=pointer]: D
      - generic [ref=f1e387] [cursor=pointer]: Eb
      - generic [ref=f1e389] [cursor=pointer]: F
      - generic [ref=f1e391] [cursor=pointer]: G
      - generic [ref=f1e393] [cursor=pointer]: A
      - generic [ref=f1e395] [cursor=pointer]: Bb
      - generic [ref=f1e397] [cursor=pointer]: C
      - generic [ref=f1e399] [cursor=pointer]: D
      - generic [ref=f1e401] [cursor=pointer]: Eb
      - generic [ref=f1e403] [cursor=pointer]: F
      - generic [ref=f1e405] [cursor=pointer]: G
      - generic [ref=f1e407] [cursor=pointer]: D
      - generic [ref=f1e409] [cursor=pointer]: Eb
      - generic [ref=f1e411] [cursor=pointer]: F
      - generic [ref=f1e413] [cursor=pointer]: G
      - generic [ref=f1e415] [cursor=pointer]: A
      - generic [ref=f1e417] [cursor=pointer]: Bb
      - generic [ref=f1e419] [cursor=pointer]: C
      - generic [ref=f1e421] [cursor=pointer]: D
      - generic [ref=f1e423] [cursor=pointer]: Eb
      - generic [ref=f1e425] [cursor=pointer]: F
      - generic [ref=f1e427] [cursor=pointer]: G
      - generic [ref=f1e429] [cursor=pointer]: A
      - generic [ref=f1e431] [cursor=pointer]: Bb
      - generic [ref=f1e433] [cursor=pointer]: C
      - generic [ref=f1e435] [cursor=pointer]: G
      - generic [ref=f1e437] [cursor=pointer]: A
      - generic [ref=f1e439] [cursor=pointer]: Bb
      - generic [ref=f1e441] [cursor=pointer]: C
      - generic [ref=f1e443] [cursor=pointer]: D
      - generic [ref=f1e445] [cursor=pointer]: Eb
      - generic [ref=f1e447] [cursor=pointer]: F
      - generic [ref=f1e449] [cursor=pointer]: G
      - generic [ref=f1e451] [cursor=pointer]: A
      - generic [ref=f1e453] [cursor=pointer]: Bb
      - generic [ref=f1e455] [cursor=pointer]: C
      - generic [ref=f1e457] [cursor=pointer]: D
      - generic [ref=f1e459] [cursor=pointer]: Eb
      - generic [ref=f1e461] [cursor=pointer]: F
      - generic [ref=f1e463] [cursor=pointer]: Bb
      - generic [ref=f1e465] [cursor=pointer]: C
      - generic [ref=f1e467] [cursor=pointer]: D
      - generic [ref=f1e469] [cursor=pointer]: Eb
      - generic [ref=f1e471] [cursor=pointer]: F
      - generic [ref=f1e473] [cursor=pointer]: G
      - generic [ref=f1e475] [cursor=pointer]: A
      - generic [ref=f1e477] [cursor=pointer]: Bb
      - generic [ref=f1e479] [cursor=pointer]: C
      - generic [ref=f1e481] [cursor=pointer]: D
      - generic [ref=f1e483] [cursor=pointer]: Eb
      - generic [ref=f1e485] [cursor=pointer]: F
      - generic [ref=f1e487] [cursor=pointer]: G
      - generic [ref=f1e489] [cursor=pointer]: A
      - generic [ref=f1e491] [cursor=pointer]: Bb
      - generic [ref=f1e493] [cursor=pointer]: Eb
      - generic [ref=f1e495] [cursor=pointer]: F
      - generic [ref=f1e497] [cursor=pointer]: G
      - generic [ref=f1e499] [cursor=pointer]: A
      - generic [ref=f1e501] [cursor=pointer]: Bb
      - generic [ref=f1e503] [cursor=pointer]: C
      - generic [ref=f1e505] [cursor=pointer]: D
      - generic [ref=f1e507] [cursor=pointer]: Eb
      - generic [ref=f1e509] [cursor=pointer]: F
      - generic [ref=f1e511] [cursor=pointer]: G
      - generic [ref=f1e513] [cursor=pointer]: A
      - generic [ref=f1e515] [cursor=pointer]: Bb
      - generic [ref=f1e517] [cursor=pointer]: C
      - generic [ref=f1e519] [cursor=pointer]: D
      - generic [ref=f1e521] [cursor=pointer]: Eb
    - generic [ref=f1e523]:
      - paragraph [ref=f1e524]: 37 keys · C3–C6
      - group "37-key keyboard, C3–C6" [ref=f1e525]:
        - generic [ref=f1e526] [cursor=pointer]
        - generic [ref=f1e527] [cursor=pointer]
        - generic [ref=f1e528] [cursor=pointer]
        - generic [ref=f1e529] [cursor=pointer]
        - generic [ref=f1e530] [cursor=pointer]
        - generic [ref=f1e531] [cursor=pointer]
        - generic [ref=f1e532] [cursor=pointer]
        - generic [ref=f1e533] [cursor=pointer]
        - generic [ref=f1e534] [cursor=pointer]
        - generic [ref=f1e535] [cursor=pointer]
        - generic [ref=f1e536] [cursor=pointer]
        - generic [ref=f1e537] [cursor=pointer]
        - generic [ref=f1e538] [cursor=pointer]
        - generic [ref=f1e539] [cursor=pointer]
        - generic [ref=f1e540] [cursor=pointer]
        - generic [ref=f1e541] [cursor=pointer]
        - generic [ref=f1e542] [cursor=pointer]
        - generic [ref=f1e543] [cursor=pointer]
        - generic [ref=f1e544] [cursor=pointer]
        - generic [ref=f1e545] [cursor=pointer]
        - generic [ref=f1e546] [cursor=pointer]
        - generic [ref=f1e547] [cursor=pointer]
        - generic [ref=f1e548] [cursor=pointer]
        - generic [ref=f1e549] [cursor=pointer]
        - generic [ref=f1e550] [cursor=pointer]
        - generic [ref=f1e551] [cursor=pointer]
        - generic [ref=f1e552] [cursor=pointer]
        - generic [ref=f1e553] [cursor=pointer]
        - generic [ref=f1e554] [cursor=pointer]
        - generic [ref=f1e555] [cursor=pointer]
        - generic [ref=f1e556] [cursor=pointer]
        - generic [ref=f1e557] [cursor=pointer]
        - generic [ref=f1e558] [cursor=pointer]
        - generic [ref=f1e559] [cursor=pointer]
        - generic [ref=f1e560] [cursor=pointer]
        - generic [ref=f1e561] [cursor=pointer]
        - generic [ref=f1e562] [cursor=pointer]
        - generic: C
        - generic: D
        - generic: F
        - generic: G
        - generic: A
        - generic: C
        - generic: D
        - generic: F
        - generic: G
        - generic: A
        - generic: C
        - generic: D
        - generic: F
        - generic: G
        - generic: A
        - generic: C
        - generic: Eb
        - generic: Bb
        - generic: Eb
        - generic: Bb
        - generic: Eb
        - generic: Bb
        - generic [ref=f1e563]: C3
        - generic [ref=f1e564]: D
        - generic [ref=f1e565]: E
        - generic [ref=f1e566]: F
        - generic [ref=f1e567]: G
        - generic [ref=f1e568]: A
        - generic [ref=f1e569]: B
        - generic [ref=f1e570]: C4
        - generic [ref=f1e571]: D
        - generic [ref=f1e572]: E
        - generic [ref=f1e573]: F
        - generic [ref=f1e574]: G
        - generic [ref=f1e575]: A
        - generic [ref=f1e576]: B
        - generic [ref=f1e577]: C5
        - generic [ref=f1e578]: D
        - generic [ref=f1e579]: E
        - generic [ref=f1e580]: F
        - generic [ref=f1e581]: G
        - generic [ref=f1e582]: A
        - generic [ref=f1e583]: B
        - generic [ref=f1e584]: C6
    - generic [ref=f1e585]:
      - generic [ref=f1e586]:
        - group "Staff pitch" [ref=f1e587]:
          - button "Concert pitch" [pressed] [ref=f1e588] [cursor=pointer]
          - button "Guitar written" [ref=f1e589] [cursor=pointer]
        - paragraph [ref=f1e590]: Sounding pitch, on the grand staff.
      - 'img "Grand staff, 2 flats: Bb3 C4 D4 Eb4 F4 G4 A4 Bb4" [ref=f1e591]':
        - generic [ref=f1e593]: 𝄞
        - generic [ref=f1e594]: 𝄢
        - generic "Bb3" [ref=f1e615]:
          - generic [ref=f1e616] [cursor=pointer]
        - generic "C4" [ref=f1e617]:
          - generic [ref=f1e618] [cursor=pointer]
        - generic "D4" [ref=f1e619]:
          - generic [ref=f1e620] [cursor=pointer]
        - generic "Eb4" [ref=f1e621]:
          - generic [ref=f1e622] [cursor=pointer]
        - generic "F4" [ref=f1e623]:
          - generic [ref=f1e624] [cursor=pointer]
        - generic "G4" [ref=f1e625]:
          - generic [ref=f1e626] [cursor=pointer]
        - generic "A4" [ref=f1e627]:
          - generic [ref=f1e628] [cursor=pointer]
        - generic "Bb4" [ref=f1e629]:
          - generic [ref=f1e630] [cursor=pointer]
  - generic [ref=f1e631]:
    - generic [ref=f1e632]:
      - text: Bb Ionian (Major)
      - generic [ref=f1e633]: · Major
    - generic [ref=f1e634]:
      - generic [ref=f1e635]: Root
      - generic [ref=f1e637]: Scale tone
    - generic [ref=f1e639]:
      - generic [ref=f1e640]: Solid = diatonic
      - generic [ref=f1e642]: Dashed = borrowed
      - generic [ref=f1e644]: Gray = outside the key
```

# Test source

```ts
  1   | // Browser test for the grand staff in the built, portable HTML.
  2   | //
  3   | // Unit tests in src/music/staff.test.ts prove the pitch math. This file proves
  4   | // the page actually draws it: the Staff toggle exists, the SVG appears, lines,
  5   | // clefs, key signature and noteheads are where they should be, and nothing
  6   | // overlaps. Run `npm run build` first; this opens fretboard-visualizer.html.
  7   | 
  8   | import { test, expect, type Page, type Locator } from '@playwright/test';
  9   | import { pathToFileURL } from 'node:url';
  10  | import { resolve } from 'node:path';
  11  | 
  12  | // Playwright runs from the project root, where the build writes the file.
  13  | const PAGE = pathToFileURL(resolve(process.cwd(), 'fretboard-visualizer.html')).href;
  14  | 
  15  | interface Box { x: number; y: number; width: number; height: number }
  16  | 
  17  | async function bbox(loc: Locator): Promise<Box> {
  18  |   return loc.evaluate((el) => {
  19  |     const r = (el as SVGGraphicsElement).getBBox();
  20  |     return { x: r.x, y: r.y, width: r.width, height: r.height };
  21  |   });
  22  | }
  23  | 
  24  | function overlapY(a: Box, b: Box): number {
  25  |   return Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
  26  | }
  27  | 
  28  | async function openWithStaff(page: Page): Promise<Locator> {
  29  |   const errors: string[] = [];
  30  |   page.on('pageerror', (e) => errors.push(e.message));
  31  |   await page.goto(PAGE);
  32  |   // Fresh profile: the staff is off by default. Start from defaults every time.
  33  |   await page.evaluate(() => localStorage.clear());
  34  |   await page.goto(PAGE);
  35  |   const toggle = page.getByRole('button', { name: 'Staff', exact: true });
  36  |   await expect(toggle, 'Staff toggle is missing from the controls').toBeVisible();
  37  |   await toggle.click();
  38  |   const staff = page.locator('svg.staff');
  39  |   await expect(staff, 'clicking Staff did not draw the staff SVG').toBeVisible();
  40  |   expect(errors, 'page threw while drawing the staff').toEqual([]);
  41  |   return staff;
  42  | }
  43  | 
  44  | /** y of each staff line, top to bottom. */
  45  | async function lineYs(staff: Locator): Promise<number[]> {
  46  |   const ys = await staff.locator('line.staff-line').evaluateAll((ls) =>
  47  |     ls.map((l) => Number(l.getAttribute('y1'))),
  48  |   );
  49  |   return [...new Set(ys)].sort((a, b) => a - b);
  50  | }
  51  | 
  52  | test('default scale view draws a full grand staff', async ({ page }) => {
  53  |   const staff = await openWithStaff(page);
  54  | 
  55  |   const ys = await lineYs(staff);
  56  |   expect(ys, 'grand staff needs 10 lines (5 treble + 5 bass)').toHaveLength(10);
  57  | 
  58  |   const space = ys[1] - ys[0];
  59  |   for (let i = 1; i < 5; i++) expect(ys[i] - ys[i - 1]).toBeCloseTo(space, 0);
  60  |   for (let i = 6; i < 10; i++) expect(ys[i] - ys[i - 1]).toBeCloseTo(space, 0);
  61  | 
  62  |   // The two staves must read as two staves. Engraved grand staves sit about
  63  |   // 4 or more line-spaces apart; at 2 they fuse into one 10-line block.
  64  |   const gap = ys[5] - ys[4];
  65  |   expect(gap, `staves are only ${(gap / space).toFixed(1)} spaces apart`).toBeGreaterThanOrEqual(space * 4);
  66  | });
  67  | 
  68  | test('both clefs paint, sit on their own staff, and do not overlap', async ({ page }) => {
  69  |   const staff = await openWithStaff(page);
  70  |   const ys = await lineYs(staff);
  71  |   const treble = await bbox(staff.locator('.staff-clef-treble'));
  72  |   const bass = await bbox(staff.locator('.staff-clef-bass'));
  73  | 
  74  |   // A missing glyph in the fallback font gives a zero or tiny box.
  75  |   expect(treble.height, 'treble clef did not paint').toBeGreaterThan(20);
  76  |   expect(bass.height, 'bass clef did not paint').toBeGreaterThan(15);
  77  | 
> 78  |   expect(overlapY(treble, bass), 'treble and bass clefs overlap').toBe(0);
      |                                                                   ^ Error: treble and bass clefs overlap
  79  | 
  80  |   // Bass clef's centre sits inside the bass staff; treble's inside the treble.
  81  |   const bassMid = bass.y + bass.height / 2;
  82  |   expect(bassMid).toBeGreaterThan(ys[5]);
  83  |   expect(bassMid).toBeLessThan(ys[9]);
  84  |   const trebleMid = treble.y + treble.height / 2;
  85  |   expect(trebleMid).toBeGreaterThan(ys[0] - 10);
  86  |   expect(trebleMid).toBeLessThan(ys[4] + 10);
  87  | });
  88  | 
  89  | test('scale noteheads match the label and climb one step at a time', async ({ page }) => {
  90  |   const staff = await openWithStaff(page);
  91  |   const label = (await staff.getAttribute('aria-label')) ?? '';
  92  |   // e.g. "Grand staff, 2 flats: Bb3 C4 D4 Eb4 F4 G4 A4 Bb4"
  93  |   const names = label.split(':')[1]?.trim().split(/\s+/) ?? [];
  94  |   expect(names.length, `unexpected staff label "${label}"`).toBe(8);
  95  | 
  96  |   const heads = staff.locator('ellipse.staff-notehead');
  97  |   await expect(heads).toHaveCount(8);
  98  |   const cys = await heads.evaluateAll((hs) => hs.map((h) => Number(h.getAttribute('cy'))));
  99  |   const cxs = await heads.evaluateAll((hs) => hs.map((h) => Number(h.getAttribute('cx'))));
  100 | 
  101 |   const ys = await lineYs(staff);
  102 |   const half = (ys[1] - ys[0]) / 2;
  103 |   for (let i = 1; i < cys.length; i++) {
  104 |     expect(cxs[i], 'scale notes should run left to right').toBeGreaterThan(cxs[i - 1]);
  105 |     const rise = cys[i - 1] - cys[i];
  106 |     // Adjacent scale tones are one staff step apart, unless they cross the gap
  107 |     // between staves (B3 → C4 or similar), where the jump is larger.
  108 |     if (Math.abs(rise - half) > 0.5) {
  109 |       expect(rise, `${names[i - 1]} → ${names[i]} moved down`).toBeGreaterThan(0);
  110 |     }
  111 |   }
  112 | });
  113 | 
  114 | test('Bb major key signature: Bb on the treble middle line, Eb a 4th above', async ({ page }) => {
  115 |   const staff = await openWithStaff(page);
  116 |   const ys = await lineYs(staff);
  117 |   const label = (await staff.getAttribute('aria-label')) ?? '';
  118 |   test.skip(!label.includes('2 flats'), `default key changed: "${label}"`);
  119 | 
  120 |   // Every signature glyph is drawn as a .staff-ink group translated to its spot.
  121 |   const marks = await staff.locator('g.staff-ink').evaluateAll((gs) =>
  122 |     gs.map((g) => {
  123 |       const m = /translate\(([-\d.]+)[ ,]+([-\d.]+)\)/.exec(g.getAttribute('transform') ?? '');
  124 |       return m ? { x: Number(m[1]), y: Number(m[2]) } : null;
  125 |     }),
  126 |   );
  127 |   const spots = marks.filter((m): m is { x: number; y: number } => m !== null);
  128 |   // 2 flats on each staff, and nothing else printed with accidentals in Bb major.
  129 |   expect(spots.length, 'expected 4 signature flats (2 per staff)').toBe(4);
  130 | 
  131 |   const trebleMiddle = ys[2];
  132 |   const space = ys[1] - ys[0];
  133 |   const trebleFlats = spots.filter((s) => s.y < ys[4] + space).sort((a, b) => a.x - b.x);
  134 |   expect(trebleFlats).toHaveLength(2);
  135 |   // Order is Bb then Eb, so x grows.
  136 |   expect(trebleFlats[1].x).toBeGreaterThan(trebleFlats[0].x);
  137 |   // Eb5 sits a fourth (1.5 spaces) above Bb4; allow for the glyph's bowl offset.
  138 |   const dy = trebleFlats[0].y - trebleFlats[1].y;
  139 |   expect(dy).toBeCloseTo(space * 1.5, 0);
  140 |   expect(Math.abs(trebleFlats[0].y - trebleMiddle)).toBeLessThan(space);
  141 | });
  142 | 
  143 | test('chord view stacks the chord in one column', async ({ page }) => {
  144 |   const staff = await openWithStaff(page);
  145 |   await page.getByRole('button', { name: 'Chords', exact: true }).first().click();
  146 |   await page.getByRole('button', { name: 'I', exact: true }).first().click();
  147 |   await expect(staff).toHaveAttribute('aria-label', /: \S+ \S+ \S+/);
  148 |   const cxs = await staff.locator('ellipse.staff-notehead').evaluateAll((hs) =>
  149 |     hs.map((h) => Number(h.getAttribute('cx'))),
  150 |   );
  151 |   expect(cxs.length).toBeGreaterThanOrEqual(3);
  152 |   // Stacked: all heads share a column, except seconds pushed one head-width over.
  153 |   expect(Math.max(...cxs) - Math.min(...cxs)).toBeLessThan(20);
  154 | });
  155 | 
  156 | test('Guitar written collapses to one treble staff an octave up', async ({ page }) => {
  157 |   const staff = await openWithStaff(page);
  158 |   const before = (await staff.getAttribute('aria-label')) ?? '';
  159 |   await page.getByRole('button', { name: 'Guitar written', exact: true }).click();
  160 |   await expect(staff).toHaveAttribute('aria-label', /^Treble staff/);
  161 |   expect(await lineYs(staff)).toHaveLength(5);
  162 |   await expect(staff.locator('.staff-clef-eight')).toBeVisible();
  163 | 
  164 |   const octave = (s: string) => s.split(':')[1].trim().split(/\s+/).map((n) => Number(n.slice(-1)));
  165 |   const a = octave(before);
  166 |   const b = octave((await staff.getAttribute('aria-label')) ?? '');
  167 |   expect(b).toEqual(a.map((o) => o + 1));
  168 | });
  169 | 
  170 | test('screenshot for a human look', async ({ page }, info) => {
  171 |   const staff = await openWithStaff(page);
  172 |   await info.attach('grand-staff', { body: await staff.screenshot(), contentType: 'image/png' });
  173 | });
  174 | 
```