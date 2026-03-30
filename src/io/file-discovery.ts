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
 * File Discovery Module
 *
 * Locates Web Component source files for processing.
 *
 * @module io/file-discovery
 */

import fs from "node:fs";
import path from "node:path";
import type {
  IDiscoveredFile,
  IFileDiscoveryOptions,
  IFileDiscoveryFileSystem,
} from "@/src/io/types";
import { POSIX_PATH_SEPARATOR } from "@/src/utils";

export type {
  DiscoveredFile,
  FileDiscoveryFileSystem,
  FileDiscoveryOptions,
  IDiscoveredFile,
  IFileDiscoveryFileSystem,
  IFileDiscoveryOptions,
} from "@/src/io/types";

/** File suffix for component source files. */
export const COMPONENT_SUFFIX = ".component.ts";

/** Glob pattern for component discovery. */
export const COMPONENT_GLOB = `**/*${COMPONENT_SUFFIX}`;

/** Default directory names to exclude from traversal. */
export const DEFAULT_EXCLUDE_DIRS: readonly string[] = ["node_modules", "dist"];

/** Default file system provider using Node.js fs. */
const defaultFileSystem: IFileDiscoveryFileSystem = {
  existsSync: fs.existsSync,
  statSync: fs.statSync,
  /**
   * Reads a directory and returns dirent entries.
   *
   * @param targetPath - Directory path to read.
   * @returns Directory entries for the path.
   */
  readdirSync: (targetPath: string) =>
    fs.readdirSync(targetPath, { withFileTypes: true }),
};

/**
 * Sorts discovered files by file path for deterministic output.
 * @param left - Left discovered file.
 * @param right - Right discovered file.
 * @returns Comparison result.
 */
function compareDiscoveredFiles(
  left: Readonly<IDiscoveredFile>,
  right: Readonly<IDiscoveredFile>,
): number {
  return left.filePath.localeCompare(right.filePath);
}

/**
 * Discovers component source files from a file path or directory path.
 *
 * When the input is a file, the file is returned only when it matches
 * the component naming convention. When the input is a directory, the
 * directory is scanned and optionally traversed recursively.
 *
 * @param inputPath - File or directory path to inspect.
 * @param options - Discovery options controlling recursion, exclusions, and filesystem access.
 * @returns Sorted list of discovered component files.
 */
export function discoverComponentFiles(
  inputPath: string,
  options: Readonly<IFileDiscoveryOptions> = {},
): IDiscoveredFile[] {
  if (!inputPath) {
    return [];
  }

  const fileSystem = options.fileSystem ?? defaultFileSystem;
  const targetPath = inputPath;

  if (!fileSystem.existsSync(targetPath)) {
    return [];
  }

  const excludeDirs = new Set(
    (options.excludeDirs ?? DEFAULT_EXCLUDE_DIRS).map(normalizeDirectoryName),
  );
  const recursive = options.recursive ?? false;
  let results: IDiscoveredFile[] = [];

  const stats = fileSystem.statSync(targetPath);
  const rootDir = stats.isDirectory() ? targetPath : path.dirname(targetPath);

  /**
   * Adds a matching component file to the results list.
   *
   * @param filePath - File path to evaluate and add.
   * @returns Nothing.
   */
  const addFile = (filePath: string): void => {
    if (!isComponentFile(filePath)) {
      return;
    }

    const fileName = path.basename(filePath);
    const componentName = path.basename(filePath, COMPONENT_SUFFIX);
    const dirPath = path.dirname(filePath);
    const relativePath = path.relative(rootDir, filePath) || fileName;

    results = [
      ...results,
      {
        filePath,
        relativePath,
        fileName,
        componentName,
        dirPath,
      },
    ];
  };

  /**
   * Traverses a directory tree to discover component files.
   *
   * @param dirPath - Directory path to traverse.
   * @returns Nothing.
   */
  const traverse = (dirPath: string): void => {
    for (const entry of fileSystem.readdirSync(dirPath)) {
      const entryPath = dirPath.includes(POSIX_PATH_SEPARATOR)
        ? path.posix.join(dirPath, entry.name)
        : path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        if (excludeDirs.has(entry.name.toLowerCase())) {
          continue;
        }
        if (recursive) {
          traverse(entryPath);
        }
        continue;
      }

      if (entry.isFile()) {
        addFile(entryPath);
      }
    }
  };

  if (stats.isFile()) {
    addFile(targetPath);
  } else if (stats.isDirectory()) {
    traverse(targetPath);
  }

  return results.toSorted(compareDiscoveredFiles);
}

/**
 * Checks whether the provided file path matches the component suffix.
 *
 * @param filePath - File path to evaluate.
 * @returns True when the file path ends with the component suffix.
 */
export function isComponentFile(filePath: string): boolean {
  return filePath.toLowerCase().endsWith(COMPONENT_SUFFIX);
}

/**
 * Normalizes directory names for exclusion checks.
 * @param directoryName - Directory name to normalize.
 * @returns Normalized lowercase directory name.
 */
function normalizeDirectoryName(directoryName: string): string {
  return directoryName.toLowerCase();
}
