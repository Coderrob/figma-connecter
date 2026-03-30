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

import type { ISourceLoaderOptions, ISourceLoadResult } from "@/src/io/types";
import type { IPipelineContext, PipelineContextSeed } from "@/src/pipeline/types";
import ts from "typescript";

export type {
  ISourceLoadResult,
  ISourceLoaderOptions,
  SourceLoadResult,
  SourceLoaderOptions,
} from "@/src/io/types";

/** Unix read permission bits for owner, group, and others (r--r--r--). */
const UNIX_READ_PERMISSION_MASK = 0o444;

interface IParsedTsconfigFileSuccess {
  readonly config: Readonly<Record<string, unknown>>;
}

interface IParsedTsconfigFileError {
  readonly error: string;
}

interface IRootFileResolution {
  readonly rootNames: readonly string[];
  readonly validFiles: readonly string[];
  readonly errors: readonly string[];
}

interface ICompilerOptionsResolution {
  readonly compilerOptions: ts.CompilerOptions;
  readonly configPath: string | undefined;
  readonly errors: readonly string[];
}

interface ISourceFilesResolution {
  readonly sourceFiles: readonly ts.SourceFile[];
  readonly errors: readonly string[];
}

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

    fs.accessSync(filePath, fs.constants.R_OK);
    return undefined;
  } catch {
    return `Source file is not readable: ${filePath}`;
  }
};

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
  const rootFileResolution = resolveRootFiles(componentFiles);
  const searchPath = resolveSourceSearchPath(
    options.searchPath,
    rootFileResolution.validFiles,
  );
  const compilerResolution = resolveCompilerOptions(searchPath, options);
  const errors = [
    ...rootFileResolution.errors,
    ...compilerResolution.errors,
  ];

  const program = ts.createProgram({
    options: compilerResolution.compilerOptions,
    rootNames: [...rootFileResolution.validFiles],
  });
  const checker = program.getTypeChecker();
  const sourceFileResolution = collectProgramSourceFiles(
    program,
    rootFileResolution.validFiles,
  );
  const sourceFileMap = createSourceFileMap(sourceFileResolution.sourceFiles);
  const context = createPipelineContext(options.context, checker, sourceFileMap);

  return {
    context,
    checker,
    configPath: compilerResolution.configPath,
    errors: [...errors, ...sourceFileResolution.errors],
    options: compilerResolution.compilerOptions,
    program,
    sourceFiles: [...sourceFileResolution.sourceFiles],
    sourceFileMap,
  };
}

/**
 * Resolves component file inputs to absolute root names and readable files.
 *
 * @param componentFiles - Component file paths provided by the caller.
 * @returns Normalized root names, readable files, and validation errors.
 */
function resolveRootFiles(
  componentFiles: readonly string[],
): IRootFileResolution {
  const rootNames = componentFiles.map(resolveRootFilePath);
  let errors: string[] = [];
  let validFiles: string[] = [];

  for (const filePath of rootNames) {
    const readableError = getReadableFileError(filePath);
    if (readableError) {
      errors = [...errors, readableError];
      continue;
    }

    validFiles = [...validFiles, filePath];
  }

  if (rootNames.length === 0) {
    errors = [...errors, "No component files provided."];
  }

  return {
    rootNames,
    validFiles,
    errors,
  };
}

/**
 * Resolves a component file path to an absolute root name.
 *
 * @param filePath - Relative or absolute file path.
 * @returns Absolute file path.
 */
function resolveRootFilePath(filePath: string): string {
  return path.resolve(filePath);
}

/**
 * Resolves the search path used for tsconfig discovery.
 *
 * @param searchPath - Explicit search path, if provided.
 * @param validFiles - Readable component files available for loading.
 * @returns Search path used for tsconfig resolution.
 */
function resolveSourceSearchPath(
  searchPath: string | undefined,
  validFiles: readonly string[],
): string {
  if (searchPath) {
    return searchPath;
  }

  return validFiles[0] ? path.dirname(validFiles[0]) : process.cwd();
}

/**
 * Resolves compiler options from tsconfig inputs and discovery settings.
 *
 * @param searchPath - Path used for tsconfig discovery.
 * @param options - Source loader options.
 * @returns Compiler options, resolved config path, and any config-related errors.
 */
