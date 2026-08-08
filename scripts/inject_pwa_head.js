#!/usr/bin/env node
/**
 * Patches dist/index.html after `expo export --platform web` with the
 * meta/link tags iOS Safari needs for "Add to Home Screen" to launch
 * full-screen instead of as a bookmarked tab, plus the PWA manifest link.
 *
 * A custom src/app/+html.tsx would be the "proper" way to do this, but
 * that only takes effect in Expo Router's `web.output: "static"` mode,
 * which tries to server-render every route at build time and breaks on
 * this app's live-data-fetching screens. Patching the exported HTML
 * directly sidesteps that entirely and is far more reliable.
 */
const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, '..', 'dist', 'index.html');

if (!fs.existsSync(indexPath)) {
  console.error(`inject_pwa_head: ${indexPath} not found — did the web export run first?`);
  process.exit(1);
}

let html = fs.readFileSync(indexPath, 'utf8');

if (html.includes('apple-mobile-web-app-capable')) {
  console.log('inject_pwa_head: tags already present, skipping.');
  process.exit(0);
}

const tags = `
    <meta name="theme-color" content="#0a0e14" />
    <meta name="description" content="Scans crypto, stocks, and ETFs for support/resistance channels and calls out BUY/SELL/WATCH signals." />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="apple-mobile-web-app-title" content="Channel Scanner" />
    <link rel="apple-touch-icon" href="icon.png" />
    <link rel="icon" href="icon.png" />
    <link rel="manifest" href="manifest.json" />
  </head>`;

html = html.replace('</head>', tags);
fs.writeFileSync(indexPath, html);
console.log('inject_pwa_head: PWA meta tags injected into dist/index.html');
