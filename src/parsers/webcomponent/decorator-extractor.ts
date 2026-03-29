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

import { extractFromChain } from "./shared/chain-extractor";

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

type PropertyLikeDeclaration =
  | ts.GetAccessorDeclaration
  | ts.PropertyDeclaration;

interface IResolvedMemberMetadata {
  readonly propertyName: string;
  readonly visibility: PropertyVisibility;
}

interface IPropertyAnalysis {
  readonly member: PropertyLikeDeclaration;
  readonly propertyName: string;
  readonly visibility: PropertyVisibility;
  readonly decoratorOptions: Readonly<DecoratorOptionsResult>;
  readonly enumValues: readonly string[] | undefined;
  readonly tsType: string;
  readonly figmaType: FigmaPropertyType;
}

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
 * Extracts decorated property metadata across a class inheritance chain.
 *
 * @param classChain - Ordered class chain to inspect.
 * @param context - Property extraction context.
 * @returns Deduplicated property descriptors and merged warnings.
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
 * Extracts decorated property metadata from a single class declaration.
 *
 * @param classNode - Class declaration to inspect.
 * @param context - Property extraction context.
 * @returns Property descriptors and warnings for the class.
 */
function extractPropertyDecoratorsFromClass(
  classNode: Readonly<ts.ClassLikeDeclaration>,
  context: Readonly<IPropertyExtractionContext>,
): PropertyExtractionResult {
  let descriptors: IPropertyDescriptor[] = [];
  let warnings: string[] = [];

  for (const member of classNode.members) {
    if (!isPropertyLikeDeclaration(member)) {
      continue;
    }

    const descriptorResult = createDescriptorFromMember(member, context);
    if (!descriptorResult) {
      continue;
    }

    if (descriptorResult.descriptor) {
      descriptors = [...descriptors, descriptorResult.descriptor];
    }
    warnings = [...warnings, ...descriptorResult.warnings];
  }

  return {
    items: descriptors,
    warnings,
  };
}

interface IDescriptorResult {
  readonly descriptor?: IPropertyDescriptor;
  readonly warnings: readonly string[];
}

/**
 * Creates a property descriptor for a supported decorated member.
 *
 * @param member - Property-like class member to inspect.
 * @param context - Property extraction context.
 * @returns Descriptor plus warnings, or `null` when the member should be ignored.
 */
function createDescriptorFromMember(
  member: Readonly<PropertyLikeDeclaration>,
  context: Readonly<IPropertyExtractionContext>,
): IDescriptorResult | null {
  const propertyDecorator = getPropertyDecorator(member);
  if (!propertyDecorator) {
    return null;
  }

  const memberMetadata = resolveMemberMetadata(member);
  if (!memberMetadata) {
    return null;
  }
  if ("warning" in memberMetadata) {
    return {
      warnings: [memberMetadata.warning],
    };
  }

  const analysis = analyzeDecoratedMember(
    member,
    memberMetadata,
    propertyDecorator,
    context,
  );
  return {
    descriptor: createPropertyDescriptor(analysis),
    warnings: [],
  };
}

/**
 * Resolves a stable property name and visibility for a property-like member.
 *
 * Members without a stable public or protected name are ignored, while
 * unresolved names on otherwise supported members produce warnings.
 *
 * @param member - Property-like member to inspect.
 * @returns Resolved member metadata, a warning payload, or `null` when ignored.
 */
function resolveMemberMetadata(
  member: Readonly<PropertyLikeDeclaration>,
): IResolvedMemberMetadata | { readonly warning: string } | null {
  if (ts.isPrivateIdentifier(member.name)) {
    return null;
  }

  const modifierFlags = ts.getCombinedModifierFlags(member);
  if (modifierFlags & ts.ModifierFlags.Private) {
    return null;
  }

  const propertyName = getPropertyName(member);
  if (!propertyName) {
    return {
      warning: createUnresolvedMemberWarning(member),
    };
  }

  return {
    propertyName,
    visibility:
      modifierFlags & ts.ModifierFlags.Protected
        ? PropertyVisibility.Protected
        : PropertyVisibility.Public,
  };
}

/**
 * Creates a warning for a member whose property name could not be resolved.
 *
 * @param member - Member that failed name resolution.
 * @returns Warning message describing the unresolved member.
 */
function createUnresolvedMemberWarning(
  member: Readonly<PropertyLikeDeclaration>,
): string {
  return `Unable to resolve property name for member: ${member.getText(
    member.getSourceFile(),
  )}`;
}

/**
 * Analyzes a decorated member into the inputs required for descriptor creation.
 *
 * @param member - Property-like member with a supported decorator.
 * @param memberMetadata - Resolved property name and visibility.
 * @param propertyDecorator - Matched `@property(...)` decorator.
 * @param context - Property extraction context.
 * @returns Normalized analysis payload for descriptor creation.
 */
function analyzeDecoratedMember(
  member: Readonly<PropertyLikeDeclaration>,
  memberMetadata: Readonly<IResolvedMemberMetadata>,
  propertyDecorator: Readonly<ts.Decorator>,
  context: Readonly<IPropertyExtractionContext>,
): IPropertyAnalysis {
  const decoratorOptions = parseDecoratorOptions(
    propertyDecorator,
    member.getSourceFile(),
  );
  const enumValues = getMemberEnumValues(member, context.checker);
  const tsType = getTsType(member, context.checker, member.getSourceFile());

  return {
    member,
    propertyName: memberMetadata.propertyName,
    visibility: memberMetadata.visibility,
    decoratorOptions,
    enumValues,
    tsType,
    figmaType: resolveFigmaType(
      decoratorOptions.typeName,
      enumValues ? [...enumValues] : undefined,
      tsType,
      memberMetadata.propertyName,
    ),
  };
}

