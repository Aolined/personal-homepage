const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('packages the desktop app as Echo Music without the upstream updater', () => {
  const server = read('server.js');
  const signatureCheck = read('scripts/verify-signature.ps1');

  assert.equal(pkg.name, 'echo-music');
  assert.equal(pkg.productName, 'Echo Music');
  assert.equal(pkg.build.appId, 'com.echomusic.desktop');
  assert.equal(pkg.build.productName, 'Echo Music');
  assert.equal(pkg.build.win.executableName, 'EchoMusic');
  assert.notEqual(pkg.build.win.signAndEditExecutable, false);
  assert.equal(pkg.build.nsis.shortcutName, 'Echo Music');
  assert.match(pkg.build.nsis.artifactName, /^Echo-Music-/);
  assert.equal(pkg.build.publish, undefined);
  assert.equal(pkg.echo.update.enabled, false);
  assert.doesNotMatch(JSON.stringify(pkg.echo.update), /XxHuberrr|Mineradio/i);
  assert.match(server, /pkg && pkg\.echo && pkg\.echo\.update/);
  assert.equal(pkg.scripts['verify:signature'], 'powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify-signature.ps1');
  assert.match(signatureCheck, /Get-AuthenticodeSignature/);
  assert.match(signatureCheck, /Status -ne 'Valid'/);
});

test('uses Echo Music for the Electron runtime identity', () => {
  const main = read('desktop/main.js');
  const afterPack = read('build/after-pack.js');

  assert.match(main, /const APP_NAME = 'Echo Music';/);
  assert.match(main, /const APP_USER_MODEL_ID = 'com\.echomusic\.desktop';/);
  assert.match(afterPack, /ProductName', 'Echo Music'/);
  assert.doesNotMatch(afterPack, /ProductName', 'Mineradio'/);
});

test('keeps native maximize separate from immersive fullscreen', () => {
  const main = read('desktop/main.js');
  const html = read('public/index.html');

  assert.match(main, /function toggleMaximizedWindow\(win\)[\s\S]*win\.isMaximized\(\)[\s\S]*win\.unmaximize\(\)[\s\S]*win\.maximize\(\)/);
  assert.match(main, /ipcMain\.handle\('desktop-window-toggle-maximize',[\s\S]*toggleMaximizedWindow\(getSenderWindow\(event\)\)/);
  assert.doesNotMatch(main, /ipcMain\.handle\('desktop-window-toggle-maximize',[\s\S]{0,120}toggleFullscreen/);
  assert.match(html, /data-window-action="maximize" title="最大化" aria-label="最大化"/);
  assert.match(html, /if \(action === 'maximize'\) api\.toggleMaximize\(\)/);
  assert.match(html, /maxBtn\.title = isMaximized \? '还原' : '最大化'/);
});

test('renders the Echo Signal Stage brand surface', () => {
  const html = read('public/index.html');
  const theme = read('public/echo-theme.css');
  const lyrics = read('public/desktop-lyrics.html');
  const wallpaper = read('public/wallpaper.html');

  assert.match(html, /<title>Echo Music<\/title>/);
  assert.match(html, /href="echo-theme\.css"/);
  assert.match(html, /aria-label="Echo Music"/);
  assert.match(html, /class="splash-word-echo"/);
  assert.match(html, /id="home-weather-title"/);
  assert.match(html, /Echo Signal Stage/);
  assert.match(theme, /--echo-mint:\s*#38e0c1/i);
  assert.match(theme, /--echo-amber:\s*#f2b84b/i);
  assert.match(theme, /\.echo-signal-stage/);
  assert.match(lyrics, /<title>Echo Music Desktop Lyrics<\/title>/);
  assert.match(wallpaper, /<title>Echo Music Wallpaper<\/title>/);
});
