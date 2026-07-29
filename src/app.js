import { siteContent } from './content.js';

const scenes = [...document.querySelectorAll('[data-scene]')];
const navLinks = [...document.querySelectorAll('.scene-nav a')];
const siteHeader = document.querySelector('.site-header');
const mobilePrevious = document.querySelector('.mobile-scene-prev');
const mobileCurrent = document.querySelector('.mobile-scene-current');
const mobileNext = document.querySelector('.mobile-scene-next');
const directory = document.querySelector('.scene-directory');
const directoryToggle = document.querySelector('.mobile-directory-toggle');
const status = document.querySelector('.scene-status');
const soundToggle = document.querySelector('.sound-toggle');
const soundtrack = document.querySelector('#site-soundtrack');
const soundLabel = soundToggle.querySelector('.sound-label');
const hotList = document.querySelector('#hot-search-list');
const hotStatus = document.querySelector('.hot-search-status');
const hotRefresh = document.querySelector('.hot-refresh');
const hotSourceLabel = document.querySelector('.hot-source');
const hotTabs = [...document.querySelectorAll('.trend-tab')];
const hotPanel = document.querySelector('#trend-panel');
const trendSignal = document.querySelector('.trend-signal');
const deepFieldCanvas = document.querySelector('.deep-field-canvas');
const interestNodes = [...document.querySelectorAll('.interest-node')];
const interestDetail = document.querySelector('.interest-detail');
const remoteSceneMedia = [...document.querySelectorAll('[data-bg-src]')];
const musicStatus = document.querySelector('.music-status');
const musicRetry = document.querySelector('.music-retry');
const musicLinks = [...document.querySelectorAll('[data-music-link]')];
const worksConstellation = document.querySelector('.works-constellation');
const workStars = [...document.querySelectorAll('[data-work-star]')];
const workPanels = [...document.querySelectorAll('.project-entry[role="tabpanel"]')];
const workStatus = document.querySelector('.work-selection-status');
let activeHotSource = 'ai';
const hotPayloads = new Map();
const hotLoadingSources = new Set();
const SOUND_PREFERENCE_KEY = 'aolined-sound-enabled';
const SOUNDTRACK_VOLUME = 0.32;
let soundFadeFrame = 0;
let autoplayFallbackArmed = false;

const HOT_SOURCES = {
  ai: {
    label: 'AI 热榜',
    origin: 'https://news.ycombinator.com',
    sourceLabel: 'SOURCE / HACKER NEWS AI · 近 7 天讨论',
  },
  github: {
    label: 'GitHub 热搜',
    origin: 'https://github.com',
    sourceLabel: 'SOURCE / GITHUB SEARCH · 近 7 天新增仓库',
  },
  weibo: {
    label: '微博热搜',
    origin: 'https://s.weibo.com',
    sourceLabel: 'SOURCE / WEIBO REALTIME · 实时公共话题',
  },
};

function setActiveWork(id, { focus = false } = {}) {
  const nextIndex = workStars.findIndex((star) => star.dataset.workStar === id);
  if (nextIndex === -1) return;

  worksConstellation.dataset.activeWork = id;
  workStars.forEach((star, index) => {
    const isActive = index === nextIndex;
    star.setAttribute('aria-selected', String(isActive));
    star.tabIndex = isActive ? 0 : -1;
  });
  workPanels.forEach((panel) => {
    panel.hidden = panel.id !== workStars[nextIndex].getAttribute('aria-controls');
  });
  workStatus.textContent = `已选择作品：${workStars[nextIndex].dataset.workTitle}，${nextIndex + 1} / ${workStars.length}`;
  if (focus) workStars[nextIndex].focus();
}

