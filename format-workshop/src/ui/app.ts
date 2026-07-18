import {
  buildBatchOutputName,
  buildOutputName,
  getAvailableTargets,
  inspectFolderFiles,
  validateFileBatch,
  type AudioFormat,
  type ImageFormat,
  type TargetFormat,
  type ValidatedSource,
} from '../conversion/file-validation';
import { convertImage } from '../conversion/image-converter';
import {
  isConversionCanceled,
  MediaToAudioConverter,
  type AudioBitrate,
  type AudioChannels,
  type AudioSampleRate,
} from '../conversion/audio-converter';
import { createResultZip } from '../conversion/result-zip';
import {
  addHistoryRecords,
  clearHistoryRecords,
  deleteHistoryRecord,
  listHistoryRecords,
  type ConversionHistoryRecord,
} from '../history/conversion-history';
import {
  calculateBatchProgress,
  isBusy,
  type AppMode,
  type AppViewModel,
  type ConversionResultView,
  type SelectedFileView,
} from './types';
import { createWorkbenchView } from './view';
import type { PdfPersistResult, PdfWorkbenchController } from './pdf-workbench';
import type { VideoPersistResult, VideoWorkbenchController } from './video-workbench';
import {
  addStandardPreset,
  createStandardPreset,
  parseLastSettings,
  parseStandardPresets,
  removeStandardPreset,
  serializeLastSettings,
  serializeStandardPresets,
  type StandardPreset,
  type StandardPresetScope,
} from './settings-presets';

function parseDimension(value: string): number | null {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.min(12_000, parsed);
}

function parseBoundedNumber(
  value: string,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, parsed));
}

