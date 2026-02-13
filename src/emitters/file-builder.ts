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
 * File Payload Builder Module
 *
 * Provides builder pattern utilities for constructing emit result payloads.
 * Extracted from emitters/utils.ts for better modularity.
 *
 * @module emitters/file-builder
 */

import {
  type EmitResult,
  type GeneratedSectionMarkers,
  GeneratedSectionName,
  type GeneratedSectionPayload,
} from '../core/types';
import { GENERATED_SECTION_MARKERS } from '../core/constants';

import { indent, indentBlock } from './formatting';

/**
 * Draft state for building an emitter file payload.
 */
export interface FilePayloadDraft {
  /** File path for the emitted payload. */
  readonly filePath: string;
  /** Action for the emitted payload. */
  readonly action: 'created' | 'updated' | 'unchanged';
  /** Accumulated file content lines. */
  readonly contentLines: readonly string[];
  /** Accumulated generated section metadata. */
  readonly sections: readonly GeneratedSectionPayload[];
  /** Accumulated warnings. */
  readonly warnings: readonly string[];
}

/**
 * Functional builder for updating a file payload draft.
 */
export type FilePayloadBuilder = (draft: FilePayloadDraft) => FilePayloadDraft;

/**
 * Creates a new file payload draft with default empty values.
 *
 * @param filePath - Target file path.
 * @param action - File action to assign (default: 'created').
 * @returns Initialized file payload draft.
 */
export const createFilePayload = (
  filePath: string,
  action: 'created' | 'updated' | 'unchanged' = 'created',
): FilePayloadDraft => ({
  filePath,
  action,
  contentLines: [],
  sections: [],
  warnings: [],
});

/**
 * Builds a finalized emit result from a draft and builder functions.
 *
 * @param draft - Base payload draft.
 * @param builders - Builder functions to apply in order.
 * @returns Emit result payload.
 */
export const buildFilePayload = (draft: FilePayloadDraft, ...builders: FilePayloadBuilder[]): EmitResult => {
  const built = builders.reduce((acc, builder) => builder(acc), draft);
  return {
    filePath: built.filePath,
    action: built.action,
    content: built.contentLines.join('\n'),
    sections: built.sections.length > 0 ? built.sections : undefined,
    warnings: built.warnings,
  };
};

/**
 * Adds import lines to a payload draft.
 *
 * @param lines - Import lines to append.
 * @returns File payload builder.
 */
export const withImports =
  (lines: readonly string[]): FilePayloadBuilder =>
  (draft) => ({
    ...draft,
    contentLines: draft.contentLines.concat(lines),
  });

interface SectionBuilderInput {
  /** The generated section content (without markers). */
  readonly content: string;
  /** Marker strings used to delimit the section. */
  readonly markers: GeneratedSectionMarkers;
  /** Optional name to attach to the generated section metadata. */
  readonly name?: GeneratedSectionName;
  /** Optional indentation depth for the wrapped section. */
  readonly depth?: number;
}

interface SectionBlock {
  /** Lines to append to content. */
  readonly lines: readonly string[];
  /** Optional sections metadata to append. */
  readonly sections?: readonly GeneratedSectionPayload[];
}

/**
 * Wraps content with generated section markers.
 *
 * @param content - The content to wrap.
 * @param markers - Marker strings used to delimit the section.
 * @param depth - The indentation depth for markers.
 * @returns Array of lines with markers.
 */
export const wrapGeneratedSection = (
  content: string,
  markers: GeneratedSectionMarkers = GENERATED_SECTION_MARKERS,
  depth = 1,
): string[] => [`${indent(depth)}${markers.start}`, ...indentBlock(content, depth), `${indent(depth)}${markers.end}`];

/**
 * Adds arbitrary content lines and optional section metadata.
 *
 * @param block - Section block containing lines and optional metadata.
 * @returns File payload builder.
 */
export const withSections =
  (block: SectionBlock): FilePayloadBuilder =>
  (draft) => ({
    ...draft,
    contentLines: draft.contentLines.concat(block.lines),
    sections: block.sections ? draft.sections.concat(block.sections) : draft.sections,
  });

/**
 * Adds a generated props section to the payload.
 *
 * @param input - Section builder input for props.
 * @returns File payload builder.
 */
export const withProps = (input: SectionBuilderInput): FilePayloadBuilder => {
  const { content, markers, name = GeneratedSectionName.Props, depth = 1 } = input;
  return withSections({
    lines: wrapGeneratedSection(content, markers, depth),
    sections: [{ name, content, markers }],
  });
};

/**
 * Adds a generated example section to the payload.
 *
 * @param input - Section builder input for example.
 * @returns File payload builder.
 */
export const withExample = (input: SectionBuilderInput): FilePayloadBuilder => {
  const { content, markers, name = GeneratedSectionName.Example, depth = 1 } = input;
  return withSections({
    lines: wrapGeneratedSection(content, markers, depth),
    sections: [{ name, content, markers }],
  });
};

/**
 * Adds warnings to the payload.
 *
 * @param warnings - Warning messages to append.
 * @returns File payload builder.
 */
export const withWarnings =
  (warnings: readonly string[] = []): FilePayloadBuilder =>
  (draft) => ({
    ...draft,
    warnings: draft.warnings.concat(warnings),
  });
