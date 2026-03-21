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
 * @fileoverview Tests for pipeline batch processing.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import ts from 'typescript';

import type { Logger } from '../../src/core/logger';
import { applyAggregateDiagnostics, createResult } from '../../src/core/result';
import { type EmitResult, EmitterTarget, GeneratedSectionName } from '../../src/core/types';
import type { Emitter } from '../../src/emitters/types';
import { createMemoryIoAdapter } from '../../src/io/adapter';
import type { DiscoveredFile } from '../../src/types/io';
import type { Parser } from '../../src/parsers/types';
import { ParserTarget } from '../../src/parsers/types';
import { processComponentBatch } from '../../src/pipeline/batch';
import { createMockComponentModel, createMockPipelineContext } from '../helpers/fixtures';

// Type alias to avoid indexed access type
type PipelineLogger = Logger | undefined;

describe('processComponentBatch', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'figma-connecter-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  const createDiscoveredFile = (filePath: string): DiscoveredFile => ({
    filePath,
    relativePath: path.basename(filePath),
    fileName: path.basename(filePath),
    componentName: path.basename(filePath, '.component.ts'),
    dirPath: path.dirname(filePath),
  });

  it('should add an error when the source file is missing and stops on continueOnError=false', () => {
    const discovered = [
      createDiscoveredFile(path.join(tempDir, 'missing.component.ts')),
      createDiscoveredFile(path.join(tempDir, 'ignored.component.ts')),
    ];

    const parser: Parser = {
      target: ParserTarget.WebComponent,
      parse: () => createResult(undefined),
    } as Parser;

    const context = createMockPipelineContext({
      parser,
      dryRun: true,
      continueOnError: false,
    });

    const aggregate = processComponentBatch(discovered, context);
    const results = applyAggregateDiagnostics(aggregate);

    expect(results).toHaveLength(1);
    expect(results[0].errors[0]).toContain('Source file not found');
  });

  it('should continue when source files are missing and parse results are empty', () => {
    const missingPath = path.join(tempDir, 'missing.component.ts');
    const existingPath = path.join(tempDir, 'existing.component.ts');
    fs.writeFileSync(existingPath, 'export class Existing {}', 'utf8');

    const sourceFile = ts.createSourceFile(
      existingPath,
      'export class Existing {}',
      ts.ScriptTarget.ESNext,
      true,
      ts.ScriptKind.TS,
    );

    const parser: Parser = {
      target: ParserTarget.WebComponent,
      parse: () => createResult(undefined, ['parse warning'], ['parse error']),
    } as Parser;

    const context = createMockPipelineContext({
      parser,
      dryRun: true,
      sourceFileMap: new Map([[path.resolve(existingPath), sourceFile]]),
      continueOnError: true,
    });

    const aggregate = processComponentBatch(
      [createDiscoveredFile(missingPath), createDiscoveredFile(existingPath)],
      context,
    );
    const results = applyAggregateDiagnostics(aggregate);

    expect(results).toHaveLength(2);
    expect(results[1].warnings).toContain('parse warning');
    expect(results[1].errors).toContain('parse error');
  });

  it('should continue when parse results are missing but continueOnError is true', () => {
    const firstPath = path.join(tempDir, 'first.component.ts');
    const secondPath = path.join(tempDir, 'second.component.ts');
    fs.writeFileSync(firstPath, 'export class First {}', 'utf8');
    fs.writeFileSync(secondPath, 'export class Second {}', 'utf8');

    const sourceFile = ts.createSourceFile(
      firstPath,
      'export class First {}',
      ts.ScriptTarget.ESNext,
      true,
      ts.ScriptKind.TS,
    );
    const secondSourceFile = ts.createSourceFile(
      secondPath,
      'export class Second {}',
      ts.ScriptTarget.ESNext,
      true,
      ts.ScriptKind.TS,
    );

    const parser: Parser = {
      target: ParserTarget.WebComponent,
      parse: jest
        .fn()
        .mockReturnValueOnce(createResult(undefined))
        .mockReturnValueOnce(createResult(createMockComponentModel({ className: 'Second' }))),
    } as Parser;

    const context = createMockPipelineContext({
      parser,
      dryRun: true,
      sourceFileMap: new Map([
        [path.resolve(firstPath), sourceFile],
        [path.resolve(secondPath), secondSourceFile],
      ]),
      continueOnError: true,
    });

    const aggregate = processComponentBatch(
      [createDiscoveredFile(firstPath), createDiscoveredFile(secondPath)],
      context,
    );
    const results = applyAggregateDiagnostics(aggregate);

    expect(results).toHaveLength(2);
    expect(parser.parse).toHaveBeenCalledTimes(2);
  });

  it('should write emissions and collects warnings/errors', () => {
    const componentPath = path.join(tempDir, 'sample.component.ts');
    fs.writeFileSync(componentPath, 'export class Sample {}', 'utf8');

    const existingWithMarkers = path.join(tempDir, 'existing-markers.ts');
    const existingWithoutMarkers = path.join(tempDir, 'existing-no-markers.ts');
    const io = createMemoryIoAdapter({
      [existingWithMarkers]: [
        'figma.connect("url", {',
        '  // BEGIN GENERATED: props',
        '  props: {},',
        '  // END GENERATED: props',
        '  // BEGIN GENERATED: example',
        '  example: () => null,',
        '  // END GENERATED: example',
        '});',
      ].join('\n'),
      [existingWithoutMarkers]: 'figma.connect("url", {});',
    });

    const sourceFile = ts.createSourceFile(
      componentPath,
      'export class Sample {}',
      ts.ScriptTarget.ESNext,
      true,
      ts.ScriptKind.TS,
    );

    const model = createMockComponentModel({
      className: 'Sample',
      filePath: componentPath,
      componentDir: tempDir,
    });

    const parser: Parser = {
      target: ParserTarget.WebComponent,
      parse: () => createResult(model, ['parser warning'], ['parser error']),
    } as Parser;

    const emitters: Emitter[] = [
      {
        target: EmitterTarget.WebComponent,
        emit: () =>
          ({
            filePath: path.join(tempDir, 'new-file.ts'),
            content: 'export const generated = true;\n',
            action: 'created',
          }) as EmitResult,
      },
      {
        target: EmitterTarget.WebComponent,
        emit: () =>
          ({
            filePath: existingWithoutMarkers,
            content: 'figma.connect("url", {});',
            action: 'updated',
            sections: [
              { name: GeneratedSectionName.Props, content: 'props: {}' },
              { name: GeneratedSectionName.Example, content: 'example: () => null' },
            ],
          }) as EmitResult,
      },
      {
        target: EmitterTarget.WebComponent,
        emit: () =>
          ({
            filePath: existingWithMarkers,
            content: 'figma.connect("url", {});',
            action: 'updated',
            sections: [
              { name: GeneratedSectionName.Props, content: 'props: { updated: true }' },
              { name: GeneratedSectionName.Example, content: 'example: () => null' },
            ],
          }) as EmitResult,
      },
      {
        target: EmitterTarget.WebComponent,
        emit: () =>
          ({
            filePath: path.join(tempDir, 'section-only.ts'),
            content: 'figma.connect("url", {});',
            action: 'created',
            warnings: ['emit warning'],
            section: { name: GeneratedSectionName.Props, content: 'props: {}' },
          }) as EmitResult,
      },
      {
        target: EmitterTarget.WebComponent,
        emit: () =>
          ({
            filePath: existingWithMarkers,
            content: 'figma.connect("url", {});',
            action: 'updated',
            sections: [
              { name: GeneratedSectionName.Props, content: 'props: {}' },
              { name: GeneratedSectionName.Example, content: 'example: () => null' },
            ],
          }) as EmitResult,
      },
    ];

    const context = createMockPipelineContext({
      emitters,
      parser,
      dryRun: true,
      sourceFileMap: new Map([[path.resolve(componentPath), sourceFile]]),
      io,
      logger: { debug: jest.fn() } as unknown as PipelineLogger,
    });

    const aggregate = processComponentBatch([createDiscoveredFile(componentPath)], context);
    const results = applyAggregateDiagnostics(aggregate);

    expect(results).toHaveLength(1);
    const result = results[0];

    expect(result.warnings).toContain('parser warning');
    expect(result.errors).toContain('parser error');
    expect(result.created.length + result.updated.length + result.unchanged.length).toBe(5);
    expect(result.fileChanges?.length).toBe(5);
    expect(result.warnings.some((warning) => warning.includes('Generated section markers not found'))).toBe(true);
    expect(result.warnings).toContain('emit warning');
  });

  it('should record updated file changes when content differs', () => {
    const componentPath = path.join(tempDir, 'update.component.ts');
    fs.writeFileSync(componentPath, 'export class Update {}', 'utf8');

    const targetPath = path.join(tempDir, 'target.ts');
    const io = createMemoryIoAdapter({
      [targetPath]: 'export const value = 1;',
    });

    const sourceFile = ts.createSourceFile(
      componentPath,
      'export class Update {}',
      ts.ScriptTarget.ESNext,
      true,
      ts.ScriptKind.TS,
    );

    const model = createMockComponentModel({
      className: 'Update',
      filePath: componentPath,
      componentDir: tempDir,
    });

    const parser: Parser = {
      target: ParserTarget.WebComponent,
      parse: () => createResult(model),
    } as Parser;

    const emitters: Emitter[] = [
      {
        target: EmitterTarget.WebComponent,
        emit: () =>
          ({
            filePath: targetPath,
            content: 'export const value = 2;',
            action: 'updated',
          }) as EmitResult,
      },
    ];

    const context = createMockPipelineContext({
      emitters,
      parser,
      dryRun: true,
      sourceFileMap: new Map([[path.resolve(componentPath), sourceFile]]),
      io,
    });

    const aggregate = processComponentBatch([createDiscoveredFile(componentPath)], context);
    const results = applyAggregateDiagnostics(aggregate);

    const change = results[0].fileChanges?.[0];
    expect(change?.status).toBe('updated');
    expect(change?.reason).toBe('content updated');
  });

  it('should force replace existing files when force is enabled', () => {
    const componentPath = path.join(tempDir, 'force.component.ts');
    fs.writeFileSync(componentPath, 'export class Force {}', 'utf8');

    const targetPath = path.join(tempDir, 'force-target.ts');
    const io = createMemoryIoAdapter({
      [targetPath]: 'manual edits',
    });

    const sourceFile = ts.createSourceFile(
      componentPath,
      'export class Force {}',
      ts.ScriptTarget.ESNext,
      true,
      ts.ScriptKind.TS,
    );

    const model = createMockComponentModel({
      className: 'Force',
      filePath: componentPath,
      componentDir: tempDir,
    });

    const parser: Parser = {
      target: ParserTarget.WebComponent,
      parse: () => createResult(model),
    } as Parser;

    const emitters: Emitter[] = [
      {
        target: EmitterTarget.WebComponent,
        emit: () =>
          ({
            filePath: targetPath,
            content: 'figma.connect("url", {});',
            action: 'updated',
            sections: [{ name: GeneratedSectionName.Props, content: 'props: {}' }],
          }) as EmitResult,
      },
    ];

    const context = createMockPipelineContext({
      emitters,
      parser,
      dryRun: false,
      force: true,
      sourceFileMap: new Map([[path.resolve(componentPath), sourceFile]]),
      io,
    });

    const aggregate = processComponentBatch([createDiscoveredFile(componentPath)], context);
    const results = applyAggregateDiagnostics(aggregate);

    const written = io.readFile(targetPath);
    expect(written).toBe('figma.connect("url", {});');
    expect(results[0].warnings.some((warning) => warning.includes('Generated section markers not found'))).toBe(false);
  });

  it('should create files when sections are provided and the target is missing', () => {
    const componentPath = path.join(tempDir, 'sections-missing.component.ts');
    fs.writeFileSync(componentPath, 'export class SectionsMissing {}', 'utf8');

    const targetPath = path.join(tempDir, 'sections-missing.ts');
    const io = createMemoryIoAdapter();

    const sourceFile = ts.createSourceFile(
      componentPath,
      'export class SectionsMissing {}',
      ts.ScriptTarget.ESNext,
      true,
      ts.ScriptKind.TS,
    );

    const model = createMockComponentModel({
      className: 'SectionsMissing',
      filePath: componentPath,
      componentDir: tempDir,
    });

    const parser: Parser = {
      target: ParserTarget.WebComponent,
      parse: () => createResult(model),
    } as Parser;

    const emitters: Emitter[] = [
      {
        target: EmitterTarget.WebComponent,
        emit: () =>
          ({
            filePath: targetPath,
            content: 'figma.connect("url", {});',
            action: 'created',
            sections: [
              { name: GeneratedSectionName.Props, content: 'props: {}' },
              { name: GeneratedSectionName.Example, content: 'example: () => null' },
            ],
          }) as EmitResult,
      },
    ];

    const context = createMockPipelineContext({
      emitters,
      parser,
      dryRun: true,
      sourceFileMap: new Map([[path.resolve(componentPath), sourceFile]]),
      io,
    });

    const aggregate = processComponentBatch([createDiscoveredFile(componentPath)], context);
    const results = applyAggregateDiagnostics(aggregate);

    expect(results[0].created).toContain(targetPath);
    expect(results[0].fileChanges?.[0]?.reason).toBe('new file');
  });
});
