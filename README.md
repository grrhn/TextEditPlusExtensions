# TextEdit+ Extension Catalog

Static catalog consumed by the TextEdit+ in-app extension store. Hosting:
plain GitHub repo served via `raw.githubusercontent.com` — no backend
needed.

## Layout

```
extension-catalog/
├── catalog.json          ← generated, the manifest TextEdit+ fetches
├── extensions/
│   ├── one-dark-pro/
│   │   ├── extension.zip
│   │   ├── icon.png         (optional)
│   │   ├── README.md        (optional)
│   │   └── screenshots/     (optional PNG/JPG/WEBP previews)
│   │       └── preview.png
│   ├── toml-language/
│   └── …
└── scripts/
    ├── sync-samples.js   ← copy sample-extensions/*.zip into the layout
    └── build-catalog.js  ← scan extensions/, compute SHA-256, emit catalog.json
```

## First-time setup

1. Copy the latest sample ZIPs in:

   ```
   node scripts/sync-samples.js
   ```

2. Generate the catalog:

   ```
   CATALOG_BASE_URL=https://raw.githubusercontent.com/<you>/<repo>/main \
     node scripts/build-catalog.js
   ```

3. Commit + push. TextEdit+ pulls `catalog.json` from the repo's raw URL.

## Adding a third-party extension

Drop the ZIP into `extensions/<slug>/extension.zip`, optionally add `icon.png`
and `README.md`, then run `build-catalog.js`. Catalog entries are sorted
alphabetically by `name`.

## Schema (catalog.json)

```json
{
  "schema": 1,
  "generatedAt": "2026-05-16T19:00:00Z",
  "baseUrl": "https://raw.githubusercontent.com/<you>/<repo>/main",
  "extensions": [
    {
      "id":          "one-dark-pro",
      "name":        "One Dark Pro",
      "version":     "1.0.0",
      "author":      "KRK",
      "description": "Atom's iconic One Dark Pro theme.",
      "type":        "extension",
      "category":    "theme",
      "downloadUrl": "…/extensions/one-dark-pro/extension.zip",
      "iconUrl":     "…/extensions/one-dark-pro/icon.png",
      "readmeUrl":   "…/extensions/one-dark-pro/README.md",
      "screenshots": ["…/extensions/one-dark-pro/screenshots/preview.png"],
      "permissions": [],
      "sizeBytes":   937,
      "sha256":      "abc123…",
      "premium":     false,
      "publishedAt": "2026-05-16T19:00:00Z",
      "updatedAt":   "2026-05-16T19:00:00Z"
    }
  ]
}
```

Integrity: clients verify `sha256` of the downloaded ZIP against the value
in `catalog.json` and refuse to install on mismatch.
