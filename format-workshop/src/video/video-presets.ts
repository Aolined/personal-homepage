import type { CompressSettings, GifFrameRate, GifWidth } from './video-toolbox';
import type {
  ExtractAudioSettings,
  SnapshotFormat,
  TransformSettings,
} from './video-advanced-tools';

export interface VideoPresetSettings {
  compress: CompressSettings;
  transform: TransformSettings;
  gif: { width: GifWidth; frameRate: GifFrameRate };
  snapshot: { format: SnapshotFormat };
  audio: ExtractAudioSettings;
}

export interface VideoPreset {
  id: string;
  name: string;
  createdAt: number;
  settings: VideoPresetSettings;
}

export type CreateVideoPresetResult =
  | { ok: true; preset: VideoPreset }
  | { ok: false; message: string };

export const MAX_VIDEO_PRESETS = 8;
export const MAX_VIDEO_PRESET_NAME = 20;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeSettings(value: unknown): VideoPresetSettings | null {
  if (!isRecord(value)) return null;
  const { compress, transform, gif, snapshot, audio } = value;
  if (
    !isRecord(compress)
    || !['small', 'balanced', 'high'].includes(String(compress.quality))
    || !['source', 1080, 720, 480].includes(compress.resolution as string | number)
    || !['source', 30, 24].includes(compress.frameRate as string | number)
    || typeof compress.removeAudio !== 'boolean'
    || !isRecord(transform)
    || ![0, 90, 180, 270].includes(transform.rotation as number)
    || !['source', 'square', '16:9', '9:16', '4:3'].includes(String(transform.crop))
    || typeof transform.removeAudio !== 'boolean'
    || !isRecord(gif)
    || ![480, 640, 800].includes(gif.width as number)
    || ![8, 12, 15].includes(gif.frameRate as number)
    || !isRecord(snapshot)
    || !['jpeg', 'png'].includes(String(snapshot.format))
    || !isRecord(audio)
    || !['mp3', 'm4a', 'wav'].includes(String(audio.format))
    || ![128, 192, 256].includes(audio.bitrate as number)
  ) return null;

  return {
    compress: {
      quality: compress.quality as CompressSettings['quality'],
      resolution: compress.resolution as CompressSettings['resolution'],
      frameRate: compress.frameRate as CompressSettings['frameRate'],
      removeAudio: compress.removeAudio,
    },
    transform: {
      rotation: transform.rotation as TransformSettings['rotation'],
      crop: transform.crop as TransformSettings['crop'],
      removeAudio: transform.removeAudio,
    },
    gif: {
      width: gif.width as GifWidth,
      frameRate: gif.frameRate as GifFrameRate,
    },
    snapshot: { format: snapshot.format as SnapshotFormat },
    audio: {
      format: audio.format as ExtractAudioSettings['format'],
      bitrate: audio.bitrate as ExtractAudioSettings['bitrate'],
    },
  };
}

function normalizePreset(value: unknown): VideoPreset | null {
  if (!isRecord(value)) return null;
  const id = typeof value.id === 'string' ? value.id : '';
  const name = typeof value.name === 'string' ? value.name.trim() : '';
  const createdAt = value.createdAt;
  const settings = normalizeSettings(value.settings);
  if (
    !/^[A-Za-z0-9-]{1,80}$/.test(id)
    || name.length === 0
    || name.length > MAX_VIDEO_PRESET_NAME
    || typeof createdAt !== 'number'
    || !Number.isFinite(createdAt)
    || createdAt < 0
    || !settings
  ) return null;
  return { id, name, createdAt, settings };
}

export function createVideoPreset(
  rawName: string,
  settings: VideoPresetSettings,
  id: string,
  createdAt: number,
): CreateVideoPresetResult {
  const name = rawName.replace(/[\u0000-\u001f\u007f]/g, '').trim();
  if (!name) return { ok: false, message: '请输入预设名称。' };
  if (name.length > MAX_VIDEO_PRESET_NAME) {
    return { ok: false, message: `预设名称不能超过 ${MAX_VIDEO_PRESET_NAME} 个字符。` };
  }
  const preset = normalizePreset({ id, name, createdAt, settings });
  if (!preset) return { ok: false, message: '当前参数不能保存为预设。' };
  return { ok: true, preset };
}

export function parseVideoPresets(raw: string | null): VideoPreset[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const normalized = parsed
      .map(normalizePreset)
      .filter((preset): preset is VideoPreset => preset !== null)
      .sort((a, b) => b.createdAt - a.createdAt);
    const seenIds = new Set<string>();
    return normalized
      .filter((preset) => {
        if (seenIds.has(preset.id)) return false;
        seenIds.add(preset.id);
        return true;
      })
      .slice(0, MAX_VIDEO_PRESETS);
  } catch {
    return [];
  }
}

export function serializeVideoPresets(presets: readonly VideoPreset[]): string {
  return JSON.stringify(presets.slice(0, MAX_VIDEO_PRESETS));
}

export function addVideoPreset(
  presets: readonly VideoPreset[],
  preset: VideoPreset,
): VideoPreset[] {
  return [preset, ...presets.filter((item) => item.id !== preset.id)]
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, MAX_VIDEO_PRESETS);
}

export function removeVideoPreset(
  presets: readonly VideoPreset[],
  id: string,
): VideoPreset[] {
  return presets.filter((preset) => preset.id !== id);
}
