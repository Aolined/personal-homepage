import type { FFmpeg } from '@ffmpeg/ffmpeg';

import type { AudioFormat, MediaFormat } from './file-validation';
import type { ConversionProgress } from './image-converter';

export type AudioBitrate = 128 | 192 | 256 | 320;
export type AudioSampleRate = 'source' | 44_100 | 48_000;
export type AudioChannels = 'source' | 1 | 2;

export interface AudioConversionSettings {
  bitrate: AudioBitrate;
  sampleRate: AudioSampleRate;
  channels: AudioChannels;
  trimStart?: number;
  trimEnd?: number | null;
  volume?: number;
  normalize?: boolean;
  speed?: 0.5 | 0.75 | 1 | 1.25 | 1.5 | 2;
  fadeIn?: number;
  fadeOut?: number;
  sourceDuration?: number | null;
}

const AUDIO_SPEEDS = new Set([0.5, 0.75, 1, 1.25, 1.5, 2]);

function assertFiniteRange(
  value: number,
  minimum: number,
  maximum: number,
  label: string,
): void {
  if (!Number.isFinite(value) || value < minimum || value > maximum) {
    throw new Error(`${label}超出允许范围。`);
  }
}

function formatFfmpegNumber(value: number): string {
  return Number(value.toFixed(3)).toString();
}

function buildAudioFilters(settings: AudioConversionSettings): string[] {
  const volume = settings.volume ?? 100;
  const speed = settings.speed ?? 1;
  const fadeIn = settings.fadeIn ?? 0;
  const fadeOut = settings.fadeOut ?? 0;
  const trimStart = settings.trimStart ?? 0;
  const trimEnd = settings.trimEnd ?? null;
  const sourceDuration = settings.sourceDuration ?? null;

  assertFiniteRange(volume, 0, 200, '音量');
  assertFiniteRange(fadeIn, 0, 10, '淡入时长');
  assertFiniteRange(fadeOut, 0, 10, '淡出时长');
  if (!AUDIO_SPEEDS.has(speed)) throw new Error('播放速度不受支持。');

  const filters: string[] = [];
  if (trimStart > 0 || trimEnd !== null) {
    const trimParts = [`start=${formatFfmpegNumber(trimStart)}`];
    if (trimEnd !== null) trimParts.push(`end=${formatFfmpegNumber(trimEnd)}`);
    filters.push(`atrim=${trimParts.join(':')}`, 'asetpts=N/SR/TB');
  }
  if (settings.normalize) filters.push('loudnorm=I=-16:TP=-1.5:LRA=11');
  if (volume !== 100) filters.push(`volume=${formatFfmpegNumber(volume / 100)}`);
  if (speed !== 1) filters.push(`atempo=${formatFfmpegNumber(speed)}`);
  if (fadeIn > 0) filters.push(`afade=t=in:st=0:d=${formatFfmpegNumber(fadeIn)}`);

  const trimmedDuration = trimEnd !== null
    ? trimEnd - trimStart
    : sourceDuration !== null
      ? sourceDuration - trimStart
      : null;
  if (fadeOut > 0) {
    if (trimmedDuration === null) {
      throw new Error('淡出需要有效的音频时长。');
    }
    const outputDuration = trimmedDuration / speed;
    const fadeStart = Math.max(0, outputDuration - fadeOut);
    filters.push(
      `afade=t=out:st=${formatFfmpegNumber(fadeStart)}:d=${formatFfmpegNumber(Math.min(fadeOut, outputDuration))}`,
    );
  }
  return filters;
}

const AUDIO_OUTPUTS: Record<AudioFormat, {
  codec: string;
  mimeType: string;
  usesBitrate: boolean;
}> = {
  mp3: { codec: 'libmp3lame', mimeType: 'audio/mpeg', usesBitrate: true },
  wav: { codec: 'pcm_s16le', mimeType: 'audio/wav', usesBitrate: false },
  m4a: { codec: 'aac', mimeType: 'audio/mp4', usesBitrate: true },
  aac: { codec: 'aac', mimeType: 'audio/aac', usesBitrate: true },
  flac: { codec: 'flac', mimeType: 'audio/flac', usesBitrate: false },
  ogg: { codec: 'libvorbis', mimeType: 'audio/ogg', usesBitrate: true },
};

export class ConversionCanceledError extends Error {
  constructor() {
    super('转换已取消。');
    this.name = 'ConversionCanceledError';
  }
}

export function isConversionCanceled(error: unknown): boolean {
  return error instanceof ConversionCanceledError;
}

export function getMediaInputExtension(format: MediaFormat): string {
  return format;
}

export function getAudioOutputMimeType(format: AudioFormat): string {
  return AUDIO_OUTPUTS[format].mimeType;
}

