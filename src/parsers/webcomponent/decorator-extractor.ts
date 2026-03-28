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

import type { IPropertyDescriptor, IExtractionResult } from "@/src/core/types";

import { FigmaPropertyType, PropertyVisibility } from "@/src/core/types";
import { toKebabCase } from "@/src/utils/strings";
import {
  getDecoratorOptions,
  getJSDocSummary,
  getLiteralValue,
} from "@/src/utils/ts";
import ts from "typescript";

import { extractFromChain } from "./chain-extractor";

const DECORATOR_KEY_ATTRIBUTE = "attribute";
const DECORATOR_KEY_REFLECT = "reflect";
const DECORATOR_KEY_TYPE = "type";
const JS_TYPE_BOOLEAN = "Boolean";
const JS_TYPE_NUMBER = "Number";
const JS_TYPE_STRING = "String";
const PROPERTY_DECORATOR_NAME = "property";
const TS_PRIMITIVE_BOOLEAN = "boolean";
const TS_PRIMITIVE_NUMBER = "number";
const TS_PRIMITIVE_STRING = "string";

type DecoratorOptionsResult = {
  typeName?: string;
  attribute?: string | null;
  reflect?: boolean;
};

/**
 * IResult of property extraction containing properties and warnings.
 */
export type PropertyExtractionResult = IExtractionResult<IPropertyDescriptor>;

/**
 * Context for property extraction operations.
 */
export interface IPropertyExtractionContext {
  readonly checker: ts.TypeChecker;
}

/**
 * extractPropertyDecorators TODO: describe.
 * @param classChain TODO: describe parameter
 * @param context TODO: describe parameter
 * @returns TODO: describe return value
 */
