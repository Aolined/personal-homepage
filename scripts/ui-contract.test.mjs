import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('ships nine ordered scenes including a single truthful works scene', async () => {
  const [html, content] = await Promise.all([read('index.html'), read('src/content.js')]);
  const ids = [...html.matchAll(/<section[^>]+data-scene="([^"]+)"/g)].map((match) => match[1]);

  assert.deepEqual(ids, ['home', 'about', 'works', 'hot', 'interests', 'timeline', 'gallery', 'notes', 'contact']);
  assert.match(content, /works:\s*'作品'/);
  assert.match(html, /Aolined Personal Scenes/);
});

test('mobile navigation exposes previous, current, next and the complete directory', async () => {
  const html = await read('index.html');

  assert.match(html, /class="mobile-scene-prev"/);
  assert.match(html, /class="mobile-scene-current"/);
  assert.match(html, /class="mobile-scene-next"/);
  assert.match(html, /class="mobile-directory-toggle"/);
  assert.equal((html.match(/class="directory-link"/g) || []).length, 9);
});

test('remote imagery declares lazy loading and application fallbacks', async () => {
  const [html, app] = await Promise.all([read('index.html'), read('src/app.js')]);

  assert.ok((html.match(/data-bg-src="https:\/\/images\.unsplash\.com/g) || []).length >= 4);
  assert.equal((html.match(/loading="lazy"/g) || []).length, 6);
  assert.equal((html.match(/decoding="async"/g) || []).length, 6);
  assert.match(app, /image-failed/);
  assert.match(app, /addEventListener\('error'/);
});

test('light scenes opt into contrasting fixed header controls and hot list shows six rows', async () => {
  const [html, app, css] = await Promise.all([read('index.html'), read('src/app.js'), read('styles.css')]);

  assert.ok((html.match(/data-header-tone="light"/g) || []).length >= 2);
  assert.match(app, /\.slice\(0, 6\)/);
  assert.match(css, /\.site-header\[data-tone=['"]?light/);
});
