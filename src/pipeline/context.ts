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
 * Pipeline Context Module
 *
 * Provides immutable context objects shared across pipeline stages.
 *
 * @module pipeline/context
 */

import ts from 'typescript';

import type { Logger } from '../core/logger';
import type { Emitter } from '../emitters/types';
import type { IoAdapter } from '../io/adapter';
import type { Parser } from '../parsers/types';

/**
 * Shared execution context for the connect pipeline.
 * This context flows through CLI → IO → parser → emitters,
 * eliminating the need for separate option objects.
 */
export interface PipelineContext {
  // TypeScript program context
  readonly checker: ts.TypeChecker;
  readonly sourceFileMap: ReadonlyMap<string, ts.SourceFile>;

  // Pipeline components
  readonly emitters: readonly Emitter[];
  readonly parser: Parser;

  // Execution options
  readonly dryRun: boolean;
  readonly strict: boolean;
  readonly continueOnError?: boolean;
  readonly force: boolean;

  // Code generation options
  readonly baseImportPath?: string;

  // Runtime services
  readonly logger?: Logger;
  readonly io: IoAdapter;
}

/**
 * Context shape required before source loading populates TypeScript details.
 */
export type PipelineContextSeed = Omit<PipelineContext, 'checker' | 'sourceFileMap'> &
  Partial<Pick<PipelineContext, 'checker' | 'sourceFileMap'>>;