workStars.forEach((star, index) => {
  star.addEventListener('click', () => setActiveWork(star.dataset.workStar));
  star.addEventListener('keydown', (event) => {
    const keyOffsets = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
    let nextIndex = index;
    if (event.key in keyOffsets) nextIndex = (index + keyOffsets[event.key] + workStars.length) % workStars.length;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = workStars.length - 1;
    else return;

    event.preventDefault();
    setActiveWork(workStars[nextIndex].dataset.workStar, { focus: true });
  });
});

function getSafeMusicUrl(value) {
  try {
    const url = new URL(value);
    const localHttp = url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname);
    return url.protocol === 'https:' || localHttp ? url.href : null;
  } catch {
    return null;
  }
}

function setMusicUnavailable() {
  musicStatus.textContent = 'Echo Music 本地服务未启动';
  musicStatus.dataset.state = 'offline';
  musicLinks.forEach((link) => {
    link.removeAttribute('href');
    link.setAttribute('aria-disabled', 'true');
  });
}

async function loadMusicStatus() {
  musicRetry.disabled = true;
  musicStatus.textContent = '正在检测 Echo Music…';
  musicStatus.dataset.state = 'loading';
  try {
    const response = await fetch('/api/music-status');
    if (!response.ok) throw new Error('Music status request failed');
    const payload = await response.json();
    const urls = {
      landing: getSafeMusicUrl(payload?.landingUrl),
      app: getSafeMusicUrl(payload?.appUrl),
      download: getSafeMusicUrl(payload?.downloadUrl),
    };
    if (!payload?.available || Object.values(urls).some((url) => !url)) {
      setMusicUnavailable();
      return;
    }
    musicLinks.forEach((link) => {
      link.href = urls[link.dataset.musicLink];
      link.setAttribute('aria-disabled', 'false');
    });
    musicStatus.textContent = payload.deployment === 'public'
      ? `Echo Music ${payload.version || ''} · 公网访客版`
      : `Echo Music ${payload.version || ''} · 本地服务在线`;
    musicStatus.dataset.state = 'online';
  } catch {
    setMusicUnavailable();
  } finally {
    musicRetry.disabled = false;
  }
}

function setActiveScene(id) {
  navLinks.forEach((link) => link.setAttribute('aria-current', link.hash === `#${id}` ? 'page' : 'false'));
  status.textContent = `当前场景：${siteContent.scenes[id]}`;
  const currentIndex = scenes.findIndex((scene) => scene.dataset.scene === id);
  const previousScene = scenes[(currentIndex - 1 + scenes.length) % scenes.length];
  const nextScene = scenes[(currentIndex + 1) % scenes.length];
  const currentName = siteContent.scenes[id];
  const previousName = siteContent.scenes[previousScene.dataset.scene];
  const nextName = siteContent.scenes[nextScene.dataset.scene];

  siteHeader.dataset.tone = scenes[currentIndex].dataset.headerTone || 'dark';
  mobilePrevious.href = `#${previousScene.id}`;
  mobilePrevious.setAttribute('aria-label', `上一场景：${previousName}`);
  mobileCurrent.href = `#${id}`;
  mobileCurrent.querySelector('strong').textContent = currentName;
  mobileNext.href = `#${nextScene.id}`;
  mobileNext.setAttribute('aria-label', `下一场景：${nextName}`);
  document.querySelectorAll('.directory-link').forEach((link) => link.setAttribute('aria-current', link.hash === `#${id}` ? 'page' : 'false'));
}

const sceneObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    entry.target.classList.toggle('is-visible', entry.isIntersecting);
    if (entry.isIntersecting && entry.intersectionRatio > 0.55) setActiveScene(entry.target.dataset.scene);
  });
}, { threshold: [0.2, 0.55, 0.8] });

scenes.forEach((scene) => sceneObserver.observe(scene));

const finePointer = matchMedia('(pointer: fine)');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

