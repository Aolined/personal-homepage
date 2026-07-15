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
const dialog = document.querySelector('.detail-dialog');
const dialogMedia = dialog.querySelector('.dialog-media');
const dialogKicker = dialog.querySelector('.dialog-kicker');
const dialogTitle = dialog.querySelector('#dialog-title');
const dialogDescription = dialog.querySelector('.dialog-description');
const dialogFacts = dialog.querySelector('.dialog-facts');
const dialogMeta = dialog.querySelector('.dialog-meta');
const soundToggle = document.querySelector('.sound-toggle');
const hotList = document.querySelector('#hot-search-list');
const hotStatus = document.querySelector('.hot-search-status');
const hotRefresh = document.querySelector('.hot-refresh');
const remoteSceneMedia = [...document.querySelectorAll('[data-bg-src]')];
const galleryImages = [...document.querySelectorAll('[data-gallery] img')];
let lastTrigger = null;
let audioContext = null;
let ambientNodes = [];
let hotLoading = false;

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

function loadSceneBackground(media) {
  if (media.dataset.imageState) return;
  media.dataset.imageState = 'loading';
  media.setAttribute('aria-busy', 'true');
  const image = new Image();
  image.decoding = 'async';
  image.addEventListener('load', () => {
    media.style.backgroundImage = `url('${media.dataset.bgSrc}')`;
    media.dataset.imageState = 'loaded';
    media.removeAttribute('aria-busy');
  }, { once: true });
  image.addEventListener('error', () => {
    media.dataset.imageState = 'failed';
    media.classList.add('image-failed');
    media.removeAttribute('aria-busy');
  }, { once: true });
  image.src = media.dataset.bgSrc;
}

const backgroundObserver = new IntersectionObserver((entries, observer) => {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    loadSceneBackground(entry.target);
    observer.unobserve(entry.target);
  });
}, { rootMargin: '60% 0px' });

remoteSceneMedia.forEach((media) => {
  if (media.dataset.priority === 'high') loadSceneBackground(media);
  else backgroundObserver.observe(media);
});

function markGalleryImageFailed(image) {
  const button = image.closest('[data-gallery]');
  button.classList.add('image-failed');
  button.setAttribute('aria-label', `${image.alt}，图片加载失败`);
  image.hidden = true;
}

galleryImages.forEach((image) => {
  image.addEventListener('error', () => markGalleryImageFailed(image), { once: true });
  if (image.complete && !image.naturalWidth) markGalleryImageFailed(image);
});

directoryToggle.addEventListener('click', () => directory.showModal());
directory.querySelector('.directory-close').addEventListener('click', () => directory.close());
directory.addEventListener('click', (event) => { if (event.target === directory) directory.close(); });
directory.addEventListener('close', () => directoryToggle.focus());
directory.querySelector('nav').addEventListener('click', (event) => {
  if (event.target.closest('.directory-link')) directory.close();
});

function showDetail(item, image) {
  dialogKicker.textContent = item.kicker;
  dialogTitle.textContent = item.title;
  dialogDescription.textContent = item.description;
  const imageAvailable = image && !image.hidden && image.naturalWidth > 0;
  dialogMedia.classList.toggle('image-failed', !imageAvailable);
  dialogMedia.style.backgroundImage = imageAvailable ? `url('${image.currentSrc || image.src}')` : 'none';
  dialogFacts.replaceChildren();
  dialogMeta.replaceChildren();
  dialogFacts.hidden = true;
  dialogMeta.hidden = true;
  dialog.showModal();
}

document.addEventListener('click', (event) => {
  const galleryButton = event.target.closest('[data-gallery]');
  if (galleryButton) {
    lastTrigger = galleryButton;
    const item = siteContent.gallery[Number(galleryButton.dataset.gallery)];
    showDetail(item, galleryButton.querySelector('img'));
  }
});

function formatHot(value) {
  if (!Number.isFinite(value) || value <= 0) return '热度更新中';
  return `${new Intl.NumberFormat('zh-CN', { notation: 'compact', maximumFractionDigits: 1 }).format(value)} 讨论热度`;
}

