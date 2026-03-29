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
 * Shared Emitter Utility API
 *
 * Consolidates the shared emitter utility surface used by built-in emitters.
 *
 * @module emitters/shared/utils
 */

export {
  buildCodeConnectPayload,
  buildFilePayload,
  createFilePayload,
  withExample,
  withImports,
  withProps,
  withSections,
  withWarnings,
  wrapGeneratedSection,
  type ICodeConnectPayloadInput,
  type FilePayloadBuilder,
  type IFilePayloadDraft,
} from "./file-builder";
export {
  getComponentBaseName,
  mapPropToFigma,
  sortByName,
  type IFigmaPropMapping,
} from "./figma-mapper";
export {
  formatPropAccessor,
  formatPropKey,
  indent,
  indentBlock,
  isValidIdentifier,
  toTitleCase,
} from "./formatting";
export {
  buildEventsSection,
  buildExampleTemplate,
  buildPropsSection,
  buildReactExampleSection,
  type IExampleTemplate,
  type IPropsSection,
} from "./section-builder";
