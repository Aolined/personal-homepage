import { readFile } from 'node:fs/promises';

const requiredFiles = ['index.html', 'styles.css', 'src/content.js', 'src/app.js', 'package.json', '.gitignore', 'render.yaml', 'docs/deployment.md', 'scripts/server.mjs', 'scripts/server-policy.mjs', 'scripts/server-path.mjs', 'scripts/ai-hot.mjs'];
const sceneIds = ['home', 'about', 'works', 'hot', 'interests', 'timeline', 'gallery', 'notes', 'contact'];

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

  for (const marker of ['id="hot-search-list"', 'data-gallery', 'aria-label="切换环境声"', 'role="dialog"']) {
    if (!html.includes(marker)) failures.push(`Missing interaction marker: ${marker}`);
  }

  if (!html.includes('aria-live="polite"')) failures.push('Live scene announcement is required');
  if (!html.includes('class="mobile-scene-nav"')) failures.push('Mobile scene controls are required');
  if (!html.includes('class="scene-directory"')) failures.push('Mobile navigation needs a complete scene directory');
  if (!html.includes('data-header-tone="light"')) failures.push('Light scenes must declare a contrasting header tone');
  if (!html.includes('data-bg-src=')) failures.push('Remote scene backgrounds must be lazy loaded');
  if (!html.includes('loading="lazy"') || !html.includes('decoding="async"')) failures.push('Remote gallery images must use native lazy decoding');
  if (!html.includes('class="hot-search-status"')) failures.push('Hot search needs a visible freshness status');
  if ((html.match(/data-gallery=/g) || []).length < 6) failures.push('At least six gallery items are required');
  if ((html.match(/class="note-entry"/g) || []).length < 6) failures.push('At least six journal entries are required');
  if ((html.match(/class="timeline-entry(?:\s|")/g) || []).length < 5) failures.push('At least five timeline entries are required');
  if (!app.includes("'/api/hot-search'")) failures.push('Hot search must load from the local API');
  if (!app.includes("'/api/hot-search?refresh=1'")) failures.push('Manual refresh must bypass the server cache');
  if (!app.includes('textContent')) failures.push('External hot search text must use safe text rendering');
  if (!app.includes("url.origin === 'https://news.ycombinator.com'")) failures.push('AI links must be restricted to Hacker News');
  if (html.includes('微博')) failures.push('The hot scene should no longer describe Weibo data');
  if (html.includes('hello@example.com')) failures.push('Placeholder contact details must not ship');
  if (!content.includes('export const siteContent')) failures.push('Content must be centralized');
  if (!app.includes("event.key === 'Escape'")) failures.push('Escape must close the dialog');
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
