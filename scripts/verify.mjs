import { readFile } from 'node:fs/promises';

const requiredFiles = ['index.html', 'styles.css', 'src/content.js', 'src/app.js', 'package.json', '.gitignore', 'render.yaml', 'docs/deployment.md', 'scripts/server.mjs', 'scripts/server-policy.mjs', 'scripts/server-path.mjs', 'scripts/ai-hot.mjs', 'scripts/github-hot.mjs', 'scripts/weibo-hot.mjs', 'scripts/music-status.mjs'];
const sceneIds = ['home', 'about', 'works', 'hot', 'interests', 'contact'];

async function read(path) {
  return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

const failures = [];

for (const file of requiredFiles) {
  try {
    await read(file);
  } catch {
    failures.push(`Missing required file: ${file}`);
  }
}

if (!failures.length) {
  const [html, css, content, app, server] = await Promise.all([
    read('index.html'),
    read('styles.css'),
    read('src/content.js'),
    read('src/app.js'),
    read('scripts/server.mjs'),
  ]);

  for (const sceneId of sceneIds) {
    if (!html.includes(`id="${sceneId}"`)) failures.push(`Missing scene: ${sceneId}`);
    if (!html.includes(`href="#${sceneId}"`)) failures.push(`Missing navigation link: ${sceneId}`);
  }

  for (const marker of ['id="hot-search-list"', 'id="site-soundtrack"', 'aria-label="播放背景音乐：开始懂了"']) {
    if (!html.includes(marker)) failures.push(`Missing interaction marker: ${marker}`);
  }

  if (!html.includes('aria-live="polite"')) failures.push('Live scene announcement is required');
  if (!html.includes('class="mobile-scene-nav"')) failures.push('Mobile scene controls are required');
  if (!html.includes('class="scene-directory"')) failures.push('Mobile navigation needs a complete scene directory');
  if (!html.includes('data-header-tone="light"')) failures.push('Light scenes must declare a contrasting header tone');
  if (!html.includes('data-bg-src=')) failures.push('Remote scene backgrounds must be lazy loaded');
  if (!html.includes('class="hot-search-status"')) failures.push('Hot search needs a visible freshness status');
  if (!html.includes('id="echo-work-title"') || !html.includes('data-music-link="landing"')) failures.push('Works must include Echo Music entry points');
  if (!app.includes("'/api/hot-search'")) failures.push('Hot search must load from the local API');
  if (!app.includes("params.set('refresh', '1')")) failures.push('Manual refresh must bypass the server cache');
  if (!app.includes('textContent')) failures.push('External hot search text must use safe text rendering');
  if (!app.includes("fetch('/api/music-status')")) failures.push('Echo Music availability must come from the local API');
  for (const origin of ['https://news.ycombinator.com', 'https://github.com', 'https://s.weibo.com']) {
    if (!app.includes(origin)) failures.push(`Trend links must allow only approved origin: ${origin}`);
  }
  if ((html.match(/class="trend-tab"/g) || []).length !== 3) failures.push('Trend scene must expose three source tabs');
  if (html.includes('hello@example.com')) failures.push('Placeholder contact details must not ship');
  if (!content.includes('export const siteContent')) failures.push('Content must be centralized');
  if (!app.includes('IntersectionObserver')) failures.push('Scene navigation must track scroll position');
  if (!app.includes('.slice(0, 6)')) failures.push('The visible AI hot list must be limited to six items');
  if (!app.includes("addEventListener('error'")) failures.push('Remote images need a load failure fallback');
  if (!server.includes("requestedPath === '/healthz'")) failures.push('Production server needs a health check');
  if (!server.includes("env.PORT || '4173'")) failures.push('Production server must respect PORT');
  if (!server.includes("env.HOST || '0.0.0.0'")) failures.push('Production server must listen on all interfaces by default');
  if (!server.includes('rateLimiter.consume')) failures.push('Manual hot search refresh needs rate limiting');
  if (!css.includes('scroll-snap-type')) failures.push('Scenes must use scroll snapping');
  if (!css.includes('prefers-reduced-motion')) failures.push('Reduced motion support is required');
}

if (failures.length) {
  console.error(failures.map((failure) => `- ${failure}`).join('\n'));
  process.exit(1);
}

console.log('Static verification passed.');
