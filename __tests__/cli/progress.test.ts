/**
 * Copyright (c) 2026 Robert Lindley
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * @fileoverview Tests for CLI progress indicator.
 */

import { createProgressIndicator } from '../../src/cli/progress';

describe('createProgressIndicator', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should return a no-op indicator when disabled', () => {
    const writes: string[] = [];
    const stream = {
      isTTY: true,
      write: (chunk: string) => {
        writes.push(chunk);
        return true;
      },
    } as NodeJS.WriteStream;

    const progress = createProgressIndicator({ enabled: false, stream });
    progress.start('Working');
    progress.update('Still working');
    progress.stop('Done');

    expect(writes).toHaveLength(0);
  });

  it('should render spinner frames and final status', () => {
    const writes: string[] = [];
    const stream = {
      isTTY: true,
      write: (chunk: string) => {
        writes.push(chunk);
        return true;
      },
    } as NodeJS.WriteStream;

    const progress = createProgressIndicator({ enabled: true, stream });

    progress.update('Queued');
    progress.start('Working');
    progress.start('Ignored');
    expect(writes.join('')).toContain('Working');

    jest.advanceTimersByTime(100);
    progress.update('Almost done');
    jest.advanceTimersByTime(100);

    progress.stop('Complete');

    const output = writes.join('');
    expect(output).toContain('Almost done');
    expect(output).toContain('ok Complete');
  });

  it('should render error status when stop is called with error', () => {
    const writes: string[] = [];
    const stream = {
      isTTY: true,
      write: (chunk: string) => {
        writes.push(chunk);
        return true;
      },
    } as NodeJS.WriteStream;

    const progress = createProgressIndicator({ enabled: true, stream, intervalMs: 25 });

    progress.start('Starting');
    jest.advanceTimersByTime(25);
    progress.stop('Failed', 'error');

    expect(writes.join('')).toContain('x Failed');
  });

  it('should allow stop before start', () => {
    const writes: string[] = [];
    const stream = {
      isTTY: true,
      write: (chunk: string) => {
        writes.push(chunk);
        return true;
      },
    } as NodeJS.WriteStream;

    const progress = createProgressIndicator({ enabled: true, stream });

    expect(() => progress.stop('Done')).not.toThrow();
    expect(writes.join('')).toContain('ok Done');
  });

  it('should default to stdout when no stream is provided', () => {
    const progress = createProgressIndicator({ enabled: false });
    progress.start('Muted');
    progress.update('Still muted');
    progress.stop('Done');

    expect(typeof progress.start).toBe('function');
  });

  it('should handle default options without throwing', () => {
    const progress = createProgressIndicator();
    progress.start('Default');
    progress.stop('Done');

    expect(typeof progress.update).toBe('function');
  });

  it('should infer enabled state from the stream when not provided', () => {
    const writes: string[] = [];
    const stream = {
      isTTY: true,
      write: (chunk: string) => {
        writes.push(chunk);
        return true;
      },
    } as NodeJS.WriteStream;

    const progress = createProgressIndicator({ stream });
    progress.start('Working');
    jest.advanceTimersByTime(100);
    progress.stop('Done');

    expect(writes.join('')).toContain('Working');
  });
});
