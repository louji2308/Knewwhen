import { describe, expect, it } from 'vitest';

import { PRODUCT_NAME } from '../src/core/product-name.js';

describe('toolchain smoke (N-06)', () => {
  it('exposes one product name constant (R-9)', () => {
    expect(PRODUCT_NAME).toBe('KnewWhen');
  });
});
