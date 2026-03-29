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
 * IO Adapter Module
 *
 * Provides a minimal abstraction for file IO to simplify testing.
 *
 * @module io/adapter
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import type { IIoAdapter } from "@/src/types/io";

export type { IIoAdapter, IoAdapter } from "@/src/types/io";

/**
 * Default IO adapter backed by the Node.js filesystem.
 */
export const nodeIoAdapter: IIoAdapter = {
  /**
   * Checks whether a file exists.
   *
   * @param filePath - File path to check.
   * @returns True when the file exists.
   */
  exists: (filePath: string) => fs.existsSync(filePath),
  /**
   * Reads file contents as UTF-8.
   *
   * @param filePath - File path to read.
   * @returns File contents.
   */
  readFile: (filePath: string) => fs.readFileSync(filePath, "utf8"),
  /**
   * Writes file contents as UTF-8, creating directories as needed.
   *
   * @param filePath - File path to write.
   * @param content - File contents to write.
   * @returns Nothing.
   */
  writeFile: (filePath: string, content: string) => {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content, "utf8");
  },
  /**
   * Checks file stats.
   *
   * @param filePath - File path to stat.
   * @returns File stats object.
   */
  stat: (filePath: string) => fs.statSync(filePath),
  /**
   * Lists files in directory.
   *
   * @param dirPath - Directory path.
   * @returns Array of file names.
   */
  listFiles: (dirPath: string) => fs.readdirSync(dirPath),
};

/**
 * In-memory IO adapter for tests.
 */
export class MemoryIoAdapter implements IIoAdapter {
  private readonly files = new Map<string, string>();

  /**
   * Creates an in-memory IO adapter.
   *
   * @param initialFiles - Optional initial file contents.
   */
  constructor(initialFiles: Record<string, string> | Map<string, string> = {}) {
    if (initialFiles instanceof Map) {
      for (const [filePath, content] of initialFiles) {
        this.files.set(filePath, content);
      }
    } else {
      for (const [filePath, content] of Object.entries(initialFiles)) {
        this.files.set(filePath, content);
      }
    }
  }

  /**
   * Checks whether a file exists in memory.
   *
   * @param filePath - File path to check.
   * @returns True when the file exists.
   */
  exists = (filePath: string): boolean => this.files.has(filePath);

  /**
   * Reads file contents from memory.
   *
   * @param filePath - File path to read.
   * @returns File contents.
   * @throws Error when the requested file is not present in memory.
   */
  readFile(filePath: string): string {
    const content = this.files.get(filePath);
    if (content === undefined) {
      assert.fail(`File not found: ${filePath}`);
    }
    return content;
  }

  /**
   * Writes file contents to memory.
   *
   * @param filePath - File path to write.
   * @param content - File contents to write.
   */
  writeFile(filePath: string, content: string): void {
    this.files.set(filePath, content);
  }

  /**
   * Gets file stats from memory.
   *
   * @param {string} filePath - File path to stat.
   * @returns {object} File stats object.
   */
  stat(filePath: string) {
    const exists = this.files.has(filePath);
    return {
      /**
       * Checks if path is a file.
       *
       * @returns {boolean} True if file exists
       */
      isFile: () => exists,
      /**
       * Checks if path is a directory.
       *
       * @returns {boolean} Always false for in-memory adapter
       */
      isDirectory: () => false,
    };
  }

  /**
   * Lists files in a directory from memory.
   *
   * @param {string} dirPath - Directory path.
   * @returns {string[]} Array of file names.
   */
  listFiles(dirPath: string) {
    const prefix = dirPath.endsWith("/") ? dirPath : `${dirPath}/`;

    const files = Array.from(this.files.keys())
      .filter(isInPrefix.bind(undefined, prefix))
      .map(toFirstRemainderSegment.bind(undefined, prefix))
      .filter(isNonEmptyRemainder);
    return Array.from(new Set(files));
  }

  /**
   * Exposes stored files for assertions in tests.
   *
   * @returns Map of stored files.
   */
  getFiles(): ReadonlyMap<string, string> {
    return this.files;
  }
}

/**
 * Creates a new in-memory IO adapter.
 *
 * @param initialFiles - Optional initial file contents.
 * @returns In-memory IO adapter instance.
 */
export function createMemoryIoAdapter(
  initialFiles?: Record<string, string> | Map<string, string>,
): MemoryIoAdapter {
  return new MemoryIoAdapter(initialFiles);
}

/**
 * Checks whether a file key resides under the requested prefix.
 * @param prefix - Directory prefix.
 * @param key - In-memory file key.
 * @returns True when the key starts with the prefix.
 */
function isInPrefix(prefix: string, key: string): boolean {
  return key.startsWith(prefix);
}

/**
 * Narrows potentially empty remainder values to non-empty strings.
 * @param remainder - Potentially empty remainder segment.
 * @returns True when the segment is non-empty.
 */
function isNonEmptyRemainder(remainder: string): remainder is string {
  return Boolean(remainder);
}

/**
 * Extracts the first relative path segment after the provided prefix.
 * @param prefix - Directory prefix.
 * @param key - In-memory file key.
 * @returns First relative segment after the prefix.
 */
function toFirstRemainderSegment(prefix: string, key: string): string {
  return key.slice(prefix.length).split("/")[0];
}
