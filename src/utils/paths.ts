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

import path from 'node:path';

/**
 * Normalizes a file system path to an absolute, POSIX-style string.
 *
 * @param value - The input path.
 * @returns Normalized absolute path with forward slashes.
 */
export const normalizePath = (value: string): string => {
  if (!value) {
    return '';
  }

  return path.resolve(value).replace(/\\/g, '/');
};

/**
 * Returns the POSIX basename of a normalized path.
 *
 * @param value - The input path.
 * @returns The last segment of the normalized path.
 */
export const normalizedBasename = (value: string): string =>
  path.posix.basename(normalizePath(value));

/**
 * Builds the output file path for a Code Connect file.
 * Places the file in a `code-connect` subdirectory under the component directory.
 *
 * @param componentDir - The component's directory path.
 * @param fileName - The output file name.
 * @returns The full POSIX output path.
 *
 * @example
 * ```typescript
 * buildCodeConnectFilePath('/src/components/button', 'button.react.figma.tsx');
 * // '/src/components/button/code-connect/button.react.figma.tsx'
 * ```
 */
export const buildCodeConnectFilePath = (componentDir: string, fileName: string): string =>
  path.posix.join(componentDir.replace(/\\/g, '/'), 'code-connect', fileName);

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
  const srcMarker = '/src/';
  const markerIndex = normalizedDir.lastIndexOf(srcMarker);
  let rootCandidate = path.posix.dirname(normalizedDir);
  if (markerIndex >= 0) {
    rootCandidate = normalizedDir.slice(0, markerIndex);
  }
  const packageRoot = rootCandidate || path.posix.parse(normalizedDir).root;
  const distReactPath = path.posix.join(packageRoot, 'dist', 'react');
  const codeConnectDir = path.posix.join(normalizedDir, 'code-connect');
  let relativePath = path.posix.relative(codeConnectDir, distReactPath);
  if (!relativePath.startsWith('.')) {
    relativePath = `./${relativePath}`;
  }
  return relativePath;
};
