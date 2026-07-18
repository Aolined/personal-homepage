import { describe, expect, it } from 'vitest';

import { resolvePdfPageRequests } from '../src/pdf/pdf-render-sequence';

describe('resolvePdfPageRequests', () => {
  it('uses every page in source order by default', () => {
    expect(resolvePdfPageRequests(3)).toEqual([
      { pageNumber: 1, rotation: 0 },
      { pageNumber: 2, rotation: 0 },
      { pageNumber: 3, rotation: 0 },
    ]);
  });

  it('sorts and deduplicates the simple page selection', () => {
    expect(resolvePdfPageRequests(4, [4, 2, 4])).toEqual([
      { pageNumber: 2, rotation: 0 },
      { pageNumber: 4, rotation: 0 },
    ]);
  });

  it('preserves an explicit edit sequence with duplicates and rotations', () => {
    expect(resolvePdfPageRequests(3, undefined, [
      { pageNumber: 2, rotation: 90 },
      { pageNumber: 1, rotation: 270 },
      { pageNumber: 2, rotation: 0 },
    ])).toEqual([
      { pageNumber: 2, rotation: 90 },
      { pageNumber: 1, rotation: 270 },
      { pageNumber: 2, rotation: 0 },
    ]);
  });

  it('rejects invalid pages and rotation angles', () => {
    expect(() => resolvePdfPageRequests(2, undefined, [
      { pageNumber: 3, rotation: 0 },
    ])).toThrow('页码必须在 1-2');
    expect(() => resolvePdfPageRequests(2, undefined, [
      { pageNumber: 1, rotation: 45 as 0 },
    ])).toThrow('旋转角度');
  });
});