export function mountApp(root: HTMLDivElement): () => void {
  const view = createWorkbenchView(root);
  const mediaConverter = new MediaToAudioConverter();
  let pdfWorkbench: PdfWorkbenchController | null = null;
  let videoWorkbench: VideoWorkbenchController | null = null;
  let fileId = 0;
  let conversionRunToken = 0;
  let historyLoadToken = 0;
  let disposed = false;
  const imageStorageKey = 'format-workshop-image-presets';
  const mediaStorageKey = 'format-workshop-media-presets';
  const lastImageSettingsKey = 'format-workshop-last-image-settings';
  const lastMediaSettingsKey = 'format-workshop-last-media-settings';
  const defaultImageSettings = {
    quality: 90,
    maxWidth: null,
    maxHeight: null,
    rotation: 0 as const,
    flipHorizontal: false,
    flipVertical: false,
    watermarkText: '',
    watermarkPosition: 'bottom-right' as const,
    watermarkOpacity: 70,
    renameBase: '',
  };
  const defaultAudioSettings = {
    bitrate: 192 as const,
    sampleRate: 'source' as const,
    channels: 'source' as const,
    trimStart: 0,
    trimEnd: null,
    volume: 100,
    normalize: false,
    speed: 1 as const,
    fadeIn: 0,
    fadeOut: 0,
  };
  const cloneImageSettings = () => ({ ...defaultImageSettings });
  const cloneAudioSettings = () => ({ ...defaultAudioSettings });
  const readStorage = (key: string): string | null => {
    try { return localStorage.getItem(key); } catch { return null; }
  };
  const storedImageSettings = parseLastSettings(readStorage(lastImageSettingsKey), 'image');
  const storedAudioSettings = parseLastSettings(readStorage(lastMediaSettingsKey), 'media');
  let imagePresets: StandardPreset[] = parseStandardPresets(readStorage(imageStorageKey), 'image');
  let mediaPresets: StandardPreset[] = parseStandardPresets(readStorage(mediaStorageKey), 'media');
  let lastImageSettings = storedImageSettings && 'quality' in storedImageSettings
    ? { ...storedImageSettings }
    : null;
  let lastAudioSettings = storedAudioSettings && 'bitrate' in storedAudioSettings
    ? { ...storedAudioSettings }
    : null;
  const model: AppViewModel = {
    mode: 'image',
    status: 'empty',
    selectedFiles: [],
    targetOptions: [],
    target: null,
    progress: 0,
    message: '',
    error: '',
    results: [],
    failedFiles: [],
    isPackagingZip: false,
    history: [],
    historyLoading: true,
    historyBusy: false,
    historyError: '',
    folderNotice: '',
    imageSettings: storedImageSettings && 'quality' in storedImageSettings
      ? { ...storedImageSettings }
      : cloneImageSettings(),
    audioSettings: storedAudioSettings && 'bitrate' in storedAudioSettings
      ? { ...storedAudioSettings }
      : cloneAudioSettings(),
    standardPresets: imagePresets,
    selectedPresetId: '',
    presetMessage: '',
    lastSettingsAvailable: Boolean(storedImageSettings),
    videoBusy: false,
    pdfBusy: false,
  };

  const render = () => view.render(model);

  function updateStandardScope(): void {
    const scope: StandardPresetScope = model.mode === 'media' ? 'media' : 'image';
    model.standardPresets = scope === 'image' ? imagePresets : mediaPresets;
    model.lastSettingsAvailable = scope === 'image'
      ? Boolean(lastImageSettings)
      : Boolean(lastAudioSettings);
  }

  function persistPresets(scope: StandardPresetScope): boolean {
    try {
      localStorage.setItem(
        scope === 'image' ? imageStorageKey : mediaStorageKey,
        serializeStandardPresets(scope === 'image' ? imagePresets : mediaPresets),
      );
      return true;
    } catch {
      model.presetMessage = '预设未能保存，请检查浏览器存储权限。';
      return false;
    }
  }

  function saveLastSettings(scope: StandardPresetScope): void {
    const settings = scope === 'image' ? model.imageSettings : model.audioSettings;
    try {
      localStorage.setItem(
        scope === 'image' ? lastImageSettingsKey : lastMediaSettingsKey,
        serializeLastSettings(scope, settings),
      );
      if (scope === 'image') lastImageSettings = { ...model.imageSettings };
      else lastAudioSettings = { ...model.audioSettings };
      updateStandardScope();
    } catch {
      model.presetMessage = '上次设置未能保存，请检查浏览器存储权限。';
    }
  }

  function currentPresetScope(): StandardPresetScope | null {
    return model.mode === 'image' || model.mode === 'media' ? model.mode : null;
  }

  function applySelectedStandardPreset(): void {
    const scope = currentPresetScope();
    if (!scope) return;
    const presets = scope === 'image' ? imagePresets : mediaPresets;
    const preset = presets.find((item) => item.id === model.selectedPresetId);
    if (!preset) {
      model.presetMessage = '请先选择一个参数预设。';
      render();
      return;
    }
    if (scope === 'image') model.imageSettings = { ...preset.settings } as typeof model.imageSettings;
    else model.audioSettings = { ...preset.settings } as typeof model.audioSettings;
    saveLastSettings(scope);
    model.presetMessage = `已应用“${preset.name}”。`;
    resetOutcome();
    render();
  }

  function saveStandardPreset(): void {
    const scope = currentPresetScope();
    if (!scope) return;
    const created = createStandardPreset(
      scope,
      view.elements.standardPresetNameInput.value,
      scope === 'image' ? model.imageSettings : model.audioSettings,
      crypto.randomUUID(),
      Date.now(),
    );
    if (!created.ok) {
      model.presetMessage = created.message;
      render();
      return;
    }
    const previous = scope === 'image' ? imagePresets : mediaPresets;
    const next = addStandardPreset(previous, created.preset);
    if (scope === 'image') imagePresets = next;
    else mediaPresets = next;
    const previousSelected = model.selectedPresetId;
    model.selectedPresetId = created.preset.id;
    if (persistPresets(scope)) {
      view.elements.standardPresetNameInput.value = '';
      model.presetMessage = `已保存“${created.preset.name}”。`;
    } else {
      if (scope === 'image') imagePresets = previous;
      else mediaPresets = previous;
      model.selectedPresetId = previousSelected;
    }
    updateStandardScope();
    render();
  }

  function deleteSelectedStandardPreset(): void {
    const scope = currentPresetScope();
    if (!scope) return;
    const presets = scope === 'image' ? imagePresets : mediaPresets;
    const preset = presets.find((item) => item.id === model.selectedPresetId);
    if (!preset) {
      model.presetMessage = '请先选择要删除的预设。';
      render();
      return;
    }
    const next = removeStandardPreset(presets, preset.id);
    if (scope === 'image') imagePresets = next;
    else mediaPresets = next;
    model.selectedPresetId = '';
    if (persistPresets(scope)) model.presetMessage = `已删除“${preset.name}”。`;
    else {
      if (scope === 'image') imagePresets = presets;
      else mediaPresets = presets;
      model.selectedPresetId = preset.id;
    }
    updateStandardScope();
    render();
  }

  function applyLastSettings(): void {
    const scope = currentPresetScope();
    if (!scope) return;
    if (scope === 'image' && lastImageSettings) model.imageSettings = { ...lastImageSettings };
    else if (scope === 'media' && lastAudioSettings) model.audioSettings = { ...lastAudioSettings };
    else {
      model.presetMessage = '还没有保存过上次设置。';
      render();
      return;
    }
    model.presetMessage = '已恢复上次设置。';
    resetOutcome();
    render();
  }

  updateStandardScope();

  function revokeHistoryUrls(): void {
    model.history.forEach((record) => URL.revokeObjectURL(record.url));
    model.history = [];
  }

  async function refreshHistory(): Promise<void> {
    if (disposed) return;
    const loadToken = ++historyLoadToken;
    model.historyLoading = true;
    model.historyError = '';
    render();
    try {
      const records = await listHistoryRecords();
      if (disposed || loadToken !== historyLoadToken) return;
      revokeHistoryUrls();
      model.history = records.map((record) => ({
        id: record.id,
        sourceName: record.sourceName,
        outputName: record.outputName,
        kind: record.kind,
        sourceSize: record.sourceSize,
        outputSize: record.outputSize,
        createdAt: record.createdAt,
        url: URL.createObjectURL(record.blob),
      }));
    } catch {
      if (loadToken === historyLoadToken) {
        model.historyError = '暂时无法读取此浏览器中的转换记录。';
      }
    } finally {
      if (loadToken === historyLoadToken) {
        model.historyLoading = false;
        render();
      }
    }
  }

  function revokeResultUrls(): void {
    model.results.forEach((result) => URL.revokeObjectURL(result.url));
    model.results = [];
  }

  function revokeAllUrls(): void {
    model.selectedFiles.forEach((selected) =>
      URL.revokeObjectURL(selected.previewUrl),
    );
    revokeResultUrls();
  }

  function resetOutcome(): void {
    revokeResultUrls();
    model.progress = 0;
    model.message = '';
    model.error = '';
    model.failedFiles = [];
    model.isPackagingZip = false;
  }

  function clearFiles(): void {
    revokeAllUrls();
    model.status = 'empty';
    model.selectedFiles = [];
    model.targetOptions = [];
    model.target = null;
    model.progress = 0;
    model.message = '';
    model.error = '';
    model.failedFiles = [];
    model.folderNotice = '';
    view.elements.fileInput.value = '';
    view.elements.folderInput.value = '';
    render();
  }

  async function setMode(mode: AppMode): Promise<void> {
    if (isBusy(model.status) || model.videoBusy || model.pdfBusy) return;
    if (model.mode === mode && model.status !== 'success') return;
    if (model.mode === 'pdf') pdfWorkbench?.reset();
    else if (model.mode === 'video') videoWorkbench?.reset();
    else clearFiles();
    model.mode = mode;
    model.selectedPresetId = '';
    model.presetMessage = '';
    model.folderNotice = '';
    updateStandardScope();
    if (mode === 'video' && !videoWorkbench) {
      model.videoBusy = true;
      view.elements.videoWorkbench.textContent = '正在加载本地视频引擎…';
      render();
      try {
        const { mountVideoWorkbench } = await import('./video-workbench');
        if (disposed) return;
        videoWorkbench = mountVideoWorkbench(view.elements.videoWorkbench, {
          onBusyChange(busy) {
            model.videoBusy = busy;
            render();
          },
          persistResult: persistVideoResult,
        });
      } catch {
        if (!disposed) {
          view.elements.videoWorkbench.textContent = '视频工具箱加载失败，请刷新页面后重试。';
        }
      } finally {
        if (!disposed) model.videoBusy = false;
      }
    }
    if (mode === 'pdf' && !pdfWorkbench) {
      model.pdfBusy = true;
      view.elements.pdfWorkbench.textContent = '正在加载 PDF 本地引擎…';
      render();
      try {
        const { mountPdfWorkbench } = await import('./pdf-workbench');
        if (disposed) return;
        pdfWorkbench = mountPdfWorkbench(view.elements.pdfWorkbench, {
          onBusyChange(busy) {
            model.pdfBusy = busy;
            render();
          },
          persistResults: persistPdfResults,
        });
      } catch {
        if (!disposed) {
          view.elements.pdfWorkbench.textContent = 'PDF 本地引擎加载失败，请刷新页面后重试。';
        }
      } finally {
        if (!disposed) model.pdfBusy = false;
      }
    }
    render();
  }

  function toSelectedFile(
    file: File,
    entry: ValidatedSource,
  ): SelectedFileView {
    fileId += 1;
    const base = {
      id: `file-${fileId}`,
      file,
      previewUrl: URL.createObjectURL(file),
    };
    return entry.kind === 'image'
      ? { ...base, kind: 'image', sourceFormat: entry.sourceFormat }
      : { ...base, kind: 'media', sourceFormat: entry.sourceFormat };
  }

  function selectFiles(files: File[], append: boolean, folderNotice = ''): void {
    if (isBusy(model.status) || files.length === 0) return;
    const mode = model.mode;
    if (mode === 'pdf' || mode === 'video') return;
    const existingFiles = append
      ? model.selectedFiles.map((selected) => selected.file)
      : [];
    const combined = [...existingFiles, ...files];
    const validation = validateFileBatch(combined, mode);
    model.folderNotice = folderNotice;

    if (!validation.ok) {
      if (!append) clearFiles();
      model.status = model.selectedFiles.length > 0 ? 'ready' : 'error';
      model.error = validation.message;
      render();
      return;
    }

    if (!append) {
      revokeAllUrls();
      model.selectedFiles = [];
    } else {
      resetOutcome();
    }

    const startIndex = existingFiles.length;
    const firstEntry = validation.entries[0];
    if (!firstEntry) return;
    const newSelections: SelectedFileView[] = [];
    files.forEach((file, index) => {
      const entry = validation.entries[startIndex + index];
      if (entry) newSelections.push(toSelectedFile(file, entry));
    });
    model.selectedFiles.push(...newSelections);
    if (mode === 'media') {
      model.audioSettings.trimStart = 0;
      model.audioSettings.trimEnd = null;
    }
    model.status = 'ready';
    model.targetOptions = getAvailableTargets(
      firstEntry.kind,
      firstEntry.sourceFormat,
    );
    if (!model.target || !model.targetOptions.includes(model.target)) {
      model.target = mode === 'image' ? 'webp' : model.targetOptions[0] ?? null;
    }
    model.progress = 0;
    model.message = '';
    model.error = '';
    model.failedFiles = [];
    view.elements.fileInput.value = '';
    view.elements.folderInput.value = '';
    render();
  }

  function removeFile(id: string): void {
    if (isBusy(model.status)) return;
    const selected = model.selectedFiles.find((item) => item.id === id);
    if (!selected) return;
    URL.revokeObjectURL(selected.previewUrl);
    model.selectedFiles = model.selectedFiles.filter((item) => item.id !== id);
    resetOutcome();
    if (model.selectedFiles.length === 0) {
      model.status = 'empty';
      model.targetOptions = [];
      model.target = null;
    } else {
      model.status = 'ready';
    }
    render();
  }

  function toHistoryRecord(result: ConversionResultView): ConversionHistoryRecord {
    return {
      id: `${Date.now()}-${crypto.randomUUID()}`,
      sourceName: result.sourceName,
      outputName: result.name,
      kind: result.kind,
      sourceSize: result.sourceSize,
      outputSize: result.outputSize,
      createdAt: Date.now(),
      blob: result.blob,
    };
  }

  async function persistResults(results: readonly ConversionResultView[]): Promise<void> {
    if (results.length === 0) return;
    model.historyBusy = true;
    render();
    try {
      await addHistoryRecords(results.map(toHistoryRecord));
      if (disposed) return;
      await refreshHistory();
    } catch {
      if (disposed) return;
      model.historyError = '结果已生成，但未能保存到此浏览器的最近记录。';
      render();
    } finally {
      if (!disposed) {
        model.historyBusy = false;
        render();
      }
    }
  }

  async function convert(retryFailed = false): Promise<void> {
    if (
      model.selectedFiles.length === 0 ||
      !model.target ||
      isBusy(model.status)
    ) {
      return;
    }

    const failedIds = new Set(model.failedFiles.map((failed) => failed.sourceId));
    const files = retryFailed
      ? model.selectedFiles.filter((selected) => failedIds.has(selected.id))
      : [...model.selectedFiles];
    if (files.length === 0) return;

    if (retryFailed) {
      model.progress = 0;
      model.message = '';
      model.error = '';
      model.failedFiles = [];
    } else {
      resetOutcome();
    }
    model.status = 'converting';
    const runToken = ++conversionRunToken;
    render();

    const target = model.target;
    const newResults: ConversionResultView[] = [];

    for (const [index, selected] of files.entries()) {
      const updateProgress = (fileProgress: number) => {
        if (runToken !== conversionRunToken) return;
        model.progress = calculateBatchProgress(index, files.length, fileProgress);
        model.message = `正在转换 ${index + 1}/${files.length} · ${selected.file.name}`;
        render();
      };

      try {
        const blob = selected.kind === 'image'
          ? await convertImage(
              selected.file,
              target as ImageFormat,
              updateProgress,
              {
                quality: model.imageSettings.quality,
                maxWidth: model.imageSettings.maxWidth ?? undefined,
                maxHeight: model.imageSettings.maxHeight ?? undefined,
                rotation: model.imageSettings.rotation,
                flipHorizontal: model.imageSettings.flipHorizontal,
                flipVertical: model.imageSettings.flipVertical,
                watermarkText: model.imageSettings.watermarkText,
                watermarkPosition: model.imageSettings.watermarkPosition,
                watermarkOpacity: model.imageSettings.watermarkOpacity,
              },
            )
          : await mediaConverter.convert(
              selected.file,
              selected.sourceFormat,
              target as AudioFormat,
              updateProgress,
              {
                ...model.audioSettings,
                sourceDuration: selected.duration ?? null,
              },
            );

        if (runToken !== conversionRunToken) return;
        const result: ConversionResultView = {
          sourceId: selected.id,
          sourceName: selected.file.name,
          blob,
          url: URL.createObjectURL(blob),
          name: selected.kind === 'image'
            ? buildBatchOutputName(
                selected.file.name,
                target,
                model.imageSettings.renameBase,
                model.selectedFiles.indexOf(selected),
                model.selectedFiles.length,
              )
            : buildOutputName(selected.file.name, target),
          kind: selected.kind === 'image' ? 'image' : 'audio',
          sourceSize: selected.file.size,
          outputSize: blob.size,
        };
        model.results.push(result);
        newResults.push(result);
      } catch (error) {
        if (runToken !== conversionRunToken || isConversionCanceled(error)) return;
        model.failedFiles.push({
          sourceId: selected.id,
          sourceName: selected.file.name,
        });
      }
    }

    if (runToken !== conversionRunToken) return;
    if (model.results.length === 0) {
      model.status = 'error';
      model.error = files.length === 1
        ? '转换失败，请确认文件完整后重试。'
        : '这批文件均未能转换，请检查文件后重试。';
    } else {
      model.status = 'success';
      model.progress = 100;
      model.message = '转换完成';
      if (model.failedFiles.length > 0) {
        model.error = `${model.failedFiles.length} 个文件转换失败，其他结果仍可下载。`;
      }
    }
    render();
    void persistResults(newResults);
  }

  function cancelConversion(): void {
    if (!isBusy(model.status)) return;
    conversionRunToken += 1;
    mediaConverter.cancel();
    model.status = 'ready';
    model.message = model.results.length > 0
      ? `已取消后续转换，${model.results.length} 个已完成结果仍可下载。`
      : '已取消转换，可以调整设置后重新开始。';
    model.error = '';
    render();
  }

  async function downloadResultZip(): Promise<void> {
    if (model.results.length < 2 || model.isPackagingZip) return;
    model.isPackagingZip = true;
    render();
    try {
      const archive = await createResultZip(model.results);
      const url = URL.createObjectURL(archive);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'converted-files.zip';
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      model.error = '打包失败，仍可逐个下载转换结果。';
    } finally {
      model.isPackagingZip = false;
      render();
    }
  }

  async function deleteHistory(id: string): Promise<void> {
    if (model.historyBusy) return;
    model.historyBusy = true;
    render();
    try {
      await deleteHistoryRecord(id);
      await refreshHistory();
    } catch {
      model.historyError = '删除本地记录失败，请稍后重试。';
    } finally {
      model.historyBusy = false;
      render();
    }
  }

  async function clearHistory(): Promise<void> {
    if (model.historyBusy || model.history.length === 0) return;
    model.historyBusy = true;
    render();
    try {
      await clearHistoryRecords();
      await refreshHistory();
    } catch {
      model.historyError = '清空本地记录失败，请稍后重试。';
    } finally {
      model.historyBusy = false;
      render();
    }
  }

  async function persistPdfResults(results: readonly PdfPersistResult[]): Promise<void> {
    if (results.length === 0) return;
    model.historyBusy = true;
    render();
    try {
      const createdAt = Date.now();
      await addHistoryRecords(results.map((result, index) => ({
        id: `${createdAt}-${index}-${crypto.randomUUID()}`,
        sourceName: result.sourceName,
        outputName: result.outputName,
        kind: 'pdf' as const,
        sourceSize: result.sourceSize,
        outputSize: result.blob.size,
        createdAt: createdAt + index,
        blob: result.blob,
      })));
      if (!disposed) await refreshHistory();
    } catch {
      if (!disposed) model.historyError = 'PDF 结果已生成，但未能保存到最近记录。';
    } finally {
      if (!disposed) {
        model.historyBusy = false;
        render();
      }
    }
  }

  async function persistVideoResult(result: VideoPersistResult): Promise<void> {
    model.historyBusy = true;
    render();
    try {
      await addHistoryRecords([{
        id: `${Date.now()}-${crypto.randomUUID()}`,
        sourceName: result.sourceName,
        outputName: result.outputName,
        kind: 'video',
        sourceSize: result.sourceSize,
        outputSize: result.blob.size,
        createdAt: Date.now(),
        blob: result.blob,
      }]);
      if (!disposed) await refreshHistory();
    } catch {
      if (!disposed) model.historyError = '视频结果已生成，但未能保存到最近记录。';
    } finally {
      if (!disposed) {
        model.historyBusy = false;
        render();
      }
    }
  }

  view.elements.imageTab.addEventListener('click', () => void setMode('image'));
  view.elements.mediaTab.addEventListener('click', () => void setMode('media'));
  view.elements.videoTab.addEventListener('click', () => void setMode('video'));
  view.elements.pdfTab.addEventListener('click', () => void setMode('pdf'));
  view.elements.selectButton.addEventListener('click', () =>
    view.elements.fileInput.click(),
  );
  view.elements.selectFolderButton.addEventListener('click', () => {
    if (model.mode === 'image') view.elements.folderInput.click();
  });
  view.elements.addFilesButton.addEventListener('click', () =>
    view.elements.fileInput.click(),
  );
  view.elements.addFolderButton.addEventListener('click', () => {
    if (model.mode === 'image') view.elements.folderInput.click();
  });
  view.elements.fileInput.addEventListener('change', () => {
    const files = Array.from(view.elements.fileInput.files ?? []);
    selectFiles(files, model.mode === 'image' && model.selectedFiles.length > 0);
  });
  view.elements.folderInput.addEventListener('change', () => {
    const files = Array.from(view.elements.folderInput.files ?? []);
    if (model.mode === 'image') {
      const inspection = inspectFolderFiles(files);
      const notice = inspection.accepted.length > 0
        ? `已识别 ${inspection.accepted.length} 个可用文件${inspection.skippedCount > 0 ? `，跳过 ${inspection.skippedCount} 个不支持或无效文件` : ''}。`
        : `未找到可转换图片${inspection.skippedCount > 0 ? `，已跳过 ${inspection.skippedCount} 个不支持或无效文件` : ''}。`;
      if (inspection.accepted.length > 0) {
        selectFiles(inspection.accepted, model.selectedFiles.length > 0, notice);
      } else {
        model.folderNotice = notice;
        model.error = '文件夹中没有可转换的 JPG、PNG 或 WebP 图片。';
        model.status = model.selectedFiles.length > 0 ? 'ready' : 'error';
        render();
      }
    }
    view.elements.folderInput.value = '';
  });
  view.elements.sourceImage.addEventListener('load', () => {
    const selected = model.selectedFiles[0];
    if (
      selected?.kind !== 'image'
      || view.elements.sourceImage.getAttribute('src') !== selected.previewUrl
    ) return;
    selected.width = view.elements.sourceImage.naturalWidth;
    selected.height = view.elements.sourceImage.naturalHeight;
    render();
  });
  const updateMediaDuration = (element: HTMLMediaElement) => {
    const selected = model.selectedFiles[0];
    if (
      selected?.kind !== 'media'
      || element.getAttribute('src') !== selected.previewUrl
      || !Number.isFinite(element.duration)
      || element.duration <= 0
    ) return;
    selected.duration = Math.min(43_200, element.duration);
    render();
  };
  view.elements.sourceVideo.addEventListener('loadedmetadata', () =>
    updateMediaDuration(view.elements.sourceVideo));
  view.elements.sourceAudio.addEventListener('loadedmetadata', () =>
    updateMediaDuration(view.elements.sourceAudio));
  view.elements.removeButton.addEventListener('click', clearFiles);
  view.elements.resetButton.addEventListener('click', clearFiles);
  view.elements.convertButton.addEventListener('click', () => void convert());
  view.elements.cancelButton.addEventListener('click', cancelConversion);
  view.elements.retryButton.addEventListener('click', () => void convert(true));
  view.elements.zipButton.addEventListener('click', () => void downloadResultZip());
  view.elements.clearHistoryButton.addEventListener('click', () => void clearHistory());
  view.elements.standardPresetSelect.addEventListener('change', () => {
    model.selectedPresetId = view.elements.standardPresetSelect.value;
    model.presetMessage = '';
    render();
  });
  view.elements.standardPresetApplyButton.addEventListener('click', applySelectedStandardPreset);
  view.elements.standardPresetSaveButton.addEventListener('click', saveStandardPreset);
  view.elements.standardPresetDeleteButton.addEventListener('click', deleteSelectedStandardPreset);
  view.elements.useLastSettingsButton.addEventListener('click', applyLastSettings);

  view.elements.fileQueue.addEventListener('click', (event) => {
    const button = (event.target as Element).closest<HTMLButtonElement>(
      '[data-remove-file-id]',
    );
    if (button?.dataset.removeFileId) removeFile(button.dataset.removeFileId);
  });
  view.elements.targetOptions.addEventListener('click', (event) => {
    const button = (event.target as Element).closest<HTMLButtonElement>(
      '[data-format]',
    );
    const format = button?.dataset.format as TargetFormat | undefined;
    if (!format || isBusy(model.status)) return;
    model.target = format;
    if (format === 'ogg' && model.audioSettings.sampleRate === 'source') {
      model.audioSettings.sampleRate = 48_000;
    }
    if (
      format === 'ogg'
      && model.audioSettings.channels !== 2
      && model.audioSettings.bitrate > 192
    ) {
      model.audioSettings.bitrate = 192;
    }
    if (model.mode === 'media') saveLastSettings('media');
    render();
  });
  view.elements.qualityInput.addEventListener('input', () => {
    model.imageSettings.quality = Number(view.elements.qualityInput.value);
    render();
  });
  view.elements.maxWidthInput.addEventListener('change', () => {
    model.imageSettings.maxWidth = parseDimension(view.elements.maxWidthInput.value);
    render();
  });
  view.elements.maxHeightInput.addEventListener('change', () => {
    model.imageSettings.maxHeight = parseDimension(view.elements.maxHeightInput.value);
    render();
  });
  view.elements.rotationOptions.addEventListener('click', (event) => {
    const button = (event.target as Element).closest<HTMLButtonElement>('[data-rotation]');
    const rotation = Number(button?.dataset.rotation);
    if (![0, 90, 180, 270].includes(rotation) || isBusy(model.status)) return;
    model.imageSettings.rotation = rotation as 0 | 90 | 180 | 270;
    saveLastSettings('image');
    render();
  });
  view.elements.flipHorizontalInput.addEventListener('change', () => {
    model.imageSettings.flipHorizontal = view.elements.flipHorizontalInput.checked;
    saveLastSettings('image');
    render();
  });
  view.elements.flipVerticalInput.addEventListener('change', () => {
    model.imageSettings.flipVertical = view.elements.flipVerticalInput.checked;
    saveLastSettings('image');
    render();
  });
  view.elements.watermarkTextInput.addEventListener('input', () => {
    model.imageSettings.watermarkText = view.elements.watermarkTextInput.value.slice(0, 40);
    render();
  });
  view.elements.watermarkPositionInput.addEventListener('change', () => {
    const position = view.elements.watermarkPositionInput.value;
    if (!['top-left', 'top-right', 'center', 'bottom-left', 'bottom-right'].includes(position)) return;
    model.imageSettings.watermarkPosition = position as typeof model.imageSettings.watermarkPosition;
    saveLastSettings('image');
    render();
  });
  view.elements.watermarkOpacityInput.addEventListener('input', () => {
    model.imageSettings.watermarkOpacity = parseBoundedNumber(
      view.elements.watermarkOpacityInput.value, 70, 10, 100,
    );
    render();
  });
  view.elements.renameBaseInput.addEventListener('input', () => {
    model.imageSettings.renameBase = view.elements.renameBaseInput.value.slice(0, 80);
  });
  view.elements.bitrateOptions.addEventListener('click', (event) => {
    const button = (event.target as Element).closest<HTMLButtonElement>(
      '[data-bitrate]',
    );
    const bitrate = Number(button?.dataset.bitrate) as AudioBitrate;
    if (![128, 192, 256, 320].includes(bitrate) || isBusy(model.status)) return;
    model.audioSettings.bitrate = bitrate;
    saveLastSettings('media');
    render();
  });
  view.elements.sampleRateOptions.addEventListener('click', (event) => {
    const button = (event.target as Element).closest<HTMLButtonElement>(
      '[data-sample-rate]',
    );
    const rawValue = button?.dataset.sampleRate;
    const sampleRate = rawValue === 'source'
      ? 'source'
      : Number(rawValue) as AudioSampleRate;
    if (!['source', 44_100, 48_000].includes(sampleRate) || isBusy(model.status)) return;
    model.audioSettings.sampleRate = sampleRate;
    saveLastSettings('media');
    render();
  });
  view.elements.channelOptions.addEventListener('click', (event) => {
    const button = (event.target as Element).closest<HTMLButtonElement>(
      '[data-channels]',
    );
    const rawValue = button?.dataset.channels;
    const channels = rawValue === 'source'
      ? 'source'
      : Number(rawValue) as AudioChannels;
    if (!['source', 1, 2].includes(channels) || isBusy(model.status)) return;
    model.audioSettings.channels = channels;
    if (
      channels !== 2
      && model.target === 'ogg'
      && model.audioSettings.bitrate > 192
    ) {
      model.audioSettings.bitrate = 192;
    }
    saveLastSettings('media');
    render();
  });
  view.elements.trimStartInput.addEventListener('change', () => {
    const duration = model.selectedFiles[0]?.duration ?? 43_200;
    model.audioSettings.trimStart = parseBoundedNumber(
      view.elements.trimStartInput.value, 0, 0, Math.max(0, duration - 0.01),
    );
    if (
      model.audioSettings.trimEnd !== null
      && model.audioSettings.trimEnd <= model.audioSettings.trimStart
    ) model.audioSettings.trimEnd = null;
    render();
  });
  view.elements.trimEndInput.addEventListener('change', () => {
    if (!view.elements.trimEndInput.value) {
      model.audioSettings.trimEnd = null;
    } else {
      const duration = model.selectedFiles[0]?.duration ?? 43_200;
      model.audioSettings.trimEnd = parseBoundedNumber(
        view.elements.trimEndInput.value,
        duration,
        model.audioSettings.trimStart + 0.01,
        duration,
      );
    }
    render();
  });
  view.elements.volumeInput.addEventListener('input', () => {
    model.audioSettings.volume = parseBoundedNumber(
      view.elements.volumeInput.value, 100, 0, 200,
    );
    render();
  });
  view.elements.normalizeInput.addEventListener('change', () => {
    model.audioSettings.normalize = view.elements.normalizeInput.checked;
    render();
  });
  view.elements.speedInput.addEventListener('change', () => {
    const speed = Number(view.elements.speedInput.value);
    if (![0.5, 0.75, 1, 1.25, 1.5, 2].includes(speed)) return;
    model.audioSettings.speed = speed as typeof model.audioSettings.speed;
    render();
  });
  view.elements.fadeInInput.addEventListener('change', () => {
    model.audioSettings.fadeIn = parseBoundedNumber(
      view.elements.fadeInInput.value, 0, 0, 10,
    );
    render();
  });
  view.elements.fadeOutInput.addEventListener('change', () => {
    model.audioSettings.fadeOut = parseBoundedNumber(
      view.elements.fadeOutInput.value, 0, 0, 10,
    );
    render();
  });
  for (const input of [
    view.elements.qualityInput,
    view.elements.maxWidthInput,
    view.elements.maxHeightInput,
    view.elements.watermarkTextInput,
    view.elements.watermarkOpacityInput,
    view.elements.renameBaseInput,
  ]) input.addEventListener('change', () => saveLastSettings('image'));
  for (const input of [
    view.elements.trimStartInput,
    view.elements.trimEndInput,
    view.elements.volumeInput,
    view.elements.normalizeInput,
    view.elements.speedInput,
    view.elements.fadeInInput,
    view.elements.fadeOutInput,
  ]) input.addEventListener('change', () => saveLastSettings('media'));
  view.elements.historyList.addEventListener('click', (event) => {
    const button = (event.target as Element).closest<HTMLButtonElement>(
      '[data-delete-history-id]',
    );
    if (button?.dataset.deleteHistoryId) {
      void deleteHistory(button.dataset.deleteHistoryId);
    }
  });

  for (const eventName of ['dragenter', 'dragover']) {
    view.elements.dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      view.setDragging(true);
    });
  }
  for (const eventName of ['dragleave', 'drop']) {
    view.elements.dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      view.setDragging(false);
    });
  }
  view.elements.dropZone.addEventListener('drop', (event) => {
    const files = Array.from(event.dataTransfer?.files ?? []);
    selectFiles(files, model.mode === 'image' && model.selectedFiles.length > 0);
  });

  render();
  void refreshHistory();
  return () => {
    disposed = true;
    conversionRunToken += 1;
    historyLoadToken += 1;
    revokeAllUrls();
    revokeHistoryUrls();
    mediaConverter.dispose();
    videoWorkbench?.dispose();
    pdfWorkbench?.dispose();
  };
}
