const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const publicDir = path.join(root, 'public');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('keeps package metadata and packaged file entries consistent', () => {
  const pkg = JSON.parse(read('package.json'));
  const lock = JSON.parse(read('package-lock.json'));

  assert.equal(lock.name, pkg.name);
  assert.equal(lock.version, pkg.version);
  assert.equal(lock.packages[''].name, pkg.name);
  assert.equal(lock.packages[''].version, pkg.version);

  const explicitFiles = pkg.build.files.filter((entry) => !entry.startsWith('!') && !entry.includes('*'));
  for (const entry of explicitFiles) {
    assert.ok(fs.existsSync(path.join(root, entry)), `Missing packaged file: ${entry}`);
  }
});

test('parses every inline script in the main page', () => {
  const html = read('public/index.html');
  const scriptPattern = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  let index = 0;

  while ((match = scriptPattern.exec(html))) {
    if (!match[1].trim()) continue;
    index += 1;
    new vm.Script(match[1], { filename: `public/index.html:inline-${index}` });
  }

  assert.ok(index > 0, 'Expected at least one inline script');
});

test('has unique element IDs and valid local resource references', () => {
  const html = read('public/index.html');
  const markup = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
  const ids = [...markup.matchAll(/\bid\s*=\s*["']([^"']+)["']/g)].map((match) => match[1]);
  const duplicateIds = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];

  assert.deepEqual(duplicateIds, [], `Duplicate element IDs: ${duplicateIds.join(', ')}`);

  const resourceTags = markup.match(/<(?:audio|img|link|source|video)\b[^>]*>/gi) || [];
  resourceTags.push(...(html.match(/<script\b[^>]*\bsrc\s*=\s*["'][^"']+["'][^>]*><\/script>/gi) || []));
  const references = resourceTags
    .flatMap((tag) => [...tag.matchAll(/\b(?:href|src)\s*=\s*["']([^"']+)["']/gi)])
    .map((match) => match[1])
    .filter((reference) => !/^(?:[a-z]+:|#|\/\/)/i.test(reference))
    .filter((reference) => !reference.includes('${'));

  const missing = references.filter((reference) => {
    const localPath = reference.split(/[?#]/, 1)[0].replace(/^\//, '');
    if (localPath === 'runtime-config.js') return false;
    return localPath && !fs.existsSync(path.join(publicDir, localPath));
  });

  assert.deepEqual([...new Set(missing)], [], `Missing local resources: ${missing.join(', ')}`);
});
