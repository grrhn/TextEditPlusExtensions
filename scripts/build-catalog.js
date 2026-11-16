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

function readZipEntry(zipPath, entryName) {
    try {
        return execSync(`tar -xf "${zipPath}" -O "${entryName}"`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
    } catch (_) {
        try {
            return execSync(`unzip -p "${zipPath}" "${entryName}"`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
        } catch (__) {
            return null;
        }
    }
}

function parseFrontmatter(md) {
    const lines = md.split(/\r?\n/);
    if (!lines.length || lines[0].trim() !== '---') return {};
    const end = lines.slice(1).findIndex(l => l.trim() === '---');
    if (end < 0) return {};
    const out = {};
    for (let i = 1; i <= end; i++) {
        const line = lines[i];
        const idx = line.indexOf(':');
        if (idx > 0 && !line.startsWith(' ') && !line.startsWith('\t')) {
            const k = line.slice(0, idx).trim().toLowerCase();
            const v = line.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
            if (v) out[k] = v;
        }
    }
    return out;
}

function readManifestFromZip(zipPath, slug) {
    const raw = readZipEntry(zipPath, 'manifest.json');
    if (raw) {
        return JSON.parse(raw);
    }
    const skillMd = readZipEntry(zipPath, 'SKILL.md');
    if (skillMd) {
        const fm = parseFrontmatter(skillMd);
        return {
            id: slug,
            name: fm.name || slug,
            version: '1.0.0',
            author: 'KRK',
            description: fm.description || `AI Skill pack (${slug})`,
            type: 'skill',
            category: 'skill'
        };
    }
    throw new Error(`Cannot read manifest.json or SKILL.md from ${zipPath}`);
}

function sha256(filePath) {
    const buf = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(buf).digest('hex');
}

const KNOWN_THEME_IDS = new Set(['dracula', 'github-dark', 'monokai', 'nord', 'one-dark-pro']);

function categoryFromManifest(m) {
    if (typeof m.category === 'string' && m.category.trim()) {
        return m.category.trim().toLowerCase();
    }
    if ((m.type || '').toLowerCase() === 'skill') return 'skill';
    const id = (m.id || '').toLowerCase();
    if (id.endsWith('-language') || id.endsWith('-syntax')) return 'language';
    if (id.includes('theme') || id.endsWith('-pro') || KNOWN_THEME_IDS.has(id)) return 'theme';
    if (id.startsWith('ai-') || (Array.isArray(m.permissions) && m.permissions.some(p => String(p).startsWith('ai.')))) {
        return 'ai';
    }
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

    const manifest = readManifestFromZip(zipPath, slug);
    const stat = fs.statSync(zipPath);

    const iconPath = ['icon.png', 'icon.jpg', 'icon.svg']
        .map(n => path.join(dir, n)).find(fs.existsSync);

    const category = categoryFromManifest(manifest);
    entries.push({
        id:          manifest.id,
        name:        manifest.name        || manifest.id,
        version:     manifest.version     || '1.0.0',
        author:      manifest.author      || '',
        description: manifest.description || '',
        type:        manifest.type        || (category === 'skill' ? 'skill' : 'extension'),
        category,
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
