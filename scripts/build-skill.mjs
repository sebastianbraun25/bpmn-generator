#!/usr/bin/env node
import { readdirSync, statSync, unlinkSync } from 'fs';
import { join, relative, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');
const outName = 'bpmn-generator-v3.skill';
const outPath = join(repoRoot, outName);

// Inclusion rules: SKILL.md + scripts/*.js (no tests, no agents/, no robustness/, no node_modules)
//                  + scripts/config.json + scripts/package.json
//                  + references/*.md + references/*.json (no omg-spec/, no review-set/)
// NOTE (local patch): the upstream `/segment/` substring checks assume POSIX paths and
// silently never match on Windows (backslash-separated paths), which lets node_modules/
// leak into the zip file list and blows past the Windows command-line length limit.
// hasSegment() splits on both separators so the exclusion works on every platform.
function hasSegment(full, seg) {
  return full.split(/[\\/]/).includes(seg);
}

const includes = [
  'SKILL.md',
  ...walk(join(repoRoot, 'scripts'), (full, name) => {
    if (hasSegment(full, 'node_modules')) return false;
    if (hasSegment(full, 'agents') || hasSegment(full, 'robustness')) return false;
    if (name.endsWith('.test.js')) return false;
    // Note: build-skill.mjs is intentionally excluded by the `.js`-only rule (not `.mjs`).
    return name.endsWith('.js') || name === 'config.json' || name === 'package.json';
  }).map(f => relative(repoRoot, f)),
  ...walk(join(repoRoot, 'references'), (full, name) => {
    if (hasSegment(full, 'omg-spec') || hasSegment(full, 'review-set')) return false;
    return name.endsWith('.md') || name.endsWith('.json');
  }).map(f => relative(repoRoot, f)),
];

function walk(dir, filter, acc = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, filter, acc);
    else if (filter(full, entry)) acc.push(full);
  }
  return acc;
}

const args = ['-r', outPath, ...includes];
try { unlinkSync(outPath); } catch (e) { if (e.code !== 'ENOENT') throw e; }
execFileSync('zip', args, { cwd: repoRoot, stdio: 'inherit' });
console.log(`\nBuilt ${outName} (${includes.length} files).`);
console.log(`Inspect: unzip -l ${outName}`);