const interestContent = {
  sound: { index: '01 / SOUND', title: '声音', description: '环境电子、深夜电台、现场录音、能听见空间感的音乐。' },
  games: { index: '02 / GAMES', title: '游戏', description: '独立叙事、小型模拟、允许慢慢探索且不急着给答案的世界。' },
  tools: { index: '03 / TOOLS', title: '工具', description: '本地优先、自动化、明确的按钮，以及真正减少重复劳动的软件。' },
  objects: { index: '04 / OBJECTS', title: '物件', description: '旧设备、小灯、纸张、旋钮和那些会留下使用痕迹的东西。' },
};

function setActiveInterest(id, { focus = false } = {}) {
  const content = interestContent[id];
  const nextIndex = interestNodes.findIndex((node) => node.dataset.interest === id);
  if (!content || nextIndex === -1) return;

  interestNodes.forEach((node, index) => {
    const selected = index === nextIndex;
    node.setAttribute('aria-selected', String(selected));
    node.tabIndex = selected ? 0 : -1;
  });
  interestDetail.querySelector('.interest-detail__eyebrow').textContent = content.index;
  interestDetail.querySelector('h3').textContent = content.title;
  interestDetail.querySelector('p:last-child').textContent = content.description;
  if (focus) interestNodes[nextIndex].focus();
}

interestNodes.forEach((node, index) => {
  node.addEventListener('click', () => setActiveInterest(node.dataset.interest));
  node.addEventListener('keydown', (event) => {
    const offsets = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
    let nextIndex = index;
    if (event.key in offsets) nextIndex = (index + offsets[event.key] + interestNodes.length) % interestNodes.length;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = interestNodes.length - 1;
    else return;
    event.preventDefault();
    setActiveInterest(interestNodes[nextIndex].dataset.interest, { focus: true });
  });
});

function initDeepField(canvas) {
  if (!canvas) return;
  const context = canvas.getContext('2d', { alpha: true });
  if (!context) return;
  const field = canvas.closest('.deep-field');
  const points = [];
  const mouse = { x: -10_000, y: -10_000, active: false };
  let frame = 0;
  let visible = true;
  let width = 0;
  let height = 0;
  let pixelRatio = 1;

  function rebuild() {
    const bounds = canvas.getBoundingClientRect();
    width = Math.max(1, bounds.width);
    height = Math.max(1, bounds.height);
    pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(width * pixelRatio);
    canvas.height = Math.round(height * pixelRatio);
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    const count = Math.min(150, Math.max(72, Math.round((width * height) / 13_000)));
    points.length = 0;
    for (let index = 0; index < count; index += 1) {
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.pow(Math.random(), 0.62);
      points.push({
        angle,
        radius,
        lane: (Math.random() - 0.5) * 0.44,
        size: 0.7 + Math.random() * 2.2,
        phase: Math.random() * Math.PI * 2,
        drift: 0.22 + Math.random() * 0.52,
        glow: 0.28 + Math.random() * 0.72,
      });
    }
  }

  function draw(time = 0) {
    frame = 0;
    context.clearRect(0, 0, width, height);
    const tick = reducedMotion.matches ? 0 : time * 0.00022;
    const centerX = width * 0.58;
    const centerY = height * 0.54;
    const radiusX = width * 0.43;
    const radiusY = height * 0.33;
    for (const point of points) {
      const breathing = 1 + Math.sin(tick * 1.7 + point.phase) * 0.045;
      let x = centerX + Math.cos(point.angle + tick * point.drift) * radiusX * point.radius * breathing;
      let y = centerY + Math.sin(point.angle * 1.35 + tick * point.drift + point.phase * 0.13) * radiusY * point.radius * breathing + point.lane * height;
      if (mouse.active && finePointer.matches && !reducedMotion.matches) {
        const dx = x - mouse.x;
        const dy = y - mouse.y;
        const distance = Math.hypot(dx, dy) || 1;
        const force = Math.max(0, 1 - distance / 150);
        x += (dx / distance) * force * 34;
        y += (dy / distance) * force * 34;
      }
      const alpha = 0.16 + point.glow * 0.58;
      context.beginPath();
      context.fillStyle = `rgba(166, 236, 224, ${alpha})`;
      context.arc(x, y, point.size * (0.82 + Math.sin(tick * 2.2 + point.phase) * 0.12), 0, Math.PI * 2);
      context.fill();
    }
    if (visible && !reducedMotion.matches) frame = requestAnimationFrame(draw);
  }

  window.addEventListener('pointermove', (event) => {
    const bounds = canvas.getBoundingClientRect();
    mouse.active = event.clientX >= bounds.left && event.clientX <= bounds.right
      && event.clientY >= bounds.top && event.clientY <= bounds.bottom;
    if (mouse.active) {
      mouse.x = event.clientX - bounds.left;
      mouse.y = event.clientY - bounds.top;
    }
  }, { passive: true });
  window.addEventListener('blur', () => { mouse.active = false; });
  new ResizeObserver(() => { rebuild(); if (!frame) draw(performance.now()); }).observe(canvas);
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (!visible) {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      return;
    }
    if (!frame) draw(performance.now());
  }, { threshold: 0.05 }).observe(field);
  reducedMotion.addEventListener('change', () => { if (frame) cancelAnimationFrame(frame); frame = 0; draw(performance.now()); });
  rebuild();
  draw(performance.now());
}

