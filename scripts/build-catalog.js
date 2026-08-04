#!/usr/bin/env node
/**
 * Builds catalog.json from every <extension>.zip in the project root.
 *
 * Each zip is expected to contain a manifest.json. The script:
 *   1. Reads the manifest to extract metadata.
 *   2. Computes file size + SHA-256.
 *   3. Emits a catalog.json entry keyed by manifest.id.
 *
 * Run from the catalog repo root:
 *   node scripts/build-catalog.js
 *
 * Expected layout AFTER you copy ZIPs into this repo:
 *   extension-catalog/
 *   ├── catalog.json              (generated)
 *   ├── extensions/
 *   │   ├── one-dark-pro/
 *   │   │   ├── extension.zip
 *   │   │   └── icon.png          (optional)
 *   │   ├── toml-language/
 *   │   └── ...
 *   └── scripts/build-catalog.js
 *
 * Set CATALOG_BASE_URL to the raw.githubusercontent.com URL for your repo,
 * e.g. https://raw.githubusercontent.com/grrhn/TextEditPlusExtensions/main
 */

const fs    = require('fs');
const path  = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

const BASE_URL = process.env.CATALOG_BASE_URL ||
    'https://raw.githubusercontent.com/grrhn/TextEditPlusExtensions/main';

const ROOT = path.resolve(__dirname, '..');
const EXT_DIR = path.join(ROOT, 'extensions');

function readManifestFromZip(zipPath) {
    try {
        // Try tar -xf first (available on Windows 10/11, macOS, Linux)
        const out = execSync(`tar -xf "${zipPath}" -O manifest.json`, { encoding: 'utf8' });
        return JSON.parse(out);
    } catch (_) {
        try {
            const out = execSync(`unzip -p "${zipPath}" manifest.json`, { encoding: 'utf8' });
            return JSON.parse(out);
        } catch (e) {
            throw new Error(`Cannot read manifest.json from ${zipPath}: ${e.message}`);
        }
    }
}

function sha256(filePath) {
    const buf = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(buf).digest('hex');
}

function categoryFromManifest(m) {
    // Trivial heuristic: id "<noun>-language" => language, ends in "theme" => theme.
    const id = (m.id || '').toLowerCase();
    if (id.endsWith('-language') || id.endsWith('-syntax')) return 'language';
    if (id.includes('theme') || id.includes('-pro')) return 'theme';
    if (id.startsWith('ai-')) return 'ai';
    return 'tool';
}

const entries = [];
if (!fs.existsSync(EXT_DIR)) {
    console.error(`Missing ${EXT_DIR} — create it and drop one folder per extension.`);
    process.exit(1);
}

for (const slug of fs.readdirSync(EXT_DIR)) {
    const dir = path.join(EXT_DIR, slug);
    if (!fs.statSync(dir).isDirectory()) continue;

    const zipPath = path.join(dir, 'extension.zip');
    if (!fs.existsSync(zipPath)) {
        console.warn(`Skipping ${slug}: extension.zip not found`);
        continue;
    }

    const manifest = readManifestFromZip(zipPath);
    const stat = fs.statSync(zipPath);

    const iconPath = ['icon.png', 'icon.jpg', 'icon.svg']
        .map(n => path.join(dir, n)).find(fs.existsSync);

    entries.push({
        id:          manifest.id,
        name:        manifest.name        || manifest.id,
        version:     manifest.version     || '1.0.0',
        author:      manifest.author      || '',
        description: manifest.description || '',
        category:    categoryFromManifest(manifest),
        downloadUrl: `${BASE_URL}/extensions/${slug}/extension.zip`,
        iconUrl:     iconPath ? `${BASE_URL}/extensions/${slug}/${path.basename(iconPath)}` : null,
        readmeUrl:   fs.existsSync(path.join(dir, 'README.md'))
                       ? `${BASE_URL}/extensions/${slug}/README.md` : null,
        sizeBytes:   stat.size,
        sha256:      sha256(zipPath),
        premium:     manifest.premium === true,
        publishedAt: new Date(stat.birthtimeMs || stat.ctimeMs).toISOString(),
        updatedAt:   new Date(stat.mtimeMs).toISOString()
    });
}

entries.sort((a, b) => a.name.localeCompare(b.name));

const catalog = {
    schema: 1,
    generatedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    extensions: entries
};

const out = path.join(ROOT, 'catalog.json');
fs.writeFileSync(out, JSON.stringify(catalog, null, 2) + '\n', 'utf8');
console.log(`Wrote ${out} (${entries.length} extensions)`);
