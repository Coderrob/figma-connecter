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
 * Figma Property Mapping Module
 *
 * Handles mapping of component properties to Figma Code Connect syntax.
 * Extracted from emitters/utils.ts for better modularity.
 *
 * @module emitters/figma-mapper
 */

import type { ComponentModel, PropertyDescriptor } from '../core/types';
import { normalizedBasename } from '../utils/paths';

import { toTitleCase } from './formatting';

/**
 * Result of mapping a property to Figma syntax.
 */
export interface FigmaPropMapping {
  /** Lines of code for the Figma mapping expression. */
  readonly lines: string[];
  /** Warning message if the type couldn't be mapped cleanly. */
  readonly warning?: string;
}

/**
 * Maps a property descriptor to Figma Code Connect syntax.
 * Handles string, number, boolean, enum, and unknown types.
 *
 * @param prop - The property descriptor to map.
 * @returns The Figma mapping expression lines and optional warning.
 *
 * @example
 * ```typescript
 * mapPropToFigma({ name: 'disabled', type: 'boolean' });
 * // { lines: ["figma.boolean('Disabled')"] }
 *
 * mapPropToFigma({ name: 'variant', type: 'enum', enumValues: ['primary', 'secondary'] });
 * // { lines: ["figma.enum('Variant', {", "'Primary': \"primary\",", ...] }
 * ```
 */
export const mapPropToFigma = (prop: PropertyDescriptor): FigmaPropMapping => {
  const label = toTitleCase(prop.name);

  // Handle enum types with values
  const propType = prop.type as string;
  if (propType === 'enum' && prop.enumValues && prop.enumValues.length > 0) {
    const sorted = [...prop.enumValues].sort((a, b) => a.localeCompare(b));
    const lines = [
      `figma.enum('${label}', {`,
      ...sorted.map((value) => {
        const key = toTitleCase(value);
        return `'${key}': ${JSON.stringify(value)},`;
      }),
      '})',
    ];
    return { lines };
  }

  // Type to Figma mapping
  const mapping: Record<string, string> = {
    string: `figma.string('${label}')`,
    number: `figma.string('${label}')`,
    boolean: `figma.boolean('${label}')`,
  };

  const expression = mapping[prop.type];
  if (expression) {
    return { lines: [expression] };
  }

  // Unknown type - emit as string with warning
  return {
    lines: [`figma.string('${label}')`],
    warning: `Property '${prop.name}' has unknown type '${prop.type}'. Emitting as figma.string().`,
  };
};

/**
 * Sorts items by their name field using localeCompare.
 *
 * @param items - Items with name fields to sort.
 * @returns Sorted array copy.
 */
export const sortByName = <T extends { name: string }>(items: readonly T[]): T[] =>
  [...items].sort((a, b) => a.name.localeCompare(b.name));

/**
 * Extracts the base component name from a ComponentModel.
 * Uses the filename pattern `*.component.ts` or falls back to directory name.
 *
 * @param model - The component model.
 * @returns The base name (e.g., 'button' from 'button.component.ts').
 */
export const getComponentBaseName = (model: ComponentModel): string => {
  const fileName = normalizedBasename(model.filePath);
  const pattern = /^(.*)\.component\.[tj]sx?$/i;
  const match = pattern.exec(fileName);
  if (match?.[1]) {
    return match[1];
  }
  return normalizedBasename(model.componentDir);
};
