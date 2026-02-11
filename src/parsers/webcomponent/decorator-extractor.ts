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

import ts from 'typescript';

import type { PropertyDescriptor } from '../../core/types';
import { FigmaPropertyType, PropertyVisibility } from '../../core/types';
import { toKebabCase } from '../../utils/strings';
import { getDecoratorOptions, getJSDocSummary, getLiteralValue } from '../../utils/ts';

import { extractFromChain } from './chain-extractor';

export interface PropertyExtractionResult {
  readonly properties: readonly PropertyDescriptor[];
  readonly warnings: readonly string[];
}

/**
 * Context for property extraction operations.
 */
export interface PropertyExtractionContext {
  readonly checker: ts.TypeChecker;
}

/**
 * Determines whether a decorator is a `@property` decorator.
 *
 * @param decorator - Decorator node to inspect.
 * @returns True when the decorator targets `property`.
 */
const isPropertyDecorator = (decorator: ts.Decorator): decorator is ts.Decorator => {
  const { expression } = decorator;
  if (!ts.isCallExpression(expression)) {
    return false;
  }
  const callee = expression.expression;
  if (ts.isIdentifier(callee)) {
    return callee.text === 'property';
  }
  if (ts.isPropertyAccessExpression(callee)) {
    return callee.name.text === 'property';
  }
  return false;
};

/**
 * Resolves a property name from a declaration node.
 *
 * @param node - Declaration node to inspect.
 * @returns Property name or null when unresolved.
 */
const getPropertyName = (node: ts.NamedDeclaration): string | null => {
  const { name } = node;
  if (!name) {
    return null;
  }
  if (ts.isIdentifier(name) || ts.isStringLiteral(name)) {
    return name.text;
  }
  if (ts.isComputedPropertyName(name)) {
    const literal = getLiteralValue(name.expression);
    if (typeof literal === 'string') {
      return literal;
    }
  }
  return null;
};

/**
 * Extracts a default value from a property initializer.
 *
 * @param node - Property declaration node.
 * @param sourceFile - Source file containing the node.
 * @returns Parsed default value or null when absent.
 */
const getDefaultValue = (node: ts.PropertyDeclaration, sourceFile: ts.SourceFile): string | number | boolean | null => {
  const { initializer } = node;
  if (!initializer) {
    return null;
  }
  const literal = getLiteralValue(initializer);
  if (literal !== null) {
    return literal;
  }
  return initializer.getText(sourceFile);
};

/**
 * Parses decorator options from a `@property` decorator call.
 *
 * @param decorator - Decorator to parse.
 * @param sourceFile - Source file containing the decorator.
 * @returns Parsed options for type, attribute, and reflect.
 */
const parseDecoratorOptions = (
  decorator: ts.Decorator,
  sourceFile: ts.SourceFile,
): {
  typeName?: string;
  attribute?: string | null;
  reflect?: boolean;
} => {
  const options = getDecoratorOptions(decorator);
  if (!options) {
    return {};
  }

  return options.properties.reduce<{
    typeName?: string;
    attribute?: string | null;
    reflect?: boolean;
  }>((acc, property) => {
    if (!ts.isPropertyAssignment(property) || !ts.isIdentifier(property.name)) {
      return acc;
    }
    const key = property.name.text;

    if (key === 'type') {
      if (ts.isIdentifier(property.initializer)) {
        acc.typeName = property.initializer.text;
      } else if (ts.isPropertyAccessExpression(property.initializer)) {
        acc.typeName = property.initializer.name.text;
      }
    } else if (key === 'attribute') {
      const literal = getLiteralValue(property.initializer);
      if (literal === false) {
        acc.attribute = null;
      } else if (literal === true) {
        acc.attribute = undefined;
      } else if (literal !== null) {
        acc.attribute = String(literal);
      } else {
        acc.attribute = property.initializer.getText(sourceFile);
      }
    } else if (key === 'reflect') {
      const literal = getLiteralValue(property.initializer);
      if (typeof literal === 'boolean') {
        acc.reflect = literal;
      }
    }

    return acc;
  }, {});
};

/**
 * Extracts enum values from a literal union type node.
 *
 * @param typeNode - Type node to inspect.
 * @returns Array of literal values or undefined when not a literal union.
 */
const getEnumValuesFromTypeNode = (typeNode?: ts.TypeNode): string[] | undefined => {
  if (!typeNode || !ts.isUnionTypeNode(typeNode)) {
    return undefined;
  }
  const values = typeNode.types
    .filter(ts.isLiteralTypeNode)
    .map((literal) => (ts.isStringLiteral(literal.literal) ? literal.literal.text : null))
    .filter((value): value is string => Boolean(value));

  return values.length > 0 ? values : undefined;
};

/**
 * Extracts enum values from a resolved union type.
 *
 * @param type - Resolved type from the checker.
 * @returns Array of literal values or undefined when not a literal union.
 */
const getEnumValuesFromType = (type: ts.Type | undefined): string[] | undefined => {
  if (!type || !(type.flags & ts.TypeFlags.Union)) {
    return undefined;
  }
  const union = type as ts.UnionType;
  const values = union.types
    .filter((member) => member.flags & ts.TypeFlags.StringLiteral)
    .map((member) => (member as ts.StringLiteralType).value);
  return values.length > 0 ? values : undefined;
};

/**
 * Resolves a TypeScript type string for a class member.
 *
 * @param node - Member node to inspect.
 * @param checker - Type checker for type resolution.
 * @param sourceFile - Source file containing the member.
 * @returns The resolved type string.
 */
