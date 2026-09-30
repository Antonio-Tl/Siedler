// Baut dist/ – alle statischen Dateien für Cloudflare, in derselben Struktur wie beim Node-Server:
//   /            → client/
//   /shared/     → shared/
//   /vendor/three → nur die three.js-Dateien, die der Client wirklich lädt
// Wird von Wrangler automatisch vor „wrangler dev“ und „wrangler deploy“ ausgeführt.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const THREE = path.join(ROOT, 'node_modules/three');
const skip = (src) => !src.endsWith('.DS_Store');

function jsFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return jsFiles(p);
    return e.name.endsWith('.js') ? [p] : [];
  });
}

if (!fs.existsSync(THREE)) {
  console.error('node_modules/three fehlt – bitte zuerst „npm install“ ausführen.');
  process.exit(1);
}

fs.rmSync(DIST, { recursive: true, force: true });
fs.cpSync(path.join(ROOT, 'client'), DIST, { recursive: true, filter: skip });
fs.cpSync(path.join(ROOT, 'shared'), path.join(DIST, 'shared'), { recursive: true, filter: skip });

// three.js: Einstieg + alle „three/addons/…“-Importe des Clients, jeweils samt relativer Importe
const queue = ['build/three.module.js'];
for (const file of jsFiles(path.join(ROOT, 'client'))) {
  for (const [, p] of fs.readFileSync(file, 'utf8').matchAll(/from\s*['"]three\/addons\/([^'"]+)['"]/g)) {
    queue.push(`examples/jsm/${p}`);
  }
}
const copied = new Set();
while (queue.length) {
  const rel = queue.pop();
  if (copied.has(rel)) continue;
  copied.add(rel);
  const src = path.join(THREE, rel);
  const dest = path.join(DIST, 'vendor/three', rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  for (const [, p] of fs.readFileSync(src, 'utf8').matchAll(/(?:from|import)\s*\(?\s*['"](\.{1,2}\/[^'"]+)['"]/g)) {
    queue.push(path.posix.join(path.posix.dirname(rel), p));
  }
}

console.log(`dist/ gebaut (three.js: ${[...copied].join(', ')})`);
