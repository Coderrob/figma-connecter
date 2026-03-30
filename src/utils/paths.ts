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
 * Path Utilities Module
 *
 * Provides normalization and path building helpers for consistent path
 * handling across platforms and emitters.
 *
 * @module utils/paths
 */

import path from "node:path";

/** POSIX path separator character. */
export const POSIX_PATH_SEPARATOR = "/";
const WINDOWS_PATH_SEPARATOR_PATTERN = /\\/g;
const WINDOWS_DRIVE_ABSOLUTE_PATH_PATTERN = /^[A-Za-z]:\//;

/**
 * Converts Windows path separators to POSIX separators.
 *
 * @param value - Path string to normalize.
 * @returns Path string using forward slashes.
 */
function toPosixSeparators(value: string): string {
  return value.replaceAll(WINDOWS_PATH_SEPARATOR_PATTERN, POSIX_PATH_SEPARATOR);
}

/**
 * Returns true when a path is already POSIX-absolute.
 *
 * @param value - Path string to inspect.
 * @returns True when the path starts at a POSIX root.
 */
function isPosixAbsolutePath(value: string): boolean {
  return value.startsWith(POSIX_PATH_SEPARATOR);
}

/**
 * Returns true when a path is Windows-drive absolute after slash normalization.
 *
 * @param value - Normalized path string to inspect.
 * @returns True when the path includes a drive prefix.
 */
function isWindowsDriveAbsolutePath(value: string): boolean {
  return WINDOWS_DRIVE_ABSOLUTE_PATH_PATTERN.test(value);
}

/**
 * Normalizes a path without forcing it to become absolute.
 *
 * @param value - Input path string.
 * @returns POSIX-style normalized path.
 */
function normalizePortablePath(value: string): string {
  return path.posix.normalize(toPosixSeparators(value));
}

/**
 * Builds the output path for a generated Code Connect file.
 * @param componentDir - Source component directory that owns the generated file.
 * @param fileName - Generated file name to place inside `code-connect`.
 * @returns POSIX-style path to the generated Code Connect file.
 */
export const buildCodeConnectFilePath = (
  componentDir: string,
  fileName: string,
): string =>
  path.posix.join(
    normalizePortablePath(componentDir),
    "code-connect",
    fileName,
  );

/**
 * Resolves the basename from a normalized path string.
 * @param value - Path value to normalize before extracting the basename.
 * @returns Final path segment using POSIX path semantics.
 */
export const normalizedBasename = (value: string): string =>
  path.posix.basename(normalizePath(value));

/**
 * Normalizes a filesystem path to an absolute POSIX-style string.
 * @param value - Input path to normalize.
 * @returns Absolute path with forward slashes, or an empty string for empty input.
 */
export function normalizePath(value: string): string {
  if (!value) {
    return "";
  }

  const portablePath = normalizePortablePath(value);
  if (
    isPosixAbsolutePath(portablePath) ||
    isWindowsDriveAbsolutePath(portablePath)
  ) {
    return portablePath;
  }

  return toPosixSeparators(path.resolve(value));
}

/**
 * Resolves the relative dist/react import path from the code-connect directory.
 *
 * Walks up from the component directory to find the package root (the directory
 * containing `src/`), then returns a relative path from `<componentDir>/code-connect`
 * to `<packageRoot>/dist/react`.
 *
 * @param componentDir - The component's directory path.
 * @returns A relative import path string (always prefixed with `./` or `../`).
 *
 * @example
 * ```typescript
 * resolveDistReactImportPath('/packages/components/src/components/button');
 * // '../../../../dist/react'
 * ```
 */
export const resolveDistReactImportPath = (componentDir: string): string => {
  const normalizedDir = normalizePath(componentDir);
  const srcMarker = "/src/";
  const markerIndex = normalizedDir.lastIndexOf(srcMarker);
  let rootCandidate = path.posix.dirname(normalizedDir);
  if (markerIndex >= 0) {
    rootCandidate = normalizedDir.slice(0, markerIndex);
  }
  const packageRoot = rootCandidate || path.posix.parse(normalizedDir).root;
  const distReactPath = path.posix.join(packageRoot, "dist", "react");
  const codeConnectDir = path.posix.join(normalizedDir, "code-connect");
  let relativePath = path.posix.relative(codeConnectDir, distReactPath);
  if (!relativePath.startsWith(".")) {
    relativePath = `./${relativePath}`;
  }
  return relativePath;
};
