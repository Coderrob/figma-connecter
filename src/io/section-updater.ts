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
 * Section Updater Module
 *
 * Updates generated sections inside existing files using markers.
 *
 * @module io/section-updater
 */

import {
  buildGeneratedSectionMarkers,
  GENERATED_SECTION_MARKERS,
} from "@/src/core/constants";
import type {
  GeneratedSectionName,
  IGeneratedSectionPayload,
} from "@/src/core/types";
import type { ISectionMarkers, ISectionUpdateResult } from "@/src/types/io";
import { SectionUpdateStatus } from "@/src/types/io";

interface ISectionRange {
  readonly endLineEnd: number;
  readonly indent: string;
  readonly innerEnd: number;
  readonly innerStart: number;
  readonly startLineStart: number;
}

// ============================================================================
// Constants
// ============================================================================

/** Windows-style carriage-return + line-feed line ending. */
const CRLF = "\r\n";

/** Unix-style line-feed line ending. */
const LF = "\n";

/** Default markers for generated sections. */
export const DEFAULT_SECTION_MARKERS: ISectionMarkers = {
  end: GENERATED_SECTION_MARKERS.end,
  start: GENERATED_SECTION_MARKERS.start,
};

// ============================================================================
// Private Helper Functions
// ============================================================================

/**
 * Appends a generated section to the end of file content.
 * @param content - Existing file content.
 * @param section - Fully formatted generated section to append.
 * @param lineEnding - Line ending to preserve when appending.
 * @returns Updated content with the section appended.
 */
const appendSection = (
  content: string,
  section: string,
  lineEnding: string,
): string => {
  if (!content) {
    return section;
  }

  const needsLineEnding = !content.endsWith(lineEnding);
  const separator = needsLineEnding ? lineEnding : "";

  return `${content}${separator}${section}${lineEnding}`;
};

/**
 * Applies a set of generated section replacements to existing content.
 * @param content - Existing file content to update.
 * @param sections - Generated sections keyed by marker metadata.
 * @returns Updated content, or null when any required markers are missing.
 */
export function applyGeneratedSectionUpdates(
  content: string,
  sections: readonly IGeneratedSectionPayload[],
): string | null {
  if (sections.length === 0) {
    return null;
  }

  const resolved = resolveSections(sections);
  const hasMarkers = hasResolvedSectionMarkers.bind(undefined, content);
  const allMarkersPresent = resolved.every(hasMarkers);

  if (!allMarkersPresent) {
    return null;
  }

  let updated = content;
  for (const section of resolved) {
    updated = replaceGeneratedSection(
      updated,
      section.content,
      section.markers,
    ).content;
  }
  return updated;
}

/**
 * Wraps generated content with section markers and indentation.
 * @param generatedSection - Inner generated content to wrap.
 * @param markers - Section markers delimiting generated content.
 * @param indent - Indentation prefix to apply to each emitted line.
 * @param lineEnding - Line ending to use in the generated block.
 * @returns Formatted generated section block.
 */
export function buildGeneratedSection(
  generatedSection: string,
  markers: Readonly<ISectionMarkers> = DEFAULT_SECTION_MARKERS,
  indent = "",
  lineEnding = LF,
): string {
  const normalized = normalizeLineEndings(
    generatedSection,
    lineEnding,
  ).trimEnd();
  const lines = normalized ? normalized.split(lineEnding) : [];
  const indentLine = indentGeneratedLine.bind(undefined, indent);
  const indentedLines = lines.map(indentLine);

  return (
    [
      `${indent}${markers.start}`,
      ...indentedLines,
      `${indent}${markers.end}`,
    ].join(lineEnding) + lineEnding
  );
}

/**
 * Detects the preferred line ending used by file content.
 * @param content - File content to inspect.
 * @returns `CRLF` when present, otherwise `LF`.
 */
const detectLineEnding = (content: string): string =>
  content.includes(CRLF) ? CRLF : LF;

/**
 * Extracts the inner generated content between section markers.
 * @param content - File content containing the generated section.
 * @param markers - Section markers to search for.
 * @returns Trimmed inner generated content, or null when markers are absent.
 */
export function extractGeneratedSection(
  content: string,
  markers: Readonly<ISectionMarkers> = DEFAULT_SECTION_MARKERS,
): string | null {
  const range = findSectionRange(content, markers);
  if (!range) {
    return null;
  }

  return content.slice(range.innerStart, range.innerEnd).trimEnd();
}

/**
 * Locates the line and content boundaries for a generated section.
 * @param content - File content to search.
 * @param markers - Section markers delimiting the generated block.
 * @returns Section range metadata, or null when the markers are invalid or missing.
 */
function findSectionRange(
  content: string,
  markers: Readonly<ISectionMarkers>,
): ISectionRange | null {
  const startIndex = content.indexOf(markers.start);
  if (startIndex === -1) {
    return null;
  }
  const endIndex = content.indexOf(
    markers.end,
    startIndex + markers.start.length,
  );
  if (endIndex === -1 || endIndex < startIndex) {
    return null;
  }
  const startLineStart = lastLineBreak(content, startIndex) + 1;
  const startLineEnd = nextLineBreak(content, startIndex);
  const endLineStart = lastLineBreak(content, endIndex) + 1;
  const endLineEnd = nextLineBreak(content, endIndex, true);

  const indent = content.slice(startLineStart, startIndex);
  const innerStart = startLineEnd === -1 ? content.length : startLineEnd + 1;
  const innerEnd = endLineStart;
  return {
    endLineEnd: endLineEnd === -1 ? content.length : endLineEnd,
    indent,
    innerEnd,
    innerStart,
    startLineStart,
  };
}

