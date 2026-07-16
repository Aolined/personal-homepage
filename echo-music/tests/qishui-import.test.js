const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  extractQishuiShareUrl,
  isAllowedQishuiShareUrl,
  parseQishuiShareHtml,
  pickBestImportedSong,
  scoreImportedSongMatch,
} = require('../scripts/qishui-import');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('accepts official Qishui short and share URLs only', () => {
  assert.equal(
    extractQishuiShareUrl('我正在汽水音乐听歌 https://qishui.douyin.com/s/AbCd123/ 一起听'),
    'https://qishui.douyin.com/s/AbCd123/'
  );
  assert.equal(isAllowedQishuiShareUrl('https://qishui.douyin.com/s/AbCd123/'), true);
  assert.equal(isAllowedQishuiShareUrl('https://music.douyin.com/qishui/share/track?track_id=123'), true);
  assert.equal(isAllowedQishuiShareUrl('https://music.douyin.com/qishui/share/playlist?id=123'), true);
  assert.equal(isAllowedQishuiShareUrl('https://evil.example/?next=https://qishui.douyin.com/s/a'), false);
  assert.equal(isAllowedQishuiShareUrl('https://qishui.douyin.com.evil.example/s/a'), false);
  assert.equal(isAllowedQishuiShareUrl('http://127.0.0.1/qishui/share/track'), false);
});

test('parses a single track from Qishui router data', () => {
  const html = `
    <meta property="og:title" content="落日飞车 - My Jinji">
    <script>_ROUTER_DATA = {"loaderData":{"track_page":{"trackInfo":{"id":"qs-1","name":"My Jinji","artistName":"落日飞车","albumName":"Cassa Nova","coverURL":"https://p3-luna.douyinpic.com/cover.jpg"}}},"errors":null};</script>
  `;
  const parsed = parseQishuiShareHtml(html, 'https://music.douyin.com/qishui/share/track?track_id=qs-1', '');

  assert.equal(parsed.kind, 'track');
  assert.equal(parsed.tracks.length, 1);
  assert.deepEqual(parsed.tracks[0], {
    id: 'qs-1',
    name: 'My Jinji',
    artist: '落日飞车',
    album: 'Cassa Nova',
    cover: 'https://p3-luna.douyinpic.com/cover.jpg',
  });
});

test('parses playlist media tracks and removes duplicates', () => {
  const html = `
    <script>_ROUTER_DATA = {"loaderData":{"playlist_page":{"playlistInfo":{"name":"夜间列车"},"medias":[
      {"entity":{"track":{"id":"a","name":"Intro","artists":[{"name":"Echo A"}],"album":{"name":"First","coverUrl":"https://p3-luna.douyinpic.com/a.jpg"}}}},
      {"entity":{"track":{"id":"b","name":"Signal","artists":[{"name":"Echo B"}]}}},
      {"entity":{"track":{"id":"a","name":"Intro","artists":[{"name":"Echo A"}]}}}
    ]}},"errors":null};</script>
  `;
  const parsed = parseQishuiShareHtml(html, 'https://music.douyin.com/qishui/share/playlist?id=1', '');

  assert.equal(parsed.kind, 'playlist');
  assert.equal(parsed.title, '夜间列车');
  assert.equal(parsed.tracks.length, 2);
  assert.equal(parsed.tracks[1].name, 'Signal');
  assert.equal(parsed.tracks[1].artist, 'Echo B');
});

test('does not treat Qishui UGC video shares as songs', () => {
  const html = `
    <meta property="og:title" content="盘点今年最火的20首歌">
    <script>_ROUTER_DATA = {"loaderData":{"ugc_video_page":{"videoOptions":{"videoName":"盘点今年最火的20首歌","artistName":"视频作者"}}},"errors":null};</script>
  `;
  const parsed = parseQishuiShareHtml(html, 'https://music.douyin.com/qishui/share/ugc_video?ugc_video_id=1', '');

  assert.equal(parsed.kind, 'unsupported');
  assert.deepEqual(parsed.tracks, []);
});

