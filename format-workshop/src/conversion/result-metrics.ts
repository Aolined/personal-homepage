export interface SizeChange {
  direction: 'smaller' | 'larger' | 'same';
  percent: number;
}

export function calculateSizeChange(
  sourceSize: number,
  outputSize: number,
): SizeChange {
  if (sourceSize <= 0 || sourceSize === outputSize) {
    return { direction: 'same', percent: 0 };
  }

  return {
    direction: outputSize < sourceSize ? 'smaller' : 'larger',
    percent: Math.round((Math.abs(outputSize - sourceSize) / sourceSize) * 100),
  };
}
