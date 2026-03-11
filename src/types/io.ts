/**
 * IO-related shared types
 */

import type {
  PipelineContext,
  PipelineContextSeed,
} from "@/src/types/pipeline";
import type fs from "fs";

import type ts from "typescript";

export interface DiscoveredFile {
  readonly filePath: string;
  readonly relativePath: string;
  readonly fileName: string;
  readonly componentName: string;
  readonly dirPath: string;
}

export interface FileDiscoveryOptions {
  readonly recursive?: boolean;
  readonly excludeDirs?: readonly string[];
  readonly fileSystem?: FileDiscoveryFileSystem;
}

export interface FileDiscoveryFileSystem {
  readonly existsSync: (targetPath: string) => boolean;
  readonly statSync: (targetPath: string) => fs.Stats;
  readonly readdirSync: (targetPath: string) => fs.Dirent[];
}

export interface IoAdapter {
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

export interface FileWriteResult {
  readonly filePath: string;
  readonly status: WriteStatus;
}

export interface FileWriteOptions {
  readonly dryRun?: boolean;
  readonly io?: IoAdapter;
  readonly section?: {
    readonly content: string;
    readonly markers?: SectionMarkers;
  };
}

export interface SectionMarkers {
  readonly start: string;
  readonly end: string;
}

export interface SectionUpdateResult {
  readonly content: string;
  readonly status: SectionUpdateStatus;
}

export enum SectionUpdateStatus {
  Replaced = "replaced",
  Inserted = "inserted",
  Unchanged = "unchanged",
}

export interface SourceLoaderOptions {
  readonly context: PipelineContextSeed;
  readonly searchPath?: string;
  readonly tsconfigPath?: string;
  readonly tsconfigFileName?: string;
}

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
