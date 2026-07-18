import { describe, expect, it } from 'vitest';

import {
  calculateImageSize,
  calculateTransformedImageSize,
  getImageEncoding,
  normalizeWatermarkText,
} from '../src/conversion/image-converter';
import {
  buildAudioCommand,
  ConversionCanceledError,
  getAudioOutputMimeType,
  getFfmpegAssetPaths,
  getMediaInputExtension,
  isConversionCanceled,
  normalizeProgress,
} from '../src/conversion/audio-converter';
import { buildBatchOutputName } from '../src/conversion/file-validation';

describe('getImageEncoding', () => {
  it('uses the browser MIME type for each image target', () => {
    expect(getImageEncoding('png')).toEqual({
      mimeType: 'image/png',
      quality: undefined,
      background: 'transparent',
    });
    expect(getImageEncoding('webp', 72)).toEqual({
      mimeType: 'image/webp',
      quality: 0.72,
      background: 'transparent',
    });
  });

  it('uses a white background for JPEG output', () => {
    expect(getImageEncoding('jpeg')).toEqual({
      mimeType: 'image/jpeg',
      quality: 0.92,
      background: '#ffffff',
    });
  });

  it('clamps user quality before passing it to the browser encoder', () => {
    expect(getImageEncoding('jpeg', 20).quality).toBe(0.4);
    expect(getImageEncoding('webp', 120).quality).toBe(1);
  });
});

describe('calculateImageSize', () => {
  it('keeps the source size when no limits are supplied', () => {
    expect(calculateImageSize(2400, 1600, {})).toEqual({ width: 2400, height: 1600 });
  });

  it('fits inside width and height limits without changing aspect ratio', () => {
    expect(calculateImageSize(2400, 1600, { maxWidth: 1200, maxHeight: 500 })).toEqual({
      width: 750,
      height: 500,
    });
  });

  it('never enlarges a smaller image', () => {
    expect(calculateImageSize(640, 480, { maxWidth: 1920, maxHeight: 1080 })).toEqual({
      width: 640,
      height: 480,
    });
  });
});

describe('image editing', () => {
  it('swaps the output dimensions for quarter-turn rotations', () => {
    expect(calculateTransformedImageSize(2400, 1600, {
      maxWidth: 1200,
      maxHeight: 1200,
      rotation: 90,
    })).toEqual({ width: 800, height: 1200 });
    expect(calculateTransformedImageSize(2400, 1600, {
      maxWidth: 1200,
      rotation: 180,
    })).toEqual({ width: 1200, height: 800 });
    expect(calculateTransformedImageSize(2400, 1600, {
      maxWidth: 1200,
      maxHeight: 600,
      rotation: 270,
    })).toEqual({ width: 400, height: 600 });
  });

  it('bounds watermark text and removes control characters', () => {
    expect(normalizeWatermarkText('  品牌\n水印\u0000  ')).toBe('品牌 水印');
    expect(normalizeWatermarkText('a'.repeat(80))).toHaveLength(40);
  });
});

describe('batch output naming', () => {
  it('keeps original names when batch rename is empty', () => {
    expect(buildBatchOutputName('summer.photo.png', 'webp', '', 0, 12))
      .toBe('summer.photo.webp');
  });

  it('creates padded, path-safe names for a renamed batch', () => {
    expect(buildBatchOutputName('photo.png', 'jpeg', '../活动:照片', 1, 12))
      .toBe('活动_照片-02.jpg');
  });

  it('uses the chosen name directly for a single file', () => {
    expect(buildBatchOutputName('photo.png', 'png', '封面图', 0, 1))
      .toBe('封面图.png');
  });
});

