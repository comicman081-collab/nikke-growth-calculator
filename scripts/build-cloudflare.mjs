import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const sourceDir = path.resolve('public');
const outDir = path.resolve('dist-cloudflare');
const assetsDir = path.join(outDir, 'assets');

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(assetsDir, { recursive: true });

for (const name of fs.readdirSync(sourceDir)) {
  if (name === 'index.html' || name === '_headers' || name === '_routes.json') continue;
  fs.cpSync(path.join(sourceDir, name), path.join(outDir, name), { recursive: true });
}

let html = fs.readFileSync(path.join(sourceDir, 'index.html'), 'utf8');
const seen = new Map();
const extFor = new Map([
  ['image/webp', 'webp'],
  ['image/png', 'png'],
  ['image/jpeg', 'jpg'],
  ['audio/mp4', 'm4a'],
  ['audio/mpeg', 'mp3'],
  ['audio/ogg', 'ogg'],
]);

html = html.replace(/data:([\w.+-]+\/[\w.+-]+);base64,([A-Za-z0-9+/=]+)/g, (full, mime, encoded) => {
  const bytes = Buffer.from(encoded, 'base64');
  const hash = crypto.createHash('sha256').update(bytes).digest('hex').slice(0, 16);
  const key = `${mime}:${hash}`;
  let publicPath = seen.get(key);
  if (!publicPath) {
    const ext = extFor.get(mime) || 'bin';
    const filename = `embedded-${hash}.${ext}`;
    fs.writeFileSync(path.join(assetsDir, filename), bytes);
    publicPath = `/assets/${filename}`;
    seen.set(key, publicPath);
    console.log(`${mime} -> ${publicPath} (${bytes.length} bytes)`);
  }
  return publicPath;
});

fs.writeFileSync(path.join(outDir, 'index.html'), html);
const htmlSize = fs.statSync(path.join(outDir, 'index.html')).size;
if (htmlSize > 5 * 1024 * 1024) throw new Error(`Cloudflare index.html still exceeds 5MiB: ${htmlSize}`);
if (/data:(?:image|audio)\//.test(html)) throw new Error('Embedded image/audio data URI remained in Cloudflare HTML');

const assetFiles = fs.readdirSync(assetsDir);
if (!assetFiles.length) throw new Error('No embedded media assets were extracted');
for (const file of assetFiles) {
  const size = fs.statSync(path.join(assetsDir, file)).size;
  if (size > 5 * 1024 * 1024) throw new Error(`${file} exceeds Cloudflare 5MiB asset limit`);
}

console.log(`Cloudflare build ready: index=${htmlSize} bytes, extracted assets=${assetFiles.length}`);