export const extractPropertyDecorators = (
  classChain: readonly ts.ClassLikeDeclaration[],
  context: Readonly<IPropertyExtractionContext>,
): PropertyExtractionResult => {
  const extracted = extractFromChain(classChain, {
    /**
     * Extracts properties and warnings for a class node.
     *
     * @param classNode - Class node to inspect.
     * @returns Extracted items and warnings for the class node.
     */
    extract: (classNode) => {
      const { items, warnings } = extractPropertyDecoratorsFromClass(
        classNode,
        context,
      );
      return { items, warnings };
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
    items: extracted.items,
    warnings: extracted.warnings,
  };
};

/**
 * extractPropertyDecoratorsFromClass TODO: describe.
 * @param classNode TODO: describe parameter
 * @param context TODO: describe parameter
 * @returns TODO: describe return value
 */
function extractPropertyDecoratorsFromClass(
  classNode: Readonly<ts.ClassLikeDeclaration>,
  context: Readonly<IPropertyExtractionContext>,
): PropertyExtractionResult {
  let descriptors: IPropertyDescriptor[] = [];
  let warnings: string[] = [];
  const sourceFile = classNode.getSourceFile();
  const { checker } = context;

  for (const member of classNode.members) {
    if (
      !ts.isPropertyDeclaration(member) &&
      !ts.isGetAccessorDeclaration(member)
    ) {
      continue;
    }
    if (ts.isPrivateIdentifier(member.name)) {
      continue;
    }
    const modifierFlags = ts.getCombinedModifierFlags(member);
    if (modifierFlags & ts.ModifierFlags.Private) {
      continue;
    }
    const hasProtectedProperty = Boolean(
      modifierFlags & ts.ModifierFlags.Protected,
    );
    const visibility: PropertyVisibility = hasProtectedProperty
      ? PropertyVisibility.Protected
      : PropertyVisibility.Public;

    const decorators = ts.canHaveDecorators(member)
      ? (ts.getDecorators(member) ?? [])
      : [];
    const propertyDecorator = decorators.find(isPropertyDecorator);
    if (!propertyDecorator) {
      continue;
    }

    const propertyName = getPropertyName(member);
    if (!propertyName) {
      warnings = [
        ...warnings,
        `Unable to resolve property name for member: ${member.getText(sourceFile)}`,
      ];
      continue;
    }

    const { typeName, attribute, reflect } = parseDecoratorOptions(
      propertyDecorator,
      sourceFile,
    );
    const enumValuesFromNode = getEnumValuesFromTypeNode(
      ts.isPropertyDeclaration(member) ? member.type : undefined,
    );
    const enumValuesFromType =
      enumValuesFromNode ??
      getEnumValuesFromType(checker.getTypeAtLocation(member));
    const tsType = getTsType(member, checker, sourceFile);
    const figmaType = resolveFigmaType(
      typeName,
      enumValuesFromType,
      tsType,
      propertyName,
    );

    const resolvedAttribute =
      attribute === null ? null : (attribute ?? toKebabCase(propertyName));

    const descriptor: IPropertyDescriptor = {
      name: propertyName,
      attribute: resolvedAttribute,
      type: figmaType,
      tsType,
      reflect: reflect ?? false,
      defaultValue: ts.isPropertyDeclaration(member)
        ? getDefaultValue(member, sourceFile)
        : null,
      doc: getJSDocSummary(member),
      visibility,
      ...(figmaType === FigmaPropertyType.Enum && enumValuesFromType
        ? { enumValues: enumValuesFromType }
        : {}),
    };

    descriptors = [...descriptors, descriptor];
  }

  return {
    items: descriptors,
    warnings,
  };
}

/**
 * getDefaultValue TODO: describe.
 * @param node TODO: describe parameter
 * @param sourceFile TODO: describe parameter
 * @returns TODO: describe return value
 */
function getDefaultValue(
  node: Readonly<ts.PropertyDeclaration>,
  sourceFile: Readonly<ts.SourceFile>,
): string | number | boolean | null {
  const { initializer } = node;
  if (!initializer) {
    return null;
  }
  const literal = getLiteralValue(initializer);
  if (literal !== null) {
    return literal;
  }
  return initializer.getText(sourceFile);
}

/**
 * getEnumValuesFromType TODO: describe.
 * @param type TODO: describe parameter
 * @returns TODO: describe return value
 */
function getEnumValuesFromType(
  type: ts.Type | undefined,
): string[] | undefined {
  if (!type || !isUnionType(type)) {
    return undefined;
  }
  const values = type.types
    .filter(isStringLiteralType)
    .map(getStringLiteralValue);
  return values.length > 0 ? values : undefined;
}

/**
 * getEnumValuesFromTypeNode TODO: describe.
 * @param typeNode TODO: describe parameter
 * @returns TODO: describe return value
 */
function getEnumValuesFromTypeNode(
  typeNode?: Readonly<ts.TypeNode>,
): string[] | undefined {
  if (!typeNode || !ts.isUnionTypeNode(typeNode)) {
    return undefined;
  }
  const values = typeNode.types
    .filter(ts.isLiteralTypeNode)
    .map(getLiteralNodeText)
    .filter(isNonNullString);

  return values.length > 0 ? values : undefined;
}

/**
 * Returns the text of a string literal within a LiteralTypeNode, or null.
 *
 * @param literal - LiteralTypeNode to inspect.
 * @returns String value or null.
 */
function getLiteralNodeText(
  literal: Readonly<ts.LiteralTypeNode>,
): string | null {
  return ts.isStringLiteral(literal.literal) ? literal.literal.text : null;
}

/**
 * getPropertyName TODO: describe.
 * @param node TODO: describe parameter
 * @returns TODO: describe return value
 */
function getPropertyName(node: Readonly<ts.NamedDeclaration>): string | null {
  const { name } = node;
  if (!name) {
    return null;
  }
  if (ts.isIdentifier(name) || ts.isStringLiteral(name)) {
    return name.text;
  }
  if (ts.isComputedPropertyName(name)) {
    const literal = getLiteralValue(name.expression);
    if (typeof literal === "string") {
      return literal;
    }
  }
  return null;
}

/**
 * Returns the string literal value from a StringLiteralType.
 *
 * @param type - String literal type.
 * @returns Literal string value.
 */
function getStringLiteralValue(type: Readonly<ts.StringLiteralType>): string {
  return type.value;
}

/**
 * getTsType TODO: describe.
 * @param node TODO: describe parameter
 * @param checker TODO: describe parameter
 * @param sourceFile TODO: describe parameter
 * @returns TODO: describe return value
 */
function getTsType(
  node: Readonly<ts.Node>,
  checker: Readonly<ts.TypeChecker>,
  sourceFile: Readonly<ts.SourceFile>,
): string {
  if (ts.isPropertyDeclaration(node) || ts.isGetAccessorDeclaration(node)) {
    if (node.type) {
      return node.type.getText(sourceFile);
    }
  }
  const type = checker.getTypeAtLocation(node);
  return checker.typeToString(type);
}

/**
 * Narrows a nullable string to a non-null string.
 *
 * @param value - Nullable string value.
 * @returns True when value is a non-null string.
 */
function isNonNullString(value: string | null): value is string {
  return value !== null;
}

/**
 * isPropertyDecorator TODO: describe.
 * @param decorator TODO: describe parameter
 * @returns TODO: describe return value
 */
function isPropertyDecorator(
  decorator: Readonly<ts.Decorator>,
): decorator is ts.Decorator {
  const { expression } = decorator;
  if (!ts.isCallExpression(expression)) {
    return false;
  }
  const callee = expression.expression;
  if (ts.isIdentifier(callee)) {
    return callee.text === PROPERTY_DECORATOR_NAME;
  }
  if (ts.isPropertyAccessExpression(callee)) {
    return callee.name.text === PROPERTY_DECORATOR_NAME;
  }
  return false;
}

/**
 * Narrows a TypeScript type to ts.StringLiteralType.
 *
 * @param type - Type to narrow.
 * @returns True when the type is a string literal type.
 */
function isStringLiteralType(
  type: Readonly<ts.Type>,
): type is ts.StringLiteralType {
  return !!(type.flags & ts.TypeFlags.StringLiteral);
}

/**
 * Narrows a TypeScript type to ts.UnionType.
 *
 * @param type - Type to narrow.
 * @returns True when the type is a union type.
 */
function isUnionType(type: Readonly<ts.Type>): type is ts.UnionType {
  return !!(type.flags & ts.TypeFlags.Union);
}

/**
 * parseDecoratorOptions TODO: describe.
 * @param decorator TODO: describe parameter
 * @param sourceFile TODO: describe parameter
 * @returns TODO: describe return value
 */
function parseDecoratorOptions(
  decorator: Readonly<ts.Decorator>,
  sourceFile: Readonly<ts.SourceFile>,
): DecoratorOptionsResult {
  const options = getDecoratorOptions(decorator);
  if (!options) {
    return {};
  }

  return options.properties.reduce<DecoratorOptionsResult>(
    processDecoratorProperty.bind(null, sourceFile),
    {},
  );
}

/**
 * Processes a single decorator property assignment into the accumulator.
 *
 * @param sourceFile - Source file for text extraction.
 * @param acc - Current accumulator state.
 * @param property - Property assignment to process.
 * @returns Updated accumulator.
 */
function processDecoratorProperty(
  sourceFile: Readonly<ts.SourceFile>,
  acc: Readonly<DecoratorOptionsResult>,
  property: Readonly<ts.ObjectLiteralElementLike>,
): DecoratorOptionsResult {
  if (!ts.isPropertyAssignment(property) || !ts.isIdentifier(property.name)) {
    return acc;
  }
  const key = property.name.text;

  if (key === DECORATOR_KEY_TYPE) {
    if (ts.isIdentifier(property.initializer)) {
      return { ...acc, typeName: property.initializer.text };
    } else if (ts.isPropertyAccessExpression(property.initializer)) {
      return { ...acc, typeName: property.initializer.name.text };
    }
  } else if (key === DECORATOR_KEY_ATTRIBUTE) {
    return {
      ...acc,
      attribute: resolveAttributeOption(property.initializer, sourceFile),
    };
  } else if (key === DECORATOR_KEY_REFLECT) {
    const literal = getLiteralValue(property.initializer);
    if (typeof literal === "boolean") {
      return { ...acc, reflect: literal };
    }
  }

  return acc;
}

/**
 * Resolves the attribute option value from a decorator property initializer.
 *
 * @param initializer - The expression node from the decorator option.
 * @param sourceFile - Source file for text extraction.
 * @returns The resolved attribute name, null to disable, or undefined to use the default.
 */
function resolveAttributeOption(
  initializer: Readonly<ts.Expression>,
  sourceFile: Readonly<ts.SourceFile>,
): string | null | undefined {
  const literal = getLiteralValue(initializer);
  if (literal === null) {
    return initializer.getText(sourceFile);
  }
  if (typeof literal === "boolean") {
    return literal ? undefined : null;
  }
  if (typeof literal === "string") {
    return literal;
  }
  return undefined;
}

/**
 * resolveFigmaType TODO: describe.
 * @param typeName TODO: describe parameter
 * @param enumValues TODO: describe parameter
 * @param tsType TODO: describe parameter
 * @param propertyName TODO: describe parameter
 * @returns TODO: describe return value
 */
function resolveFigmaType(
  typeName: string | undefined,
  enumValues: string[] | undefined,
  tsType: string,
  propertyName: string,
): FigmaPropertyType {
  // Pattern-based heuristics: treat HTML tag name properties as strings, not enums
  // These are implementation details, not design-system variants
  const isTagNameProperty = propertyName.toLowerCase().endsWith("tagname");
  if (isTagNameProperty && enumValues && enumValues.length > 0) {
    return FigmaPropertyType.String;
  }

  // Check for enum values from union types (design-system properties)
  if ((enumValues?.length ?? 0) > 0) {
    return FigmaPropertyType.Enum;
  }

  // Explicit decorator type declarations
  if (typeName === JS_TYPE_STRING) {
    return FigmaPropertyType.String;
  }
  if (typeName === JS_TYPE_NUMBER) {
    return FigmaPropertyType.Number;
  }
  if (typeName === JS_TYPE_BOOLEAN) {
    return FigmaPropertyType.Boolean;
  }

  // Inferred TypeScript types
  const normalized = tsType.toLowerCase();
  if (normalized === TS_PRIMITIVE_STRING) {
    return FigmaPropertyType.String;
  }
  if (normalized === TS_PRIMITIVE_NUMBER) {
    return FigmaPropertyType.Number;
  }
  if (normalized === TS_PRIMITIVE_BOOLEAN) {
    return FigmaPropertyType.Boolean;
  }

  return FigmaPropertyType.Unknown;
}
