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

import type { IComponentModel, IPropertyDescriptor } from "@/src/core/types";
import { normalizedBasename } from "@/src/utils/paths";

import { toTitleCase } from "./formatting";

const PROP_TYPE_ENUM = "enum";

/**
 * Builds a single enum entry line for figma.enum mapping.
 * @param value - Enum value.
 * @returns Formatted enum entry line.
 */
function buildEnumEntryLine(value: string): string {
  const key = toTitleCase(value);
  return `'${key}': ${JSON.stringify(value)},`;
}

/**
 * Builds figma enum mapping lines for a property.
 * @param label - Display label for the property.
 * @param enumValues - Enum values to map.
 * @returns Figma enum mapping lines.
 */
function buildEnumMappingLines(
  label: string,
  enumValues: readonly string[],
): string[] {
  const sorted = enumValues.toSorted(compareByLocale);
  return [`figma.enum('${label}', {`, ...sorted.map(buildEnumEntryLine), "})"];
}

/**
 * Compares two strings using locale-aware ordering.
 * @param left - Left value.
 * @param right - Right value.
 * @returns Comparison result.
 */
function compareByLocale(left: string, right: string): number {
  return left.localeCompare(right);
}

/**
 * Compares two named items using their `name` field.
 * @param left - Left item.
 * @param right - Right item.
 * @returns Comparison result.
 */
function compareByName<T extends { name: string }>(
  left: Readonly<T>,
  right: Readonly<T>,
): number {
  return left.name.localeCompare(right.name);
}

/**
 * Builds a default scalar type mapping table for figma expressions.
 * @param label - Display label for the property.
 * @returns Type-to-expression mapping table.
 */
function createScalarMapping(label: string): Record<string, string> {
  return {
    string: `figma.string('${label}')`,
    number: `figma.string('${label}')`,
    boolean: `figma.boolean('${label}')`,
  };
}

/**
 * IResult of mapping a property to Figma syntax.
 */
export interface IFigmaPropMapping {
  /** Lines of code for the Figma mapping expression. */
  readonly lines: string[];
  /** Warning message if the type couldn't be mapped cleanly. */
  readonly warning?: string;
}

/**
 * getComponentBaseName TODO: describe.
 * @param model TODO: describe parameter
 * @returns TODO: describe return value
 */
export const getComponentBaseName = (
  model: Readonly<IComponentModel>,
): string => {
  const fileName = normalizedBasename(model.filePath);
  const pattern = /^(.*)\.component\.[tj]sx?$/i;
  const match = pattern.exec(fileName);
  if (match?.[1]) {
    return match[1];
  }
  return normalizedBasename(model.componentDir);
};

/**
 * mapPropToFigma TODO: describe.
 * @param prop TODO: describe parameter
 * @returns TODO: describe return value
 */
export const mapPropToFigma = (
  prop: Readonly<IPropertyDescriptor>,
): IFigmaPropMapping => {
  const label = toTitleCase(prop.name);

  // Handle enum types with values
  const propType = String(prop.type);
  if (
    propType === PROP_TYPE_ENUM &&
    prop.enumValues &&
    prop.enumValues.length > 0
  ) {
    return { lines: buildEnumMappingLines(label, prop.enumValues) };
  }

  // Type to Figma mapping
  const mapping = createScalarMapping(label);

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
 * sortByName TODO: describe.
 * @param items TODO: describe parameter
 * @returns TODO: describe return value
 */
export const sortByName = <T extends { name: string }>(
  items: readonly T[],
): T[] => items.toSorted(compareByName);
