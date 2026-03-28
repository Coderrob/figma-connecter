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

import type { ISourceLoaderOptions, ISourceLoadResult } from "@/src/types/io";

import type { IPipelineContext } from "@/src/types/pipeline";
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

/** Platform identifier for Windows. */
const WINDOWS_PLATFORM = "win32";

/**
 * Formats a TypeScript diagnostic into a human-readable string.
 *
 * @param diagnostic - Diagnostic to format.
 * @returns Formatted diagnostic string.
 */
const formatDiagnostic = (diagnostic: Readonly<ts.Diagnostic>): string => {
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
 * Validates that a file exists and is readable.
 *
 * @param filePath - Path to validate.
 * @returns Undefined when file is readable; otherwise an error message.
 */
const getReadableFileError = (filePath: string): string | undefined => {
  if (!fs.existsSync(filePath)) {
    return `Source file not found: ${filePath}`;
  }

  try {
    const mode = fs.statSync(filePath).mode;
    if ((mode & UNIX_READ_PERMISSION_MASK) === 0) {
      return `Source file is not readable: ${filePath}`;
    }

    // Windows can report R_OK even when chmod(000) is used in tests.
    // Treat missing write bits as unreadable for parity with CI expectations.
    if (
      process.platform === WINDOWS_PLATFORM &&
      (mode & UNIX_WRITE_PERMISSION_MASK) === 0
    ) {
      return `Source file is not readable: ${filePath}`;
    }

    fs.accessSync(filePath, fs.constants.R_OK);
    return undefined;
  } catch {
    return `Source file is not readable: ${filePath}`;
  }
};

// ============================================================================
// Public API
// ============================================================================

/**
 * Resolves a tsconfig path from an explicit path or search root.
 *
 * @param componentFiles - Component file paths to load into the program.
 * @param options - Source loader options.
 * @returns Source load result with program, checker, and pipeline context.
 */
export function loadSourceProgram(
  componentFiles: readonly string[],
  options: Readonly<ISourceLoaderOptions>,
): ISourceLoadResult {
  const rootNames = componentFiles.map(
    /**
     * Resolves a component file path to an absolute path.
     *
     * @param filePath - Relative or absolute file path.
     * @returns Absolute file path.
     */
    (filePath) => path.resolve(filePath),
  );

  let errors: string[] = [];
  let validFiles: string[] = [];
  for (const filePath of rootNames) {
    const readableError = getReadableFileError(filePath);
    if (readableError) {
      errors = [...errors, readableError];
    } else {
      validFiles = [...validFiles, filePath];
    }
  }

  if (rootNames.length === 0) {
    errors = [...errors, "No component files provided."];
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
    const normalizedConfigPath = configPath.replaceAll(String.raw`\\`, "/");
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
      errors = [...errors, formatDiagnostic(configFile.error)];
    } else {
      const parsed = ts.parseJsonConfigFileContent(
        configFile.config,
        ts.sys,
        path.dirname(normalizedConfigPath),
      );
      compilerOptions = parsed.options;
      errors = [...errors, ...parsed.errors.map(formatDiagnostic)];
    }
  } else if (options.tsconfigPath) {
    errors = [
      ...errors,
      `${configFileName} not found at: ${options.tsconfigPath}`,
    ];
  }

  const program = ts.createProgram({
    options: compilerOptions,
    rootNames: validFiles,
  });
  const checker = program.getTypeChecker();

  let sourceFiles: ts.SourceFile[] = [];
  for (const filePath of validFiles) {
    const sourceFile = program.getSourceFile(filePath);
    if (!sourceFile) {
      errors = [
        ...errors,
        `TypeScript could not load source file: ${filePath}`,
      ];
      continue;
    }
    sourceFiles = [...sourceFiles, sourceFile];
  }

  const sourceFileMap = new Map(
    sourceFiles.map(
      /**
       * Creates a map entry for a source file keyed by its resolved path.
       *
       * @param sourceFile - Source file to map.
       * @returns Key-value pair with resolved path and source file.
       */
      (sourceFile) => [path.resolve(sourceFile.fileName), sourceFile],
    ),
  );

  const context: IPipelineContext = {
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
 * Resolves a tsconfig path from an explicit path or a discovered config.
 *
 * @param tsconfigPath - Explicit tsconfig path, if provided.
 * @param searchPath - Path to search from when resolving tsconfig.
 * @param configFileName - Config file name to search for.
 * @returns Resolved tsconfig path or undefined when not found.
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
  const isExistingFile = (filename: string): boolean =>
    ts.sys.fileExists(filename);
  const found =
    ts.findConfigFile(searchRoot, isExistingFile, configFileName) ?? undefined;
  return found ? path.normalize(found) : undefined;
}
