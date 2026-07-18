import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  CheckCircle2,
  Combine,
  Download,
  FileOutput,
  FileText,
  GalleryThumbnails,
  Images,
  Package,
  Plus,
  Scissors,
  Square,
  Trash2,
  X,
  createIcons,
} from 'lucide';

import { convertImage } from '../conversion/image-converter';
import { createResultZip } from '../conversion/result-zip';
import {
  createPdfFromImages,
  getPdfPageCount,
  mergePdfFiles,
  parsePageSelection,
  splitPdfFile,
  validatePdfFiles,
  type PdfSplitMode,
  type PdfTool,
} from '../pdf/pdf-toolbox';
import {
  isPdfRenderCanceled,
  renderPdfPages,
  renderPdfPreview,
  type PdfImageFormat,
} from '../pdf/pdf-renderer';
import { mountPdfPageManager } from './pdf-page-manager';

type PdfWorkbenchTool = PdfTool | 'manage-pdf';

interface PdfWorkbenchOptions {
  onBusyChange: (busy: boolean) => void;
  persistResults: (results: readonly PdfPersistResult[]) => Promise<void>;
}

export interface PdfPersistResult {
  sourceName: string;
  outputName: string;
  sourceSize: number;
  blob: Blob;
}

interface PdfResult extends PdfPersistResult {
  url: string;
  kind: 'pdf' | 'image';
}

interface PdfSelection {
  id: string;
  file: File;
}

export interface PdfWorkbenchController {
  reset(): void;
  dispose(): void;
}

const TOOL_COPY: Record<PdfTool, { title: string; meta: string; action: string }> = {
  'images-to-pdf': {
    title: '选择图片',
    meta: 'JPG、PNG、WebP · 最多 20 张 / 100 MB',
    action: '生成 PDF',
  },
  'pdf-to-images': {
    title: '选择 PDF',
    meta: '输出 JPG 或 PNG · 最大 100 MB / 500 页',
    action: '转换全部页面',
  },
  'merge-pdf': {
    title: '选择多个 PDF',
    meta: '2-10 个文件 · 总计不超过 200 MB',
    action: '合并 PDF',
  },
  'split-pdf': {
    title: '选择 PDF',
    meta: '提取页码或逐页拆分 · 最大 100 MB / 500 页',
    action: '拆分 PDF',
  },
};