interface IResolvedSection {
  readonly name?: GeneratedSectionName;
  readonly content: string;
  readonly markers: ISectionMarkers;
}

/**
 * Returns whether content contains both start and end markers for a section.
 * @param content - File content to inspect.
 * @param markers - Section markers to search for.
 * @returns True when both markers are present.
 */
export function hasGeneratedSection(
  content: string,
  markers: Readonly<ISectionMarkers> = DEFAULT_SECTION_MARKERS,
): boolean {
  return content.includes(markers.start) && content.includes(markers.end);
}

/**
 * Returns whether a resolved section's markers exist in file content.
 * @param content - File content to inspect.
 * @param section - Resolved section metadata to verify.
 * @returns True when the section markers are present.
 */
function hasResolvedSectionMarkers(
  content: string,
  section: Readonly<IResolvedSection>,
): boolean {
  return hasGeneratedSection(content, section.markers);
}

/**
 * Applies indentation to a generated content line.
 * @param indent - Indentation prefix for the section.
 * @param line - Generated content line to indent.
 * @returns Indented line content.
 */
function indentGeneratedLine(indent: string, line: string): string {
  return `${indent}${line}`;
}

/**
 * Finds the previous line break before a given index.
 * @param content - File content to inspect.
 * @param fromIndex - Index to search backward from.
 * @returns Index of the previous line-feed character, or `-1` when absent.
 */
function lastLineBreak(content: string, fromIndex: number): number {
  return content.lastIndexOf(LF, fromIndex);
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Finds the next line break after a given index.
 * @param content - File content to inspect.
 * @param fromIndex - Index to search forward from.
 * @param includeLineBreak - Whether to return the position after the line break.
 * @returns Index of the next line break, adjusted when requested, or `-1`.
 */
function nextLineBreak(
  content: string,
  fromIndex: number,
  includeLineBreak = false,
): number {
  const index = content.indexOf(LF, fromIndex);
  if (index === -1) {
    return -1;
  }
  return includeLineBreak ? index + 1 : index;
}

/**
 * Normalizes all line endings in content to a single style.
 * @param content - Text content to normalize.
 * @param lineEnding - Target line ending sequence.
 * @returns Content with normalized line endings.
 */
function normalizeLineEndings(content: string, lineEnding: string): string {
  return content.replaceAll(/\r\n|\r|\n/g, lineEnding);
}

/**
 * Replaces an existing generated section or appends it when missing.
 * @param content - Existing file content to update.
 * @param generatedSection - Inner generated content to write.
 * @param markers - Section markers delimiting the generated block.
 * @returns Updated content and status describing the applied change.
 */
export function replaceGeneratedSection(
  content: string,
  generatedSection: string,
  markers: Readonly<ISectionMarkers> = DEFAULT_SECTION_MARKERS,
): ISectionUpdateResult {
  const lineEnding = detectLineEnding(content);
  const normalizedGenerated = normalizeLineEndings(
    generatedSection,
    lineEnding,
  ).trimEnd();
  const range = findSectionRange(content, markers);
  if (!range) {
    const generated = buildGeneratedSection(
      normalizedGenerated,
      markers,
      "",
      lineEnding,
    );
    const appended = appendSection(content, generated, lineEnding);
    return toInsertedResult(content, appended);
  }
  const section = buildGeneratedSection(
    normalizedGenerated,
    markers,
    range.indent,
    lineEnding,
  );
  const updated = `${content.slice(0, range.startLineStart)}${section}${content.slice(range.endLineEnd)}`;
  return toReplacedResult(content, updated);
}

/**
 * Builds the update result for an inserted generated section.
 * @param content - Original content before insertion.
 * @param appended - Content after insertion.
 * @returns Section update result.
 */
function toInsertedResult(
  content: string,
  appended: string,
): ISectionUpdateResult {
  return {
    content: appended,
    status:
      appended === content
        ? SectionUpdateStatus.Unchanged
        : SectionUpdateStatus.Inserted,
  };
}

/**
 * Builds the update result for a replaced generated section.
 * @param content - Original content before replacement.
 * @param updated - Content after replacement.
 * @returns Section update result.
 */
function toReplacedResult(
  content: string,
  updated: string,
): ISectionUpdateResult {
  return {
    content: updated,
    status:
      updated === content
        ? SectionUpdateStatus.Unchanged
        : SectionUpdateStatus.Replaced,
  };
}

/**
 * Resolves section markers from explicit markers or a generated section name.
 * @param section - Generated section payload to resolve markers for.
 * @returns Section markers associated with the payload.
 */
function resolveSection(
  section: Readonly<IGeneratedSectionPayload>,
): IResolvedSection {
  return {
    content: section.content,
    markers: resolveSectionMarkers(section),
    name: section.name,
  };
}

/**
 * Resolves section markers from explicit markers or a generated section name.
 * @param section - Generated section payload to resolve markers for.
 * @returns Section markers associated with the payload.
 */
function resolveSectionMarkers(
  section: Readonly<IGeneratedSectionPayload>,
): ISectionMarkers {
  if (section.markers) {
    return section.markers;
  }
  if (section.name) {
    return buildGeneratedSectionMarkers(section.name);
  }
  return DEFAULT_SECTION_MARKERS;
}

/**
 * Normalizes generated section payloads into resolved section metadata.
 * @param sections - Generated section payloads to normalize.
 * @returns Resolved section metadata with explicit markers.
 */
function resolveSections(
  sections: readonly IGeneratedSectionPayload[],
): IResolvedSection[] {
  return sections.map(resolveSection);
}
