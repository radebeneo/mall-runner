import { describe, expect, it } from 'vitest';
import * as gameCore from '../src/index';

describe('@credit-runner/game-core', () => {
  it('loads its entry point', () => {
    expect(gameCore).toBeTypeOf('object');
  });
});
