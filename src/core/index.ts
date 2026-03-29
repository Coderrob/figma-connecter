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
 * Core Module Index
 *
 * Re-exports all core types, utilities, and classes.
 *
 * @module core
 */

export {
  buildGeneratedSectionMarkers,
  DEFAULT_CONNECT_OPTIONS,
  DEFAULT_IMPORT_BASE,
  FIGMA_PACKAGE_HTML,
  FIGMA_PACKAGE_REACT,
  GENERATED_SECTION_MARKERS,
} from "./constants";
export {
  formatEmitTargetOptions,
  listEmitTargets,
  parseEmitTargets,
} from "./emit-targets";
export type { ILogContext, ILoggerOptions } from "./logger";
export {
  RegistryFactory,
  type IPluginOptions,
  type IRegistryEntry,
} from "./registry-factory";
export {
  createScopedLogger,
  Logger,
  LogContextKey,
  LogLevel,
  resolveLogLevel,
} from "./logger";
export type { IReportTimer } from "./report";
export {
  addCreatedFile,
  addError,
  addUnchangedFile,
  addUpdatedFile,
  addWarning,
  createEmptyComponentResult,
  createEmptyReport,
  createReportTimer,
  formatReportSummary,
  mergeResults,
  reportReducer,
} from "./report";
export type { IAggregateResult, IDiagnostics, IResult } from "./result";
export {
  addErrors,
  addWarnings,
  aggregateResults,
  applyAggregateDiagnostics,
  applyDiagnostics,
  chain,
  createResult,
  hasDiagnostics,
  hasErrors,
  hasWarnings,
  map,
  mergeDiagnostics,
  mergeErrors,
  mergeWarnings,
} from "./result";
export type {
  IAttributeDescriptor,
  IClassSource,
  IComponentModel,
  IComponentResult,
  IConnectOptions,
  IEmitResult,
  EmitTarget,
  IEmitterOptions,
  IEventDescriptor,
  IExtractionResult,
  FigmaPropertyType,
  IGeneratedSectionMarkers,
  GeneratedSectionName,
  IGeneratedSectionPayload,
  IGenerationReport,
  GenerationStatus,
  IPropertyDescriptor,
  PropertyVisibility,
  ITagNameResult,
} from "./types";
export { ClassDiscoveryMethod, EmitterTarget, FileChangeStatus } from "./types";
