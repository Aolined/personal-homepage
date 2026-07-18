import { strFromU8, unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';

import { createResultZip } from '../src/conversion/result-zip';
import { calculateSizeChange } from '../src/conversion/result-metrics';
import { selectHistoryToKeep } from '../src/history/conversion-history';

describe('calculateSizeChange', () => {
  it('reports a smaller output as a positive reduction', () => {
    expect(calculateSizeChange(1_000, 600)).toEqual({
      direction: 'smaller',
      percent: 40,
    });
  });

  it('reports a larger output without a misleading negative reduction', () => {
    expect(calculateSizeChange(1_000, 1_250)).toEqual({
      direction: 'larger',
      percent: 25,
    });
  });

  it('handles zero and unchanged source sizes', () => {
    expect(calculateSizeChange(0, 20)).toEqual({ direction: 'same', percent: 0 });
    expect(calculateSizeChange(500, 500)).toEqual({ direction: 'same', percent: 0 });
  });
});

describe('createResultZip', () => {
  it('creates a valid archive and deduplicates repeated output names', async () => {
    const archive = await createResultZip([
      { name: 'photo.webp', blob: new Blob(['first']) },
      { name: 'photo.webp', blob: new Blob(['second']) },
    ]);
    const files = unzipSync(new Uint8Array(await archive.arrayBuffer()));

    expect(archive.type).toBe('application/zip');
    expect(Object.keys(files)).toEqual(['photo.webp', 'photo (2).webp']);
    expect(strFromU8(files['photo.webp']!)).toBe('first');
    expect(strFromU8(files['photo (2).webp']!)).toBe('second');
  });

  it('keeps untrusted file names from creating archive paths', async () => {
    const archive = await createResultZip([
      { name: '../folder\\photo.webp', blob: new Blob(['safe']) },
    ]);
    const files = unzipSync(new Uint8Array(await archive.arrayBuffer()));

    expect(Object.keys(files)).toEqual(['_folder_photo.webp']);
  });
});

describe('selectHistoryToKeep', () => {
  it('keeps newest records within both count and byte limits', () => {
    const records = Array.from({ length: 12 }, (_, index) => ({
      id: `record-${index}`,
      createdAt: index,
      outputSize: 12 * 1024 * 1024,
    }));

    expect(selectHistoryToKeep(records, 10, 100 * 1024 * 1024).map((item) => item.id))
      .toEqual([
        'record-11',
        'record-10',
        'record-9',
        'record-8',
        'record-7',
        'record-6',
        'record-5',
        'record-4',
      ]);
  });
});
