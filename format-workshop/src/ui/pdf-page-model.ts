import type { PdfPageInstruction, PdfPageRotation } from '../pdf/pdf-toolbox';

export interface PdfPageItem extends PdfPageInstruction {
  id: string;
}

export function createPdfPageItems(pageCount: number): PdfPageItem[] {
  if (!Number.isInteger(pageCount) || pageCount < 1) {
    throw new Error('PDF 没有可管理的页面。');
  }
  return Array.from({ length: pageCount }, (_, index) => ({
    id: `source-page-${index + 1}`,
    sourcePage: index + 1,
    rotation: 0,
  }));
}

export function movePdfPageItem(
  items: readonly PdfPageItem[],
  id: string,
  targetIndex: number,
): PdfPageItem[] {
  const sourceIndex = items.findIndex((item) => item.id === id);
  if (sourceIndex < 0) return [...items];
  const next = [...items];
  const [item] = next.splice(sourceIndex, 1);
  if (!item) return [...items];
  const boundedIndex = Math.min(next.length, Math.max(0, targetIndex));
  next.splice(boundedIndex, 0, item);
  return next;
}

export function duplicatePdfPageItem(
  items: readonly PdfPageItem[],
  item: PdfPageItem,
  duplicateId: string,
): PdfPageItem[] {
  const index = items.findIndex(({ id }) => id === item.id);
  if (index < 0) return [...items];
  const next = [...items];
  next.splice(index + 1, 0, { ...item, id: duplicateId });
  return next;
}

export function rotatePdfPageItem(
  items: readonly PdfPageItem[],
  id: string,
): PdfPageItem[] {
  return items.map((item) => item.id === id
    ? {
        ...item,
        rotation: ((item.rotation + 90) % 360) as PdfPageRotation,
      }
    : item);
}

export function removePdfPageItem(
  items: readonly PdfPageItem[],
  id: string,
): PdfPageItem[] {
  if (items.length <= 1 && items.some((item) => item.id === id)) {
    throw new Error('请至少保留 1 页 PDF。');
  }
  return items.filter((item) => item.id !== id);
}
