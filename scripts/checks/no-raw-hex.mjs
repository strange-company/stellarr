#!/usr/bin/env node
// Design-system golden rule: no raw hex colours in CSS modules. Colours come
// from tokens in ui/src/design/tokens.css (see .claude/rules/design-system.md).
//
//   no-raw-hex.mjs                 scan every ui/src/**/*.module.css
//   no-raw-hex.mjs <file>...       scan the given files (non-.module.css ignored)
//   no-raw-hex.mjs --self-test     prove the checker accepts and rejects
//
// Exit 1 and print file:line for every violation.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = 'ui/src';
const HEX = /(?<![\w&-])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![\w-])/g;

/** Returns [{ line, match }] for each raw hex colour outside comments. */
export function findHex(css) {
  // Blank out comments but keep newlines so line numbers stay correct.
  const stripped = css.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '));
  const hits = [];
  stripped.split('\n').forEach((text, i) => {
    for (const m of text.matchAll(HEX)) hits.push({ line: i + 1, match: m[0] });
  });
  return hits;
}

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === 'node_modules' ? [] : walk(path);
    return path.endsWith('.module.css') ? [path] : [];
  });
}

function scan(files) {
  let count = 0;
  for (const file of files.filter((f) => f.endsWith('.module.css'))) {
    for (const { line, match } of findHex(readFileSync(file, 'utf8'))) {
      count++;
      console.error(`${file}:${line}: raw hex colour ${match}; use a token from ui/src/design/tokens.css`);
    }
  }
  if (count) return 1;
  console.log(`no-raw-hex: ${files.length} file(s) clean`);
  return 0;
}

function selfTest() {
  const cases = [
    ['.a { color: #fff; }', 1],
    ['.a { color: #A1B2C3; }', 1],
    ['.a { background: #11223344; }', 1],
    ['.a { color: var(--color-primary); }', 0],
    ['/* was #ff0000, now tokenised */ .a { color: var(--accent); }', 0],
    ['.a { mask: url(#clip-path); }', 0],
    ['.a { color: rgba(0, 0, 0, 0.1); }', 0],
    ['.a {\n  color: var(--x);\n  border-color: #abc;\n}', 1],
  ];
  let bad = 0;
  for (const [css, expected] of cases) {
    const got = findHex(css).length;
    if (got !== expected) { bad++; console.error(`self-test: expected ${expected} hit(s) for ${JSON.stringify(css)}, got ${got}`); }
  }
  const multiline = findHex('.a {\n  color: var(--x);\n  border-color: #abc;\n}');
  if (multiline[0]?.line !== 3) { bad++; console.error('self-test: wrong line number for multi-line case'); }
  if (bad) return 1;
  console.log(`no-raw-hex: self-test passed (${cases.length} cases)`);
  return 0;
}

const args = process.argv.slice(2);
if (args[0] === '--self-test') process.exit(selfTest());
process.exit(scan(args.length ? args : walk(ROOT)));
