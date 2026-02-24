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
 * String Formatting Utilities Module
 *
 * Provides utilities for string manipulation, indentation, and identifier handling.
 * Extracted from emitters/utils.ts for better modularity.
 *
 * @module emitters/formatting
 */

// ============================================================================
// String Formatting
// ============================================================================

/**
 * Converts a string to Title Case.
 * Handles camelCase, kebab-case, and snake_case inputs.
 *
 * @param value - The string to convert.
 * @returns The title-cased string (e.g., 'primary' → 'Primary').
 *
 * @example
 * ```typescript
 * toTitleCase('primary'); // 'Primary'
 * toTitleCase('dark-mode'); // 'Dark Mode'
 * ```
 */
export const toTitleCase = (value: string): string =>
  value
    .replaceAll(/[_-]+/g, ' ')
    .replaceAll(/([a-z0-9])([A-Z])/g, '$1 $2')
    .trim()
    .split(' ')
    .filter(Boolean)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1).toLowerCase())
    .join(' ');

/**
 * Creates indentation string for the given depth.
 *
 * @param depth - The indentation level (0 = no indent).
 * @returns A string of spaces for indentation.
 */
export const indent = (depth: number): string => '  '.repeat(depth);

/**
 * Indents each line of a content block.
 *
 * @param content - The content to indent.
 * @param depth - The indentation level.
 * @returns Array of indented lines.
 */
export const indentBlock = (content: string, depth: number): string[] => {
  const prefix = indent(depth);
  return content.split('\n').map((line) => `${prefix}${line}`);
};

// ============================================================================
// Identifier Handling
// ============================================================================

/**
 * Checks if a string is a valid JavaScript identifier.
 *
 * @param value - The string to check.
 * @returns True if the string is a valid identifier.
 */
export const isValidIdentifier = (value: string): boolean => /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(value);

/**
 * Formats a property key for object literal syntax.
 * Returns the key as-is if it's a valid identifier, otherwise quotes it.
 *
 * @param value - The property key.
 * @returns The formatted key (e.g., 'disabled' or "'data-value'").
 */
export const formatPropKey = (value: string): string => (isValidIdentifier(value) ? value : `'${value}'`);

/**
 * Formats a property accessor for template literals.
 *
 * @param value - The property name.
 * @returns The accessor expression (e.g., 'props.disabled' or "props['data-value']").
 */
export const formatPropAccessor = (value: string): string =>
  isValidIdentifier(value) ? `props.${value}` : `props['${value}']`;
