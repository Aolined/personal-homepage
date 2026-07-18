import { describe, expect, it } from 'vitest';

import {
  addStandardPreset,
  createStandardPreset,
  parseLastSettings,
  parseStandardPresets,
  removeStandardPreset,
  serializeLastSettings,
  serializeStandardPresets,
} from '../src/ui/settings-presets';

const imageSettings = {
  quality: 80,
  maxWidth: 1200,
  maxHeight: null,
  rotation: 90 as const,
  flipHorizontal: false,
  flipVertical: true,
  watermarkText: 'demo',
  watermarkPosition: 'center' as const,
  watermarkOpacity: 65,
  renameBase: 'export',
};

const audioSettings = {
  bitrate: 256 as const,
  sampleRate: 44_100 as const,
  channels: 2 as const,
  trimStart: 1.5,
  trimEnd: 12,
  volume: 110,
  normalize: true,
  speed: 1.25 as const,
  fadeIn: 0.5,
  fadeOut: 1,
};

describe('standard settings presets', () => {
  it('creates a trimmed preset and rejects unsafe names', () => {
    const result = createStandardPreset('image', '  Product shots  ', imageSettings, 'image-1', 100);
    expect(result).toEqual({
      ok: true,
      preset: {
        id: 'image-1',
        name: 'Product shots',
        scope: 'image',
        createdAt: 100,
        settings: imageSettings,
      },
    });
    expect(createStandardPreset('image', '\u0000', imageSettings, 'image-2', 101).ok).toBe(false);
    expect(createStandardPreset('image', 'x'.repeat(25), imageSettings, 'image-2', 101).ok).toBe(false);
  });

  it('filters malformed records, isolates scopes, and keeps eight newest', () => {
    const presets = Array.from({ length: 10 }, (_, index) => ({
      id: `image-${index}`,
      name: `Preset ${index}`,
      scope: 'image',
      createdAt: index,
      settings: imageSettings,
    }));
    presets.push({
      id: 'audio-1',
      name: 'Audio',
      scope: 'media',
      createdAt: 99,
      settings: audioSettings,
    } as unknown as typeof presets[number]);
    const parsed = parseStandardPresets(JSON.stringify([...presets, { bad: true }]), 'image');
    expect(parsed.map((preset) => preset.id)).toEqual([
      'image-9', 'image-8', 'image-7', 'image-6', 'image-5', 'image-4', 'image-3', 'image-2',
    ]);
  });

  it('adds, serializes, removes, and round-trips last settings', () => {
    const first = createStandardPreset('image', 'First', imageSettings, 'one', 100);
    const second = createStandardPreset('image', 'Second', imageSettings, 'two', 200);
    if (!first.ok || !second.ok) throw new Error('invalid fixture');
    const added = addStandardPreset([first.preset], second.preset);
    expect(parseStandardPresets(serializeStandardPresets(added), 'image').map((preset) => preset.id))
      .toEqual(['two', 'one']);
    expect(removeStandardPreset(added, 'two').map((preset) => preset.id)).toEqual(['one']);
    expect(parseLastSettings(serializeLastSettings('media', audioSettings), 'media')).toEqual(audioSettings);
    expect(parseLastSettings(JSON.stringify({ scope: 'image', settings: audioSettings }), 'media')).toBeNull();
  });
});