const template = `
  <div class="pdf-toolbox-heading">
    <div><h2>PDF 工具箱</h2></div>
    <p>创建、转换和整理 PDF，文件全程留在当前浏览器。</p>
  </div>
  <div class="pdf-tool-tabs" role="tablist" aria-label="PDF 工具">
    <button type="button" role="tab" data-pdf-tool="images-to-pdf"><i data-lucide="Images"></i><span><strong>图片转 PDF</strong><small>多图生成文档</small></span></button>
    <button type="button" role="tab" data-pdf-tool="pdf-to-images"><i data-lucide="FileOutput"></i><span><strong>PDF 转图片</strong><small>JPG / PNG</small></span></button>
    <button type="button" role="tab" data-pdf-tool="merge-pdf"><i data-lucide="Combine"></i><span><strong>合并 PDF</strong><small>按队列顺序</small></span></button>
    <button type="button" role="tab" data-pdf-tool="split-pdf"><i data-lucide="Scissors"></i><span><strong>拆分 PDF</strong><small>页码提取</small></span></button>
    <button type="button" role="tab" data-pdf-tool="manage-pdf"><i data-lucide="GalleryThumbnails"></i><span><strong>页面管理</strong><small>排序 / 压缩 / 水印</small></span></button>
  </div>

  <div data-pdf-common-flow>
  <div class="pdf-drop-zone" data-pdf-drop-zone>
    <input class="visually-hidden" data-pdf-input type="file" tabindex="-1" aria-hidden="true" />
    <div class="pdf-empty" data-pdf-empty>
      <span class="upload-icon" aria-hidden="true"><i data-lucide="FileText"></i></span>
      <div><h3 data-pdf-upload-title></h3><p data-pdf-upload-meta></p></div>
      <button class="button button-upload" type="button" data-pdf-select>选择文件</button>
    </div>
    <div class="pdf-file-stage" data-pdf-file-stage hidden>
      <div class="pdf-source-preview">
        <img data-pdf-source-preview alt="所选文件第一页预览" hidden />
        <span data-pdf-source-placeholder aria-hidden="true"><i data-lucide="FileText"></i></span>
      </div>
      <div class="pdf-file-copy"><strong data-pdf-file-summary></strong><small data-pdf-file-meta></small></div>
      <button class="icon-button" type="button" data-pdf-clear aria-label="清空文件" title="清空文件"><i data-lucide="X"></i></button>
    </div>
  </div>

  <div class="pdf-queue" data-pdf-queue></div>
  <button class="button button-secondary pdf-add" type="button" data-pdf-add hidden><i data-lucide="Plus"></i><span>添加文件</span></button>

  <div class="pdf-settings" data-pdf-settings hidden>
    <div class="pdf-setting" data-image-pdf-settings>
      <span class="control-label">页面尺寸</span>
      <div class="pdf-segmented" data-page-size>
        <button type="button" data-value="image">适应图片</button><button type="button" data-value="a4">A4 页面</button>
      </div>
      <label class="pdf-range" data-pdf-margin><span>页面边距 <output data-margin-value>24 pt</output></span><input type="range" min="0" max="72" step="4" value="24" /></label>
    </div>
    <div class="pdf-setting" data-pdf-image-settings>
      <span class="control-label">输出格式</span>
      <div class="pdf-segmented" data-image-format><button type="button" data-value="jpeg">JPG</button><button type="button" data-value="png">PNG</button></div>
      <span class="control-label">清晰度</span>
      <div class="pdf-segmented" data-render-scale><button type="button" data-value="1">标准</button><button type="button" data-value="1.5">清晰</button><button type="button" data-value="2">高清</button></div>
    </div>
    <div class="pdf-setting" data-split-settings>
      <label class="pdf-page-input"><span>页码范围</span><input type="text" data-page-selection placeholder="例如 1-3,5,8" autocomplete="off" /><small data-page-hint>选择文件后可填写页码</small></label>
      <span class="control-label">输出方式</span>
      <div class="pdf-segmented" data-split-mode><button type="button" data-value="combined">合成一个 PDF</button><button type="button" data-value="individual">每页一个 PDF</button></div>
    </div>
    <button class="button button-primary pdf-run" type="button" data-pdf-run><span data-pdf-run-label></span><i data-lucide="ArrowRight"></i></button>
  </div>

  <div class="progress-panel" data-pdf-progress hidden aria-live="polite">
    <div class="progress-head"><span data-pdf-progress-message></span><div class="progress-actions"><strong data-pdf-progress-value>0%</strong><button class="button button-secondary cancel-button" type="button" data-pdf-cancel><i data-lucide="Square"></i><span>取消</span></button></div></div>
    <progress class="progress-track" data-pdf-progress-bar max="100" value="0">0%</progress>
  </div>
  <div class="error-panel" data-pdf-error hidden role="alert"><span aria-hidden="true">!</span><p></p></div>
  <div class="result-panel pdf-result" data-pdf-result hidden aria-live="polite">
    <div class="result-heading"><span class="success-icon" aria-hidden="true"><i data-lucide="CheckCircle2"></i></span><div><h2>处理完成</h2><p data-pdf-result-summary></p></div></div>
    <div class="pdf-result-preview" data-pdf-result-preview><img alt="PDF 处理结果预览" /></div>
    <div class="result-list" data-pdf-result-list></div>
    <div class="result-actions"><a class="button button-primary" data-pdf-download><i data-lucide="Download"></i><span>下载文件</span></a><button class="button button-primary" type="button" data-pdf-zip><i data-lucide="Package"></i><span>打包下载 ZIP</span></button><button class="button button-secondary" type="button" data-pdf-reset><i data-lucide="Trash2"></i><span>处理其他文件</span></button></div>
  </div>
  </div>
  <div data-pdf-page-manager hidden></div>
`;

function query<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`Missing PDF UI element: ${selector}`);
  return element;
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function baseName(name: string): string {
  return name.replace(/\.[^.]*$/, '').trim() || 'document';
}

