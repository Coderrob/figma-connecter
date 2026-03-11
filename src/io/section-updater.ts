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
} from "../core/constants";
import type {
  GeneratedSectionName,
  GeneratedSectionPayload,
} from "../core/types";
import type { SectionMarkers, SectionUpdateResult } from "../types/io";
import { SectionUpdateStatus } from "../types/io";

interface SectionRange {
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
export const DEFAULT_SECTION_MARKERS: SectionMarkers = {
  end: GENERATED_SECTION_MARKERS.end,
  start: GENERATED_SECTION_MARKERS.start,
};

// ============================================================================
// Private Helper Functions
// ============================================================================

/**
 * Detects the line ending used in a file's content.
 *
 * @param content - File contents to inspect.
 * @param section
 * @param lineEnding
 * @returns The detected line ending string.
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
 * Normalizes all line endings to the specified line ending.
 *
 * @param content - File contents to normalize.
 * @param generatedSection
 * @param indent
 * @param lineEnding - Line ending to apply.
 * @param fromIndex
 * @param markers
 * @returns Normalized content with consistent line endings.
 */
export function buildGeneratedSection(
  generatedSection: string,
  markers: SectionMarkers = DEFAULT_SECTION_MARKERS,
  indent = "",
  lineEnding = LF,
): string {
  const normalized = normalizeLineEndings(
    generatedSection,
    lineEnding,
  ).trimEnd();
  const lines = normalized ? normalized.split(lineEnding) : [];
  const indentedLines = lines.map((line) => `${indent}${line}`);

  return (
    [
      `${indent}${markers.start}`,
      ...indentedLines,
      `${indent}${markers.end}`,
    ].join(lineEnding) + lineEnding
  );
}

/**
 * Finds the previous line break before a given index.
 *
 * @param content - File contents to search.
 * @param fromIndex - Index to search backward from.
 * @param lineEnding
 * @param markers
 * @returns Index of the previous line break or -1.
 */
export function applyGeneratedSectionUpdates(
  content: string,
  sections: readonly GeneratedSectionPayload[],
): string | null {
  if (sections.length === 0) {
    return null;
  }

  const resolved = resolveSections(sections);
  const allMarkersPresent = resolved.every((section) =>
    hasGeneratedSection(content, section.markers),
  );

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
 * Finds the next line break after a given index.
 *
 * @param content - File contents to search.
 * @param fromIndex - Index to search forward from.
 * @param includeLineBreak - Whether to include the line break in the returned index.
 * @param lineEnding
 * @param markers
 * @returns Index of the next line break or -1.
 */
const detectLineEnding = (content: string): string =>
  content.includes(CRLF) ? CRLF : LF;

/**
 * Locates a generated section in the content and returns its indices.
 *
 * @param content - File contents to search.
 * @param markers - Section markers to locate.
 * @param fromIndex
 * @param includeLineBreak
 * @param lineEnding
 * @returns The section range if found, otherwise null.
 */
export function extractGeneratedSection(
  content: string,
  markers: SectionMarkers = DEFAULT_SECTION_MARKERS,
): string | null {
  const range = findSectionRange(content, markers);
  if (!range) {
    return null;
  }

  return content.slice(range.innerStart, range.innerEnd).trimEnd();
}

/**
 * Appends a generated section to the end of the content.
 *
 * @param content - Existing file contents.
 * @param section - Generated section block to append.
 * @param lineEnding - Line ending to use for appended content.
 * @param fromIndex
 * @param includeLineBreak
 * @param markers
 * @returns Updated content with the section appended.
 */
const findSectionRange = (
  content: string,
  markers: SectionMarkers,
): SectionRange | null => {
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
};

interface ResolvedSection {
  readonly name?: GeneratedSectionName;
  readonly content: string;
  readonly markers: SectionMarkers;
}

/**
 * Resolves section markers for a payload, defaulting when absent.
 *
 * @param section - Generated section payload.
 * @param content
 * @param fromIndex
 * @param includeLineBreak
 * @param lineEnding
 * @param markers
 * @returns Resolved marker pair for the section.
 */
export function hasGeneratedSection(
  content: string,
  markers: SectionMarkers = DEFAULT_SECTION_MARKERS,
): boolean {
  return content.includes(markers.start) && content.includes(markers.end);
}

/**
 * Normalizes section payloads into resolved sections with markers.
 *
 * @param sections - Payloads to normalize.
 * @param section
 * @param content
 * @param fromIndex
 * @param includeLineBreak
 * @param lineEnding
 * @returns Resolved section metadata.
 */
const lastLineBreak = (content: string, fromIndex: number): number =>
  content.lastIndexOf(LF, fromIndex);

// ============================================================================
// Public API
// ============================================================================

/**
 * Determines whether a file contains a generated section.
 *
 * @param content - File contents to inspect.
 * @param markers - Section markers to search for.
 * @param sections
 * @param section
 * @param fromIndex
 * @param includeLineBreak
 * @param lineEnding
 * @returns True when both start and end markers are present.
 */
const nextLineBreak = (
  content: string,
  fromIndex: number,
  includeLineBreak = false,
): number => {
  const index = content.indexOf(LF, fromIndex);
  if (index === -1) {
    return -1;
  }
  return includeLineBreak ? index + 1 : index;
};

/**
 * Extracts the generated section contents from a file.
 * Returns null if markers are missing.
 *
 * @param content - File contents to inspect.
 * @param markers - Section markers to locate.
 * @param sections
 * @param section
 * @param fromIndex
 * @param includeLineBreak
 * @param lineEnding
 * @returns The section content or null when missing.
 */
const normalizeLineEndings = (content: string, lineEnding: string): string =>
  content.replace(/\r\n|\r|\n/g, lineEnding);

/**
 * Builds a generated section block with markers and indentation.
 *
 * @param generatedSection - Raw content for the generated section.
 * @param content
 * @param markers - Section markers to use.
 * @param indent - Indentation to apply to each line.
 * @param lineEnding - Line ending to use for joins.
 * @param sections
 * @param section
 * @returns Generated section block with markers.
 */
export function replaceGeneratedSection(
  content: string,
  generatedSection: string,
  markers: SectionMarkers = DEFAULT_SECTION_MARKERS,
): SectionUpdateResult {
  const lineEnding = detectLineEnding(content);
  const normalizedGenerated = normalizeLineEndings(
    generatedSection,
    lineEnding,
  ).trimEnd();
  const range = findSectionRange(content, markers);

  if (!range) {
    const appended = appendSection(
      content,
      buildGeneratedSection(normalizedGenerated, markers, "", lineEnding),
      lineEnding,
    );

    return {
      content: appended,
      status:
        appended === content
          ? SectionUpdateStatus.Unchanged
          : SectionUpdateStatus.Inserted,
    };
  }

  const section = buildGeneratedSection(
    normalizedGenerated,
    markers,
    range.indent,
    lineEnding,
  );
  const updated = `${content.slice(0, range.startLineStart)}${section}${content.slice(range.endLineEnd)}`;

  return {
    content: updated,
    status:
      updated === content
        ? SectionUpdateStatus.Unchanged
        : SectionUpdateStatus.Replaced,
  };
}

/**
 * Replaces or inserts the generated section within a file.
 *
 * @param content - File contents to update.
 * @param generatedSection - Raw section content to insert.
 * @param markers - Section markers to use.
 * @param sections
 * @param section
 * @returns Updated content and update status.
 */
const resolveSectionMarkers = (
  section: GeneratedSectionPayload,
): SectionMarkers => {
  if (section.markers) {
    return section.markers;
  }
  if (section.name) {
    return buildGeneratedSectionMarkers(section.name);
  }
  return DEFAULT_SECTION_MARKERS;
};

/**
 * Applies multiple generated section updates within a file.
 * Returns null if markers are not present.
 *
 * @param content - File contents to update.
 * @param sections - Generated sections to apply.
 * @param generatedSection
 * @param markers
 * @returns Updated content or null when markers are not found.
 */
const resolveSections = (
  sections: readonly GeneratedSectionPayload[],
): ResolvedSection[] =>
  sections.map((section) => ({
    content: section.content,
    markers: resolveSectionMarkers(section),
    name: section.name,
  }));
