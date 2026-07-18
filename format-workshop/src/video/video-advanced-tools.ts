import { buildAudioCommand } from '../conversion/audio-converter';

export type SnapshotFormat = 'jpeg' | 'png';
export type VideoRotation = 0 | 90 | 180 | 270;
export type VideoCrop = 'source' | 'square' | '16:9' | '9:16' | '4:3';
export type ExtractAudioFormat = 'mp3' | 'm4a' | 'wav';
export type ExtractAudioBitrate = 128 | 192 | 256;

export interface SnapshotSettings {
  time: number;
  format: SnapshotFormat;
}

export interface TransformSettings {
  rotation: VideoRotation;
  crop: VideoCrop;
  removeAudio: boolean;
}

export interface ExtractAudioSettings {
  format: ExtractAudioFormat;
  bitrate: ExtractAudioBitrate;
}

export type AdvancedVideoValidationResult =
  | { ok: true }
  | { ok: false; message: string };

const CROP_FILTERS: Readonly<Record<VideoCrop, string>> = {
  source: '',
  square: 'crop=min(iw\\,ih):min(iw\\,ih)',
  '16:9': 'crop=min(iw\\,ih*16/9):min(ih\\,iw*9/16)',
  '9:16': 'crop=min(iw\\,ih*9/16):min(ih\\,iw*16/9)',
  '4:3': 'crop=min(iw\\,ih*4/3):min(ih\\,iw*3/4)',
};

const ROTATION_FILTERS: Readonly<Record<VideoRotation, string>> = {
  0: '',
  90: 'transpose=clock',
  180: 'hflip,vflip',
  270: 'transpose=cclock',
};

function formatSeconds(value: number): string {
  return String(Math.round(value * 1000) / 1000);
}

export function validateSnapshotTime(
  time: number,
  sourceDuration: number,
): AdvancedVideoValidationResult {
  if (!Number.isFinite(time) || !Number.isFinite(sourceDuration)) {
    return { ok: false, message: '请输入有效的截图时间。' };
  }
  if (time < 0 || time >= sourceDuration) {
    return { ok: false, message: '截图时间不能超过源视频范围。' };
  }
  return { ok: true };
}

export function validateTransformSettings(
  settings: TransformSettings,
): AdvancedVideoValidationResult {
  if (![0, 90, 180, 270].includes(settings.rotation)) {
    return { ok: false, message: '请选择有效的旋转角度。' };
  }
  if (!['source', 'square', '16:9', '9:16', '4:3'].includes(settings.crop)) {
    return { ok: false, message: '请选择有效的画面比例。' };
  }
  if (settings.rotation === 0 && settings.crop === 'source' && !settings.removeAudio) {
    return { ok: false, message: '请至少选择一种画面调整或移除音频。' };
  }
  return { ok: true };
}

export function buildSnapshotCommand(
  input: string,
  output: string,
  settings: SnapshotSettings,
): string[] {
  const command = [
    '-ss', formatSeconds(settings.time),
    '-i', input,
    '-frames:v', '1',
  ];
  if (settings.format === 'jpeg') command.push('-q:v', '2');
  else command.push('-compression_level', '6');
  command.push('-map_metadata', '-1', output);
  return command;
}

export function buildTransformCommand(
  input: string,
  output: string,
  settings: TransformSettings,
): string[] {
  const filters = [CROP_FILTERS[settings.crop], ROTATION_FILTERS[settings.rotation]]
    .filter(Boolean)
    .concat('scale=trunc(iw/2)*2:trunc(ih/2)*2')
    .join(',');
  const command = ['-i', input, '-map', '0:v:0'];
  if (!settings.removeAudio) command.push('-map', '0:a?');
  if (filters) command.push('-vf', filters);
  command.push(
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-crf', '23',
    '-pix_fmt', 'yuv420p',
  );
  if (settings.removeAudio) command.push('-an');
  else command.push('-c:a', 'aac', '-b:a', '160k');
  command.push('-movflags', '+faststart', output);
  return command;
}

export function buildExtractAudioCommand(
  input: string,
  output: string,
  settings: ExtractAudioSettings,
): string[] {
  return buildAudioCommand(input, output, settings.format, {
    bitrate: settings.bitrate,
    sampleRate: 'source',
    channels: 'source',
  });
}
