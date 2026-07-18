import type { ImageFormat } from './file-validation';

interface ImageEncoding {
  mimeType: `image/${string}`;
  quality: number | undefined;
  background: 'transparent' | '#ffffff';
}

export interface ImageConversionOptions {
  quality?: number;
  maxWidth?: number;
  maxHeight?: number;
  rotation?: 0 | 90 | 180 | 270;
  flipHorizontal?: boolean;
  flipVertical?: boolean;
  watermarkText?: string;
  watermarkPosition?: ImageWatermarkPosition;
  watermarkOpacity?: number;
}

export type ImageWatermarkPosition =
  | 'top-left'
  | 'top-right'
  | 'center'
  | 'bottom-left'
  | 'bottom-right';

export type ConversionProgress = (progress: number, message: string) => void;

function normalizeQuality(quality: number): number {
  return Math.min(100, Math.max(40, quality)) / 100;
}

export function getImageEncoding(
  target: ImageFormat,
  quality?: number,
): ImageEncoding {
  if (target === 'jpeg') {
    return {
      mimeType: 'image/jpeg',
      quality: normalizeQuality(quality ?? 92),
      background: '#ffffff',
    };
  }

  if (target === 'webp') {
    return {
      mimeType: 'image/webp',
      quality: normalizeQuality(quality ?? 90),
      background: 'transparent',
    };
  }

  return {
    mimeType: 'image/png',
    quality: undefined,
    background: 'transparent',
  };
}

export function calculateImageSize(
  sourceWidth: number,
  sourceHeight: number,
  options: Pick<ImageConversionOptions, 'maxWidth' | 'maxHeight'>,
): { width: number; height: number } {
  const maxWidth = options.maxWidth && options.maxWidth > 0
    ? options.maxWidth
    : sourceWidth;
  const maxHeight = options.maxHeight && options.maxHeight > 0
    ? options.maxHeight
    : sourceHeight;
  const scale = Math.min(1, maxWidth / sourceWidth, maxHeight / sourceHeight);

  return {
    width: Math.max(1, Math.round(sourceWidth * scale)),
    height: Math.max(1, Math.round(sourceHeight * scale)),
  };
}

export function calculateTransformedImageSize(
  sourceWidth: number,
  sourceHeight: number,
  options: Pick<ImageConversionOptions, 'maxWidth' | 'maxHeight' | 'rotation'>,
): { width: number; height: number } {
  const isQuarterTurn = options.rotation === 90 || options.rotation === 270;
  return calculateImageSize(
    isQuarterTurn ? sourceHeight : sourceWidth,
    isQuarterTurn ? sourceWidth : sourceHeight,
    options,
  );
}

export function normalizeWatermarkText(value: string): string {
  return value
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 40);
}

function drawWatermark(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  options: ImageConversionOptions,
): void {
  const text = normalizeWatermarkText(options.watermarkText ?? '');
  if (!text) return;

  const position = options.watermarkPosition ?? 'bottom-right';
  const validPositions: ImageWatermarkPosition[] = [
    'top-left', 'top-right', 'center', 'bottom-left', 'bottom-right',
  ];
  if (!validPositions.includes(position)) throw new Error('水印位置无效。');
  const opacity = options.watermarkOpacity ?? 70;
  if (!Number.isFinite(opacity) || opacity < 10 || opacity > 100) {
    throw new Error('水印透明度超出允许范围。');
  }

  const padding = Math.max(12, Math.round(Math.min(width, height) * 0.035));
  const fontSize = Math.max(16, Math.min(56, Math.round(Math.min(width, height) * 0.055)));
  const maxTextWidth = Math.max(1, width - padding * 2);
  context.save();
  context.globalAlpha = opacity / 100;
  context.font = `700 ${fontSize}px "Microsoft YaHei", sans-serif`;
  context.textBaseline = 'top';
  context.fillStyle = '#ffffff';
  context.shadowColor = 'rgba(0, 0, 0, 0.65)';
  context.shadowBlur = Math.max(2, Math.round(fontSize * 0.16));
  context.shadowOffsetY = Math.max(1, Math.round(fontSize * 0.06));

  const measuredWidth = Math.min(context.measureText(text).width, maxTextWidth);
  let x = padding;
  let y = padding;
  if (position.includes('right')) x = width - padding - measuredWidth;
  if (position.includes('bottom')) y = height - padding - fontSize;
  if (position === 'center') {
    x = (width - measuredWidth) / 2;
    y = (height - fontSize) / 2;
  }
  context.fillText(text, x, y, maxTextWidth);
  context.restore();
}

export async function convertImage(
  file: File,
  target: ImageFormat,
  onProgress?: ConversionProgress,
  options: ImageConversionOptions = {},
): Promise<Blob> {
  onProgress?.(12, '正在读取图片');
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error('无法读取图片，请确认文件完整且格式正确。');
  }

  try {
    if (bitmap.width * bitmap.height > 40_000_000) {
      throw new Error('图片像素尺寸过大，请选择 4000 万像素以内的图片。');
    }

    const canvas = document.createElement('canvas');
    const outputSize = calculateTransformedImageSize(bitmap.width, bitmap.height, options);
    const isQuarterTurn = options.rotation === 90 || options.rotation === 270;
    const fittedSize = isQuarterTurn
      ? { width: outputSize.height, height: outputSize.width }
      : outputSize;
    canvas.width = outputSize.width;
    canvas.height = outputSize.height;

    const context = canvas.getContext('2d');
    if (!context) throw new Error('当前浏览器无法创建图片转换画布。');

    const encoding = getImageEncoding(target, options.quality);
    if (encoding.background !== 'transparent') {
      context.fillStyle = encoding.background;
      context.fillRect(0, 0, canvas.width, canvas.height);
    }

    onProgress?.(48, '正在渲染图片');
    const rotation = options.rotation ?? 0;
    if (![0, 90, 180, 270].includes(rotation)) throw new Error('图片旋转角度无效。');
    context.save();
    context.translate(canvas.width / 2, canvas.height / 2);
    context.rotate((rotation * Math.PI) / 180);
    context.scale(options.flipHorizontal ? -1 : 1, options.flipVertical ? -1 : 1);
    context.drawImage(
      bitmap,
      -fittedSize.width / 2,
      -fittedSize.height / 2,
      fittedSize.width,
      fittedSize.height,
    );
    context.restore();
    drawWatermark(context, canvas.width, canvas.height, options);

    onProgress?.(76, '正在生成文件');
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (result) => {
          if (result) resolve(result);
          else reject(new Error('图片编码失败，请尝试其他输出格式。'));
        },
        encoding.mimeType,
        encoding.quality,
      );
    });

    if (blob.type !== encoding.mimeType) {
      throw new Error(`当前浏览器暂不支持输出 ${target.toUpperCase()}。`);
    }

    onProgress?.(100, '转换完成');
    return blob;
  } finally {
    bitmap.close();
  }
}