initDeepField(deepFieldCanvas);
let wheelDelta = 0;
let wheelResetTimer = 0;
let wheelUnlockTimer = 0;
let wheelPagingStarted = 0;
let wheelPaging = false;

function getClosestSceneIndex() {
  return scenes.reduce((closestIndex, scene, index) => {
    const closestDistance = Math.abs(scenes[closestIndex].getBoundingClientRect().top);
    const sceneDistance = Math.abs(scene.getBoundingClientRect().top);
    return sceneDistance < closestDistance ? index : closestIndex;
  }, 0);
}

function queueWheelUnlock() {
  clearTimeout(wheelUnlockTimer);
  const minimumTransition = Math.max(0, 620 - (performance.now() - wheelPagingStarted));
  wheelUnlockTimer = window.setTimeout(() => {
    wheelPaging = false;
  }, minimumTransition + 180);
}

function handleSceneWheel(event) {
  if (!finePointer.matches || event.ctrlKey || directory.open || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;

  event.preventDefault();
  if (wheelPaging) {
    queueWheelUnlock();
    return;
  }

  const deltaScale = event.deltaMode === WheelEvent.DOM_DELTA_LINE
    ? 16
    : event.deltaMode === WheelEvent.DOM_DELTA_PAGE ? window.innerHeight : 1;
  wheelDelta += event.deltaY * deltaScale;
  clearTimeout(wheelResetTimer);
  wheelResetTimer = window.setTimeout(() => { wheelDelta = 0; }, 180);
  if (Math.abs(wheelDelta) < 36) return;

  const currentIndex = getClosestSceneIndex();
  const nextIndex = Math.min(scenes.length - 1, Math.max(0, currentIndex + Math.sign(wheelDelta)));
  wheelDelta = 0;
  if (nextIndex === currentIndex) return;

  wheelPaging = true;
  wheelPagingStarted = performance.now();
  queueWheelUnlock();
  const behavior = reducedMotion.matches ? 'auto' : 'smooth';
  scenes[nextIndex].scrollIntoView({ behavior, block: 'start' });
}

window.addEventListener('wheel', handleSceneWheel, { passive: false });

function getSceneImageUrl(value) {
  try {
    const url = new URL(value);
    if (url.hostname !== 'images.unsplash.com') return value;
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
    const targetWidth = Math.min(1920, Math.max(960, Math.ceil((window.innerWidth * pixelRatio) / 320) * 320));
    url.searchParams.set('w', String(targetWidth));
    url.searchParams.set('q', '82');
    return url.href;
  } catch {
    return value;
  }
}

function loadSceneBackground(media) {
  if (media.dataset.imageState) return;
  media.dataset.imageState = 'loading';
  media.setAttribute('aria-busy', 'true');
  const image = new Image();
  const imageUrl = getSceneImageUrl(media.dataset.bgSrc);
  image.decoding = 'async';
  image.addEventListener('load', async () => {
    try {
      await image.decode();
    } catch {
      // A loaded image can still be displayed when explicit decoding is unavailable.
    }
    media.style.backgroundImage = `url('${imageUrl}')`;
    media.dataset.imageState = 'loaded';
    media.removeAttribute('aria-busy');
  }, { once: true });
  image.addEventListener('error', () => {
    media.dataset.imageState = 'failed';
    media.classList.add('image-failed');
    media.removeAttribute('aria-busy');
  }, { once: true });
  image.src = imageUrl;
}

const backgroundObserver = new IntersectionObserver((entries, observer) => {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    loadSceneBackground(entry.target);
    observer.unobserve(entry.target);
  });
}, { rootMargin: '100% 0px' });

