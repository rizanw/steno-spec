// Comparing CLI versions part by part, as numbers.
import { describe, it, expect } from 'vitest';
import { atLeast } from '../../src/host/version.js';

describe('atLeast', () => {
  it('compares major, minor and patch as numbers, not text', () => {
    expect(atLeast('0.1.10', '0.1.9')).toBe(true);
    expect(atLeast('0.1.9', '0.1.10')).toBe(false);
    expect(atLeast('1.0.0', '0.9.9')).toBe(true);
    expect(atLeast('0.2.0', '0.10.0')).toBe(false);
  });

  it('counts the same version as recent enough', () => {
    expect(atLeast('0.1.3', '0.1.3')).toBe(true);
  });
});
