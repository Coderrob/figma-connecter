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
 * Web Component Parser Types
 *
 * Defines parser-specific result and helper types for the Web Component parser.
 *
 * @module parsers/webcomponent/types
 */

import type { IResult } from "@/src/core/result";
import type {
  IExtractionResult,
  IComponentModel,
  IClassSource,
  ITagNameResult,
  TagNameSource,
  IEventDescriptor,
} from "@/src/core/types";
import type { IASTVisitorResult } from "@/src/parsers/webcomponent/shared/ast-visitor";
import type ts from "typescript";

/**
 * Result payload for resolved Web Component tag names.
 */
export interface ITagNameResolution {
  readonly tagName: string;
  readonly source: TagNameSource;
  readonly warnings: readonly string[];
}

/**
 * Options for resolving a Web Component tag name.
 */
export interface ITagNameResolverOptions {
  readonly classDeclaration?: ts.ClassDeclaration;
  readonly componentDir: string;
  readonly componentFilePath: string;
  readonly className?: string;
  readonly astData?: IASTVisitorResult;
}

/**
 * Parse result returned by the Web Component parser strategy.
 */
export interface IWebComponentParseResult extends IResult<
  IComponentModel | undefined
> {
  readonly classSource?: IClassSource;
  readonly tagNameResult?: ITagNameResult;
}

/**
 * Result payload for inheritance chain resolution.
 */
export interface IInheritanceResolution {
  readonly chain: readonly ts.ClassLikeDeclaration[];
  readonly warnings: readonly string[];
  readonly unresolved: readonly string[];
}

/**
 * Context required to resolve base classes and mixins.
 */
export interface IInheritanceContext {
  readonly checker: ts.TypeChecker;
  readonly strict?: boolean;
}

/**
 * Result shape for event extraction across a component or inheritance chain.
 */
export type EventExtractionResult = IExtractionResult<IEventDescriptor>;

/**
 * Context required to extract Web Component events from AST data.
 */
export interface IEventExtractionContext {
  readonly astData: IASTVisitorResult;
}
