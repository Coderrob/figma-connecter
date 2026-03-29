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
 * IO Types
 *
 * Shared contracts for file discovery, writes, adapters, and source loading.
 *
 * @module io/types
 */

import type fs from "node:fs";
import type {
  IPipelineContext,
  PipelineContextSeed,
} from "@/src/pipeline/types";
import type ts from "typescript";

export interface IDiscoveredFile {
  readonly filePath: string;
  readonly relativePath: string;
  readonly fileName: string;
  readonly componentName: string;
  readonly dirPath: string;
}

export interface IFileDiscoveryOptions {
  readonly recursive?: boolean;
  readonly excludeDirs?: readonly string[];
  readonly fileSystem?: IFileDiscoveryFileSystem;
}

export interface IFileDiscoveryFileSystem {
  readonly existsSync: (targetPath: string) => boolean;
  readonly statSync: (targetPath: string) => fs.Stats;
  readonly readdirSync: (targetPath: string) => fs.Dirent[];
}

export interface IIoAdapter {
  readonly exists: (filePath: string) => boolean;
  readonly readFile: (filePath: string) => string;
  readonly writeFile: (filePath: string, content: string) => void;
  readonly stat?: (filePath: string) => {
    isFile(): boolean;
    isDirectory(): boolean;
  };
  readonly listFiles?: (dirPath: string) => string[];
}

export enum WriteStatus {
  Created = "created",
  Updated = "updated",
  Unchanged = "unchanged",
}

export interface IFileWriteResult {
  readonly filePath: string;
  readonly status: WriteStatus;
}

export interface IFileWriteOptions {
  readonly dryRun?: boolean;
  readonly io?: IIoAdapter;
  readonly section?: {
    readonly content: string;
    readonly markers?: ISectionMarkers;
  };
}

export interface ISectionMarkers {
  readonly start: string;
  readonly end: string;
}

export interface ISectionUpdateResult {
  readonly content: string;
  readonly status: SectionUpdateStatus;
}

export enum SectionUpdateStatus {
  Replaced = "replaced",
  Inserted = "inserted",
  Unchanged = "unchanged",
}

export interface ISourceLoaderOptions {
  readonly context: PipelineContextSeed;
  readonly searchPath?: string;
  readonly tsconfigPath?: string;
  readonly tsconfigFileName?: string;
}

export interface ISourceLoadResult {
  readonly context: IPipelineContext;
  readonly checker: ts.TypeChecker;
  readonly configPath?: string;
  readonly errors: readonly string[];
  readonly options: ts.CompilerOptions;
  readonly program: ts.Program;
  readonly sourceFiles: readonly ts.SourceFile[];
  readonly sourceFileMap: ReadonlyMap<string, ts.SourceFile>;
}

export type DiscoveredFile = IDiscoveredFile;
export type FileDiscoveryOptions = IFileDiscoveryOptions;
export type FileDiscoveryFileSystem = IFileDiscoveryFileSystem;
export type IoAdapter = IIoAdapter;
export type FileWriteResult = IFileWriteResult;
export type FileWriteOptions = IFileWriteOptions;
export type SectionMarkers = ISectionMarkers;
export type SectionUpdateResult = ISectionUpdateResult;
export type SourceLoaderOptions = ISourceLoaderOptions;
export type SourceLoadResult = ISourceLoadResult;
