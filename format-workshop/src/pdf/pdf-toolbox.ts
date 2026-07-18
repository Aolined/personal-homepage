import {
  PDFDocument,
  StandardFonts,
  degrees,
  rgb,
  type PDFImage,
} from 'pdf-lib';

export type PdfTool =
  | 'images-to-pdf'
  | 'pdf-to-images'
  | 'merge-pdf'
  | 'split-pdf';
export type PdfValidationTool = PdfTool | 'manage-pdf';
export type PdfSplitMode = 'combined' | 'individual';
export type PdfPageRotation = 0 | 90 | 180 | 270;

export interface PdfFileDescriptor {
  name: string;
  type: string;
  size: number;
}

export interface PdfValidationResult {
  ok: boolean;
  message?: string;
}

export interface PdfImageInput {
  bytes: Uint8Array;
  mimeType: 'image/jpeg' | 'image/png';
}

export interface ImagesToPdfOptions {
  pageSize?: 'image' | 'a4';
  margin?: number;
}

export interface PdfPageInstruction {
  sourcePage: number;
  rotation: PdfPageRotation;
}

export interface PdfWatermarkImage {
  bytes: Uint8Array;
  opacity?: number;
}

export interface PdfDecorationOptions {
  pageNumbers?: boolean;
  watermark?: PdfWatermarkImage;
}

export interface PdfRasterPageInput extends PdfImageInput {
  pageWidth: number;
  pageHeight: number;
}

const MB = 1024 * 1024;
export const PDF_FILE_LIMIT = 100 * MB;
export const PDF_BATCH_LIMIT = 200 * MB;
export const PDF_IMAGE_BATCH_LIMIT = 100 * MB;
export const PDF_IMAGE_COUNT_LIMIT = 20;
export const PDF_MERGE_COUNT_LIMIT = 10;
export const PDF_PAGE_LIMIT = 500;

const PDF_MIME = 'application/pdf';
const IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const A4_PORTRAIT: [number, number] = [595.28, 841.89];

function invalid(message: string): PdfValidationResult {
  return { ok: false, message };
}

export function validatePdfFiles(
  tool: PdfValidationTool,
  files: readonly PdfFileDescriptor[],
): PdfValidationResult {
  if (files.length === 0) return invalid('请选择需要处理的文件。');
  if (files.some((file) => file.size <= 0)) return invalid('文件为空，无法处理。');

  if (tool === 'images-to-pdf') {
    if (files.length > PDF_IMAGE_COUNT_LIMIT) {
      return invalid(`一次最多选择 ${PDF_IMAGE_COUNT_LIMIT} 张图片。`);
    }
    if (files.some((file) => !IMAGE_MIMES.has(file.type.toLowerCase()))) {
      return invalid('图片转 PDF 仅支持 JPG、PNG 和 WebP。');
    }
    if (files.some((file) => file.size > 25 * MB)) {
      return invalid('单张图片不能超过 25 MB。');
    }
    if (files.reduce((sum, file) => sum + file.size, 0) > PDF_IMAGE_BATCH_LIMIT) {
      return invalid('一批图片总大小不能超过 100 MB。');
    }
    return { ok: true };
  }

  if (files.some((file) => file.type.toLowerCase() !== PDF_MIME)) {
    return invalid('此工具仅支持 PDF 文件。');
  }
  if (files.some((file) => file.size > PDF_FILE_LIMIT)) {
    return invalid('单个 PDF 不能超过 100 MB。');
  }

  if (tool === 'merge-pdf') {
    if (files.length < 2) return invalid('合并 PDF 至少需要选择 2 个文件。');
    if (files.length > PDF_MERGE_COUNT_LIMIT) {
      return invalid(`一次最多合并 ${PDF_MERGE_COUNT_LIMIT} 个 PDF。`);
    }
    if (files.reduce((sum, file) => sum + file.size, 0) > PDF_BATCH_LIMIT) {
      return invalid('待合并 PDF 总大小不能超过 200 MB。');
    }
    return { ok: true };
  }

  if (files.length !== 1) return invalid('此工具每次只能选择 1 个 PDF。');
  return { ok: true };
}

export function parsePageSelection(value: string, pageCount: number): number[] {
  const source = value.trim();
  if (!source || pageCount < 1) throw new Error('请输入需要处理的页码。');

  const selected = new Set<number>();
  for (const token of source.split(',').map((part) => part.trim())) {
    const match = /^(\d+)(?:\s*-\s*(\d+))?$/.exec(token);
    if (!match) throw new Error('页码格式有误，请使用例如 1-3,5 的格式。');
    const start = Number(match[1]);
    const end = Number(match[2] ?? match[1]);
    if (start < 1 || end < start) throw new Error('页码区间有误，请检查起止页。');
    if (end > pageCount) throw new Error(`页码必须在 1-${pageCount} 之间。`);
    for (let page = start; page <= end; page += 1) selected.add(page);
  }

  if (selected.size === 0) throw new Error('请输入需要处理的页码。');
  return [...selected].sort((a, b) => a - b);
}

