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
 * Capitalizes the first character of a string while preserving the rest.
 * Does not scan for the first non-whitespace character.
 * @param value - The string to transform.
 * @returns The string with its first character capitalized, or the original value if empty/falsy.
 */
export const upperCaseFirstCharacter = (value = ''): string =>
  value ? value.charAt(0).toUpperCase() + value.slice(1) : value;

/**
 * Converts a kebab-cased string to title case.
 * Replaces hyphens with spaces and capitalizes the first letter of each word.
 * @param value - The kebab-cased string to convert.
 * @returns The title-cased string with hyphens replaced by spaces.
 */
export const kebabToTitleCase = (value = ''): string =>
  value.trim().split('-').filter(Boolean).map(upperCaseFirstCharacter).join(' ');

/**
 * Converts a string to kebab-case.
 * Handles camelCase, PascalCase, snake_case, and space-delimited values.
 * @param value - The string to convert.
 * @returns The kebab-cased string.
 */
export const toKebabCase = (value = ''): string =>
  value
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[_\s]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '')
    .toLowerCase();

/**
 * Converts a string to PascalCase.
 * Handles kebab-case, snake_case, and space-delimited values.
 * @param value - The string to convert.
 * @returns The PascalCased string.
 */
export const toPascalCase = (value = ''): string =>
  value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .map(upperCaseFirstCharacter)
    .join('');

/**
 * Converts a string to camelCase.
 * Handles kebab-case, snake_case, PascalCase, and space-delimited values.
 * @param value - The string to convert.
 * @returns The camelCased string.
 */
export const toCamelCase = (value = ''): string => {
  const pascal = toPascalCase(value);
  return pascal ? pascal.charAt(0).toLowerCase() + pascal.slice(1) : pascal;
};
