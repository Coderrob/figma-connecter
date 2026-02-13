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
 * Emitter Utilities Module
 *
 * Barrel export module that consolidates emitter utilities.
 * Functionality extracted into focused modules for better maintainability.
 *
 * @module emitters/utils
 */

// Re-export constants
export { buildGeneratedSectionMarkers, GENERATED_SECTION_MARKERS } from '../core/constants';

// Re-export from formatting module
export { formatPropAccessor, formatPropKey, indent, indentBlock, isValidIdentifier, toTitleCase } from './formatting';

// Re-export from figma-mapper module
export { getComponentBaseName, mapPropToFigma, sortByName, type FigmaPropMapping } from './figma-mapper';

// Re-export from section-builder module
export {
  buildEventsSection,
  buildExampleTemplate,
  buildPropsSection,
  buildReactExampleSection,
  type ExampleTemplate,
} from './section-builder';

// Re-export from file-builder module
export {
  buildFilePayload,
  createFilePayload,
  withExample,
  withImports,
  withProps,
  withSections,
  withWarnings,
  wrapGeneratedSection,
  type FilePayloadBuilder,
  type FilePayloadDraft,
} from './file-builder';
