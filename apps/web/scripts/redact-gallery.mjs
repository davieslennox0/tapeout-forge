import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcPath = join(__dirname, '..', 'src', 'data', 'gallery.full.json');
const outPath = join(__dirname, '..', 'src', 'data', 'gallery.json');

const reveal = process.env.REVEAL_NETLISTS === 'true';
const full = JSON.parse(readFileSync(srcPath, 'utf8'));

const out = reveal
  ? full
  : full.map(({ netlistHex, calldata, ...rest }) => rest);

writeFileSync(outPath, JSON.stringify(out, null, 2));
console.log(`gallery.json written: REVEAL_NETLISTS=${reveal} (${out.length} rows${reveal ? '' : ', netlistHex/calldata stripped'})`);
