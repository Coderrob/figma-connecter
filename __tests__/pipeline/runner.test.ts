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
 * @fileoverview Tests for pipeline runner.
 */

import type ts from 'typescript';

import { createEmptyComponentResult } from '../../src/core/report';
import { aggregateResults, createResult } from '../../src/core/result';
import { EmitterTarget } from '../../src/core/types';
import type { Emitter } from '../../src/emitters/types';
import { createMemoryIoAdapter } from '../../src/io/adapter';
import type { DiscoveredFile } from '../../src/types/io';
import type { SourceLoadResult } from '../../src/io/source-loader';
import type { Parser } from '../../src/parsers/types';
import { ParserTarget } from '../../src/parsers/types';
import { runConnectPipeline } from '../../src/pipeline/runner';

// Type aliases to avoid indexed access types
type Emitters = readonly Emitter[];
type TypeChecker = ts.TypeChecker;
type Program = ts.Program;

jest.mock('../../src/io/file-discovery', () => ({
  discoverComponentFiles: jest.fn(),
}));

jest.mock('../../src/emitters/factory', () => ({
  createEmitters: jest.fn(),
}));

jest.mock('../../src/io/source-loader', () => ({
  loadSourceProgram: jest.fn(),
}));

jest.mock('../../src/parsers/factory', () => ({
  createDefaultParser: jest.fn(),
}));

jest.mock('../../src/pipeline/batch', () => ({
  processComponentBatch: jest.fn(),
}));

const { discoverComponentFiles } = jest.requireMock('../../src/io/file-discovery');
const { createEmitters } = jest.requireMock('../../src/emitters/factory');
const { loadSourceProgram } = jest.requireMock('../../src/io/source-loader');
const { createDefaultParser } = jest.requireMock('../../src/parsers/factory');
const { processComponentBatch } = jest.requireMock('../../src/pipeline/batch');

describe('runConnectPipeline (runner)', () => {
  const logger = {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  } as unknown as Parameters<typeof runConnectPipeline>[1];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return a warning when no components are discovered', async () => {
    discoverComponentFiles.mockReturnValue([]);

    const report = await runConnectPipeline(
      {
        inputPath: '/tmp/components',
        recursive: false,
        dryRun: true,
        emitTargets: [EmitterTarget.WebComponent],
        strict: false,
        force: false,
      },
      logger,
    );

    expect(report.status).toBe('warning');
    expect(report.warnings[0]).toContain('No component files found');
  });

  it('should include loader errors and emitter warnings in the report', async () => {
    const discovered: DiscoveredFile[] = [
      {
        filePath: '/tmp/components/button.component.ts',
        relativePath: 'button.component.ts',
        fileName: 'button.component.ts',
        componentName: 'button',
        dirPath: '/tmp/components',
      },
    ];

    const emitters = [] as Emitters;
    const parser = { target: ParserTarget.WebComponent, parse: jest.fn() } as Parser;
    const pipelineContext = {
      checker: {} as TypeChecker,
      emitters,
      parser,
      dryRun: true,
      strict: false,
      force: false,
      sourceFileMap: new Map(),
      logger,
      io: createMemoryIoAdapter(),
    };

    const sourceLoad: SourceLoadResult = {
      context: pipelineContext,
      checker: pipelineContext.checker,
      configPath: '/tmp/tsconfig.json',
      errors: ['Invalid tsconfig'],
      options: {},
      program: {} as Program,
      sourceFiles: [],
      sourceFileMap: pipelineContext.sourceFileMap,
    };

    discoverComponentFiles.mockReturnValue(discovered);
    createEmitters.mockReturnValue(emitters);
    createDefaultParser.mockReturnValue(parser);
    loadSourceProgram.mockReturnValue(sourceLoad);
    processComponentBatch.mockReturnValue(aggregateResults([createResult(createEmptyComponentResult())]));

    const report = await runConnectPipeline(
      {
        inputPath: '/tmp/components',
        recursive: false,
        dryRun: true,
        emitTargets: [EmitterTarget.WebComponent],
        strict: false,
        force: false,
      },
      logger,
    );

    expect(report.errors).toContain('Invalid tsconfig');
    expect(report.warnings).toContain('No emitters selected. Use --emit to specify targets.');
    expect(logger.debug).toHaveBeenCalledWith('Using tsconfig for TypeScript program.', {
      configPath: '/tmp/tsconfig.json',
    });
  });

  it('should not warn when emitters are configured', async () => {
    const discovered: DiscoveredFile[] = [
      {
        filePath: '/tmp/components/card.component.ts',
        relativePath: 'card.component.ts',
        fileName: 'card.component.ts',
        componentName: 'card',
        dirPath: '/tmp/components',
      },
    ];

    const emitters = [{ target: EmitterTarget.WebComponent, emit: jest.fn() }] as Emitters;
    const parser = { target: ParserTarget.WebComponent, parse: jest.fn() } as Parser;
    const pipelineContext = {
      checker: {} as TypeChecker,
      emitters,
      parser,
      dryRun: true,
      strict: false,
      force: false,
      sourceFileMap: new Map(),
      logger,
      io: createMemoryIoAdapter(),
    };

    const sourceLoad: SourceLoadResult = {
      context: pipelineContext,
      checker: pipelineContext.checker,
      configPath: undefined,
      errors: [],
      options: {},
      program: {} as Program,
      sourceFiles: [],
      sourceFileMap: pipelineContext.sourceFileMap,
    };

    discoverComponentFiles.mockReturnValue(discovered);
    createEmitters.mockReturnValue(emitters);
    createDefaultParser.mockReturnValue(parser);
    loadSourceProgram.mockReturnValue(sourceLoad);
    processComponentBatch.mockReturnValue(aggregateResults([createResult(createEmptyComponentResult())]));

    const report = await runConnectPipeline(
      {
        inputPath: '/tmp/components',
        recursive: false,
        dryRun: true,
        emitTargets: [EmitterTarget.WebComponent],
        strict: false,
        force: false,
      },
      logger,
    );

    expect(report.warnings).not.toContain('No emitters selected. Use --emit to specify targets.');
  });
});
