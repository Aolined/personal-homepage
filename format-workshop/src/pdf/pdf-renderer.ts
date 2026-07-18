import {
  GlobalWorkerOptions,
  getDocument,
  type RenderTask,
} from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

import { PDF_PAGE_LIMIT } from './pdf-toolbox';
import {
  resolvePdfPageRequests,
  type PdfPageRenderRequest,
} from './pdf-render-sequence';

export type PdfImageFormat = 'jpeg' | 'png';

export interface RenderedPdfPage {
  pageNumber: number;
  blob: Blob;
  width: number;
  height: number;
  pageWidth: number;
  pageHeight: number;
}

export interface PdfRenderOptions {
  format: PdfImageFormat;
  scale: number;
  quality?: number;
  pages?: readonly number[];
  pageRequests?: readonly PdfPageRenderRequest[];
  signal?: AbortSignal;
  onProgress?: (progress: number, message: string) => void;
}

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

function throwIfCanceled(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException('PDF rendering canceled.', 'AbortError');
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  format: PdfImageFormat,
  quality: number,
): Promise<Blob> {
  const mimeType = format === 'jpeg' ? 'image/jpeg' : 'image/png';
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error('页面图片编码失败。')),
      mimeType,
      format === 'jpeg' ? quality : undefined,
    );
  });
}

export function isPdfRenderCanceled(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

export async function renderPdfPages(
  source: Blob | Uint8Array,
  options: PdfRenderOptions,
): Promise<RenderedPdfPage[]> {
  throwIfCanceled(options.signal);
  const bytes = source instanceof Uint8Array
    ? source.slice()
    : new Uint8Array(await source.arrayBuffer());
  const loadingTask = getDocument({
    data: bytes,
    useWorkerFetch: false,
  });
  let renderTask: RenderTask | null = null;
  const cancel = () => {
    renderTask?.cancel();
    void loadingTask.destroy();
  };
  options.signal?.addEventListener('abort', cancel, { once: true });

  try {
    options.onProgress?.(4, '正在读取 PDF');
    const document = await loadingTask.promise;
    if (document.numPages > PDF_PAGE_LIMIT) {
      throw new Error(`PDF 页数不能超过 ${PDF_PAGE_LIMIT} 页。`);
    }

    const pageRequests = resolvePdfPageRequests(
      document.numPages,
      options.pages,
      options.pageRequests,
    );

    const scale = Math.min(3, Math.max(0.2, options.scale));
    const quality = Math.min(1, Math.max(0.4, options.quality ?? 0.9));
    const results: RenderedPdfPage[] = [];
    for (const [index, request] of pageRequests.entries()) {
      const { pageNumber } = request;
      throwIfCanceled(options.signal);
      options.onProgress?.(
        Math.round(5 + (index / pageRequests.length) * 90),
        `正在渲染第 ${pageNumber} 页（${index + 1}/${pageRequests.length}）`,
      );
      const page = await document.getPage(pageNumber);
      const viewport = page.getViewport({
        scale,
        rotation: (page.rotate + request.rotation) % 360,
      });
      if (viewport.width * viewport.height > 40_000_000) {
        throw new Error(`第 ${pageNumber} 页像素尺寸过大，请降低清晰度。`);
      }

      const canvas = globalThis.document.createElement('canvas');
      canvas.width = Math.max(1, Math.ceil(viewport.width));
      canvas.height = Math.max(1, Math.ceil(viewport.height));
      const context = canvas.getContext('2d', { alpha: options.format !== 'jpeg' });
      if (!context) throw new Error('当前浏览器无法创建 PDF 渲染画布。');
      if (options.format === 'jpeg') {
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, canvas.width, canvas.height);
      }

      renderTask = page.render({ canvas, viewport });
      await renderTask.promise;
      renderTask = null;
      throwIfCanceled(options.signal);
      const blob = await canvasToBlob(canvas, options.format, quality);
      results.push({
        pageNumber,
        blob,
        width: canvas.width,
        height: canvas.height,
        pageWidth: viewport.width / scale,
        pageHeight: viewport.height / scale,
      });
      canvas.width = 1;
      canvas.height = 1;
      page.cleanup();
    }
    options.onProgress?.(100, '页面转换完成');
    return results;
  } catch (error) {
    if (options.signal?.aborted || isPdfRenderCanceled(error)) {
      throw new DOMException('PDF rendering canceled.', 'AbortError');
    }
    if (error instanceof Error && (
      error.message.includes('页数不能超过')
      || error.message.includes('像素尺寸过大')
      || error.message.includes('页码必须')
      || error.message.includes('旋转角度')
    )) {
      throw error;
    }
    throw new Error('无法读取 PDF。请确认文件完整且未设置密码。');
  } finally {
    options.signal?.removeEventListener('abort', cancel);
    await loadingTask.destroy();
  }
}

export async function renderPdfPreview(
  source: Blob | Uint8Array,
  signal?: AbortSignal,
): Promise<Blob> {
  const [preview] = await renderPdfPages(source, {
    format: 'png',
    scale: 1,
    pages: [1],
    signal,
  });
  if (!preview) throw new Error('PDF 没有可预览的页面。');
  return preview.blob;
}
