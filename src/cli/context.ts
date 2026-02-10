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
 * CLI Context Module
 *
 * Standardizes immutable command contexts and execution stages.
 *
 * @module cli/context
 */

import type { Logger } from '../core/logger';

import type { GlobalCliOptions, ProgressIndicator } from './types';

/**
 * Immutable command context for CLI actions.
 */
export type CommandContext<Options, Resolved = Record<string, unknown>> = {
  readonly options: Options;
  readonly globalOptions: GlobalCliOptions;
  readonly logger: Logger;
  readonly progress: ProgressIndicator;
} & Resolved;

/**
 * Generic command stages for CLI actions.
 */
export interface CommandStages<Context, Result> {
  readonly validate: () => Context;
  readonly execute: (context: Context) => Promise<Result>;
  readonly report: (context: Context, result: Result) => void;
  readonly onError?: (context: Context, error: unknown) => void;
}
