// Gera dist/sw.js com a lista de arquivos do build (precache) e uma versão por conteúdo.
// Uso: node scripts/generate-sw.mjs [pasta=dist]
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const root = resolve(process.argv[2] ?? 'dist');
const SKIP = new Set(['sw.js', 'metadata.json']);

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const files = walk(root)
  .map((path) => relative(root, path).split('\\').join('/'))
  .filter((path) => !SKIP.has(path) && !path.endsWith('.map'))
  .sort();

const hash = createHash('sha256');
for (const file of files) hash.update(file).update(readFileSync(join(root, file)));
const version = hash.digest('hex').slice(0, 12);

const urls = files.map((file) => `/${file}`);
const template = readFileSync(new URL('./sw-template.js', import.meta.url), 'utf8');
const sw = template
  .replace('__VERSION__', version)
  .replace('__PRECACHE_URLS__', JSON.stringify(urls, null, 2));
writeFileSync(join(root, 'sw.js'), sw);
console.log(`sw.js gerado: versão ${version}, ${urls.length} arquivos no precache`);