test('ranks exact title and artist matches above remixes and covers', () => {
  const source = { name: 'My Jinji', artist: '落日飞车' };
  const exact = scoreImportedSongMatch(source, { name: 'My Jinji', artist: '落日飞车', album: 'Cassa Nova' });
  const remix = scoreImportedSongMatch(source, { name: 'My Jinji (DJ Remix)', artist: '热门音乐', album: '' });
  const wrongArtist = scoreImportedSongMatch(source, { name: 'My Jinji', artist: '翻唱歌手', album: '' });

  assert.ok(exact > remix);
  assert.ok(exact > wrongArtist);
  assert.ok(exact >= 100);
  assert.equal(pickBestImportedSong(source, [remix, wrongArtist, { name: 'My Jinji', artist: '落日飞车', id: 'exact' }]).id, 'exact');
  assert.equal(pickBestImportedSong(source, [{ name: 'Completely Different', artist: 'Other' }]), null);
});

test('exposes Qishui import as a bounded POST endpoint', () => {
  const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  assert.match(server, /pn === '\/api\/import\/qishui'/);
  assert.match(server, /req\.method !== 'POST'/);
  assert.match(server, /share\.tracks\.slice\(0, 24\)/);
  assert.match(server, /mapWithConcurrency\(sourceTracks, 2, matchQishuiTrack\)/);
  assert.ok(pkg.build.files.includes('scripts/qishui-import.js'));
  assert.ok(pkg.build.files.includes('scripts/web-runtime.js'));
});

test('provides a Qishui import modal and queue actions in the player UI', () => {
  const html = fs.readFileSync(path.join(root, 'public/index.html'), 'utf8');
  const theme = fs.readFileSync(path.join(root, 'public/echo-theme.css'), 'utf8');

  assert.match(html, /onclick="openQishuiImport\(\)">汽水导入<\/button>/);
  assert.match(html, /id="qishui-import-modal"/);
  assert.match(html, /id="qishui-import-input"/);
  assert.match(html, /function resolveQishuiImport\(\)/);
  assert.match(html, /function commitQishuiImport\(playNow\)/);
  assert.match(html, /fetch\('\/api\/import\/qishui'/);
  assert.match(theme, /\.qishui-import-modal/);
  assert.match(theme, /\.qishui-import-row/);
});

test('supports desktop Qishui login without exposing cookies to the renderer', () => {
  const main = read('desktop/main.js');
  const preload = read('desktop/preload.js');
  const html = read('public/index.html');

  assert.match(main, /QISHUI_LOGIN_PARTITION = 'persist:echo-qishui-login'/);
  assert.match(main, /QISHUI_LOGIN_URL = 'https:\/\/www\.douyin\.com\/user\/self\?from_tab_name=main'/);
  assert.match(main, /function isQishuiCookieDomain/);
  assert.match(main, /function qishuiCookieHasLogin/);
  assert.match(main, /ipcMain\.handle\('qishui-music-open-login'/);
  assert.match(main, /ipcMain\.handle\('qishui-music-login-status'/);
  assert.match(main, /ipcMain\.handle\('qishui-music-clear-login'/);
  assert.match(preload, /openQishuiMusicLogin: \(\) => ipcRenderer\.invoke\('qishui-music-open-login'\)/);
  assert.match(preload, /getQishuiMusicLoginStatus: \(\) => ipcRenderer\.invoke\('qishui-music-login-status'\)/);
  assert.match(preload, /clearQishuiMusicLogin: \(\) => ipcRenderer\.invoke\('qishui-music-clear-login'\)/);
  assert.doesNotMatch(preload, /qishui[^\n]*cookie/i);
  assert.match(html, /id="qishui-login-btn"[^>]*onclick="openQishuiWebLogin\(\)"/);
  assert.match(html, /id="qishui-logout-btn"[^>]*onclick="logoutQishuiLogin\(\)"/);
  assert.match(html, /function refreshQishuiLoginStatus\(\)/);
});
