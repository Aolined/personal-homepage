import {
  Camera,
  CheckCircle2,
  Crop,
  Crosshair,
  Download,
  Film,
  Gauge,
  Image as ImageIcon,
  Music2,
  Save,
  Scissors,
  SlidersHorizontal,
  Square,
  Trash2,
  Upload,
  X,
  createIcons,
} from 'lucide';

import {
  isVideoConversionCanceled,
  looksLikeMp4,
  validateGifRange,
  validateTrimRange,
  validateVideoDuration,
  validateVideoFile,
  VideoToolboxConverter,
  type CompressSettings,
  type GifFrameRate,
  type GifSettings,
  type GifWidth,
  type TrimSettings,
  type VideoConversionResult,
  type VideoConversionRequest,
  type VideoTool,
} from '../video/video-toolbox';
import {
  validateSnapshotTime,
  validateTransformSettings,
  type ExtractAudioBitrate,
  type ExtractAudioFormat,
  type ExtractAudioSettings,
  type SnapshotFormat,
  type SnapshotSettings,
  type TransformSettings,
  type VideoCrop,
  type VideoRotation,
} from '../video/video-advanced-tools';
import {
  addVideoPreset,
  createVideoPreset,
  parseVideoPresets,
  removeVideoPreset,
  serializeVideoPresets,
  type VideoPreset,
  type VideoPresetSettings,
} from '../video/video-presets';
import { videoWorkbenchTemplate } from './video-workbench-template';
import './video-workbench.css';

export interface VideoPersistResult {
  sourceName: string;
  outputName: string;
  sourceSize: number;
  blob: Blob;
}

interface VideoWorkbenchOptions {
  onBusyChange: (busy: boolean) => void;
  persistResult: (result: VideoPersistResult) => Promise<void>;
}

export interface VideoWorkbenchController {
  reset(): void;
  dispose(): void;
}

interface VideoSelection {
  file: File;
  url: string;
  duration: number;
  width: number;
  height: number;
}

interface VideoResult {
  blob: Blob;
  url: string;
  name: string;
  mimeType: VideoConversionResult['mimeType'];
}

type VideoStatus = 'empty' | 'ready' | 'converting' | 'success' | 'error';

function query<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`Missing video UI element: ${selector}`);
  return element;
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds - minutes * 60;
  return `${minutes}:${remainder.toFixed(1).padStart(4, '0')}`;
}

function readMetadata(url: string): Promise<{ duration: number; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const probe = document.createElement('video');
    const timeout = window.setTimeout(() => {
      probe.removeAttribute('src');
      reject(new Error('读取视频信息超时。'));
    }, 12_000);
    probe.preload = 'metadata';
    probe.onloadedmetadata = () => {
      window.clearTimeout(timeout);
      resolve({
        duration: probe.duration,
        width: probe.videoWidth,
        height: probe.videoHeight,
      });
      probe.removeAttribute('src');
    };
    probe.onerror = () => {
      window.clearTimeout(timeout);
      probe.removeAttribute('src');
      reject(new Error('无法读取视频信息。'));
    };
    probe.src = url;
  });
}

function setPressed(container: HTMLElement, value: string, disabled: boolean): void {
  container.querySelectorAll<HTMLButtonElement>('button').forEach((button) => {
    const active = button.dataset.value === value;
    button.dataset.active = String(active);
    button.setAttribute('aria-pressed', String(active));
    button.disabled = disabled;
  });
}

function selectedValue(event: Event, selector: string): string | undefined {
  return (event.target as Element).closest<HTMLButtonElement>(selector)?.dataset.value;
}