const getTsType = (node: ts.Node, checker: ts.TypeChecker, sourceFile: ts.SourceFile): string => {
  if (ts.isPropertyDeclaration(node) || ts.isGetAccessorDeclaration(node)) {
    if (node.type) {
      return node.type.getText(sourceFile);
    }
  }
  const type = checker.getTypeAtLocation(node);
  return checker.typeToString(type);
};

/**
 * Maps TypeScript type information to a Figma property type.
 *
 * @param typeName - Decorator-provided type name, if any.
 * @param enumValues - Enum values derived from union types.
 * @param tsType - Resolved TypeScript type string.
 * @param propertyName - The property name for pattern-based heuristics.
 * @returns The mapped Figma property type.
 */
const resolveFigmaType = (
  typeName: string | undefined,
  enumValues: string[] | undefined,
  tsType: string,
  propertyName: string,
): FigmaPropertyType => {
  // Pattern-based heuristics: treat HTML tag name properties as strings, not enums
  // These are implementation details, not design-system variants
  const isTagNameProperty = propertyName.toLowerCase().endsWith('tagname');
  if (isTagNameProperty && enumValues && enumValues.length > 0) {
    return FigmaPropertyType.String;
  }

  // Check for enum values from union types (design-system properties)
  if (enumValues && enumValues.length > 0) {
    return FigmaPropertyType.Enum;
  }

  // Explicit decorator type declarations
  if (typeName === 'String') {
    return FigmaPropertyType.String;
  }
  if (typeName === 'Number') {
    return FigmaPropertyType.Number;
  }
  if (typeName === 'Boolean') {
    return FigmaPropertyType.Boolean;
  }

  // Inferred TypeScript types
  const normalized = tsType.toLowerCase();
  if (normalized === 'string') {
    return FigmaPropertyType.String;
  }
  if (normalized === 'number') {
    return FigmaPropertyType.Number;
  }
  if (normalized === 'boolean') {
    return FigmaPropertyType.Boolean;
  }

  return FigmaPropertyType.Unknown;
};

/**
 * Extracts property descriptors from a single class declaration.
 *
 * @param classNode - Class node to inspect.
 * @param context - Property extraction context.
 * @returns Extracted property descriptors and warnings.
 */
const extractPropertyDecoratorsFromClass = (
  classNode: ts.ClassLikeDeclaration,
  context: PropertyExtractionContext,
): PropertyExtractionResult => {
  const descriptors: PropertyDescriptor[] = [];
  const warnings: string[] = [];
  const sourceFile = classNode.getSourceFile();
  const { checker } = context;

  for (const member of classNode.members) {
    if (!ts.isPropertyDeclaration(member) && !ts.isGetAccessorDeclaration(member)) {
      continue;
    }
    if (ts.isPrivateIdentifier(member.name)) {
      continue;
    }
    const modifierFlags = ts.getCombinedModifierFlags(member);
    if (modifierFlags & ts.ModifierFlags.Private) {
      continue;
    }
    const hasProtectedProperty = Boolean(modifierFlags & ts.ModifierFlags.Protected);
    const visibility: PropertyVisibility = hasProtectedProperty
      ? PropertyVisibility.Protected
      : PropertyVisibility.Public;

    const decorators = ts.canHaveDecorators(member) ? (ts.getDecorators(member) ?? []) : [];
    const propertyDecorator = decorators.find(isPropertyDecorator);
    if (!propertyDecorator) {
      continue;
    }

    const propertyName = getPropertyName(member);
    if (!propertyName) {
      warnings.push(`Unable to resolve property name for member: ${member.getText(sourceFile)}`);
      continue;
    }

    const { typeName, attribute, reflect } = parseDecoratorOptions(propertyDecorator, sourceFile);
    const enumValuesFromNode = getEnumValuesFromTypeNode(ts.isPropertyDeclaration(member) ? member.type : undefined);
    const enumValuesFromType = enumValuesFromNode ?? getEnumValuesFromType(checker.getTypeAtLocation(member));
    const tsType = getTsType(member, checker, sourceFile);
    const figmaType = resolveFigmaType(typeName, enumValuesFromType, tsType, propertyName);

    const resolvedAttribute = attribute === null ? null : (attribute ?? toKebabCase(propertyName));

    const descriptor: PropertyDescriptor = {
      name: propertyName,
      attribute: resolvedAttribute,
      type: figmaType,
      tsType,
      reflect: reflect ?? false,
      defaultValue: ts.isPropertyDeclaration(member) ? getDefaultValue(member, sourceFile) : null,
      doc: getJSDocSummary(member),
      visibility,
      ...(figmaType as string === 'enum' && enumValuesFromType ? { enumValues: enumValuesFromType } : {}),
    };

    descriptors.push(descriptor);
  }

  return {
    properties: descriptors,
    warnings,
  };
};

/**
 * Extracts property decorators across an inheritance chain.
 *
 * @param classChain - Ordered class chain to inspect.
 * @param context - Property extraction context.
 * @returns Extracted property descriptors and warnings.
 */
export const extractPropertyDecorators = (
  classChain: readonly ts.ClassLikeDeclaration[],
  context: PropertyExtractionContext,
): PropertyExtractionResult => {
  const extracted = extractFromChain(classChain, {
    /**
     * Extracts properties and warnings for a class node.
     *
     * @param classNode - Class node to inspect.
     * @returns Extracted items and warnings for the class node.
     */
    extract: (classNode) => {
      const { properties, warnings } = extractPropertyDecoratorsFromClass(classNode, context);
      return { items: properties, warnings };
    },
    /**
     * Provides the merge key for a property descriptor.
     *
     * @param descriptor - Property descriptor to key.
     * @returns Key used for deduplication.
     */
    getKey: (descriptor) => descriptor.name,
  });

  return {
    properties: extracted.items,
    warnings: extracted.warnings,
  };
};
