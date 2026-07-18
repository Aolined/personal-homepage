import { describe, expect, it } from 'vitest';

import {
  buildCompressCommand,
  buildGifCommands,
  buildTrimCommand,
  buildVideoOutputName,
  isVideoConversionCanceled,
  looksLikeMp4,
  validateGifRange,
  validateTrimRange,
  validateVideoDuration,
  validateVideoFile,
  VideoConversionCanceledError,
} from '../src/video/video-toolbox';
import {
  buildExtractAudioCommand,
  buildSnapshotCommand,
  buildTransformCommand,
  validateSnapshotTime,
  validateTransformSettings,
} from '../src/video/video-advanced-tools';

const MB = 1024 * 1024;

describe('video file validation', () => {
  it('accepts one non-empty MP4 up to 150 MB', () => {
    expect(validateVideoFile({ name: 'clip.mp4', type: 'video/mp4', size: 150 * MB }))
      .toEqual({ ok: true });
  });

  it('rejects an empty, oversized, or non-MP4 file', () => {
    expect(validateVideoFile({ name: 'empty.mp4', type: 'video/mp4', size: 0 }).ok)
      .toBe(false);
    expect(validateVideoFile({ name: 'large.mp4', type: 'video/mp4', size: 150 * MB + 1 }).ok)
      .toBe(false);
    expect(validateVideoFile({ name: 'fake.mp4', type: 'text/html', size: 12 }).ok)
      .toBe(false);
  });

  it('checks the MP4 ftyp signature before handing bytes to FFmpeg', () => {
    expect(looksLikeMp4(new Uint8Array([
      0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d,
    ]))).toBe(true);
    expect(looksLikeMp4(new TextEncoder().encode('<script>alert(1)</script>'))).toBe(false);
  });

  it('accepts videos up to ten minutes and rejects invalid metadata', () => {
    expect(validateVideoDuration(600)).toEqual({ ok: true });
    expect(validateVideoDuration(600.01).ok).toBe(false);
    expect(validateVideoDuration(Number.NaN).ok).toBe(false);
  });
});

