import { describe, expect, it } from 'vitest';
import * as ui from '../src/index';

describe('@credit-runner/ui', () => {
  it('loads its entry point', () => {
    expect(ui).toBeTypeOf('object');
  });
});
