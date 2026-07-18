import { describe, expect, it } from 'vitest';

import {
  buildOutputName,
  getAvailableTargets,
  inspectFolderFiles,
  validateFileBatch,
  validateSourceFile,
} from '../src/conversion/file-validation';

const MB = 1024 * 1024;

describe('validateSourceFile', () => {
  it('accepts supported image MIME types within 25 MB', () => {
    expect(
      validateSourceFile({ name: 'photo.png', type: 'image/png', size: 24 * MB }),
    ).toEqual({ ok: true, kind: 'image', sourceFormat: 'png' });
  });

  it('accepts MP4 video within 200 MB', () => {
    expect(
      validateSourceFile({ name: 'meeting.mp4', type: 'video/mp4', size: 199 * MB }),
    ).toEqual({ ok: true, kind: 'media', sourceFormat: 'mp4' });
  });

  it.each([
    ['audio/mpeg', 'mp3'],
    ['audio/mp3', 'mp3'],
    ['audio/x-mp3', 'mp3'],
    ['audio/wav', 'wav'],
    ['audio/x-wav', 'wav'],
    ['audio/mp4', 'm4a'],
    ['audio/x-m4a', 'm4a'],
    ['audio/aac', 'aac'],
    ['audio/flac', 'flac'],
    ['audio/x-flac', 'flac'],
    ['audio/ogg', 'ogg'],
  ])('accepts supported audio MIME %s as %s', (type, sourceFormat) => {
    expect(
      validateSourceFile({ name: `audio.${sourceFormat}`, type, size: 10 * MB }),
    ).toEqual({ ok: true, kind: 'media', sourceFormat });
  });

  it('rejects empty files', () => {
    expect(validateSourceFile({ name: 'empty.png', type: 'image/png', size: 0 })).toEqual({
      ok: false,
      message: '文件为空，无法转换。',
    });
  });

  it('rejects images larger than 25 MB', () => {
    expect(
      validateSourceFile({ name: 'huge.webp', type: 'image/webp', size: 25 * MB + 1 }),
    ).toEqual({ ok: false, message: '图片不能超过 25 MB。' });
  });

  it('rejects MP4 videos larger than 200 MB', () => {
    expect(
      validateSourceFile({ name: 'huge.mp4', type: 'video/mp4', size: 200 * MB + 1 }),
    ).toEqual({ ok: false, message: '音视频文件不能超过 200 MB。' });
  });

  it('rejects a supported extension when the MIME type is unrelated', () => {
    expect(
      validateSourceFile({ name: 'disguised.png', type: 'text/html', size: 10 }),
    ).toEqual({
      ok: false,
      message: '当前支持 JPG、PNG、WebP 图片，以及 MP4、MP3、WAV、M4A、AAC、FLAC、OGG 音视频。',
    });
  });
});

describe('getAvailableTargets', () => {
  it('offers all image formats so resizing and compression can keep the source format', () => {
    expect(getAvailableTargets('image', 'png')).toEqual(['jpeg', 'png', 'webp']);
    expect(getAvailableTargets('image', 'jpeg')).toEqual(['jpeg', 'png', 'webp']);
  });

  it('offers all audio outputs for media input', () => {
    const audioTargets = ['mp3', 'wav', 'm4a', 'aac', 'flac', 'ogg'];
    expect(getAvailableTargets('media', 'mp4')).toEqual(audioTargets);
    expect(getAvailableTargets('media', 'mp3')).toEqual(audioTargets);
    expect(getAvailableTargets('media', 'wav')).toEqual(audioTargets);
  });
});

describe('validateFileBatch', () => {
  it('accepts up to 20 images totaling no more than 100 MB', () => {
    const files = Array.from({ length: 20 }, (_, index) => ({
      name: `image-${index}.png`,
      type: 'image/png',
      size: 5 * MB,
    }));

    expect(validateFileBatch(files, 'image')).toEqual({
      ok: true,
      entries: files.map(() => ({ kind: 'image', sourceFormat: 'png' })),
    });
  });

  it('rejects more than 20 images', () => {
    const files = Array.from({ length: 21 }, (_, index) => ({
      name: `image-${index}.webp`,
      type: 'image/webp',
      size: 1,
    }));

    expect(validateFileBatch(files, 'image')).toEqual({
      ok: false,
      message: '一次最多转换 20 张图片。',
    });
  });

  it('rejects an image batch larger than 100 MB', () => {
    const files = Array.from({ length: 5 }, (_, index) => ({
      name: `image-${index}.jpg`,
      type: 'image/jpeg',
      size: 21 * MB,
    }));

    expect(validateFileBatch(files, 'image')).toEqual({
      ok: false,
      message: '一批图片总大小不能超过 100 MB。',
    });
  });

  it('keeps media conversion single-file only', () => {
    const videos = [
      { name: 'one.mp4', type: 'video/mp4', size: 1 * MB },
      { name: 'two.mp4', type: 'video/mp4', size: 1 * MB },
    ];

    expect(validateFileBatch(videos, 'media')).toEqual({
      ok: false,
      message: '音频转换每次请选择一个文件。',
    });
  });
});

describe('inspectFolderFiles', () => {
  it('keeps supported non-empty image files and reports skipped files', () => {
    const files = [
      { name: 'one.png', type: 'image/png', size: 10 },
      { name: 'notes.txt', type: 'text/plain', size: 10 },
      { name: 'empty.jpg', type: 'image/jpeg', size: 0 },
    ];

    expect(inspectFolderFiles(files)).toEqual({
      accepted: [files[0]],
      skipped: [files[1], files[2]],
      skippedCount: 2,
    });
  });

  it('keeps individually valid files for batch validation to enforce caps', () => {
    const files = Array.from({ length: 21 }, (_, index) => ({
      name: `image-${index}.png`,
      type: 'image/png',
      size: 1,
    }));

    const result = inspectFolderFiles(files);
    expect(result.accepted).toHaveLength(21);
    expect(result.skippedCount).toBe(0);
  });
});

describe('buildOutputName', () => {
  it('replaces the final extension and preserves earlier dots', () => {
    expect(buildOutputName('summer.trip.final.png', 'webp')).toBe(
      'summer.trip.final.webp',
    );
  });

  it('uses jpg as the conventional extension for JPEG output', () => {
    expect(buildOutputName('portrait.webp', 'jpeg')).toBe('portrait.jpg');
  });

  it('uses the selected audio container extension', () => {
    expect(buildOutputName('recording.mp3', 'm4a')).toBe('recording.m4a');
    expect(buildOutputName('recording.wav', 'flac')).toBe('recording.flac');
  });

  it('adds a name when the source contains only an extension', () => {
    expect(buildOutputName('.mp4', 'mp3')).toBe('converted.mp3');
  });
});
