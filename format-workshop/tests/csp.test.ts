import { describe, expect, it } from 'vitest';

import { productionCsp } from '../vite.config';

describe('production Content Security Policy', () => {
  it('allows WebAssembly compilation without enabling general unsafe eval', () => {
    expect(productionCsp).toContain(
      "script-src 'self' blob: 'wasm-unsafe-eval'",
    );
    expect(productionCsp).not.toContain("'unsafe-eval'");
  });
});
