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
 *
 * @module emitters/shared/figma-mapper
 */

import {
  FigmaPropertyType,
  type IComponentModel,
  type IPropertyDescriptor,
} from "@/src/core/types";
import { normalizedBasename } from "@/src/utils/paths";

import { toTitleCase } from "./formatting";

type FigmaScalarPropertyType =
  | FigmaPropertyType.String
  | FigmaPropertyType.Number
  | FigmaPropertyType.Boolean;
type PropertyFigmaType = FigmaPropertyType;

const COMPONENT_FILE_NAME_PATTERN = /^(.*)\.component\.[tj]sx?$/i;

const SCALAR_FIGMA_MAPPERS: Readonly<
  Record<FigmaScalarPropertyType, (label: string) => string>
> = {
  [FigmaPropertyType.String]: buildStringMapping,
  [FigmaPropertyType.Number]: buildStringMapping,
  [FigmaPropertyType.Boolean]: buildBooleanMapping,
};

/**
 * Builds a single enum mapping line.
 *
 * @param value - Enum value to emit.
 * @returns Formatted enum mapping line.
 */
function buildEnumEntryLine(value: string): string {
  const key = toTitleCase(value);
  return `'${key}': ${JSON.stringify(value)},`;
}

/**
 * Builds a boolean Figma mapping expression.
 *
 * @param label - Display label for the property.
 * @returns Boolean mapping expression.
 */
function buildBooleanMapping(label: string): string {
  return `figma.boolean('${label}')`;
}

/**
 * Builds figma enum mapping lines for a property.
 *
 * @param label - Display label for the property.
 * @param enumValues - Enum values to map.
 * @returns Multi-line enum mapping.
 */
function buildEnumMappingLines(
  label: string,
  enumValues: readonly string[],
): string[] {
  const sorted = enumValues.toSorted(compareByLocale);
  return [`figma.enum('${label}', {`, ...sorted.map(buildEnumEntryLine), "})"];
}

/**
 * Builds a string Figma mapping expression.
 *
 * @param label - Display label for the property.
 * @returns String mapping expression.
 */
function buildStringMapping(label: string): string {
  return `figma.string('${label}')`;
}

/**
 * Compares strings using locale-aware ordering.
 *
 * @param left - Left value.
 * @param right - Right value.
 * @returns Comparison result.
 */
function compareByLocale(left: string, right: string): number {
  return left.localeCompare(right);
}

/**
 * Compares named items by their `name` field.
 *
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

export interface IFigmaPropMapping {
  readonly lines: string[];
  readonly warning?: string;
}

/**
 * Derives the base component name used in emitted file content.
 *
 * @param model - Component model providing source-path metadata.
 * @returns Base component name for generated output.
 */
export const getComponentBaseName = (
  model: Readonly<IComponentModel>,
): string => {
  const fileName = normalizedBasename(model.filePath);
  const match = COMPONENT_FILE_NAME_PATTERN.exec(fileName);
  if (match?.[1]) {
    return match[1];
  }
  return normalizedBasename(model.componentDir);
};

/**
 * Maps a property descriptor to one or more Figma Code Connect expressions.
 *
 * @param prop - Property descriptor to map.
 * @returns Figma mapping lines and any warning generated during mapping.
 */
export const mapPropToFigma = (
  prop: Readonly<IPropertyDescriptor>,
): IFigmaPropMapping => {
  const label = toTitleCase(prop.name);
  if (hasEnumMapping(prop)) {
    return { lines: buildEnumMappingLines(label, prop.enumValues) };
  }

  const expression = getScalarMappingExpression(prop.type, label);
  if (expression) {
    return { lines: [expression] };
  }

  return {
    lines: [buildStringMapping(label)],
    warning: `Property '${prop.name}' has unknown type '${prop.type}'. Emitting as figma.string().`,
  };
};

/**
 * Returns a new array sorted by each item's `name` property.
 *
 * @param items - Named items to sort.
 * @returns Items sorted by name.
 */
export const sortByName = <T extends { name: string }>(
  items: readonly T[],
): T[] => items.toSorted(compareByName);

/**
 * Returns the scalar mapping expression for a supported Figma property type.
 *
 * @param propType - Figma property type to map.
 * @param label - Display label for the property.
 * @returns Mapping expression or undefined when unsupported.
 */
function getScalarMappingExpression(
  propType: Readonly<PropertyFigmaType>,
  label: string,
): string | undefined {
  return isScalarPropertyType(propType)
    ? SCALAR_FIGMA_MAPPERS[propType](label)
    : undefined;
}

/**
 * Returns true when a property should be emitted as a Figma enum mapping.
 *
 * @param prop - Property descriptor to inspect.
 * @returns True when enum values are available for an enum property.
 */
function hasEnumMapping(
  prop: Readonly<IPropertyDescriptor>,
): prop is IPropertyDescriptor & { readonly enumValues: readonly string[] } {
  return (
    prop.type === FigmaPropertyType.Enum &&
    Array.isArray(prop.enumValues) &&
    prop.enumValues.length > 0
  );
}

/**
 * Narrows a property type to one of the supported scalar mapping types.
 *
 * @param propType - Property type to narrow.
 * @returns True when the type has a direct scalar mapping.
 */
function isScalarPropertyType(
  propType: Readonly<PropertyFigmaType>,
): propType is FigmaScalarPropertyType {
  return Object.hasOwn(SCALAR_FIGMA_MAPPERS, propType);
}
