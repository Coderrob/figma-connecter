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
 * @fileoverview Tests for connect command handler.
 */

import { Command } from 'commander';

import { runConnectCommand } from '../../../src/commands/connect/handler';
import type { ConnectCommandOptions } from '../../../src/commands/connect/types';

const mockGetGlobalOptions = jest.fn();
const mockValidateGlobalOptions = jest.fn();
const mockValidatePathOption = jest.fn();
const mockValidateConfigPath = jest.fn();
const mockParseEmitTargets = jest.fn();
const mockRunConnectPipeline = jest.fn();
const mockFormatReportSummary = jest.fn();
const mockCreateProgressIndicator = jest.fn();

jest.mock('../../../src/cli/options', () => ({
  getGlobalOptions: (...args: unknown[]) => mockGetGlobalOptions(...args),
}));

jest.mock('../../../src/cli/validators', () => ({
  validateGlobalOptions: (...args: unknown[]) => mockValidateGlobalOptions(...args),
  validatePathOption: (...args: unknown[]) => mockValidatePathOption(...args),
  validateConfigPath: (...args: unknown[]) => mockValidateConfigPath(...args),
}));

jest.mock('../../../src/cli/progress', () => ({
  createProgressIndicator: (...args: unknown[]) => mockCreateProgressIndicator(...args),
}));

jest.mock('../../../src/core/emit-targets', () => {
  const actual = jest.requireActual('../../../src/core/emit-targets');
  return {
    ...actual,
    parseEmitTargets: (...args: unknown[]) => mockParseEmitTargets(...args),
  };
});

jest.mock('../../../src/pipeline', () => ({
  runConnectPipeline: (...args: unknown[]) => mockRunConnectPipeline(...args),
}));

jest.mock('../../../src/core/report', () => ({
  formatReportSummary: (...args: unknown[]) => mockFormatReportSummary(...args),
}));

jest.mock('../../../src/core/logger', () => {
  const actual = jest.requireActual('../../../src/core/logger');
  return {
    ...actual,
    Logger: jest.fn().mockImplementation(() => ({
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    })),
  };
});

