import {
  ArrowRight,
  CircleCheck,
  Clapperboard,
  CloudUpload,
  Download,
  FileText,
  FileImage,
  FolderOpen,
  Image,
  LockKeyhole,
  Package,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  ShieldCheck,
  Square,
  Trash2,
  Video,
  X,
  createIcons,
} from 'lucide';

import type { TargetFormat } from '../conversion/file-validation';
import type {
  AudioBitrate,
  AudioChannels,
  AudioSampleRate,
} from '../conversion/audio-converter';
import { calculateSizeChange } from '../conversion/result-metrics';
import { workbenchTemplate } from './template';
import {
  isBusy,
  type AppViewModel,
  type WorkbenchElements,
  type WorkbenchView,
} from './types';

const FORMAT_LABELS: Record<TargetFormat, string> = {
  jpeg: 'JPG',
  png: 'PNG',
  webp: 'WebP',
  mp3: 'MP3',
  wav: 'WAV',
  m4a: 'M4A',
  aac: 'AAC',
  flac: 'FLAC',
  ogg: 'OGG',
};

const AUDIO_BITRATES: AudioBitrate[] = [128, 192, 256, 320];
const AUDIO_SAMPLE_RATES: Array<{ value: AudioSampleRate; label: string }> = [
  { value: 'source', label: '原始' },
  { value: 44_100, label: '44.1 kHz' },
  { value: 48_000, label: '48 kHz' },
];
const AUDIO_CHANNELS: Array<{ value: AudioChannels; label: string }> = [
  { value: 'source', label: '原始' },
  { value: 1, label: '单声道' },
  { value: 2, label: '双声道' },
];
const IMAGE_ROTATIONS = [0, 90, 180, 270] as const;

function query<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`Missing UI element: ${selector}`);
  return element;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatSizeChange(sourceSize: number, outputSize: number): string {
  const change = calculateSizeChange(sourceSize, outputSize);
  const changeText = change.direction === 'smaller'
    ? `减少 ${change.percent}%`
    : change.direction === 'larger'
      ? `增加 ${change.percent}%`
      : '大小不变';
  return `源文件 ${formatFileSize(sourceSize)} · 输出 ${formatFileSize(outputSize)} · ${changeText}`;
}

function formatHistoryTime(timestamp: number): string {
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(timestamp);
}

function formatDuration(seconds: number): string {
  const rounded = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(rounded / 60);
  return `${minutes}:${String(rounded % 60).padStart(2, '0')}`;
}

