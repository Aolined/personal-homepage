import { describe, expect, it } from 'vitest';

import {
  addVideoPreset,
  createVideoPreset,
  parseVideoPresets,
  removeVideoPreset,
  serializeVideoPresets,
  type VideoPresetSettings,
} from '../src/video/video-presets';

const settings: VideoPresetSettings = {
  compress: {
    quality: 'balanced',
    resolution: 720,
    frameRate: 24,
    removeAudio: false,
  },
  transform: {
    rotation: 90,
    crop: '16:9',
    removeAudio: false,
  },
  gif: { width: 640, frameRate: 12 },
  snapshot: { format: 'jpeg' },
  audio: { format: 'mp3', bitrate: 192 },
};

describe('video presets', () => {
  it('creates a trimmed, typed preset without source-specific times', () => {
    expect(createVideoPreset('  社交媒体  ', settings, 'preset-1', 100)).toEqual({
      ok: true,
      preset: {
        id: 'preset-1',
        name: '社交媒体',
        createdAt: 100,
        settings,
      },
    });
  });

  it('rejects blank or oversized preset names', () => {
    expect(createVideoPreset('   ', settings, 'preset-1', 100).ok).toBe(false);
    expect(createVideoPreset('a'.repeat(21), settings, 'preset-1', 100).ok).toBe(false);
  });

  it('filters malformed local storage records and keeps at most eight newest presets', () => {
    const records = Array.from({ length: 10 }, (_, index) => ({
      id: `preset-${index}`,
      name: `预设 ${index}`,
      createdAt: index,
      settings,
    }));
    const parsed = parseVideoPresets(JSON.stringify([
      ...records,
      { ...records[9], name: '重复新记录', createdAt: 100 },
      { id: 'unsafe', name: '<script>', createdAt: 99, settings: { compress: {} } },
    ]));

    expect(parsed).toHaveLength(8);
    expect(parsed.map((preset) => preset.id)).toEqual([
      'preset-9', 'preset-8', 'preset-7', 'preset-6',
      'preset-5', 'preset-4', 'preset-3', 'preset-2',
    ]);
    expect(parseVideoPresets('{not json')).toEqual([]);
  });

  it('adds newest presets, serializes them, and removes one by id', () => {
    const first = createVideoPreset('高清', settings, 'first', 1);
    const second = createVideoPreset('轻量', settings, 'second', 2);
    if (!first.ok || !second.ok) throw new Error('fixture preset is invalid');

    const added = addVideoPreset([first.preset], second.preset);
    expect(parseVideoPresets(serializeVideoPresets(added)).map((preset) => preset.id))
      .toEqual(['second', 'first']);
    expect(removeVideoPreset(added, 'second').map((preset) => preset.id))
      .toEqual(['first']);
  });
});
