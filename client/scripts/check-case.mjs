// Fails if two files in src/ differ only by letter case or extension (e.g. AuthContext.jsx vs
// authContext.js). Linux treats them as different; Windows and macOS don't, and an import can then
// silently resolve to the wrong file (blank page).
import { readdirSync, statSync } from 'node:fs';
import { join, parse } from 'node:path';

const seen = new Map();
const clashes = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) { walk(p); continue; }
    const key = join(dir, parse(name).name).toLowerCase();
    if (seen.has(key)) clashes.push(`${seen.get(key)}  <->  ${p}`);
    else seen.set(key, p);
  }
})('src');

if (clashes.length) {
  console.error('Files that collide on Windows/macOS (rename one):\n  ' + clashes.join('\n  '));
  process.exit(1);
}
console.log('check-case: ok');
