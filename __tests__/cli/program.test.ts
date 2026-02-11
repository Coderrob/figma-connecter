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
 * @fileoverview Tests for CLI program helpers.
 */

import { Command } from 'commander';

import * as optionsModule from '../../src/cli/options';
import * as programModule from '../../src/cli/program';

describe('cli program', () => {
  it('should register the connect command and help text', () => {
    const program = programModule.createProgram();
    const commandNames = program.commands.map((command) => command.name());

    expect(commandNames).toContain('connect');

    const helpText = program.helpInformation();
    expect(helpText).toContain('Usage: figma-connecter');
    expect(helpText).toContain('connect [options]');
  });

  it('should resolve global options with parent fallback', () => {
    const command = {
      opts: () => ({ verbose: true, dryRun: true }),
      parent: {
        opts: () => ({ quiet: false, dryRun: false, config: '/tmp/tsconfig.json' }),
      },
    } as unknown as Parameters<typeof optionsModule.getGlobalOptions>[0];

    const options = optionsModule.getGlobalOptions(command);
    expect(options.verbose).toBe(true);
    expect(options.quiet).toBe(false);
    expect(options.dryRun).toBe(true);
    expect(options.config).toBe('/tmp/tsconfig.json');
  });

  it('should return false for missing parent options', () => {
    const command = {
      opts: () => ({}),
      parent: undefined,
    } as unknown as Parameters<typeof optionsModule.getGlobalOptions>[0];

    const options = optionsModule.getGlobalOptions(command);
    expect(options.verbose).toBe(false);
    expect(options.quiet).toBe(false);
    expect(options.dryRun).toBe(false);
    expect(options.config).toBeUndefined();
  });

  it('should prefer local false values over parent true values', () => {
    const command = {
      opts: () => ({ verbose: false, quiet: false, dryRun: false }),
      parent: {
        opts: () => ({ verbose: true, quiet: true, dryRun: true }),
      },
    } as unknown as Parameters<typeof optionsModule.getGlobalOptions>[0];

    const options = optionsModule.getGlobalOptions(command);
    expect(options.verbose).toBe(false);
    expect(options.quiet).toBe(false);
    expect(options.dryRun).toBe(false);
  });

  it('should add global options to the program', () => {
    const program = new Command();
    programModule.addGlobalOptions(program);

    const optionFlags = program.options.map((option) => option.flags);
    expect(optionFlags).toContain('-v, --verbose');
    expect(optionFlags).toContain('-q, --quiet');
    expect(optionFlags).toContain('-d, --dry-run');
    expect(optionFlags).toContain('-c, --config <path>');
  });

  it('should format help output with required option markers', () => {
    const program = new Command('test');
    program.requiredOption('-p, --path <path>', 'Path to input');
    program.option('-v, --verbose', 'Verbose output');

    programModule.applyHelpFormatting(program);

    const helpText = program.helpInformation();
    expect(helpText).toContain('-p | --path <path> (required)');
    expect(helpText).toContain('-v | --verbose');
  });

  it('should run the CLI program parser', async () => {
    const parseSpy = jest.spyOn(Command.prototype, 'parseAsync').mockResolvedValue(undefined as unknown as Command);

    await programModule.run(['node', 'figma-connecter']);

    expect(parseSpy).toHaveBeenCalled();

    parseSpy.mockRestore();
  });

  it('should run with default argv when none is provided', async () => {
    const parseSpy = jest.spyOn(Command.prototype, 'parseAsync').mockResolvedValue(undefined as unknown as Command);

    await programModule.run();

    expect(parseSpy).toHaveBeenCalled();

    parseSpy.mockRestore();
  });

  it('should load package metadata when available', () => {
    const packageJson = JSON.stringify({
      description: 'Custom CLI',
      version: '9.9.9',
    });

    jest.resetModules();
    jest.doMock('node:fs', () => ({
      readFileSync: jest.fn(() => packageJson),
    }));

    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { createProgram } = require('../../src/cli/program') as typeof programModule;
      const program = createProgram();

      expect(program.description()).toBe('Custom CLI');
      expect(program.version()).toBe('9.9.9');
    });

    jest.dontMock('node:fs');
  });
});
