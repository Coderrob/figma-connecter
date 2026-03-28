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

import { GENERATED_SECTION_MARKERS } from "@/src/core/constants";
import {
  type IEmitResult,
  FileChangeStatus,
  type IGeneratedSectionMarkers,
  GeneratedSectionName,
  type IGeneratedSectionPayload,
} from "@/src/core/types";

import { indent, indentBlock } from "./formatting";

/**
 * Draft state for building an emitter file payload.
 */
export interface IFilePayloadDraft {
  /** File path for the emitted payload. */
  readonly filePath: string;
  /** Action for the emitted payload. */
  readonly action: FileChangeStatus;
  /** Accumulated file content lines. */
  readonly contentLines: readonly string[];
  /** Accumulated generated section metadata. */
  readonly sections: readonly IGeneratedSectionPayload[];
  /** Accumulated warnings. */
  readonly warnings: readonly string[];
}

/**
 * Functional builder for updating a file payload draft.
 */
export type FilePayloadBuilder = (
  draft: IFilePayloadDraft,
) => IFilePayloadDraft;

/**
 * Appends import lines to a payload draft.
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
 * @param warnings - Warning lines to append.
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
 * buildFilePayload TODO: describe.
 * @param draft TODO: describe parameter
 * @param builders TODO: describe parameter
 * @returns TODO: describe return value
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
 * createFilePayload TODO: describe.
 * @param filePath TODO: describe parameter
 * @param action TODO: describe parameter
 * @returns TODO: describe return value
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
 * withExample TODO: describe.
 * @param input TODO: describe parameter
 * @returns TODO: describe return value
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
  /** The generated section content (without markers). */
  readonly content: string;
  /** Marker strings used to delimit the section. */
  readonly markers: IGeneratedSectionMarkers;
  /** Optional name to attach to the generated section metadata. */
  readonly name?: GeneratedSectionName;
  /** Optional indentation depth for the wrapped section. */
  readonly depth?: number;
}

interface ISectionBlock {
  /** Lines to append to content. */
  readonly lines: readonly string[];
  /** Optional sections metadata to append. */
  readonly sections?: readonly IGeneratedSectionPayload[];
}

/**
 * withImports TODO: describe.
 * @param lines TODO: describe parameter
 * @returns TODO: describe return value
 */
export const withImports = (lines: readonly string[]): FilePayloadBuilder =>
  applyImports.bind(undefined, lines);

/**
 * withProps TODO: describe.
 * @param input TODO: describe parameter
 * @returns TODO: describe return value
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
 * withSections TODO: describe.
 * @param block TODO: describe parameter
 * @returns TODO: describe return value
 */
export function withSections(
  block: Readonly<ISectionBlock>,
): FilePayloadBuilder {
  return applySectionBlock.bind(undefined, block);
}

/**
 * withWarnings TODO: describe.
 * @param warnings TODO: describe parameter
 * @returns TODO: describe return value
 */
export const withWarnings = (
  warnings: readonly string[] = [],
): FilePayloadBuilder => applyWarnings.bind(undefined, warnings);

/**
 * wrapGeneratedSection TODO: describe.
 * @param content TODO: describe parameter
 * @param markers TODO: describe parameter
 * @param depth TODO: describe parameter
 * @returns TODO: describe return value
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