function resetMetadata(document: PDFDocument): void {
  document.setTitle('Converted document');
  document.setAuthor('');
  document.setSubject('');
  document.setKeywords([]);
  document.setProducer('Format Workshop');
  document.setCreator('Format Workshop');
}

async function decoratePdfPages(
  document: PDFDocument,
  options: PdfDecorationOptions,
): Promise<void> {
  const pages = document.getPages();
  const font = options.pageNumbers
    ? await document.embedFont(StandardFonts.Helvetica)
    : null;
  const watermark = options.watermark
    ? await document.embedPng(options.watermark.bytes)
    : null;

  pages.forEach((page, index) => {
    const { width, height } = page.getSize();
    if (watermark) {
      let drawWidth = width * 0.58;
      let drawHeight = drawWidth * (watermark.height / watermark.width);
      const maxHeight = height * 0.18;
      if (drawHeight > maxHeight) {
        drawHeight = maxHeight;
        drawWidth = drawHeight * (watermark.width / watermark.height);
      }
      page.drawImage(watermark, {
        x: (width - drawWidth) / 2,
        y: (height - drawHeight) / 2,
        width: drawWidth,
        height: drawHeight,
        opacity: Math.min(0.6, Math.max(0.06, options.watermark?.opacity ?? 0.18)),
        rotate: degrees(-28),
      });
    }
    if (font) {
      const label = `${index + 1} / ${pages.length}`;
      const size = 9;
      const textWidth = font.widthOfTextAtSize(label, size);
      page.drawText(label, {
        x: Math.max(12, (width - textWidth) / 2),
        y: 12,
        size,
        font,
        color: rgb(0.28, 0.34, 0.36),
        opacity: 0.82,
      });
    }
  });
}

async function loadPdf(bytes: Uint8Array): Promise<PDFDocument> {
  try {
    const document = await PDFDocument.load(bytes, { updateMetadata: false });
    if (document.getPageCount() < 1) throw new Error('PDF 没有可处理的页面。');
    if (document.getPageCount() > PDF_PAGE_LIMIT) {
      throw new Error(`PDF 页数不能超过 ${PDF_PAGE_LIMIT} 页。`);
    }
    return document;
  } catch (error) {
    if (error instanceof Error && error.message.includes('页数不能超过')) throw error;
    throw new Error('无法读取 PDF。请确认文件完整且未设置密码。');
  }
}

function fitImage(
  image: PDFImage,
  pageSize: 'image' | 'a4',
  margin: number,
): { pageWidth: number; pageHeight: number; width: number; height: number; x: number; y: number } {
  if (pageSize === 'image') {
    return {
      pageWidth: image.width,
      pageHeight: image.height,
      width: image.width,
      height: image.height,
      x: 0,
      y: 0,
    };
  }

  const portrait = image.height >= image.width;
  const [pageWidth, pageHeight] = portrait
    ? A4_PORTRAIT
    : [A4_PORTRAIT[1], A4_PORTRAIT[0]];
  const availableWidth = Math.max(1, pageWidth - margin * 2);
  const availableHeight = Math.max(1, pageHeight - margin * 2);
  const scale = Math.min(availableWidth / image.width, availableHeight / image.height);
  const width = image.width * scale;
  const height = image.height * scale;
  return {
    pageWidth,
    pageHeight,
    width,
    height,
    x: (pageWidth - width) / 2,
    y: (pageHeight - height) / 2,
  };
}

export async function createPdfFromImages(
  images: readonly PdfImageInput[],
  options: ImagesToPdfOptions = {},
): Promise<Uint8Array> {
  if (images.length === 0 || images.length > PDF_IMAGE_COUNT_LIMIT) {
    throw new Error(`PDF 需要包含 1-${PDF_IMAGE_COUNT_LIMIT} 张图片。`);
  }

  const document = await PDFDocument.create();
  resetMetadata(document);
  const pageSize = options.pageSize ?? 'image';
  const margin = Math.min(96, Math.max(0, options.margin ?? 24));

  for (const [index, input] of images.entries()) {
    let image: PDFImage;
    try {
      image = input.mimeType === 'image/jpeg'
        ? await document.embedJpg(input.bytes)
        : await document.embedPng(input.bytes);
    } catch {
      throw new Error(`无法读取第 ${index + 1} 张图片，请确认文件完整。`);
    }
    if (image.width * image.height > 40_000_000) {
      throw new Error(`第 ${index + 1} 张图片超过 4000 万像素。`);
    }
    const placement = fitImage(image, pageSize, pageSize === 'image' ? 0 : margin);
    const page = document.addPage([placement.pageWidth, placement.pageHeight]);
    page.drawImage(image, placement);
  }

  return document.save({ useObjectStreams: true });
}

