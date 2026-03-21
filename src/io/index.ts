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
 * @module io
 */

export {
  createMemoryIoAdapter,
  MemoryIoAdapter,
  nodeIoAdapter,
} from "./adapter";
export {
  COMPONENT_GLOB,
  COMPONENT_SUFFIX,
  DEFAULT_EXCLUDE_DIRS,
  discoverComponentFiles,
  isComponentFile,
} from "./file-discovery";
export { writeFile } from "./file-writer";
export {
  applyGeneratedSectionUpdates,
  buildGeneratedSection,
  DEFAULT_SECTION_MARKERS,
  extractGeneratedSection,
  hasGeneratedSection,
  replaceGeneratedSection,
} from "./section-updater";
export { loadSourceProgram, resolveTsconfigPath } from "./source-loader";
