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

import fs from 'node:fs';
import path from 'node:path';

/** File suffix for component source files. */
export const COMPONENT_SUFFIX = '.component.ts';

/** Glob pattern for component discovery. */
export const COMPONENT_GLOB = `**/*${COMPONENT_SUFFIX}`;

/** Default directory names to exclude from traversal. */
export const DEFAULT_EXCLUDE_DIRS = ['node_modules', 'dist'] as const;

/** Metadata for a discovered component file. */
export interface DiscoveredFile {
  /** Absolute path to the component file. */
  readonly filePath: string;
  /** Path relative to the discovery root. */
  readonly relativePath: string;
  /** File name including extension. */
  readonly fileName: string;
  /** Component name inferred from the file name. */
  readonly componentName: string;
  /** Directory containing the file. */
  readonly dirPath: string;
}

/** Options for component discovery. */
export interface FileDiscoveryOptions {
  /** Whether to traverse subdirectories. */
  readonly recursive?: boolean;
  /** Directory names to exclude. */
  readonly excludeDirs?: readonly string[];
  /** Optional file system provider for testing. */
  readonly fileSystem?: FileDiscoveryFileSystem;
}

/** File system provider interface for discovery. */
export interface FileDiscoveryFileSystem {
  readonly existsSync: (targetPath: string) => boolean;
  readonly statSync: (targetPath: string) => fs.Stats;
  readonly readdirSync: (targetPath: string) => fs.Dirent[];
}

/** Default file system provider using Node.js fs. */
const defaultFileSystem: FileDiscoveryFileSystem = {
  existsSync: fs.existsSync,
  statSync: fs.statSync,
  /**
   * Reads a directory and returns dirent entries.
   *
   * @param targetPath - Directory path to read.
   * @returns Directory entries for the path.
   */
  readdirSync: (targetPath: string) => fs.readdirSync(targetPath, { withFileTypes: true }),
};

/**
 * Determines if a file path matches the component pattern.
 *
 * @param filePath - File path to check.
 * @returns True when the path ends with the component suffix.
 */
export const isComponentFile = (filePath: string): boolean => filePath.toLowerCase().endsWith(COMPONENT_SUFFIX);

/**
 * Discovers component files from a file or directory path.
 *
 * @param inputPath - File or directory path to scan.
 * @param options - Discovery options.
 * @returns Array of discovered component metadata.
 */
export function discoverComponentFiles(inputPath: string, options: FileDiscoveryOptions = {}): DiscoveredFile[] {
  if (!inputPath) {
    return [];
  }

  const fileSystem = options.fileSystem ?? defaultFileSystem;
  const resolvedPath = path.resolve(inputPath);

  if (!fileSystem.existsSync(resolvedPath)) {
    return [];
  }

  const excludeDirs = new Set((options.excludeDirs ?? DEFAULT_EXCLUDE_DIRS).map((dir) => dir.toLowerCase()));
  const recursive = options.recursive ?? false;
  const results: DiscoveredFile[] = [];

  const stats = fileSystem.statSync(resolvedPath);
  const rootDir = stats.isDirectory() ? resolvedPath : path.dirname(resolvedPath);

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

    results.push({
      filePath,
      relativePath,
      fileName,
      componentName,
      dirPath,
    });
  };

  /**
   * Traverses a directory tree to discover component files.
   *
   * @param dirPath - Directory path to traverse.
   * @returns Nothing.
   */
  const traverse = (dirPath: string): void => {
    for (const entry of fileSystem.readdirSync(dirPath)) {
      const entryPath = path.join(dirPath, entry.name);

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
    addFile(resolvedPath);
  } else if (stats.isDirectory()) {
    traverse(resolvedPath);
  }

  return results.sort((a, b) => a.filePath.localeCompare(b.filePath));
}