export async function mergePdfFiles(files: readonly Uint8Array[]): Promise<Uint8Array> {
  if (files.length < 2 || files.length > PDF_MERGE_COUNT_LIMIT) {
    throw new Error(`请选择 2-${PDF_MERGE_COUNT_LIMIT} 个 PDF。`);
  }

  const output = await PDFDocument.create();
  resetMetadata(output);
  let totalPages = 0;
  for (const bytes of files) {
    const source = await loadPdf(bytes);
    totalPages += source.getPageCount();
    if (totalPages > PDF_PAGE_LIMIT) {
      throw new Error(`合并后的 PDF 不能超过 ${PDF_PAGE_LIMIT} 页。`);
    }
    const pages = await output.copyPages(source, source.getPageIndices());
    pages.forEach((page) => output.addPage(page));
  }
  return output.save({ useObjectStreams: true });
}

export async function rebuildPdfPages(
  bytes: Uint8Array,
  instructions: readonly PdfPageInstruction[],
  decorations: PdfDecorationOptions = {},
): Promise<Uint8Array> {
  if (instructions.length === 0) throw new Error('请至少保留 1 页 PDF。');
  if (instructions.length > PDF_PAGE_LIMIT) {
    throw new Error(`处理后的 PDF 不能超过 ${PDF_PAGE_LIMIT} 页。`);
  }

  const source = await loadPdf(bytes);
  if (instructions.some(({ sourcePage, rotation }) => (
    !Number.isInteger(sourcePage)
    || sourcePage < 1
    || sourcePage > source.getPageCount()
    || ![0, 90, 180, 270].includes(rotation)
  ))) {
    throw new Error('页面顺序或旋转角度无效。');
  }

  const output = await PDFDocument.create();
  resetMetadata(output);
  const copiedPages = await output.copyPages(
    source,
    instructions.map(({ sourcePage }) => sourcePage - 1),
  );
  for (const [index, instruction] of instructions.entries()) {
    const page = copiedPages[index];
    if (!page) throw new Error('无法复制 PDF 页面。');
    const rotation = (page.getRotation().angle + instruction.rotation) % 360;
    page.setRotation(degrees(rotation));
    output.addPage(page);
  }
  await decoratePdfPages(output, decorations);
  return output.save({ useObjectStreams: true });
}

export async function createPdfFromRasterPages(
  pages: readonly PdfRasterPageInput[],
  decorations: PdfDecorationOptions = {},
): Promise<Uint8Array> {
  if (pages.length === 0) throw new Error('请至少保留 1 页 PDF。');
  if (pages.length > PDF_PAGE_LIMIT) {
    throw new Error(`处理后的 PDF 不能超过 ${PDF_PAGE_LIMIT} 页。`);
  }

  const document = await PDFDocument.create();
  resetMetadata(document);
  for (const [index, input] of pages.entries()) {
    if (
      !Number.isFinite(input.pageWidth)
      || !Number.isFinite(input.pageHeight)
      || input.pageWidth <= 0
      || input.pageHeight <= 0
      || input.pageWidth > 20_000
      || input.pageHeight > 20_000
    ) {
      throw new Error(`第 ${index + 1} 页尺寸无效。`);
    }
    let image: PDFImage;
    try {
      image = input.mimeType === 'image/jpeg'
        ? await document.embedJpg(input.bytes)
        : await document.embedPng(input.bytes);
    } catch {
      throw new Error(`无法读取第 ${index + 1} 页的压缩图像。`);
    }
    const page = document.addPage([input.pageWidth, input.pageHeight]);
    page.drawImage(image, {
      x: 0,
      y: 0,
      width: input.pageWidth,
      height: input.pageHeight,
    });
  }
  await decoratePdfPages(document, decorations);
  return document.save({ useObjectStreams: true });
}

export async function getPdfPageCount(bytes: Uint8Array): Promise<number> {
  return (await loadPdf(bytes)).getPageCount();
}

async function copySelectedPages(
  source: PDFDocument,
  pageNumbers: readonly number[],
): Promise<Uint8Array> {
  const output = await PDFDocument.create();
  resetMetadata(output);
  const pages = await output.copyPages(source, pageNumbers.map((page) => page - 1));
  pages.forEach((page) => output.addPage(page));
  return output.save({ useObjectStreams: true });
}

export async function splitPdfFile(
  bytes: Uint8Array,
  pageNumbers: readonly number[],
  mode: PdfSplitMode,
): Promise<Uint8Array[]> {
  const source = await loadPdf(bytes);
  const uniquePages = [...new Set(pageNumbers)].sort((a, b) => a - b);
  if (
    uniquePages.length === 0
    || uniquePages.some((page) => !Number.isInteger(page) || page < 1 || page > source.getPageCount())
  ) {
    throw new Error(`页码必须在 1-${source.getPageCount()} 之间。`);
  }

  if (mode === 'combined') return [await copySelectedPages(source, uniquePages)];
  const outputs: Uint8Array[] = [];
  for (const page of uniquePages) outputs.push(await copySelectedPages(source, [page]));
  return outputs;
}
