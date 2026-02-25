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
 * @fileoverview Tests for source loader utilities.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { nodeIoAdapter } from '../../src/io/adapter';
import { loadSourceProgram, resolveTsconfigPath } from '../../src/io/source-loader';
import { type Parser, ParserTarget } from '../../src/parsers/types';
import type { PipelineContextSeed } from '../../src/pipeline/context';

const createContextSeed = (): PipelineContextSeed => ({
  emitters: [],
  parser: { target: ParserTarget.WebComponent, parse: jest.fn() } as Parser,
  dryRun: true,
  strict: false,
  force: false,
  io: nodeIoAdapter,
});

describe('source-loader', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'figma-connecter-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('should resolves explicit tsconfig paths', () => {
    const configPath = path.join(tempDir, 'tsconfig.json');
    fs.writeFileSync(configPath, '{"compilerOptions": {}}', 'utf8');

    expect(resolveTsconfigPath('tsconfig.json', tempDir)).toBe(configPath);
    expect(resolveTsconfigPath(configPath, tempDir)).toBe(configPath);
  });

  it('should resolves tsconfig from a search path', () => {
    const configPath = path.join(tempDir, 'tsconfig.json');
    fs.writeFileSync(configPath, '{"compilerOptions": {}}', 'utf8');

    const nestedDir = path.join(tempDir, 'nested');
    fs.mkdirSync(nestedDir);

    expect(resolveTsconfigPath(undefined, nestedDir)).toBe(configPath);
  });

  it('should resolves tsconfig when search path is a file', () => {
    const configPath = path.join(tempDir, 'tsconfig.json');
    fs.writeFileSync(configPath, '{"compilerOptions": {}}', 'utf8');

    const filePath = path.join(tempDir, 'sample.component.ts');
    fs.writeFileSync(filePath, 'export class Sample {}', 'utf8');

    expect(resolveTsconfigPath(undefined, filePath)).toBe(configPath);
  });

  it('should resolves a custom-named tsconfig file by configFileName', () => {
    const configPath = path.join(tempDir, 'tsconfig.base.json');
    fs.writeFileSync(configPath, '{"compilerOptions": {}}', 'utf8');

    expect(resolveTsconfigPath(undefined, tempDir, 'tsconfig.base.json')).toBe(configPath);
  });

  it('should not find tsconfig.json when configFileName is tsconfig.base.json', () => {
    const configPath = path.join(tempDir, 'tsconfig.json');
    fs.writeFileSync(configPath, '{"compilerOptions": {}}', 'utf8');

    expect(resolveTsconfigPath(undefined, tempDir, 'tsconfig.base.json')).toBeUndefined();
  });

  it('should merges program data into the provided context', () => {
    const filePath = path.join(tempDir, 'sample.component.ts');
    fs.writeFileSync(filePath, 'export class Sample {}', 'utf8');

    const baseContext = createContextSeed();

    const result = loadSourceProgram([filePath], {
      context: baseContext,
      searchPath: tempDir,
    });

    expect(result.context).not.toBe(baseContext);
    expect(result.context.emitters).toBe(baseContext.emitters);
    expect(result.context.parser).toBe(baseContext.parser);
    expect(result.context.dryRun).toBe(true);
    expect(result.context.strict).toBe(false);
    expect(result.context.sourceFileMap).toBe(result.sourceFileMap);
  });

  it('should defaults searchPath to the first valid file when omitted', () => {
    const filePath = path.join(tempDir, 'default.component.ts');
    fs.writeFileSync(filePath, 'export class Default {}', 'utf8');

    const result = loadSourceProgram([filePath], {
      context: createContextSeed(),
    });

    expect(result.sourceFiles).toHaveLength(1);
  });

  it('should reports when no component files are provided', () => {
    const result = loadSourceProgram([], { context: createContextSeed() });
    expect(result.errors).toContain('No component files provided.');
    expect(result.sourceFiles).toHaveLength(0);
  });

  it('should reports when a component file is missing', () => {
    const missingPath = path.join(tempDir, 'missing.component.ts');
    const result = loadSourceProgram([missingPath], { context: createContextSeed() });

    expect(result.errors.some((error) => error.includes('Source file not found'))).toBe(true);
  });

  it('should reports when a component file is not readable', () => {
    const filePath = path.join(tempDir, 'unreadable.component.ts');
    fs.writeFileSync(filePath, 'export const sample = 1;', 'utf8');
    fs.chmodSync(filePath, 0o000);

    const result = loadSourceProgram([filePath], { context: createContextSeed() });

    expect(result.errors.some((error) => error.includes('Source file is not readable'))).toBe(true);

    fs.chmodSync(filePath, 0o644);
  });

  it('should reports when an explicit tsconfig path is missing', () => {
    const filePath = path.join(tempDir, 'sample.component.ts');
    fs.writeFileSync(filePath, 'export const sample = 1;', 'utf8');

    const result = loadSourceProgram([filePath], {
      context: createContextSeed(),
      tsconfigPath: 'missing-tsconfig.json',
      searchPath: tempDir,
    });

    expect(result.errors.some((error) => error.includes('tsconfig.json not found'))).toBe(true);
  });

  it('should use a custom tsconfigFileName when searching for tsconfig', () => {
    const filePath = path.join(tempDir, 'sample.component.ts');
    fs.writeFileSync(filePath, 'export const sample = 1;', 'utf8');

    const configPath = path.join(tempDir, 'tsconfig.base.json');
    fs.writeFileSync(configPath, '{"compilerOptions": {}}', 'utf8');

    const result = loadSourceProgram([filePath], {
      context: createContextSeed(),
      searchPath: tempDir,
      tsconfigFileName: 'tsconfig.base.json',
    });

    expect(result.configPath).toBe(configPath);
    expect(result.errors).toHaveLength(0);
  });

  it('should reports invalid tsconfig files', () => {
    const filePath = path.join(tempDir, 'sample.component.ts');
    fs.writeFileSync(filePath, 'export const sample = 1;', 'utf8');

    const configPath = path.join(tempDir, 'tsconfig.json');
    fs.writeFileSync(configPath, '{ invalid-json ', 'utf8');

    const result = loadSourceProgram([filePath], {
      context: createContextSeed(),
      tsconfigPath: configPath,
      searchPath: tempDir,
    });

    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain('tsconfig.json:');
  });

  it('should formats diagnostics without file locations', () => {
    const filePath = path.join(tempDir, 'sample.component.ts');
    fs.writeFileSync(filePath, 'export const sample = 1;', 'utf8');

    const configPath = path.join(tempDir, 'tsconfig.json');
    fs.writeFileSync(configPath, JSON.stringify({ compilerOptions: {}, files: 'not-an-array' }), 'utf8');

    const result = loadSourceProgram([filePath], {
      context: createContextSeed(),
      tsconfigPath: configPath,
      searchPath: tempDir,
    });

    expect(result.errors.some((error) => error.includes('Compiler option'))).toBe(true);
  });

  it('should loads source files and maps them by absolute path', () => {
    const filePath = path.join(tempDir, 'sample.component.ts');
    fs.writeFileSync(filePath, 'export class Sample {}', 'utf8');

    const result = loadSourceProgram([filePath], {
      context: createContextSeed(),
      searchPath: tempDir,
    });

    const resolved = path.resolve(filePath);
    expect(result.sourceFiles).toHaveLength(1);
    expect(result.sourceFileMap.get(resolved)).toBeDefined();
  });

  it('should reports when TypeScript cannot load a source file', () => {
    const filePath = path.join(tempDir, 'sample.unknown');
    fs.writeFileSync(filePath, 'export const sample = 1;', 'utf8');

    const result = loadSourceProgram([filePath], {
      context: createContextSeed(),
      searchPath: tempDir,
    });

    expect(result.errors.some((error) => error.includes('TypeScript could not load source file'))).toBe(true);
  });
});