function resolveCompilerOptions(
  searchPath: string,
  options: Readonly<ISourceLoaderOptions>,
): ICompilerOptionsResolution {
  const configFileName = options.tsconfigFileName ?? "tsconfig.json";
  const configPath = resolveTsconfigPath(
    options.tsconfigPath,
    searchPath,
    configFileName,
  );

  if (!configPath) {
    return {
      compilerOptions: ts.getDefaultCompilerOptions(),
      configPath,
      errors: options.tsconfigPath
        ? [`${configFileName} not found at: ${options.tsconfigPath}`]
        : [],
    };
  }

  return parseCompilerOptionsFromTsconfig(configPath);
}

/**
 * Parses compiler options from a resolved tsconfig path.
 *
 * @param configPath - Absolute tsconfig path.
 * @returns Parsed compiler options, config path, and any diagnostics.
 */
function parseCompilerOptionsFromTsconfig(
  configPath: string,
): ICompilerOptionsResolution {
  const configFile = readTsconfigFile(configPath);
  if ("error" in configFile) {
    return {
      compilerOptions: ts.getDefaultCompilerOptions(),
      configPath,
      errors: [configFile.error],
    };
  }

  const parsed = ts.parseJsonConfigFileContent(
    configFile.config,
    ts.sys,
    path.dirname(configPath),
  );

  return {
    compilerOptions: parsed.options,
    configPath,
    errors: parsed.errors.map(formatDiagnostic),
  };
}

/**
 * Collects source files from a TypeScript program for the requested root names.
 *
 * @param program - TypeScript program containing loaded sources.
 * @param validFiles - Readable root names requested for the program.
 * @returns Loaded source files and any missing-source diagnostics.
 */
function collectProgramSourceFiles(
  program: Readonly<ts.Program>,
  validFiles: readonly string[],
): ISourceFilesResolution {
  let sourceFiles: ts.SourceFile[] = [];
  let errors: string[] = [];

  for (const filePath of validFiles) {
    const sourceFile = program.getSourceFile(filePath);
    if (!sourceFile) {
      errors = [...errors, `TypeScript could not load source file: ${filePath}`];
      continue;
    }

    sourceFiles = [...sourceFiles, sourceFile];
  }

  return {
    sourceFiles,
    errors,
  };
}

/**
 * Builds a source-file map keyed by resolved file path.
 *
 * @param sourceFiles - Source files to index.
 * @returns Map of resolved file paths to source files.
 */
function createSourceFileMap(
  sourceFiles: readonly ts.SourceFile[],
): Map<string, ts.SourceFile> {
  return new Map(
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
}

/**
 * Creates the pipeline context returned from source loading.
 *
 * @param baseContext - Shared pipeline context seed.
 * @param checker - Type checker for the loaded program.
 * @param sourceFileMap - Loaded source files keyed by resolved path.
 * @returns Pipeline context enriched with source-program data.
 */
function createPipelineContext(
  baseContext: Readonly<PipelineContextSeed>,
  checker: Readonly<ts.TypeChecker>,
  sourceFileMap: Readonly<Map<string, ts.SourceFile>>,
): IPipelineContext {
  return {
    ...baseContext,
    checker,
    sourceFileMap,
  };
}

/**
 * Reads and parses a TypeScript config file using the native filesystem path.
 *
 * @param configPath - Absolute tsconfig path.
 * @returns Parsed tsconfig object or a diagnostic error.
 */
function readTsconfigFile(
  configPath: string,
): IParsedTsconfigFileSuccess | IParsedTsconfigFileError {
  const contents = fs.readFileSync(configPath, "utf8");
  try {
    const parsed: unknown = JSON.parse(contents);
    if (!isJsonObject(parsed)) {
      return {
        error: `${configPath}: tsconfig root must be a JSON object.`,
      };
    }

    return { config: parsed };
  } catch (error) {
    return {
      error: `${configPath}: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Returns true when a parsed JSON value is an object suitable for tsconfig content.
 *
 * @param value - Parsed JSON value.
 * @returns True when the value is a non-null object and not an array.
 */
function isJsonObject(
  value: unknown,
): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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
   * Checks whether a candidate config file exists.
   *
   * @param filename - Path to the candidate config file.
   * @returns True when the file exists.
   */
  const isExistingFile = (filename: string): boolean =>
    ts.sys.fileExists(filename);
  const found =
    ts.findConfigFile(searchRoot, isExistingFile, configFileName) ?? undefined;
  return found ? path.normalize(found) : undefined;
}
