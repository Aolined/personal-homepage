import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('ships six ordered scenes including a single truthful works scene', async () => {
  const [html, content] = await Promise.all([read('index.html'), read('src/content.js')]);
  const ids = [...html.matchAll(/<section[^>]+data-scene="([^"]+)"/g)].map((match) => match[1]);

  assert.deepEqual(ids, ['home', 'about', 'works', 'hot', 'interests', 'contact']);
  assert.match(content, /works:\s*'作品'/);
  assert.match(html, /Aolined Personal Scenes/);
});

test('works section contains all four real projects without adding another scene', async () => {
  const html = await read('index.html');

  assert.equal((html.match(/class="project-entry(?:\s|")/g) || []).length, 4);
  assert.match(html, /Aolined Personal Scenes/);
  assert.match(html, /id="echo-work-title">Echo Music/);
  assert.match(html, /assets\/echo-music\/player-preview\.png/);
  assert.match(html, /id="format-work-title">格式工坊/);
  assert.match(html, /assets\/format-workshop\/workshop-preview\.png/);
  assert.match(html, /https:\/\/aolined-format-workshop\.onrender\.com/);
  assert.match(html, /id="indie-work-title">作品星图/);
  assert.match(html, /Maker Constellation/);
  assert.match(html, /中国独立开发者作品发现目录/);
  assert.match(html, /状态与城市筛选/);
  assert.match(html, /原项目访问/);
  assert.match(html, /不托管项目代码/);
  assert.match(html, /https:\/\/aolined\.github\.io\/indie-explorer\//);
  assert.match(html, /assets\/indie-explorer\/indie-preview\.png/);
  assert.doesNotMatch(html, /data-scene="music"/);
});

test('works section exposes an accessible four-project orbital index', async () => {
  const [html, app, css] = await Promise.all([read('index.html'), read('src/app.js'), read('styles.css')]);

  assert.match(html, /class="works-constellation"/);
  assert.match(html, /class="constellation-lines"[^>]+aria-hidden="true"/);
  assert.match(html, /class="orbital-track"/);
  assert.match(html, /src="assets\/personal-scenes-preview\.png"/);
  assert.doesNotMatch(html, /project-entry__visual--monogram/);
  assert.match(html, /role="tablist"[^>]+aria-label="作品星图"/);
  assert.equal((html.match(/class="work-star[^"]*"[^>]+role="tab"/g) || []).length, 4);
  assert.equal((html.match(/class="project-entry[^"]*"[^>]+role="tabpanel"/g) || []).length, 4);
  assert.match(html, /class="work-selection-status"[^>]+aria-live="polite"/);
  assert.match(app, /function setActiveWork/);
  assert.match(app, /ArrowRight/);
  assert.match(app, /ArrowLeft/);
  assert.match(app, /workStatus\.textContent/);
  assert.match(css, /\.work-star\[aria-selected="true"\]/);
  assert.equal((html.match(/class="orbital-track"/g) || []).length, 1);
  assert.doesNotMatch(html, /constellation-route--/);
  assert.match(css, /data-active-work="homepage"/);
  assert.match(css, /data-active-work="indie"/);
  assert.match(css, /--work-color:/);
  assert.match(css, /\.work-star:not\(\[aria-selected="true"\]\) \.work-star__point/);
  assert.match(css, /grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.doesNotMatch(css, /background-size:64px 64px/);
  assert.doesNotMatch(css, /\.works-constellation::before,.works-constellation::after/);
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)[\s\S]*?\.project-entry/);
});

test('Indie Explorer preview is a real local image asset', async () => {
  const preview = await stat(new URL('../assets/indie-explorer/indie-preview.png', import.meta.url));
  assert.ok(preview.isFile());
  assert.ok(preview.size > 50_000);
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