describe('video command builders', () => {
  it('builds a balanced 720p compression command and preserves audio', () => {
    expect(buildCompressCommand('input.mp4', 'output.mp4', {
      quality: 'balanced',
      resolution: 720,
      frameRate: 30,
      removeAudio: false,
    })).toEqual([
      '-i', 'input.mp4',
      '-map', '0:v:0', '-map', '0:a?',
      '-vf', 'scale=-2:min(720\\,ih)', '-r', '30',
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '26',
      '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k',
      '-movflags', '+faststart', 'output.mp4',
    ]);
  });

  it('can retain source dimensions and remove audio', () => {
    const command = buildCompressCommand('input.mp4', 'output.mp4', {
      quality: 'high',
      resolution: 'source',
      frameRate: 'source',
      removeAudio: true,
    });
    expect(command).not.toContain('-vf');
    expect(command).not.toContain('-r');
    expect(command).toContain('-an');
    expect(command).toContain('22');
  });

  it('validates trim boundaries and builds an accurate MP4 trim', () => {
    expect(validateTrimRange(12.5, 42.5, 60)).toEqual({ ok: true, duration: 30 });
    expect(validateTrimRange(42.5, 12.5, 60).ok).toBe(false);
    expect(validateTrimRange(0, 61, 60).ok).toBe(false);

    expect(buildTrimCommand('input.mp4', 'output.mp4', {
      start: 12.5,
      end: 42.5,
      removeAudio: false,
    })).toEqual([
      '-ss', '12.5', '-i', 'input.mp4', '-t', '30',
      '-map', '0:v:0', '-map', '0:a?',
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23',
      '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '160k',
      '-movflags', '+faststart', 'output.mp4',
    ]);
  });

  it('uses palettegen and paletteuse for a bounded GIF conversion', () => {
    expect(validateGifRange(2, 17, 60)).toEqual({ ok: true, duration: 15 });
    expect(validateGifRange(0, 31, 60).ok).toBe(false);

    const commands = buildGifCommands('input.mp4', 'palette.png', 'output.gif', {
      start: 2,
      end: 17,
      width: 640,
      frameRate: 12,
    });
    expect(commands).toHaveLength(2);
    expect(commands[0]).toContain('fps=12,scale=640:-2:flags=lanczos,palettegen=stats_mode=diff');
    expect(commands[1]).toContain('[0:v]fps=12,scale=640:-2:flags=lanczos[x];[x][1:v]paletteuse=dither=sierra2_4a');
    expect(commands[1]).toContain('-loop');
  });

  it('extracts a bounded frame as metadata-free JPEG or PNG', () => {
    expect(validateSnapshotTime(2.5, 10)).toEqual({ ok: true });
    expect(validateSnapshotTime(-1, 10).ok).toBe(false);
    expect(validateSnapshotTime(10, 10).ok).toBe(false);
    expect(validateSnapshotTime(10.1, 10).ok).toBe(false);

    expect(buildSnapshotCommand('input.mp4', 'frame.jpg', {
      time: 2.5,
      format: 'jpeg',
    })).toEqual([
      '-ss', '2.5', '-i', 'input.mp4', '-frames:v', '1',
      '-q:v', '2', '-map_metadata', '-1', 'frame.jpg',
    ]);
    expect(buildSnapshotCommand('input.mp4', 'frame.png', {
      time: 0,
      format: 'png',
    })).toContain('6');
  });

  it('builds centered crop and rotation filters before MP4 encoding', () => {
    expect(validateTransformSettings({
      rotation: 0,
      crop: 'source',
      removeAudio: false,
    }).ok).toBe(false);
    expect(validateTransformSettings({
      rotation: 90,
      crop: 'square',
      removeAudio: false,
    })).toEqual({ ok: true });

    expect(buildTransformCommand('input.mp4', 'output.mp4', {
      rotation: 90,
      crop: 'square',
      removeAudio: false,
    })).toEqual([
      '-i', 'input.mp4', '-map', '0:v:0', '-map', '0:a?',
      '-vf', 'crop=min(iw\\,ih):min(iw\\,ih),transpose=clock,scale=trunc(iw/2)*2:trunc(ih/2)*2',
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23',
      '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '160k',
      '-movflags', '+faststart', 'output.mp4',
    ]);
  });

  it('extracts MP3, M4A, or WAV audio without carrying source metadata', () => {
    expect(buildExtractAudioCommand('input.mp4', 'output.mp3', {
      format: 'mp3',
      bitrate: 192,
    })).toEqual([
      '-i', 'input.mp4', '-map', '0:a:0', '-vn', '-map_metadata', '-1',
      '-codec:a', 'libmp3lame', '-b:a', '192k', 'output.mp3',
    ]);
    expect(buildExtractAudioCommand('input.mp4', 'output.m4a', {
      format: 'm4a',
      bitrate: 256,
    })).toContain('aac');
    expect(buildExtractAudioCommand('input.mp4', 'output.wav', {
      format: 'wav',
      bitrate: 256,
    })).not.toContain('256k');
  });
});

describe('video results and cancellation', () => {
  it('adds an operation suffix while preserving earlier dots', () => {
    expect(buildVideoOutputName('summer.trip.mp4', 'compress')).toBe('summer.trip-compressed.mp4');
    expect(buildVideoOutputName('summer.trip.mp4', 'trim')).toBe('summer.trip-trimmed.mp4');
    expect(buildVideoOutputName('.mp4', 'gif')).toBe('converted.gif');
    expect(buildVideoOutputName('summer.trip.mp4', 'snapshot', 'jpeg'))
      .toBe('summer.trip-frame.jpg');
    expect(buildVideoOutputName('summer.trip.mp4', 'transform'))
      .toBe('summer.trip-edited.mp4');
    expect(buildVideoOutputName('summer.trip.mp4', 'audio', 'm4a'))
      .toBe('summer.trip-audio.m4a');
  });

  it('uses a dedicated cancellation error', () => {
    expect(isVideoConversionCanceled(new VideoConversionCanceledError())).toBe(true);
    expect(isVideoConversionCanceled(new Error('conversion failed'))).toBe(false);
  });
});
