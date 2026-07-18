import { describe, expect, it } from 'vitest';

import { calculateBatchProgress, isBusy } from '../src/ui/types';
import { workbenchTemplate } from '../src/ui/template';

describe('folder batch entry points', () => {
  it('renders a folder input and actions for image batches', () => {
    expect(workbenchTemplate).toContain('data-folder-input');
    expect(workbenchTemplate).toContain('data-select-folder');
    expect(workbenchTemplate).toContain('data-add-folder');
  });
});

describe('isBusy', () => {
  it('locks replacement interactions only while converting', () => {
    expect(isBusy('converting')).toBe(true);
    expect(isBusy('ready')).toBe(false);
    expect(isBusy('error')).toBe(false);
    expect(isBusy('success')).toBe(false);
  });
});

describe('calculateBatchProgress', () => {
  it('maps the active file progress onto the whole batch', () => {
    expect(calculateBatchProgress(0, 4, 0)).toBe(0);
    expect(calculateBatchProgress(1, 4, 50)).toBe(38);
    expect(calculateBatchProgress(3, 4, 100)).toBe(100);
  });

  it('returns zero for an empty batch', () => {
    expect(calculateBatchProgress(0, 0, 80)).toBe(0);
  });
});
