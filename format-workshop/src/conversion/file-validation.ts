export type FileKind = 'image' | 'media';
export type ImageFormat = 'jpeg' | 'png' | 'webp';
export type AudioFormat = 'mp3' | 'wav' | 'm4a' | 'aac' | 'flac' | 'ogg';
export type MediaFormat = 'mp4' | AudioFormat;
export type SourceFormat = ImageFormat | MediaFormat;
export type TargetFormat = ImageFormat | AudioFormat;

export type ValidatedSource =
  | { kind: 'image'; sourceFormat: ImageFormat }
  | { kind: 'media'; sourceFormat: MediaFormat };

export interface FileDescriptor {
  name: string;
  size: number;
  type: string;
}

export type ValidationResult =
  | ({ ok: true } & ValidatedSource)
  | {
      ok: false;
      message: string;
  };

export interface FolderInspectionResult<T extends FileDescriptor> {
  accepted: T[];
  skipped: T[];
  skippedCount: number;
}

export type BatchValidationResult =
  | {
      ok: true;
      entries: ValidatedSource[];
    }
  | {
      ok: false;
      message: string;
    };

const MB = 1024 * 1024;
const IMAGE_LIMIT = 25 * MB;
const MEDIA_LIMIT = 200 * MB;
const IMAGE_BATCH_LIMIT = 100 * MB;
const IMAGE_BATCH_COUNT = 20;

const MIME_FORMATS: Readonly<Record<string, SourceFormat>> = {
  'image/jpeg': 'jpeg',
  'image/png': 'png',
  'image/webp': 'webp',
  'video/mp4': 'mp4',
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/x-mp3': 'mp3',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/mp4': 'm4a',
  'audio/x-m4a': 'm4a',
  'audio/aac': 'aac',
  'audio/flac': 'flac',
  'audio/x-flac': 'flac',
  'audio/ogg': 'ogg',
};

export function validateSourceFile(file: FileDescriptor): ValidationResult {
  if (file.size <= 0) return { ok: false, message: '文件为空，无法转换。' };

  const sourceFormat = MIME_FORMATS[file.type.toLowerCase()];
  if (!sourceFormat) {
    return {
      ok: false,
      message: '当前支持 JPG、PNG、WebP 图片，以及 MP4、MP3、WAV、M4A、AAC、FLAC、OGG 音视频。',
    };
  }

  if (sourceFormat === 'jpeg' || sourceFormat === 'png' || sourceFormat === 'webp') {
    if (file.size > IMAGE_LIMIT) {
      return { ok: false, message: '图片不能超过 25 MB。' };
    }
    return { ok: true, kind: 'image', sourceFormat };
  }
  if (file.size > MEDIA_LIMIT) {
    return { ok: false, message: '音视频文件不能超过 200 MB。' };
  }
  return { ok: true, kind: 'media', sourceFormat };
}

/** Separates folder entries that can never be image conversion inputs. */
export function inspectFolderFiles<T extends FileDescriptor>(
  files: readonly T[],
): FolderInspectionResult<T> {
  const accepted: T[] = [];
  const skipped: T[] = [];
  for (const file of files) {
    const validation = validateSourceFile(file);
    if (validation.ok && validation.kind === 'image') accepted.push(file);
    else skipped.push(file);
  }
  return { accepted, skipped, skippedCount: skipped.length };
}

export function getAvailableTargets(
  kind: FileKind,
  _sourceFormat: SourceFormat,
): TargetFormat[] {
  if (kind === 'media') return ['mp3', 'wav', 'm4a', 'aac', 'flac', 'ogg'];

  return ['jpeg', 'png', 'webp'];
}

export function validateFileBatch(
  files: readonly FileDescriptor[],
  expectedKind: FileKind,
): BatchValidationResult {
  if (files.length === 0) {
    return { ok: false, message: '请选择需要转换的文件。' };
  }
  if (expectedKind === 'media' && files.length !== 1) {
    return { ok: false, message: '音频转换每次请选择一个文件。' };
  }
  if (expectedKind === 'image' && files.length > IMAGE_BATCH_COUNT) {
    return { ok: false, message: '一次最多转换 20 张图片。' };
  }
  if (
    expectedKind === 'image' &&
    files.reduce((total, file) => total + file.size, 0) > IMAGE_BATCH_LIMIT
  ) {
    return { ok: false, message: '一批图片总大小不能超过 100 MB。' };
  }

  const entries: ValidatedSource[] = [];
  for (const file of files) {
    const validation = validateSourceFile(file);
    if (!validation.ok) return validation;
    if (validation.kind !== expectedKind) {
      return {
        ok: false,
        message: expectedKind === 'image'
          ? '图片批量转换仅支持 JPG、PNG 和 WebP。'
          : '音频转换仅支持 MP4、MP3、WAV、M4A、AAC、FLAC 和 OGG。',
      };
    }
    if (validation.kind === 'image') {
      entries.push({ kind: 'image', sourceFormat: validation.sourceFormat });
    } else {
      entries.push({ kind: 'media', sourceFormat: validation.sourceFormat });
    }
  }

  return { ok: true, entries };
}

export function buildOutputName(name: string, target: TargetFormat): string {
  const baseName = name.replace(/\.[^.]*$/, '').trim() || 'converted';
  const extension = target === 'jpeg' ? 'jpg' : target;
  return `${baseName}.${extension}`;
}

function sanitizeOutputBaseName(value: string): string {
  return value
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/[<>:"/\\|?*]+/g, '_')
    .replace(/^[._\s]+/, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80) || 'converted';
}

export function buildBatchOutputName(
  sourceName: string,
  target: TargetFormat,
  renameBase: string,
  index: number,
  total: number,
): string {
  if (!renameBase.trim()) return buildOutputName(sourceName, target);
  const base = sanitizeOutputBaseName(renameBase);
  const extension = target === 'jpeg' ? 'jpg' : target;
  if (total <= 1) return `${base}.${extension}`;
  const digits = Math.max(2, String(Math.max(1, total)).length);
  const suffix = String(Math.max(0, index) + 1).padStart(digits, '0');
  return `${base}-${suffix}.${extension}`;
}