describe('runConnectCommand', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should run the connect pipeline and log diagnostics', async () => {
    const progress = { start: jest.fn(), stop: jest.fn(), update: jest.fn() };
    mockCreateProgressIndicator.mockReturnValue(progress);
    mockGetGlobalOptions.mockReturnValue({ verbose: false, quiet: false, config: undefined });
    mockValidatePathOption.mockReturnValue('/tmp/components');
    mockValidateConfigPath.mockReturnValue(undefined);
    mockParseEmitTargets.mockReturnValue(['webcomponent']);
    mockFormatReportSummary.mockReturnValue('Summary line');

    mockRunConnectPipeline.mockResolvedValue({
      status: 'error',
      warnings: ['warn'],
      errors: ['err'],
      componentResults: [
        {
          componentName: 'Demo',
          created: ['file-a'],
          updated: [],
          unchanged: [],
          fileChanges: [{ filePath: '/tmp/file-a', status: 'created', reason: 'new file' }],
        },
      ],
    });

    const options: ConnectCommandOptions = {
      path: './components',
      recursive: true,
      dryRun: true,
      emit: 'webcomponent',
      strict: true,
      continueOnError: true,
    };

    const previousExitCode = process.exitCode;
    process.exitCode = 0;

    await runConnectCommand(options, new Command('connect'));

    expect(mockRunConnectPipeline).toHaveBeenCalledWith(
      expect.objectContaining({
        inputPath: '/tmp/components',
        recursive: true,
        dryRun: true,
        emitTargets: ['webcomponent'],
        strict: true,
        continueOnError: true,
      }),
      expect.any(Object),
    );

    const { Logger } = jest.requireMock('../../../src/core/logger');
    const loggerInstance = Logger.mock.results[0]?.value as { info: jest.Mock; warn: jest.Mock; error: jest.Mock };

    expect(loggerInstance.info).toHaveBeenCalledWith('=== Generation Summary ===');
    expect(loggerInstance.warn).toHaveBeenCalledWith('Warnings: 1');
    expect(loggerInstance.error).toHaveBeenCalledWith('Errors: 1');

    expect(progress.start).toHaveBeenCalledWith('Validating options');
    expect(progress.stop).toHaveBeenCalledWith('Options validated');
    expect(progress.start).toHaveBeenCalledWith('Running connect pipeline');
    expect(progress.stop).toHaveBeenCalledWith('Connect pipeline complete', 'error');

    expect(process.exitCode).toBe(1);
    process.exitCode = previousExitCode;
  });

  it('should stop progress and rethrow when pipeline fails', async () => {
    const progress = { start: jest.fn(), stop: jest.fn(), update: jest.fn() };
    mockCreateProgressIndicator.mockReturnValue(progress);
    mockGetGlobalOptions.mockReturnValue({ verbose: false, quiet: false, config: undefined });
    mockValidatePathOption.mockReturnValue('/tmp/components');
    mockValidateConfigPath.mockReturnValue(undefined);
    mockParseEmitTargets.mockReturnValue(['webcomponent']);

    const error = new Error('Pipeline failed');
    mockRunConnectPipeline.mockRejectedValue(error);

    const options: ConnectCommandOptions = {
      path: './components',
      recursive: false,
      dryRun: false,
      emit: 'webcomponent',
      strict: false,
      continueOnError: false,
    };

    await expect(runConnectCommand(options, new Command('connect'))).rejects.toThrow('Pipeline failed');

    expect(progress.stop).toHaveBeenCalledWith('Connect failed', 'error');
  });

  it('should honor global dry-run when command option is undefined', async () => {
    const progress = { start: jest.fn(), stop: jest.fn(), update: jest.fn() };
    mockCreateProgressIndicator.mockReturnValue(progress);
    mockGetGlobalOptions.mockReturnValue({
      verbose: false,
      quiet: false,
      dryRun: true,
      config: undefined,
    });
    mockValidatePathOption.mockReturnValue('/tmp/components');
    mockValidateConfigPath.mockReturnValue(undefined);
    mockParseEmitTargets.mockReturnValue(['webcomponent']);
    mockFormatReportSummary.mockReturnValue('Summary line');

    mockRunConnectPipeline.mockResolvedValue({
      status: 'success',
      warnings: [],
      errors: [],
      componentResults: [],
    });

    const options: ConnectCommandOptions = {
      path: './components',
      recursive: false,
      emit: 'webcomponent',
      strict: false,
      continueOnError: false,
    };

    await runConnectCommand(options, new Command('connect'));

    expect(mockRunConnectPipeline).toHaveBeenCalledWith(
      expect.objectContaining({
        inputPath: '/tmp/components',
        dryRun: true,
      }),
      expect.any(Object),
    );

    const { Logger } = jest.requireMock('../../../src/core/logger');
    const loggerInstance = Logger.mock.results[0]?.value as { info: jest.Mock };

    expect(loggerInstance.info).toHaveBeenCalledWith('Dry run enabled. No files will be written.');
  });

  it('should skip dry-run details when dryRun is false', async () => {
    const progress = { start: jest.fn(), stop: jest.fn(), update: jest.fn() };
    mockCreateProgressIndicator.mockReturnValue(progress);
    mockGetGlobalOptions.mockReturnValue({ verbose: false, quiet: false, config: undefined });
    mockValidatePathOption.mockReturnValue('/tmp/components');
    mockValidateConfigPath.mockReturnValue(undefined);
    mockParseEmitTargets.mockReturnValue(['webcomponent']);
    mockFormatReportSummary.mockReturnValue('Summary line');

    mockRunConnectPipeline.mockResolvedValue({
      status: 'success',
      warnings: [],
      errors: [],
      componentResults: [],
    });

    const options: ConnectCommandOptions = {
      path: './components',
      recursive: false,
      dryRun: false,
      emit: 'webcomponent',
      strict: false,
      continueOnError: false,
    };

    await runConnectCommand(options, new Command('connect'));

    const { Logger } = jest.requireMock('../../../src/core/logger');
    const loggerInstance = Logger.mock.results[0]?.value as { info: jest.Mock };

    expect(loggerInstance.info).not.toHaveBeenCalledWith('=== Dry Run Details ===');
  });

  it('should log dry-run details with fallback names and relative paths', async () => {
    const progress = { start: jest.fn(), stop: jest.fn(), update: jest.fn() };
    mockCreateProgressIndicator.mockReturnValue(progress);
    mockGetGlobalOptions.mockReturnValue({ verbose: false, quiet: false, config: undefined });
    mockValidatePathOption.mockReturnValue('/tmp/components');
    mockValidateConfigPath.mockReturnValue(undefined);
    mockParseEmitTargets.mockReturnValue(['webcomponent']);
    mockFormatReportSummary.mockReturnValue('Summary line');

    mockRunConnectPipeline.mockResolvedValue({
      status: 'success',
      warnings: [],
      errors: [],
      componentResults: [
        {
          componentName: undefined,
          model: { className: 'FallbackComponent' } as any,
          created: [],
          updated: [],
          unchanged: [],
          fileChanges: [{ filePath: process.cwd(), status: 'updated', reason: 'manual edit' }],
        },
        {
          componentName: undefined,
          model: undefined,
          created: [],
          updated: [],
          unchanged: [],
          fileChanges: [],
        },
      ],
    });

    const options: ConnectCommandOptions = {
      path: './components',
      recursive: false,
      dryRun: true,
      emit: 'webcomponent',
      strict: false,
      continueOnError: false,
    };

    await runConnectCommand(options, new Command('connect'));

    const { Logger } = jest.requireMock('../../../src/core/logger');
    const loggerInstance = Logger.mock.results[0]?.value as { info: jest.Mock };

    expect(loggerInstance.info).toHaveBeenCalledWith('=== Dry Run Details ===');
    expect(loggerInstance.info).toHaveBeenCalledWith('FallbackComponent: created 0, updated 0, unchanged 0');
    expect(loggerInstance.info).toHaveBeenCalledWith(`  - ${process.cwd()}: updated (manual edit)`);
    expect(loggerInstance.info).toHaveBeenCalledWith('UnknownComponent: created 0, updated 0, unchanged 0');
  });

  it('should skip dry-run details when component results are missing', async () => {
    const progress = { start: jest.fn(), stop: jest.fn(), update: jest.fn() };
    mockCreateProgressIndicator.mockReturnValue(progress);
    mockGetGlobalOptions.mockReturnValue({ verbose: false, quiet: false, config: undefined });
    mockValidatePathOption.mockReturnValue('/tmp/components');
    mockValidateConfigPath.mockReturnValue(undefined);
    mockParseEmitTargets.mockReturnValue(['webcomponent']);
    mockFormatReportSummary.mockReturnValue('Summary line');

    mockRunConnectPipeline.mockResolvedValue({
      status: 'success',
      warnings: [],
      errors: [],
    });

    const options: ConnectCommandOptions = {
      path: './components',
      recursive: false,
      dryRun: true,
      emit: 'webcomponent',
      strict: false,
      continueOnError: false,
    };

    await runConnectCommand(options, new Command('connect'));

    const { Logger } = jest.requireMock('../../../src/core/logger');
    const loggerInstance = Logger.mock.results[0]?.value as { info: jest.Mock };

    expect(loggerInstance.info).not.toHaveBeenCalledWith('=== Dry Run Details ===');
  });
});