export function mountVideoWorkbench(
  root: HTMLDivElement,
  options: VideoWorkbenchOptions,
): VideoWorkbenchController {
  root.innerHTML = videoWorkbenchTemplate;
  createIcons({
    icons: {
      Camera,
      CheckCircle2,
      Crop,
      Crosshair,
      Download,
      Film,
      Gauge,
      Image: ImageIcon,
      Music2,
      Save,
      Scissors,
      SlidersHorizontal,
      Square,
      Trash2,
      Upload,
      X,
    },
    attrs: { 'aria-hidden': 'true', 'stroke-width': 2 },
  });
  root.querySelectorAll('svg[data-lucide]').forEach((icon) => icon.removeAttribute('data-lucide'));

  const converter = new VideoToolboxConverter();
  const input = query<HTMLInputElement>(root, '[data-video-input]');
  const selectButton = query<HTMLButtonElement>(root, '[data-video-select]');
  const clearButton = query<HTMLButtonElement>(root, '[data-video-clear]');
  const resetButton = query<HTMLButtonElement>(root, '[data-video-reset]');
  const continueButton = query<HTMLButtonElement>(root, '[data-video-continue]');
  const dropZone = query<HTMLDivElement>(root, '[data-video-drop-zone]');
  const empty = query<HTMLDivElement>(root, '[data-video-empty]');
  const source = query<HTMLDivElement>(root, '[data-video-source]');
  const sourcePreview = query<HTMLVideoElement>(root, '[data-video-preview]');
  const sourceName = query<HTMLElement>(root, '[data-video-name]');
  const sourceMeta = query<HTMLElement>(root, '[data-video-meta]');
  const settingsPanel = query<HTMLDivElement>(root, '[data-video-settings]');
  const compressPanel = query<HTMLDivElement>(root, '[data-compress-settings]');
  const trimPanel = query<HTMLDivElement>(root, '[data-trim-settings]');
  const gifPanel = query<HTMLDivElement>(root, '[data-gif-settings]');
  const snapshotPanel = query<HTMLDivElement>(root, '[data-snapshot-settings]');
  const transformPanel = query<HTMLDivElement>(root, '[data-transform-settings]');
  const extractAudioPanel = query<HTMLDivElement>(root, '[data-extract-audio-settings]');
  const qualityOptions = query<HTMLElement>(root, '[data-compress-quality]');
  const resolutionOptions = query<HTMLElement>(root, '[data-compress-resolution]');
  const compressFpsOptions = query<HTMLElement>(root, '[data-compress-fps]');
  const gifWidthOptions = query<HTMLElement>(root, '[data-gif-width]');
  const gifFpsOptions = query<HTMLElement>(root, '[data-gif-fps]');
  const snapshotFormatOptions = query<HTMLElement>(root, '[data-snapshot-format]');
  const transformRotationOptions = query<HTMLElement>(root, '[data-transform-rotation]');
  const transformCropOptions = query<HTMLElement>(root, '[data-transform-crop]');
  const extractAudioFormatOptions = query<HTMLElement>(root, '[data-extract-audio-format]');
  const extractAudioBitrateOptions = query<HTMLElement>(root, '[data-extract-audio-bitrate]');
  const extractBitrateSetting = query<HTMLElement>(root, '[data-extract-bitrate-setting]');
  const compressAudio = query<HTMLInputElement>(root, '[data-compress-audio]');
  const trimAudio = query<HTMLInputElement>(root, '[data-trim-audio]');
  const transformAudio = query<HTMLInputElement>(root, '[data-transform-audio]');
  const trimStart = query<HTMLInputElement>(root, '[data-trim-start]');
  const trimEnd = query<HTMLInputElement>(root, '[data-trim-end]');
  const gifStart = query<HTMLInputElement>(root, '[data-gif-start]');
  const gifEnd = query<HTMLInputElement>(root, '[data-gif-end]');
  const snapshotTime = query<HTMLInputElement>(root, '[data-snapshot-time]');
  const snapshotCurrentButton = query<HTMLButtonElement>(root, '[data-snapshot-current]');
  const trimSummary = query<HTMLElement>(root, '[data-trim-summary]');
  const gifSummary = query<HTMLElement>(root, '[data-gif-summary]');
  const snapshotSummary = query<HTMLElement>(root, '[data-snapshot-summary]');
  const transformSummary = query<HTMLElement>(root, '[data-transform-summary]');
  const presetSelect = query<HTMLSelectElement>(root, '[data-video-preset-select]');
  const presetNameInput = query<HTMLInputElement>(root, '[data-video-preset-name]');
  const presetApplyButton = query<HTMLButtonElement>(root, '[data-video-preset-apply]');
  const presetSaveButton = query<HTMLButtonElement>(root, '[data-video-preset-save]');
  const presetDeleteButton = query<HTMLButtonElement>(root, '[data-video-preset-delete]');
  const presetStatus = query<HTMLElement>(root, '[data-video-preset-status]');
  const runButton = query<HTMLButtonElement>(root, '[data-video-run]');
  const runLabel = query<HTMLElement>(root, '[data-video-run-label]');
  const cancelButton = query<HTMLButtonElement>(root, '[data-video-cancel]');
  const progressPanel = query<HTMLElement>(root, '[data-video-progress]');
  const progressMessage = query<HTMLElement>(root, '[data-video-progress-message]');
  const progressValue = query<HTMLElement>(root, '[data-video-progress-value]');
  const progressBar = query<HTMLProgressElement>(root, '[data-video-progress-bar]');
  const errorPanel = query<HTMLElement>(root, '[data-video-error]');
  const errorMessage = query<HTMLElement>(errorPanel, 'p');
  const resultPanel = query<HTMLElement>(root, '[data-video-result]');
  const resultName = query<HTMLElement>(root, '[data-video-result-name]');
  const resultMeta = query<HTMLElement>(root, '[data-video-result-meta]');
  const resultVideo = query<HTMLVideoElement>(root, '[data-video-result-video]');
  const resultImage = query<HTMLImageElement>(root, '[data-video-result-image]');
  const resultAudio = query<HTMLAudioElement>(root, '[data-video-result-audio]');
  const compareSource = query<HTMLVideoElement>(root, '[data-video-compare-source]');
  const download = query<HTMLAnchorElement>(root, '[data-video-download]');
  const toolButtons = [...root.querySelectorAll<HTMLButtonElement>('[data-video-tool]')];

  let tool: VideoTool = 'compress';
  let status: VideoStatus = 'empty';
  let selection: VideoSelection | null = null;
  let result: VideoResult | null = null;
  let progress = 0;
  let message = '';
  let error = '';
  let runToken = 0;
  let selectionToken = 0;
  let disposed = false;
  const compressSettings: CompressSettings = {
    quality: 'balanced', resolution: 720, frameRate: 'source', removeAudio: false,
  };
  const trimSettings: TrimSettings = { start: 0, end: 0, removeAudio: false };
  const gifSettings: GifSettings = { start: 0, end: 10, width: 640, frameRate: 12 };
  const snapshotSettings: SnapshotSettings = { time: 0, format: 'jpeg' };
  const transformSettings: TransformSettings = {
    rotation: 0, crop: 'source', removeAudio: false,
  };
  const extractAudioSettings: ExtractAudioSettings = { format: 'mp3', bitrate: 192 };
  const presetStorageKey = 'format-workshop-video-presets';
  let presets: VideoPreset[] = [];
  let selectedPresetId = '';
  let presetMessage = '';

  try {
    presets = parseVideoPresets(localStorage.getItem(presetStorageKey));
  } catch {
    presetMessage = '当前浏览器无法读取参数预设。';
  }

  function currentPresetSettings(): VideoPresetSettings {
    return {
      compress: { ...compressSettings },
      transform: { ...transformSettings },
      gif: { width: gifSettings.width, frameRate: gifSettings.frameRate },
      snapshot: { format: snapshotSettings.format },
      audio: { ...extractAudioSettings },
    };
  }

  function persistPresets(): boolean {
    try {
      localStorage.setItem(presetStorageKey, serializeVideoPresets(presets));
      return true;
    } catch {
      presetMessage = '预设未能保存，请检查浏览器存储权限。';
      return false;
    }
  }

  function applySelectedPreset(): void {
    const preset = presets.find((item) => item.id === selectedPresetId);
    if (!preset) {
      presetMessage = '请先选择一个参数预设。';
      render();
      return;
    }
    Object.assign(compressSettings, preset.settings.compress);
    Object.assign(transformSettings, preset.settings.transform);
    gifSettings.width = preset.settings.gif.width;
    gifSettings.frameRate = preset.settings.gif.frameRate;
    snapshotSettings.format = preset.settings.snapshot.format;
    Object.assign(extractAudioSettings, preset.settings.audio);
    presetMessage = `已应用“${preset.name}”。`;
    clearOutcome();
    render();
  }

  function saveCurrentPreset(): void {
    const created = createVideoPreset(
      presetNameInput.value,
      currentPresetSettings(),
      crypto.randomUUID(),
      Date.now(),
    );
    if (!created.ok) {
      presetMessage = created.message;
      render();
      return;
    }
    const previousPresets = presets;
    const previousSelectedId = selectedPresetId;
    presets = addVideoPreset(previousPresets, created.preset);
    selectedPresetId = created.preset.id;
    if (persistPresets()) {
      presetNameInput.value = '';
      presetMessage = `已保存“${created.preset.name}”。`;
    } else {
      presets = previousPresets;
      selectedPresetId = previousSelectedId;
    }
    render();
  }

  function deleteSelectedPreset(): void {
    const preset = presets.find((item) => item.id === selectedPresetId);
    if (!preset) {
      presetMessage = '请先选择要删除的预设。';
      render();
      return;
    }
    const previousPresets = presets;
    presets = removeVideoPreset(previousPresets, preset.id);
    selectedPresetId = '';
    if (persistPresets()) {
      presetMessage = `已删除“${preset.name}”。`;
    } else {
      presets = previousPresets;
      selectedPresetId = preset.id;
    }
    render();
  }

  function revokeResult(): void {
    if (result) URL.revokeObjectURL(result.url);
    result = null;
  }

  function clearOutcome(): void {
    revokeResult();
    progress = 0;
    message = '';
    error = '';
    if (selection) status = 'ready';
  }

  function render(): void {
    const busy = status === 'converting';
    toolButtons.forEach((button) => {
      const active = button.dataset.videoTool === tool;
      button.dataset.active = String(active);
      button.setAttribute('aria-selected', String(active));
      button.disabled = busy;
    });
    empty.hidden = selection !== null;
    source.hidden = selection === null;
    settingsPanel.hidden = selection === null || status === 'success';
    compressPanel.hidden = tool !== 'compress';
    trimPanel.hidden = tool !== 'trim';
    gifPanel.hidden = tool !== 'gif';
    snapshotPanel.hidden = tool !== 'snapshot';
    transformPanel.hidden = tool !== 'transform';
    extractAudioPanel.hidden = tool !== 'audio';
    if (selection) {
      sourceName.textContent = selection.file.name;
      sourceMeta.textContent = `${formatSize(selection.file.size)} · ${selection.width}×${selection.height} · ${formatTime(selection.duration)}`;
      if (sourcePreview.src !== selection.url) sourcePreview.src = selection.url;
    } else {
      sourcePreview.removeAttribute('src');
    }

    setPressed(qualityOptions, compressSettings.quality, busy);
    setPressed(resolutionOptions, String(compressSettings.resolution), busy);
    setPressed(compressFpsOptions, String(compressSettings.frameRate), busy);
    setPressed(gifWidthOptions, String(gifSettings.width), busy);
    setPressed(gifFpsOptions, String(gifSettings.frameRate), busy);
    setPressed(snapshotFormatOptions, snapshotSettings.format, busy);
    setPressed(transformRotationOptions, String(transformSettings.rotation), busy);
    setPressed(transformCropOptions, transformSettings.crop, busy);
    setPressed(extractAudioFormatOptions, extractAudioSettings.format, busy);
    setPressed(extractAudioBitrateOptions, String(extractAudioSettings.bitrate), busy);
    compressAudio.checked = compressSettings.removeAudio;
    trimAudio.checked = trimSettings.removeAudio;
    transformAudio.checked = transformSettings.removeAudio;
    compressAudio.disabled = busy;
    trimAudio.disabled = busy;
    transformAudio.disabled = busy;
    trimStart.value = String(trimSettings.start);
    trimEnd.value = String(trimSettings.end);
    gifStart.value = String(gifSettings.start);
    gifEnd.value = String(gifSettings.end);
    snapshotTime.value = String(snapshotSettings.time);
    [trimStart, trimEnd, gifStart, gifEnd, snapshotTime]
      .forEach((field) => { field.disabled = busy; });
    snapshotCurrentButton.disabled = busy;
    const trimRange = selection
      ? validateTrimRange(trimSettings.start, trimSettings.end, selection.duration)
      : null;
    trimSummary.textContent = trimRange?.ok
      ? `输出片段 ${formatTime(trimRange.duration)}`
      : trimRange?.message ?? '';
    trimSummary.dataset.valid = String(trimRange?.ok ?? false);
    const gifRange = selection
      ? validateGifRange(gifSettings.start, gifSettings.end, selection.duration)
      : null;
    gifSummary.textContent = gifRange?.ok
      ? `GIF 时长 ${formatTime(gifRange.duration)}`
      : gifRange?.message ?? '';
    gifSummary.dataset.valid = String(gifRange?.ok ?? false);

    const snapshotValidation = selection
      ? validateSnapshotTime(snapshotSettings.time, selection.duration)
      : null;
    snapshotSummary.textContent = snapshotValidation?.ok
      ? `将在 ${formatTime(snapshotSettings.time)} 导出单帧图片`
      : snapshotValidation?.message ?? '';
    snapshotSummary.dataset.valid = String(snapshotValidation?.ok ?? false);
    const transformValidation = validateTransformSettings(transformSettings);
    transformSummary.textContent = transformValidation.ok
      ? '输出使用 H.264 视频与兼容的 AAC 音频。'
      : transformValidation.message;
    transformSummary.dataset.valid = String(transformValidation.ok);
    extractBitrateSetting.hidden = extractAudioSettings.format === 'wav';

    const emptyPreset = document.createElement('option');
    emptyPreset.value = '';
    emptyPreset.textContent = presets.length > 0 ? '选择预设' : '暂无预设';
    presetSelect.replaceChildren(
      emptyPreset,
      ...presets.map((preset) => {
        const option = document.createElement('option');
        option.value = preset.id;
        option.textContent = preset.name;
        return option;
      }),
    );
    presetSelect.value = selectedPresetId;
    presetSelect.disabled = busy || presets.length === 0;
    presetNameInput.disabled = busy;
    presetApplyButton.disabled = busy || !selectedPresetId;
    presetSaveButton.disabled = busy;
    presetDeleteButton.disabled = busy || !selectedPresetId;
    presetStatus.textContent = presetMessage;

    const toolValid = tool === 'trim'
      ? trimRange?.ok
      : tool === 'gif'
        ? gifRange?.ok
        : tool === 'snapshot'
          ? snapshotValidation?.ok
          : tool === 'transform'
            ? transformValidation.ok
            : true;
    runButton.disabled = !selection || busy || !toolValid;
    const runLabels: Record<VideoTool, string> = {
      compress: '开始压缩',
      trim: '开始裁剪',
      gif: '生成 GIF',
      snapshot: '导出截图',
      transform: '生成调整后视频',
      audio: '导出音频',
    };
    runLabel.textContent = busy ? '处理中' : runLabels[tool];
    selectButton.disabled = busy;
    clearButton.disabled = busy;

    progressPanel.hidden = status !== 'converting' && !(status === 'ready' && message);
    cancelButton.hidden = status !== 'converting';
    progressMessage.textContent = message || '正在准备';
    progressValue.textContent = `${progress}%`;
    progressBar.value = progress;
    progressBar.textContent = `${progress}%`;
    errorPanel.hidden = !error || busy;
    errorMessage.textContent = error;

    resultPanel.hidden = status !== 'success' || !result;
    if (result && selection) {
      resultName.textContent = result.name;
      resultMeta.textContent = `${formatSize(selection.file.size)} → ${formatSize(result.blob.size)}`;
      const isVideo = result.mimeType === 'video/mp4';
      const isImage = result.mimeType.startsWith('image/');
      const isAudio = result.mimeType.startsWith('audio/');
      resultVideo.hidden = !isVideo;
      resultImage.hidden = !isImage;
      resultAudio.hidden = !isAudio;
      compareSource.src = selection.url;
      if (isVideo) {
        resultVideo.src = result.url;
      } else {
        resultVideo.removeAttribute('src');
      }
      if (isImage) {
        resultImage.src = result.url;
      } else {
        resultImage.removeAttribute('src');
      }
      if (isAudio) {
        resultAudio.src = result.url;
      } else {
        resultAudio.removeAttribute('src');
      }
      download.href = result.url;
      download.download = result.name;
    } else {
      compareSource.removeAttribute('src');
      resultVideo.removeAttribute('src');
      resultImage.removeAttribute('src');
      resultAudio.removeAttribute('src');
      download.removeAttribute('href');
    }
  }

  function reset(): void {
    runToken += 1;
    selectionToken += 1;
    if (status === 'converting') converter.cancel();
    options.onBusyChange(false);
    if (selection) URL.revokeObjectURL(selection.url);
    selection = null;
    revokeResult();
    status = 'empty';
    progress = 0;
    message = '';
    error = '';
    input.value = '';
    render();
  }

  async function selectFile(file: File): Promise<void> {
    if (status === 'converting') return;
    const token = ++selectionToken;
    const validation = validateVideoFile(file);
    if (!validation.ok) {
      reset();
      status = 'error';
      error = validation.message;
      render();
      return;
    }
    const signature = new Uint8Array(await file.slice(0, 64).arrayBuffer());
    if (token !== selectionToken || disposed) return;
    if (!looksLikeMp4(signature)) {
      reset();
      status = 'error';
      error = '文件内容不是有效的 MP4 容器。';
      render();
      return;
    }
    const url = URL.createObjectURL(file);
    try {
      const metadata = await readMetadata(url);
      if (token !== selectionToken || disposed) {
        URL.revokeObjectURL(url);
        return;
      }
      const durationValidation = validateVideoDuration(metadata.duration);
      if (!durationValidation.ok) throw new Error(durationValidation.message);
      if (metadata.width <= 0 || metadata.height <= 0) {
        throw new Error('MP4 文件没有可用的视频轨。');
      }
      if (selection) URL.revokeObjectURL(selection.url);
      revokeResult();
      selection = { file, url, ...metadata };
      status = 'ready';
      progress = 0;
      message = '';
      error = '';
      trimSettings.start = 0;
      trimSettings.end = Math.round(metadata.duration * 10) / 10;
      gifSettings.start = 0;
      gifSettings.end = Math.min(10, Math.round(metadata.duration * 10) / 10);
      snapshotSettings.time = 0;
    } catch (selectionError) {
      URL.revokeObjectURL(url);
      if (token !== selectionToken || disposed) return;
      reset();
      status = 'error';
      error = selectionError instanceof Error ? selectionError.message : '无法读取视频信息。';
    }
    input.value = '';
    render();
  }

  function conversionRequest(): VideoConversionRequest | null {
    if (!selection) return null;
    if (tool === 'compress') {
      return { tool, duration: selection.duration, settings: { ...compressSettings } };
    }
    if (tool === 'trim') {
      return { tool, duration: selection.duration, settings: { ...trimSettings } };
    }
    if (tool === 'gif') {
      return { tool, duration: selection.duration, settings: { ...gifSettings } };
    }
    if (tool === 'snapshot') {
      return { tool, duration: selection.duration, settings: { ...snapshotSettings } };
    }
    if (tool === 'transform') {
      return { tool, duration: selection.duration, settings: { ...transformSettings } };
    }
    return { tool, duration: selection.duration, settings: { ...extractAudioSettings } };
  }

  async function run(): Promise<void> {
    const request = conversionRequest();
    const activeSelection = selection;
    if (!request || !activeSelection || status === 'converting') return;
    clearOutcome();
    status = 'converting';
    const token = ++runToken;
    options.onBusyChange(true);
    render();
    try {
      const converted = await converter.convert(activeSelection.file, request, (value, nextMessage) => {
        if (token !== runToken || disposed) return;
        progress = value;
        message = nextMessage;
        render();
      });
      if (token !== runToken || disposed) return;
      result = { ...converted, url: URL.createObjectURL(converted.blob) };
      status = 'success';
      progress = 100;
      message = '处理完成';
      render();
      void options.persistResult({
        sourceName: activeSelection.file.name,
        outputName: converted.name,
        sourceSize: activeSelection.file.size,
        blob: converted.blob,
      });
    } catch (conversionError) {
      if (token !== runToken || disposed || isVideoConversionCanceled(conversionError)) return;
      status = 'error';
      error = conversionError instanceof Error ? conversionError.message : '视频处理失败。';
      message = '';
      render();
    } finally {
      if (token === runToken && !disposed) options.onBusyChange(false);
    }
  }

  function cancel(): void {
    if (status !== 'converting') return;
    runToken += 1;
    converter.cancel();
    status = 'ready';
    progress = 0;
    message = '已取消处理，可以调整设置后重新开始。';
    error = '';
    options.onBusyChange(false);
    render();
  }

  toolButtons.forEach((button) => button.addEventListener('click', () => {
    if (status === 'converting') return;
    const nextTool = button.dataset.videoTool as VideoTool;
    if (!['compress', 'trim', 'gif', 'snapshot', 'transform', 'audio'].includes(nextTool)) {
      return;
    }
    tool = nextTool;
    clearOutcome();
    render();
  }));
  selectButton.addEventListener('click', () => input.click());
  input.addEventListener('change', () => {
    const file = input.files?.[0];
    if (file) void selectFile(file);
  });
  clearButton.addEventListener('click', reset);
  resetButton.addEventListener('click', reset);
  continueButton.addEventListener('click', () => {
    clearOutcome();
    render();
  });
  runButton.addEventListener('click', () => void run());
  cancelButton.addEventListener('click', cancel);
  for (const eventName of ['dragenter', 'dragover']) {
    dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      if (status !== 'converting') dropZone.dataset.dragging = 'true';
    });
  }
  for (const eventName of ['dragleave', 'drop']) {
    dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropZone.dataset.dragging = 'false';
    });
  }
  dropZone.addEventListener('drop', (event) => {
    if (status === 'converting') return;
    const file = event.dataTransfer?.files[0];
    if (file) void selectFile(file);
  });

  qualityOptions.addEventListener('click', (event) => {
    const value = selectedValue(event, '[data-value]');
    if (value && ['small', 'balanced', 'high'].includes(value)) {
      compressSettings.quality = value as CompressSettings['quality'];
      render();
    }
  });
  resolutionOptions.addEventListener('click', (event) => {
    const value = selectedValue(event, '[data-value]');
    if (value && ['source', '1080', '720', '480'].includes(value)) {
      compressSettings.resolution = value === 'source' ? 'source' : Number(value) as 1080 | 720 | 480;
      render();
    }
  });
  compressFpsOptions.addEventListener('click', (event) => {
    const value = selectedValue(event, '[data-value]');
    if (value && ['source', '30', '24'].includes(value)) {
      compressSettings.frameRate = value === 'source' ? 'source' : Number(value) as 30 | 24;
      render();
    }
  });
  gifWidthOptions.addEventListener('click', (event) => {
    const value = Number(selectedValue(event, '[data-value]')) as GifWidth;
    if ([480, 640, 800].includes(value)) { gifSettings.width = value; render(); }
  });
  gifFpsOptions.addEventListener('click', (event) => {
    const value = Number(selectedValue(event, '[data-value]')) as GifFrameRate;
    if ([8, 12, 15].includes(value)) { gifSettings.frameRate = value; render(); }
  });
  snapshotFormatOptions.addEventListener('click', (event) => {
    const value = selectedValue(event, '[data-value]') as SnapshotFormat | undefined;
    if (value && ['jpeg', 'png'].includes(value)) {
      snapshotSettings.format = value;
      render();
    }
  });
  transformRotationOptions.addEventListener('click', (event) => {
    const value = Number(selectedValue(event, '[data-value]')) as VideoRotation;
    if ([0, 90, 180, 270].includes(value)) {
      transformSettings.rotation = value;
      render();
    }
  });
  transformCropOptions.addEventListener('click', (event) => {
    const value = selectedValue(event, '[data-value]') as VideoCrop | undefined;
    if (value && ['source', 'square', '16:9', '9:16', '4:3'].includes(value)) {
      transformSettings.crop = value;
      render();
    }
  });
  extractAudioFormatOptions.addEventListener('click', (event) => {
    const value = selectedValue(event, '[data-value]') as ExtractAudioFormat | undefined;
    if (value && ['mp3', 'm4a', 'wav'].includes(value)) {
      extractAudioSettings.format = value;
      render();
    }
  });
  extractAudioBitrateOptions.addEventListener('click', (event) => {
    const value = Number(selectedValue(event, '[data-value]')) as ExtractAudioBitrate;
    if ([128, 192, 256].includes(value)) {
      extractAudioSettings.bitrate = value;
      render();
    }
  });
  compressAudio.addEventListener('change', () => { compressSettings.removeAudio = compressAudio.checked; });
  trimAudio.addEventListener('change', () => { trimSettings.removeAudio = trimAudio.checked; });
  transformAudio.addEventListener('change', () => {
    transformSettings.removeAudio = transformAudio.checked;
    render();
  });
  const updateRange = (field: HTMLInputElement, update: (value: number) => void) => {
    field.addEventListener('change', () => {
      const value = Number(field.value);
      update(Number.isFinite(value) ? Math.max(0, value) : 0);
      render();
    });
  };
  updateRange(trimStart, (value) => { trimSettings.start = value; });
  updateRange(trimEnd, (value) => { trimSettings.end = value; });
  updateRange(gifStart, (value) => { gifSettings.start = value; });
  updateRange(gifEnd, (value) => { gifSettings.end = value; });
  updateRange(snapshotTime, (value) => { snapshotSettings.time = value; });
  snapshotCurrentButton.addEventListener('click', () => {
    if (!selection) return;
    const previewTime = Number.isFinite(sourcePreview.currentTime)
      ? sourcePreview.currentTime
      : 0;
    snapshotSettings.time = Math.min(
      Math.max(0, selection.duration - 0.001),
      Math.max(0, Math.round(previewTime * 10) / 10),
    );
    render();
  });
  presetSelect.addEventListener('change', () => {
    selectedPresetId = presetSelect.value;
    presetMessage = '';
    render();
  });
  presetApplyButton.addEventListener('click', applySelectedPreset);
  presetSaveButton.addEventListener('click', saveCurrentPreset);
  presetDeleteButton.addEventListener('click', deleteSelectedPreset);

  render();
  return {
    reset,
    dispose() {
      disposed = true;
      runToken += 1;
      selectionToken += 1;
      converter.dispose();
      options.onBusyChange(false);
      if (selection) URL.revokeObjectURL(selection.url);
      revokeResult();
      root.replaceChildren();
    },
  };
}
