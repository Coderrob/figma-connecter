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
 * Parser Types Module
 *
 * Defines shared parser context and registry types.
 *
 * @module parsers/types
 */

import ts from 'typescript';

import type { Result } from '../core/result';
import type { ComponentModel } from '../core/types';

/**
 * Supported parser targets.
 */
export enum ParserTarget {
  WebComponent = 'webcomponent',
}

/**
 * Shared parse context used by parser implementations.
 * Contains file-specific information plus TypeScript resolution context.
 */
export interface ParseContext {
  readonly sourceFile: ts.SourceFile;
  readonly filePath: string;
  readonly componentDir: string;
  readonly checker: ts.TypeChecker;
  readonly strict?: boolean;
}

/**
 * Base result type for parser output.
 */
export type ParserResult = Result<ComponentModel | undefined>;

/**
 * Parser interface for registry-based factories.
 */
export interface Parser {
  readonly target: ParserTarget;
  parse(parseContext: ParseContext): ParserResult;
}
