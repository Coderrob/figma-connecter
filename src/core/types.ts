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
 * Core Types Module
 *
 * This module defines the shared data models used throughout the figma-connecter
 * CLI tool. These types follow an immutable design pattern and provide
 * language-agnostic representations of component metadata.
 *
 * @module core/types
 */

// ============================================================================
// CLI Configuration Types
// ============================================================================

/**
 * Emit targets for code generation.
 * - `webcomponent`: Generates `*.webcomponent.figma.ts` files using `@figma/code-connect/html`
 * - `react`: Generates `*.react.figma.tsx` files using `@figma/code-connect`
 */
export enum EmitterTarget {
  WebComponent = 'webcomponent',
  React = 'react',
}

/**
 * String union of available emitter targets.
 * Useful for parsing CLI inputs before mapping to `EmitterTarget`.
 */
export type EmitTarget = `${EmitterTarget}`;

// ============================================================================
// Generic Extraction Result
// ============================================================================

/**
 * Generic result type for extraction operations.
 * Provides a consistent shape for operations that extract items and may produce warnings.
 * 
 * @template T - The type of items being extracted
 */
export interface ExtractionResult<T> {
  readonly items: readonly T[];
  readonly warnings: readonly string[];
}

// ============================================================================
// CLI Configuration Types (continued)
// ============================================================================

/**
 * Configuration options for the connect command.
 */
export interface ConnectOptions {
  /** Path to component file or directory. */
  readonly inputPath: string;
  /** Whether to recursively scan subdirectories. */
  readonly recursive: boolean;
  /** Preview changes without writing files. */
  readonly dryRun: boolean;
  /** Force replace existing connect files instead of section updates. */
  readonly force: boolean;
  /** Target formats to emit (webcomponent, react). */
  readonly emitTargets: readonly EmitterTarget[];
  /** Fail on unresolved base classes. */
  readonly strict: boolean;
  /** Path to tsconfig.json for TypeScript program creation. */
  readonly tsconfigPath?: string;
  /** Continue processing components when errors occur. */
  readonly continueOnError?: boolean;
  /** Override base import path for generated imports. */
  readonly baseImportPath?: string;
}

// ============================================================================
// Component Model Types
// ============================================================================

/**
 * Normalized property type for Figma Code Connect mapping.
 */
export enum FigmaPropertyType {
  String = 'string',
  Number = 'number',
  Boolean = 'boolean',
  Enum = 'enum',
  Unknown = 'unknown',
}

/**
 * Visibility for a component property.
 */
export enum PropertyVisibility {
  Public = 'public',
  Protected = 'protected',
}

/**
 * Describes a property extracted from a Web Component's `@property` decorator.
 */
export interface PropertyDescriptor {
  /** The JavaScript property name. */
  readonly name: string;
  /** The HTML attribute name, or null if `attribute: false`. */
  readonly attribute: string | null;
  /** The normalized type for Figma mapping. */
  readonly type: FigmaPropertyType;
  /** TypeScript type string for documentation. */
  readonly tsType: string;
  /** Whether the property reflects to an attribute. */
  readonly reflect: boolean;
  /** Default value from initializer, if present. */
  readonly defaultValue: string | number | boolean | null;
  /** JSDoc summary for the property. */
  readonly doc: string | null;
  /** Visibility of the property within the class. */
  readonly visibility?: PropertyVisibility;
  /** Enum values if the type is 'enum'. */
  readonly enumValues?: readonly string[];
}

/**
 * Describes an HTML attribute derived from a component property.
 */
export interface AttributeDescriptor {
  /** The HTML attribute name (kebab-case). */
  readonly name: string;
  /** The property name that backs this attribute. */
  readonly propertyName: string;
  /** The normalized type for Figma mapping. */
  readonly type: FigmaPropertyType;
  /** Whether the attribute reflects from the property. */
  readonly reflect: boolean;
  /** Default value from initializer, if present. */
  readonly defaultValue: string | number | boolean | null;
  /** JSDoc summary for the attribute. */
  readonly doc: string | null;
}

/**
 * Describes an event dispatched by a Web Component.
 */
export interface EventDescriptor {
  /** The event name (e.g., 'shown'). */
  readonly name: string;
  /** The React event handler name (e.g., 'onShown'). */
  readonly reactHandler: string;
  /** The TypeScript type of the event detail, if any. */
  readonly detailType: string | null;
}

/**
 * The unified component model consumed by emitters.
 * This is the output of parsing and the input for code generation.
 */
export interface ComponentModel {
  /** The class name of the component (e.g., 'Button'). */
  readonly className: string;
  /** The custom element tag name (e.g., 'my-button'). */
  readonly tagName: string;
  /** The file path of the component source. */
  readonly filePath: string;
  /** The directory containing the component. */
  readonly componentDir: string;
  /** Properties extracted from `@property` decorators. */
  readonly props: readonly PropertyDescriptor[];
  /** Attributes derived from component properties. */
  readonly attributes: readonly AttributeDescriptor[];
  /** Events extracted from JSDoc or dispatchEvent calls. */
  readonly events: readonly EventDescriptor[];
  /** Import path for the component. */
  readonly importPath: string;
}

