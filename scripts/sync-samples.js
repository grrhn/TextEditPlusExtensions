#!/usr/bin/env node
/**
 * Copies every sample-extensions/<slug>.zip into the catalog's expected
 * extensions/<slug>/extension.zip layout, then runs build-catalog.js.
 *
 * Run from the catalog repo root:
 *   node scripts/sync-samples.js
 *
 * Assumes sample extensions live alongside this repo at:
 *   ../sample-extensions/<slug>/{manifest.json,main.js,...}
 *   ../sample-extensions/<slug>.zip  (pre-packaged)
 */

const fs    = require('fs');
const path  = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const SAMPLES_DIR = path.resolve(ROOT, '..', 'sample-extensions');
const OUT_DIR = path.join(ROOT, 'extensions');

if (!fs.existsSync(SAMPLES_DIR)) {
    console.error(`Missing samples directory: ${SAMPLES_DIR}`);
    process.exit(1);
}

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const zips = fs.readdirSync(SAMPLES_DIR)
    .filter(f => f.endsWith('.zip'));

let copied = 0;
for (const zipName of zips) {
    const slug = zipName.replace(/\.zip$/, '');
    const srcZip = path.join(SAMPLES_DIR, zipName);
    const dstDir = path.join(OUT_DIR, slug);
    if (!fs.existsSync(dstDir)) fs.mkdirSync(dstDir, { recursive: true });
    fs.copyFileSync(srcZip, path.join(dstDir, 'extension.zip'));
    copied++;
    console.log(`✓ ${slug}`);
}

console.log(`\nCopied ${copied} extension ZIPs into ${OUT_DIR}\n`);
console.log('Now run: node scripts/build-catalog.js');
