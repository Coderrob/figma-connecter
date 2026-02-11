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
 * IO Module Index
 *
 * Re-exports IO utilities for discovery, loading, and writing.
 *
 * @module io
 */

export type { IoAdapter } from './adapter';
export { createMemoryIoAdapter, MemoryIoAdapter, nodeIoAdapter } from './adapter';
export type { DiscoveredFile, FileDiscoveryFileSystem, FileDiscoveryOptions } from './file-discovery';
export {
  COMPONENT_GLOB,
  COMPONENT_SUFFIX,
  DEFAULT_EXCLUDE_DIRS,
  discoverComponentFiles,
  isComponentFile,
} from './file-discovery';
export type { FileWriteOptions, FileWriteResult, WriteStatus } from './file-writer';
export { writeFile } from './file-writer';
export type { SectionMarkers, SectionUpdateResult } from './section-updater';
export {
  applyGeneratedSectionUpdates,
  buildGeneratedSection,
  DEFAULT_SECTION_MARKERS,
  extractGeneratedSection,
  hasGeneratedSection,
  replaceGeneratedSection,
} from './section-updater';
export type { SourceLoaderOptions, SourceLoadResult } from './source-loader';
export { loadSourceProgram, resolveTsconfigPath } from './source-loader';
