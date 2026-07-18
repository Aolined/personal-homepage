import type { FFmpeg } from '@ffmpeg/ffmpeg';

import { getFfmpegAssetPaths } from '../conversion/audio-converter';
import type { ConversionProgress } from '../conversion/image-converter';
import {
  buildExtractAudioCommand,
  buildSnapshotCommand,
  buildTransformCommand,
  validateSnapshotTime,
  validateTransformSettings,
  type ExtractAudioFormat,
  type ExtractAudioSettings,
  type SnapshotFormat,
  type SnapshotSettings,
  type TransformSettings,
} from './video-advanced-tools';

export type VideoTool = 'compress' | 'trim' | 'gif' | 'snapshot' | 'transform' | 'audio';
export type VideoQuality = 'small' | 'balanced' | 'high';
export type VideoResolution = 'source' | 1080 | 720 | 480;
export type VideoFrameRate = 'source' | 30 | 24;
export type GifWidth = 480 | 640 | 800;
export type GifFrameRate = 8 | 12 | 15;

export interface VideoFileDescriptor {
  name: string;
  size: number;
  type: string;
}

export interface CompressSettings {
  quality: VideoQuality;
  resolution: VideoResolution;
  frameRate: VideoFrameRate;
  removeAudio: boolean;
}

export interface TrimSettings {
  start: number;
  end: number;
  removeAudio: boolean;
}

export interface GifSettings {
  start: number;
  end: number;
  width: GifWidth;
  frameRate: GifFrameRate;
}

export type VideoConversionRequest =
  | { tool: 'compress'; duration: number; settings: CompressSettings }
  | { tool: 'trim'; duration: number; settings: TrimSettings }
  | { tool: 'gif'; duration: number; settings: GifSettings }
  | { tool: 'snapshot'; duration: number; settings: SnapshotSettings }
  | { tool: 'transform'; duration: number; settings: TransformSettings }
  | { tool: 'audio'; duration: number; settings: ExtractAudioSettings };

export interface VideoConversionResult {
  blob: Blob;
  name: string;
  mimeType: 'video/mp4' | 'image/gif' | 'image/jpeg' | 'image/png'
    | 'audio/mpeg' | 'audio/mp4' | 'audio/wav';
}

export type VideoValidationResult =
  | { ok: true }
  | { ok: false; message: string };

export type VideoRangeValidationResult =
  | { ok: true; duration: number }
  | { ok: false; message: string };

export const MAX_VIDEO_BYTES = 150 * 1024 * 1024;
export const MAX_VIDEO_DURATION = 10 * 60;
export const MAX_GIF_DURATION = 30;

const QUALITY_CRF: Readonly<Record<VideoQuality, number>> = {
  small: 30,
  balanced: 26,
  high: 22,
};

export class VideoConversionCanceledError extends Error {
  constructor() {
    super('视频处理已取消。');
    this.name = 'VideoConversionCanceledError';
  }
}

export function isVideoConversionCanceled(error: unknown): boolean {
  return error instanceof VideoConversionCanceledError;
}

export function validateVideoFile(file: VideoFileDescriptor): VideoValidationResult {
  if (file.size <= 0) return { ok: false, message: '文件为空，无法处理。' };
  if (file.type.toLowerCase() !== 'video/mp4') {
    return { ok: false, message: '视频工具箱当前仅支持 MP4 文件。' };
  }
  if (file.size > MAX_VIDEO_BYTES) {
    return { ok: false, message: 'MP4 文件不能超过 150 MB。' };
  }
  return { ok: true };
}

export function looksLikeMp4(bytes: Uint8Array): boolean {
  for (let index = 4; index <= bytes.length - 4; index += 1) {
    if (
      bytes[index] === 0x66
      && bytes[index + 1] === 0x74
      && bytes[index + 2] === 0x79
      && bytes[index + 3] === 0x70
    ) return true;
  }
  return false;
}

export function validateVideoDuration(duration: number): VideoValidationResult {
  if (!Number.isFinite(duration) || duration <= 0) {
    return { ok: false, message: '无法读取视频时长，请确认 MP4 文件完整。' };
  }
  if (duration > MAX_VIDEO_DURATION) {
    return { ok: false, message: '视频时长不能超过 10 分钟。' };
  }
  return { ok: true };
}