function bytesToPdfBlob(bytes: Uint8Array): Blob {
  return new Blob([Uint8Array.from(bytes)], { type: 'application/pdf' });
}

export function mountPdfWorkbench(
  root: HTMLDivElement,
  options: PdfWorkbenchOptions,
): PdfWorkbenchController {
  root.innerHTML = template;
  createIcons({
    root,
    icons: {
      ArrowDown, ArrowRight, ArrowUp, CheckCircle2, Combine, Download,
      FileOutput, FileText, GalleryThumbnails, Images, Package, Plus, Scissors,
      Square, Trash2, X,
    },
    attrs: { 'aria-hidden': 'true', 'stroke-width': 2 },
  });

  const toolButtons = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-pdf-tool]'));
  const commonFlow = query<HTMLDivElement>(root, '[data-pdf-common-flow]');
  const pageManagerRoot = query<HTMLDivElement>(root, '[data-pdf-page-manager]');
  const dropZone = query<HTMLDivElement>(root, '[data-pdf-drop-zone]');
  const input = query<HTMLInputElement>(root, '[data-pdf-input]');
  const selectButton = query<HTMLButtonElement>(root, '[data-pdf-select]');
  const addButton = query<HTMLButtonElement>(root, '[data-pdf-add]');
  const clearButton = query<HTMLButtonElement>(root, '[data-pdf-clear]');
  const empty = query<HTMLDivElement>(root, '[data-pdf-empty]');
  const fileStage = query<HTMLDivElement>(root, '[data-pdf-file-stage]');
  const uploadTitle = query<HTMLElement>(root, '[data-pdf-upload-title]');
  const uploadMeta = query<HTMLElement>(root, '[data-pdf-upload-meta]');
  const sourcePreview = query<HTMLImageElement>(root, '[data-pdf-source-preview]');
  const sourcePlaceholder = query<HTMLElement>(root, '[data-pdf-source-placeholder]');
  const fileSummary = query<HTMLElement>(root, '[data-pdf-file-summary]');
  const fileMeta = query<HTMLElement>(root, '[data-pdf-file-meta]');
  const queue = query<HTMLDivElement>(root, '[data-pdf-queue]');
  const settings = query<HTMLDivElement>(root, '[data-pdf-settings]');
  const imagePdfSettings = query<HTMLDivElement>(root, '[data-image-pdf-settings]');
  const pdfImageSettings = query<HTMLDivElement>(root, '[data-pdf-image-settings]');
  const splitSettings = query<HTMLDivElement>(root, '[data-split-settings]');
  const pageSizeOptions = query<HTMLDivElement>(root, '[data-page-size]');
  const imageFormatOptions = query<HTMLDivElement>(root, '[data-image-format]');
  const renderScaleOptions = query<HTMLDivElement>(root, '[data-render-scale]');
  const splitModeOptions = query<HTMLDivElement>(root, '[data-split-mode]');
  const marginControl = query<HTMLLabelElement>(root, '[data-pdf-margin]');
  const marginInput = query<HTMLInputElement>(marginControl, 'input');
  const marginValue = query<HTMLOutputElement>(root, '[data-margin-value]');
  const pageSelection = query<HTMLInputElement>(root, '[data-page-selection]');
  const pageHint = query<HTMLElement>(root, '[data-page-hint]');
  const runButton = query<HTMLButtonElement>(root, '[data-pdf-run]');
  const runLabel = query<HTMLElement>(root, '[data-pdf-run-label]');
  const progressPanel = query<HTMLElement>(root, '[data-pdf-progress]');
  const progressMessage = query<HTMLElement>(root, '[data-pdf-progress-message]');
  const progressValue = query<HTMLElement>(root, '[data-pdf-progress-value]');
  const progressBar = query<HTMLProgressElement>(root, '[data-pdf-progress-bar]');
  const cancelButton = query<HTMLButtonElement>(root, '[data-pdf-cancel]');
  const errorPanel = query<HTMLElement>(root, '[data-pdf-error]');
  const errorMessage = query<HTMLElement>(errorPanel, 'p');
  const resultPanel = query<HTMLElement>(root, '[data-pdf-result]');
  const resultSummary = query<HTMLElement>(root, '[data-pdf-result-summary]');
  const resultPreview = query<HTMLDivElement>(root, '[data-pdf-result-preview]');
  const resultPreviewImage = query<HTMLImageElement>(resultPreview, 'img');
  const resultList = query<HTMLDivElement>(root, '[data-pdf-result-list]');
  const download = query<HTMLAnchorElement>(root, '[data-pdf-download]');
  const zipButton = query<HTMLButtonElement>(root, '[data-pdf-zip]');
  const resetButton = query<HTMLButtonElement>(root, '[data-pdf-reset]');

  let tool: PdfWorkbenchTool = 'images-to-pdf';
  let files: PdfSelection[] = [];
  let results: PdfResult[] = [];
  let pageCount: number | null = null;
  let pageSize: 'image' | 'a4' = 'image';
  let imageFormat: PdfImageFormat = 'jpeg';
  let renderScale = 1.5;
  let splitMode: PdfSplitMode = 'combined';
  let progress = 0;
  let message = '';
  let error = '';
  let busy = false;
  let inspecting = false;
  let packaging = false;
  let fileCounter = 0;
  let runToken = 0;
  let inspectToken = 0;
  let abortController: AbortController | null = null;
  let inspectAbortController: AbortController | null = null;
  let sourcePreviewUrl = '';
  let resultPreviewUrl = '';
  let managerBusy = false;

  const pageManager = mountPdfPageManager(pageManagerRoot, {
    onBusyChange(value) {
      managerBusy = value;
      options.onBusyChange(value);
      render();
    },
    persistResults: options.persistResults,
  });

  function setBusy(value: boolean): void {
    if (busy === value) return;
    busy = value;
    options.onBusyChange(value);
  }

  function revokeSourcePreview(): void {
    if (sourcePreviewUrl) URL.revokeObjectURL(sourcePreviewUrl);
    sourcePreviewUrl = '';
  }

  function revokeResults(): void {
    results.forEach((result) => URL.revokeObjectURL(result.url));
    results = [];
    if (resultPreviewUrl) URL.revokeObjectURL(resultPreviewUrl);
    resultPreviewUrl = '';
  }

  function isMultiTool(): boolean {
    return tool === 'images-to-pdf' || tool === 'merge-pdf';
  }

  function renderSegment(container: HTMLElement, value: string): void {
    container.querySelectorAll<HTMLButtonElement>('button').forEach((button) => {
      const active = button.dataset.value === value;
      button.dataset.active = String(active);
      button.setAttribute('aria-pressed', String(active));
      button.disabled = busy;
    });
  }

  function render(): void {
    const managerActive = tool === 'manage-pdf';
    commonFlow.hidden = managerActive;
    pageManagerRoot.hidden = !managerActive;
    toolButtons.forEach((button) => {
      const active = button.dataset.pdfTool === tool;
      button.dataset.active = String(active);
      button.setAttribute('aria-selected', String(active));
      button.disabled = busy || managerBusy;
    });
    if (tool === 'manage-pdf') return;
    const copy = TOOL_COPY[tool];
    input.accept = tool === 'images-to-pdf'
      ? 'image/jpeg,image/png,image/webp'
      : 'application/pdf';
    input.multiple = isMultiTool();
    uploadTitle.textContent = copy.title;
    uploadMeta.textContent = copy.meta;
    runLabel.textContent = copy.action;

    const hasFiles = files.length > 0;
    empty.hidden = hasFiles;
    fileStage.hidden = !hasFiles;
    settings.hidden = !hasFiles;
    clearButton.disabled = busy;
    selectButton.disabled = busy;
    addButton.hidden = !hasFiles || !isMultiTool() || busy;
    addButton.disabled = busy;
    imagePdfSettings.hidden = tool !== 'images-to-pdf';
    pdfImageSettings.hidden = tool !== 'pdf-to-images';
    splitSettings.hidden = tool !== 'split-pdf';
    marginControl.hidden = pageSize !== 'a4';

    if (hasFiles) {
      const totalSize = files.reduce((sum, item) => sum + item.file.size, 0);
      fileSummary.textContent = files.length === 1 ? files[0]!.file.name : `${files.length} 个文件已选择`;
      fileMeta.textContent = `${formatSize(totalSize)}${pageCount ? ` · ${pageCount} 页` : ''}`;
      sourcePreview.hidden = !sourcePreviewUrl;
      sourcePlaceholder.hidden = Boolean(sourcePreviewUrl);
      if (sourcePreviewUrl) sourcePreview.src = sourcePreviewUrl;
      else sourcePreview.removeAttribute('src');
    }

    queue.hidden = files.length < 2;
    queue.replaceChildren(...files.map((selection, index) => {
      const row = document.createElement('div');
      row.className = 'pdf-queue-item';
      const order = document.createElement('span');
      order.className = 'file-queue-index';
      order.textContent = String(index + 1).padStart(2, '0');
      const copyNode = document.createElement('span');
      copyNode.className = 'file-queue-copy';
      const name = document.createElement('strong');
      name.textContent = selection.file.name;
      const meta = document.createElement('small');
      meta.textContent = formatSize(selection.file.size);
      copyNode.append(name, meta);
      const actions = document.createElement('span');
      actions.className = 'pdf-queue-actions';
      for (const [direction, label, icon] of [
        ['up', '上移', '↑'], ['down', '下移', '↓'], ['remove', '移除', '×'],
      ] as const) {
        const button = document.createElement('button');
        button.type = 'button';
        button.dataset.queueAction = direction;
        button.dataset.fileId = selection.id;
        button.textContent = icon;
        button.title = label;
        button.setAttribute('aria-label', `${label} ${selection.file.name}`);
        button.disabled = busy || (direction === 'up' && index === 0) || (direction === 'down' && index === files.length - 1);
        actions.append(button);
      }
      row.append(order, copyNode, actions);
      return row;
    }));

    renderSegment(pageSizeOptions, pageSize);
    renderSegment(imageFormatOptions, imageFormat);
    renderSegment(renderScaleOptions, String(renderScale));
    renderSegment(splitModeOptions, splitMode);
    marginInput.disabled = busy;
    marginValue.textContent = `${marginInput.value} pt`;
    pageSelection.disabled = busy;
    pageHint.textContent = pageCount ? `共 ${pageCount} 页，可输入 1-${pageCount}` : '选择文件后可填写页码';
    runButton.disabled = busy || inspecting || !hasFiles || (tool === 'merge-pdf' && files.length < 2);

    progressPanel.hidden = !busy;
    progressMessage.textContent = message || '正在准备';
    progressValue.textContent = `${progress}%`;
    progressBar.value = progress;
    progressBar.textContent = `${progress}%`;
    cancelButton.disabled = !busy;
    errorPanel.hidden = !error;
    errorMessage.textContent = error;

    const hasResults = results.length > 0 && !busy;
    resultPanel.hidden = !hasResults;
    if (hasResults) {
      resultSummary.textContent = results.length === 1 ? results[0]!.outputName : `${results.length} 个文件已生成`;
      resultPreview.hidden = !resultPreviewUrl;
      if (resultPreviewUrl) resultPreviewImage.src = resultPreviewUrl;
      else resultPreviewImage.removeAttribute('src');
      resultList.hidden = results.length === 1;
      resultList.replaceChildren(...results.map((result) => {
        const row = document.createElement('div');
        row.className = 'result-list-item';
        const copyNode = document.createElement('span');
        const name = document.createElement('strong');
        name.textContent = result.outputName;
        const meta = document.createElement('small');
        meta.textContent = `${formatSize(result.blob.size)} · 来自 ${result.sourceName}`;
        copyNode.append(name, meta);
        const link = document.createElement('a');
        link.className = 'result-download';
        link.href = result.url;
        link.download = result.outputName;
        link.textContent = '下载';
        row.append(copyNode, link);
        return row;
      }));
      download.hidden = results.length !== 1;
      if (results[0]) {
        download.href = results[0].url;
        download.download = results[0].outputName;
      }
      zipButton.hidden = results.length < 2;
      zipButton.disabled = packaging;
      zipButton.querySelector('span')!.textContent = packaging ? '正在打包' : '打包下载 ZIP';
    }
  }

  async function updateSourcePreview(selection: PdfSelection): Promise<void> {
    const token = ++inspectToken;
    inspectAbortController?.abort();
    inspectAbortController = null;
    revokeSourcePreview();
    pageCount = null;
    if (selection.file.type.startsWith('image/')) {
      sourcePreviewUrl = URL.createObjectURL(selection.file);
      render();
      return;
    }
    inspectAbortController = new AbortController();
    const { signal } = inspectAbortController;
    inspecting = true;
    message = '正在读取 PDF';
    render();
    try {
      const bytes = new Uint8Array(await selection.file.arrayBuffer());
      const [count, preview] = await Promise.all([
        getPdfPageCount(bytes),
        renderPdfPreview(bytes, signal),
      ]);
      if (token !== inspectToken) return;
      pageCount = count;
      if (tool === 'split-pdf') pageSelection.value = `1-${count}`;
      sourcePreviewUrl = URL.createObjectURL(preview);
      error = '';
    } catch (caught) {
      if (token !== inspectToken) return;
      if (!signal.aborted && !isPdfRenderCanceled(caught)) {
        error = caught instanceof Error ? caught.message : '无法读取 PDF。';
      }
    } finally {
      if (token === inspectToken) {
        inspecting = false;
        inspectAbortController = null;
        message = '';
        render();
      }
    }
  }

  function clearSelection(): void {
    inspectToken += 1;
    inspectAbortController?.abort();
    inspectAbortController = null;
    inspecting = false;
    revokeSourcePreview();
    revokeResults();
    files = [];
    pageCount = null;
    pageSelection.value = '';
    progress = 0;
    message = '';
    error = '';
    input.value = '';
    render();
  }

  function selectFiles(selected: File[], append: boolean): void {
    if (busy || selected.length === 0) return;
    const existing = append ? files.map((item) => item.file) : [];
    const combined = [...existing, ...selected];
    const validation = tool === 'merge-pdf' && combined.length === 1
      ? validatePdfFiles('pdf-to-images', combined)
      : validatePdfFiles(tool, combined);
    if (!validation.ok) {
      error = validation.message ?? '文件不符合要求。';
      render();
      return;
    }
    if (!append) {
      revokeSourcePreview();
      files = [];
    }
    revokeResults();
    files.push(...selected.map((file) => ({ id: `pdf-file-${++fileCounter}`, file })));
    error = '';
    input.value = '';
    render();
    const first = files[0];
    if (first) void updateSourcePreview(first);
  }

  function setTool(next: PdfWorkbenchTool): void {
    if (busy || managerBusy || next === tool) return;
    if (tool === 'manage-pdf') pageManager.reset();
    else clearSelection();
    tool = next;
    render();
  }

  function addResult(blob: Blob, outputName: string, kind: PdfResult['kind'], sourceName: string, sourceSize: number): void {
    results.push({ blob, outputName, kind, sourceName, sourceSize, url: URL.createObjectURL(blob) });
  }

  async function buildResultPreview(signal: AbortSignal): Promise<void> {
    if (resultPreviewUrl) URL.revokeObjectURL(resultPreviewUrl);
    resultPreviewUrl = '';
    const first = results[0];
    if (!first) return;
    if (first.kind === 'image') {
      resultPreviewUrl = first.url;
      return;
    }
    const preview = await renderPdfPreview(first.blob, signal);
    resultPreviewUrl = URL.createObjectURL(preview);
  }

  async function run(): Promise<void> {
    if (busy || tool === 'manage-pdf' || files.length === 0) return;
    const validation = validatePdfFiles(tool, files.map((item) => item.file));
    if (!validation.ok) {
      error = validation.message ?? '文件不符合要求。';
      render();
      return;
    }
    if (tool === 'split-pdf' && !pageCount) {
      error = 'PDF 尚未读取完成，请稍后重试。';
      render();
      return;
    }

    revokeResults();
    error = '';
    progress = 0;
    message = '正在准备';
    const token = ++runToken;
    abortController = new AbortController();
    const { signal } = abortController;
    setBusy(true);
    render();
    const sourceName = files.length === 1 ? files[0]!.file.name : `${files.length} 个文件`;
    const sourceSize = files.reduce((sum, item) => sum + item.file.size, 0);

    try {
      if (tool === 'images-to-pdf') {
        const inputs = [];
        for (const [index, selection] of files.entries()) {
          if (signal.aborted) throw new DOMException('Canceled', 'AbortError');
          progress = Math.round((index / files.length) * 55);
          message = `正在读取图片 ${index + 1}/${files.length}`;
          render();
          if (selection.file.type === 'image/webp') {
            const png = await convertImage(selection.file, 'png');
            inputs.push({ bytes: new Uint8Array(await png.arrayBuffer()), mimeType: 'image/png' as const });
          } else {
            let bitmap: ImageBitmap;
            try {
              bitmap = await createImageBitmap(selection.file);
            } catch {
              throw new Error(`无法读取 ${selection.file.name}，请确认图片完整。`);
            }
            try {
              if (bitmap.width * bitmap.height > 40_000_000) {
                throw new Error(`${selection.file.name} 超过 4000 万像素。`);
              }
            } finally {
              bitmap.close();
            }
            inputs.push({
              bytes: new Uint8Array(await selection.file.arrayBuffer()),
              mimeType: selection.file.type as 'image/jpeg' | 'image/png',
            });
          }
        }
        progress = 70;
        message = '正在生成 PDF';
        render();
        const bytes = await createPdfFromImages(inputs, {
          pageSize,
          margin: Number(marginInput.value),
        });
        if (signal.aborted || token !== runToken) return;
        addResult(bytesToPdfBlob(bytes), files.length === 1 ? `${baseName(files[0]!.file.name)}.pdf` : 'images.pdf', 'pdf', sourceName, sourceSize);
      } else if (tool === 'merge-pdf') {
        message = '正在读取 PDF 队列';
        progress = 20;
        render();
        const sources = [];
        for (const selection of files) sources.push(new Uint8Array(await selection.file.arrayBuffer()));
        progress = 55;
        message = '正在合并页面';
        render();
        const bytes = await mergePdfFiles(sources);
        if (signal.aborted || token !== runToken) return;
        addResult(bytesToPdfBlob(bytes), 'merged.pdf', 'pdf', sourceName, sourceSize);
      } else if (tool === 'split-pdf') {
        const first = files[0]!;
        const selectedPages = parsePageSelection(pageSelection.value, pageCount!);
        progress = 25;
        message = '正在提取页面';
        render();
        const outputs = await splitPdfFile(new Uint8Array(await first.file.arrayBuffer()), selectedPages, splitMode);
        if (signal.aborted || token !== runToken) return;
        outputs.forEach((bytes, index) => {
          const suffix = splitMode === 'combined'
            ? '-selected-pages.pdf'
            : `-page-${selectedPages[index]}.pdf`;
          addResult(bytesToPdfBlob(bytes), `${baseName(first.file.name)}${suffix}`, 'pdf', first.file.name, first.file.size);
        });
      } else {
        const first = files[0]!;
        const extension = imageFormat === 'jpeg' ? 'jpg' : 'png';
        const rendered = await renderPdfPages(first.file, {
          format: imageFormat,
          scale: renderScale,
          signal,
          onProgress: (value, text) => {
            if (token !== runToken) return;
            progress = value;
            message = text;
            render();
          },
        });
        const digits = String(rendered.length).length;
        rendered.forEach((page) => addResult(
          page.blob,
          `${baseName(first.file.name)}-page-${String(page.pageNumber).padStart(digits, '0')}.${extension}`,
          'image',
          first.file.name,
          first.file.size,
        ));
      }

      if (signal.aborted || token !== runToken) return;
      progress = 94;
      message = '正在生成预览';
      render();
      await buildResultPreview(signal);
      if (signal.aborted || token !== runToken) return;
      progress = 100;
      message = '处理完成';
      setBusy(false);
      render();
      void options.persistResults(results.slice(0, 10).map(({ sourceName: source, outputName, sourceSize: size, blob }) => ({
        sourceName: source,
        outputName,
        sourceSize: size,
        blob,
      })));
    } catch (caught) {
      if (token !== runToken || signal.aborted || isPdfRenderCanceled(caught)) return;
      revokeResults();
      error = caught instanceof Error ? caught.message : 'PDF 处理失败，请重试。';
      message = '';
      setBusy(false);
      render();
    } finally {
      if (token === runToken) {
        abortController = null;
        if (busy) {
          setBusy(false);
          render();
        }
      }
    }
  }

  function cancel(): void {
    if (!busy) return;
    runToken += 1;
    abortController?.abort();
    abortController = null;
    revokeResults();
    progress = 0;
    message = '';
    error = '已取消处理，可以调整设置后重新开始。';
    setBusy(false);
    render();
  }

  async function downloadZip(): Promise<void> {
    if (results.length < 2 || packaging) return;
    packaging = true;
    render();
    try {
      const archive = await createResultZip(results.map((result) => ({ name: result.outputName, blob: result.blob })));
      const url = URL.createObjectURL(archive);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'pdf-results.zip';
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      error = '打包失败，仍可逐个下载结果。';
    } finally {
      packaging = false;
      render();
    }
  }

  toolButtons.forEach((button) => button.addEventListener('click', () => {
    const next = button.dataset.pdfTool as PdfWorkbenchTool | undefined;
    if (next) setTool(next);
  }));
  selectButton.addEventListener('click', () => input.click());
  addButton.addEventListener('click', () => input.click());
  clearButton.addEventListener('click', clearSelection);
  resetButton.addEventListener('click', clearSelection);
  input.addEventListener('change', () => selectFiles(Array.from(input.files ?? []), isMultiTool() && files.length > 0));
  runButton.addEventListener('click', () => void run());
  cancelButton.addEventListener('click', cancel);
  zipButton.addEventListener('click', () => void downloadZip());
  marginInput.addEventListener('input', render);

  for (const [container, setter] of [
    [pageSizeOptions, (value: string) => { if (value === 'image' || value === 'a4') pageSize = value; }],
    [imageFormatOptions, (value: string) => { if (value === 'jpeg' || value === 'png') imageFormat = value; }],
    [renderScaleOptions, (value: string) => { const parsed = Number(value); if ([1, 1.5, 2].includes(parsed)) renderScale = parsed; }],
    [splitModeOptions, (value: string) => { if (value === 'combined' || value === 'individual') splitMode = value; }],
  ] as const) {
    container.addEventListener('click', (event) => {
      const button = (event.target as Element).closest<HTMLButtonElement>('[data-value]');
      if (!button?.dataset.value || busy) return;
      setter(button.dataset.value);
      render();
    });
  }

  queue.addEventListener('click', (event) => {
    const button = (event.target as Element).closest<HTMLButtonElement>('[data-queue-action]');
    const index = files.findIndex((item) => item.id === button?.dataset.fileId);
    if (!button || index < 0 || busy) return;
    const action = button.dataset.queueAction;
    if (action === 'remove') files.splice(index, 1);
    if (action === 'up' && index > 0) [files[index - 1], files[index]] = [files[index]!, files[index - 1]!];
    if (action === 'down' && index < files.length - 1) [files[index], files[index + 1]] = [files[index + 1]!, files[index]!];
    revokeResults();
    if (files.length === 0) clearSelection();
    else {
      render();
      void updateSourcePreview(files[0]!);
    }
  });

  for (const eventName of ['dragenter', 'dragover']) {
    dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropZone.dataset.dragging = 'true';
    });
  }
  for (const eventName of ['dragleave', 'drop']) {
    dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropZone.dataset.dragging = 'false';
    });
  }
  dropZone.addEventListener('drop', (event) => selectFiles(
    Array.from(event.dataTransfer?.files ?? []),
    isMultiTool() && files.length > 0,
  ));

  render();
  return {
    reset() {
      clearSelection();
      pageManager.reset();
    },
    dispose() {
      runToken += 1;
      inspectToken += 1;
      abortController?.abort();
      inspectAbortController?.abort();
      revokeSourcePreview();
      revokeResults();
      pageManager.dispose();
      setBusy(false);
    },
  };
}
