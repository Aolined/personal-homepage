import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('ships six ordered scenes including a single truthful works scene', async () => {
  const [html, content] = await Promise.all([read('index.html'), read('src/content.js')]);
  const ids = [...html.matchAll(/<section[^>]+data-scene="([^"]+)"/g)].map((match) => match[1]);

  assert.deepEqual(ids, ['home', 'about', 'works', 'hot', 'interests', 'contact']);
  assert.match(content, /works:\s*'作品'/);
  assert.match(html, /Aolined Personal Scenes/);
});

test('works section contains the homepage, Echo Music and Format Workshop without adding another scene', async () => {
  const html = await read('index.html');

  assert.equal((html.match(/class="project-entry(?:\s|")/g) || []).length, 3);
  assert.match(html, /id="echo-work-title">Echo Music/);
  assert.match(html, /assets\/echo-music\/player-preview\.png/);
  assert.match(html, /id="format-work-title">格式工坊/);
  assert.match(html, /assets\/format-workshop\/workshop-preview\.png/);
  assert.match(html, /https:\/\/aolined-format-workshop\.onrender\.com/);
  assert.doesNotMatch(html, /data-scene="music"/);
});

test('mobile navigation exposes previous, current, next and the complete directory', async () => {
  const html = await read('index.html');

  assert.match(html, /class="mobile-scene-prev"/);
  assert.match(html, /class="mobile-scene-current"/);
  assert.match(html, /class="mobile-scene-next"/);
  assert.match(html, /class="mobile-directory-toggle"/);
  assert.equal((html.match(/class="directory-link"/g) || []).length, 6);
});

test('remote scene imagery declares lazy loading and application fallbacks', async () => {
  const [html, app] = await Promise.all([read('index.html'), read('src/app.js')]);

  assert.ok((html.match(/data-bg-src="https:\/\/images\.unsplash\.com/g) || []).length >= 4);
  assert.match(app, /image-failed/);
  assert.match(app, /addEventListener\('error'/);
});

test('light scenes opt into contrasting fixed header controls and hot list shows six rows', async () => {
  const [html, app, css] = await Promise.all([read('index.html'), read('src/app.js'), read('styles.css')]);

  assert.ok((html.match(/data-header-tone="light"/g) || []).length >= 1);
  assert.match(app, /\.slice\(0, 6\)/);
  assert.match(css, /\.site-header\[data-tone=['"]?light/);
});

test('trend scene exposes three accessible sources with source-specific safe links', async () => {
  const [html, app] = await Promise.all([read('index.html'), read('src/app.js')]);

  assert.equal((html.match(/class="trend-tab"/g) || []).length, 3);
  assert.match(html, /role="tablist"/);
  assert.match(html, /data-hot-source="ai"/);
  assert.match(html, /data-hot-source="github"/);
  assert.match(html, /data-hot-source="weibo"/);
  assert.match(app, /https:\/\/news\.ycombinator\.com/);
  assert.match(app, /https:\/\/github\.com/);
  assert.match(app, /https:\/\/s\.weibo\.com/);
});

test('ships a local looping soundtrack with autoplay fallback and saved preference', async () => {
  const [html, app] = await Promise.all([read('index.html'), read('src/app.js')]);

  assert.match(html, /<audio[^>]+id="site-soundtrack"[^>]+loop[^>]+preload="metadata"/);
  assert.match(html, /assets\/audio\/kaishi-dongle\.mp3/);
  assert.match(app, /site-soundtrack/);
  assert.match(app, /localStorage/);
  assert.match(app, /pointerdown/);
  assert.match(app, /keydown/);
  assert.match(app, /soundtrack\.play\(\)/);
  assert.doesNotMatch(app, /createOscillator/);
});