function validateRange(
  start: number,
  end: number,
  sourceDuration: number,
  maxDuration?: number,
): VideoRangeValidationResult {
  if (![start, end, sourceDuration].every(Number.isFinite)) {
    return { ok: false, message: '请输入有效的开始和结束时间。' };
  }
  if (start < 0 || end <= start) {
    return { ok: false, message: '结束时间必须晚于开始时间。' };
  }
  if (end > sourceDuration + 0.001) {
    return { ok: false, message: '结束时间不能超过源视频时长。' };
  }
  const duration = Math.round((end - start) * 1000) / 1000;
  if (maxDuration && duration > maxDuration) {
    return { ok: false, message: `GIF 片段不能超过 ${maxDuration} 秒。` };
  }
  return { ok: true, duration };
}

export function validateTrimRange(
  start: number,
  end: number,
  sourceDuration: number,
): VideoRangeValidationResult {
  return validateRange(start, end, sourceDuration);
}

export function validateGifRange(
  start: number,
  end: number,
  sourceDuration: number,
): VideoRangeValidationResult {
  return validateRange(start, end, sourceDuration, MAX_GIF_DURATION);
}

function formatSeconds(value: number): string {
  return String(Math.round(value * 1000) / 1000);
}

function audioCommand(removeAudio: boolean, bitrate: 128 | 160): string[] {
  return removeAudio
    ? ['-an']
    : ['-c:a', 'aac', '-b:a', `${bitrate}k`];
}

export function buildCompressCommand(
  input: string,
  output: string,
  settings: CompressSettings,
): string[] {
  const command = ['-i', input, '-map', '0:v:0'];
  if (!settings.removeAudio) command.push('-map', '0:a?');
  if (settings.resolution !== 'source') {
    command.push('-vf', `scale=-2:min(${settings.resolution}\\,ih)`);
  }
  if (settings.frameRate !== 'source') command.push('-r', String(settings.frameRate));
  command.push(
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-crf', String(QUALITY_CRF[settings.quality]),
    '-pix_fmt', 'yuv420p',
    ...audioCommand(settings.removeAudio, 128),
    '-movflags', '+faststart',
    output,
  );
  return command;
}

export function buildTrimCommand(
  input: string,
  output: string,
  settings: TrimSettings,
): string[] {
  const duration = Math.round((settings.end - settings.start) * 1000) / 1000;
  const command = [
    '-ss', formatSeconds(settings.start),
    '-i', input,
    '-t', formatSeconds(duration),
    '-map', '0:v:0',
  ];
  if (!settings.removeAudio) command.push('-map', '0:a?');
  command.push(
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-crf', '23',
    '-pix_fmt', 'yuv420p',
    ...audioCommand(settings.removeAudio, 160),
    '-movflags', '+faststart',
    output,
  );
  return command;
}

export function buildGifCommands(
  input: string,
  palette: string,
  output: string,
  settings: GifSettings,
): string[][] {
  const duration = formatSeconds(settings.end - settings.start);
  const seek = ['-ss', formatSeconds(settings.start), '-t', duration, '-i', input];
  const filter = `fps=${settings.frameRate},scale=${settings.width}:-2:flags=lanczos`;
  return [
    [
      ...seek,
      '-vf', `${filter},palettegen=stats_mode=diff`,
      '-y', palette,
    ],
    [
      ...seek,
      '-i', palette,
      '-lavfi', `[0:v]${filter}[x];[x][1:v]paletteuse=dither=sierra2_4a`,
      '-loop', '0',
      '-y', output,
    ],
  ];
}

export function buildVideoOutputName(
  sourceName: string,
  tool: VideoTool,
  outputFormat?: SnapshotFormat | ExtractAudioFormat,
): string {
  const baseName = sourceName.replace(/\.[^.]*$/, '').trim() || 'converted';
  if (tool === 'gif') return `${baseName}.gif`;
  if (tool === 'snapshot') {
    return `${baseName}-frame.${outputFormat === 'png' ? 'png' : 'jpg'}`;
  }
  if (tool === 'audio') return `${baseName}-audio.${outputFormat ?? 'mp3'}`;
  if (tool === 'transform') return `${baseName}-edited.mp4`;
  return `${baseName}-${tool === 'compress' ? 'compressed' : 'trimmed'}.mp4`;
}

