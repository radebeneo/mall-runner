import { describe, expect, it } from 'vitest';
import * as financeEngine from '../src/index';

describe('@credit-runner/finance-engine', () => {
  it('loads its entry point', () => {
    expect(financeEngine).toBeTypeOf('object');
  });
});
