import {
  ArrowLeft,
  ArrowRight,
  CircleCheck,
  Copy,
  Download,
  GalleryThumbnails,
  GripVertical,
  RefreshCw,
  RotateCcw,
  RotateCw,
  Square,
  Trash2,
  createElement,
  createIcons,
  type IconNode,
} from 'lucide';

import { calculateSizeChange } from '../conversion/result-metrics';
import {
  createPdfFromRasterPages,
  getPdfPageCount,
  rebuildPdfPages,
  validatePdfFiles,
  type PdfDecorationOptions,
} from '../pdf/pdf-toolbox';
import {
  isPdfRenderCanceled,
  renderPdfPages,
  renderPdfPreview,
} from '../pdf/pdf-renderer';
import {
  createPdfPageItems,
  duplicatePdfPageItem,
  movePdfPageItem,
  removePdfPageItem,
  rotatePdfPageItem,
  type PdfPageItem,
} from './pdf-page-model';
import { pdfPageManagerTemplate } from './pdf-page-manager-template';
import './pdf-page-manager.css';

export interface PdfPageManagerPersistResult {
  sourceName: string;
  outputName: string;
  sourceSize: number;
  blob: Blob;
}

interface PdfPageManagerOptions {
  onBusyChange: (busy: boolean) => void;
  persistResults: (results: readonly PdfPageManagerPersistResult[]) => Promise<void>;
}

export interface PdfPageManagerController {
  reset(): void;
  dispose(): void;
}

type ManagerPhase = 'empty' | 'loading' | 'ready' | 'processing' | 'success';
type CompressionMode = 'preserve' | 'standard' | 'compact';

const MANAGER_FILE_LIMIT = 60 * 1024 * 1024;
const MANAGER_PAGE_LIMIT = 100;
const MANAGER_OUTPUT_PAGE_LIMIT = 200;
const COMPRESSION_PRESETS: Record<Exclude<CompressionMode, 'preserve'>, {
  scale: number;
  quality: number;
}> = {
  standard: { scale: 1.45, quality: 0.76 },
  compact: { scale: 1, quality: 0.56 },
};

function query<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`Missing page manager element: ${selector}`);
  return element;
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function baseName(name: string): string {
  return name.replace(/\.[^.]*$/, '').trim() || 'document';
}

function createIconButton(
  icon: IconNode,
  label: string,
  action: string,
  itemId: string,
): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'manager-page-action';
  button.dataset.pageAction = action;
  button.dataset.pageId = itemId;
  button.title = label;
  button.setAttribute('aria-label', label);
  button.append(createElement(icon, {
    'aria-hidden': 'true',
    width: 16,
    height: 16,
    'stroke-width': 2,
  }));
  return button;
}

async function createWatermarkBytes(text: string): Promise<Uint8Array | null> {
  const normalized = text.trim();
  if (!normalized) return null;
  const canvas = document.createElement('canvas');
  canvas.width = 900;
  canvas.height = 180;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('当前浏览器无法生成文字水印。');
  let fontSize = 72;
  context.font = `700 ${fontSize}px "PingFang SC", "Microsoft YaHei", sans-serif`;
  while (context.measureText(normalized).width > 820 && fontSize > 28) {
    fontSize -= 4;
    context.font = `700 ${fontSize}px "PingFang SC", "Microsoft YaHei", sans-serif`;
  }
  context.fillStyle = '#183c43';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(normalized, canvas.width / 2, canvas.height / 2);
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (output) => output ? resolve(output) : reject(new Error('文字水印生成失败。')),
      'image/png',
    );
  });
  return new Uint8Array(await blob.arrayBuffer());
}

