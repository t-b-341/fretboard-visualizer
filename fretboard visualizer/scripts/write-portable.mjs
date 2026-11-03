import { copyFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(root, 'dist', 'index.html');
const target = join(root, 'fretboard-visualizer.html');

copyFileSync(source, target);
console.log('Wrote fretboard-visualizer.html');
console.log('Copy that file to another computer and open it in a browser.');