describe('buildAudioCommand', () => {
  it('builds a configurable MP3 command from the first audio track', () => {
    expect(buildAudioCommand('input.mp4', 'output.mp3', 'mp3', {
      bitrate: 256,
      sampleRate: 48_000,
      channels: 1,
    })).toEqual([
      '-i',
      'input.mp4',
      '-map',
      '0:a:0',
      '-vn',
      '-map_metadata',
      '-1',
      '-codec:a',
      'libmp3lame',
      '-b:a',
      '256k',
      '-ar',
      '48000',
      '-ac',
      '1',
      'output.mp3',
    ]);
  });

  it('uses container-specific codecs and omits bitrate for lossless output', () => {
    expect(buildAudioCommand('input.mp3', 'output.wav', 'wav', {
      bitrate: 320,
      sampleRate: 'source',
      channels: 'source',
    })).toEqual([
      '-i', 'input.mp3', '-map', '0:a:0', '-vn', '-map_metadata', '-1',
      '-codec:a', 'pcm_s16le', 'output.wav',
    ]);
    expect(buildAudioCommand('input.wav', 'output.flac', 'flac', {
      bitrate: 320,
      sampleRate: 44_100,
      channels: 2,
    })).toContain('flac');
    expect(buildAudioCommand('input.wav', 'output.flac', 'flac', {
      bitrate: 320,
      sampleRate: 44_100,
      channels: 2,
    })).not.toContain('320k');
  });

  it.each([
    ['m4a', 'aac'],
    ['aac', 'aac'],
    ['ogg', 'libvorbis'],
  ] as const)('uses %s output with the %s encoder', (target, codec) => {
    const command = buildAudioCommand('input.wav', `output.${target}`, target, {
      bitrate: 192,
      sampleRate: 'source',
      channels: 'source',
    });
    expect(command).toContain(codec);
    expect(command).toContain('192k');
  });

  it('keeps mono Vorbis within the encoder bitrate limit', () => {
    const command = buildAudioCommand('input.wav', 'output.ogg', 'ogg', {
      bitrate: 320,
      sampleRate: 48_000,
      channels: 1,
    });
    expect(command).toContain('192k');
    expect(command).not.toContain('320k');

    const unknownChannels = buildAudioCommand('input.wav', 'output.ogg', 'ogg', {
      bitrate: 320,
      sampleRate: 48_000,
      channels: 'source',
    });
    expect(unknownChannels).toContain('192k');
    expect(unknownChannels).not.toContain('320k');
  });

  it('uses a Vorbis-compatible sample rate when the source rate is unknown', () => {
    const command = buildAudioCommand('input.wav', 'output.ogg', 'ogg', {
      bitrate: 128,
      sampleRate: 'source',
      channels: 2,
    });
    expect(command).toContain('-ar');
    expect(command).toContain('48000');
  });

  it('applies trim, volume, normalization, speed and fades to the output', () => {
    const command = buildAudioCommand('input.wav', 'output.mp3', 'mp3', {
      bitrate: 192,
      sampleRate: 'source',
      channels: 'source',
      trimStart: 5,
      trimEnd: 35,
      volume: 125,
      normalize: true,
      speed: 1.5,
      fadeIn: 2,
      fadeOut: 3,
      sourceDuration: 90,
    });

    expect(command).toContain('-af');
    expect(command).toContain(
      'atrim=start=5:end=35,asetpts=N/SR/TB,loudnorm=I=-16:TP=-1.5:LRA=11,volume=1.25,atempo=1.5,afade=t=in:st=0:d=2,afade=t=out:st=17:d=3',
    );
  });

  it('rejects unsafe edit values before building an FFmpeg command', () => {
    expect(() => buildAudioCommand('input.wav', 'output.mp3', 'mp3', {
      bitrate: 192,
      sampleRate: 'source',
      channels: 'source',
      trimStart: -1,
    })).toThrow('裁剪开始时间');
    expect(() => buildAudioCommand('input.wav', 'output.mp3', 'mp3', {
      bitrate: 192,
      sampleRate: 'source',
      channels: 'source',
      speed: 3 as 2,
    })).toThrow('播放速度');
  });
});

describe('getAudioOutputMimeType', () => {
  it('returns a playable MIME type for every supported audio output', () => {
    expect(getAudioOutputMimeType('mp3')).toBe('audio/mpeg');
    expect(getAudioOutputMimeType('wav')).toBe('audio/wav');
    expect(getAudioOutputMimeType('m4a')).toBe('audio/mp4');
    expect(getAudioOutputMimeType('aac')).toBe('audio/aac');
    expect(getAudioOutputMimeType('flac')).toBe('audio/flac');
    expect(getAudioOutputMimeType('ogg')).toBe('audio/ogg');
  });
});

describe('getMediaInputExtension', () => {
  it('preserves the validated media container for FFmpeg demuxing', () => {
    expect(getMediaInputExtension('mp4')).toBe('mp4');
    expect(getMediaInputExtension('m4a')).toBe('m4a');
    expect(getMediaInputExtension('aac')).toBe('aac');
    expect(getMediaInputExtension('flac')).toBe('flac');
    expect(getMediaInputExtension('ogg')).toBe('ogg');
    expect(getMediaInputExtension('wav')).toBe('wav');
    expect(getMediaInputExtension('mp3')).toBe('mp3');
  });
});

describe('normalizeProgress', () => {
  it('clamps FFmpeg progress to a stable 0-100 range', () => {
    expect(normalizeProgress(-0.5)).toBe(0);
    expect(normalizeProgress(0.427)).toBe(43);
    expect(normalizeProgress(2)).toBe(100);
  });
});

describe('getFfmpegAssetPaths', () => {
  it('keeps FFmpeg core assets on the current site base path', () => {
    expect(getFfmpegAssetPaths('/tools/')).toEqual({
      core: '/tools/ffmpeg/ffmpeg-core.js',
      wasm: '/tools/ffmpeg/ffmpeg-core.wasm',
    });
  });
});

describe('conversion cancellation', () => {
  it('uses a dedicated error so cancellation is not shown as a file failure', () => {
    expect(isConversionCanceled(new ConversionCanceledError())).toBe(true);
    expect(isConversionCanceled(new Error('转换失败'))).toBe(false);
  });
});
