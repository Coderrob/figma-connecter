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
 * @fileoverview Tests for CLI global options helper.
 */

import { getGlobalOptions } from '../../src/cli/options';

describe('getGlobalOptions', () => {
  it('should prefer local option values when provided', () => {
    const command = {
      opts: () => ({
        verbose: false,
        quiet: true,
        dryRun: true,
        config: '/tmp/local.json',
      }),
      parent: {
        opts: () => ({
          verbose: true,
          quiet: false,
          dryRun: false,
          config: '/tmp/parent.json',
        }),
      },
    } as Parameters<typeof getGlobalOptions>[0];

    const options = getGlobalOptions(command);

    expect(options.verbose).toBe(false);
    expect(options.quiet).toBe(true);
    expect(options.dryRun).toBe(true);
    expect(options.config).toBe('/tmp/local.json');
  });

  it('should fall back to parent options when local options are undefined', () => {
    const command = {
      opts: () => ({}),
      parent: {
        opts: () => ({
          verbose: true,
          quiet: false,
          dryRun: true,
          config: '/tmp/parent.json',
        }),
      },
    } as Parameters<typeof getGlobalOptions>[0];

    const options = getGlobalOptions(command);

    expect(options.verbose).toBe(true);
    expect(options.quiet).toBe(false);
    expect(options.dryRun).toBe(true);
    expect(options.config).toBe('/tmp/parent.json');
  });

  it('should return defaults when no command is provided', () => {
    const options = getGlobalOptions();

    expect(options.verbose).toBe(false);
    expect(options.quiet).toBe(false);
    expect(options.dryRun).toBe(false);
    expect(options.config).toBeUndefined();
  });
});
