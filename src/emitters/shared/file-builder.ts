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
 *
 * @module emitters/shared/file-builder
 */

import { GENERATED_SECTION_MARKERS } from "@/src/core/constants";
import {
  type IEmitResult,
  FileChangeStatus,
  type IGeneratedSectionMarkers,
  GeneratedSectionName,
  type IGeneratedSectionPayload,
} from "@/src/core/types";

import { indent, indentBlock } from "./formatting";

export interface IFilePayloadDraft {
  readonly filePath: string;
  readonly action: FileChangeStatus;
  readonly contentLines: readonly string[];
  readonly sections: readonly IGeneratedSectionPayload[];
  readonly warnings: readonly string[];
}

export type FilePayloadBuilder = (
  draft: IFilePayloadDraft,
) => IFilePayloadDraft;

/**
 * Appends import lines to a payload draft.
 *
 * @param lines - Import lines to append.
 * @param draft - Current payload draft.
 * @returns Updated payload draft.
 */
function applyImports(
  lines: readonly string[],
  draft: Readonly<IFilePayloadDraft>,
): IFilePayloadDraft {
  return {
    ...draft,
    contentLines: draft.contentLines.concat(lines),
  };
}

/**
 * Appends section lines and metadata to a payload draft.
 *
 * @param block - Section block to append.
 * @param draft - Current payload draft.
 * @returns Updated payload draft.
 */
function applySectionBlock(
  block: Readonly<ISectionBlock>,
  draft: Readonly<IFilePayloadDraft>,
): IFilePayloadDraft {
  return {
    ...draft,
    contentLines: draft.contentLines.concat(block.lines),
    sections: block.sections
      ? draft.sections.concat(block.sections)
      : draft.sections,
  };
}

/**
 * Appends warnings to a payload draft.
 *
 * @param warnings - Warning strings to append.
 * @param draft - Current payload draft.
 * @returns Updated payload draft.
 */
function applyWarnings(
  warnings: readonly string[],
  draft: Readonly<IFilePayloadDraft>,
): IFilePayloadDraft {
  return {
    ...draft,
    warnings: draft.warnings.concat(warnings),
  };
}

/**
 * Applies a sequence of builders to a payload draft and finalizes the emit result.
 *
 * @param draft - Initial payload draft state.
 * @param builders - Builders to apply in order.
 * @returns Finalized emit result.
 */
export const buildFilePayload = (
  draft: Readonly<IFilePayloadDraft>,
  ...builders: readonly FilePayloadBuilder[]
): IEmitResult => {
  let built = draft;
  for (const builder of builders) {
    built = builder(built);
  }
  return {
    filePath: built.filePath,
    action: built.action,
    content: built.contentLines.join("\n"),
    sections: built.sections.length > 0 ? built.sections : undefined,
    warnings: built.warnings,
  };
};

/**
 * Creates an empty payload draft for an emitted file.
 *
 * @param filePath - Destination file path.
 * @param action - Initial file-change action.
 * @returns Empty payload draft.
 */
export const createFilePayload = (
  filePath: string,
  action: Readonly<FileChangeStatus> = FileChangeStatus.Created,
): IFilePayloadDraft => ({
  filePath,
  action,
  contentLines: [],
  sections: [],
  warnings: [],
});

/**
 * Adds an example section and matching metadata to a payload draft.
 *
 * @param input - Example section content and metadata.
 * @returns Builder that appends the example block.
 */
export const withExample = (
  input: Readonly<ISectionBuilderInput>,
): FilePayloadBuilder => {
  const {
    content,
    markers,
    name = GeneratedSectionName.Example,
    depth = 1,
  } = input;
  return withSections({
    lines: wrapGeneratedSection(content, markers, depth),
    sections: [{ name, content, markers }],
  });
};

interface ISectionBuilderInput {
  readonly content: string;
  readonly markers: IGeneratedSectionMarkers;
  readonly name?: GeneratedSectionName;
  readonly depth?: number;
}

interface ISectionBlock {
  readonly lines: readonly string[];
  readonly sections?: readonly IGeneratedSectionPayload[];
}

export interface ICodeConnectPayloadInput {
  readonly action?: FileChangeStatus;
  readonly exampleMarkers: IGeneratedSectionMarkers;
  readonly exampleSection: string;
  readonly filePath: string;
  readonly footerLines: readonly string[];
  readonly headerLines: readonly string[];
  readonly importLines: readonly string[];
  readonly propsMarkers: IGeneratedSectionMarkers;
  readonly propsSection: string;
  readonly warnings?: readonly string[];
}

/**
 * Adds import lines to a payload draft.
 *
 * @param lines - Import lines to append.
 * @returns Builder that appends the import block.
 */
export const withImports = (lines: readonly string[]): FilePayloadBuilder =>
  applyImports.bind(undefined, lines);

/**
 * Adds a props section and matching metadata to a payload draft.
 *
 * @param input - Props section content and metadata.
 * @returns Builder that appends the props block.
 */
export const withProps = (
  input: Readonly<ISectionBuilderInput>,
): FilePayloadBuilder => {
  const {
    content,
    markers,
    name = GeneratedSectionName.Props,
    depth = 1,
  } = input;
  return withSections({
    lines: wrapGeneratedSection(content, markers, depth),
    sections: [{ name, content, markers }],
  });
};

/**
 * Adds arbitrary content lines and optional section metadata to a payload draft.
 *
 * @param block - Content block and optional section metadata.
 * @returns Builder that appends the provided block.
 */
export function withSections(
  block: Readonly<ISectionBlock>,
): FilePayloadBuilder {
  return applySectionBlock.bind(undefined, block);
}

/**
 * Adds warnings to a payload draft.
 *
 * @param warnings - Warning strings to append.
 * @returns Builder that appends the warnings.
 */
export const withWarnings = (
  warnings: readonly string[] = [],
): FilePayloadBuilder => applyWarnings.bind(undefined, warnings);

/**
 * Builds a standard Code Connect file payload with imports, generated sections,
 * footer content, and warnings.
 *
 * @param input - Precomputed content blocks for a Code Connect file.
 * @returns Emit result with generated content, sections, and warnings.
 */
export function buildCodeConnectPayload(
  input: Readonly<ICodeConnectPayloadInput>,
): IEmitResult {
  const {
    action = FileChangeStatus.Created,
    exampleMarkers,
    exampleSection,
    filePath,
    footerLines,
    headerLines,
    importLines,
    propsMarkers,
    propsSection,
    warnings = [],
  } = input;

  return buildFilePayload(
    createFilePayload(filePath, action),
    withImports(importLines),
    withSections({ lines: headerLines }),
    withProps({
      content: propsSection,
      markers: propsMarkers,
      name: GeneratedSectionName.Props,
      depth: 1,
    }),
    withExample({
      content: exampleSection,
      markers: exampleMarkers,
      name: GeneratedSectionName.Example,
      depth: 1,
    }),
    withSections({ lines: footerLines }),
    withWarnings(warnings),
  );
}

/**
 * Wraps content in generated-section markers with optional indentation.
 *
 * @param content - Raw generated content.
 * @param markers - Start and end markers for the section.
 * @param depth - Base indentation depth.
 * @returns Wrapped section lines including markers.
 */
export function wrapGeneratedSection(
  content: string,
  markers: Readonly<IGeneratedSectionMarkers> = GENERATED_SECTION_MARKERS,
  depth = 0,
): string[] {
  return [
    `${indent(depth)}${markers.start}`,
    ...indentBlock(content, depth),
    `${indent(depth)}${markers.end}`,
  ];
}