function getSafeHotUrl(value) {
  try {
    const url = new URL(value);
    return url.origin === 'https://news.ycombinator.com' ? url.href : null;
  } catch {
    return null;
  }
}

function createHotItem(item) {
  if (!item || typeof item.title !== 'string' || !Number.isInteger(item.rank)) return null;
  const href = getSafeHotUrl(item.url);
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
  link.setAttribute('aria-label', `AI 热榜第 ${item.rank} 名：${item.title}`);
  rank.className = 'hot-rank';
  rank.textContent = String(item.rank).padStart(2, '0');
  topic.className = 'hot-topic';
  title.textContent = item.title.slice(0, 120);
  heat.textContent = formatHot(Number(item.hot));
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

function renderHotSearch(payload) {
  const items = Array.isArray(payload?.data) ? payload.data.map(createHotItem).filter(Boolean).slice(0, 6) : [];
  if (!items.length) {
    const message = document.createElement('li');
    message.className = 'hot-message';
    message.textContent = '暂时无法连接 AI 热榜，请稍后刷新。';
    hotList.replaceChildren(message);
  } else {
    hotList.replaceChildren(...items);
  }

  const updated = payload?.updatedAt ? new Date(payload.updatedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '';
  if (payload?.status === 'live') hotStatus.textContent = `实时 · 更新于 ${updated}`;
  else if (payload?.status === 'stale') hotStatus.textContent = `连接波动 · 显示 ${updated} 的最近数据`;
  else hotStatus.textContent = 'AI 热榜暂时不可用';
}

async function loadHotSearch(force = false) {
  if (hotLoading) return;
  hotLoading = true;
  hotRefresh.disabled = true;
  if (force) hotRefresh.textContent = '刷新中';
  hotStatus.textContent = '正在刷新热搜…';
  try {
    const response = await fetch(force ? '/api/hot-search?refresh=1' : '/api/hot-search');
    if (!response.ok) throw new Error('Hot search request failed');
    renderHotSearch(await response.json());
  } catch {
    renderHotSearch({ data: [], status: 'unavailable', updatedAt: null });
  } finally {
    hotLoading = false;
    hotRefresh.disabled = false;
    hotRefresh.textContent = '刷新';
  }
}

hotRefresh.addEventListener('click', () => loadHotSearch(true));
loadHotSearch();
setInterval(() => { if (!document.hidden) loadHotSearch(); }, 120_000);

function closeDialog() {
  if (!dialog.open) return;
  dialog.close();
  lastTrigger?.focus();
}

dialog.querySelector('.dialog-close').addEventListener('click', closeDialog);
dialog.addEventListener('click', (event) => { if (event.target === dialog) closeDialog(); });
dialog.addEventListener('close', () => lastTrigger?.focus());
document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeDialog(); });

function stopAmbient() {
  ambientNodes.forEach((node) => { try { node.stop?.(); node.disconnect?.(); } catch {} });
  ambientNodes = [];
  audioContext?.close();
  audioContext = null;
}

function startAmbient() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) throw new Error('Web Audio is unavailable');
  audioContext = new AudioContextClass();
  const master = audioContext.createGain();
  master.gain.value = 0.04;
  master.connect(audioContext.destination);
  [110, 164.81, 220].forEach((frequency, index) => {
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = index === 1 ? 'sine' : 'triangle';
    oscillator.frequency.value = frequency;
    gain.gain.value = 0.3 / (index + 1);
    oscillator.connect(gain).connect(master);
    oscillator.start();
    ambientNodes.push(oscillator, gain);
  });
  ambientNodes.push(master);
}

soundToggle.addEventListener('click', () => {
  const shouldPlay = soundToggle.getAttribute('aria-pressed') !== 'true';
  try {
    if (shouldPlay) startAmbient(); else stopAmbient();
    soundToggle.setAttribute('aria-pressed', String(shouldPlay));
    soundToggle.querySelector('.sound-label').textContent = shouldPlay ? 'SOUND ON' : 'SOUND OFF';
  } catch {
    stopAmbient();
    soundToggle.setAttribute('aria-pressed', 'false');
    soundToggle.querySelector('.sound-label').textContent = 'SOUND UNAVAILABLE';
  }
});
