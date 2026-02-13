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
 * @fileoverview Tests for connect command helpers.
 */

import { resolveLogLevel, runCommandStages, type CommandStages } from '../../../src/commands/connect/helpers';
import { LogLevel } from '../../../src/core/logger';

describe('resolveLogLevel', () => {
  it('should prefer quiet over verbose', () => {
    expect(resolveLogLevel({ quiet: true, verbose: true })).toBe(LogLevel.ERROR);
  });

  it('should return debug when verbose is set', () => {
    expect(resolveLogLevel({ verbose: true, quiet: false })).toBe(LogLevel.DEBUG);
  });

  it('should return info by default', () => {
    expect(resolveLogLevel({ verbose: false, quiet: false })).toBe(LogLevel.INFO);
  });
});

describe('runCommandStages', () => {
  it('should execute command stages successfully', async () => {
    const mockContext = { value: 'test-context' };
    const mockResult = { success: true };
    
    const command: CommandStages<typeof mockContext, typeof mockResult> = {
      validate: jest.fn(() => mockContext),
      execute: jest.fn(async () => mockResult),
      report: jest.fn(),
    };

    await runCommandStages(command);

    expect(command.validate).toHaveBeenCalled();
    expect(command.execute).toHaveBeenCalledWith(mockContext);
    expect(command.report).toHaveBeenCalledWith(mockContext, mockResult);
  });

  it('should call onError callback when execute throws an error', async () => {
    const mockContext = { value: 'test-context' };
    const mockError = new Error('Test error');
    const onErrorMock = jest.fn();
    
    const command: CommandStages<typeof mockContext, never> = {
      validate: jest.fn(() => mockContext),
      execute: jest.fn(async () => {
        throw mockError;
      }),
      report: jest.fn(),
      onError: onErrorMock,
    };

    await expect(runCommandStages(command)).rejects.toThrow('Test error');
    
    expect(command.validate).toHaveBeenCalled();
    expect(command.execute).toHaveBeenCalledWith(mockContext);
    expect(onErrorMock).toHaveBeenCalledWith(mockContext, mockError);
    expect(command.report).not.toHaveBeenCalled();
  });

  it('should re-throw error even after calling onError', async () => {
    const mockContext = { value: 'test-context' };
    const mockError = new Error('Test error');
    
    const command: CommandStages<typeof mockContext, never> = {
      validate: jest.fn(() => mockContext),
      execute: jest.fn(async () => {
        throw mockError;
      }),
      report: jest.fn(),
      onError: jest.fn(), // onError present but we still re-throw
    };

    await expect(runCommandStages(command)).rejects.toThrow('Test error');
  });
});