export function buildAudioCommand(
  input: string,
  output: string,
  target: AudioFormat,
  settings: AudioConversionSettings,
): string[] {
  const trimStart = settings.trimStart ?? 0;
  const trimEnd = settings.trimEnd ?? null;
  const sourceDuration = settings.sourceDuration ?? null;
  assertFiniteRange(trimStart, 0, 43_200, '裁剪开始时间');
  if (trimEnd !== null) {
    assertFiniteRange(trimEnd, 0.01, 43_200, '裁剪结束时间');
    if (trimEnd <= trimStart) throw new Error('裁剪结束时间必须晚于开始时间。');
  }
  if (sourceDuration !== null) {
    assertFiniteRange(sourceDuration, 0.01, 43_200, '音频时长');
    if (trimStart >= sourceDuration || (trimEnd !== null && trimEnd > sourceDuration + 0.05)) {
      throw new Error('裁剪时间不能超出音频时长。');
    }
  }

  const outputSettings = AUDIO_OUTPUTS[target];
  const command: string[] = [];
  command.push(
    '-i', input,
    '-map',
    '0:a:0',
    '-vn',
    '-map_metadata',
    '-1',
    '-codec:a',
    outputSettings.codec,
  );
  const filters = buildAudioFilters(settings);
  if (filters.length > 0) command.push('-af', filters.join(','));
  if (outputSettings.usesBitrate) {
    const bitrate = target === 'ogg'
      && settings.channels !== 2
      && settings.bitrate > 192
      ? 192
      : settings.bitrate;
    command.push('-b:a', `${bitrate}k`);
  }
  const sampleRate = target === 'ogg' && settings.sampleRate === 'source'
    ? 48_000
    : settings.sampleRate;
  if (sampleRate !== 'source') {
    command.push('-ar', String(sampleRate));
  }
  if (settings.channels !== 'source') {
    command.push('-ac', String(settings.channels));
  }
  command.push(output);
  return command;
}

export function normalizeProgress(progress: number): number {
  return Math.min(100, Math.max(0, Math.round(progress * 100)));
}

export function getFfmpegAssetPaths(base: string): { core: string; wasm: string } {
  return {
    core: `${base}ffmpeg/ffmpeg-core.js`,
    wasm: `${base}ffmpeg/ffmpeg-core.wasm`,
  };
}

export class MediaToAudioConverter {
  private ffmpeg: FFmpeg | null = null;
  private loadPromise: Promise<FFmpeg> | null = null;
  private progressCallback: ConversionProgress | undefined;
  private coreBlobUrls: string[] = [];
  private fetchFile: ((file: File | Blob) => Promise<Uint8Array>) | null = null;
  private generation = 0;

  private async ensureLoaded(onProgress?: ConversionProgress): Promise<FFmpeg> {
    if (this.ffmpeg?.loaded) return this.ffmpeg;
    if (this.loadPromise) return this.loadPromise;

    const generation = this.generation;
    const loadPromise = (async () => {
      onProgress?.(3, '正在加载音视频转换组件');
      const [{ FFmpeg }, { fetchFile, toBlobURL }] = await Promise.all([
        import('@ffmpeg/ffmpeg'),
        import('@ffmpeg/util'),
      ]);

      const ffmpeg = new FFmpeg();
      ffmpeg.on('progress', ({ progress }) => {
        if (generation !== this.generation) return;
        const percent = 15 + Math.round(normalizeProgress(progress) * 0.8);
        this.progressCallback?.(percent, '正在转换音频');
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
        throw new ConversionCanceledError();
      }

      // Keep fetchFile in the lazy chunk with the FFmpeg runtime.
      this.fetchFile = fetchFile;
      this.ffmpeg = ffmpeg;
      this.coreBlobUrls = [coreURL, wasmURL];
      onProgress?.(12, '转换组件已就绪');
      return ffmpeg;
    })();
    this.loadPromise = loadPromise;

    try {
      return await loadPromise;
    } catch (error) {
      if (this.loadPromise === loadPromise) this.loadPromise = null;
      if (isConversionCanceled(error) || generation !== this.generation) {
        throw new ConversionCanceledError();
      }
      throw new Error('音视频转换组件加载失败，请刷新页面后重试。');
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
    sourceFormat: MediaFormat,
    target: AudioFormat,
    onProgress?: ConversionProgress,
    settings: AudioConversionSettings = {
      bitrate: 192,
      sampleRate: 'source',
      channels: 'source',
    },
  ): Promise<Blob> {
    const generation = this.generation;
    this.progressCallback = onProgress;
    const ffmpeg = await this.ensureLoaded(onProgress);
    if (generation !== this.generation) throw new ConversionCanceledError();
    const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const inputName = `input-${suffix}.${getMediaInputExtension(sourceFormat)}`;
    const outputName = `output-${suffix}.${target}`;

    try {
      onProgress?.(14, '正在读取音视频文件');
      if (!this.fetchFile) throw new Error('音视频转换组件尚未准备好。');
      await ffmpeg.writeFile(inputName, await this.fetchFile(file));

      const exitCode = await ffmpeg.exec(
        buildAudioCommand(inputName, outputName, target, settings),
      );
      if (exitCode !== 0) {
        throw new Error('未能提取音频，请确认文件包含可用音轨。');
      }

      onProgress?.(96, `正在生成 ${target.toUpperCase()}`);
      const data = await ffmpeg.readFile(outputName);
      if (typeof data === 'string') throw new Error('转换结果格式无效。');

      const bytes = Uint8Array.from(data);
      onProgress?.(100, '转换完成');
      return new Blob([bytes], { type: getAudioOutputMimeType(target) });
    } catch (error) {
      if (generation !== this.generation || isConversionCanceled(error)) {
        throw new ConversionCanceledError();
      }
      if (error instanceof Error && error.message.includes('可用音轨')) throw error;
      throw new Error('音频转换失败，请确认文件完整且包含可用音轨。');
    } finally {
      if (generation === this.generation) this.progressCallback = undefined;
      await Promise.allSettled([
        ffmpeg.deleteFile(inputName),
        ffmpeg.deleteFile(outputName),
      ]);
    }
  }
}
