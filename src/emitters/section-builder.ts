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
 * Section Builder Module
 *
 * Builds props, events, and example sections for Figma Code Connect files.
 * Extracted from emitters/utils.ts for better modularity.
 *
 * @module emitters/section-builder
 */

import type {
  IAttributeDescriptor,
  IEventDescriptor,
  IPropertyDescriptor,
} from "@/src/core/types";
import { FigmaPropertyType } from "@/src/core/types";
import { mapPropToFigma, sortByName } from "./figma-mapper";
import { formatPropAccessor, formatPropKey, indent } from "./formatting";

const INNER_INDENT_LEVEL = 2;

interface IPropsAccumulator {
  readonly lines: readonly string[];
  readonly warnings: readonly string[];
}

/**
 * Appends a warning to warning collection when present.
 * @param warnings - Existing warnings.
 * @param warning - Optional warning message.
 * @returns Updated warning collection.
 */
function appendWarning(
  warnings: readonly string[],
  warning: string | undefined,
): readonly string[] {
  return warning ? warnings.concat(warning) : warnings;
}

/**
 * Builds an attribute binding snippet for html example templates.
 * @param attribute - Attribute descriptor.
 * @returns Formatted binding expression.
 */
function buildAttributeBinding(
  attribute: Readonly<IAttributeDescriptor>,
): string {
  const bindingExpression = formatPropAccessor(attribute.propertyName);
  if (attribute.type === FigmaPropertyType.Boolean) {
    return `?${attribute.name}=\${${bindingExpression}}`;
  }

  return `${attribute.name}="\${${bindingExpression}}"`;
}

/**
 * Builds a single event mapping line.
 * @param depth - Base indentation depth.
 * @param event - Event descriptor.
 * @returns Formatted event mapping line.
 */
function buildEventLine(
  depth: number,
  event: Readonly<IEventDescriptor>,
): string {
  const key = formatPropKey(event.name);
  return `${indent(depth + 1)}${key}: '${event.reactHandler}',`;
}

/**
 * buildEventsSection TODO: describe.
 * @param events TODO: describe parameter
 * @param depth TODO: describe parameter
 * @returns TODO: describe return value
 */
export const buildEventsSection = (
  events: readonly IEventDescriptor[],
  depth = 1,
): string[] => {
  if (events.length === 0) {
    return [`${indent(depth)}events: {},`];
  }

  const sorted = sortByName(events);
  const eventLines = sorted.map(buildEventLine.bind(undefined, depth));

  return [`${indent(depth)}events: {`, ...eventLines, `${indent(depth)}},`];
};

/**
 * IResult of building a web component example template.
 */
export interface IExampleTemplate {
  /** Example function string for figma.connect. */
  readonly example: string;
  /** Whether the example references props. */
  readonly usesProps: boolean;
}

/**
 * buildExampleTemplate TODO: describe.
 * @param tagName TODO: describe parameter
 * @param attributes TODO: describe parameter
 * @returns TODO: describe return value
 */
export const buildExampleTemplate = (
  tagName: string,
  attributes: readonly IAttributeDescriptor[],
): IExampleTemplate => {
  if (attributes.length === 0) {
    return {
      example: `() => html\`<${tagName}></${tagName}>\``,
      usesProps: false,
    };
  }

  const sorted = sortByName(attributes);
  const bindings = sorted.map(buildAttributeBinding).map(formatBindingLine);

  const lines = [`<${tagName}`, ...bindings, `></${tagName}>`];
  return {
    example: `props => html\`${lines.join("\n")}\``,
    usesProps: true,
  };
};

/**
 * buildPropsSection TODO: describe.
 * @param props TODO: describe parameter
 * @param depth TODO: describe parameter
 * @returns TODO: describe return value
 */
export const buildPropsSection = (
  props: readonly IPropertyDescriptor[],
  depth = 1,
): { lines: string[]; warnings: string[] } => {
  if (props.length === 0) {
    return {
      lines: [`${indent(depth)}props: {},`],
      warnings: [],
    };
  }

  // Sort deterministically by name
  const sorted = sortByName(props);
  const initial: IPropsAccumulator = {
    lines: [`${indent(depth)}props: {`],
    warnings: [],
  };

  const aggregated = sorted.reduce(
    reducePropsAccumulator.bind(undefined, depth),
    initial,
  );

  return {
    lines: aggregated.lines.concat(`${indent(depth)}},`),
    warnings: aggregated.warnings,
  };
};

/**
 * buildReactExampleSection TODO: describe.
 * @param className TODO: describe parameter
 * @returns TODO: describe return value
 */
export const buildReactExampleSection = (className: string): string =>
  [
    "example: props => {",
    `${indent(1)}return <${className} {...props} />;`,
    "},",
  ].join("\n");

/**
 * Formats a binding line with one level of indentation.
 * @param binding - Raw binding expression.
 * @returns Indented binding line.
 */
function formatBindingLine(binding: string): string {
  return `${indent(1)}${binding}`;
}

/**
 * Formats a single inner enum mapping line.
 * @param depth - Base indentation depth.
 * @param innerLine - Raw inner mapping line.
 * @returns Indented mapping line.
 */
function formatInnerEnumLine(depth: number, innerLine: string): string {
  return `${indent(depth + INNER_INDENT_LEVEL)}${innerLine}`;
}

/**
 * Builds one props accumulator step for a property descriptor.
 * @param depth - Base indentation depth.
 * @param accumulator - Current accumulator.
 * @param prop - Property descriptor to map.
 * @returns Updated accumulator.
 */
function reducePropsAccumulator(
  depth: number,
  accumulator: Readonly<IPropsAccumulator>,
  prop: Readonly<IPropertyDescriptor>,
): IPropsAccumulator {
  const figmaMapping = mapPropToFigma(prop);
  const propKey = formatPropKey(prop.name);
  const warnings = appendWarning(accumulator.warnings, figmaMapping.warning);

  if (figmaMapping.lines.length === 1) {
    return {
      warnings,
      lines: accumulator.lines.concat(
        `${indent(depth + 1)}${propKey}: ${figmaMapping.lines[0]},`,
      ),
    };
  }

  const innerLines = figmaMapping.lines
    .slice(1, -1)
    .map(formatInnerEnumLine.bind(undefined, depth));
  const lastLine = figmaMapping.lines.at(-1);
  const multiLine = [
    `${indent(depth + 1)}${propKey}: ${figmaMapping.lines[0]}`,
    ...innerLines,
    `${indent(depth + 1)}${lastLine},`,
  ];

  return {
    warnings,
    lines: accumulator.lines.concat(multiLine),
  };
}