export function mountPdfPageManager(
  root: HTMLDivElement,
  options: PdfPageManagerOptions,
): PdfPageManagerController {
  root.innerHTML = pdfPageManagerTemplate;
  createIcons({
    root,
    icons: {
      ArrowRight,
      CircleCheck,
      Download,
      GalleryThumbnails,
      RefreshCw,
      RotateCcw,
      Square,
    },
    attrs: { 'aria-hidden': 'true', 'stroke-width': 2 },
  });
  root.querySelectorAll('svg[data-lucide]').forEach((icon) => icon.removeAttribute('data-lucide'));

  const upload = query<HTMLDivElement>(root, '[data-manager-upload]');
  const input = query<HTMLInputElement>(root, '[data-manager-input]');
  const selectButton = query<HTMLButtonElement>(root, '[data-manager-select]');
  const loading = query<HTMLDivElement>(root, '[data-manager-loading]');
  const loadingMessage = query<HTMLElement>(root, '[data-manager-loading-message]');
  const loadingValue = query<HTMLElement>(root, '[data-manager-loading-value]');
  const loadingBar = query<HTMLProgressElement>(root, '[data-manager-loading-bar]');
  const cancelButton = query<HTMLButtonElement>(root, '[data-manager-cancel]');
  const errorPanel = query<HTMLDivElement>(root, '[data-manager-error]');
  const errorMessage = query<HTMLElement>(errorPanel, 'p');
  const editor = query<HTMLDivElement>(root, '[data-manager-editor]');
  const fileName = query<HTMLElement>(root, '[data-manager-file-name]');
  const fileMeta = query<HTMLElement>(root, '[data-manager-file-meta]');
  const resetButton = query<HTMLButtonElement>(root, '[data-manager-reset]');
  const pageCount = query<HTMLElement>(root, '[data-manager-page-count]');
  const announcement = query<HTMLElement>(root, '[data-manager-announcement]');
  const grid = query<HTMLDivElement>(root, '[data-manager-grid]');
  const compressionOptions = query<HTMLDivElement>(root, '[data-manager-compression]');
  const compressionNote = query<HTMLElement>(root, '[data-manager-compression-note]');
  const pageNumbers = query<HTMLInputElement>(root, '[data-manager-page-numbers]');
  const watermark = query<HTMLInputElement>(root, '[data-manager-watermark]');
  const opacity = query<HTMLInputElement>(root, '[data-manager-opacity]');
  const opacityValue = query<HTMLOutputElement>(root, '[data-manager-opacity-value]');
  const exportButton = query<HTMLButtonElement>(root, '[data-manager-export]');
  const resultPanel = query<HTMLDivElement>(root, '[data-manager-result]');
  const resultName = query<HTMLElement>(root, '[data-manager-result-name]');
  const resultMetrics = query<HTMLElement>(root, '[data-manager-result-metrics]');
  const resultPreview = query<HTMLImageElement>(root, '[data-manager-result-preview]');
  const resultNote = query<HTMLElement>(root, '[data-manager-result-note]');
  const download = query<HTMLAnchorElement>(root, '[data-manager-download]');
  const editAgainButton = query<HTMLButtonElement>(root, '[data-manager-edit-again]');
  const newButton = query<HTMLButtonElement>(root, '[data-manager-new]');

  let phase: ManagerPhase = 'empty';
  let sourceFile: File | null = null;
  let sourceBytes: Uint8Array | null = null;
  let items: PdfPageItem[] = [];
  let compression: CompressionMode = 'preserve';
  let progress = 0;
  let message = '';
  let error = '';
  let runToken = 0;
  let duplicateCounter = 0;
  let abortController: AbortController | null = null;
  let draggedId = '';
  let resultBlob: Blob | null = null;
  let resultUrl = '';
  let resultPreviewUrl = '';
  let resultDescription = '';
  const thumbnailUrls = new Map<number, string>();

  const isBusy = () => phase === 'loading' || phase === 'processing';

  function setPhase(next: ManagerPhase): void {
    const wasBusy = isBusy();
    phase = next;
    const nowBusy = isBusy();
    if (wasBusy !== nowBusy) options.onBusyChange(nowBusy);
  }

  function revokeThumbnails(): void {
    thumbnailUrls.forEach((url) => URL.revokeObjectURL(url));
    thumbnailUrls.clear();
  }

  function revokeResult(): void {
    if (resultUrl) URL.revokeObjectURL(resultUrl);
    if (resultPreviewUrl) URL.revokeObjectURL(resultPreviewUrl);
    resultUrl = '';
    resultPreviewUrl = '';
    resultBlob = null;
  }

  function renderProgress(): void {
    loadingMessage.textContent = message || '正在准备';
    loadingValue.textContent = `${progress}%`;
    loadingBar.value = progress;
    loadingBar.textContent = `${progress}%`;
  }

  function renderPageGrid(): void {
    grid.replaceChildren(...items.map((item, index) => {
      const card = document.createElement('article');
      card.className = 'manager-page-card';
      card.dataset.pageId = item.id;
      card.draggable = !isBusy();
      card.setAttribute('role', 'listitem');
      card.setAttribute('aria-label', `第 ${index + 1} 位，来自原 PDF 第 ${item.sourcePage} 页，旋转 ${item.rotation} 度`);

      const handle = document.createElement('span');
      handle.className = 'manager-page-handle';
      handle.title = '拖动排序';
      handle.append(createElement(GripVertical, { 'aria-hidden': 'true', width: 15, height: 15 }));

      const order = document.createElement('span');
      order.className = 'manager-page-order';
      order.textContent = String(index + 1).padStart(2, '0');

      const preview = document.createElement('div');
      preview.className = `manager-page-thumb manager-rotation-${item.rotation}`;
      const image = document.createElement('img');
      image.src = thumbnailUrls.get(item.sourcePage) ?? '';
      image.alt = `原 PDF 第 ${item.sourcePage} 页缩略图`;
      preview.append(image);

      const source = document.createElement('span');
      source.className = 'manager-page-source';
      source.textContent = `原第 ${item.sourcePage} 页${item.rotation ? ` · ${item.rotation}°` : ''}`;

      const actions = document.createElement('div');
      actions.className = 'manager-page-actions';
      const moveBack = createIconButton(ArrowLeft, `将第 ${index + 1} 位页面向前移动`, 'back', item.id);
      const moveForward = createIconButton(ArrowRight, `将第 ${index + 1} 位页面向后移动`, 'forward', item.id);
      const rotate = createIconButton(RotateCw, `顺时针旋转原第 ${item.sourcePage} 页`, 'rotate', item.id);
      const duplicate = createIconButton(Copy, `复制原第 ${item.sourcePage} 页`, 'duplicate', item.id);
      const remove = createIconButton(Trash2, `删除第 ${index + 1} 位页面`, 'remove', item.id);
      moveBack.disabled = isBusy() || index === 0;
      moveForward.disabled = isBusy() || index === items.length - 1;
      rotate.disabled = isBusy();
      duplicate.disabled = isBusy() || items.length >= MANAGER_OUTPUT_PAGE_LIMIT;
      remove.disabled = isBusy() || items.length === 1;
      actions.append(moveBack, moveForward, rotate, duplicate, remove);
      card.append(handle, order, preview, source, actions);
      return card;
    }));
  }

  function render(): void {
    const busy = isBusy();
    upload.hidden = phase !== 'empty';
    loading.hidden = !busy;
    editor.hidden = phase !== 'ready' && phase !== 'processing';
    resultPanel.hidden = phase !== 'success';
    errorPanel.hidden = !error;
    errorMessage.textContent = error;
    selectButton.disabled = busy;
    cancelButton.disabled = !busy;
    renderProgress();

    if (sourceFile) {
      fileName.textContent = sourceFile.name;
      fileMeta.textContent = `${formatSize(sourceFile.size)} · 原始 ${thumbnailUrls.size} 页`;
    }
    pageCount.textContent = `${items.length} 页输出`;
    renderPageGrid();

    compressionOptions.querySelectorAll<HTMLButtonElement>('button').forEach((button) => {
      const active = button.dataset.value === compression;
      button.dataset.active = String(active);
      button.setAttribute('aria-pressed', String(active));
      button.disabled = busy;
    });
    compressionNote.textContent = compression === 'preserve'
      ? '保留文字选择、链接和矢量内容；主要用于页面整理与装饰。'
      : '页面会转为 JPEG 图像以减小体积；文字选择、链接和表单将被扁平化。';
    pageNumbers.disabled = busy;
    watermark.disabled = busy;
    opacity.disabled = busy || !watermark.value.trim();
    opacityValue.textContent = `${opacity.value}%`;
    exportButton.disabled = busy || items.length === 0;
    resetButton.disabled = busy;

    if (phase === 'success' && sourceFile && resultBlob) {
      const outputName = `${baseName(sourceFile.name)}-managed.pdf`;
      resultName.textContent = outputName;
      const change = calculateSizeChange(sourceFile.size, resultBlob.size);
      const changeText = change.direction === 'smaller'
        ? `减少 ${change.percent}%`
        : change.direction === 'larger'
          ? `增加 ${change.percent}%`
          : '大小不变';
      resultMetrics.textContent = `源文件 ${formatSize(sourceFile.size)} · 输出 ${formatSize(resultBlob.size)} · ${changeText}`;
      resultPreview.src = resultPreviewUrl;
      resultNote.textContent = resultDescription;
      download.href = resultUrl;
      download.download = outputName;
    }
  }

  function clearAll(): void {
    runToken += 1;
    abortController?.abort();
    abortController = null;
    revokeThumbnails();
    revokeResult();
    sourceFile = null;
    sourceBytes = null;
    items = [];
    progress = 0;
    message = '';
    error = '';
    input.value = '';
    setPhase('empty');
    render();
  }

  async function loadFile(file: File): Promise<void> {
    if (isBusy()) return;
    input.value = '';
    const validation = validatePdfFiles('manage-pdf', [file]);
    if (!validation.ok) {
      error = validation.message ?? 'PDF 文件不符合要求。';
      render();
      return;
    }
    if (file.size > MANAGER_FILE_LIMIT) {
      error = '页面管理的 PDF 不能超过 60 MB。';
      render();
      return;
    }

    clearAll();
    sourceFile = file;
    error = '';
    progress = 2;
    message = '正在读取 PDF';
    const token = ++runToken;
    abortController = new AbortController();
    const { signal } = abortController;
    setPhase('loading');
    render();
    try {
      sourceBytes = new Uint8Array(await file.arrayBuffer());
      const count = await getPdfPageCount(sourceBytes);
      if (count > MANAGER_PAGE_LIMIT) {
        throw new Error(`页面管理一次最多处理 ${MANAGER_PAGE_LIMIT} 页 PDF。`);
      }
      items = createPdfPageItems(count);
      const thumbnails = await renderPdfPages(sourceBytes, {
        format: 'jpeg',
        scale: 0.28,
        quality: 0.68,
        signal,
        onProgress(value, text) {
          if (token !== runToken) return;
          progress = value;
          message = text.replace('正在渲染', '正在生成缩略图');
          renderProgress();
        },
      });
      if (signal.aborted || token !== runToken) return;
      thumbnails.forEach((page) => {
        thumbnailUrls.set(page.pageNumber, URL.createObjectURL(page.blob));
      });
      progress = 100;
      message = '页面已就绪';
      setPhase('ready');
      render();
    } catch (caught) {
      if (signal.aborted || token !== runToken || isPdfRenderCanceled(caught)) return;
      error = caught instanceof Error ? caught.message : '无法读取 PDF。';
      sourceFile = null;
      sourceBytes = null;
      items = [];
      setPhase('empty');
      render();
    } finally {
      if (token === runToken) abortController = null;
    }
  }

  async function buildDecorations(): Promise<PdfDecorationOptions> {
    const watermarkBytes = await createWatermarkBytes(watermark.value);
    return {
      pageNumbers: pageNumbers.checked,
      watermark: watermarkBytes
        ? { bytes: watermarkBytes, opacity: Number(opacity.value) / 100 }
        : undefined,
    };
  }

  async function exportPdf(): Promise<void> {
    if (isBusy() || !sourceFile || !sourceBytes || items.length === 0) return;
    revokeResult();
    error = '';
    progress = 2;
    message = '正在准备页面';
    const token = ++runToken;
    abortController = new AbortController();
    const { signal } = abortController;
    setPhase('processing');
    render();

    try {
      const decorations = await buildDecorations();
      const instructions = items.map(({ sourcePage, rotation }) => ({ sourcePage, rotation }));
      progress = 8;
      message = '正在重建 PDF 结构';
      renderProgress();
      const structural = await rebuildPdfPages(sourceBytes, instructions, decorations);
      if (signal.aborted || token !== runToken) return;

      let output = structural;
      resultDescription = '页面顺序、旋转和装饰已应用，并保留可选择文字与矢量内容。';
      if (compression !== 'preserve') {
        const preset = COMPRESSION_PRESETS[compression];
        const rendered = await renderPdfPages(sourceBytes, {
          format: 'jpeg',
          scale: preset.scale,
          quality: preset.quality,
          pageRequests: items.map(({ sourcePage: pageNumber, rotation }) => ({
            pageNumber,
            rotation,
          })),
          signal,
          onProgress(value, text) {
            if (token !== runToken) return;
            progress = 10 + Math.round(value * 0.68);
            message = text.replace('正在渲染', '正在压缩');
            renderProgress();
          },
        });
        if (signal.aborted || token !== runToken) return;
        progress = 82;
        message = '正在封装压缩页面';
        renderProgress();
        const rasterPages = await Promise.all(rendered.map(async (page) => ({
          bytes: new Uint8Array(await page.blob.arrayBuffer()),
          mimeType: 'image/jpeg' as const,
          pageWidth: page.pageWidth,
          pageHeight: page.pageHeight,
        })));
        const rasterized = await createPdfFromRasterPages(rasterPages, decorations);
        if (rasterized.byteLength < structural.byteLength) {
          output = rasterized;
          resultDescription = compression === 'compact'
            ? '已使用强力页面图像压缩；文字、链接和表单已扁平化。'
            : '已使用标准页面图像压缩；文字、链接和表单已扁平化。';
        } else {
          resultDescription = '图像压缩未能减小此文件，已自动保留体积更小的可编辑结构版本。';
        }
      }

      progress = 92;
      message = '正在生成结果预览';
      renderProgress();
      resultBlob = new Blob([Uint8Array.from(output)], { type: 'application/pdf' });
      resultUrl = URL.createObjectURL(resultBlob);
      const preview = await renderPdfPreview(resultBlob, signal);
      if (signal.aborted || token !== runToken) return;
      resultPreviewUrl = URL.createObjectURL(preview);
      progress = 100;
      message = 'PDF 已生成';
      setPhase('success');
      render();
      void options.persistResults([{
        sourceName: sourceFile.name,
        outputName: `${baseName(sourceFile.name)}-managed.pdf`,
        sourceSize: sourceFile.size,
        blob: resultBlob,
      }]);
    } catch (caught) {
      if (signal.aborted || token !== runToken || isPdfRenderCanceled(caught)) return;
      revokeResult();
      error = caught instanceof Error ? caught.message : 'PDF 页面处理失败，请重试。';
      setPhase('ready');
      render();
    } finally {
      if (token === runToken) abortController = null;
    }
  }

  function cancel(): void {
    if (!isBusy()) return;
    const wasLoading = phase === 'loading';
    runToken += 1;
    abortController?.abort();
    abortController = null;
    if (wasLoading) {
      revokeThumbnails();
      sourceFile = null;
      sourceBytes = null;
      items = [];
      error = '已取消读取 PDF。';
      setPhase('empty');
    } else {
      revokeResult();
      error = '已取消生成，可以继续调整页面。';
      setPhase('ready');
    }
    render();
  }

  function announce(text: string): void {
    announcement.textContent = '';
    requestAnimationFrame(() => { announcement.textContent = text; });
  }

  function handlePageAction(action: string, id: string): void {
    if (isBusy()) return;
    const index = items.findIndex((item) => item.id === id);
    const item = items[index];
    if (!item) return;
    error = '';
    try {
      if (action === 'back' && index > 0) {
        items = movePdfPageItem(items, id, index - 1);
        announce(`页面已移动到第 ${index} 位。`);
      } else if (action === 'forward' && index < items.length - 1) {
        items = movePdfPageItem(items, id, index + 1);
        announce(`页面已移动到第 ${index + 2} 位。`);
      } else if (action === 'rotate') {
        items = rotatePdfPageItem(items, id);
        announce(`原第 ${item.sourcePage} 页已顺时针旋转 90 度。`);
      } else if (action === 'duplicate') {
        if (items.length >= MANAGER_OUTPUT_PAGE_LIMIT) {
          throw new Error(`输出最多包含 ${MANAGER_OUTPUT_PAGE_LIMIT} 页。`);
        }
        items = duplicatePdfPageItem(items, item, `duplicate-page-${++duplicateCounter}`);
        announce(`原第 ${item.sourcePage} 页已复制。`);
      } else if (action === 'remove') {
        items = removePdfPageItem(items, id);
        announce(`第 ${index + 1} 位页面已删除。`);
      }
    } catch (caught) {
      error = caught instanceof Error ? caught.message : '页面操作失败。';
    }
    render();
  }

  selectButton.addEventListener('click', () => input.click());
  input.addEventListener('change', () => {
    const file = input.files?.[0];
    if (file) void loadFile(file);
  });
  cancelButton.addEventListener('click', cancel);
  resetButton.addEventListener('click', clearAll);
  newButton.addEventListener('click', clearAll);
  exportButton.addEventListener('click', () => void exportPdf());
  editAgainButton.addEventListener('click', () => {
    revokeResult();
    error = '';
    setPhase('ready');
    render();
  });
  compressionOptions.addEventListener('click', (event) => {
    const button = (event.target as Element).closest<HTMLButtonElement>('[data-value]');
    const value = button?.dataset.value;
    if (!isBusy() && (value === 'preserve' || value === 'standard' || value === 'compact')) {
      compression = value;
      render();
    }
  });
  watermark.addEventListener('input', render);
  opacity.addEventListener('input', render);
  grid.addEventListener('click', (event) => {
    const button = (event.target as Element).closest<HTMLButtonElement>('[data-page-action]');
    if (button?.dataset.pageAction && button.dataset.pageId) {
      handlePageAction(button.dataset.pageAction, button.dataset.pageId);
    }
  });
  grid.addEventListener('dragstart', (event) => {
    const card = (event.target as Element).closest<HTMLElement>('[data-page-id]');
    if (!card?.dataset.pageId || isBusy()) return;
    draggedId = card.dataset.pageId;
    card.dataset.dragging = 'true';
    event.dataTransfer?.setData('text/plain', draggedId);
  });
  grid.addEventListener('dragover', (event) => {
    if (!draggedId || isBusy()) return;
    const card = (event.target as Element).closest<HTMLElement>('[data-page-id]');
    if (!card || card.dataset.pageId === draggedId) return;
    event.preventDefault();
    grid.querySelectorAll<HTMLElement>('[data-drop-target]').forEach((node) => delete node.dataset.dropTarget);
    card.dataset.dropTarget = 'true';
  });
  grid.addEventListener('drop', (event) => {
    const card = (event.target as Element).closest<HTMLElement>('[data-page-id]');
    if (!draggedId || !card?.dataset.pageId || isBusy()) return;
    event.preventDefault();
    const targetIndex = items.findIndex((item) => item.id === card.dataset.pageId);
    items = movePdfPageItem(items, draggedId, targetIndex);
    announce(`页面顺序已更新。`);
    draggedId = '';
    render();
  });
  grid.addEventListener('dragend', () => {
    draggedId = '';
    grid.querySelectorAll<HTMLElement>('[data-dragging], [data-drop-target]').forEach((node) => {
      delete node.dataset.dragging;
      delete node.dataset.dropTarget;
    });
  });
  for (const eventName of ['dragenter', 'dragover']) {
    upload.addEventListener(eventName, (event) => {
      event.preventDefault();
      upload.dataset.dragging = 'true';
    });
  }
  for (const eventName of ['dragleave', 'drop']) {
    upload.addEventListener(eventName, (event) => {
      event.preventDefault();
      upload.dataset.dragging = 'false';
    });
  }
  upload.addEventListener('drop', (event) => {
    const file = event.dataTransfer?.files[0];
    if (file) void loadFile(file);
  });

  render();
  return {
    reset: clearAll,
    dispose() {
      runToken += 1;
      abortController?.abort();
      revokeThumbnails();
      revokeResult();
      if (isBusy()) options.onBusyChange(false);
    },
  };
}
