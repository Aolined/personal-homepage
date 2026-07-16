const QISHUI_SHORT_HOST = 'qishui.douyin.com';
const QISHUI_SHARE_HOST = 'music.douyin.com';
const MAX_SHARE_HTML_BYTES = 2 * 1024 * 1024;

function isAllowedQishuiShareUrl(value) {
  try {
    const url = new URL(String(value || ''));
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return false;
    const host = url.hostname.toLowerCase().replace(/\.$/, '');
    if (host === QISHUI_SHORT_HOST) return /^\/s\/[A-Za-z0-9_-]+\/?$/.test(url.pathname);
    if (host === QISHUI_SHARE_HOST) return url.pathname.startsWith('/qishui/share/');
    return false;
  } catch (_) {
    return false;
  }
}

function extractQishuiShareUrl(text) {
  const matches = String(text || '').match(/https?:\/\/[^\s<>"']+/gi) || [];
  for (const raw of matches) {
    const value = raw.replace(/[，。！？、；：）】》」』”’]+$/g, '');
    if (isAllowedQishuiShareUrl(value)) return value;
  }
  return '';
}

function decodeHtml(value) {
  return String(value || '')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

function parseTagAttributes(tag) {
  const out = {};
  const pattern = /([:\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  let match;
  while ((match = pattern.exec(tag))) out[match[1].toLowerCase()] = decodeHtml(match[2] ?? match[3] ?? '');
  return out;
}

function parseMeta(html) {
  const out = {};
  const tags = String(html || '').match(/<meta\b[^>]*>/gi) || [];
  tags.forEach((tag) => {
    const attrs = parseTagAttributes(tag);
    const key = String(attrs.property || attrs.name || attrs.itemprop || '').toLowerCase();
    if (key && attrs.content && !out[key]) out[key] = attrs.content.trim();
  });
  return out;
}

function extractAssignedJson(html, marker) {
  const source = String(html || '');
  const markerIndex = source.indexOf(marker);
  if (markerIndex < 0) return null;
  const start = source.indexOf('{', markerIndex + marker.length);
  if (start < 0) return null;
  let depth = 0;
  let quote = '';
  let escaped = false;
  for (let i = start; i < source.length; i += 1) {
    const char = source[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = '';
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        try { return JSON.parse(source.slice(start, i + 1)); }
        catch (_) { return null; }
      }
    }
  }
  return null;
}

function firstString(obj, keys) {
  for (const key of keys) {
    const value = obj && obj[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function artistText(obj) {
  const direct = firstString(obj, ['artistName', 'artist_name', 'singerName', 'singer_name', 'authorName']);
  if (direct) return direct;
  const artist = obj && obj.artist;
  if (typeof artist === 'string') return artist.trim();
  if (artist && typeof artist === 'object') {
    const name = firstString(artist, ['name', 'artistName', 'nickname']);
    if (name) return name;
  }
  const artists = obj && (obj.artists || obj.singers || obj.authorList);
  if (!Array.isArray(artists)) return '';
  return artists.map((item) => typeof item === 'string' ? item : firstString(item, ['name', 'artistName', 'nickname']))
    .filter(Boolean).join(' / ');
}

function coverText(obj) {
  const direct = firstString(obj, ['coverURL', 'coverUrl', 'cover', 'imageUrl', 'imageURL', 'picUrl']);
  if (direct) return direct;
  const album = obj && obj.album;
  return album && typeof album === 'object'
    ? firstString(album, ['coverURL', 'coverUrl', 'cover', 'imageUrl', 'picUrl'])
    : '';
}

function albumText(obj) {
  const direct = firstString(obj, ['albumName', 'album_name']);
  if (direct) return direct;
  const album = obj && obj.album;
  return album && typeof album === 'object' ? firstString(album, ['name', 'title', 'albumName']) : '';
}

function trackFromObject(obj, path) {
  if (!obj || Array.isArray(obj) || typeof obj !== 'object') return null;
  const pathText = path.join('.').toLowerCase();
  const last = String(path[path.length - 1] || '').toLowerCase();
  const explicitName = firstString(obj, ['trackName', 'track_name', 'songName', 'song_name', 'musicName', 'music_name']);
  const isTrackContainer = /^(track|trackinfo|song|songinfo|music|musicinfo)$/.test(last);
  if (!explicitName && !isTrackContainer) return null;
  if (/ugc_video|videooptions|mv_page/.test(pathText)) return null;
  const name = explicitName || firstString(obj, ['name', 'title']);
  if (!name) return null;
  const artist = artistText(obj);
  if (!artist && !firstString(obj, ['id', 'trackId', 'track_id', 'songId', 'song_id'])) return null;
  return {
    id: String(firstString(obj, ['id', 'trackId', 'track_id', 'songId', 'song_id', 'musicId', 'music_id']) || ''),
    name,
    artist,
    album: albumText(obj),
    cover: coverText(obj),
  };
}

function collectTracks(value, path, output, seen) {
  if (!value || typeof value !== 'object') return;
  const track = trackFromObject(value, path);
  if (track) {
    const key = track.id || `${normalizeMatchText(track.name)}|${normalizeMatchText(track.artist)}`;
    if (key && !seen.has(key)) {
      seen.add(key);
      output.push(track);
    }
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectTracks(item, path.concat(String(index)), output, seen));
    return;
  }
  Object.keys(value).forEach((key) => collectTracks(value[key], path.concat(key), output, seen));
}

function normalizeMetaTitle(value) {
  return String(value || '').replace(/\s*[-|·]\s*汽水音乐.*$/i, '').trim();
}

function shareTextTrack(text) {
  const source = String(text || '');
  const quoted = source.match(/[「《“"]([^」》”"]{1,160})[」》”"]/);
  if (!quoted) return null;
  const bits = quoted[1].split(/\s+[-—]\s+/);
  return { id: '', name: bits[0].trim(), artist: (bits[1] || '').trim(), album: '', cover: '' };
}

function parseQishuiShareHtml(html, finalUrl, originalText) {
  const url = new URL(finalUrl);
  const route = url.pathname.toLowerCase();
  if (route.includes('ugc_video') || route.includes('/mv')) return { kind: 'unsupported', title: '', tracks: [] };
  const kind = route.includes('playlist') ? 'playlist' : (route.includes('track') || route.includes('/song') ? 'track' : 'unknown');
  const routerData = extractAssignedJson(html, '_ROUTER_DATA =') || extractAssignedJson(html, 'window._ROUTER_DATA =');
  const tracks = [];
  collectTracks(routerData, [], tracks, new Set());
  const meta = parseMeta(html);
  let title = '';
  const playlistInfo = routerData && routerData.loaderData && (routerData.loaderData.playlist_page || routerData.loaderData.playlistPage);
  if (playlistInfo) title = firstString(playlistInfo.playlistInfo || playlistInfo, ['name', 'title']);
  if (!title) title = normalizeMetaTitle(meta['og:title'] || meta.title || meta.name || '');
  if (!tracks.length && kind === 'track') {
    const fallback = shareTextTrack(originalText);
    if (fallback) tracks.push(fallback);
  }
  return { kind: tracks.length ? kind : (kind === 'track' ? 'track' : 'unsupported'), title, tracks: tracks.slice(0, 40) };
}

function normalizeMatchText(value) {
  return String(value || '').toLowerCase()
    .replace(/[（(【\[].*?[）)】\]]/g, '')
    .replace(/[\s·・\-—_.,，。:：'"“”‘’/\\|]+/g, '');
}

function artistParts(value) {
  return String(value || '').split(/\s*\/\s*|\s*,\s*|、|&| feat\.? | ft\.? /i)
    .map(normalizeMatchText).filter(Boolean);
}

function scoreImportedSongMatch(source, candidate) {
  const sourceName = normalizeMatchText(source && source.name);
  const candidateName = normalizeMatchText(candidate && candidate.name);
  if (!sourceName || !candidateName) return -1000;
  let score = sourceName === candidateName ? 70 : (candidateName.includes(sourceName) || sourceName.includes(candidateName) ? 34 : -30);
  const sourceArtists = artistParts(source && source.artist);
  const candidateArtists = artistParts(candidate && candidate.artist);
  if (sourceArtists.length && candidateArtists.length) {
    score += sourceArtists.some((name) => candidateArtists.includes(name)) ? 40 : -24;
  }
  const raw = `${candidate && candidate.name || ''} ${candidate && candidate.album || ''}`;
  if (/remix|dj|翻唱|cover|live|现场|伴奏|纯音乐/i.test(raw) && !/remix|dj|翻唱|cover|live|现场|伴奏|纯音乐/i.test(source && source.name || '')) score -= 36;
  return score;
}

function pickBestImportedSong(source, candidates, minimumScore) {
  let best = null;
  let bestScore = -Infinity;
  for (const candidate of candidates || []) {
    const score = scoreImportedSongMatch(source, candidate);
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }
  return best && bestScore >= (minimumScore == null ? 52 : minimumScore) ? best : null;
}

async function readLimitedText(response) {
  const declared = Number(response.headers.get('content-length') || 0);
  if (declared > MAX_SHARE_HTML_BYTES) throw Object.assign(new Error('QISHUI_PAGE_TOO_LARGE'), { code: 'QISHUI_PAGE_TOO_LARGE' });
  const text = await response.text();
  if (Buffer.byteLength(text, 'utf8') > MAX_SHARE_HTML_BYTES) throw Object.assign(new Error('QISHUI_PAGE_TOO_LARGE'), { code: 'QISHUI_PAGE_TOO_LARGE' });
  return text;
}

async function fetchQishuiShare(input, options) {
  const shareUrl = extractQishuiShareUrl(input);
  if (!shareUrl) throw Object.assign(new Error('INVALID_QISHUI_SHARE_URL'), { code: 'INVALID_QISHUI_SHARE_URL' });
  const fetchImpl = options && options.fetchImpl || fetch;
  const timeoutMs = Math.max(1000, Number(options && options.timeoutMs) || 9000);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let current = shareUrl;
  try {
    for (let redirect = 0; redirect <= 4; redirect += 1) {
      if (!isAllowedQishuiShareUrl(current)) throw Object.assign(new Error('QISHUI_REDIRECT_BLOCKED'), { code: 'QISHUI_REDIRECT_BLOCKED' });
      const response = await fetchImpl(current, {
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          Accept: 'text/html,application/xhtml+xml',
          'User-Agent': 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36',
        },
      });
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (!location) throw Object.assign(new Error('QISHUI_REDIRECT_MISSING'), { code: 'QISHUI_REDIRECT_MISSING' });
        current = new URL(location, current).toString();
        continue;
      }
      if (!response.ok) throw Object.assign(new Error(`QISHUI_HTTP_${response.status}`), { code: 'QISHUI_HTTP_ERROR', status: response.status });
      const html = await readLimitedText(response);
      return { sourceUrl: current, shareUrl, ...parseQishuiShareHtml(html, current, input) };
    }
    throw Object.assign(new Error('QISHUI_TOO_MANY_REDIRECTS'), { code: 'QISHUI_TOO_MANY_REDIRECTS' });
  } finally {
    clearTimeout(timer);
  }
}

module.exports = {
  extractQishuiShareUrl,
  fetchQishuiShare,
  isAllowedQishuiShareUrl,
  parseQishuiShareHtml,
  pickBestImportedSong,
  scoreImportedSongMatch,
};