function buildCommands(
  input: string,
  palette: string,
  output: string,
  request: VideoConversionRequest,
): string[][] {
  if (request.tool === 'compress') {
    return [buildCompressCommand(input, output, request.settings)];
  }
  if (request.tool === 'trim') {
    return [buildTrimCommand(input, output, request.settings)];
  }
  if (request.tool === 'gif') {
    return buildGifCommands(input, palette, output, request.settings);
  }
  if (request.tool === 'snapshot') {
    return [buildSnapshotCommand(input, output, request.settings)];
  }
  if (request.tool === 'transform') {
    return [buildTransformCommand(input, output, request.settings)];
  }
  return [buildExtractAudioCommand(input, output, request.settings)];
}

function getRequestOutput(request: VideoConversionRequest): {
  extension: string;
  mimeType: VideoConversionResult['mimeType'];
  nameFormat?: SnapshotFormat | ExtractAudioFormat;
} {
  if (request.tool === 'gif') return { extension: 'gif', mimeType: 'image/gif' };
  if (request.tool === 'snapshot') {
    return request.settings.format === 'png'
      ? { extension: 'png', mimeType: 'image/png', nameFormat: 'png' }
      : { extension: 'jpg', mimeType: 'image/jpeg', nameFormat: 'jpeg' };
  }
  if (request.tool === 'audio') {
    const mimeTypes: Record<ExtractAudioFormat, VideoConversionResult['mimeType']> = {
      mp3: 'audio/mpeg',
      m4a: 'audio/mp4',
      wav: 'audio/wav',
    };
    return {
      extension: request.settings.format,
      mimeType: mimeTypes[request.settings.format],
      nameFormat: request.settings.format,
    };
  }
  return { extension: 'mp4', mimeType: 'video/mp4' };
}

function getRequestValidation(request: VideoConversionRequest): VideoValidationResult {
  const durationValidation = validateVideoDuration(request.duration);
  if (!durationValidation.ok) return durationValidation;
  if (request.tool === 'trim') {
    const result = validateTrimRange(
      request.settings.start,
      request.settings.end,
      request.duration,
    );
    return result.ok ? { ok: true } : result;
  }
  if (request.tool === 'gif') {
    const result = validateGifRange(
      request.settings.start,
      request.settings.end,
      request.duration,
    );
    return result.ok ? { ok: true } : result;
  }
  if (request.tool === 'snapshot') {
    return validateSnapshotTime(request.settings.time, request.duration);
  }
  if (request.tool === 'transform') {
    return validateTransformSettings(request.settings);
  }
  return { ok: true };
}

export class VideoToolboxConverter {
  private ffmpeg: FFmpeg | null = null;
  private loadPromise: Promise<FFmpeg> | null = null;
  private fetchFile: ((file: File | Blob) => Promise<Uint8Array>) | null = null;
  private progressCallback: ConversionProgress | undefined;
  private progressStep = 0;
  private progressSteps = 1;
  private generation = 0;
  private coreBlobUrls: string[] = [];

