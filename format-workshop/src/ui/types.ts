import type {
  ImageFormat,
  MediaFormat,
  TargetFormat,
} from '../conversion/file-validation';
import type {
  AudioBitrate,
  AudioChannels,
  AudioSampleRate,
} from '../conversion/audio-converter';
import type { ImageWatermarkPosition } from '../conversion/image-converter';
import type { StandardPreset } from './settings-presets';

export type AppMode = 'image' | 'media' | 'video' | 'pdf';
export type AppStatus = 'empty' | 'ready' | 'converting' | 'success' | 'error';

export function isBusy(status: AppStatus): boolean {
  return status === 'converting';
}

export function calculateBatchProgress(
  activeIndex: number,
  total: number,
  fileProgress: number,
): number {
  if (total <= 0) return 0;
  const completed = Math.max(0, activeIndex);
  const current = Math.min(100, Math.max(0, fileProgress)) / 100;
  return Math.min(100, Math.round(((completed + current) / total) * 100));
}

interface SelectedFileBase {
  id: string;
  file: File;
  previewUrl: string;
  width?: number;
  height?: number;
  duration?: number;
}

export type SelectedFileView = SelectedFileBase & (
  | { kind: 'image'; sourceFormat: ImageFormat }
  | { kind: 'media'; sourceFormat: MediaFormat }
);

export interface ConversionResultView {
  sourceId: string;
  sourceName: string;
  blob: Blob;
  url: string;
  name: string;
  kind: 'image' | 'audio' | 'video' | 'pdf';
  sourceSize: number;
  outputSize: number;
}

export interface FailedFileView {
  sourceId: string;
  sourceName: string;
}

export interface HistoryResultView {
  id: string;
  sourceName: string;
  outputName: string;
  kind: 'image' | 'audio' | 'video' | 'pdf';
  sourceSize: number;
  outputSize: number;
  createdAt: number;
  url: string;
}

export interface ImageSettings {
  quality: number;
  maxWidth: number | null;
  maxHeight: number | null;
  rotation: 0 | 90 | 180 | 270;
  flipHorizontal: boolean;
  flipVertical: boolean;
  watermarkText: string;
  watermarkPosition: ImageWatermarkPosition;
  watermarkOpacity: number;
  renameBase: string;
}

export interface AudioSettings {
  bitrate: AudioBitrate;
  sampleRate: AudioSampleRate;
  channels: AudioChannels;
  trimStart: number;
  trimEnd: number | null;
  volume: number;
  normalize: boolean;
  speed: 0.5 | 0.75 | 1 | 1.25 | 1.5 | 2;
  fadeIn: number;
  fadeOut: number;
}

export interface AppViewModel {
  mode: AppMode;
  status: AppStatus;
  selectedFiles: SelectedFileView[];
  targetOptions: TargetFormat[];
  target: TargetFormat | null;
  progress: number;
  message: string;
  error: string;
  results: ConversionResultView[];
  failedFiles: FailedFileView[];
  isPackagingZip: boolean;
  history: HistoryResultView[];
  historyLoading: boolean;
  historyBusy: boolean;
  historyError: string;
  folderNotice: string;
  imageSettings: ImageSettings;
  audioSettings: AudioSettings;
  standardPresets: StandardPreset[];
  selectedPresetId: string;
  presetMessage: string;
  lastSettingsAvailable: boolean;
  videoBusy: boolean;
  pdfBusy: boolean;
}

export interface WorkbenchElements {
  imageTab: HTMLButtonElement;
  mediaTab: HTMLButtonElement;
  videoTab: HTMLButtonElement;
  pdfTab: HTMLButtonElement;
  standardToolBody: HTMLDivElement;
  videoWorkbench: HTMLDivElement;
  pdfWorkbench: HTMLDivElement;
  dropZone: HTMLDivElement;
  selectButton: HTMLButtonElement;
  selectFolderButton: HTMLButtonElement;
  addFilesButton: HTMLButtonElement;
  addFolderButton: HTMLButtonElement;
  fileInput: HTMLInputElement;
  folderInput: HTMLInputElement;
  removeButton: HTMLButtonElement;
  targetOptions: HTMLDivElement;
  convertButton: HTMLButtonElement;
  cancelButton: HTMLButtonElement;
  retryButton: HTMLButtonElement;
  zipButton: HTMLButtonElement;
  resetButton: HTMLButtonElement;
  fileQueue: HTMLDivElement;
  fileInfo: HTMLDListElement;
  folderStatus: HTMLElement;
  standardPresetBar: HTMLDivElement;
  standardPresetSelect: HTMLSelectElement;
  standardPresetApplyButton: HTMLButtonElement;
  standardPresetNameInput: HTMLInputElement;
  standardPresetSaveButton: HTMLButtonElement;
  standardPresetDeleteButton: HTMLButtonElement;
  useLastSettingsButton: HTMLButtonElement;
  standardPresetStatus: HTMLElement;
  sourceImage: HTMLImageElement;
  sourceVideo: HTMLVideoElement;
  sourceAudio: HTMLAudioElement;
  qualityInput: HTMLInputElement;
  maxWidthInput: HTMLInputElement;
  maxHeightInput: HTMLInputElement;
  rotationOptions: HTMLDivElement;
  flipHorizontalInput: HTMLInputElement;
  flipVerticalInput: HTMLInputElement;
  watermarkTextInput: HTMLInputElement;
  watermarkPositionInput: HTMLSelectElement;
  watermarkOpacityInput: HTMLInputElement;
  renameBaseInput: HTMLInputElement;
  bitrateOptions: HTMLDivElement;
  bitrateSetting: HTMLDivElement;
  sampleRateOptions: HTMLDivElement;
  channelOptions: HTMLDivElement;
  trimStartInput: HTMLInputElement;
  trimEndInput: HTMLInputElement;
  volumeInput: HTMLInputElement;
  normalizeInput: HTMLInputElement;
  speedInput: HTMLSelectElement;
  fadeInInput: HTMLInputElement;
  fadeOutInput: HTMLInputElement;
  historyList: HTMLDivElement;
  clearHistoryButton: HTMLButtonElement;
}

export interface WorkbenchView {
  elements: WorkbenchElements;
  render(model: AppViewModel): void;
  setDragging(isDragging: boolean): void;
}
