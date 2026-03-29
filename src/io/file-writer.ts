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
 * File Writer Module
 *
 * Writes generated output to disk with support for dry-run and
 * section-based updates.
 *
 * @module io/file-writer
 */

import {
  WriteStatus,
  type IFileWriteOptions,
  type IFileWriteResult,
} from "@/src/io/types";
import { nodeIoAdapter } from "./adapter";
import {
  DEFAULT_SECTION_MARKERS,
  replaceGeneratedSection,
} from "./section-updater";

export type {
  FileWriteOptions,
  FileWriteResult,
  IFileWriteOptions,
  IFileWriteResult,
} from "@/src/io/types";
export { WriteStatus } from "@/src/io/types";

/**
 * Writes a file to disk, updating generated sections if configured.
 *
 * @param filePath - Destination path.
 * @param content - Full file contents to write when creating a new file.
 * @param options - Write options.
 * @returns Write result with status and file path.
 */
export function writeFile(
  filePath: string,
  content: string,
  options: Readonly<IFileWriteOptions> = {},
): IFileWriteResult {
  const dryRun = options.dryRun ?? false;
  const io = options.io ?? nodeIoAdapter;
  if (!io.exists(filePath)) {
    if (!dryRun) {
      io.writeFile(filePath, content);
    }
    return { filePath, status: WriteStatus.Created };
  }

  const existingContent = io.readFile(filePath);
  const updatedContent = options.section
    ? replaceGeneratedSection(
        existingContent,
        options.section.content,
        options.section.markers ?? DEFAULT_SECTION_MARKERS,
      ).content
    : content;

  if (existingContent === updatedContent) {
    return { filePath, status: WriteStatus.Unchanged };
  }
  if (!dryRun) {
    io.writeFile(filePath, updatedContent);
  }
  return { filePath, status: WriteStatus.Updated };
}