  private async ensureLoaded(onProgress?: ConversionProgress): Promise<FFmpeg> {
    if (this.ffmpeg?.loaded) return this.ffmpeg;
    if (this.loadPromise) return this.loadPromise;

    const generation = this.generation;
    const pending = (async () => {
      onProgress?.(3, '正在加载本地视频引擎');
      const [{ FFmpeg }, { fetchFile, toBlobURL }] = await Promise.all([
        import('@ffmpeg/ffmpeg'),
        import('@ffmpeg/util'),
      ]);
      const ffmpeg = new FFmpeg();
      ffmpeg.on('progress', ({ progress }) => {
        if (generation !== this.generation || !Number.isFinite(progress)) return;
        const commandProgress = Math.min(1, Math.max(0, progress));
        const overall = (this.progressStep + commandProgress) / this.progressSteps;
        this.progressCallback?.(15 + Math.round(overall * 80), '正在本地处理视频');
      });

      const assets = getFfmpegAssetPaths(import.meta.env.BASE_URL);
      const [coreURL, wasmURL] = await Promise.all([
        toBlobURL(assets.core, 'text/javascript'),
        toBlobURL(assets.wasm, 'application/wasm'),
      ]);
      try {
        await ffmpeg.load({ coreURL, wasmURL });
      } catch (error) {
        URL.revokeObjectURL(coreURL);
        URL.revokeObjectURL(wasmURL);
        throw error;
      }
      if (generation !== this.generation) {
        ffmpeg.terminate();
        URL.revokeObjectURL(coreURL);
        URL.revokeObjectURL(wasmURL);
        throw new VideoConversionCanceledError();
      }
      this.ffmpeg = ffmpeg;
      this.fetchFile = fetchFile;
      this.coreBlobUrls = [coreURL, wasmURL];
      onProgress?.(12, '本地视频引擎已就绪');
      return ffmpeg;
    })();
    this.loadPromise = pending;

    try {
      return await pending;
    } catch (error) {
      if (this.loadPromise === pending) this.loadPromise = null;
      if (generation !== this.generation || isVideoConversionCanceled(error)) {
        throw new VideoConversionCanceledError();
      }
      throw new Error('本地视频引擎加载失败，请刷新页面后重试。');
    }
  }

  cancel(): void {
    this.generation += 1;
    this.ffmpeg?.terminate();
    this.ffmpeg = null;
    this.loadPromise = null;
    this.fetchFile = null;
    this.progressCallback = undefined;
    this.coreBlobUrls.forEach((url) => URL.revokeObjectURL(url));
    this.coreBlobUrls = [];
  }

  dispose(): void {
    this.cancel();
  }

  async convert(
    file: File,
    request: VideoConversionRequest,
    onProgress?: ConversionProgress,
  ): Promise<VideoConversionResult> {
    const fileValidation = validateVideoFile(file);
    if (!fileValidation.ok) throw new Error(fileValidation.message);
    const signature = new Uint8Array(await file.slice(0, 64).arrayBuffer());
    if (!looksLikeMp4(signature)) throw new Error('文件内容不是有效的 MP4 容器。');
    const requestValidation = getRequestValidation(request);
    if (!requestValidation.ok) throw new Error(requestValidation.message);

    const generation = this.generation;
    this.progressCallback = onProgress;
    const ffmpeg = await this.ensureLoaded(onProgress);
    if (generation !== this.generation) throw new VideoConversionCanceledError();
    if (!this.fetchFile) throw new Error('本地视频引擎尚未准备好。');

    const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const inputName = `video-input-${suffix}.mp4`;
    const paletteName = `video-palette-${suffix}.png`;
    const output = getRequestOutput(request);
    const outputName = `video-output-${suffix}.${output.extension}`;
    const commands = buildCommands(inputName, paletteName, outputName, request);
    this.progressSteps = commands.length;

    try {
      onProgress?.(14, '正在读取 MP4 文件');
      await ffmpeg.writeFile(inputName, await this.fetchFile(file));
      for (let index = 0; index < commands.length; index += 1) {
        this.progressStep = index;
        const exitCode = await ffmpeg.exec(commands[index]!);
        if (exitCode !== 0) throw new Error('FFmpeg 未能生成视频结果。');
        if (generation !== this.generation) throw new VideoConversionCanceledError();
      }
      onProgress?.(97, '正在生成可下载结果');
      const data = await ffmpeg.readFile(outputName);
      if (typeof data === 'string') throw new Error('视频结果格式无效。');
      const blob = new Blob([Uint8Array.from(data)], { type: output.mimeType });
      onProgress?.(100, '处理完成');
      return {
        blob,
        mimeType: output.mimeType,
        name: buildVideoOutputName(file.name, request.tool, output.nameFormat),
      };
    } catch (error) {
      if (generation !== this.generation || isVideoConversionCanceled(error)) {
        throw new VideoConversionCanceledError();
      }
      throw new Error('视频处理失败，请确认文件完整并尝试降低输出规格。');
    } finally {
      if (generation === this.generation) this.progressCallback = undefined;
      await Promise.allSettled([
        ffmpeg.deleteFile(inputName),
        ffmpeg.deleteFile(paletteName),
        ffmpeg.deleteFile(outputName),
      ]);
    }
  }
}