export function createWorkbenchView(root: HTMLDivElement): WorkbenchView {
  root.innerHTML = workbenchTemplate;

  createIcons({
    icons: {
      ArrowRight,
      CircleCheck,
      Clapperboard,
      CloudUpload,
      Download,
      FileImage,
      FileText,
      FolderOpen,
      Image,
      LockKeyhole,
      Package,
      Plus,
      RefreshCw,
      RotateCcw,
      Save,
      ShieldCheck,
      Square,
      Trash2,
      Video,
      X,
    },
    attrs: { 'aria-hidden': 'true', 'stroke-width': 2 },
  });
  root.querySelectorAll('svg[data-lucide]').forEach((icon) => {
    icon.removeAttribute('data-lucide');
  });

  const elements: WorkbenchElements = {
    imageTab: query(root, '[data-mode="image"]'),
    mediaTab: query(root, '[data-mode="media"]'),
    videoTab: query(root, '[data-mode="video"]'),
    pdfTab: query(root, '[data-mode="pdf"]'),
    standardToolBody: query(root, '[data-standard-tool-body]'),
    videoWorkbench: query(root, '[data-video-workbench]'),
    pdfWorkbench: query(root, '[data-pdf-workbench]'),
    dropZone: query(root, '[data-drop-zone]'),
    selectButton: query(root, '[data-select-file]'),
    selectFolderButton: query(root, '[data-select-folder]'),
    addFilesButton: query(root, '[data-add-files]'),
    addFolderButton: query(root, '[data-add-folder]'),
    fileInput: query(root, '[data-file-input]'),
    folderInput: query(root, '[data-folder-input]'),
    removeButton: query(root, '[data-remove-file]'),
    targetOptions: query(root, '[data-target-options]'),
    convertButton: query(root, '[data-convert]'),
    cancelButton: query(root, '[data-cancel]'),
    retryButton: query(root, '[data-retry-failed]'),
    zipButton: query(root, '[data-download-zip]'),
    resetButton: query(root, '[data-reset]'),
    fileQueue: query(root, '[data-file-queue]'),
    fileInfo: query(root, '[data-file-info]'),
    folderStatus: query(root, '[data-folder-status]'),
    standardPresetBar: query(root, '[data-standard-preset-bar]'),
    standardPresetSelect: query(root, '[data-standard-preset-select]'),
    standardPresetApplyButton: query(root, '[data-standard-preset-apply]'),
    standardPresetNameInput: query(root, '[data-standard-preset-name]'),
    standardPresetSaveButton: query(root, '[data-standard-preset-save]'),
    standardPresetDeleteButton: query(root, '[data-standard-preset-delete]'),
    useLastSettingsButton: query(root, '[data-use-last-settings]'),
    standardPresetStatus: query(root, '[data-standard-preset-status]'),
    sourceImage: query(root, '[data-source-image]'),
    sourceVideo: query(root, '[data-source-video]'),
    sourceAudio: query(root, '[data-source-audio]'),
    qualityInput: query(root, '[data-quality-input]'),
    maxWidthInput: query(root, '[data-max-width]'),
    maxHeightInput: query(root, '[data-max-height]'),
    rotationOptions: query(root, '[data-rotation-options]'),
    flipHorizontalInput: query(root, '[data-flip-horizontal]'),
    flipVerticalInput: query(root, '[data-flip-vertical]'),
    watermarkTextInput: query(root, '[data-watermark-text]'),
    watermarkPositionInput: query(root, '[data-watermark-position]'),
    watermarkOpacityInput: query(root, '[data-watermark-opacity]'),
    renameBaseInput: query(root, '[data-rename-base]'),
    bitrateOptions: query(root, '[data-bitrate-options]'),
    bitrateSetting: query(root, '[data-bitrate-setting]'),
    sampleRateOptions: query(root, '[data-sample-rate-options]'),
    channelOptions: query(root, '[data-channel-options]'),
    trimStartInput: query(root, '[data-audio-trim-start]'),
    trimEndInput: query(root, '[data-audio-trim-end]'),
    volumeInput: query(root, '[data-audio-volume]'),
    normalizeInput: query(root, '[data-audio-normalize]'),
    speedInput: query(root, '[data-audio-speed]'),
    fadeInInput: query(root, '[data-audio-fade-in]'),
    fadeOutInput: query(root, '[data-audio-fade-out]'),
    historyList: query(root, '[data-history-list]'),
    clearHistoryButton: query(root, '[data-clear-history]'),
  };
  elements.removeButton.setAttribute('aria-label', '清空全部文件');
  elements.removeButton.title = '清空全部文件';

  const emptyUpload = query<HTMLDivElement>(root, '[data-empty-upload]');
  const uploadTitle = query<HTMLElement>(root, '[data-upload-title]');
  const uploadMeta = query<HTMLElement>(root, '[data-upload-meta]');
  const fileStage = query<HTMLDivElement>(root, '[data-file-stage]');
  const sourceImage = elements.sourceImage;
  const sourceVideo = elements.sourceVideo;
  const sourceAudio = elements.sourceAudio;
  const sourcePlaceholder = query<HTMLElement>(root, '[data-source-placeholder]');
  const fileName = query<HTMLElement>(root, '[data-file-name]');
  const fileMeta = query<HTMLElement>(root, '[data-file-meta]');
  const controls = query<HTMLElement>(root, '[data-conversion-controls]');
  const imageSettings = query<HTMLElement>(root, '[data-image-settings]');
  const audioSettings = query<HTMLElement>(root, '[data-audio-settings]');
  const qualityValue = query<HTMLOutputElement>(root, '[data-quality-value]');
  const volumeValue = query<HTMLOutputElement>(root, '[data-audio-volume-value]');
  const convertLabel = query<HTMLElement>(root, '[data-convert-label]');
  const progressPanel = query<HTMLElement>(root, '[data-progress-panel]');
  const progressMessage = query<HTMLElement>(root, '[data-progress-message]');
  const progressValue = query<HTMLElement>(root, '[data-progress-value]');
  const progressBar = query<HTMLProgressElement>(root, '[data-progress-bar]');
  const errorPanel = query<HTMLElement>(root, '[data-error-panel]');
  const errorMessage = query<HTMLElement>(root, '[data-error-message]');
  const resultPanel = query<HTMLElement>(root, '[data-result-panel]');
  const resultTitle = query<HTMLElement>(root, '.result-heading h2');
  const resultName = query<HTMLElement>(root, '[data-result-name]');
  const resultMetrics = query<HTMLElement>(root, '[data-result-metrics]');
  const resultImage = query<HTMLImageElement>(root, '[data-result-image]');
  const resultAudio = query<HTMLAudioElement>(root, '[data-result-audio]');
  const resultList = query<HTMLDivElement>(root, '[data-result-list]');
  const download = query<HTMLAnchorElement>(root, '[data-download]');

  function render(model: AppViewModel): void {
    const isImageMode = model.mode === 'image';
    const isMediaMode = model.mode === 'media';
    const isVideoMode = model.mode === 'video';
    const isPdfMode = model.mode === 'pdf';
    const isConverting = isBusy(model.status);
    const anyBusy = isConverting || model.videoBusy || model.pdfBusy;
    const hasFiles = model.selectedFiles.length > 0;
    const firstFile = model.selectedFiles[0];

    elements.imageTab.setAttribute('aria-selected', String(isImageMode));
    elements.mediaTab.setAttribute('aria-selected', String(isMediaMode));
    elements.videoTab.setAttribute('aria-selected', String(isVideoMode));
    elements.pdfTab.setAttribute('aria-selected', String(isPdfMode));
    elements.imageTab.dataset.active = String(isImageMode);
    elements.mediaTab.dataset.active = String(isMediaMode);
    elements.videoTab.dataset.active = String(isVideoMode);
    elements.pdfTab.dataset.active = String(isPdfMode);
    elements.standardToolBody.hidden = isPdfMode || isVideoMode;
    elements.videoWorkbench.hidden = !isVideoMode;
    elements.pdfWorkbench.hidden = !isPdfMode;
    elements.fileInput.accept = isImageMode
      ? 'image/jpeg,image/png,image/webp'
      : 'video/mp4,audio/mpeg,audio/mp3,audio/x-mp3,audio/wav,audio/x-wav,audio/mp4,audio/x-m4a,audio/aac,audio/flac,audio/x-flac,audio/ogg';
    elements.fileInput.multiple = isImageMode;
    elements.folderInput.accept = 'image/jpeg,image/png,image/webp';
    elements.folderInput.multiple = isImageMode;
    uploadTitle.textContent = isImageMode ? '选择图片' : '选择音频或 MP4';
    uploadMeta.textContent = isImageMode
      ? 'JPG、PNG、WebP · 最多 20 张 / 100 MB'
      : 'MP4、MP3、WAV、M4A、AAC、FLAC、OGG · 最大 200 MB';
    elements.folderStatus.textContent = model.folderNotice;
    elements.folderStatus.hidden = !model.folderNotice;

    emptyUpload.hidden = hasFiles;
    fileStage.hidden = !hasFiles;
    controls.hidden = !hasFiles || model.status === 'success';
    imageSettings.hidden = !isImageMode;
    audioSettings.hidden = isImageMode;
    elements.standardPresetBar.hidden = !isImageMode && !isMediaMode;

    const emptyPreset = document.createElement('option');
    emptyPreset.value = '';
    emptyPreset.textContent = model.standardPresets.length > 0 ? '选择预设' : '暂无预设';
    elements.standardPresetSelect.replaceChildren(
      emptyPreset,
      ...model.standardPresets.map((preset) => {
        const option = document.createElement('option');
        option.value = preset.id;
        option.textContent = preset.name;
        return option;
      }),
    );
    elements.standardPresetSelect.value = model.selectedPresetId;
    elements.standardPresetSelect.disabled = anyBusy || model.standardPresets.length === 0;
    elements.standardPresetApplyButton.disabled = anyBusy || !model.selectedPresetId;
    elements.standardPresetNameInput.disabled = anyBusy;
    elements.standardPresetSaveButton.disabled = anyBusy;
    elements.standardPresetDeleteButton.disabled = anyBusy || !model.selectedPresetId;
    elements.useLastSettingsButton.disabled = anyBusy || !model.lastSettingsAvailable;
    elements.standardPresetStatus.textContent = model.presetMessage;

    if (firstFile) {
      const totalSize = model.selectedFiles.reduce(
        (total, selected) => total + selected.file.size,
        0,
      );
      fileName.textContent = model.selectedFiles.length === 1
        ? firstFile.file.name
        : `${model.selectedFiles.length} 张图片待转换`;
      fileMeta.textContent = model.selectedFiles.length === 1
        ? `${formatFileSize(firstFile.file.size)} · ${firstFile.sourceFormat.toUpperCase()}`
        : `共 ${formatFileSize(totalSize)} · 最多 20 张`;
      const infoEntries: Array<[string, string]> = [
        ['类型', firstFile.file.type || '未知 MIME'],
        ['修改时间', firstFile.file.lastModified
          ? new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium' }).format(firstFile.file.lastModified)
          : '未知'],
      ];
      if (firstFile.width && firstFile.height) {
        infoEntries.unshift(['尺寸', `${firstFile.width} × ${firstFile.height} px`]);
      }
      if (firstFile.duration) infoEntries.unshift(['时长', formatDuration(firstFile.duration)]);
      elements.fileInfo.replaceChildren(...infoEntries.flatMap(([term, value]) => {
        const dt = document.createElement('dt');
        dt.textContent = term;
        const dd = document.createElement('dd');
        dd.textContent = value;
        return [dt, dd];
      }));
      const isImage = firstFile.kind === 'image';
      const isVideo = firstFile.sourceFormat === 'mp4';
      sourceImage.hidden = !isImage;
      sourceVideo.hidden = !isVideo;
      sourceAudio.hidden = isImage || isVideo;
      sourcePlaceholder.hidden = true;
      if (isImage) {
        if (sourceImage.getAttribute('src') !== firstFile.previewUrl) {
          sourceImage.src = firstFile.previewUrl;
        }
        sourceVideo.removeAttribute('src');
        sourceAudio.removeAttribute('src');
      } else if (isVideo) {
        if (sourceVideo.getAttribute('src') !== firstFile.previewUrl) {
          sourceVideo.src = firstFile.previewUrl;
        }
        sourceImage.removeAttribute('src');
        sourceAudio.removeAttribute('src');
      } else {
        if (sourceAudio.getAttribute('src') !== firstFile.previewUrl) {
          sourceAudio.src = firstFile.previewUrl;
        }
        sourceImage.removeAttribute('src');
        sourceVideo.removeAttribute('src');
      }
    } else {
      sourceImage.removeAttribute('src');
      sourceVideo.removeAttribute('src');
      sourceAudio.removeAttribute('src');
      sourcePlaceholder.hidden = false;
      elements.fileInfo.replaceChildren();
    }

    elements.fileQueue.hidden = model.selectedFiles.length <= 1;
    elements.fileQueue.replaceChildren(
      ...model.selectedFiles.map((selected, index) => {
        const row = document.createElement('div');
        row.className = 'file-queue-item';

        const indexLabel = document.createElement('span');
        indexLabel.className = 'file-queue-index';
        indexLabel.textContent = String(index + 1).padStart(2, '0');

        const details = document.createElement('span');
        details.className = 'file-queue-copy';
        const name = document.createElement('strong');
        name.textContent = selected.file.name;
        const meta = document.createElement('small');
        meta.textContent = `${formatFileSize(selected.file.size)} · ${selected.sourceFormat.toUpperCase()}`;
        details.append(name, meta);

        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'queue-remove-button';
        remove.dataset.removeFileId = selected.id;
        remove.textContent = '移除';
        remove.setAttribute('aria-label', `移除 ${selected.file.name}`);
        remove.disabled = isConverting;

        row.append(indexLabel, details, remove);
        return row;
      }),
    );

    elements.selectFolderButton.hidden = !isImageMode;
    elements.addFilesButton.hidden = !isImageMode || isConverting || model.selectedFiles.length >= 20;
    elements.addFolderButton.hidden = !isImageMode || isConverting || model.selectedFiles.length >= 20;
    elements.targetOptions.replaceChildren(
      ...model.targetOptions.map((format) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'format-option';
        button.dataset.format = format;
        button.dataset.active = String(format === model.target);
        button.setAttribute('aria-pressed', String(format === model.target));
        button.textContent = FORMAT_LABELS[format];
        button.disabled = isConverting;
        return button;
      }),
    );

    const qualityApplies = model.target !== 'png';
    elements.qualityInput.value = String(model.imageSettings.quality);
    elements.qualityInput.disabled = isConverting || !qualityApplies;
    qualityValue.textContent = qualityApplies
      ? `${model.imageSettings.quality}%`
      : 'PNG 无损';
    elements.maxWidthInput.value = model.imageSettings.maxWidth?.toString() ?? '';
    elements.maxHeightInput.value = model.imageSettings.maxHeight?.toString() ?? '';
    elements.maxWidthInput.disabled = isConverting;
    elements.maxHeightInput.disabled = isConverting;
    elements.rotationOptions.replaceChildren(...IMAGE_ROTATIONS.map((rotation) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'compact-option';
      button.dataset.rotation = String(rotation);
      button.dataset.active = String(rotation === model.imageSettings.rotation);
      button.setAttribute('aria-pressed', String(rotation === model.imageSettings.rotation));
      button.textContent = `${rotation}°`;
      button.disabled = isConverting;
      return button;
    }));
    elements.flipHorizontalInput.checked = model.imageSettings.flipHorizontal;
    elements.flipVerticalInput.checked = model.imageSettings.flipVertical;
    elements.flipHorizontalInput.disabled = isConverting;
    elements.flipVerticalInput.disabled = isConverting;
    elements.watermarkTextInput.value = model.imageSettings.watermarkText;
    elements.watermarkPositionInput.value = model.imageSettings.watermarkPosition;
    elements.watermarkOpacityInput.value = String(model.imageSettings.watermarkOpacity);
    elements.renameBaseInput.value = model.imageSettings.renameBase;
    elements.watermarkTextInput.disabled = isConverting;
    elements.watermarkPositionInput.disabled = isConverting;
    elements.watermarkOpacityInput.disabled = isConverting || !model.imageSettings.watermarkText;
    elements.renameBaseInput.disabled = isConverting;

    const bitrateApplies = model.target !== 'wav' && model.target !== 'flac';
    elements.bitrateSetting.hidden = !bitrateApplies;
    elements.bitrateOptions.replaceChildren(
      ...AUDIO_BITRATES.map((bitrate) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'bitrate-option';
        button.dataset.bitrate = String(bitrate);
        button.dataset.active = String(bitrate === model.audioSettings.bitrate);
        button.setAttribute('aria-pressed', String(bitrate === model.audioSettings.bitrate));
        button.textContent = `${bitrate} kbps`;
        button.disabled = isConverting
          || (model.target === 'ogg' && model.audioSettings.channels !== 2 && bitrate > 192);
        return button;
      }),
    );
    elements.sampleRateOptions.replaceChildren(
      ...AUDIO_SAMPLE_RATES.map(({ value, label }) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'bitrate-option';
        button.dataset.sampleRate = String(value);
        button.dataset.active = String(value === model.audioSettings.sampleRate);
        button.setAttribute('aria-pressed', String(value === model.audioSettings.sampleRate));
        button.textContent = label;
        button.disabled = isConverting || (model.target === 'ogg' && value === 'source');
        return button;
      }),
    );
    elements.channelOptions.replaceChildren(
      ...AUDIO_CHANNELS.map(({ value, label }) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'bitrate-option';
        button.dataset.channels = String(value);
        button.dataset.active = String(value === model.audioSettings.channels);
        button.setAttribute('aria-pressed', String(value === model.audioSettings.channels));
        button.textContent = label;
        button.disabled = isConverting;
        return button;
      }),
    );
    const duration = firstFile?.duration;
    elements.trimStartInput.value = String(model.audioSettings.trimStart);
    elements.trimEndInput.value = model.audioSettings.trimEnd?.toString() ?? '';
    elements.trimStartInput.max = duration?.toString() ?? '43200';
    elements.trimEndInput.max = duration?.toString() ?? '43200';
    elements.trimEndInput.placeholder = duration ? `原结尾 ${duration.toFixed(1)}` : '原结尾';
    elements.volumeInput.value = String(model.audioSettings.volume);
    volumeValue.textContent = `${model.audioSettings.volume}%`;
    elements.normalizeInput.checked = model.audioSettings.normalize;
    elements.speedInput.value = String(model.audioSettings.speed);
    elements.fadeInInput.value = String(model.audioSettings.fadeIn);
    elements.fadeOutInput.value = String(model.audioSettings.fadeOut);
    for (const input of [
      elements.trimStartInput,
      elements.trimEndInput,
      elements.volumeInput,
      elements.normalizeInput,
      elements.speedInput,
      elements.fadeInInput,
      elements.fadeOutInput,
    ]) input.disabled = isConverting;

    elements.imageTab.disabled = anyBusy;
    elements.mediaTab.disabled = anyBusy;
    elements.videoTab.disabled = anyBusy;
    elements.pdfTab.disabled = anyBusy;
    elements.convertButton.disabled = !model.target || isConverting;
    elements.removeButton.disabled = isConverting;
    convertLabel.textContent = isConverting
      ? '转换中'
      : model.selectedFiles.length > 1
        ? `转换 ${model.selectedFiles.length} 个文件`
        : '开始转换';

    progressPanel.hidden = !isConverting && !(model.status === 'ready' && model.message);
    elements.cancelButton.hidden = !isConverting;
    progressMessage.textContent = model.message || '正在准备';
    progressValue.textContent = `${model.progress}%`;
    progressBar.value = model.progress;
    progressBar.textContent = `${model.progress}%`;

    errorPanel.hidden = !model.error || isConverting;
    errorMessage.textContent = model.error;

    const canceledWithResults = model.status === 'ready'
      && model.results.length > 0
      && model.message.startsWith('已取消');
    const hasResults = (model.status === 'success' || canceledWithResults)
      && model.results.length > 0;
    resultPanel.hidden = !hasResults;
    const firstResult = model.results[0];
    if (hasResults && firstResult) {
      resultTitle.textContent = canceledWithResults
        ? '转换已取消'
        : model.failedFiles.length > 0
          ? '转换已完成'
          : '转换完成';
      resultName.textContent = canceledWithResults
        ? model.message
        : model.failedFiles.length > 0
          ? `${model.results.length} 个成功，${model.failedFiles.length} 个失败`
          : model.results.length > 1
            ? `${model.results.length} 个文件已完成`
            : firstResult.name;
      resultMetrics.hidden = model.results.length !== 1;
      resultMetrics.textContent = formatSizeChange(
        firstResult.sourceSize,
        firstResult.outputSize,
      );
      const isImageResult = firstResult.kind === 'image';
      resultImage.hidden = !isImageResult;
      resultAudio.hidden = isImageResult;
      if (isImageResult) {
        resultImage.src = firstResult.url;
        resultAudio.removeAttribute('src');
      } else {
        resultAudio.src = firstResult.url;
        resultImage.removeAttribute('src');
      }

      resultList.hidden = model.results.length === 1;
      resultList.replaceChildren(
        ...model.results.map((result) => {
          const row = document.createElement('div');
          row.className = 'result-list-item';
          const copy = document.createElement('span');
          const name = document.createElement('strong');
          name.textContent = result.name;
          const source = document.createElement('small');
          source.textContent = `来自 ${result.sourceName}`;
          const metrics = document.createElement('small');
          metrics.className = 'result-size-change';
          metrics.textContent = formatSizeChange(result.sourceSize, result.outputSize);
          copy.append(name, source, metrics);
          const action = document.createElement('a');
          action.className = 'result-download';
          action.href = result.url;
          action.download = result.name;
          action.textContent = '下载';
          row.append(copy, action);
          return row;
        }),
      );

      download.hidden = model.results.length !== 1;
      download.href = firstResult.url;
      download.download = firstResult.name;
      elements.zipButton.hidden = model.results.length < 2;
      elements.zipButton.disabled = model.isPackagingZip;
      elements.zipButton.querySelector('span')!.textContent = model.isPackagingZip
        ? '正在打包'
        : '打包下载 ZIP';
      elements.retryButton.hidden = model.failedFiles.length === 0;
      elements.retryButton.disabled = isConverting;
    } else {
      resultImage.removeAttribute('src');
      resultAudio.removeAttribute('src');
      resultList.replaceChildren();
      download.removeAttribute('href');
      download.hidden = false;
      resultMetrics.textContent = '';
      elements.zipButton.hidden = true;
      elements.retryButton.hidden = true;
    }

    elements.clearHistoryButton.hidden = model.history.length === 0;
    elements.clearHistoryButton.disabled = model.historyBusy;
    if (model.historyLoading) {
      elements.historyList.replaceChildren(Object.assign(document.createElement('p'), {
        className: 'history-empty',
        textContent: '正在读取本地记录…',
      }));
    } else if (model.historyError) {
      elements.historyList.replaceChildren(Object.assign(document.createElement('p'), {
        className: 'history-empty history-error',
        textContent: model.historyError,
      }));
    } else if (model.history.length === 0) {
      elements.historyList.replaceChildren(Object.assign(document.createElement('p'), {
        className: 'history-empty',
        textContent: '还没有本地转换记录。',
      }));
    } else {
      elements.historyList.replaceChildren(
        ...model.history.map((record) => {
          const row = document.createElement('div');
          row.className = 'history-item';

          const copy = document.createElement('span');
          copy.className = 'history-copy';
          const name = document.createElement('strong');
          name.textContent = record.outputName;
          const meta = document.createElement('small');
          meta.textContent = `${formatHistoryTime(record.createdAt)} · 来自 ${record.sourceName}`;
          const metrics = document.createElement('small');
          metrics.textContent = formatSizeChange(record.sourceSize, record.outputSize);
          copy.append(name, meta, metrics);

          const actions = document.createElement('span');
          actions.className = 'history-actions';
          const downloadLink = document.createElement('a');
          downloadLink.className = 'result-download';
          downloadLink.href = record.url;
          downloadLink.download = record.outputName;
          downloadLink.textContent = '下载';
          const remove = document.createElement('button');
          remove.type = 'button';
          remove.className = 'history-delete';
          remove.dataset.deleteHistoryId = record.id;
          remove.textContent = '删除';
          remove.setAttribute('aria-label', `删除 ${record.outputName} 的本地记录`);
          remove.disabled = model.historyBusy;
          actions.append(downloadLink, remove);
          row.append(copy, actions);
          return row;
        }),
      );
    }
  }

  return {
    elements,
    render,
    setDragging(isDragging) {
      elements.dropZone.dataset.dragging = String(isDragging);
    },
  };
}
