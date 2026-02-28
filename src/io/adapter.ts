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

import fs from "node:fs";
import path from "node:path";
import type { IoAdapter } from "../types/io";

/**
 * Default IO adapter backed by the Node.js filesystem.
 */
export const nodeIoAdapter: IoAdapter = {
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
  stat: (filePath: string) => fs.statSync(filePath),
  listFiles: (dirPath: string) => fs.readdirSync(dirPath),
};

/**
 * In-memory IO adapter for tests.
 */
export class MemoryIoAdapter implements IoAdapter {
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
   */
  readFile(filePath: string): string {
    const content = this.files.get(filePath);
    if (content === undefined) {
      throw new Error(`File not found: ${filePath}`);
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

  stat(filePath: string) {
    const exists = this.files.has(filePath);
    return {
      isFile: () => exists,
      isDirectory: () => false,
    };
  }

  listFiles(dirPath: string) {
    const prefix = dirPath.endsWith("/") ? dirPath : `${dirPath}/`;
    const files: string[] = [];
    for (const key of this.files.keys()) {
      if (key.startsWith(prefix)) {
        const remainder = key.slice(prefix.length).split("/")[0];
        if (remainder) files.push(remainder);
      }
    }
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
export const createMemoryIoAdapter = (
  initialFiles?: Record<string, string> | Map<string, string>,
): MemoryIoAdapter => new MemoryIoAdapter(initialFiles);
