const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('defines an explicit Echo Music Web runtime', () => {
  const pkg = JSON.parse(read('package.json'));
  const webServer = read('scripts/web-server.js');
  const previewServer = read('scripts/preview-server.js');

  assert.equal(pkg.scripts.web, 'node scripts/web-server.js');
  assert.equal(pkg.scripts.preview, 'node scripts/preview-server.js');
  assert.match(webServer, /ECHO_RUNTIME\s*=\s*'web'/);
  assert.match(webServer, /127\.0\.0\.1/);
  assert.match(webServer, /4175/);
  assert.match(previewServer, /require\('\.\/web-server'\)/);
});

test('exposes a public guest runtime without exposing shared login controls', () => {
  const server = read('server.js');
  const html = read('public/index.html');
  const theme = read('public/echo-theme.css');

  assert.match(server, /PUBLIC_GUEST_MODE/);
  assert.match(server, /pn === '\/runtime-config\.js'/);
  assert.match(server, /pn === '\/healthz'/);
  assert.match(html, /src="\/runtime-config\.js"/);
  assert.match(html, /public-guest-runtime/);
  assert.match(theme, /html\.public-guest-runtime #user-btn/);
  assert.match(html, /window\.ECHO_PUBLIC_GUEST \? '访客音乐场'/);
  assert.match(html, /账号资料不会保存在服务器/);
  assert.match(theme, /openQishuiImport/);
  assert.match(server, /PUBLIC_MAX_AUDIO_STREAMS/);
});

test('serves the Echo Music site at root and keeps the player at /app', () => {
  const pkg = JSON.parse(read('package.json'));
  const server = read('server.js');
  const landing = read('public/landing.html');
  const landingCss = read('public/landing.css');

  assert.match(server, /WEB_RUNTIME \? '\/landing\.html' : '\/index\.html'/);
  assert.match(server, /pn === '\/app' \|\| pn === '\/app\/'/);
  assert.match(landing, /<title>Echo Music<\/title>/);
  assert.match(landing, /href="\/app"/);
  assert.match(landing, /id="signal-canvas"/);
  assert.match(landing, /src="\/echo-player-preview\.png"/);
  assert.match(landing, /id="versions"/);
  assert.match(landing, /网页版.*轻量体验/);
  assert.match(landing, /桌面版.*完整体验/);
  assert.match(landing, /桌面歌词、动态壁纸与全局快捷键/);
  assert.match(landingCss, /\.site-hero/);
  assert.ok(pkg.build.files.includes('public/**/*'));
});

test('adds responsive motion and pointer feedback to the Web entrance', () => {
  const landing = read('public/landing.html');
  const landingCss = read('public/landing.css');
  const landingJs = read('public/landing.js');

  assert.match(landing, /class="scroll-progress"/);
  assert.match(landingCss, /--pointer-x/);
  assert.match(landingCss, /\.reveal-ready\.is-visible/);
  assert.match(landingCss, /\.player-preview\.is-tilting/);
  assert.match(landingCss, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(landingJs, /IntersectionObserver/);
  assert.match(landingJs, /pointermove/);
  assert.match(landingJs, /requestAnimationFrame/);
});

test('exposes a real Windows installer download from the entrance page', () => {
  const landing = read('public/landing.html');
  const server = read('server.js');

  assert.match(landing, /href="\/download\/windows"/);
  assert.match(landing, /下载桌面版/);
  assert.match(server, /pn === '\/download\/windows'/);
  assert.match(server, /Content-Disposition/);
  assert.match(server, /Echo-Music-.*-Setup\.exe/);
});

test('limits Web proxy requests to known music media hosts', () => {
  const { isAllowedWebProxyUrl } = require('../scripts/web-runtime');

  assert.equal(isAllowedWebProxyUrl('https://m7.music.126.net/song.mp3', 'audio'), true);
  assert.equal(isAllowedWebProxyUrl('https://ws.stream.qqmusic.qq.com/song.m4a', 'audio'), true);
  assert.equal(isAllowedWebProxyUrl('https://p1.music.126.net/cover.jpg', 'cover'), true);
  assert.equal(isAllowedWebProxyUrl('https://y.gtimg.cn/music/photo.jpg', 'cover'), true);
  assert.equal(isAllowedWebProxyUrl('http://127.0.0.1:3000/private', 'audio'), false);
  assert.equal(isAllowedWebProxyUrl('http://169.254.169.254/latest/meta-data', 'cover'), false);
  assert.equal(isAllowedWebProxyUrl('file:///C:/Windows/win.ini', 'cover'), false);
  assert.equal(isAllowedWebProxyUrl('https://user:pass@music.126.net/song.mp3', 'audio'), false);
  assert.equal(isAllowedWebProxyUrl('https://example.com/open-proxy', 'audio'), false);
});

test('applies media proxy restrictions in desktop and requests bounded shelf covers', () => {
  const server = read('server.js');
  const html = read('public/index.html');

  assert.match(server, /if \(!coverUrl \|\| !isAllowedWebProxyUrl\(coverUrl, 'cover'\)\)/);
  assert.match(server, /if \(!audioUrl \|\| !isAllowedWebProxyUrl\(audioUrl, 'audio'\)\)/);
  assert.doesNotMatch(server, /WEB_RUNTIME && !isAllowedWebProxyUrl\((?:coverUrl|audioUrl), '(?:cover|audio)'\)/);
  assert.match(server, /MAX_COVER_PROXY_BYTES\s*=\s*3 \* 1024 \* 1024/);
  assert.match(server, /IMAGE_CONTENT_TYPE_RE\s*=\s*\/\^image\\\/\(\?:jpeg\|jpg\|png/);
  assert.match(html, /coverProxySrc\(coverUrlWithSize\(url, 512\)\)/);
});

test('adds browser security headers without changing desktop CORS behavior', () => {
  const { responseSecurityHeaders, runtimeMetadata } = require('../scripts/web-runtime');
  const webHeaders = responseSecurityHeaders(true);
  const desktopHeaders = responseSecurityHeaders(false);

  assert.equal(webHeaders['X-Content-Type-Options'], 'nosniff');
  assert.equal(webHeaders['X-Frame-Options'], 'DENY');
  assert.match(webHeaders['Content-Security-Policy'], /frame-ancestors 'none'/);
  assert.equal(webHeaders['Access-Control-Allow-Origin'], undefined);
  assert.equal(desktopHeaders['Access-Control-Allow-Origin'], '*');
  assert.deepEqual(runtimeMetadata(true).capabilities, {
    desktopLyrics: false,
    wallpaper: false,
    globalHotkeys: false,
    nativeFileDialogs: false,
    windowControls: false,
  });
});

test('marks browser-only UI and desktop-only controls', () => {
  const html = read('public/index.html');
  const theme = read('public/echo-theme.css');
  const server = read('server.js');

  assert.match(html, /classList\.add\('web-runtime'\)/);
  assert.match(html, /class="fx-toggle desktop-only-control" id="t-desktopLyrics"/);
  assert.match(html, /class="fx-section-label desktop-only-control">桌面 \/ 壁纸/);
  assert.match(theme, /html\.web-runtime \.desktop-only-control/);
  assert.match(server, /runtime:\s*runtimeMetadata\(WEB_RUNTIME, PUBLIC_GUEST_MODE\)/);
  assert.match(server, /\/api\/podcast\/dj-beatmap[\s\S]*!isAllowedWebProxyUrl\(audioUrl, 'audio'\)/);
});

test('keeps startup rendering bounded and avoids synchronous scene compilation', () => {
  const html = read('public/index.html');

  assert.match(html, /RENDER_VISIBLE_VSYNC\s*=\s*false/);
  assert.match(html, /RENDER_ACTIVE_FPS\s*=\s*45/);
  assert.match(html, /RENDER_LARGE_FPS\s*=\s*36/);
  assert.match(html, /RENDER_HUGE_FPS\s*=\s*30/);
  assert.match(html, /RENDER_INTERACTION_FPS\s*=\s*60/);
  assert.doesNotMatch(html, /renderer\.compile\(scene, camera\)/);
});

test('compresses text assets and applies explicit static cache policies', () => {
  const server = read('server.js');

  assert.match(server, /require\('node:zlib'\)/);
  assert.match(server, /'Vary':\s*'Accept-Encoding'/);
  assert.match(server, /Content-Encoding/);
  assert.match(server, /no-cache, must-revalidate/);
  assert.match(server, /public, max-age=604800/);
});

test('renders unavailable Web services without broken media or fake zero readings', () => {
  const html = read('public/index.html');
  const server = read('server.js');

  assert.match(html, /\.qr-shell\.qr-unavailable/);
  assert.match(html, /qrShell\.classList\.add\('qr-unavailable'\)/);
  assert.match(html, /qrImg\.removeAttribute\('src'\)/);
  assert.match(html, /var hasWeatherReading = weather && weather\.temperature != null/);
  assert.match(html, /weather\.humidity != null && isFinite\(Number\(weather\.humidity\)\)/);
  assert.doesNotMatch(html, /Math\.round\(weather\.temperature \|\| 0\)/);
  assert.match(server, /NETEASE_QR_KEY_UNAVAILABLE/);
  assert.match(server, /NETEASE_QR_CREATE_UNAVAILABLE/);
});

test('upgrades NetEase cover images to HTTPS before rendering cards', () => {
  const html = read('public/index.html');

  assert.match(html, /match\(\/\^http:\\\/\\\/\(p\\d\+\\\.music\\\.126\\\.net\)/);
  assert.match(html, /'https:\/\/' \+ host/);
});

test('renders playlist panel covers through the shared HTTPS cover helper', () => {
  const html = read('public/index.html');

  assert.match(html, /var thumb = pl\.cover \? coverUrlWithSize\(pl\.cover, 88\) : ''/);
  assert.match(html, /var cover = pl && pl\.cover \? coverUrlWithSize\(pl\.cover, 96\) : ''/);
  assert.doesNotMatch(html, /pl\.cover \+ '\?param=(?:88|96)y(?:88|96)'/);
});

test('keeps home mosaic cover art above the glass panel background', () => {
  const html = read('public/index.html');
  const theme = read('public/echo-theme.css');

  assert.match(html, /style\.setProperty\('--home-mosaic-cover'/);
  assert.match(html, /style\.removeProperty\('--home-mosaic-cover'\)/);
  assert.match(theme, /\.home-mosaic-cell\.has-cover\s*\{[^}]*background-image:\s*var\(--home-mosaic-cover\)\s*!important/);
  assert.match(theme, /\.home-mosaic-cell\.has-cover\s*\{[^}]*background-size:\s*cover\s*!important/);
});

test('keeps home recommendations above the visible player console', () => {
  const html = read('public/index.html');

  assert.match(html, /body\.empty-home-active\.controls-visible #empty-home\s*\{[^}]*bottom:\s*150px/);
  assert.match(html, /body\.empty-home-active\.controls-visible \.empty-home-shell\s*\{[^}]*grid-template-rows:\s*minmax\(0,2\.7fr\) minmax\(0,1\.3fr\)[^}]*overflow-y:\s*auto/);
  assert.match(html, /body\.empty-home-active\.controls-visible \.home-card\s*\{[^}]*min-height:\s*0/);
  assert.match(html, /body\.empty-home-active\.controls-visible \.home-tile\s*\{[^}]*min-height:\s*0[^}]*height:\s*100%/);
});

test('provides an explicit way to close the playlist panel', () => {
  const html = read('public/index.html');

  assert.match(html, /id="playlist-close-btn"[^>]*onclick="closePlaylistPanel\(\)"/);
  assert.match(html, /function closePlaylistPanel\(opts\)[\s\S]*setPlaylistPanelPinned\(false, true\)[\s\S]*setPeek\(panel, false, 'pl'\)/);
  assert.match(html, /function openHomeLibrary\(\)[\s\S]*queueViewTab === 'playlists'[\s\S]*closePlaylistPanel\(\)/);
});

test('keeps the login dialog inside short desktop and mobile viewports', () => {
  const theme = read('public/echo-theme.css');

  assert.match(theme, /#login-modal\s*\{[^}]*padding:/);
  assert.match(theme, /body\.desktop-shell #login-modal\s*\{[^}]*top:\s*44px/);
  assert.match(theme, /#login-modal \.dual-login-modal\s*\{[^}]*max-height:\s*100%[^}]*overflow-y:\s*auto/);
  assert.match(theme, /@media \(max-height:\s*760px\)[\s\S]*--login-qr-size:\s*clamp\(132px,24vh,176px\)/);
  assert.match(theme, /#login-modal \.qr-shell[^}]*width:\s*var\(--login-qr-size\)/);
});

test('lets users select browser location or a manual weather city', () => {
  const html = read('public/index.html');
  const server = read('server.js');

  assert.match(html, /onclick="locateWeatherRadio\(\)">使用当前位置<\/button>/);
  assert.match(html, /onclick="changeWeatherCity\(\)">更换城市<\/button>/);
  assert.match(html, /navigator\.geolocation\.getCurrentPosition/);
  assert.match(html, /\/api\/weather\/reverse-location\?lat=/);
  assert.match(html, /loc && \(loc\.name \|\| loc\.city\) \|\| '当前位置'/);
  assert.match(html, /useLocation\(latitude, longitude, '当前位置', timezone, '已使用当前位置'\)/);
  assert.match(html, /HOME_WEATHER_LOCATION_KEY/);
  assert.match(html, /localStorage\.removeItem\(HOME_WEATHER_LOCATION_KEY\)/);
  assert.match(html, /enableHighAccuracy:\s*true/);
  assert.match(html, /maximumAge:\s*2 \* 60 \* 1000/);
  assert.match(server, /pn === '\/api\/weather\/reverse-location'/);
  assert.match(server, /WEATHER_REVERSE_LOCATION_URL = 'https:\/\/api\.bigdatacloud\.net\/data\/reverse-geocode-client'/);
  assert.match(server, /family:\s*4/);
});

test('prefers a local China weather observation and keeps model fallback', () => {
  const server = read('server.js');
  const pkg = JSON.parse(read('package.json'));

  assert.match(server, /fetchChinaWeatherObservation/);
  assert.match(server, /applyChinaWeatherObservation/);
  assert.match(server, /weather\.provider = 'weather\.com\.cn\+open-meteo'/);
  assert.match(server, /console\.warn\('\[ChinaWeather\]'/);
  assert.ok(pkg.build.files.includes('scripts/china-weather.js'));
});