// ============================================================================
// Generation Report Types
// ============================================================================

/**
 * Status of the generation process.
 */
export enum GenerationStatus {
  Success = 'success',
  Warning = 'warning',
  Error = 'error',
}

/**
 * Report produced by the generation process.
 * Used for CLI output and CI integration.
 */
export interface GenerationReport {
  /** Overall status of the generation. */
  readonly status: GenerationStatus;
  /** Files that were created. */
  readonly created: readonly string[];
  /** Files that were updated. */
  readonly updated: readonly string[];
  /** Files that were unchanged. */
  readonly unchanged: readonly string[];
  /** Warning messages encountered during generation. */
  readonly warnings: readonly string[];
  /** Error messages encountered during generation. */
  readonly errors: readonly string[];
  /** Total duration of the generation process in milliseconds. */
  readonly durationMs: number;
  /** Optional per-component results for detailed reporting. */
  readonly componentResults?: readonly ComponentResult[];
}

/**
 * Status of a file change during generation.
 */
export enum FileChangeStatus {
  Created = 'created',
  Updated = 'updated',
  Unchanged = 'unchanged',
}

/**
 * Reason for a file change during generation.
 */
export enum FileChangeReason {
  NewFile = 'new file',
  SectionUpdated = 'section updated',
  ContentUpdated = 'content updated',
  Unchanged = 'unchanged',
}

/**
 * Details about a file change for reporting.
 */
export interface FileChangeDetail {
  /** Path to the affected file. */
  readonly filePath: string;
  /** Change status for the file. */
  readonly status: FileChangeStatus;
  /** Reason describing why the file changed. */
  readonly reason: FileChangeReason;
}

/**
 * Result of processing a single component.
 */
export interface ComponentResult {
  /** The component model, if parsing succeeded. */
  readonly model?: ComponentModel;
  /** The discovered component name, if available. */
  readonly componentName?: string;
  /** Files created for this component. */
  readonly created: readonly string[];
  /** Files updated for this component. */
  readonly updated: readonly string[];
  /** Files unchanged for this component. */
  readonly unchanged: readonly string[];
  /** Detailed change information for each emitted file. */
  readonly fileChanges?: readonly FileChangeDetail[];
  /** Warnings for this component. */
  readonly warnings: readonly string[];
  /** Errors for this component. */
  readonly errors: readonly string[];
}

/**
 * Metadata about the source of a parsed class.
 */
export interface ClassSource {
  /** How the class was discovered. */
  readonly discoveryMethod: 'default-export' | 'custom-element' | 'tagname-jsdoc' | 'first-class';
  /** The file path where the class was found. */
  readonly filePath: string;
}

/**
 * Source of a resolved tag name.
 */
export enum TagNameSource {
  JSDoc = 'jsdoc',
  IndexTs = 'index-ts',
  Filename = 'filename',
  Unknown = 'unknown',
}

/**
 * Result of resolving a component's tag name.
 */
export interface TagNameResult {
  /** The resolved tag name. */
  readonly tagName: string;
  /** How the tag name was resolved. */
  readonly source: TagNameSource;
}

// ============================================================================
// Emitter Types
// ============================================================================

/**
 * Options for emitter configuration.
 */
export interface EmitterOptions {
  /** Whether this is a dry run. */
  readonly dryRun: boolean;
  /** Base import path for components. */
  readonly baseImportPath?: string;
}

/**
 * Marker pair for generated sections.
 */
export interface GeneratedSectionMarkers {
  /** Marker indicating the start of a generated section. */
  readonly start: string;
  /** Marker indicating the end of a generated section. */
  readonly end: string;
}

/**
 * Named generated sections for partial updates.
 */
export enum GeneratedSectionName {
  Props = 'props',
  Example = 'example',
}

/**
 * Payload describing a generated section update.
 */
export interface GeneratedSectionPayload {
  /** Optional name for a targeted generated section. */
  readonly name?: GeneratedSectionName;
  /** The generated section content (without markers). */
  readonly content: string;
  /** Marker strings used to delimit the section. */
  readonly markers?: GeneratedSectionMarkers;
}

/**
 * Result of emitting a single file.
 */
export interface EmitResult {
  /** The file path that was or would be written. */
  readonly filePath: string;
  /** The generated content. */
  readonly content: string;
  /** Optional generated section payloads for partial updates. */
  readonly sections?: readonly GeneratedSectionPayload[];
  /** Whether the file was created, updated, or unchanged. */
  readonly action: FileChangeStatus;
  /** Warnings encountered during emission (e.g., unknown property types). */
  readonly warnings?: readonly string[];
}
