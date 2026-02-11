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

import { type IoAdapter, nodeIoAdapter } from './adapter';
import { DEFAULT_SECTION_MARKERS, replaceGeneratedSection, type SectionMarkers } from './section-updater';

/** Status of a write operation. */
export enum WriteStatus {
  Created = 'created',
  Updated = 'updated',
  Unchanged = 'unchanged',
}

/** Result of a write operation. */
export interface FileWriteResult {
  readonly filePath: string;
  readonly status: WriteStatus;
}

/** Options for write operations. */
export interface FileWriteOptions {
  /** Preview changes without writing. */
  readonly dryRun?: boolean;
  /** IO adapter for file operations. */
  readonly io?: IoAdapter;
  /** Optional section update configuration. */
  readonly section?: {
    readonly content: string;
    readonly markers?: SectionMarkers;
  };
}

/**
 * Writes a file to disk, updating generated sections if configured.
 *
 * @param filePath - Destination path.
 * @param content - Full file contents to write when creating a new file.
 * @param options - Write options.
 * @returns Write result with status and file path.
 */
export function writeFile(filePath: string, content: string, options: FileWriteOptions = {}): FileWriteResult {
  const dryRun = options.dryRun ?? false;
  const io = options.io ?? nodeIoAdapter;
  const exists = io.exists(filePath);

  if (!exists) {
    if (!dryRun) {
      io.writeFile(filePath, content);
    }

    return { filePath, status: WriteStatus.Created };
  }

  const existingContent = io.readFile(filePath);
  let updatedContent = content;

  if (options.section) {
    const markers = options.section.markers ?? DEFAULT_SECTION_MARKERS;
    const result = replaceGeneratedSection(existingContent, options.section.content, markers);
    updatedContent = result.content;
  }

  if (existingContent === updatedContent) {
    return { filePath, status: WriteStatus.Unchanged };
  }

  if (!dryRun) {
    io.writeFile(filePath, updatedContent);
  }

  return { filePath, status: WriteStatus.Updated };
}
