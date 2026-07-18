import type { PdfPageRotation } from './pdf-toolbox';

export interface PdfPageRenderRequest {
  pageNumber: number;
  rotation: PdfPageRotation;
}

function validateRequest(
  request: PdfPageRenderRequest,
  pageCount: number,
): PdfPageRenderRequest {
  if (
    !Number.isInteger(request.pageNumber)
    || request.pageNumber < 1
    || request.pageNumber > pageCount
  ) {
    throw new Error(`页码必须在 1-${pageCount} 之间。`);
  }
  if (![0, 90, 180, 270].includes(request.rotation)) {
    throw new Error('页面旋转角度必须是 0、90、180 或 270 度。');
  }
  return { ...request };
}

export function resolvePdfPageRequests(
  pageCount: number,
  pages?: readonly number[],
  pageRequests?: readonly PdfPageRenderRequest[],
): PdfPageRenderRequest[] {
  if (!Number.isInteger(pageCount) || pageCount < 1) {
    throw new Error('PDF 没有可处理的页面。');
  }

  if (pageRequests !== undefined) {
    if (pageRequests.length === 0) throw new Error('请至少保留 1 页 PDF。');
    return pageRequests.map((request) => validateRequest(request, pageCount));
  }

  const pageNumbers = pages?.length
    ? [...new Set(pages)].sort((a, b) => a - b)
    : Array.from({ length: pageCount }, (_, index) => index + 1);
  return pageNumbers.map((pageNumber) => validateRequest({
    pageNumber,
    rotation: 0,
  }, pageCount));
}
