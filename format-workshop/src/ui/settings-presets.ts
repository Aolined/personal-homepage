import type { AudioSettings, ImageSettings } from './types';

export type StandardPresetScope = 'image' | 'media';
export type StandardPresetSettings = ImageSettings | AudioSettings;

export interface StandardPreset {
  id: string;
  name: string;
  scope: StandardPresetScope;
  createdAt: number;
  settings: StandardPresetSettings;
}

export type CreateStandardPresetResult =
  | { ok: true; preset: StandardPreset }
  | { ok: false; message: string };

export const MAX_STANDARD_PRESETS = 8;
export const MAX_STANDARD_PRESET_NAME = 20;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function finiteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function normalizeImageSettings(value: unknown): ImageSettings | null {
  if (!isRecord(value)) return null;
  const maxWidth = value.maxWidth === null ? null : value.maxWidth;
  const maxHeight = value.maxHeight === null ? null : value.maxHeight;
  const watermarkText = typeof value.watermarkText === 'string'
    ? value.watermarkText.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 40)
    : null;
  const renameBase = typeof value.renameBase === 'string'
    ? value.renameBase.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 80)
    : null;
  if (
    !finiteNumber(value.quality) || value.quality < 40 || value.quality > 100
    || ![0, 90, 180, 270].includes(value.rotation as number)
    || (maxWidth !== null && (!finiteNumber(maxWidth) || !Number.isInteger(maxWidth) || maxWidth < 1 || maxWidth > 12_000))
    || (maxHeight !== null && (!finiteNumber(maxHeight) || !Number.isInteger(maxHeight) || maxHeight < 1 || maxHeight > 12_000))
    || typeof value.flipHorizontal !== 'boolean'
    || typeof value.flipVertical !== 'boolean'
    || watermarkText === null
    || !['top-left', 'top-right', 'center', 'bottom-left', 'bottom-right'].includes(String(value.watermarkPosition))
    || !finiteNumber(value.watermarkOpacity) || value.watermarkOpacity < 10 || value.watermarkOpacity > 100
    || renameBase === null
  ) return null;
  return {
    quality: value.quality,
    maxWidth,
    maxHeight,
    rotation: value.rotation as ImageSettings['rotation'],
    flipHorizontal: value.flipHorizontal,
    flipVertical: value.flipVertical,
    watermarkText,
    watermarkPosition: value.watermarkPosition as ImageSettings['watermarkPosition'],
    watermarkOpacity: value.watermarkOpacity,
    renameBase,
  };
}

function normalizeAudioSettings(value: unknown): AudioSettings | null {
  if (!isRecord(value)) return null;
  const trimEnd = value.trimEnd === null ? null : value.trimEnd;
  if (
    ![128, 192, 256, 320].includes(value.bitrate as number)
    || !['source', 44_100, 48_000].includes(value.sampleRate as string | number)
    || !['source', 1, 2].includes(value.channels as string | number)
    || !finiteNumber(value.trimStart) || value.trimStart < 0 || value.trimStart > 43_200
    || (trimEnd !== null && (!finiteNumber(trimEnd) || trimEnd <= value.trimStart || trimEnd > 43_200))
    || !finiteNumber(value.volume) || value.volume < 0 || value.volume > 200
    || typeof value.normalize !== 'boolean'
    || ![0.5, 0.75, 1, 1.25, 1.5, 2].includes(value.speed as number)
    || !finiteNumber(value.fadeIn) || value.fadeIn < 0 || value.fadeIn > 10
    || !finiteNumber(value.fadeOut) || value.fadeOut < 0 || value.fadeOut > 10
  ) return null;
  return {
    bitrate: value.bitrate as AudioSettings['bitrate'],
    sampleRate: value.sampleRate as AudioSettings['sampleRate'],
    channels: value.channels as AudioSettings['channels'],
    trimStart: value.trimStart,
    trimEnd,
    volume: value.volume,
    normalize: value.normalize,
    speed: value.speed as AudioSettings['speed'],
    fadeIn: value.fadeIn,
    fadeOut: value.fadeOut,
  };
}

function normalizeSettings(scope: StandardPresetScope, value: unknown): StandardPresetSettings | null {
  return scope === 'image' ? normalizeImageSettings(value) : normalizeAudioSettings(value);
}

function normalizePreset(value: unknown, scope: StandardPresetScope): StandardPreset | null {
  if (!isRecord(value) || value.scope !== scope) return null;
  const id = typeof value.id === 'string' ? value.id : '';
  const name = typeof value.name === 'string'
    ? value.name.replace(/[\u0000-\u001f\u007f]/g, '').trim()
    : '';
  const createdAt = value.createdAt;
  const settings = normalizeSettings(scope, value.settings);
  if (!/^[A-Za-z0-9-]{1,80}$/.test(id) || !name || name.length > MAX_STANDARD_PRESET_NAME
    || !finiteNumber(createdAt) || createdAt < 0 || !settings) return null;
  return { id, name, scope, createdAt, settings };
}

export function createStandardPreset(
  scope: StandardPresetScope,
  rawName: string,
  settings: StandardPresetSettings,
  id: string,
  createdAt: number,
): CreateStandardPresetResult {
  const name = rawName.replace(/[\u0000-\u001f\u007f]/g, '').trim();
  if (!name) return { ok: false, message: '请输入预设名称。' };
  if (name.length > MAX_STANDARD_PRESET_NAME) {
    return { ok: false, message: `预设名称不能超过 ${MAX_STANDARD_PRESET_NAME} 个字符。` };
  }
  const preset = normalizePreset({ id, name, scope, createdAt, settings }, scope);
  return preset ? { ok: true, preset } : { ok: false, message: '当前参数不能保存为预设。' };
}

export function parseStandardPresets(raw: string | null, scope: StandardPresetScope): StandardPreset[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const seen = new Set<string>();
    return parsed.map((value) => normalizePreset(value, scope))
      .filter((preset): preset is StandardPreset => Boolean(preset))
      .sort((a, b) => b.createdAt - a.createdAt)
      .filter((preset) => {
        if (seen.has(preset.id)) return false;
        seen.add(preset.id);
        return true;
      })
      .slice(0, MAX_STANDARD_PRESETS);
  } catch {
    return [];
  }
}

export function serializeStandardPresets(presets: readonly StandardPreset[]): string {
  return JSON.stringify(presets.slice(0, MAX_STANDARD_PRESETS));
}

export function addStandardPreset(
  presets: readonly StandardPreset[],
  preset: StandardPreset,
): StandardPreset[] {
  return [preset, ...presets.filter((item) => item.id !== preset.id)]
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, MAX_STANDARD_PRESETS);
}

export function removeStandardPreset(
  presets: readonly StandardPreset[],
  id: string,
): StandardPreset[] {
  return presets.filter((preset) => preset.id !== id);
}

export function serializeLastSettings(scope: StandardPresetScope, settings: StandardPresetSettings): string {
  return JSON.stringify({ scope, settings });
}

export function parseLastSettings(
  raw: string | null,
  scope: StandardPresetScope,
): StandardPresetSettings | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!isRecord(value) || value.scope !== scope) return null;
    return normalizeSettings(scope, value.settings);
  } catch {
    return null;
  }
}
