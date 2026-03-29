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
 *
 * @module emitters/shared/section-builder
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

export interface IPropsSection {
  readonly lines: readonly string[];
  readonly warnings: readonly string[];
}

/**
 * Appends a warning when one is present.
 *
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
 * Builds an attribute binding snippet for HTML example templates.
 *
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
 *
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
 * Builds the `events` section for a Figma Code Connect payload.
 *
 * @param events - Event descriptors to serialize.
 * @param depth - Base indentation depth.
 * @returns Event section lines ready to insert into the payload.
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

export interface IExampleTemplate {
  readonly example: string;
  readonly usesProps: boolean;
}

/**
 * Builds the Web Component example function used by `figma.connect(...)`.
 *
 * @param tagName - Custom element tag name to render.
 * @param attributes - Attributes to bind from `props`.
 * @returns Example template string plus whether it references props.
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
 * Builds the `props` section for emitted Code Connect content.
 *
 * @param props - Property descriptors to serialize.
 * @param depth - Base indentation depth.
 * @returns Section lines plus any mapping warnings.
 */
export const buildPropsSection = (
  props: readonly IPropertyDescriptor[],
  depth = 1,
): IPropsSection => {
  if (props.length === 0) {
    return createEmptyPropsSection(depth);
  }

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
 * Builds the React example block used by `figma.connect(...)`.
 *
 * @param className - React component class or function name to render.
 * @returns Multi-line example section string.
 */
export const buildReactExampleSection = (className: string): string =>
  [
    "example: props => {",
    `${indent(1)}return <${className} {...props} />;`,
    "},",
  ].join("\n");

/**
 * Formats a binding line with one level of indentation.
 *
 * @param binding - Raw binding expression.
 * @returns Indented binding line.
 */
function formatBindingLine(binding: string): string {
  return `${indent(1)}${binding}`;
}

/**
 * Formats a single inner enum mapping line.
 *
 * @param depth - Base indentation depth.
 * @param innerLine - Raw inner mapping line.
 * @returns Indented mapping line.
 */
function formatInnerEnumLine(depth: number, innerLine: string): string {
  return `${indent(depth + INNER_INDENT_LEVEL)}${innerLine}`;
}

/**
 * Builds one props-accumulator step for a property descriptor.
 *
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
        createSingleLinePropMapping(depth, propKey, figmaMapping.lines[0]),
      ),
    };
  }

  return {
    warnings,
    lines: accumulator.lines.concat(
      createMultiLinePropMapping(depth, propKey, figmaMapping.lines),
    ),
  };
}

/**
 * Creates the default empty props section.
 *
 * @param depth - Base indentation depth for the section.
 * @returns Empty props section result.
 */
function createEmptyPropsSection(depth: number): IPropsSection {
  return {
    lines: [`${indent(depth)}props: {},`],
    warnings: [],
  };
}

/**
 * Builds a single-line property mapping entry.
 *
 * @param depth - Base indentation depth.
 * @param propKey - Formatted property key.
 * @param expression - Figma mapping expression.
 * @returns Single-line mapping entry.
 */
function createSingleLinePropMapping(
  depth: number,
  propKey: string,
  expression: string,
): string {
  return `${indent(depth + 1)}${propKey}: ${expression},`;
}

/**
 * Builds a multi-line property mapping entry.
 *
 * @param depth - Base indentation depth.
 * @param propKey - Formatted property key.
 * @param lines - Multi-line Figma mapping lines.
 * @returns Multi-line mapping entry.
 */
function createMultiLinePropMapping(
  depth: number,
  propKey: string,
  lines: readonly string[],
): readonly string[] {
  const innerLines = lines
    .slice(1, -1)
    .map(formatInnerEnumLine.bind(undefined, depth));
  const lastLine = lines.at(-1);
  return [
    `${indent(depth + 1)}${propKey}: ${lines[0]}`,
    ...innerLines,
    `${indent(depth + 1)}${lastLine},`,
  ];
}