/**
 * Creates a property descriptor from normalized member analysis data.
 *
 * @param analysis - Decorated member analysis payload.
 * @returns Property descriptor for downstream model generation.
 */
function createPropertyDescriptor(
  analysis: Readonly<IPropertyAnalysis>,
): IPropertyDescriptor {
  const resolvedAttribute = resolveDescriptorAttribute(
    analysis.propertyName,
    analysis.decoratorOptions.attribute,
  );

  return {
    name: analysis.propertyName,
    attribute: resolvedAttribute,
    type: analysis.figmaType,
    tsType: analysis.tsType,
    reflect: analysis.decoratorOptions.reflect ?? false,
    defaultValue: ts.isPropertyDeclaration(analysis.member)
      ? getDefaultValue(analysis.member, analysis.member.getSourceFile())
      : null,
    doc: getJSDocSummary(analysis.member),
    visibility: analysis.visibility,
    ...(analysis.figmaType === FigmaPropertyType.Enum && analysis.enumValues
      ? { enumValues: [...analysis.enumValues] }
      : {}),
  };
}

/**
 * Resolves the emitted attribute name from decorator options and property name.
 *
 * @param propertyName - Canonical property name.
 * @param attribute - Parsed decorator attribute option.
 * @returns Explicit attribute name, `null` when disabled, or kebab-case default.
 */
function resolveDescriptorAttribute(
  propertyName: string,
  attribute: string | null | undefined,
): string | null {
  return attribute === null ? null : (attribute ?? toKebabCase(propertyName));
}

/**
 * Extracts enum values for a property-like member from syntax first, then type info.
 *
 * @param member - Property-like member to inspect.
 * @param checker - Type checker used for inferred type resolution.
 * @returns Enum values or `undefined` when the member is not enum-like.
 */
function getMemberEnumValues(
  member: Readonly<PropertyLikeDeclaration>,
  checker: Readonly<ts.TypeChecker>,
): readonly string[] | undefined {
  const enumValuesFromNode = ts.isPropertyDeclaration(member)
    ? getEnumValuesFromTypeNode(member.type)
    : undefined;

  return (
    enumValuesFromNode ?? getEnumValuesFromType(checker.getTypeAtLocation(member))
  );
}

/**
 * Returns the supported class-member shapes for property decorator extraction.
 *
 * @param member - Class member candidate.
 * @returns True when the member is a property declaration or getter.
 */
function isPropertyLikeDeclaration(
  member: Readonly<ts.ClassElement>,
): member is PropertyLikeDeclaration {
  return (
    ts.isPropertyDeclaration(member) || ts.isGetAccessorDeclaration(member)
  );
}

/**
 * Returns the first supported `@property` decorator applied to a member.
 *
 * @param member - Property-like member to inspect.
 * @returns Matching decorator or `undefined` when absent.
 */
function getPropertyDecorator(
  member: Readonly<PropertyLikeDeclaration>,
): ts.Decorator | undefined {
  const decorators = ts.canHaveDecorators(member)
    ? (ts.getDecorators(member) ?? [])
    : [];
  return decorators.find(isPropertyDecorator);
}

/**
 * Resolves the default value expression for a property declaration.
 *
 * Literal values are returned as primitives when possible; otherwise the
 * original initializer text is preserved.
 *
 * @param node - Property declaration to inspect.
 * @param sourceFile - Source file used for text extraction.
 * @returns Resolved default value or `null` when absent.
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
 * Extracts string enum values from a TypeScript union type.
 *
 * @param type - Type to inspect.
 * @returns String enum values or `undefined` when none are available.
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
 * Extracts string enum values from a union type node.
 *
 * @param typeNode - Type node to inspect.
 * @returns String enum values or `undefined` when none are available.
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
 * Resolves a stable property name from a named declaration.
 *
 * @param node - Named declaration to inspect.
 * @returns Property name or `null` when it cannot be resolved.
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
 * Resolves a human-readable TypeScript type string for a property-like node.
 *
 * @param node - Node whose type should be resolved.
 * @param checker - Type checker used for inferred type resolution.
 * @param sourceFile - Source file used for explicit type text extraction.
 * @returns Resolved TypeScript type string.
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
 * Returns true when a decorator represents the supported `@property` decorator.
 *
 * @param decorator - Decorator to inspect.
 * @returns True when the decorator matches `@property(...)`.
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
 * Parses supported options from a `@property(...)` decorator call.
 *
 * @param decorator - Decorator to inspect.
 * @param sourceFile - Source file used for text extraction.
 * @returns Parsed decorator options relevant to property extraction.
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
 * Resolves the Figma property type for a decorated property.
 *
 * Resolution considers explicit decorator options, union-derived enum values,
 * inferred TypeScript types, and a small set of property-name heuristics.
 *
 * @param typeName - Decorator-specified runtime type name, if present.
 * @param enumValues - Enum-like string values derived from the property type.
 * @param tsType - Resolved TypeScript type string.
 * @param propertyName - Property name used for heuristics.
 * @returns Resolved Figma property type.
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
