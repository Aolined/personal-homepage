import { describe, expect, it } from 'vitest';

import {
  createPdfPageItems,
  duplicatePdfPageItem,
  movePdfPageItem,
  removePdfPageItem,
  rotatePdfPageItem,
} from '../src/ui/pdf-page-model';

describe('PDF page editor model', () => {
  it('creates one item for every source page', () => {
    expect(createPdfPageItems(3).map(({ sourcePage, rotation }) => ({
      sourcePage,
      rotation,
    }))).toEqual([
      { sourcePage: 1, rotation: 0 },
      { sourcePage: 2, rotation: 0 },
      { sourcePage: 3, rotation: 0 },
    ]);
  });

  it('moves a page to a new position without mutating the source list', () => {
    const source = createPdfPageItems(3);
    const moved = movePdfPageItem(source, source[2]!.id, 0);

    expect(moved.map((item) => item.sourcePage)).toEqual([3, 1, 2]);
    expect(source.map((item) => item.sourcePage)).toEqual([1, 2, 3]);
  });

  it('duplicates immediately after the selected page', () => {
    const source = createPdfPageItems(2);
    const duplicated = duplicatePdfPageItem(source, source[0]!, 'duplicate-1');

    expect(duplicated.map((item) => item.sourcePage)).toEqual([1, 1, 2]);
    expect(duplicated[1]?.id).toBe('duplicate-1');
  });

  it('rotates clockwise and wraps after 270 degrees', () => {
    const source = createPdfPageItems(1);
    const once = rotatePdfPageItem(source, source[0]!.id);
    const wrapped = rotatePdfPageItem([
      { ...once[0]!, rotation: 270 },
    ], source[0]!.id);

    expect(once[0]?.rotation).toBe(90);
    expect(wrapped[0]?.rotation).toBe(0);
  });

  it('never allows deletion of the final remaining page', () => {
    const source = createPdfPageItems(2);
    const remaining = removePdfPageItem(source, source[0]!.id);

    expect(remaining).toHaveLength(1);
    expect(() => removePdfPageItem(remaining, remaining[0]!.id))
      .toThrow('至少保留 1 页');
  });
});
