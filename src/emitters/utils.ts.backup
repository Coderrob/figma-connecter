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
 * Emitter Utilities Module
 *
 * Shared helper functions for code generation emitters.
 * These utilities handle formatting, prop mapping, and code structure.
 *
 * @module emitters/utils
 */

import path from 'node:path';

import { buildGeneratedSectionMarkers, GENERATED_SECTION_MARKERS } from '../core/constants';
import {
  type AttributeDescriptor,
  type ComponentModel,
  type EmitResult,
  type EventDescriptor,
  type GeneratedSectionMarkers,
  GeneratedSectionName,
  type GeneratedSectionPayload,
  type PropertyDescriptor,
} from '../core/types';
import { normalizePath } from '../utils/paths';

// ============================================================================
// Constants
// ============================================================================

export { buildGeneratedSectionMarkers, GENERATED_SECTION_MARKERS };

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

// ============================================================================
// Component Naming
// ============================================================================

/**
 * Extracts the base component name from a ComponentModel.
 * Uses the filename pattern `*.component.ts` or falls back to directory name.
 *
 * @param model - The component model.
 * @returns The base name (e.g., 'button' from 'button.component.ts').
 */
export const getComponentBaseName = (model: ComponentModel): string => {
  const fileName = path.posix.basename(normalizePath(model.filePath));
  const pattern = /^(.*)\.component\.[tj]sx?$/i;
  const match = pattern.exec(fileName);
  if (match?.[1]) {
    return match[1];
  }
  return path.posix.basename(normalizePath(model.componentDir));
};

// ============================================================================
// Figma Prop Mapping
// ============================================================================

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

// ============================================================================
// Sorting Helpers
// ============================================================================

/**
 * Sorts items by their name field using localeCompare.
 *
 * @param items - Items with name fields to sort.
 * @returns Sorted array copy.
 */
export const sortByName = <T extends { name: string }>(items: readonly T[]): T[] =>
  [...items].sort((a, b) => a.name.localeCompare(b.name));

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

// ============================================================================
// Attribute & Event Formatting
// ============================================================================

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

  return [`${indent(depth)}events: {`, ...eventLines, `${indent(depth)},`];
};

// ============================================================================
// Generated Section Handling
// ============================================================================

/**
 * Wraps content with generated section markers.
 *
 * @param content - The content to wrap.
 * @param markers - Marker strings used to delimit the section.
 * @param depth - The indentation depth for markers.
 * @returns Array of lines with markers.
 */
export const wrapGeneratedSection = (
  content: string,
  markers: GeneratedSectionMarkers = GENERATED_SECTION_MARKERS,
  depth = 1,
): string[] => [`${indent(depth)}${markers.start}`, ...indentBlock(content, depth), `${indent(depth)}${markers.end}`];

// ============================================================================
// File Payload Builders
// ============================================================================

/**
 * Draft state for building an emitter file payload.
 */
export interface FilePayloadDraft {
  /** File path for the emitted payload. */
  readonly filePath: string;
  /** Action for the emitted payload. */
  readonly action: 'created' | 'updated' | 'unchanged';
  /** Accumulated file content lines. */
  readonly contentLines: readonly string[];
  /** Accumulated generated section metadata. */
  readonly sections: readonly GeneratedSectionPayload[];
  /** Accumulated warnings. */
  readonly warnings: readonly string[];
}

/**
 * Functional builder for updating a file payload draft.
 */
export type FilePayloadBuilder = (draft: FilePayloadDraft) => FilePayloadDraft;

/**
 * Creates a new file payload draft with default empty values.
 *
 * @param filePath - Target file path.
 * @param action - File action to assign (default: 'created').
 * @returns Initialized file payload draft.
 */
export const createFilePayload = (
  filePath: string,
  action: 'created' | 'updated' | 'unchanged' = 'created',
): FilePayloadDraft => ({
  filePath,
  action,
  contentLines: [],
  sections: [],
  warnings: [],
});

/**
 * Builds a finalized emit result from a draft and builder functions.
 *
 * @param draft - Base payload draft.
 * @param builders - Builder functions to apply in order.
 * @returns Emit result payload.
 */
export const buildFilePayload = (draft: FilePayloadDraft, ...builders: FilePayloadBuilder[]): EmitResult => {
  const built = builders.reduce((acc, builder) => builder(acc), draft);
  return {
    filePath: built.filePath,
    action: built.action,
    content: built.contentLines.join('\n'),
    sections: built.sections.length > 0 ? built.sections : undefined,
    warnings: built.warnings,
  };
};

/**
 * Adds import lines to a payload draft.
 *
 * @param lines - Import lines to append.
 * @returns File payload builder.
 */
export const withImports =
  (lines: readonly string[]): FilePayloadBuilder =>
  (draft) => ({
    ...draft,
    contentLines: draft.contentLines.concat(lines),
  });

interface SectionBuilderInput {
  /** The generated section content (without markers). */
  readonly content: string;
  /** Marker strings used to delimit the section. */
  readonly markers: GeneratedSectionMarkers;
  /** Optional name to attach to the generated section metadata. */
  readonly name?: GeneratedSectionName;
  /** Optional indentation depth for the wrapped section. */
  readonly depth?: number;
}

interface SectionBlock {
  /** Lines to append to content. */
  readonly lines: readonly string[];
  /** Optional sections metadata to append. */
  readonly sections?: readonly GeneratedSectionPayload[];
}

/**
 * Adds arbitrary content lines and optional section metadata.
 *
 * @param block - Section block containing lines and optional metadata.
 * @returns File payload builder.
 */
export const withSections =
  (block: SectionBlock): FilePayloadBuilder =>
  (draft) => ({
    ...draft,
    contentLines: draft.contentLines.concat(block.lines),
    sections: block.sections ? draft.sections.concat(block.sections) : draft.sections,
  });

/**
 * Adds a generated props section to the payload.
 *
 * @param input - Section builder input for props.
 * @returns File payload builder.
 */
export const withProps = (input: SectionBuilderInput): FilePayloadBuilder => {
  const { content, markers, name = GeneratedSectionName.Props, depth = 1 } = input;
  return withSections({
    lines: wrapGeneratedSection(content, markers, depth),
    sections: [{ name, content, markers }],
  });
};

/**
 * Adds a generated example section to the payload.
 *
 * @param input - Section builder input for example.
 * @returns File payload builder.
 */
export const withExample = (input: SectionBuilderInput): FilePayloadBuilder => {
  const { content, markers, name = GeneratedSectionName.Example, depth = 1 } = input;
  return withSections({
    lines: wrapGeneratedSection(content, markers, depth),
    sections: [{ name, content, markers }],
  });
};

/**
 * Adds warnings to the payload.
 *
 * @param warnings - Warning messages to append.
 * @returns File payload builder.
 */
export const withWarnings =
  (warnings: readonly string[] = []): FilePayloadBuilder =>
  (draft) => ({
    ...draft,
    warnings: draft.warnings.concat(warnings),
  });