remoteSceneMedia.forEach((media) => {
  if (media.dataset.priority === 'high') loadSceneBackground(media);
  else backgroundObserver.observe(media);
});

directoryToggle.addEventListener('click', () => directory.showModal());
directory.querySelector('.directory-close').addEventListener('click', () => directory.close());
directory.addEventListener('click', (event) => { if (event.target === directory) directory.close(); });
directory.addEventListener('close', () => directoryToggle.focus());
directory.querySelector('nav').addEventListener('click', (event) => {
  if (event.target.closest('.directory-link')) directory.close();
});

function formatHot(value, source) {
  if (!Number.isFinite(value) || value <= 0) return '热度更新中';
  const formatted = new Intl.NumberFormat('zh-CN', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
  if (source === 'github') return `${formatted} 仓库热度`;
  if (source === 'weibo') return `${formatted} 实时热度`;
  return `${formatted} 讨论热度`;
}

function getSafeHotUrl(value, source) {
  try {
    const url = new URL(value);
    const config = HOT_SOURCES[source];
    if (!config || url.origin !== config.origin) return null;
    if (source === 'ai' && url.pathname !== '/item') return null;
    if (source === 'github' && url.pathname.split('/').filter(Boolean).length !== 2) return null;
    if (source === 'weibo' && url.pathname !== '/weibo') return null;
    return url.href;
  } catch {
    return null;
  }
}

function createHotItem(item, source) {
  if (!item || typeof item.title !== 'string' || !Number.isInteger(item.rank)) return null;
  const href = getSafeHotUrl(item.url, source);
  if (!href) return null;

  const row = document.createElement('li');
  const link = document.createElement('a');
  const rank = document.createElement('span');
  const topic = document.createElement('span');
  const title = document.createElement('strong');
  const heat = document.createElement('small');
  const arrow = document.createElement('i');

  link.href = href;
  link.target = '_blank';
  link.rel = 'noreferrer';
  link.setAttribute('aria-label', `${HOT_SOURCES[source].label}第 ${item.rank} 名：${item.title}`);
  rank.className = 'hot-rank';
  rank.textContent = String(item.rank).padStart(2, '0');
  topic.className = 'hot-topic';
  title.textContent = item.title.slice(0, 120);
  heat.textContent = formatHot(Number(item.hot), source);
  topic.append(title, heat);

  if (typeof item.tag === 'string' && item.tag) {
    const tag = document.createElement('em');
    tag.textContent = item.tag.slice(0, 4);
    link.append(rank, topic, tag);
  } else {
    link.append(rank, topic);
  }
  arrow.textContent = '↗';
  arrow.setAttribute('aria-hidden', 'true');
  link.append(arrow);
  row.append(link);
  return row;
}

function setTrendSignal(payload, source) {
  if (!trendSignal) return;
  trendSignal.dataset.source = source;
  const values = Array.isArray(payload?.data)
    ? payload.data.map((item) => Math.max(0, Number(item?.hot) || 0)).filter(Boolean)
    : [];
  const max = Math.max(...values, 1);
  [...trendSignal.children].forEach((bar, index) => {
    const value = values[index % Math.max(values.length, 1)] || 0;
    const level = values.length ? 18 + Math.round((value / max) * 82) : 12;
    bar.style.setProperty('--signal-level', String(level));
    bar.style.setProperty('--signal-delay', `${(index % 6) * -0.15}s`);
  });
}

function renderHotSearch(payload, source = activeHotSource) {
  const config = HOT_SOURCES[source];
  const items = Array.isArray(payload?.data) ? payload.data.map((item) => createHotItem(item, source)).filter(Boolean).slice(0, 6) : [];
  if (!items.length) {
    const message = document.createElement('li');
    message.className = 'hot-message';
    message.textContent = `暂时无法连接${config.label}，请稍后刷新。`;
    hotList.replaceChildren(message);
  } else {
    hotList.replaceChildren(...items);
  }

  setTrendSignal(payload, source);
  const updated = payload?.updatedAt ? new Date(payload.updatedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '';
  if (payload?.status === 'live') hotStatus.textContent = `实时 · 更新于 ${updated}`;
  else if (payload?.status === 'stale') hotStatus.textContent = `连接波动 · 显示 ${updated} 的最近数据`;
  else hotStatus.textContent = `${config.label}暂时不可用`;
  hotSourceLabel.textContent = `${config.sourceLabel} · 自动更新间隔 2 分钟`;
}

async function loadHotSearch(force = false) {
  const source = activeHotSource;
  if (hotLoadingSources.has(source)) return;
  hotLoadingSources.add(source);
  hotRefresh.disabled = true;
  if (force) hotRefresh.textContent = '刷新中';
  hotStatus.textContent = `正在刷新${HOT_SOURCES[source].label}…`;
  try {
    const url = new URL('/api/hot-search', window.location.origin);
    const params = url.searchParams;
    params.set('source', source);
    if (force) params.set('refresh', '1');
    const response = await fetch(`${url.pathname}?${params}`);
    if (!response.ok) throw new Error('Hot search request failed');
    const payload = await response.json();
    hotPayloads.set(source, payload);
    if (activeHotSource === source) renderHotSearch(payload, source);
  } catch {
    if (activeHotSource === source) renderHotSearch(hotPayloads.get(source) || { data: [], status: 'unavailable', updatedAt: null }, source);
  } finally {
    hotLoadingSources.delete(source);
    if (activeHotSource === source) {
      hotRefresh.disabled = false;
      hotRefresh.textContent = '刷新';
    }
  }
}

hotRefresh.addEventListener('click', () => loadHotSearch(true));
hotTabs.forEach((tab) => tab.addEventListener('click', () => {
  const source = tab.dataset.hotSource;
  if (!HOT_SOURCES[source] || source === activeHotSource) return;
  activeHotSource = source;
  hotTabs.forEach((item) => {
    item.setAttribute('aria-selected', String(item === tab));
    item.tabIndex = item === tab ? 0 : -1;
  });
  hotPanel.setAttribute('aria-labelledby', tab.id);
  const cached = hotPayloads.get(source);
  if (cached) renderHotSearch(cached, source);
  else {
    setTrendSignal(null, source);
    hotList.replaceChildren(Object.assign(document.createElement('li'), { className: 'hot-message', textContent: `正在获取${HOT_SOURCES[source].label}…` }));
    hotSourceLabel.textContent = `${HOT_SOURCES[source].sourceLabel} · 自动更新间隔 2 分钟`;
  }
  loadHotSearch();
}));
document.querySelector('.trend-tabs').addEventListener('keydown', (event) => {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  event.preventDefault();
  const currentIndex = hotTabs.indexOf(document.activeElement);
  let nextIndex = currentIndex;
  if (event.key === 'Home') nextIndex = 0;
  else if (event.key === 'End') nextIndex = hotTabs.length - 1;
  else nextIndex = (currentIndex + (event.key === 'ArrowRight' ? 1 : -1) + hotTabs.length) % hotTabs.length;
  hotTabs[nextIndex].focus();
  hotTabs[nextIndex].click();
});
loadHotSearch();
setInterval(() => { if (!document.hidden) loadHotSearch(); }, 120_000);
musicRetry.addEventListener('click', loadMusicStatus);
loadMusicStatus();
setInterval(() => { if (!document.hidden) loadMusicStatus(); }, 30_000);

function saveSoundPreference(enabled) {
  try {
    localStorage.setItem(SOUND_PREFERENCE_KEY, enabled ? 'on' : 'off');
  } catch {}
}

function soundIsEnabledByPreference() {
  try {
    return localStorage.getItem(SOUND_PREFERENCE_KEY) !== 'off';
  } catch {
    return true;
  }
}

function setSoundState(state) {
  const playing = state === 'on';
  soundToggle.setAttribute('aria-pressed', String(playing));
  soundLabel.textContent = state === 'unavailable' ? 'SOUND UNAVAILABLE' : playing ? 'SOUND ON' : 'SOUND OFF';
  soundToggle.setAttribute('aria-label', playing ? '暂停背景音乐：开始懂了' : '播放背景音乐：开始懂了');
}

function fadeSoundtrackIn() {
  cancelAnimationFrame(soundFadeFrame);
  soundtrack.volume = 0;
  const startedAt = performance.now();
  const tick = (now) => {
    const progress = Math.min((now - startedAt) / 1400, 1);
    soundtrack.volume = SOUNDTRACK_VOLUME * progress;
    if (progress < 1 && !soundtrack.paused) soundFadeFrame = requestAnimationFrame(tick);
  };
  soundFadeFrame = requestAnimationFrame(tick);
}

function disarmAutoplayFallback() {
  if (!autoplayFallbackArmed) return;
  autoplayFallbackArmed = false;
  window.removeEventListener('pointerdown', handleFirstInteraction);
  window.removeEventListener('keydown', handleFirstInteraction);
}

async function playSoundtrack({ remember = true } = {}) {
  if (!soundtrack) {
    setSoundState('unavailable');
    return false;
  }
  try {
    soundtrack.volume = 0;
    await soundtrack.play();
    disarmAutoplayFallback();
    fadeSoundtrackIn();
    setSoundState('on');
    if (remember) saveSoundPreference(true);
    return true;
  } catch (error) {
    setSoundState(error?.name === 'NotAllowedError' ? 'off' : 'unavailable');
    return false;
  }
}

function handleFirstInteraction(event) {
  if (event.target.closest?.('.sound-toggle')) return;
  disarmAutoplayFallback();
  playSoundtrack({ remember: false });
}

function armAutoplayFallback() {
  if (autoplayFallbackArmed) return;
  autoplayFallbackArmed = true;
  window.addEventListener('pointerdown', handleFirstInteraction);
  window.addEventListener('keydown', handleFirstInteraction);
}

soundToggle.addEventListener('click', async () => {
  if (soundtrack.paused) {
    const started = await playSoundtrack();
    if (!started) armAutoplayFallback();
    return;
  }
  cancelAnimationFrame(soundFadeFrame);
  soundtrack.pause();
  saveSoundPreference(false);
  setSoundState('off');
});

soundtrack.addEventListener('error', () => {
  disarmAutoplayFallback();
  setSoundState('unavailable');
});

if (soundIsEnabledByPreference()) {
  playSoundtrack({ remember: false }).then((started) => {
    if (!started && soundtrack.error === null) armAutoplayFallback();
  });
} else {
  setSoundState('off');
}
