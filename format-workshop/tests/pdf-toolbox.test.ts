import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';

import {
  createPdfFromRasterPages,
  createPdfFromImages,
  mergePdfFiles,
  parsePageSelection,
  rebuildPdfPages,
  splitPdfFile,
  validatePdfFiles,
} from '../src/pdf/pdf-toolbox';

const ONE_PIXEL_PNG = Uint8Array.from(
  atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='),
  (character) => character.charCodeAt(0),
);

async function makePdf(pageWidths: number[]): Promise<Uint8Array> {
  const document = await PDFDocument.create();
  pageWidths.forEach((width) => document.addPage([width, 200]));
  return document.save();
}

describe('validatePdfFiles', () => {
  it('accepts image batches for images to PDF', () => {
    expect(validatePdfFiles('images-to-pdf', [
      { name: 'one.jpg', type: 'image/jpeg', size: 2_000 },
      { name: 'two.webp', type: 'image/webp', size: 2_000 },
    ])).toEqual({ ok: true });
  });

  it('rejects wrong types and unsafe batch sizes', () => {
    expect(validatePdfFiles('merge-pdf', [
      { name: 'photo.png', type: 'image/png', size: 2_000 },
    ])).toEqual({ ok: false, message: expect.stringContaining('PDF') });

    expect(validatePdfFiles('images-to-pdf', Array.from({ length: 21 }, (_, index) => ({
      name: `${index}.png`,
      type: 'image/png',
      size: 1,
    })))).toEqual({ ok: false, message: expect.stringContaining('20') });
  });

  it('requires one PDF for rendering and at least two for merging', () => {
    const pdf = { name: 'file.pdf', type: 'application/pdf', size: 2_000 };
    expect(validatePdfFiles('pdf-to-images', [pdf, pdf]).ok).toBe(false);
    expect(validatePdfFiles('merge-pdf', [pdf]).ok).toBe(false);
    expect(validatePdfFiles('merge-pdf', [pdf, pdf])).toEqual({ ok: true });
  });

  it('requires exactly one PDF for page management', () => {
    const pdf = { name: 'file.pdf', type: 'application/pdf', size: 2_000 };
    expect(validatePdfFiles('manage-pdf', [pdf])).toEqual({ ok: true });
    expect(validatePdfFiles('manage-pdf', [pdf, pdf]).ok).toBe(false);
  });
});

describe('parsePageSelection', () => {
  it('parses, sorts, and deduplicates ranges', () => {
    expect(parsePageSelection('5, 1-3, 3, 8-9', 10)).toEqual([1, 2, 3, 5, 8, 9]);
  });

  it('rejects reversed and out-of-range selections', () => {
    expect(() => parsePageSelection('4-2', 5)).toThrow(/页码/);
    expect(() => parsePageSelection('1,6', 5)).toThrow(/1-5/);
    expect(() => parsePageSelection('', 5)).toThrow(/页码/);
  });
});

describe('PDF operations', () => {
  it('creates one PDF page per image', async () => {
    const bytes = await createPdfFromImages([
      { bytes: ONE_PIXEL_PNG, mimeType: 'image/png' },
      { bytes: ONE_PIXEL_PNG, mimeType: 'image/png' },
    ]);
    const output = await PDFDocument.load(bytes);

    expect(output.getPageCount()).toBe(2);
  });

  it('uses a generic error for invalid image bytes', async () => {
    await expect(createPdfFromImages([
      { bytes: new Uint8Array([1, 2, 3]), mimeType: 'image/png' },
    ])).rejects.toThrow('无法读取第 1 张图片');
  });

  it('merges every page in source order', async () => {
    const bytes = await mergePdfFiles([
      await makePdf([101, 102]),
      await makePdf([201]),
    ]);
    const output = await PDFDocument.load(bytes);

    expect(output.getPages().map((page) => page.getWidth())).toEqual([101, 102, 201]);
  });

  it('extracts selected pages into one PDF or one PDF per page', async () => {
    const source = await makePdf([101, 102, 103]);
    const combined = await splitPdfFile(source, [1, 3], 'combined');
    const individual = await splitPdfFile(source, [1, 3], 'individual');

    expect(combined).toHaveLength(1);
    expect((await PDFDocument.load(combined[0]!)).getPages().map((page) => page.getWidth()))
      .toEqual([101, 103]);
    expect(individual).toHaveLength(2);
    expect((await PDFDocument.load(individual[1]!)).getPage(0).getWidth()).toBe(103);
  });

  it('reorders, rotates, and duplicates pages in one rebuilt PDF', async () => {
    const source = await makePdf([101, 202]);
    const bytes = await rebuildPdfPages(source, [
      { sourcePage: 2, rotation: 90 },
      { sourcePage: 1, rotation: 180 },
      { sourcePage: 2, rotation: 270 },
    ]);
    const output = await PDFDocument.load(bytes);

    expect(output.getPages().map((page) => page.getWidth())).toEqual([202, 101, 202]);
    expect(output.getPages().map((page) => page.getRotation().angle)).toEqual([90, 180, 270]);
  });

  it('rebuilds rasterized pages at their original PDF dimensions', async () => {
    const bytes = await createPdfFromRasterPages([
      {
        bytes: ONE_PIXEL_PNG,
        mimeType: 'image/png',
        pageWidth: 320,
        pageHeight: 480,
      },
      {
        bytes: ONE_PIXEL_PNG,
        mimeType: 'image/png',
        pageWidth: 640,
        pageHeight: 360,
      },
    ]);
    const output = await PDFDocument.load(bytes);

    expect(output.getPages().map((page) => [page.getWidth(), page.getHeight()]))
      .toEqual([[320, 480], [640, 360]]);
  });

  it('rejects an empty page edit sequence', async () => {
    await expect(rebuildPdfPages(await makePdf([101]), []))
      .rejects.toThrow('至少保留 1 页');
  });
});
