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

import fs from "node:fs";
import path from "node:path";

import type { PipelineContext } from '@/src/types/pipeline';

import type { SourceLoaderOptions, SourceLoadResult } from '@/src/types/io';
import ts from "typescript";

// ============================================================================
// Constants
// ============================================================================

// ============================================================================
// Private Helper Functions
// ============================================================================

/** Unix read permission bits for owner, group, and others (r--r--r--). */
const UNIX_READ_PERMISSION_MASK = 0o444;

/** Unix write permission bits for owner, group, and others (-w--w--w-). */
const UNIX_WRITE_PERMISSION_MASK = 0o222;

/**
 * Validates that a file exists and is readable.
 *
 * @param filePath - Path to validate.
 * @param errors - Error collection to append to.
 * @param diagnostic
 * @returns True when the file is readable.
 */
const formatDiagnostic = (diagnostic: ts.Diagnostic): string => {
  const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n");
  if (diagnostic.file && diagnostic.start !== undefined) {
    const location = diagnostic.file.getLineAndCharacterOfPosition(
      diagnostic.start,
    );
    return `${diagnostic.file.fileName}:${location.line + 1}:${location.character + 1} - ${message}`;
  }
  return message;
};

/**
 * Formats a TypeScript diagnostic into a human-readable string.
 *
 * @param diagnostic - Diagnostic to format.
 * @param filePath
 * @param errors
 * @returns Formatted diagnostic string.
 */
const isReadableFile = (filePath: string, errors: string[]): boolean => {
  if (!fs.existsSync(filePath)) {
    errors.push(`Source file not found: ${filePath}`);
    return false;
  }

  try {
    const mode = fs.statSync(filePath).mode;
    if ((mode & UNIX_READ_PERMISSION_MASK) === 0) {
      errors.push(`Source file is not readable: ${filePath}`);
      return false;
    }

    // Windows can report R_OK even when chmod(000) is used in tests.
    // Treat missing write bits as unreadable for parity with CI expectations.
    if (process.platform === "win32" && (mode & UNIX_WRITE_PERMISSION_MASK) === 0) {
      errors.push(`Source file is not readable: ${filePath}`);
      return false;
    }

    fs.accessSync(filePath, fs.constants.R_OK);
    return true;
  } catch {
    errors.push(`Source file is not readable: ${filePath}`);
    return false;
  }
};

// ============================================================================
// Public API
// ============================================================================

/**
 * Resolves a tsconfig path from an explicit path or search root.
 *
 * @param tsconfigPath - Explicit tsconfig path, if provided.
 * @param searchPath - Path to search from when resolving tsconfig.
 * @param configFileName - Config file name to search for (defaults to "tsconfig.json").
 * @param componentFiles
 * @param options
 * @returns Resolved tsconfig path or undefined when not found.
 */
export function loadSourceProgram(
  componentFiles: readonly string[],
  options: SourceLoaderOptions,
): SourceLoadResult {
  const errors: string[] = [];
  const rootNames: string[] = [];
  for (const filePath of componentFiles) {
    rootNames.push(path.resolve(filePath));
  }
  const validFiles: string[] = [];
  for (const filePath of rootNames) {
    if (isReadableFile(filePath, errors)) {
      validFiles.push(filePath);
    }
  }

  if (rootNames.length === 0) {
    errors.push("No component files provided.");
  }

  const searchPath =
    options.searchPath ??
    (validFiles[0] ? path.dirname(validFiles[0]) : process.cwd());
  const configFileName = options.tsconfigFileName ?? "tsconfig.json";
  const configPath = resolveTsconfigPath(
    options.tsconfigPath,
    searchPath,
    configFileName,
  );

  let compilerOptions = ts.getDefaultCompilerOptions();

  if (configPath) {
    const normalizedConfigPath = configPath.replaceAll("\\", "/");
    /**
     * Reads a file from the file system.
     *
     * @param {string} filePath - Path to the file to read.
     * @returns {string | undefined} File contents as a string, or undefined if the file cannot be read.
     */
    const readFile = (filePath: string): string | undefined =>
      ts.sys.readFile(filePath);
    const configFile = ts.readConfigFile(normalizedConfigPath, readFile);
    if (configFile.error) {
      errors.push(formatDiagnostic(configFile.error));
    } else {
      const parsed = ts.parseJsonConfigFileContent(
        configFile.config,
        ts.sys,
        path.dirname(normalizedConfigPath),
      );
      compilerOptions = parsed.options;
      for (const diagnostic of parsed.errors) {
        errors.push(formatDiagnostic(diagnostic));
      }
    }
  } else if (options.tsconfigPath) {
    errors.push(`${configFileName} not found at: ${options.tsconfigPath}`);
  }

  const program = ts.createProgram({
    options: compilerOptions,
    rootNames: validFiles,
  });
  const checker = program.getTypeChecker();

  const sourceFiles: ts.SourceFile[] = [];
  for (const filePath of validFiles) {
    const sourceFile = program.getSourceFile(filePath);
    if (!sourceFile) {
      errors.push(`TypeScript could not load source file: ${filePath}`);
      continue;
    }
    sourceFiles.push(sourceFile);
  }

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

/**
 * Loads a TypeScript Program from the provided component files.
 *
 * @param componentFiles - Component file paths.
 * @param options - Loader options.
 * @param tsconfigPath
 * @param searchPath
 * @param configFileName
 * @returns Source load result with program, checker, and context.
 */
export function resolveTsconfigPath(
  tsconfigPath: string | undefined,
  searchPath: string,
  configFileName: string = "tsconfig.json",
): string | undefined {
  if (tsconfigPath) {
    const resolved = path.isAbsolute(tsconfigPath)
      ? tsconfigPath
      : path.resolve(searchPath, tsconfigPath);

    return fs.existsSync(resolved) ? path.normalize(resolved) : undefined;
  }

  const searchRoot =
    fs.existsSync(searchPath) && fs.statSync(searchPath).isDirectory()
      ? searchPath
      : path.dirname(searchPath);

  /**
   * Checks if a file exists.
   *
   * @param filename - Path to the file.
   * @returns True if the file exists, false otherwise.
   */
  const fileExists = (filename: string): boolean => ts.sys.fileExists(filename);
  const found =
    ts.findConfigFile(searchRoot, fileExists, configFileName) ?? undefined;
  return found ? path.normalize(found) : undefined;
}
