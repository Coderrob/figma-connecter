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

import type { AttributeDescriptor, EventDescriptor, PropertyDescriptor } from '../core/types';

import { formatPropAccessor, formatPropKey, indent } from './formatting';
import { mapPropToFigma, sortByName } from './figma-mapper';

/**
 * Builds the props section of a Figma connect call.
 *
 * @param props - The property descriptors to include.
 * @param depth - The indentation depth.
 * @returns Object with lines and any warnings encountered.
 */
export const buildPropsSection = (
  props: readonly PropertyDescriptor[],
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
  const initial = {
    lines: [`${indent(depth)}props: {`],
    warnings: [] as string[],
  };

  const aggregated = sorted.reduce((acc, prop) => {
    const figmaMapping = mapPropToFigma(prop);
    const propKey = formatPropKey(prop.name);
    const warnings = figmaMapping.warning ? acc.warnings.concat(figmaMapping.warning) : acc.warnings;

    if (figmaMapping.lines.length === 1) {
      return {
        warnings,
        lines: acc.lines.concat(`${indent(depth + 1)}${propKey}: ${figmaMapping.lines[0]},`),
      };
    }

    // Multi-line (enum) handling
    const innerLines = figmaMapping.lines.slice(1, -1).map((innerLine) => `${indent(depth + 2)}${innerLine}`);
    const lastLine = figmaMapping.lines.at(-1);
    const multiLine = [
      `${indent(depth + 1)}${propKey}: ${figmaMapping.lines[0]}`,
      ...innerLines,
      `${indent(depth + 1)}${lastLine},`,
    ];

    return {
      warnings,
      lines: acc.lines.concat(multiLine),
    };
  }, initial);

  return {
    lines: aggregated.lines.concat(`${indent(depth)}},`),
    warnings: aggregated.warnings,
  };
};

/**
 * Result of building a web component example template.
 */
export interface ExampleTemplate {
  /** Example function string for figma.connect. */
  readonly example: string;
  /** Whether the example references props. */
  readonly usesProps: boolean;
}

/**
 * Builds the HTML example template for a web component.
 * Uses lit-html template syntax with property bindings.
 *
 * @param tagName - The custom element tag name.
 * @param attributes - The attributes to bind in the template.
 * @returns The example function string and whether it uses props.
 */
export const buildExampleTemplate = (tagName: string, attributes: readonly AttributeDescriptor[]): ExampleTemplate => {
  if (attributes.length === 0) {
    return {
      example: `() => html\`<${tagName}></${tagName}>\``,
      usesProps: false,
    };
  }

  const sorted = sortByName(attributes);
  const bindings = sorted.map((attribute) => {
    const attrType = attribute.type as string;
    const binding =
      attrType === 'boolean'
        ? `?${attribute.name}=\${${formatPropAccessor(attribute.propertyName)}}`
        : `${attribute.name}="\${${formatPropAccessor(attribute.propertyName)}}"`;
    return `${indent(1)}${binding}`;
  });

  const lines = [`<${tagName}`, ...bindings, `></${tagName}>`];
  return {
    example: `props => html\`${lines.join('\n')}\``,
    usesProps: true,
  };
};

/**
 * Builds the example section for React connect files.
 *
 * @param className - Component class name.
 * @returns Formatted example section string.
 */
export const buildReactExampleSection = (className: string): string =>
  ['example: props => {', `${indent(1)}return <${className} {...props} />;`, '},'].join('\n');

/**
 * Builds an events section mapping event names to handlers.
 *
 * @param events - Event descriptors to include.
 * @param depth - Indentation depth for the section.
 * @returns Lines for the events section.
 */
export const buildEventsSection = (events: readonly EventDescriptor[], depth = 1): string[] => {
  if (events.length === 0) {
    return [`${indent(depth)}events: {},`];
  }

  const sorted = sortByName(events);
  const eventLines = sorted.map((event) => {
    const key = formatPropKey(event.name);
    return `${indent(depth + 1)}${key}: '${event.reactHandler}',`;
  });

  return [`${indent(depth)}events: {`, ...eventLines, `${indent(depth)}},`];
};
