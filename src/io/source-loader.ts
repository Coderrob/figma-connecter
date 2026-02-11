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
 * Source Loader Module
 *
 * Creates a TypeScript Program and TypeChecker from component files.
 *
 * @module io/source-loader
 */

import fs from 'node:fs';
import path from 'node:path';

import ts from 'typescript';

import type { PipelineContext, PipelineContextSeed } from '../pipeline/context';

// ============================================================================
// Types
// ============================================================================

/** Options for loading TypeScript source files. */
export interface SourceLoaderOptions {
  /** Pipeline context to enrich with TypeScript source data. */
  readonly context: PipelineContextSeed;
  /** Optional search path for locating tsconfig.json. */
  readonly searchPath?: string;
  /** Optional explicit tsconfig path. */
  readonly tsconfigPath?: string;
}

/** Result of loading TypeScript sources. */
export interface SourceLoadResult {
  readonly context: PipelineContext;
  readonly checker: ts.TypeChecker;
  readonly configPath?: string;
  readonly errors: readonly string[];
  readonly options: ts.CompilerOptions;
  readonly program: ts.Program;
  readonly sourceFiles: readonly ts.SourceFile[];
  readonly sourceFileMap: ReadonlyMap<string, ts.SourceFile>;
}

// ============================================================================
// Private Helper Functions
// ============================================================================

/**
 * Validates that a file exists and is readable.
 *
 * @param filePath - Path to validate.
 * @param errors - Error collection to append to.
 * @returns True when the file is readable.
 */
const isReadableFile = (filePath: string, errors: string[]): boolean => {
  if (!fs.existsSync(filePath)) {
    errors.push(`Source file not found: ${filePath}`);
    return false;
  }

  try {
    fs.accessSync(filePath, fs.constants.R_OK);
    return true;
  } catch {
    errors.push(`Source file is not readable: ${filePath}`);
    return false;
  }
};

/**
 * Formats a TypeScript diagnostic into a human-readable string.
 *
 * @param diagnostic - Diagnostic to format.
 * @returns Formatted diagnostic string.
 */
const formatDiagnostic = (diagnostic: ts.Diagnostic): string => {
  const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
  if (diagnostic.file && diagnostic.start !== undefined) {
    const location = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
    return `${diagnostic.file.fileName}:${location.line + 1}:${location.character + 1} - ${message}`;
  }
  return message;
};

// ============================================================================
// Public API
// ============================================================================

/**
 * Resolves a tsconfig.json path from an explicit path or search root.
 *
 * @param tsconfigPath - Explicit tsconfig path, if provided.
 * @param searchPath - Path to search from when resolving tsconfig.
 * @returns Resolved tsconfig path or undefined when not found.
 */
export function resolveTsconfigPath(tsconfigPath: string | undefined, searchPath: string): string | undefined {
  if (tsconfigPath) {
    const resolved = path.isAbsolute(tsconfigPath) ? tsconfigPath : path.resolve(searchPath, tsconfigPath);

    return fs.existsSync(resolved) ? resolved : undefined;
  }

   
  const searchRoot =
    fs.existsSync(searchPath) && fs.statSync(searchPath).isDirectory() ? searchPath : path.dirname(searchPath);

  /**
   * Checks if a file exists.
   *
   * @param filename - Path to the file.
   * @returns True if the file exists, false otherwise.
   */
  const fileExists = (filename: string): boolean => ts.sys.fileExists(filename);
  return ts.findConfigFile(searchRoot, fileExists, 'tsconfig.json') ?? undefined;
}

/**
 * Loads a TypeScript Program from the provided component files.
 *
 * @param componentFiles - Component file paths.
 * @param options - Loader options.
 * @returns Source load result with program, checker, and context.
 */
export function loadSourceProgram(componentFiles: readonly string[], options: SourceLoaderOptions): SourceLoadResult {
  const errors: string[] = [];
  const rootNames = componentFiles.map((filePath) => path.resolve(filePath));
  const validFiles = rootNames.filter((filePath) => isReadableFile(filePath, errors));

  if (rootNames.length === 0) {
    errors.push('No component files provided.');
  }

  const searchPath = options.searchPath ?? (validFiles[0] ? path.dirname(validFiles[0]) : process.cwd());
  const configPath = resolveTsconfigPath(options.tsconfigPath, searchPath);

  let compilerOptions = ts.getDefaultCompilerOptions();

  if (configPath) {
    /**
     * Reads a file from the file system.
     *
     * @param path - Path to the file to read.
     * @returns File contents as a string, or undefined if the file cannot be read.
     */
    const readFile = (path: string): string | undefined => ts.sys.readFile(path);
    const configFile = ts.readConfigFile(configPath, readFile);
    if (configFile.error) {
      errors.push(formatDiagnostic(configFile.error));
    } else {
      const parsed = ts.parseJsonConfigFileContent(configFile.config, ts.sys, path.dirname(configPath));
      compilerOptions = parsed.options;
      parsed.errors.forEach((diagnostic) => errors.push(formatDiagnostic(diagnostic)));
    }
  } else if (options.tsconfigPath) {
    errors.push(`tsconfig.json not found at: ${options.tsconfigPath}`);
  }

  const program = ts.createProgram({
    options: compilerOptions,
    rootNames: validFiles,
  });
  const checker = program.getTypeChecker();

  const sourceFiles = validFiles.flatMap((filePath) => {
    const sourceFile = program.getSourceFile(filePath);
    if (!sourceFile) {
      errors.push(`TypeScript could not load source file: ${filePath}`);
      return [];
    }
    return [sourceFile];
  });

  const sourceFileMap = new Map<string, ts.SourceFile>();
  for (const sourceFile of sourceFiles) {
    sourceFileMap.set(path.resolve(sourceFile.fileName), sourceFile);
  }

  const context: PipelineContext = {
    ...options.context,
    checker,
    sourceFileMap,
  };

  return {
    context,
    checker,
    configPath,
    errors,
    options: compilerOptions,
    program,
    sourceFiles,
    sourceFileMap,
  };
}
